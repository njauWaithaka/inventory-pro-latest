import { 
  collection, doc, setDoc, updateDoc, increment, 
  getDoc, writeBatch, serverTimestamp 
} from 'firebase/firestore';
import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import { PurchaseOrder, POStatus, GoodReceiptNote, MROIssue, Product } from '../types';
import { handleFirestoreError, OperationType } from './firestoreUtils';

const runTx = (firestore as any).runTransaction;

export class ProcurementService {
  private static getCompanyPath(companyId: string) {
    return `companies/${companyId}`;
  }

  static async createPurchaseOrder(companyId: string, poData: Omit<PurchaseOrder, 'id'>) {
    const path = `${this.getCompanyPath(companyId)}/purchaseOrders`;
    const poRef = doc(collection(db, path));
    
    // Calculate standard 16% VAT structures for compliance
    const totalAmount = poData.totalAmount || 0;
    const subtotal = Number((totalAmount / 1.16).toFixed(2));
    const taxAmount = Number((totalAmount - subtotal).toFixed(2));
    const taxRate = 16; // Standard Kenya VAT Rate
    
    const newPO: any = {
      ...poData,
      id: poRef.id,
      date: new Date().toISOString(),
      subtotal,
      taxAmount,
      taxRate,
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Save the Purchase Order
      await setDoc(poRef, {
        ...newPO,
        createdAt: serverTimestamp(),
      });

      // 1.5 Record PO Creation in general auditLogs
      const auditLogRef = doc(collection(db, `${this.getCompanyPath(companyId)}/auditLogs`));
      await setDoc(auditLogRef, {
        id: auditLogRef.id,
        eventType: 'purchase_order_created',
        action: 'Purchase Order Created',
        details: `Purchase Order ${poRef.id} (${newPO.poNumber}) created for Supplier ${poData.supplierName || poData.supplierId} (Total Amount: ${totalAmount})`,
        userId: poData.createdBy || '',
        userEmail: poData.userEmail || '',
        userName: poData.createdByName || 'User',
        timestamp: new Date().toISOString(),
        createdAt: serverTimestamp()
      }).catch(err => {
        console.warn("Audit log creation skipped:", err);
      });

      // 2. Update Supplier reference information
      const supplierRef = doc(db, `${this.getCompanyPath(companyId)}/suppliers/${poData.supplierId}`);
      await updateDoc(supplierRef, {
        lastPurchaseDate: new Date().toISOString(),
        payable: increment(totalAmount),
        poCount: increment(1),
        updatedAt: new Date().toISOString()
      }).catch(err => {
        // Log but don't crash if supplier doc doesn't exist yet
        console.warn("Supplier document update skipped:", err);
      });

      return newPO as PurchaseOrder;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  }

  static async updatePOStatus(companyId: string, poId: string, status: POStatus) {
    const path = `${this.getCompanyPath(companyId)}/purchaseOrders/${poId}`;
    try {
      await updateDoc(doc(db, path), { status, updatedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  }

  static async createGRN(companyId: string, grnData: Omit<GoodReceiptNote, 'id'>) {
    const path = `${this.getCompanyPath(companyId)}/grns`;
    const poPath = `${this.getCompanyPath(companyId)}/purchaseOrders/${grnData.poId}`;
    const grnRef = doc(collection(db, path));
    
    const newGRN: GoodReceiptNote = {
      ...grnData,
      id: grnRef.id,
      receivedDate: new Date().toISOString(),
    };

    try {
      await runTx(db, async (transaction) => {
        // 1. Fetch current Purchase Order state to calculate partial receipt progression
        const poRef = doc(db, poPath);
        const poSnap = await transaction.get(poRef);
        if (!poSnap.exists()) {
          throw new Error("Source Purchase Order not found");
        }
        const po = poSnap.data() as PurchaseOrder;

        // Prevent duplicate additions or additions to a closed/received PO
        if (po.status === 'RECEIVED' || po.status === 'FULLY RECEIVED' || po.status === 'CLOSED') {
          throw new Error(`This Purchase Order is already marked as ${po.status}. Cannot receive any more items.`);
        }

        // Update the items array on the PO to include accumulated received quantities
        const updatedPOItems = po.items.map(poItem => {
          const grnItem = grnData.items.find(gi => gi.productId === poItem.productId);
          if (grnItem) {
            const prevReceived = poItem.receivedQuantity || 0;
            const newTotalReceived = prevReceived + grnItem.receivedQuantity;
            if (newTotalReceived > poItem.quantity) {
              throw new Error(`Cannot receive more than the ordered quantity for product ${poItem.productName || poItem.productId}. Ordered: ${poItem.quantity}, Already received: ${prevReceived}, Trying to receive: ${grnItem.receivedQuantity}`);
            }
            return {
              ...poItem,
              receivedQuantity: newTotalReceived
            };
          }
          return poItem;
        });

        // Determine PO status progression: PENDING -> PARTIALLY RECEIVED -> RECEIVED
        const isFullyReceived = updatedPOItems.every(item => (item.receivedQuantity || 0) >= item.quantity);
        const someReceived = updatedPOItems.some(item => (item.receivedQuantity || 0) > 0);
        const poStatus: POStatus = isFullyReceived ? 'RECEIVED' : (someReceived ? 'PARTIALLY RECEIVED' : 'PENDING');

        // Fetch all product snapshots that are being received
        const productRefsAndSnaps = await Promise.all(
          grnData.items
            .filter(item => item.receivedQuantity > 0)
            .map(async (item) => {
              const productRef = doc(db, `${this.getCompanyPath(companyId)}/products/${item.productId}`);
              const snap = await transaction.get(productRef);
              return { item, productRef, snap };
            })
        );

        // --- All reads are done! Now perform all writes ---

        // Save GRN
        transaction.set(grnRef, {
          ...newGRN,
          createdAt: serverTimestamp(),
        });

        // Record GRN Receipt in general auditLogs
        const auditLogRef = doc(collection(db, `${this.getCompanyPath(companyId)}/auditLogs`));
        transaction.set(auditLogRef, {
          id: auditLogRef.id,
          eventType: 'goods_received_note_created',
          action: 'Goods Received (GRN)',
          details: `Goods Received Note ${grnRef.id} (${newGRN.grnNumber}) created for PO ${grnData.poId} (Supplier ID: ${grnData.supplierId})`,
          userId: grnData.createdBy || '',
          userEmail: grnData.userEmail || '',
          userName: grnData.receivedBy || 'User',
          timestamp: new Date().toISOString(),
          createdAt: serverTimestamp()
        });

        // Update each Product, write Stock Movement and write Inventory Transaction
        for (const { item, productRef, snap } of productRefsAndSnaps) {
          const productData = snap.exists() ? snap.data() as Product : null;
          const beforeQty = productData?.quantity || 0;
          const finalQty = beforeQty + item.receivedQuantity;

          // Find the unit price from the Purchase Order for cost alignment
          const poItem = po.items.find(pi => pi.productId === item.productId);
          
          const updateData: any = {
            quantity: finalQty,
            currentStock: finalQty,
            unitsReceived: (productData?.unitsReceived || 0) + item.receivedQuantity,
            updatedAt: new Date().toISOString(),
            serverUpdatedAt: serverTimestamp(),
          };

          if (poItem) {
            updateData.buyingPrice = poItem.unitPrice;
            updateData.value = poItem.unitPrice; // Keep value aligned with buyingPrice
          }

          transaction.update(productRef, updateData);

          // Record Stock Movement
          const movementRef = doc(collection(db, `${this.getCompanyPath(companyId)}/stockMovements`));
          transaction.set(movementRef, {
            id: movementRef.id,
            productId: item.productId,
            type: 'purchase',
            quantity: item.receivedQuantity,
            beforeQty: beforeQty,
            afterQty: finalQty,
            createdAt: new Date().toISOString(),
            reference: newGRN.grnNumber,
            poId: grnData.poId,

            // Target schema audit fields
            transactionId: movementRef.id,
            transactionType: "Stock In",
            previousStock: beforeQty,
            newStock: finalQty,
            reason: `GRN Purchase Receipt - PO #${grnData.poId}`,
            timestamp: serverTimestamp(),
          });

          // Create inventory transaction record: inventoryTransactions/{transactionId}
          const inventoryTransactionRef = doc(collection(db, `${this.getCompanyPath(companyId)}/inventoryTransactions`));
          transaction.set(inventoryTransactionRef, {
            id: inventoryTransactionRef.id,
            productId: item.productId,
            quantity: item.receivedQuantity,
            transactionType: 'Purchase Receipt',
            poId: grnData.poId,
            supplierId: po.supplierId || grnData.supplierId || '',
            supplierName: po.supplierName || '',
            userId: grnData.createdBy || '',
            userName: grnData.receivedBy || 'User',
            timestamp: serverTimestamp()
          });
        }

        // Update PO Status & item received quantity tracking
        transaction.update(poRef, { 
          status: poStatus,
          items: updatedPOItems,
          updatedAt: serverTimestamp()
        });
      });

      // Trigger Alert Synchronization to recalculate stock health instantly
      try {
        const { AlertService } = await import('./alertService');
        await AlertService.runAlertSync(companyId);
      } catch (err) {
        console.error("Alert Sync Error during GRN:", err);
      }

      return newGRN;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  }

  static async createMROIssue(companyId: string, issueData: Omit<MROIssue, 'id'>) {
    const path = `${this.getCompanyPath(companyId)}/mro_issues`;
    const issueRef = doc(collection(db, path));
    
    const newIssue: MROIssue = {
      ...issueData,
      id: issueRef.id,
      date: new Date().toISOString(),
    };

    try {
      const batch = writeBatch(db);
      
      // Save Issue
      batch.set(issueRef, {
        ...newIssue,
        createdAt: serverTimestamp(),
      });

      // Decrease Product Quantities
      const productRef = doc(db, `${this.getCompanyPath(companyId)}/products/${issueData.productId}`);
      const productSnap = await getDoc(productRef);
      const productData = productSnap.exists() ? productSnap.data() as Product : null;
      const beforeQty = productData?.quantity || 0;
      const finalQty = beforeQty - issueData.quantity;

      batch.update(productRef, {
        quantity: finalQty,
        currentStock: finalQty,
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: serverTimestamp(),
      });

      // Record Stock Movement
      const movementRef = doc(collection(db, `${this.getCompanyPath(companyId)}/stockMovements`));
      batch.set(movementRef, {
        id: movementRef.id,
        productId: issueData.productId,
        type: 'adjustment',
        quantity: issueData.quantity,
        beforeQty: beforeQty,
        afterQty: finalQty,
        createdAt: new Date().toISOString(),
        reference: newIssue.issueNumber,
        department: issueData.department,

        // Target schema audit fields
        transactionId: movementRef.id,
        transactionType: "Adjustment",
        previousStock: beforeQty,
        newStock: finalQty,
        reason: `MRO Issue to Department: ${issueData.department}`,
        timestamp: serverTimestamp(),
      });

      await batch.commit();
      return newIssue;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  }
}
