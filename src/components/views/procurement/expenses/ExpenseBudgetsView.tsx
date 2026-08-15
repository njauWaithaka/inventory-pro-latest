import React, { useState, useMemo } from 'react';
import { 
  BarChart2, Plus, Edit3, AlertCircle, CheckCircle2, 
  TrendingUp, DollarSign, ShieldAlert, Sparkles, X, Loader2 
} from 'lucide-react';
import { Expense, ExpenseCategory, ExpenseBudget } from '../../../../types';
import { db } from '../../../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { cn } from '../../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ExpenseBudgetsViewProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  budgets: ExpenseBudget[];
  companyId: string;
  currency: string;
}

export function ExpenseBudgetsView({
  expenses,
  categories,
  budgets,
  companyId,
  currency
}: ExpenseBudgetsViewProps) {
  const [editingBudget, setEditingBudget] = useState<{ categoryId: string; amount: string; threshold: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Calculate actual spend per category for this month
  const categorySpendMap = useMemo(() => {
    const map: Record<string, number> = {};
    expenses
      .filter(e => e.date?.startsWith(currentMonthStr))
      .forEach(e => {
        map[e.categoryId] = (map[e.categoryId] || 0) + e.amount;
      });
    return map;
  }, [expenses, currentMonthStr]);

  // Combine category budget with actual spent
  const budgetComparisons = useMemo(() => {
    return categories.map(cat => {
      const budgetDoc = budgets.find(b => b.categoryId === cat.id);
      const allocated = budgetDoc?.allocatedAmount ?? (cat.monthlyBudgetLimit || 0);
      const thresholdPct = budgetDoc?.alertThresholdPct ?? 80;
      const actualSpent = categorySpendMap[cat.id] || 0;
      const variance = allocated - actualSpent;
      const percentUsed = allocated > 0 ? Math.round((actualSpent / allocated) * 100) : 0;

      let status: 'SAFE' | 'WARNING' | 'EXCEEDED' = 'SAFE';
      if (percentUsed >= 100) status = 'EXCEEDED';
      else if (percentUsed >= thresholdPct) status = 'WARNING';

      return {
        category: cat,
        allocated,
        thresholdPct,
        actualSpent,
        variance,
        percentUsed,
        status
      };
    }).sort((a, b) => b.percentUsed - a.percentUsed);
  }, [categories, budgets, categorySpendMap]);

  const totalAllocated = useMemo(() => budgetComparisons.reduce((s, b) => s + b.allocated, 0), [budgetComparisons]);
  const totalActual = useMemo(() => budgetComparisons.reduce((s, b) => s + b.actualSpent, 0), [budgetComparisons]);
  const totalRemaining = totalAllocated - totalActual;
  const overallUsedPct = totalAllocated > 0 ? Math.round((totalActual / totalAllocated) * 100) : 0;

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !editingBudget) return;
    const amt = parseFloat(editingBudget.amount);
    const thr = parseFloat(editingBudget.threshold);
    if (isNaN(amt) || amt < 0) return;

    setSaving(true);
    try {
      const catObj = categories.find(c => c.id === editingBudget.categoryId);
      const budgetId = `budget_${editingBudget.categoryId}`;
      const budgetDoc: ExpenseBudget = {
        id: budgetId,
        categoryId: editingBudget.categoryId,
        categoryName: catObj ? catObj.name : 'Category',
        period: 'Monthly',
        allocatedAmount: amt,
        alertThresholdPct: isNaN(thr) ? 80 : thr,
        createdAt: new Date().toISOString()
      };

      const docRef = doc(db, `companies/${companyId}/expense_budgets`, budgetId);
      await setDoc(docRef, budgetDoc, { merge: true });
      setEditingBudget(null);
    } catch (err) {
      console.error('Failed to save budget:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
              Target Limits & Variance
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Monthly Budget Cycle
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Expense Budgets & Guardrails
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Set department and category ceiling limits to prevent unbudgeted cost overruns
          </p>
        </div>
      </div>

      {/* Overview Ticker Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Monthly Budget Cap
          </span>
          <h4 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
            {currency} {totalAllocated.toLocaleString()}
          </h4>
          <p className="text-xs text-slate-500 mt-1">Across all categories</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Actual Spent MTD
          </span>
          <h4 className="text-2xl font-black text-blue-600 mt-1 tracking-tight">
            {currency} {totalActual.toLocaleString()}
          </h4>
          <p className="text-xs text-slate-500 mt-1">{overallUsedPct}% of budget consumed</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Remaining Available Buffer
          </span>
          <h4 className={cn(
            "text-2xl font-black mt-1 tracking-tight",
            totalRemaining >= 0 ? "text-emerald-600" : "text-rose-600"
          )}>
            {currency} {totalRemaining.toLocaleString()}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {totalRemaining >= 0 ? 'Remaining headroom' : 'Over total budget ceiling'}
          </p>
        </div>

        <div className="bg-slate-900 text-white p-5 rounded-3xl flex flex-col justify-between shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Budget Health Status
          </span>
          <div className="mt-2">
            <span className={cn(
              "px-2.5 py-1 rounded-full text-xs font-bold inline-block",
              overallUsedPct > 100 ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : overallUsedPct > 80 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            )}>
              {overallUsedPct > 100 ? '🚨 Over Budget Cap' : overallUsedPct > 80 ? '⚠️ High Utilization' : '✅ Healthy Run-Rate'}
            </span>
          </div>
        </div>
      </div>

      {/* Category Budget Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgetComparisons.map((item) => (
          <div
            key={item.category.id}
            className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-200 transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.category.color }}
                  />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                      {item.category.name}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      GL Code: {item.category.code}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setEditingBudget({
                    categoryId: item.category.id,
                    amount: item.allocated.toString(),
                    threshold: item.thresholdPct.toString()
                  })}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Adjust category budget"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">
                    Spent: <strong>{currency} {item.actualSpent.toLocaleString()}</strong>
                  </span>
                  <span className="text-slate-500 font-medium">
                    Limit: <strong>{currency} {item.allocated.toLocaleString()}</strong>
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      item.status === 'EXCEEDED' ? "bg-rose-500" : item.status === 'WARNING' ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    style={{ width: `${Math.min(100, item.percentUsed)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                item.status === 'EXCEEDED' ? "bg-rose-50 text-rose-700" : item.status === 'WARNING' ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
              )}>
                {item.percentUsed}% consumed
              </span>

              <span className="text-slate-500 text-[11px] font-medium">
                {item.variance >= 0 ? (
                  <span className="text-emerald-700 font-bold">+{currency} {item.variance.toLocaleString()} left</span>
                ) : (
                  <span className="text-rose-700 font-bold">{currency} {Math.abs(item.variance).toLocaleString()} over budget</span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Budget Modal */}
      <AnimatePresence>
        {editingBudget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-900">Set Monthly Budget Limit</h4>
                <button onClick={() => setEditingBudget(null)} className="p-2 text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBudget} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Monthly Allocation ({currency}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingBudget.amount}
                    onChange={(e) => setEditingBudget({ ...editingBudget, amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Warning Alert Threshold (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editingBudget.threshold}
                    onChange={(e) => setEditingBudget({ ...editingBudget, threshold: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Triggers amber warning when spend exceeds this %.</p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingBudget(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Budget'}
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
