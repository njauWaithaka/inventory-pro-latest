import React, { useState, useEffect } from 'react';
import { 
  DollarSign, LayoutDashboard, Receipt, Clock, 
  CreditCard, Repeat, Wallet, BarChart2, 
  FileText, BarChart3, Tag, Plus, Loader2 
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
  seedDefaultExpenseCategories, seedDefaultExpenseBudgets 
} from '../../../../lib/expenseService';
import { useAuth } from '../../../../contexts/AuthContext';
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
import { cn } from '../../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ExpensesHubProps {
  currentSubView?: string;
  onNavigate?: (view: ViewType) => void;
}

export function ExpensesHub({ currentSubView = 'expense_dashboard', onNavigate }: ExpensesHubProps) {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id || '';
  const currency = currentCompany?.currency || 'KES';

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
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Data Subscriptions
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);

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

    return () => {
      unsubCategories();
      unsubBudgets();
      unsubExpenses();
      unsubRecurring();
      unsubPettyCash();
      unsubFloat();
    };
  }, [companyId]);

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

          <button
            onClick={() => {
              setEditingExpense(null);
              setIsRecordModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-blue-600/20 whitespace-nowrap shrink-0 ml-2"
          >
            <Plus className="w-4 h-4" /> Record Expense
          </button>
        </div>
      </div>

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
            onOpenPettyCashModal={() => handleTabChange('petty_cash')}
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
    </div>
  );
}
