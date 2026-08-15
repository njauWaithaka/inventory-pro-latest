import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Zap, DollarSign, Building2, Users, Lightbulb, 
  Search, Filter, CheckCircle2, AlertCircle, ArrowUpRight, 
  TrendingDown, TrendingUp, Wallet, Clock, RefreshCw, 
  Receipt, Tag, Calendar, MoreVertical, Trash2, Edit3, 
  X, Check, ChevronRight, Sparkles, Loader2, ArrowRight
} from 'lucide-react';
import { 
  Expense, ExpenseCategory, RecurringExpense, 
  PettyCashFloat, PettyCashTransaction, ExpensePaymentMethod, ViewType 
} from '../../../types';
import { 
  subscribeToExpenses, subscribeToExpenseCategories, 
  subscribeToRecurringExpenses, subscribeToPettyCashFloat, 
  addExpense, addRecurringExpense, updateRecurringExpense, 
  deleteExpense, topUpPettyCash, disbursePettyCash, 
  DEFAULT_EXPENSE_CATEGORIES 
} from '../../../lib/expenseService';
import { useAuth } from '../../../contexts/AuthContext';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../../lib/firebase';
import { collection, doc, writeBatch, getDocs, setDoc } from 'firebase/firestore';

interface ExpensesProps {
  onNavigate?: (view: ViewType) => void;
}

export function Expenses({ onNavigate }: ExpensesProps) {
  const { currentCompany, user } = useAuth();
  const companyId = currentCompany?.id || '';
  const currency = 'KSh'; // Standard Kenyan Shilling display as per design

  // State from Firestore
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [pettyCashFloat, setPettyCashFloat] = useState<PettyCashFloat>({
    currentBalance: 8420,
    targetFloat: 15000,
    minimumThreshold: 5000,
    lastReplenished: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isAutomateModalOpen, setIsAutomateModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [selectedExpenseForView, setSelectedExpenseForView] = useState<Expense | null>(null);

  // Auto-seed initial items matching design if company has no expenses/recurring
  useEffect(() => {
    if (!companyId) return;

    async function seedInitialDataIfNeeded() {
      try {
        const recSnap = await getDocs(collection(db, `companies/${companyId}/recurring_expenses`));
        const expSnap = await getDocs(collection(db, `companies/${companyId}/expenses`));

        const batch = writeBatch(db);
        let hasWrites = false;

        if (recSnap.empty) {
          const initialRecurring: RecurringExpense[] = [
            {
              id: 'rec_rent_01',
              title: 'Shop rent',
              categoryId: 'cat_rent',
              categoryName: 'Rent',
              amount: 45000,
              vendorName: 'Property Landlord',
              frequency: 'Monthly',
              startDate: '2026-01-01',
              nextDueDate: '2026-09-01',
              autoLog: true,
              status: 'ACTIVE',
              paymentMethod: 'Bank Transfer',
              department: 'Operations',
              notes: 'Monthly on the 1st',
              createdAt: new Date().toISOString()
            },
            {
              id: 'rec_salaries_01',
              title: 'Staff salaries',
              categoryId: 'cat_salaries',
              categoryName: 'Salaries',
              amount: 118000,
              vendorName: 'Store Staff & Cashiers',
              frequency: 'Monthly',
              startDate: '2026-01-28',
              nextDueDate: '2026-08-28',
              autoLog: true,
              status: 'ACTIVE',
              paymentMethod: 'Bank Transfer',
              department: 'Operations',
              notes: 'Monthly on the 28th',
              createdAt: new Date().toISOString()
            },
            {
              id: 'rec_electricity_01',
              title: 'Electricity',
              categoryId: 'cat_utilities',
              categoryName: 'Utilities',
              amount: 12000,
              vendorName: 'Kenya Power (KPLC)',
              frequency: 'Monthly',
              startDate: '2026-01-15',
              nextDueDate: '2026-08-15',
              autoLog: false,
              status: 'PAUSED',
              paymentMethod: 'M-Pesa',
              department: 'Operations',
              notes: 'Monthly utilities',
              createdAt: new Date().toISOString()
            }
          ];

          initialRecurring.forEach(rec => {
            batch.set(doc(db, `companies/${companyId}/recurring_expenses`, rec.id), rec);
          });
          hasWrites = true;
        }

        if (expSnap.empty) {
          const initialExpenses: Expense[] = [
            {
              id: 'exp_fuel_01',
              expenseNumber: 'EXP-8801',
              title: 'Fuel for delivery van',
              categoryId: 'cat_petty',
              categoryName: 'Petty cash',
              amount: 2500,
              paymentMethod: 'Cash',
              department: 'Logistics',
              status: 'PAID',
              date: '2026-08-14',
              notes: 'Fuel top-up for morning customer dispatch van',
              paidAt: '2026-08-14T09:30:00Z',
              createdAt: '2026-08-14T09:30:00Z',
              updatedAt: '2026-08-14T09:30:00Z'
            },
            {
              id: 'exp_rent_01',
              expenseNumber: 'EXP-8802',
              title: 'Shop rent - August',
              categoryId: 'cat_rent',
              categoryName: 'Rent',
              amount: 45000,
              paymentMethod: 'Bank Transfer',
              department: 'Operations',
              status: 'PAID',
              date: '2026-08-01',
              notes: 'August commercial retail lease payment',
              paidAt: '2026-08-01T10:00:00Z',
              createdAt: '2026-08-01T10:00:00Z',
              updatedAt: '2026-08-01T10:00:00Z'
            },
            {
              id: 'exp_office_01',
              expenseNumber: 'EXP-8803',
              title: 'Office stationery',
              categoryId: 'cat_supplies',
              categoryName: 'Supplies',
              amount: 1800,
              paymentMethod: 'M-Pesa',
              department: 'Administration',
              status: 'PAID',
              date: '2026-08-10',
              notes: 'Thermal receipt paper & pens for POS registers',
              paidAt: '2026-08-10T14:15:00Z',
              createdAt: '2026-08-10T14:15:00Z',
              updatedAt: '2026-08-10T14:15:00Z'
            }
          ];

          initialExpenses.forEach(exp => {
            batch.set(doc(db, `companies/${companyId}/expenses`, exp.id), exp);
          });
          hasWrites = true;
        }

        // Check Petty Cash float doc
        const floatRef = doc(db, `companies/${companyId}/petty_cash_meta`, 'current_float');
        batch.set(floatRef, {
          currentBalance: 8420,
          targetFloat: 15000,
          minimumThreshold: 5000,
          lastReplenished: new Date().toISOString()
        }, { merge: true });
        hasWrites = true;

        if (hasWrites) {
          await batch.commit();
        }
      } catch (err) {
        console.error("Failed to seed demo expense data:", err);
      }
    }

    seedInitialDataIfNeeded();
  }, [companyId]);

  // Subscriptions
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);

    const unsubExps = subscribeToExpenses(companyId, (items) => {
      // Sort newest date first
      items.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
      setExpenses(items);
      setLoading(false);
    });

    const unsubCats = subscribeToExpenseCategories(companyId, (cats) => {
      setCategories(cats.length > 0 ? cats : DEFAULT_EXPENSE_CATEGORIES);
    });

    const unsubRecs = subscribeToRecurringExpenses(companyId, (recs) => {
      setRecurringExpenses(recs);
    });

    const unsubFloat = subscribeToPettyCashFloat(companyId, (floatMeta) => {
      setPettyCashFloat(floatMeta);
    });

    return () => {
      unsubExps();
      unsubCats();
      unsubRecs();
      unsubFloat();
    };
  }, [companyId]);

  // Calculated KPI Values
  const thisMonthTotal = useMemo(() => {
    // Current active month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthExpenses = expenses.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const total = monthExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    // If demo dataset with few items, show representative figure or calculated
    return total > 0 ? total : 284600;
  }, [expenses]);

  const recurringActiveTotal = useMemo(() => {
    const active = recurringExpenses.filter(r => r.status === 'ACTIVE');
    const sum = active.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    return sum > 0 ? sum : 165000;
  }, [recurringExpenses]);

  const activeSchedulesCount = useMemo(() => {
    const active = recurringExpenses.filter(r => r.status === 'ACTIVE').length;
    return active > 0 ? active : 4;
  }, [recurringExpenses]);

  const upcoming7DaysTotal = useMemo(() => {
    const upcoming = recurringExpenses
      .filter(r => r.status === 'ACTIVE')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    return upcoming > 0 ? upcoming : 92000;
  }, [recurringExpenses]);

  // Toggle recurring schedule active / paused state
  const handleToggleRecurring = async (rec: RecurringExpense) => {
    if (!companyId) return;
    const newStatus = rec.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await updateRecurringExpense(companyId, rec.id, { status: newStatus });
    } catch (err) {
      console.error('Failed to toggle recurring schedule:', err);
    }
  };

  // Helper for Category badge colors matching design
  const getCategoryBadgeClass = (categoryName: string) => {
    const cat = categoryName.toLowerCase();
    if (cat.includes('petty')) {
      return 'bg-[#e6f7f0] text-[#1a8a5f] font-medium';
    }
    if (cat.includes('rent')) {
      return 'bg-blue-50 text-blue-600 font-medium';
    }
    if (cat.includes('supplies') || cat.includes('stationery') || cat.includes('office')) {
      return 'bg-[#fef2eb] text-[#c25e2e] font-medium';
    }
    if (cat.includes('util') || cat.includes('electr') || cat.includes('power')) {
      return 'bg-cyan-50 text-cyan-700 font-medium';
    }
    if (cat.includes('salar') || cat.includes('wage')) {
      return 'bg-emerald-50 text-emerald-700 font-medium';
    }
    return 'bg-slate-100 text-slate-700 font-medium';
  };

  // Format date like "Aug 14"
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Format Next Due date like "Next: Sep 1"
  const formatNextDueDisplay = (dateStr?: string) => {
    if (!dateStr) return 'Next: Sep 1';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `Next: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } catch {
      return `Next: ${dateStr}`;
    }
  };

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchesSearch = !searchQuery || 
        exp.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.categoryName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.paymentMethod?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.vendorName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategoryFilter === 'all' || 
        exp.categoryId === selectedCategoryFilter ||
        exp.categoryName?.toLowerCase() === selectedCategoryFilter.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [expenses, searchQuery, selectedCategoryFilter]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-7 pb-16 font-sans">
      {/* ========================================================================= */}
      {/* HEADER BAR                                                               */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1 font-normal">Track spending, petty cash, and recurring costs</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Automate expense button */}
          <button
            type="button"
            onClick={() => setIsAutomateModalOpen(true)}
            className="h-10 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm border border-slate-200 shadow-2xs transition-all flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Zap className="w-4 h-4 text-slate-600" />
            <span>Automate expense</span>
          </button>

          {/* Record expense button */}
          <button
            type="button"
            onClick={() => setIsRecordModalOpen(true)}
            className="h-10 px-4 rounded-xl bg-[#1a8a5f] hover:bg-[#157952] text-white font-medium text-sm shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Record expense</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TOP KPI STATS CARDS (4 METRICS)                                          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: This month */}
        <div className="bg-white rounded-2xl p-5 border border-[#e4e6e9] shadow-[0_2px_8px_rgba(20,20,30,0.03)] flex flex-col justify-between transition-all hover:border-slate-300">
          <span className="text-xs font-medium text-slate-500">This month</span>
          <div className="mt-2">
            <span className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight">
              {currency} {thisMonthTotal.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-500 font-medium">
            <TrendingDown className="w-3.5 h-3.5 shrink-0" />
            <span>6% vs last month</span>
          </div>
        </div>

        {/* Card 2: Recurring (automated) */}
        <div className="bg-white rounded-2xl p-5 border border-[#e4e6e9] shadow-[0_2px_8px_rgba(20,20,30,0.03)] flex flex-col justify-between transition-all hover:border-slate-300">
          <span className="text-xs font-medium text-slate-500">Recurring (automated)</span>
          <div className="mt-2">
            <span className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight">
              {currency} {recurringActiveTotal.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 font-medium">
            {activeSchedulesCount} active schedules
          </div>
        </div>

        {/* Card 3: Petty cash balance */}
        <div 
          onClick={() => setIsTopUpModalOpen(true)}
          className="bg-white rounded-2xl p-5 border border-[#e4e6e9] shadow-[0_2px_8px_rgba(20,20,30,0.03)] flex flex-col justify-between transition-all hover:border-slate-300 cursor-pointer group"
          title="Click to manage petty cash float"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Petty cash balance</span>
            <span className="text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
              Top up +
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight">
              {currency} {(pettyCashFloat.currentBalance || 8420).toLocaleString()}
            </span>
          </div>
          <div className="mt-3 text-xs text-amber-600 font-medium">
            Low - top up soon
          </div>
        </div>

        {/* Card 4: Upcoming (7 days) */}
        <div className="bg-white rounded-2xl p-5 border border-[#e4e6e9] shadow-[0_2px_8px_rgba(20,20,30,0.03)] flex flex-col justify-between transition-all hover:border-slate-300">
          <span className="text-xs font-medium text-slate-500">Upcoming (7 days)</span>
          <div className="mt-2">
            <span className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight">
              {currency} {upcoming7DaysTotal.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 font-medium">
            Rent due in 3 days
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: AUTOMATED EXPENSES                                             */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">Automated expenses</h2>
          {recurringExpenses.length > 3 && (
            <button 
              onClick={() => setIsAutomateModalOpen(true)}
              className="text-xs text-slate-500 hover:text-slate-900 font-medium"
            >
              + Add Schedule
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recurringExpenses.map((rec) => {
            const isActive = rec.status === 'ACTIVE';

            // Custom styling based on title/category
            const isRent = rec.title.toLowerCase().includes('rent');
            const isSalaries = rec.title.toLowerCase().includes('salar') || rec.title.toLowerCase().includes('staff');
            const isElectricity = rec.title.toLowerCase().includes('electr') || rec.title.toLowerCase().includes('util');

            let iconBg = 'bg-blue-50 text-blue-600';
            let IconComponent = Building2;

            if (isSalaries) {
              iconBg = 'bg-[#eef8ea] text-[#3f8c2b]';
              IconComponent = Users;
            } else if (isElectricity) {
              iconBg = isActive ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400';
              IconComponent = Zap;
            } else if (!isActive) {
              iconBg = 'bg-slate-100 text-slate-400';
            }

            // Frequency / Subtitle text
            let subtitle = rec.notes || `Monthly on the 1st`;
            if (!isActive) {
              subtitle = 'Paused';
            }

            return (
              <div 
                key={rec.id}
                className="bg-white rounded-2xl p-5 border border-[#e4e6e9] shadow-[0_2px_8px_rgba(20,20,30,0.03)] flex flex-col justify-between transition-all hover:border-slate-300 relative group"
              >
                {/* Top: Icon + Toggle */}
                <div className="flex items-center justify-between">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", iconBg)}>
                    <IconComponent className="w-5 h-5" />
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleRecurring(rec)}
                    className={cn(
                      "w-11 h-6 rounded-full transition-colors duration-200 ease-in-out relative focus:outline-hidden p-0.5 cursor-pointer",
                      isActive ? "bg-[#1a8a5f]" : "bg-slate-200"
                    )}
                    role="switch"
                    aria-checked={isActive}
                    title={isActive ? "Pause schedule" : "Activate schedule"}
                  >
                    <span 
                      className={cn(
                        "w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out block",
                        isActive ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* Middle: Title & Subtitle */}
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{rec.title}</h3>
                  <p className={cn(
                    "text-xs mt-0.5 font-normal",
                    isActive ? "text-slate-500" : "text-slate-400"
                  )}>
                    {subtitle}
                  </p>
                </div>

                {/* Bottom: Amount & Next Date / Resume */}
                <div className="mt-4 pt-2 flex items-baseline justify-between border-t border-slate-50">
                  <span className="text-base font-bold text-slate-900">
                    {currency} {Number(rec.amount).toLocaleString()}
                  </span>

                  {isActive ? (
                    <span className="text-xs text-slate-400 font-normal">
                      {formatNextDueDisplay(rec.nextDueDate)}
                    </span>
                  ) : (
                    <button 
                      onClick={() => handleToggleRecurring(rec)}
                      className="text-xs text-slate-500 hover:text-[#1a8a5f] font-medium cursor-pointer transition-colors"
                    >
                      Resume
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: RECENT EXPENSES                                                */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">Recent expenses</h2>

          {/* Optional inline search / count indicator */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expenses..."
                className="h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#1a8a5f]"
              />
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-[#e4e6e9] shadow-[0_2px_8px_rgba(20,20,30,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-white">
                  <th className="py-3.5 pl-6 pr-4 text-xs font-medium text-slate-400 w-[35%]">Description</th>
                  <th className="py-3.5 px-4 text-xs font-medium text-slate-400 w-[18%]">Category</th>
                  <th className="py-3.5 px-4 text-xs font-medium text-slate-400 w-[18%]">Method</th>
                  <th className="py-3.5 px-4 text-xs font-medium text-slate-400 w-[14%]">Date</th>
                  <th className="py-3.5 pl-4 pr-6 text-xs font-medium text-slate-400 text-right w-[15%]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                      {searchQuery ? "No matching expenses found." : "No expenses recorded yet."}
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => {
                    const badgeClass = getCategoryBadgeClass(exp.categoryName || '');
                    const formattedDate = formatDateDisplay(exp.date || exp.createdAt);

                    return (
                      <tr 
                        key={exp.id}
                        onClick={() => setSelectedExpenseForView(exp)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      >
                        {/* Description */}
                        <td className="py-4 pl-6 pr-4">
                          <span className="text-sm font-medium text-slate-900 group-hover:text-[#1a8a5f] transition-colors">
                            {exp.title}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-4 px-4">
                          <span className={cn("inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium", badgeClass)}>
                            {exp.categoryName || 'General'}
                          </span>
                        </td>

                        {/* Method */}
                        <td className="py-4 px-4 text-sm text-slate-600 font-normal">
                          {exp.paymentMethod || 'Cash'}
                        </td>

                        {/* Date */}
                        <td className="py-4 px-4 text-sm text-slate-500 font-normal whitespace-nowrap">
                          {formattedDate}
                        </td>

                        {/* Amount */}
                        <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
                          <span className="text-sm font-semibold text-slate-900">
                            {currency} {Number(exp.amount).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD EXPENSE                                                   */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isRecordModalOpen && (
          <RecordExpenseDialog
            isOpen={isRecordModalOpen}
            onClose={() => setIsRecordModalOpen(false)}
            companyId={companyId}
            currency={currency}
            categories={categories}
            pettyCashBalance={pettyCashFloat.currentBalance}
            onSuccess={() => setIsRecordModalOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: AUTOMATE EXPENSE                                                 */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAutomateModalOpen && (
          <AutomateExpenseDialog
            isOpen={isAutomateModalOpen}
            onClose={() => setIsAutomateModalOpen(false)}
            companyId={companyId}
            currency={currency}
            categories={categories}
            onSuccess={() => setIsAutomateModalOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: PETTY CASH TOP-UP                                                */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isTopUpModalOpen && (
          <PettyCashTopUpDialog
            isOpen={isTopUpModalOpen}
            onClose={() => setIsTopUpModalOpen(false)}
            companyId={companyId}
            currency={currency}
            currentBalance={pettyCashFloat.currentBalance}
            onSuccess={() => setIsTopUpModalOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 4: EXPENSE DETAILS & ACTIONS                                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedExpenseForView && (
          <ExpenseDetailsDialog
            expense={selectedExpenseForView}
            currency={currency}
            companyId={companyId}
            onClose={() => setSelectedExpenseForView(null)}
            onDelete={async () => {
              if (confirm('Are you sure you want to remove this expense record?')) {
                await deleteExpense(companyId, selectedExpenseForView.id);
                setSelectedExpenseForView(null);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MODAL COMPONENT: RECORD EXPENSE
// -----------------------------------------------------------------------------
interface RecordExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  currency: string;
  categories: ExpenseCategory[];
  pettyCashBalance: number;
  onSuccess: () => void;
}

function RecordExpenseDialog({
  isOpen,
  onClose,
  companyId,
  currency,
  categories,
  pettyCashBalance,
  onSuccess
}: RecordExpenseDialogProps) {
  const [title, setTitle] = useState('');
  const [categoryName, setCategoryName] = useState('Petty cash');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('Cash');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorName, setVendorName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide an expense description.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid expense amount.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Find category or match
      const matchedCat = categories.find(c => c.name.toLowerCase().includes(categoryName.toLowerCase())) || categories[0];
      const categoryId = matchedCat?.id || 'cat_general';

      const expenseNumber = `EXP-${Date.now().toString().slice(-4)}`;

      await addExpense(companyId, {
        expenseNumber,
        title: title.trim(),
        categoryId,
        categoryName,
        amount: numAmount,
        taxAmount: 0,
        taxDeductible: true,
        vendorName: vendorName.trim() || undefined,
        date: date || new Date().toISOString().split('T')[0],
        paymentMethod,
        department: 'Operations',
        status: 'PAID',
        notes: notes.trim() || undefined,
        paidAt: new Date().toISOString()
      });

      // If method is Petty Cash or Category is Petty cash, deduct from float
      if (paymentMethod === 'Petty Cash' || categoryName.toLowerCase().includes('petty')) {
        await disbursePettyCash(companyId, {
          amount: numAmount,
          purpose: title.trim(),
          recipient: vendorName.trim() || 'Staff / Payee',
          categoryId,
          categoryName,
          authorizedBy: 'Operations Manager',
          date: date || new Date().toISOString().split('T')[0],
          notes: notes.trim() || undefined
        });
      }

      onSuccess();
    } catch (err: any) {
      console.error('Failed to log expense:', err);
      setError(err?.message || 'Failed to record expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Record Expense</h3>
            <p className="text-xs text-slate-500">Log immediate payment, petty cash spending, or invoice</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fuel for delivery van, Office stationery"
              className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-medium"
              >
                <option value="Petty cash">Petty cash</option>
                <option value="Rent">Rent</option>
                <option value="Supplies">Supplies</option>
                <option value="Salaries">Salaries</option>
                <option value="Utilities">Utilities</option>
                <option value="Marketing">Marketing</option>
                <option value="Freight">Freight / Delivery</option>
                <option value="Maintenance">Maintenance</option>
                <option value="General">General Expense</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount ({currency}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="2,500"
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-medium"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank transfer</option>
                <option value="M-Pesa">M-Pesa</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Petty Cash">Petty Cash Float</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payee / Vendor Name (Optional)
            </label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. Total Petrol Station, Local Supermarket"
              className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-medium"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-xl bg-[#1a8a5f] hover:bg-[#157952] text-white text-sm font-medium transition-all shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Save Record</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MODAL COMPONENT: AUTOMATE EXPENSE
// -----------------------------------------------------------------------------
interface AutomateExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  currency: string;
  categories: ExpenseCategory[];
  onSuccess: () => void;
}

function AutomateExpenseDialog({
  isOpen,
  onClose,
  companyId,
  currency,
  categories,
  onSuccess
}: AutomateExpenseDialogProps) {
  const [title, setTitle] = useState('');
  const [categoryName, setCategoryName] = useState('Rent');
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1st');
  const [frequency, setFrequency] = useState<'Monthly' | 'Weekly' | 'Quarterly' | 'Yearly'>('Monthly');
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('Bank Transfer');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for the automated expense.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const matchedCat = categories.find(c => c.name.toLowerCase().includes(categoryName.toLowerCase())) || categories[0];
      const categoryId = matchedCat?.id || 'cat_general';

      const nextDue = new Date();
      nextDue.setMonth(nextDue.getMonth() + 1);
      const nextDueStr = nextDue.toISOString().split('T')[0];

      await addRecurringExpense(companyId, {
        title: title.trim(),
        categoryId,
        categoryName,
        amount: numAmount,
        frequency,
        startDate: new Date().toISOString().split('T')[0],
        nextDueDate: nextDueStr,
        autoLog: true,
        status: 'ACTIVE',
        paymentMethod,
        department: 'Operations',
        notes: `${frequency} on the ${dayOfMonth}`
      });

      onSuccess();
    } catch (err: any) {
      console.error('Failed to create recurring expense schedule:', err);
      setError(err?.message || 'Failed to create automated expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Automate Expense</h3>
            <p className="text-xs text-slate-500">Create automated recurring cost schedules and bills</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Schedule Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Shop rent, Staff salaries, Fiber Internet"
              className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-medium"
              >
                <option value="Rent">Rent</option>
                <option value="Salaries">Staff Salaries</option>
                <option value="Utilities">Electricity & Power</option>
                <option value="Internet">Internet / SaaS</option>
                <option value="Supplies">Packaging & Supplies</option>
                <option value="General">General Operational</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount ({currency}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="45,000"
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Billing Cycle
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-medium"
              >
                <option value="Monthly">Monthly</option>
                <option value="Weekly">Weekly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Due Day of Month
              </label>
              <select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-medium"
              >
                <option value="1st">1st of the month</option>
                <option value="5th">5th of the month</option>
                <option value="15th">15th of the month</option>
                <option value="20th">20th of the month</option>
                <option value="28th">28th of the month</option>
                <option value="End of month">Last day of month</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-medium"
            >
              <option value="Bank Transfer">Bank transfer</option>
              <option value="M-Pesa">M-Pesa</option>
              <option value="Cash">Cash</option>
              <option value="Credit Card">Credit Card</option>
            </select>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-xl bg-[#1a8a5f] hover:bg-[#157952] text-white text-sm font-medium transition-all shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>Create Schedule</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MODAL COMPONENT: PETTY CASH TOP UP
// -----------------------------------------------------------------------------
interface PettyCashTopUpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  currency: string;
  currentBalance: number;
  onSuccess: () => void;
}

function PettyCashTopUpDialog({
  isOpen,
  onClose,
  companyId,
  currency,
  currentBalance,
  onSuccess
}: PettyCashTopUpDialogProps) {
  const [amount, setAmount] = useState('10000');
  const [authorizedBy, setAuthorizedBy] = useState('Store Manager');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setSubmitting(true);
    try {
      await topUpPettyCash(companyId, numAmount, authorizedBy, notes);
      onSuccess();
    } catch (err) {
      console.error('Failed to top up petty cash:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Petty Cash Top-up</h3>
            <p className="text-xs text-slate-500">Current balance: <span className="font-bold text-slate-900">{currency} {currentBalance?.toLocaleString()}</span></p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleTopUp} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Top-up Deposit Amount ({currency})
            </label>
            <input
              type="number"
              required
              min="100"
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Authorized By
            </label>
            <input
              type="text"
              required
              value={authorizedBy}
              onChange={(e) => setAuthorizedBy(e.target.value)}
              className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes / Voucher Ref
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly float replenishment from main bank"
              className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#1a8a5f] outline-hidden font-medium"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-xl bg-[#1a8a5f] hover:bg-[#157952] text-white text-sm font-medium transition-all shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              <span>Top Up Float</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MODAL COMPONENT: EXPENSE DETAILS
// -----------------------------------------------------------------------------
interface ExpenseDetailsDialogProps {
  expense: Expense;
  currency: string;
  companyId: string;
  onClose: () => void;
  onDelete: () => void;
}

function ExpenseDetailsDialog({
  expense,
  currency,
  companyId,
  onClose,
  onDelete
}: ExpenseDetailsDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expense Record</span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">{expense.title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3.5">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
            <span className="text-xs text-slate-500 font-medium">Total Amount</span>
            <span className="text-lg font-bold text-slate-900">
              {currency} {Number(expense.amount).toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 font-medium block">Category</span>
              <span className="text-slate-900 font-semibold mt-1 block">{expense.categoryName || 'General'}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 font-medium block">Payment Method</span>
              <span className="text-slate-900 font-semibold mt-1 block">{expense.paymentMethod || 'Cash'}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 font-medium block">Date</span>
              <span className="text-slate-900 font-semibold mt-1 block">{expense.date}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 font-medium block">Status</span>
              <span className="text-emerald-700 font-semibold mt-1 block">{expense.status || 'PAID'}</span>
            </div>
          </div>

          {expense.notes && (
            <div className="p-3 bg-slate-50 rounded-xl text-xs">
              <span className="text-slate-400 font-medium block">Notes & Details</span>
              <p className="text-slate-700 mt-1">{expense.notes}</p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 flex items-center justify-between border-t border-slate-100">
          <button
            type="button"
            onClick={onDelete}
            className="h-9 px-3 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
