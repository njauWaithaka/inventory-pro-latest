import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { StockReservation, Product } from '../types';
import { handleFirestoreError, OperationType } from './firestoreUtils';

export class ReservationService {
  /**
   * Generates a clean human-readable reservation reference number
   */
  static generateReservationNumber(): string {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const datePrefix = new Date().toISOString().slice(2, 7).replace('-', '');
    return `RES-${datePrefix}-${randomSuffix}`;
  }

  /**
   * Creates a new stock reservation and locks the corresponding reservedStock on the product
   */
  static async createReservation(
    companyId: string,
    data: {
      productId: string;
      productName: string;
      sku: string;
      quantity: number;
      reservedFor: string;
      customerId?: string;
      contactInfo?: string;
      reason?: string;
      expiryDate?: string;
      unitPrice?: number;
      notes?: string;
      location?: string;
      createdBy: string;
      createdByName?: string;
      userEmail?: string;
    }
  ): Promise<StockReservation> {
    const reservationNumber = this.generateReservationNumber();
    const reservationRef = doc(collection(db, `companies/${companyId}/reservations`));
    const productRef = doc(db, `companies/${companyId}/products/${data.productId}`);
    const movementRef = doc(collection(db, `companies/${companyId}/stockMovements`));

    const totalValue = (data.unitPrice || 0) * data.quantity;
    const nowIso = new Date().toISOString();

    const reservationPayload: StockReservation = {
      id: reservationRef.id,
      reservationNumber,
      productId: data.productId,
      productName: data.productName,
      sku: data.sku || 'N/A',
      quantity: Number(data.quantity),
      reservedFor: data.reservedFor.trim(),
      customerId: data.customerId || '',
      contactInfo: data.contactInfo?.trim() || '',
      reason: data.reason || 'Customer Hold',
      status: 'ACTIVE',
      reservedDate: nowIso,
      expiryDate: data.expiryDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      unitPrice: Number(data.unitPrice || 0),
      totalValue,
      notes: data.notes?.trim() || '',
      location: data.location || 'Main Warehouse',
      createdBy: data.createdBy,
      createdByName: data.createdByName || 'Staff Member',
      userEmail: data.userEmail || '',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    try {
      const prodSnap = await getDoc(productRef);
      if (!prodSnap.exists()) {
        throw new Error('Product not found in inventory.');
      }

      const prodData = prodSnap.data() as Product;
      const currentQty = Number(prodData.quantity ?? prodData.currentStock ?? 0);
      const currentReserved = Number(prodData.reservedStock ?? 0);
      const availableStock = currentQty - currentReserved;

      if (data.quantity > availableStock) {
        throw new Error(`Insufficient available stock. Available: ${availableStock}, Requested: ${data.quantity}`);
      }

      const batch = writeBatch(db);

      // 1. Update product reserved stock
      batch.update(productRef, {
        reservedStock: currentReserved + data.quantity,
        updatedAt: serverTimestamp()
      });

      // 2. Write reservation record
      batch.set(reservationRef, {
        ...reservationPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 3. Log stock movement
      batch.set(movementRef, {
        productId: data.productId,
        productName: data.productName,
        sku: data.sku || '',
        type: 'reserve',
        quantity: data.quantity,
        previousStock: currentQty,
        newStock: currentQty,
        previousReserved: currentReserved,
        newReserved: currentReserved + data.quantity,
        reason: `Stock Reservation created for ${data.reservedFor} (#${reservationNumber})`,
        referenceId: reservationRef.id,
        createdAt: nowIso,
        createdBy: data.createdBy,
        userName: data.createdByName || 'Staff'
      });

      await batch.commit();
      return reservationPayload;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `companies/${companyId}/reservations`);
      throw error;
    }
  }

  /**
   * Releases an active reservation, unlocking the reserved stock
   */
  static async releaseReservation(
    companyId: string,
    reservation: StockReservation,
    userId: string,
    userName: string,
    reasonText?: string
  ): Promise<void> {
    if (reservation.status !== 'ACTIVE') {
      throw new Error(`Cannot release reservation in ${reservation.status} status.`);
    }

    const reservationRef = doc(db, `companies/${companyId}/reservations/${reservation.id}`);
    const productRef = doc(db, `companies/${companyId}/products/${reservation.productId}`);
    const movementRef = doc(collection(db, `companies/${companyId}/stockMovements`));
    const nowIso = new Date().toISOString();

    try {
      const prodSnap = await getDoc(productRef);
      let currentReserved = 0;
      let currentQty = 0;

      const batch = writeBatch(db);

      if (prodSnap.exists()) {
        const prodData = prodSnap.data() as Product;
        currentQty = Number(prodData.quantity ?? prodData.currentStock ?? 0);
        currentReserved = Number(prodData.reservedStock ?? 0);
        const newReserved = Math.max(0, currentReserved - reservation.quantity);

        batch.update(productRef, {
          reservedStock: newReserved,
          updatedAt: serverTimestamp()
        });
      }

      batch.update(reservationRef, {
        status: 'RELEASED',
        releasedAt: nowIso,
        updatedAt: serverTimestamp(),
        releaseReason: reasonText || 'Manual release'
      });

      batch.set(movementRef, {
        productId: reservation.productId,
        productName: reservation.productName,
        sku: reservation.sku,
        type: 'release_reserve',
        quantity: reservation.quantity,
        previousStock: currentQty,
        newStock: currentQty,
        previousReserved: currentReserved,
        newReserved: Math.max(0, currentReserved - reservation.quantity),
        reason: `Reservation released for ${reservation.reservedFor} (#${reservation.reservationNumber}) - ${reasonText || 'Hold Cancelled'}`,
        referenceId: reservation.id,
        createdAt: nowIso,
        createdBy: userId,
        userName: userName
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `companies/${companyId}/reservations/${reservation.id}`);
      throw error;
    }
  }

  /**
   * Fulfills an active reservation (deducts physical inventory & releases hold)
   */
  static async fulfillReservation(
    companyId: string,
    reservation: StockReservation,
    userId: string,
    userName: string
  ): Promise<void> {
    if (reservation.status !== 'ACTIVE') {
      throw new Error(`Cannot fulfill reservation in ${reservation.status} status.`);
    }

    const reservationRef = doc(db, `companies/${companyId}/reservations/${reservation.id}`);
    const productRef = doc(db, `companies/${companyId}/products/${reservation.productId}`);
    const movementRef = doc(collection(db, `companies/${companyId}/stockMovements`));
    const nowIso = new Date().toISOString();

    try {
      const prodSnap = await getDoc(productRef);
      if (!prodSnap.exists()) {
        throw new Error('Product not found in inventory.');
      }

      const prodData = prodSnap.data() as Product;
      const currentQty = Number(prodData.quantity ?? prodData.currentStock ?? 0);
      const currentReserved = Number(prodData.reservedStock ?? 0);

      const newQty = Math.max(0, currentQty - reservation.quantity);
      const newReserved = Math.max(0, currentReserved - reservation.quantity);

      const batch = writeBatch(db);

      batch.update(productRef, {
        quantity: newQty,
        currentStock: newQty,
        reservedStock: newReserved,
        updatedAt: serverTimestamp()
      });

      batch.update(reservationRef, {
        status: 'FULFILLED',
        fulfilledAt: nowIso,
        updatedAt: serverTimestamp()
      });

      batch.set(movementRef, {
        productId: reservation.productId,
        productName: reservation.productName,
        sku: reservation.sku,
        type: 'out',
        quantity: reservation.quantity,
        previousStock: currentQty,
        newStock: newQty,
        previousReserved: currentReserved,
        newReserved: newReserved,
        reason: `Reservation fulfilled/dispatched to ${reservation.reservedFor} (#${reservation.reservationNumber})`,
        referenceId: reservation.id,
        createdAt: nowIso,
        createdBy: userId,
        userName: userName
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `companies/${companyId}/reservations/${reservation.id}`);
      throw error;
    }
  }

  /**
   * Extends the expiry date of an active reservation
   */
  static async extendReservationExpiry(
    companyId: string,
    reservationId: string,
    newExpiryIso: string
  ): Promise<void> {
    const reservationRef = doc(db, `companies/${companyId}/reservations/${reservationId}`);
    try {
      await updateDoc(reservationRef, {
        expiryDate: newExpiryIso,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `companies/${companyId}/reservations/${reservationId}`);
      throw error;
    }
  }
}
