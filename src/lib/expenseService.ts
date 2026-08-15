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

      // Initial Demo Expenses
      const now = Date.now();
      const dayMs = 86400000;

      const demoExpenses: Partial<Expense>[] = [
        {
          id: 'exp_001',
          expenseNumber: 'EXP-2026-001',
          title: 'Main Showroom & Warehouse Lease',
          categoryId: 'cat_rent',
          categoryName: 'Facility & Warehouse Rent',
          amount: 45000,
          taxAmount: 0,
          taxDeductible: true,
          vendorName: 'Prime Commercial Properties Ltd',
          date: new Date(now - 12 * dayMs).toISOString().split('T')[0],
          paymentMethod: 'Bank Transfer',
          department: 'Operations',
          status: 'PAID',
          reference: 'INV-PROP-8891',
          notes: 'March warehouse rent fully settled via wire transfer.',
          paidAt: new Date(now - 12 * dayMs).toISOString(),
          isRecurring: true,
          createdAt: new Date(now - 12 * dayMs).toISOString(),
          updatedAt: new Date(now - 12 * dayMs).toISOString()
        },
        {
          id: 'exp_002',
          expenseNumber: 'EXP-2026-002',
          title: 'High-Speed Dedicated Fiber Internet',
          categoryId: 'cat_internet',
          categoryName: 'Internet, SaaS & Telephony',
          amount: 6500,
          taxAmount: 896,
          taxDeductible: true,
          vendorName: 'Safaricom Business / Fiber ISP',
          date: new Date(now - 8 * dayMs).toISOString().split('T')[0],
          paymentMethod: 'M-Pesa',
          department: 'IT & Software',
          status: 'PAID',
          reference: 'ACC-892182-SAF',
          notes: '100Mbps dedicated fiber connection for POS and cloud ERP sync.',
          paidAt: new Date(now - 8 * dayMs).toISOString(),
          isRecurring: true,
          createdAt: new Date(now - 8 * dayMs).toISOString(),
          updatedAt: new Date(now - 8 * dayMs).toISOString()
        },
        {
          id: 'exp_003',
          expenseNumber: 'EXP-2026-003',
          title: 'Monthly Electricity & 3-Phase Meter Bill',
          categoryId: 'cat_utilities',
          categoryName: 'Utilities, Power & Water',
          amount: 11400,
          taxAmount: 1572,
          taxDeductible: true,
          vendorName: 'Kenya Power & Lighting (KPLC)',
          date: new Date(now - 5 * dayMs).toISOString().split('T')[0],
          dueDate: new Date(now + 4 * dayMs).toISOString().split('T')[0],
          paymentMethod: 'M-Pesa',
          department: 'Operations',
          status: 'PAYABLE',
          reference: 'KPLC-BILL-99023',
          notes: 'Electricity bill due on the 20th. Meter reading confirmed.',
          createdAt: new Date(now - 5 * dayMs).toISOString(),
          updatedAt: new Date(now - 5 * dayMs).toISOString()
        },
        {
          id: 'exp_004',
          expenseNumber: 'EXP-2026-004',
          title: 'Thermal POS Receipt Rolls & Shipping Cartons',
          categoryId: 'cat_packaging',
          categoryName: 'Packaging & Consumables',
          amount: 4800,
          taxAmount: 662,
          taxDeductible: true,
          vendorName: 'Stationery & Packaging Hub East Africa',
          date: new Date(now - 3 * dayMs).toISOString().split('T')[0],
          paymentMethod: 'Cash',
          department: 'Operations',
          status: 'PAID',
          reference: 'RCP-66102',
          notes: '50x 80mm thermal receipt rolls + 100 delivery boxes.',
          paidAt: new Date(now - 3 * dayMs).toISOString(),
          createdAt: new Date(now - 3 * dayMs).toISOString(),
          updatedAt: new Date(now - 3 * dayMs).toISOString()
        },
        {
          id: 'exp_005',
          expenseNumber: 'EXP-2026-005',
          title: 'Social Media Promotion & Google Local Ads',
          categoryId: 'cat_marketing',
          categoryName: 'Marketing & Digital Ads',
          amount: 12500,
          taxAmount: 0,
          taxDeductible: true,
          vendorName: 'Meta Ads & Google Ireland',
          date: new Date(now - 2 * dayMs).toISOString().split('T')[0],
          paymentMethod: 'Credit Card',
          department: 'Sales & Marketing',
          status: 'PAID',
          reference: 'AD-CAMPAIGN-Q1-09',
          notes: 'Customer acquisition campaign for seasonal retail surge.',
          paidAt: new Date(now - 2 * dayMs).toISOString(),
          createdAt: new Date(now - 2 * dayMs).toISOString(),
          updatedAt: new Date(now - 2 * dayMs).toISOString()
        },
        {
          id: 'exp_006',
          expenseNumber: 'EXP-2026-006',
          title: 'Inbound Logistics & Port Clearance Handling',
          categoryId: 'cat_freight',
          categoryName: 'Freight, Delivery & Courier',
          amount: 14200,
          taxAmount: 1958,
          taxDeductible: true,
          vendorName: 'Swift Freights & Clearance Ltd',
          date: new Date(now - 1 * dayMs).toISOString().split('T')[0],
          dueDate: new Date(now + 8 * dayMs).toISOString().split('T')[0],
          paymentMethod: 'Bank Transfer',
          department: 'Logistics',
          status: 'PENDING',
          reference: 'BL-MOM-2026-77',
          notes: 'Container clearance fees for imported electronics batch. Awaiting director approval.',
          createdAt: new Date(now - 1 * dayMs).toISOString(),
          updatedAt: new Date(now - 1 * dayMs).toISOString()
        },
        {
          id: 'exp_007',
          expenseNumber: 'EXP-2026-007',
          title: 'Office Cleaning Detergents & Milk Supplies',
          categoryId: 'cat_office',
          categoryName: 'Office Supplies & Refreshments',
          amount: 1850,
          taxAmount: 0,
          taxDeductible: true,
          vendorName: 'Local Supermarket / Petty Cash',
          date: new Date(now).toISOString().split('T')[0],
          paymentMethod: 'Petty Cash',
          department: 'Administration',
          status: 'PAID',
          reference: 'PCV-2026-003',
          pettyCashVoucherId: 'pcv_003',
          notes: 'Tea, milk, sugar, and disinfectant for the office break room.',
          paidAt: new Date(now).toISOString(),
          createdAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString()
        }
      ];

      for (const exp of demoExpenses) {
        const eRef = doc(db, `companies/${companyId}/expenses`, exp.id!);
        batch.set(eRef, exp);
      }

      // Initial Recurring Expenses
      const demoRecurring: RecurringExpense[] = [
        {
          id: 'rec_001',
          title: 'Main Showroom & Warehouse Lease',
          categoryId: 'cat_rent',
          categoryName: 'Facility & Warehouse Rent',
          amount: 45000,
          vendorName: 'Prime Commercial Properties Ltd',
          frequency: 'Monthly',
          startDate: '2026-01-01',
          nextDueDate: '2026-04-01',
          lastLoggedDate: new Date(now - 12 * dayMs).toISOString().split('T')[0],
          autoLog: true,
          status: 'ACTIVE',
          paymentMethod: 'Bank Transfer',
          department: 'Operations',
          notes: 'Due on the 1st of every month.',
          createdAt: new Date().toISOString()
        },
        {
          id: 'rec_002',
          title: 'Dedicated Fiber Internet Subscription',
          categoryId: 'cat_internet',
          categoryName: 'Internet, SaaS & Telephony',
          amount: 6500,
          vendorName: 'Safaricom Business',
          frequency: 'Monthly',
          startDate: '2026-01-05',
          nextDueDate: '2026-04-05',
          lastLoggedDate: new Date(now - 8 * dayMs).toISOString().split('T')[0],
          autoLog: true,
          status: 'ACTIVE',
          paymentMethod: 'M-Pesa',
          department: 'IT & Software',
          notes: 'Direct MPesa Paybill monthly renewal.',
          createdAt: new Date().toISOString()
        },
        {
          id: 'rec_003',
          title: 'Night Security Guard Patrol Services',
          categoryId: 'cat_salaries',
          categoryName: 'Staff Wages & Casual Labour',
          amount: 22000,
          vendorName: 'ShieldGuard Security Services',
          frequency: 'Monthly',
          startDate: '2026-01-10',
          nextDueDate: '2026-04-10',
          autoLog: false,
          status: 'ACTIVE',
          paymentMethod: 'Bank Transfer',
          department: 'Operations',
          notes: '24/7 security guard patrol for warehouse grounds.',
          createdAt: new Date().toISOString()
        }
      ];

      for (const rec of demoRecurring) {
        const rRef = doc(db, `companies/${companyId}/recurring_expenses`, rec.id);
        batch.set(rRef, rec);
      }

      // Initial Petty Cash Meta & Ledger
      const floatMetaRef = doc(db, `companies/${companyId}/petty_cash_meta`, 'current_float');
      const floatMeta: PettyCashFloat = {
        currentBalance: 8150,
        targetFloat: 10000,
        minimumThreshold: 3000,
        lastReplenished: new Date(now - 14 * dayMs).toISOString()
      };
      batch.set(floatMetaRef, floatMeta);

      const demoPettyCashTx: PettyCashTransaction[] = [
        {
          id: 'pcv_001',
          voucherNumber: 'PCV-2026-001',
          type: 'TOP_UP',
          amount: 10000,
          balanceAfter: 10000,
          purpose: 'Monthly Petty Cash float replenishment from Main Bank Account',
          authorizedBy: 'Finance Manager',
          date: new Date(now - 14 * dayMs).toISOString().split('T')[0],
          notes: 'Check withdrawal #009183',
          createdAt: new Date(now - 14 * dayMs).toISOString()
        },
        {
          id: 'pcv_002',
          voucherNumber: 'PCV-2026-002',
          type: 'DISBURSEMENT',
          amount: 0, // placeholder
          balanceAfter: 10000,
          recipient: 'John (Courier)',
          purpose: 'Emergency motorcycle fuel for urgent delivery',
          categoryId: 'cat_freight',
          categoryName: 'Freight, Delivery & Courier',
          authorizedBy: 'Store Supervisor',
          date: new Date(now - 7 * dayMs).toISOString().split('T')[0],
          createdAt: new Date(now - 7 * dayMs).toISOString()
        },
        {
          id: 'pcv_003',
          voucherNumber: 'PCV-2026-003',
          type: 'DISBURSEMENT',
          amount: 1850,
          balanceAfter: 8150,
          recipient: 'Mary (Office Admin)',
          purpose: 'Office Cleaning Detergents & Milk Supplies',
          categoryId: 'cat_office',
          categoryName: 'Office Supplies & Refreshments',
          receiptNumber: 'SUP-09923',
          authorizedBy: 'Store Supervisor',
          date: new Date(now).toISOString().split('T')[0],
          notes: 'Attached supermarket receipt',
          createdAt: new Date(now).toISOString()
        }
      ];

      for (const pcv of demoPettyCashTx) {
        if (pcv.id === 'pcv_002') {
          pcv.amount = 1200;
          pcv.balanceAfter = 8800;
        }
        if (pcv.id === 'pcv_003') {
          pcv.amount = 1850;
          pcv.balanceAfter = 6950;
        }
        const pRef = doc(db, `companies/${companyId}/petty_cash_transactions`, pcv.id);
        batch.set(pRef, pcv);
      }

      await batch.commit();
      console.log('Successfully seeded default expense data for company:', companyId);
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
  notes?: string
): Promise<void> {
  const current = await getPettyCashFloat(companyId);
  const newBalance = (current.currentBalance || 0) + amount;
  const now = new Date().toISOString();

  // Save Meta
  const floatRef = doc(db, `companies/${companyId}/petty_cash_meta`, 'current_float');
  await setDoc(floatRef, {
    ...current,
    currentBalance: newBalance,
    lastReplenished: now
  }, { merge: true });

  // Record Transaction
  const pcvId = `pcv_${Date.now()}`;
  const pcv: PettyCashTransaction = {
    id: pcvId,
    voucherNumber: `PCV-TOP-${Date.now().toString().slice(-4)}`,
    type: 'TOP_UP',
    amount,
    balanceAfter: newBalance,
    purpose: 'Petty Cash Float Top-up / Replenishment',
    authorizedBy,
    date: now.split('T')[0],
    notes: notes || 'Cash float deposit',
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
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[];
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
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ExpenseCategory[];
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
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ExpenseBudget[];
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
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RecurringExpense[];
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
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PettyCashTransaction[];
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
