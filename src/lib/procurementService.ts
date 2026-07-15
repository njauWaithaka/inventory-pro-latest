import { 
  collection, doc, setDoc, updateDoc, increment, 
  getDoc, writeBatch, serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { PurchaseOrder, POStatus, GoodReceiptNote, MROIssue, Product } from '../types';
import { handleFirestoreError, OperationType } from './firestoreUtils';

export class ProcurementService {
  private static getCompanyPath(companyId: string) {
    return `companies/${companyId}`;
  }

  static async createPurchaseOrder(companyId: string, poData: Omit<PurchaseOrder, 'id'>) {
    const path = `${this.getCompanyPath(companyId)}/purchaseOrders`;
    const poRef = doc(collection(db, path));
    const newPO: PurchaseOrder = {
      ...poData,
      id: poRef.id,
      date: new Date().toISOString(),
    };

    try {
      await setDoc(poRef, {
        ...newPO,
        createdAt: serverTimestamp(),
      });
      return newPO;
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
      const batch = writeBatch(db);
      
      // Save GRN
      batch.set(grnRef, {
        ...newGRN,
        createdAt: serverTimestamp(),
      });

      // Update Product Quantities
      for (const item of grnData.items) {
        const productRef = doc(db, `${this.getCompanyPath(companyId)}/products/${item.productId}`);
        const productSnap = await getDoc(productRef);
        const productData = productSnap.exists() ? productSnap.data() as Product : null;
        const beforeQty = productData?.quantity || 0;
        const finalQty = beforeQty + item.receivedQuantity;

        batch.update(productRef, {
          quantity: finalQty,
          currentStock: finalQty,
          unitsReceived: increment(item.receivedQuantity),
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp(),
        });

        // Record Stock Movement
        const movementRef = doc(collection(db, `${this.getCompanyPath(companyId)}/stockMovements`));
        batch.set(movementRef, {
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
      }

      // Update PO Status to RECEIVED if all items received (simplified for now)
      batch.update(doc(db, poPath), { 
        status: 'RECEIVED',
        updatedAt: serverTimestamp()
      });

      await batch.commit();
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
