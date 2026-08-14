import { getProductUnitCost } from '../components/views/ABCAnalysisSection';

export type MovementClass = 'fast' | 'moderate' | 'slow' | 'obsolete' | 'out_of_stock';

export interface SKUAgingDetails {
  productId: string;
  sku: string;
  productName: string;
  category: string;
  currentStock: number;
  unitCost: number;
  stockValue: number;
  averageDailySales: number;
  inventoryAgeDays: number;
  movementClass: MovementClass;
  movementLabel: 'FAST MOVING' | 'MODERATE MOVING' | 'SLOW MOVING' | 'OBSOLETE' | 'OUT OF STOCK';
  colorBadge: {
    bg: string;
    text: string;
    border: string;
    dot: string;
    icon: string;
  };
  lastSaleDate: string | null;
  oldestRemainingStockDate: string;
  daysSinceLastSale: number | null;
}

export interface AgingBucketSummary {
  bucketName: string;
  ageRange: string;
  movementClass: MovementClass;
  movementLabel: string;
  skuCount: number;
  skuPercentage: number;
  totalUnits: number;
  totalValue: number;
  valuePercentage: number;
  skus: SKUAgingDetails[];
  actionRecommendation: string;
}

export interface InventoryAgingAnalysis {
  totalSKUs: number;
  activeStockedSKUs: number;
  outOfStockSKUs: number;
  totalInventoryValue: number;
  totalInventoryUnits: number;
  dashboardCounts: {
    fast: { count: number; percentage: number; value: number; units: number };
    moderate: { count: number; percentage: number; value: number; units: number };
    slow: { count: number; percentage: number; value: number; units: number };
    obsolete: { count: number; percentage: number; value: number; units: number };
    outOfStock: { count: number; percentage: number; value: number; units: number };
  };
  agingBuckets: AgingBucketSummary[];
  allSKUDetails: SKUAgingDetails[];
}

/**
 * Calculates dynamic FIFO inventory age and movement classification for a single product.
 */
export function calculateSKUAgingDetails(
  product: any,
  movements: any[] = [],
  sales: any[] = [],
  refDate: Date = new Date()
): SKUAgingDetails {
  const nowMs = refDate.getTime();
  const dayMs = 86400000;

  const productId = product.id || product.productId || '';
  const sku = product.sku || product.barcode || 'N/A';
  const productName = product.name || product.productName || 'Unnamed Product';
  const category = product.category || 'General';

  const currentStock = Math.max(0, typeof product.quantity === 'number' ? product.quantity : (product.currentStock || 0));
  const unitCost = getProductUnitCost(product);
  const stockValue = currentStock * unitCost;

  // 1. Calculate Average Daily Sales (ADS) over last 30 days
  let averageDailySales = 0;
  if (typeof product.averageDailySales === 'number' && product.averageDailySales >= 0) {
    averageDailySales = product.averageDailySales;
  } else {
    // Sum sales for this product in last 30 days
    const thirtyDaysAgoMs = nowMs - 30 * dayMs;
    
    // Check sales records first
    const prodSales = sales.filter(s => (s.productId === productId || s.productId === product.id) && s.createdAt);
    let unitsSold30d = 0;
    
    if (prodSales.length > 0) {
      unitsSold30d = prodSales.reduce((sum, s) => {
        const t = new Date(s.createdAt || s.saleDate).getTime();
        return t >= thirtyDaysAgoMs ? sum + (Number(s.quantitySold || s.quantity) || 0) : sum;
      }, 0);
    } else {
      // Check movements
      const prodMovements = movements.filter(m => (m.productId === productId || m.productId === product.id) && m.createdAt);
      unitsSold30d = prodMovements.reduce((sum, m) => {
        const t = new Date(m.createdAt).getTime();
        const isOutbound = m.type === 'sale' || m.type === 'outbound' || (m.type === 'adjustment' && m.quantity < 0);
        return (t >= thirtyDaysAgoMs && isOutbound) ? sum + Math.abs(Number(m.quantity) || 0) : sum;
      }, 0);
    }

    if (unitsSold30d > 0) {
      averageDailySales = parseFloat((unitsSold30d / 30).toFixed(2));
    } else if (typeof product.unitsSold === 'number' && product.unitsSold > 0) {
      // Fallback estimate if total unitsSold is recorded
      averageDailySales = parseFloat((product.unitsSold / 60).toFixed(2));
    }
  }

  // 2. Find Last Sale Date
  let lastSaleDate: string | null = null;
  let daysSinceLastSale: number | null = null;

  if (product.lastSold) {
    const lDate = new Date(product.lastSold);
    if (!isNaN(lDate.getTime())) {
      lastSaleDate = lDate.toISOString().split('T')[0];
      daysSinceLastSale = Math.max(0, Math.floor((nowMs - lDate.getTime()) / dayMs));
    }
  }

  if (!lastSaleDate) {
    // Find latest sale in movements/sales
    const prodSaleMovements = movements
      .filter(m => (m.productId === productId || m.productId === product.id) && (m.type === 'sale' || m.type === 'outbound'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (prodSaleMovements.length > 0 && prodSaleMovements[0].createdAt) {
      const lDate = new Date(prodSaleMovements[0].createdAt);
      lastSaleDate = lDate.toISOString().split('T')[0];
      daysSinceLastSale = Math.max(0, Math.floor((nowMs - lDate.getTime()) / dayMs));
    }
  }

  // 3. FIFO Remaining Stock Layer Aging Logic
  let oldestStockDate: Date;

  if (currentStock === 0) {
    // Out of stock
    oldestStockDate = product.stockAddedDate ? new Date(product.stockAddedDate) : product.createdAt ? new Date(product.createdAt) : new Date(refDate);
  } else {
    // Filter movements for this product
    const prodMovements = movements.filter(m => m.productId === productId || m.productId === product.id);

    // Filter inbound movements (purchases, GRNs, stock additions)
    const inboundMovements = prodMovements
      .filter(m => m.type === 'purchase' || m.type === 'inbound' || m.type === 'grn' || m.type === 'initial' || (m.type === 'adjustment' && Number(m.quantity) > 0))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Filter outbound movements (sales, issues, removals)
    const outboundMovements = prodMovements
      .filter(m => m.type === 'sale' || m.type === 'outbound' || m.type === 'issue' || (m.type === 'adjustment' && Number(m.quantity) < 0))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (inboundMovements.length > 0) {
      // Build FIFO queue
      const batchQueue = inboundMovements.map(m => ({
        date: new Date(m.createdAt),
        qty: Math.abs(Number(m.quantity) || 0),
        rem: Math.abs(Number(m.quantity) || 0)
      }));

      // Deduct outbound movements FIFO
      let totalOutbound = outboundMovements.reduce((sum, m) => sum + Math.abs(Number(m.quantity) || 0), 0);

      for (const batch of batchQueue) {
        if (totalOutbound <= 0) break;
        if (batch.rem <= totalOutbound) {
          totalOutbound -= batch.rem;
          batch.rem = 0;
        } else {
          batch.rem -= totalOutbound;
          totalOutbound = 0;
        }
      }

      // Find earliest batch with remaining stock > 0
      const activeBatch = batchQueue.find(b => b.rem > 0);
      if (activeBatch && !isNaN(activeBatch.date.getTime())) {
        oldestStockDate = activeBatch.date;
      } else {
        // Fallback to stockAddedDate / createdAt
        const baseDateStr = product.stockAddedDate || product.createdAt || product.manufactureDate;
        oldestStockDate = baseDateStr ? new Date(baseDateStr) : new Date(refDate);
      }
    } else {
      // Fallback if no inbound movements recorded
      const baseDateStr = product.stockAddedDate || product.createdAt || product.manufactureDate;
      oldestStockDate = baseDateStr ? new Date(baseDateStr) : new Date(refDate);
    }
  }

  if (isNaN(oldestStockDate.getTime())) {
    oldestStockDate = new Date(refDate);
  }

  const inventoryAgeDays = Math.max(0, Math.floor((nowMs - oldestStockDate.getTime()) / dayMs));
  const oldestRemainingStockDateStr = oldestStockDate.toISOString().split('T')[0];

  // 4. Movement Classification Rules
  let movementClass: MovementClass;
  let movementLabel: 'FAST MOVING' | 'MODERATE MOVING' | 'SLOW MOVING' | 'OBSOLETE' | 'OUT OF STOCK';

  if (currentStock === 0) {
    movementClass = 'out_of_stock';
    movementLabel = 'OUT OF STOCK';
  } else if (inventoryAgeDays <= 30) {
    movementClass = 'fast';
    movementLabel = 'FAST MOVING';
  } else if (inventoryAgeDays <= 90) {
    movementClass = 'moderate';
    movementLabel = 'MODERATE MOVING';
  } else if (inventoryAgeDays <= 180) {
    movementClass = 'slow';
    movementLabel = 'SLOW MOVING';
  } else {
    movementClass = 'obsolete';
    movementLabel = 'OBSOLETE';
  }

  // 5. Visual Styling Configuration
  let colorBadge = {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    icon: '🟢'
  };

  if (movementClass === 'moderate') {
    colorBadge = {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      dot: 'bg-blue-500',
      icon: '🟡'
    };
  } else if (movementClass === 'slow') {
    colorBadge = {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
      icon: '🟠'
    };
  } else if (movementClass === 'obsolete') {
    colorBadge = {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      dot: 'bg-rose-500',
      icon: '🔴'
    };
  } else if (movementClass === 'out_of_stock') {
    colorBadge = {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-300',
      dot: 'bg-slate-400',
      icon: '⚪'
    };
  }

  return {
    productId,
    sku,
    productName,
    category,
    currentStock,
    unitCost,
    stockValue,
    averageDailySales,
    inventoryAgeDays,
    movementClass,
    movementLabel,
    colorBadge,
    lastSaleDate,
    oldestRemainingStockDate: oldestRemainingStockDateStr,
    daysSinceLastSale
  };
}

/**
 * Computes full Inventory Aging Analysis across all products.
 */
export function calculateInventoryAgingAnalysis(
  products: any[] = [],
  movements: any[] = [],
  sales: any[] = [],
  refDate: Date = new Date()
): InventoryAgingAnalysis {
  const allSKUDetails = products.map(p => calculateSKUAgingDetails(p, movements, sales, refDate));

  const totalSKUs = allSKUDetails.length;
  const activeStockedSKUs = allSKUDetails.filter(s => s.currentStock > 0).length;
  const outOfStockSKUs = allSKUDetails.filter(s => s.currentStock === 0).length;

  const totalInventoryValue = allSKUDetails.reduce((sum, s) => sum + s.stockValue, 0);
  const totalInventoryUnits = allSKUDetails.reduce((sum, s) => sum + s.currentStock, 0);

  // Group SKUs by classification
  const fastSKUs = allSKUDetails.filter(s => s.movementClass === 'fast');
  const moderateSKUs = allSKUDetails.filter(s => s.movementClass === 'moderate');
  const slowSKUs = allSKUDetails.filter(s => s.movementClass === 'slow');
  const obsoleteSKUs = allSKUDetails.filter(s => s.movementClass === 'obsolete');
  const oosSKUs = allSKUDetails.filter(s => s.movementClass === 'out_of_stock');

  const getStats = (skus: SKUAgingDetails[]) => {
    const count = skus.length;
    const units = skus.reduce((sum, s) => sum + s.currentStock, 0);
    const value = skus.reduce((sum, s) => sum + s.stockValue, 0);
    const percentage = totalSKUs > 0 ? parseFloat(((count / totalSKUs) * 100).toFixed(1)) : 0;
    const valuePct = totalInventoryValue > 0 ? parseFloat(((value / totalInventoryValue) * 100).toFixed(1)) : 0;

    return { count, units, value, percentage, valuePct };
  };

  const fastStats = getStats(fastSKUs);
  const moderateStats = getStats(moderateSKUs);
  const slowStats = getStats(slowSKUs);
  const obsoleteStats = getStats(obsoleteSKUs);
  const oosStats = getStats(oosSKUs);

  const agingBuckets: AgingBucketSummary[] = [
    {
      bucketName: '0–30 days',
      ageRange: '0–30 days',
      movementClass: 'fast',
      movementLabel: 'Fast Moving',
      skuCount: fastStats.count,
      skuPercentage: fastStats.percentage,
      totalUnits: fastStats.units,
      totalValue: fastStats.value,
      valuePercentage: fastStats.valuePct,
      skus: fastSKUs,
      actionRecommendation: 'Maintain buffer stock; high demand turn velocity.'
    },
    {
      bucketName: '31–90 days',
      ageRange: '31–90 days',
      movementClass: 'moderate',
      movementLabel: 'Moderate Moving',
      skuCount: moderateStats.count,
      skuPercentage: moderateStats.percentage,
      totalUnits: moderateStats.units,
      totalValue: moderateStats.value,
      valuePercentage: moderateStats.valuePct,
      skus: moderateSKUs,
      actionRecommendation: 'Monitor sales velocity and reorder points.'
    },
    {
      bucketName: '91–180 days',
      ageRange: '91–180 days',
      movementClass: 'slow',
      movementLabel: 'Slow Moving',
      skuCount: slowStats.count,
      skuPercentage: slowStats.percentage,
      totalUnits: slowStats.units,
      totalValue: slowStats.value,
      valuePercentage: slowStats.valuePct,
      skus: slowSKUs,
      actionRecommendation: 'Bundle with fast movers or run targeted promotions.'
    },
    {
      bucketName: '180+ days',
      ageRange: '180+ days',
      movementClass: 'obsolete',
      movementLabel: 'Obsolete',
      skuCount: obsoleteStats.count,
      skuPercentage: obsoleteStats.percentage,
      totalUnits: obsoleteStats.units,
      totalValue: obsoleteStats.value,
      valuePercentage: obsoleteStats.valuePct,
      skus: obsoleteSKUs,
      actionRecommendation: 'Liquidate, clear, or discount to liberate tied capital.'
    }
  ];

  return {
    totalSKUs,
    activeStockedSKUs,
    outOfStockSKUs,
    totalInventoryValue,
    totalInventoryUnits,
    dashboardCounts: {
      fast: { count: fastStats.count, percentage: fastStats.percentage, value: fastStats.value, units: fastStats.units },
      moderate: { count: moderateStats.count, percentage: moderateStats.percentage, value: moderateStats.value, units: moderateStats.units },
      slow: { count: slowStats.count, percentage: slowStats.percentage, value: slowStats.value, units: slowStats.units },
      obsolete: { count: obsoleteStats.count, percentage: obsoleteStats.percentage, value: obsoleteStats.value, units: obsoleteStats.units },
      outOfStock: { count: oosStats.count, percentage: oosStats.percentage, value: oosStats.value, units: oosStats.units }
    },
    agingBuckets,
    allSKUDetails
  };
}
