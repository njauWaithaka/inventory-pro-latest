import { 
  collection, 
  getDocs, 
  doc, 
  writeBatch, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export class AlertService {
  static async runAlertSync(companyId: string) {
    if (!companyId) return;

    try {
      // 1. Fetch products
      const productsRef = collection(db, `companies/${companyId}/products`);
      const productsSnap = await getDocs(productsRef);
      const products = productsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // 2. Fetch sales
      const salesRef = collection(db, `companies/${companyId}/sales`);
      const salesSnap = await getDocs(salesRef);
      const sales = salesSnap.docs.map(doc => doc.data()) as any[];

      // 3. Fetch POs
      const poRef = collection(db, `companies/${companyId}/purchaseOrders`);
      const poSnap = await getDocs(poRef);
      const purchaseOrders = poSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // 4. Fetch existing alerts to preserve status (Read, Resolved, Dismissed)
      const alertsRef = collection(db, `companies/${companyId}/inventory_alerts`);
      const existingAlertsSnap = await getDocs(alertsRef);
      const existingAlertsMap = new Map<string, any>();
      existingAlertsSnap.docs.forEach(d => {
        existingAlertsMap.set(d.id, d.data());
      });

      const batch = writeBatch(db);
      const now = new Date();
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const generatedAlertIds = new Set<string>();
      const alertsToWrite: any[] = [];

      // 5. Calculate and Update Products
      for (const product of products) {
        const productSales = sales.filter((s: any) => s.productId === product.id);
        
        // Sales in last 30 days
        const salesLast30Days = productSales.filter((s: any) => {
          const sDate = s.saleDate || s.createdAt;
          if (!sDate) return false;
          return new Date(sDate).getTime() >= thirtyDaysAgo.getTime();
        });

        // Sales in last 7 days
        const salesLast7Days = productSales.filter((s: any) => {
          const sDate = s.saleDate || s.createdAt;
          if (!sDate) return false;
          return new Date(sDate).getTime() >= sevenDaysAgo.getTime();
        });

        const salesLast30DaysUnits = salesLast30Days.reduce((sum: number, s: any) => sum + (Number(s.quantitySold) || 0), 0);
        const salesLast7DaysUnits = salesLast7Days.reduce((sum: number, s: any) => sum + (Number(s.quantitySold) || 0), 0);

        // Calculate actual units sold in last 30 days, or fallback to the product's unitsSold value if no logs exist
        const totalQtySold = Math.max(salesLast30DaysUnits, Number(product.unitsSold) || 0);
        
        // Average Daily Sales (ADS) based on actual historical sales data
        const ADS = totalQtySold / 30;

        // Classify products as Fast-moving, Moderate-moving, or Slow-moving based on sales rate (ADS)
        let speed: 'fast' | 'moderate' | 'slow' | 'obsolete' = 'slow';
        if (product.status === 'Inactive') {
          speed = 'obsolete';
        } else if (ADS >= 1.0) {
          speed = 'fast';
        } else if (ADS >= 0.3) {
          speed = 'moderate';
        } else {
          speed = 'slow';
        }

        // Configure lead times and safety stocks dynamically based on velocity/sales rate
        let safetyDays = 3;
        let safetyStockBase = 5;
        let leadTime = Number(product.leadTime) || 7; // Default lead time of 7 days if not set

        if (speed === 'fast') {
          safetyDays = 5;       // More buffer days for fast items
          safetyStockBase = 10; // Extra safety stock base for fast-moving items
          if (!product.leadTime) leadTime = 8;
        } else if (speed === 'moderate') {
          safetyDays = 3;
          safetyStockBase = 5;
          if (!product.leadTime) leadTime = 6;
        } else if (speed === 'slow') {
          safetyDays = 1;
          safetyStockBase = 2;   // Minimal safety stock base
          if (!product.leadTime) leadTime = 4;
        } else if (speed === 'obsolete') {
          safetyDays = 0;
          safetyStockBase = 0;
          leadTime = 0;
        }

        // Safety Stock = (ADS * safetyDays) + safetyStockBase
        const safetyStock = (ADS * safetyDays) + safetyStockBase;

        // Reorder Point (ROP) = (ADS * leadTime) + safetyStock
        const dynamicROP = Math.ceil((ADS * leadTime) + safetyStock);

        // Manual override check
        const hasManualOverride = typeof product.manualReorderPoint === 'number' && product.manualReorderPoint >= 0;
        const activeROP = hasManualOverride ? product.manualReorderPoint : dynamicROP;

        const quantity = Number(product.quantity) || 0;

        // Prepare product updates
        const prodRef = doc(db, `companies/${companyId}/products`, product.id);
        batch.update(prodRef, {
          averageDailySales: ADS,
          calculatedReorderPoint: dynamicROP,
          safetyStock: Math.round(safetyStock),
          minStock: activeROP, // Sync minStock with our calculated/manual ROP
          reorderPoint: activeROP,
          movement: speed,
          updatedAt: new Date().toISOString()
        });

        // ==========================================
        // 6. Generate Product Alerts
        // ==========================================

        // -- ALERT 1: Out of Stock (quantity <= 0)
        if (quantity <= 0) {
          const alertId = `outofstock_${product.id}`;
          generatedAlertIds.add(alertId);
          alertsToWrite.push({
            id: alertId,
            type: 'reorder',
            title: `Out of Stock: ${product.name}`,
            description: `Stock level has reached 0. Immediate restock of ${product.name} (SKU: ${product.sku || 'N/A'}) is required.`,
            severity: 'critical',
            actionLabel: 'Purchase',
            timestamp: new Date().toISOString()
          });
        }

        // -- ALERT 2: Restock Needed (0 < quantity <= activeROP)
        if (quantity > 0 && activeROP > 0 && quantity <= activeROP) {
          const alertId = `restock_${product.id}`;
          generatedAlertIds.add(alertId);
          alertsToWrite.push({
            id: alertId,
            type: 'reorder',
            title: `Restock Needed: ${product.name}`,
            description: `Stock level of ${product.name} is low (${quantity} units), falling below the calculated reorder point of ${activeROP}.`,
            severity: 'high',
            actionLabel: 'Reorder',
            timestamp: new Date().toISOString()
          });
        }

        // -- ALERT 3: Low Stock Warning (approaching reorder level, e.g., activeROP < quantity <= activeROP * 1.3)
        if (activeROP > 0 && quantity > activeROP && quantity <= activeROP * 1.3) {
          const alertId = `lowstock_${product.id}`;
          generatedAlertIds.add(alertId);
          alertsToWrite.push({
            id: alertId,
            type: 'reorder',
            title: `Low Stock: ${product.name}`,
            description: `Stock level of ${product.name} (${quantity} units) is approaching the reorder point of ${activeROP}.`,
            severity: 'medium',
            actionLabel: 'Monitor',
            timestamp: new Date().toISOString()
          });
        }

        // -- ALERT 4: Overstock Warning (quantity >= activeROP * 3, minimum stock 20 to avoid minor overstock issues)
        if (activeROP > 0 && quantity >= Math.max(activeROP * 3, 20)) {
          const alertId = `overstock_${product.id}`;
          generatedAlertIds.add(alertId);
          alertsToWrite.push({
            id: alertId,
            type: 'overstock',
            title: `Overstock Warning: ${product.name}`,
            description: `Stock level of ${product.name} is high (${quantity} units), exceeding the reorder point of ${activeROP} by more than 3x.`,
            severity: 'low',
            actionLabel: 'Promote',
            timestamp: new Date().toISOString()
          });
        }

        // -- ALERT 5: Dead Stock (no sales in the last 30 days and product age > 30 days and quantity > 0)
        const deadStockDays = Number(product.deadStockDays) || 30;
        const productCreatedTime = new Date(product.createdAt || now).getTime();
        const daysSinceCreation = (now.getTime() - productCreatedTime) / (1000 * 60 * 60 * 24);
        if (productSales.length === 0 && daysSinceCreation >= deadStockDays && quantity > 0) {
          const alertId = `deadstock_${product.id}`;
          generatedAlertIds.add(alertId);
          alertsToWrite.push({
            id: alertId,
            type: 'slow',
            title: `Dead Stock: ${product.name}`,
            description: `No sales recorded for ${product.name} in the last ${deadStockDays} days. Remaining: ${quantity} units.`,
            severity: 'medium',
            actionLabel: 'Review',
            timestamp: new Date().toISOString()
          });
        }

        // -- ALERT 6: Expiring Products (if expiry date is set)
        if (product.expiryDate) {
          const exp = new Date(product.expiryDate);
          const diffTime = exp.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 30 && quantity > 0) {
            const alertId = `expiring_${product.id}`;
            generatedAlertIds.add(alertId);
            const isExpired = diffDays <= 0;
            alertsToWrite.push({
              id: alertId,
              type: 'expiry',
              title: isExpired ? `Expired Product: ${product.name}` : `Expiring Soon: ${product.name}`,
              description: isExpired 
                ? `Product ${product.name} has expired on ${product.expiryDate}. Please dispose of ${quantity} units.` 
                : `Product ${product.name} is expiring on ${product.expiryDate} (${diffDays} days remaining). Remaining: ${quantity} units.`,
              severity: isExpired ? 'critical' : (diffDays <= 14 ? 'high' : 'medium'),
              actionLabel: isExpired ? 'Dispose' : 'Promote',
              timestamp: new Date().toISOString()
            });
          }
        }

        // -- ALERT 9: High Demand Products (exceptional demand velocity)
        if (salesLast7DaysUnits > 0.5 * salesLast30DaysUnits && salesLast30DaysUnits >= 5) {
          const alertId = `highdemand_${product.id}`;
          generatedAlertIds.add(alertId);
          alertsToWrite.push({
            id: alertId,
            type: 'slow',
            title: `High Demand Alert: ${product.name}`,
            description: `${product.name} is experiencing exceptionally high demand with ${salesLast7DaysUnits} units sold in the last 7 days.`,
            severity: 'medium',
            actionLabel: 'Replenish',
            timestamp: new Date().toISOString()
          });
        }
      }

      // ==========================================
      // 7. Generate Purchase Order Alerts & Deliveries
      // ==========================================
      for (const po of purchaseOrders) {
        if (['PENDING', 'APPROVED', 'SHIPPED'].includes(po.status)) {
          const expectedDateStr = po.expectedDeliveryDate;
          const hasExpectedDate = expectedDateStr && expectedDateStr !== '';
          const isOverdue = hasExpectedDate ? new Date(expectedDateStr).getTime() < now.getTime() : false;

          // -- ALERT 7: Pending Purchase Orders (delayed/overdue vs active)
          if (isOverdue) {
            const alertId = `po_delayed_${po.id}`;
            generatedAlertIds.add(alertId);
            alertsToWrite.push({
              id: alertId,
              type: 'reorder',
              title: `Overdue PO: ${po.poNumber}`,
              description: `Purchase order ${po.poNumber} was expected on ${new Date(expectedDateStr).toLocaleDateString()} but is still ${po.status}.`,
              severity: 'high',
              actionLabel: 'Track',
              timestamp: new Date().toISOString()
            });
          } else {
            const alertId = `po_pending_${po.id}`;
            generatedAlertIds.add(alertId);
            alertsToWrite.push({
              id: alertId,
              type: 'reorder',
              title: `Pending PO: ${po.poNumber}`,
              description: `Purchase order ${po.poNumber} is active with status ${po.status} and expected on ${hasExpectedDate ? new Date(expectedDateStr).toLocaleDateString() : 'N/A'}.`,
              severity: 'low',
              actionLabel: 'Monitor',
              timestamp: new Date().toISOString()
            });
          }

          // -- ALERT 8: Pending Deliveries (Expected soon)
          if (hasExpectedDate && !isOverdue) {
            const expectedDate = new Date(expectedDateStr);
            const diffDays = Math.ceil((expectedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) {
              const alertId = `del_pending_${po.id}`;
              generatedAlertIds.add(alertId);
              alertsToWrite.push({
                id: alertId,
                type: 'reorder',
                title: `Expected Delivery: ${po.poNumber}`,
                description: `Goods delivery for ${po.poNumber} from ${po.supplierName || 'Supplier'} is expected in ${diffDays} days (${expectedDate.toLocaleDateString()}).`,
                severity: 'medium',
                actionLabel: 'Receive',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }

      // ==========================================
      // Write new alerts & delete obsolete ones
      // ==========================================

      // 1. Delete alerts that are no longer active/valid
      for (const [id, alert] of existingAlertsMap.entries()) {
        if (!generatedAlertIds.has(id)) {
          batch.delete(doc(db, `companies/${companyId}/inventory_alerts`, id));
        }
      }

      // 2. Write/Update active alerts, preserving user status (Read, Resolved, Dismissed) if already existing
      for (const alert of alertsToWrite) {
        const existing = existingAlertsMap.get(alert.id);
        const status = existing ? (existing.status || 'unread') : 'unread';
        
        batch.set(doc(db, `companies/${companyId}/inventory_alerts`, alert.id), {
          ...alert,
          status
        });
      }

      await batch.commit();
      console.log('Successfully completed intelligent real-time alerts sync based on actual business data.');
    } catch (error) {
      console.error('Failed to run AlertSync:', error);
    }
  }
}
