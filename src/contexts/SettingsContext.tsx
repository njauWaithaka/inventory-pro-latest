import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

// Realistic exchange rates relative to USD ($) as base
const EXCHANGE_RATES: Record<string, number> = {
  '$': 1.0,      // USD is base
  'KSh': 130.0,  // 1 USD = 130 KSh
  '€': 0.92,     // 1 USD = 0.92 EUR
  '£': 0.78,     // 1 USD = 0.78 GBP
};

export function convertCurrency(amount: number | undefined | null, from: string, to: string): number {
  if (amount === undefined || amount === null || isNaN(amount)) return 0;
  if (!from || !to || from === to) return amount;
  const rateFrom = EXCHANGE_RATES[from] || 1.0;
  const rateTo = EXCHANGE_RATES[to] || 1.0;
  const amountInUSD = amount / rateFrom;
  return Number((amountInUSD * rateTo).toFixed(2));
}

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
  hasConfigured: boolean;
}

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  plan: string;
  currency: string;
  timezone: string;
  createdAt: string;
  kraPin?: string;
  address?: string;
  phone?: string;
}

interface SettingsContextType {
  profile: UserProfile | null;
  company: Company | null;
  loading: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateCompany: (updates: Partial<Company>) => Promise<void>;
  createCompany: (name: string) => Promise<string>;
  settings: UserProfile | null; // For backward compatibility
  currency: string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setCompany(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userRef = doc(db, 'users', user.uid);
    
    const unsubscribeUser = onSnapshot(userRef, async (userSnap) => {
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        setProfile(userData);

        if (userData.companyId) {
          const companyRef = doc(db, 'companies', userData.companyId);
          const companySnap = await getDoc(companyRef);
          if (companySnap.exists()) {
            setCompany({ id: companySnap.id, ...companySnap.data() } as Company);
          }
        } else {
          setCompany(null);
        }
      } else {
        // Initial profile creation
        const initialProfile: UserProfile = {
          userId: user.uid,
          name: user.displayName || '',
          email: user.email || '',
          role: 'Owner',
          companyId: null,
          hasConfigured: false
        };
        await setDoc(userRef, initialProfile);
        setProfile(initialProfile);
        setCompany(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching user profile:", error);
      setLoading(false);
    });

    return () => unsubscribeUser();
  }, [user]);

  const isKenya = typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone?.toLowerCase().includes('nairobi');
  const defaultCurrency = isKenya ? 'KSh' : '$';

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { ...profile, ...updates, userId: user.uid }, { merge: true });
  };

  const updateCompany = async (updates: Partial<Company>) => {
    if (!profile?.companyId) return;
    const companyId = profile.companyId;
    const companyRef = doc(db, 'companies', companyId);
    
    const oldCurrency = company?.currency || defaultCurrency;
    const newCurrency = updates.currency;

    // 1. Save company data first
    await setDoc(companyRef, { ...company, ...updates }, { merge: true });

    // 2. If currency has changed, convert all stored financial data across subcollections
    if (newCurrency && oldCurrency !== newCurrency) {
      console.log(`Currency changed from ${oldCurrency} to ${newCurrency}. Converting financial data...`);
      
      try {
        // A. Convert products (value)
        const productsSnap = await getDocs(collection(db, `companies/${companyId}/products`));
        if (!productsSnap.empty) {
          const productsBatch = writeBatch(db);
          productsSnap.docs.forEach((productDoc) => {
            const data = productDoc.data();
            if (typeof data.value === 'number') {
              const convertedValue = convertCurrency(data.value, oldCurrency, newCurrency);
              productsBatch.update(productDoc.ref, { value: convertedValue });
            }
          });
          await productsBatch.commit();
        }

        // B. Convert invoices (amount, subtotal, tax, and item prices)
        const invoicesSnap = await getDocs(collection(db, `companies/${companyId}/invoices`));
        if (!invoicesSnap.empty) {
          const invoicesBatch = writeBatch(db);
          invoicesSnap.docs.forEach((invoiceDoc) => {
            const data = invoiceDoc.data();
            const updated: any = {};
            if (typeof data.amount === 'number') {
              updated.amount = convertCurrency(data.amount, oldCurrency, newCurrency);
            }
            if (typeof data.subtotal === 'number') {
              updated.subtotal = convertCurrency(data.subtotal, oldCurrency, newCurrency);
            }
            if (typeof data.tax === 'number') {
              updated.tax = convertCurrency(data.tax, oldCurrency, newCurrency);
            }
            if (Array.isArray(data.items)) {
              updated.items = data.items.map((item: any) => {
                if (typeof item.price === 'number') {
                  return { ...item, price: convertCurrency(item.price, oldCurrency, newCurrency) };
                }
                return item;
              });
            }
            if (Object.keys(updated).length > 0) {
              invoicesBatch.update(invoiceDoc.ref, updated);
            }
          });
          await invoicesBatch.commit();
        }

        // C. Convert quotations (amount, subtotal, tax, and item prices)
        const quotationsSnap = await getDocs(collection(db, `companies/${companyId}/quotations`));
        if (!quotationsSnap.empty) {
          const quotationsBatch = writeBatch(db);
          quotationsSnap.docs.forEach((quotationDoc) => {
            const data = quotationDoc.data();
            const updated: any = {};
            if (typeof data.amount === 'number') {
              updated.amount = convertCurrency(data.amount, oldCurrency, newCurrency);
            }
            if (typeof data.subtotal === 'number') {
              updated.subtotal = convertCurrency(data.subtotal, oldCurrency, newCurrency);
            }
            if (typeof data.tax === 'number') {
              updated.tax = convertCurrency(data.tax, oldCurrency, newCurrency);
            }
            if (Array.isArray(data.items)) {
              updated.items = data.items.map((item: any) => {
                if (typeof item.price === 'number') {
                  return { ...item, price: convertCurrency(item.price, oldCurrency, newCurrency) };
                }
                return item;
              });
            }
            if (Object.keys(updated).length > 0) {
              quotationsBatch.update(quotationDoc.ref, updated);
            }
          });
          await quotationsBatch.commit();
        }

        // D. Convert receipts (total, subtotal, tax, and item prices)
        const receiptsSnap = await getDocs(collection(db, `companies/${companyId}/receipts`));
        if (!receiptsSnap.empty) {
          const receiptsBatch = writeBatch(db);
          receiptsSnap.docs.forEach((receiptDoc) => {
            const data = receiptDoc.data();
            const updated: any = {};
            if (typeof data.total === 'number') {
              updated.total = convertCurrency(data.total, oldCurrency, newCurrency);
            }
            if (typeof data.subtotal === 'number') {
              updated.subtotal = convertCurrency(data.subtotal, oldCurrency, newCurrency);
            }
            if (typeof data.tax === 'number') {
              updated.tax = convertCurrency(data.tax, oldCurrency, newCurrency);
            }
            if (Array.isArray(data.items)) {
              updated.items = data.items.map((item: any) => {
                if (typeof item.price === 'number') {
                  return { ...item, price: convertCurrency(item.price, oldCurrency, newCurrency) };
                }
                return item;
              });
            }
            if (Object.keys(updated).length > 0) {
              receiptsBatch.update(receiptDoc.ref, updated);
            }
          });
          await receiptsBatch.commit();
        }

        // E. Convert purchase orders (totalAmount, and item unitPrices)
        const purchaseOrdersSnap = await getDocs(collection(db, `companies/${companyId}/purchaseOrders`));
        if (!purchaseOrdersSnap.empty) {
          const poBatch = writeBatch(db);
          purchaseOrdersSnap.docs.forEach((poDoc) => {
            const data = poDoc.data();
            const updated: any = {};
            if (typeof data.totalAmount === 'number') {
              updated.totalAmount = convertCurrency(data.totalAmount, oldCurrency, newCurrency);
            }
            if (Array.isArray(data.items)) {
              updated.items = data.items.map((item: any) => {
                if (typeof item.unitPrice === 'number') {
                  return { ...item, unitPrice: convertCurrency(item.unitPrice, oldCurrency, newCurrency) };
                }
                return item;
              });
            }
            if (Object.keys(updated).length > 0) {
              poBatch.update(poDoc.ref, updated);
            }
          });
          await poBatch.commit();
        }

      } catch (error) {
        console.error("Error converting historical financial data:", error);
      }
    }
  };

  const createCompany = async (name: string) => {
    if (!user) throw new Error("User not authenticated");
    
    const companyId = `comp_${Date.now()}`;
    const newCompany: Omit<Company, 'id'> = {
      name,
      ownerId: user.uid,
      plan: 'free',
      currency: defaultCurrency,
      timezone: 'Nairobi',
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'companies', companyId), newCompany);
    
    // Create membership
    await setDoc(doc(db, 'companies', companyId, 'members', user.uid), {
      role: 'owner',
      joinedAt: new Date().toISOString()
    });

    // Update user profile
    await updateProfile({ companyId, hasConfigured: true });
    
    return companyId;
  };

  // For backward compatibility while migration is happening
  const settings = profile ? {
    ...profile,
    firstName: profile.name.split(' ')[0] || '',
    lastName: profile.name.split(' ').slice(1).join(' ') || '',
    phone: '',
    currency: company?.currency || defaultCurrency,
    timezone: company?.timezone || 'Nairobi'
  } as any : null;

  const currency = company?.currency || defaultCurrency;

  return (
    <SettingsContext.Provider value={{ 
      profile, 
      company, 
      loading, 
      updateProfile, 
      updateCompany, 
      createCompany, 
      settings,
      currency 
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
