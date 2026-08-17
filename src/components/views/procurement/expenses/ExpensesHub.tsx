import React, { useState, useEffect } from 'react';
import { 
  DollarSign, LayoutDashboard, Receipt, Clock, 
  CreditCard, Repeat, Wallet, BarChart2, 
  FileText, BarChart3, Tag, Plus, Loader2, X, CheckCircle2 
} from 'lucide-react';
import { 
  Expense, ExpenseCategory, ExpenseBudget, 
  RecurringExpense, PettyCashTransaction, PettyCashFloat, 
  ViewType 
} from '../../../../types';
import { 
  subscribeToExpenses, subscribeToExpenseCategories, 
  subscribeToExpenseBudgets, subscribeToRecurringExpenses, 
  subscribeToPettyCash, subscribeToPettyCashFloat, 
  seedDefaultExpenseCategories, seedDefaultExpenseBudgets,
  ensureExpenseDefaults, topUpPettyCash 
} from '../../../../lib/expenseService';
import { useAuth } from '../../../../contexts/AuthContext';
import { useSettings } from '../../../../contexts/SettingsContext';
import { RecordExpenseModal } from './RecordExpenseModal';
import { ExpenseDashboard } from './ExpenseDashboard';
import { ExpenseTransactions } from './ExpenseTransactions';
import { PendingExpenses } from './PendingExpenses';
import { PayablesView } from './PayablesView';
import { RecurringExpensesView } from './RecurringExpensesView';
import { PettyCashView } from './PettyCashView';
import { ExpenseBudgetsView } from './ExpenseBudgetsView';
import { ExpenseReportsView } from './ExpenseReportsView';
import { ExpenseAnalyticsView } from './ExpenseAnalyticsView';
import { ExpenseCategoriesView } from './ExpenseCategoriesView';
import { InsightBadge } from '../../../common/InsightBadge';
import { cn } from '../../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ExpensesHubProps {
  currentSubView?: string;
  onNavigate?: (view: ViewType) => void;
}

export function ExpensesHub({ currentSubView = 'expense_dashboard', onNavigate }: ExpensesHubProps) {
  const { user } = useAuth();
  const { profile, company, currency: contextCurrency, loading: settingsLoading } = useSettings();
  const companyId = profile?.companyId || company?.id || '';
  const currency = company?.currency || contextCurrency || 'KES';

  const normalizeSubView = (subView?: string) => {
    if (!subView || subView === 'expenses') return 'expense_dashboard';
    if (subView === 'payables') return 'expense_payables';
    return subView;
  };

  // Active Sub Tab
  const [activeTab, setActiveTab] = useState<string>(normalizeSubView(currentSubView));

  // Synchronize when currentSubView prop changes from parent Navigation
  useEffect(() => {
    setActiveTab(normalizeSubView(currentSubView));
  }, [currentSubView]);

  // Firestore Subscriptions State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [budgets, setBudgets] = useState<ExpenseBudget[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [pettyCashTransactions, setPettyCashTransactions] = useState<PettyCashTransaction[]>([]);
  const [pettyCashFloat, setPettyCashFloat] = useState<PettyCashFloat>({
    currentBalance: 8500,
    targetFloat: 10000,
    minimumThreshold: 3000
  });
  const [loading, setLoading] = useState(true);

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Top Up Petty Cash Form State
  const [topUpAmount, setTopUpAmount] = useState('10000');
  const [topUpSource, setTopUpSource] = useState('Bank Cash Withdrawal');
  const [topUpVoucher, setTopUpVoucher] = useState('');
  const [topUpNotes, setTopUpNotes] = useState('');
  const [submittingTopUp, setSubmittingTopUp] = useState(false);

  const authorizerName = profile?.name || user?.displayName || 'Finance Officer';

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const amt = parseFloat(topUpAmount);
    if (isNaN(amt) || amt <= 0) return;

    setSubmittingTopUp(true);
    try {
      await topUpPettyCash(companyId, amt, authorizerName, topUpNotes.trim(), {
        source: topUpSource,
        voucherNumber: topUpVoucher.trim() || undefined
      });
      setIsTopUpModalOpen(false);
      setTopUpAmount('10000');
      setTopUpNotes('');
      setTopUpVoucher('');
    } catch (err) {
      console.error('Failed to top up petty cash:', err);
    } finally {
      setSubmittingTopUp(false);
    }
  };

  // Data Subscriptions
  useEffect(() => {
    if (!companyId) {
      if (!settingsLoading) {
        setLoading(false);
      }
      return;
    }
    setLoading(true);

    // Ensure defaults exist for this company in background
    ensureExpenseDefaults(companyId).catch((err) => {
      console.warn('ensureExpenseDefaults notice:', err);
    });

    const unsubCategories = subscribeToExpenseCategories(companyId, async (cats) => {
      if (cats.length === 0) {
        await seedDefaultExpenseCategories(companyId);
      } else {
        setCategories(cats);
      }
    });

    const unsubBudgets = subscribeToExpenseBudgets(companyId, async (bgs) => {
      if (bgs.length === 0) {
        await seedDefaultExpenseBudgets(companyId);
      } else {
        setBudgets(bgs);
      }
    });

    const unsubExpenses = subscribeToExpenses(companyId, (exps) => {
      setExpenses(exps);
      setLoading(false);
    });

    const unsubRecurring = subscribeToRecurringExpenses(companyId, (recs) => {
      setRecurringExpenses(recs);
    });

    const unsubPettyCash = subscribeToPettyCash(companyId, (txs) => {
      setPettyCashTransactions(txs);
    });

    const unsubFloat = subscribeToPettyCashFloat(companyId, (floatMeta) => {
      setPettyCashFloat(floatMeta);
    });

    // Safety timeout to guarantee UI renders even if network is slow
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    return () => {
      clearTimeout(safetyTimer);
      unsubCategories();
      unsubBudgets();
      unsubExpenses();
      unsubRecurring();
      unsubPettyCash();
      unsubFloat();
    };
  }, [companyId, settingsLoading]);

  // Tab Definitions
  const tabs = [
    { id: 'expense_dashboard', label: 'Expense Dashboard', icon: LayoutDashboard },
    { id: 'expense_transactions', label: 'Expense Transactions', icon: Receipt },
    { id: 'pending_expenses', label: 'Pending Expenses', icon: Clock, badge: expenses.filter(e => e.status === 'PENDING').length },
    { id: 'expense_payables', label: 'Payables', icon: CreditCard, badge: expenses.filter(e => e.status === 'PAYABLE').length },
    { id: 'recurring_expenses', label: 'Recurring Expenses', icon: Repeat },
    { id: 'petty_cash', label: 'Petty Cash', icon: Wallet },
    { id: 'expense_budgets', label: 'Expense Budgets', icon: BarChart2 },
    { id: 'expense_reports', label: 'Expense Reports', icon: FileText },
    { id: 'expense_analytics', label: 'Expense Analytics', icon: BarChart3 },
    { id: 'expense_categories', label: 'Expense Categories', icon: Tag },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (onNavigate) {
      onNavigate(tabId as ViewType);
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsRecordModalOpen(true);
  };

  if (loading && expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Loading Expenses Ledger...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner Navigation Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap",
                    isActive
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "text-blue-400" : "text-slate-400")} />
                  <span>{tab.label}</span>
                  {Boolean(tab.badge && tab.badge > 0) && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                      isActive ? "bg-blue-600 text-white" : "bg-purple-100 text-purple-700"
                    )}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              onClick={() => setIsTopUpModalOpen(true)}
              className="px-3.5 py-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shadow-2xs"
            >
              <Wallet className="w-4 h-4 text-emerald-700" /> Load Petty Cash
            </button>

            <button
              onClick={() => {
                setEditingExpense(null);
                setIsRecordModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-blue-600/20 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Record Expense
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Intelligence Telemetry */}
      <InsightBadge
        elementId="procurement_expenses_leakage"
        variant="banner"
        className="w-full"
      />

      {/* Tab View Container */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'expense_dashboard' && (
          <ExpenseDashboard
            expenses={expenses}
            categories={categories}
            budgets={budgets}
            pettyCashFloat={pettyCashFloat}
            currency={currency}
            onNavigateTab={handleTabChange}
            onOpenRecordModal={() => {
              setEditingExpense(null);
              setIsRecordModalOpen(true);
            }}
            onOpenPettyCashModal={() => setIsTopUpModalOpen(true)}
          />
        )}

        {activeTab === 'expense_transactions' && (
          <ExpenseTransactions
            expenses={expenses}
            categories={categories}
            companyId={companyId}
            currency={currency}
            onOpenRecordModal={() => {
              setEditingExpense(null);
              setIsRecordModalOpen(true);
            }}
            onEditExpense={handleEditExpense}
          />
        )}

        {activeTab === 'pending_expenses' && (
          <PendingExpenses
            expenses={expenses}
            categories={categories}
            companyId={companyId}
            currency={currency}
          />
        )}

        {activeTab === 'expense_payables' && (
          <PayablesView
            expenses={expenses}
            categories={categories}
            companyId={companyId}
            currency={currency}
            onOpenRecordModal={() => {
              setEditingExpense(null);
              setIsRecordModalOpen(true);
            }}
          />
        )}

        {activeTab === 'recurring_expenses' && (
          <RecurringExpensesView
            recurringExpenses={recurringExpenses}
            categories={categories}
            companyId={companyId}
            currency={currency}
          />
        )}

        {activeTab === 'petty_cash' && (
          <PettyCashView
            transactions={pettyCashTransactions}
            floatMeta={pettyCashFloat}
            categories={categories}
            companyId={companyId}
            currency={currency}
          />
        )}

        {activeTab === 'expense_budgets' && (
          <ExpenseBudgetsView
            expenses={expenses}
            categories={categories}
            budgets={budgets}
            companyId={companyId}
            currency={currency}
          />
        )}

        {activeTab === 'expense_reports' && (
          <ExpenseReportsView
            expenses={expenses}
            categories={categories}
            companyId={companyId}
            currency={currency}
          />
        )}

        {activeTab === 'expense_analytics' && (
          <ExpenseAnalyticsView
            expenses={expenses}
            categories={categories}
            companyId={companyId}
            currency={currency}
          />
        )}

        {activeTab === 'expense_categories' && (
          <ExpenseCategoriesView
            categories={categories}
            companyId={companyId}
            currency={currency}
          />
        )}
      </motion.div>

      {/* Record / Edit Expense Modal */}
      <RecordExpenseModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setEditingExpense(null);
        }}
        categories={categories}
        companyId={companyId}
        currency={currency}
        initialExpense={editingExpense || undefined}
      />

      {/* Load Petty Cash Top-Up Modal */}
      <AnimatePresence>
        {isTopUpModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Load Petty Cash Float</h4>
                    <p className="text-xs text-slate-400">Replenish cash drawer balance</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTopUpModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTopUpSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Amount to Load ({currency}) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-xs">{currency}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="0.00"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Quick Select Pill Buttons */}
                  <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                    {[1000, 2500, 5000, 10000, 20000, 50000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTopUpAmount(amt.toString())}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all whitespace-nowrap",
                          topUpAmount === amt.toString()
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        +{currency} {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Funding Source
                    </label>
                    <select
                      value={topUpSource}
                      onChange={(e) => setTopUpSource(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                    >
                      <option value="Bank Cash Withdrawal">Bank Cash Withdrawal</option>
                      <option value="Main Till Transfer">Main Till Transfer</option>
                      <option value="Director / Owner Capital">Director / Owner Capital</option>
                      <option value="M-Pesa / Mobile Float Transfer">M-Pesa Float Transfer</option>
                      <option value="Other">Other Source</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Voucher / Slip Ref #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., PCV-001, Slip #481"
                      value={topUpVoucher}
                      onChange={(e) => setTopUpVoucher(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Notes / Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Weekly float replenishment from central bank account"
                    value={topUpNotes}
                    onChange={(e) => setTopUpNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                {/* Calculation preview */}
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span>Current Drawer Balance:</span>
                    <span>{currency} {(pettyCashFloat.currentBalance || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700 font-semibold">
                    <span>+ Deposit to Load:</span>
                    <span>+{currency} {(parseFloat(topUpAmount) || 0).toLocaleString()}</span>
                  </div>
                  <div className="pt-1.5 border-t border-emerald-200/80 flex items-center justify-between font-bold text-slate-900 text-sm">
                    <span>New Float Balance:</span>
                    <span className="text-emerald-800">
                      {currency} {((pettyCashFloat.currentBalance || 0) + (parseFloat(topUpAmount) || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsTopUpModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTopUp || (parseFloat(topUpAmount) || 0) <= 0}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {submittingTopUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                    Confirm & Load Float
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
