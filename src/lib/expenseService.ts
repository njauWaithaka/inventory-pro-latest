import { db } from './firebase';
import { 
  collection, doc, setDoc, getDoc, getDocs, 
  updateDoc, deleteDoc, writeBatch, serverTimestamp 
} from 'firebase/firestore';
import { 
  Expense, ExpenseCategory, ExpenseBudget, 
  RecurringExpense, PettyCashTransaction, PettyCashFloat,
  ExpenseStatus, ExpensePaymentMethod, ExpenseDepartment
} from '../types';

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  {
    id: 'cat_rent',
    name: 'Facility & Warehouse Rent',
    code: '6100',
    description: 'Warehouse lease, store rent, and facility service charges',
    color: '#3B82F6', // Blue
    isTaxDeductible: true,
    monthlyBudgetLimit: 45000,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cat_utilities',
    name: 'Utilities, Power & Water',
    code: '6200',
    description: 'Electricity (KPLC), water bills, and backup generator fuel',
    color: '#06B6D4', // Cyan
    isTaxDeductible: true,
    monthlyBudgetLimit: 12000,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cat_internet',
    name: 'Internet, SaaS & Telephony',
    code: '6300',
    description: 'Fiber internet, business phone lines, and cloud software subscriptions',
    color: '#8B5CF6', // Purple
    isTaxDeductible: true,
    monthlyBudgetLimit: 8500,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cat_salaries',
    name: 'Staff Wages & Casual Labour',
    code: '6400',
    description: 'Warehouse staff, store cashiers, casual loaders, and security',
    color: '#10B981', // Emerald
    isTaxDeductible: true,
    monthlyBudgetLimit: 80000,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cat_freight',
    name: 'Freight, Delivery & Courier',
    code: '6500',
    description: 'Inbound shipping, customer dispatch rider fees, and vehicle fuel',
    color: '#F59E0B', // Amber
    isTaxDeductible: true,
    monthlyBudgetLimit: 18000,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cat_marketing',
    name: 'Marketing & Digital Ads',
    code: '6600',
    description: 'Meta/Google ads, point-of-sale flyers, branding, and promotional banners',
    color: '#EC4899', // Pink
    isTaxDeductible: true,
    monthlyBudgetLimit: 15000,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cat_packaging',
    name: 'Packaging & Consumables',
    code: '6700',
    description: 'Branded carry bags, bubble wrap, thermal receipt paper rolls, and tape',
    color: '#6366F1', // Indigo
    isTaxDeductible: true,
    monthlyBudgetLimit: 6000,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cat_maintenance',
    name: 'Repairs & Shop Maintenance',
    code: '6800',
    description: 'HVAC repair, lighting replacement, shelving fixtures, and POS hardware upkeep',
    color: '#64748B', // Slate
    isTaxDeductible: true,
    monthlyBudgetLimit: 7500,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cat_office',
    name: 'Office Supplies & Refreshments',
    code: '6900',
    description: 'Stationery, printer toner, tea/coffee for staff, and cleaning supplies',
    color: '#14B8A6', // Teal
    isTaxDeductible: true,
    monthlyBudgetLimit: 5000,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cat_statutory',
    name: 'Licenses, Permits & Legal',
    code: '7000',
    description: 'Single business permits, municipal signage fees, audit, and tax compliance',
    color: '#E11D48', // Rose
    isTaxDeductible: true,
    monthlyBudgetLimit: 10000,
    createdAt: new Date().toISOString()
  }
];

export async function ensureExpenseDefaults(companyId: string): Promise<void> {
  if (!companyId) return;

  try {
    const catSnapshot = await getDocs(collection(db, `companies/${companyId}/expense_categories`));
    if (catSnapshot.empty) {
      const batch = writeBatch(db);
      for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
        const docRef = doc(db, `companies/${companyId}/expense_categories`, cat.id);
        batch.set(docRef, cat);
      }

      // Initial Default Budgets
      for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
        if (cat.monthlyBudgetLimit) {
          const bRef = doc(db, `companies/${companyId}/expense_budgets`, `budget_${cat.id}`);
          const budget: ExpenseBudget = {
            id: `budget_${cat.id}`,
            categoryId: cat.id,
            categoryName: cat.name,
            period: 'Monthly',
            allocatedAmount: cat.monthlyBudgetLimit,
            alertThresholdPct: 80,
            notes: `Standard monthly allocation for ${cat.name}`,
            createdAt: new Date().toISOString()
          };
          batch.set(bRef, budget);
        }
      }



      // Initial Petty Cash Meta & Ledger
      const floatMetaRef = doc(db, `companies/${companyId}/petty_cash_meta`, 'current_float');
      const floatMeta: PettyCashFloat = {
        currentBalance: 0,
        targetFloat: 10000,
        minimumThreshold: 2000,
        lastReplenished: new Date().toISOString()
      };
      batch.set(floatMetaRef, floatMeta, { merge: true });

      await batch.commit();
      console.log('Successfully initialized expense defaults for company:', companyId);
    }
  } catch (error) {
    console.error('Error ensuring expense defaults:', error);
  }
}

// -------------------------------------------------------------
// EXPENSE CRUD OPERATIONS
// -------------------------------------------------------------

export async function addExpense(companyId: string, expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  
  const expense: Expense = {
    ...expenseData,
    id: expenseId,
    createdAt: now,
    updatedAt: now
  };

  const docRef = doc(db, `companies/${companyId}/expenses`, expenseId);
  await setDoc(docRef, expense);

  // If paid via Petty Cash, disburse from petty cash automatically
  if (expense.paymentMethod === 'Petty Cash' && expense.status === 'PAID') {
    try {
      await disbursePettyCash(companyId, {
        amount: expense.amount,
        purpose: expense.title,
        recipient: expense.vendorName || 'Vendor',
        categoryId: expense.categoryId,
        categoryName: expense.categoryName,
        receiptNumber: expense.reference,
        authorizedBy: expense.createdByName || 'Admin',
        date: expense.date,
        notes: `Auto-linked from Expense ${expense.expenseNumber}`
      });
    } catch (e) {
      console.warn('Could not auto-deduct from petty cash:', e);
    }
  }

  return expenseId;
}

export async function updateExpense(companyId: string, expenseId: string, updates: Partial<Expense>): Promise<void> {
  const docRef = doc(db, `companies/${companyId}/expenses`, expenseId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteExpense(companyId: string, expenseId: string): Promise<void> {
  const docRef = doc(db, `companies/${companyId}/expenses`, expenseId);
  await deleteDoc(docRef);
}

export async function approveExpense(companyId: string, expenseId: string, approverName: string, markPaid: boolean = false): Promise<void> {
  const docRef = doc(db, `companies/${companyId}/expenses`, expenseId);
  const now = new Date().toISOString();
  const updates: Partial<Expense> = {
    status: markPaid ? 'PAID' : 'APPROVED',
    approvedBy: approverName,
    approvedAt: now,
    updatedAt: now
  };
  if (markPaid) {
    updates.paidAt = now;
  }
  await updateDoc(docRef, updates);
}

export async function rejectExpense(companyId: string, expenseId: string, reason: string): Promise<void> {
  const docRef = doc(db, `companies/${companyId}/expenses`, expenseId);
  await updateDoc(docRef, {
    status: 'REJECTED',
    notes: reason ? `[Rejected Reason: ${reason}]` : 'Rejected by reviewer',
    updatedAt: new Date().toISOString()
  });
}

export async function markExpenseAsPaid(companyId: string, expenseId: string, paymentMethod?: ExpensePaymentMethod, ref?: string): Promise<void> {
  const docRef = doc(db, `companies/${companyId}/expenses`, expenseId);
  const now = new Date().toISOString();
  const updates: any = {
    status: 'PAID',
    paidAt: now,
    updatedAt: now
  };
  if (paymentMethod) updates.paymentMethod = paymentMethod;
  if (ref) updates.reference = ref;

  await updateDoc(docRef, updates);
}

// -------------------------------------------------------------
// PETTY CASH OPERATIONS
// -------------------------------------------------------------

export async function getPettyCashFloat(companyId: string): Promise<PettyCashFloat> {
  const floatRef = doc(db, `companies/${companyId}/petty_cash_meta`, 'current_float');
  const snap = await getDoc(floatRef);
  if (snap.exists()) {
    return snap.data() as PettyCashFloat;
  }
  return {
    currentBalance: 10000,
    targetFloat: 10000,
    minimumThreshold: 3000,
    lastReplenished: new Date().toISOString()
  };
}

export async function topUpPettyCash(
  companyId: string, 
  amount: number, 
  authorizedBy: string, 
  notes?: string,
  options?: {
    source?: string;
    voucherNumber?: string;
    targetFloat?: number;
    minimumThreshold?: number;
  }
): Promise<void> {
  const current = await getPettyCashFloat(companyId);
  const newBalance = (current.currentBalance || 0) + amount;
  const now = new Date().toISOString();

  // Save Meta
  const floatRef = doc(db, `companies/${companyId}/petty_cash_meta`, 'current_float');
  await setDoc(floatRef, {
    ...current,
    currentBalance: newBalance,
    targetFloat: options?.targetFloat !== undefined ? options.targetFloat : (current.targetFloat || 10000),
    minimumThreshold: options?.minimumThreshold !== undefined ? options.minimumThreshold : (current.minimumThreshold || 3000),
    lastReplenished: now
  }, { merge: true });

  // Record Transaction
  const pcvId = `pcv_${Date.now()}`;
  const purposeText = options?.source 
    ? `Petty Cash Load from ${options.source}` 
    : 'Petty Cash Float Top-up / Replenishment';

  const pcv: PettyCashTransaction = {
    id: pcvId,
    voucherNumber: options?.voucherNumber || `PCV-TOP-${Date.now().toString().slice(-4)}`,
    type: 'TOP_UP',
    amount,
    balanceAfter: newBalance,
    purpose: purposeText,
    authorizedBy: authorizedBy || 'Operations / Finance',
    date: now.split('T')[0],
    notes: notes || (options?.source ? `Loaded from ${options.source}` : 'Cash float deposit'),
    createdAt: now
  };

  const pcvRef = doc(db, `companies/${companyId}/petty_cash_transactions`, pcvId);
  await setDoc(pcvRef, pcv);
}

export async function disbursePettyCash(
  companyId: string,
  data: {
    amount: number;
    purpose: string;
    recipient?: string;
    categoryId?: string;
    categoryName?: string;
    receiptNumber?: string;
    authorizedBy: string;
    date: string;
    notes?: string;
  }
): Promise<string> {
  const current = await getPettyCashFloat(companyId);
  const newBalance = Math.max(0, (current.currentBalance || 0) - data.amount);
  const now = new Date().toISOString();

  // Update Meta
  const floatRef = doc(db, `companies/${companyId}/petty_cash_meta`, 'current_float');
  await setDoc(floatRef, {
    ...current,
    currentBalance: newBalance
  }, { merge: true });

  // Record Transaction
  const pcvId = `pcv_${Date.now()}`;
  const pcv: PettyCashTransaction = {
    id: pcvId,
    voucherNumber: `PCV-${Date.now().toString().slice(-4)}`,
    type: 'DISBURSEMENT',
    amount: data.amount,
    balanceAfter: newBalance,
    purpose: data.purpose,
    recipient: data.recipient,
    categoryId: data.categoryId,
    categoryName: data.categoryName,
    receiptNumber: data.receiptNumber,
    authorizedBy: data.authorizedBy,
    date: data.date || now.split('T')[0],
    notes: data.notes,
    createdAt: now
  };

  const pcvRef = doc(db, `companies/${companyId}/petty_cash_transactions`, pcvId);
  await setDoc(pcvRef, pcv);
  return pcvId;
}

// -------------------------------------------------------------
// RECURRING EXPENSES OPERATIONS
// -------------------------------------------------------------

export async function addRecurringExpense(
  companyId: string, 
  data: Omit<RecurringExpense, 'id' | 'createdAt'>
): Promise<string> {
  const recId = `rec_${Date.now()}`;
  const now = new Date().toISOString();
  const recDoc: RecurringExpense = {
    id: recId,
    ...data,
    createdAt: now
  };
  const docRef = doc(db, `companies/${companyId}/recurring_expenses`, recId);
  await setDoc(docRef, recDoc);
  return recId;
}

export async function updateRecurringExpense(
  companyId: string, 
  recId: string, 
  data: Partial<RecurringExpense>
): Promise<void> {
  const docRef = doc(db, `companies/${companyId}/recurring_expenses`, recId);
  await updateDoc(docRef, data);
}

export async function deleteRecurringExpense(
  companyId: string, 
  recId: string
): Promise<void> {
  const docRef = doc(db, `companies/${companyId}/recurring_expenses`, recId);
  await deleteDoc(docRef);
}

export async function triggerRecurringExpense(companyId: string, recurring: RecurringExpense): Promise<string> {
  const now = new Date().toISOString();
  const expenseNumber = `EXP-REC-${Date.now().toString().slice(-4)}`;

  const expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> = {
    expenseNumber,
    title: recurring.title,
    categoryId: recurring.categoryId,
    categoryName: recurring.categoryName,
    amount: recurring.amount,
    taxAmount: 0,
    taxDeductible: true,
    vendorName: recurring.vendorName,
    date: recurring.nextDueDate || now.split('T')[0],
    paymentMethod: recurring.paymentMethod,
    department: recurring.department,
    status: 'PAID',
    isRecurring: true,
    recurringScheduleId: recurring.id,
    notes: `Generated automatically from recurring schedule "${recurring.title}"`,
    paidAt: now
  };

  const expenseId = await addExpense(companyId, expenseData);

  // Compute next due date
  const nextDate = new Date(recurring.nextDueDate || now);
  if (recurring.frequency === 'Weekly') nextDate.setDate(nextDate.getDate() + 7);
  else if (recurring.frequency === 'Bi-Weekly') nextDate.setDate(nextDate.getDate() + 14);
  else if (recurring.frequency === 'Monthly') nextDate.setMonth(nextDate.getMonth() + 1);
  else if (recurring.frequency === 'Quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
  else if (recurring.frequency === 'Yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

  const recRef = doc(db, `companies/${companyId}/recurring_expenses`, recurring.id);
  await updateDoc(recRef, {
    lastLoggedDate: now.split('T')[0],
    nextDueDate: nextDate.toISOString().split('T')[0]
  });

  return expenseId;
}

// -------------------------------------------------------------
// REAL-TIME FIRESTORE SUBSCRIPTIONS & SEEDING HELPERS
// -------------------------------------------------------------

import { onSnapshot, query, orderBy } from 'firebase/firestore';

export function subscribeToExpenses(
  companyId: string, 
  callback: (expenses: Expense[]) => void
): () => void {
  const colRef = collection(db, `companies/${companyId}/expenses`);
  return onSnapshot(colRef, (snapshot) => {
    const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Expense[];
    callback(list);
  }, (err) => {
    console.error('Failed to subscribe to expenses:', err);
    callback([]);
  });
}

export function subscribeToExpenseCategories(
  companyId: string, 
  callback: (categories: ExpenseCategory[]) => void
): () => void {
  const colRef = collection(db, `companies/${companyId}/expense_categories`);
  return onSnapshot(colRef, (snapshot) => {
    const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as ExpenseCategory[];
    callback(list);
  }, (err) => {
    console.error('Failed to subscribe to expense categories:', err);
    callback([]);
  });
}

export function subscribeToExpenseBudgets(
  companyId: string, 
  callback: (budgets: ExpenseBudget[]) => void
): () => void {
  const colRef = collection(db, `companies/${companyId}/expense_budgets`);
  return onSnapshot(colRef, (snapshot) => {
    const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as ExpenseBudget[];
    callback(list);
  }, (err) => {
    console.error('Failed to subscribe to expense budgets:', err);
    callback([]);
  });
}

export function subscribeToRecurringExpenses(
  companyId: string, 
  callback: (recs: RecurringExpense[]) => void
): () => void {
  const colRef = collection(db, `companies/${companyId}/recurring_expenses`);
  return onSnapshot(colRef, (snapshot) => {
    const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as RecurringExpense[];
    callback(list);
  }, (err) => {
    console.error('Failed to subscribe to recurring expenses:', err);
    callback([]);
  });
}

export function subscribeToPettyCash(
  companyId: string, 
  callback: (txs: PettyCashTransaction[]) => void
): () => void {
  const colRef = collection(db, `companies/${companyId}/petty_cash_transactions`);
  return onSnapshot(colRef, (snapshot) => {
    const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as PettyCashTransaction[];
    callback(list);
  }, (err) => {
    console.error('Failed to subscribe to petty cash transactions:', err);
    callback([]);
  });
}

export function subscribeToPettyCashFloat(
  companyId: string, 
  callback: (floatMeta: PettyCashFloat) => void
): () => void {
  const docRef = doc(db, `companies/${companyId}/petty_cash_meta`, 'current_float');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as PettyCashFloat);
    } else {
      callback({
        currentBalance: 8500,
        targetFloat: 10000,
        minimumThreshold: 3000,
        lastReplenished: new Date().toISOString()
      });
    }
  }, (err) => {
    console.error('Failed to subscribe to petty cash float:', err);
    callback({
      currentBalance: 8500,
      targetFloat: 10000,
      minimumThreshold: 3000,
      lastReplenished: new Date().toISOString()
    });
  });
}

export async function seedDefaultExpenseCategories(companyId: string): Promise<void> {
  const batch = writeBatch(db);
  DEFAULT_EXPENSE_CATEGORIES.forEach(cat => {
    const ref = doc(db, `companies/${companyId}/expense_categories`, cat.id);
    batch.set(ref, cat);
  });
  await batch.commit();
}

export async function seedDefaultExpenseBudgets(companyId: string): Promise<void> {
  const batch = writeBatch(db);
  DEFAULT_EXPENSE_CATEGORIES.forEach(cat => {
    const budgetId = `budget_${cat.id}`;
    const ref = doc(db, `companies/${companyId}/expense_budgets`, budgetId);
    const budgetDoc: ExpenseBudget = {
      id: budgetId,
      categoryId: cat.id,
      categoryName: cat.name,
      period: 'Monthly',
      allocatedAmount: cat.monthlyBudgetLimit || 20000,
      alertThresholdPct: 80,
      createdAt: new Date().toISOString()
    };
    batch.set(ref, budgetDoc);
  });
  await batch.commit();
}
