import React, { useMemo } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Clock, 
  AlertCircle, CheckCircle2, Wallet, Plus, 
  ArrowUpRight, ArrowDownRight, Sparkles, Receipt,
  PieChart as PieChartIcon, Calendar, ArrowRight,
  CreditCard, ShieldAlert, BarChart3
} from 'lucide-react';
import { 
  Expense, ExpenseCategory, ExpenseBudget, 
  PettyCashFloat, ViewType 
} from '../../../../types';
import { cn, formatCompactNumber } from '../../../../lib/utils';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { motion } from 'motion/react';

interface ExpenseDashboardProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  budgets: ExpenseBudget[];
  pettyCashFloat: PettyCashFloat;
  currency: string;
  onNavigateTab: (tab: string) => void;
  onOpenRecordModal: () => void;
  onOpenPettyCashModal: () => void;
}

export function ExpenseDashboard({
  expenses,
  categories,
  budgets,
  pettyCashFloat,
  currency,
  onNavigateTab,
  onOpenRecordModal,
  onOpenPettyCashModal
}: ExpenseDashboardProps) {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Calculate Key Metrics
  const metrics = useMemo(() => {
    const thisMonthExpenses = expenses.filter(e => e.date?.startsWith(currentMonthStr));
    const totalMonthSpent = thisMonthExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthExpenses = expenses.filter(e => e.date?.startsWith(prevMonthStr));
    const totalPrevMonthSpent = prevMonthExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

    const monthOverMonthChange = totalPrevMonthSpent > 0 
      ? Math.round(((totalMonthSpent - totalPrevMonthSpent) / totalPrevMonthSpent) * 100)
      : 0;

    const pendingExpenses = expenses.filter(e => e.status === 'PENDING');
    const pendingTotal = pendingExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

    const payables = expenses.filter(e => e.status === 'PAYABLE');
    const payablesTotal = payables.reduce((acc, e) => acc + (e.amount || 0), 0);

    const todayStr = now.toISOString().split('T')[0];
    const overduePayables = payables.filter(e => e.dueDate && e.dueDate < todayStr);
    const overdueTotal = overduePayables.reduce((acc, e) => acc + (e.amount || 0), 0);

    const totalAllocatedBudget = budgets.reduce((acc, b) => acc + (b.allocatedAmount || 0), 0);
    const budgetUtilizationPct = totalAllocatedBudget > 0 
      ? Math.min(100, Math.round((totalMonthSpent / totalAllocatedBudget) * 100))
      : 0;

    return {
      totalMonthSpent,
      totalPrevMonthSpent,
      monthOverMonthChange,
      pendingCount: pendingExpenses.length,
      pendingTotal,
      payablesCount: payables.length,
      payablesTotal,
      overdueCount: overduePayables.length,
      overdueTotal,
      totalAllocatedBudget,
      budgetUtilizationPct
    };
  }, [expenses, budgets, currentMonthStr]);

  // Category breakdown for Donut Chart
  const categorySpendData = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    
    categories.forEach(cat => {
      map[cat.id] = { name: cat.name, value: 0, color: cat.color || '#3B82F6' };
    });

    expenses.forEach(exp => {
      if (map[exp.categoryId]) {
        map[exp.categoryId].value += exp.amount;
      } else {
        map[exp.categoryId] = {
          name: exp.categoryName || 'Other',
          value: exp.amount,
          color: '#94A3B8'
        };
      }
    });

    return Object.values(map)
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [expenses, categories]);

  // Monthly trend for Area Chart (last 6 months)
  const monthlyTrendData = useMemo(() => {
    const months: { label: string; key: string; spend: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      months.push({ label, key, spend: 0 });
    }

    expenses.forEach(exp => {
      const expMonth = exp.date?.substring(0, 7);
      const target = months.find(m => m.key === expMonth);
      if (target) {
        target.spend += exp.amount;
      }
    });

    return months;
  }, [expenses]);

  // Recent 6 transactions
  const recentTransactions = useMemo(() => {
    return [...expenses]
      .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
      .slice(0, 6);
  }, [expenses]);

  // Smart AI Insights generator
  const smartInsights = useMemo(() => {
    const list: { title: string; desc: string; type: 'warning' | 'positive' | 'info' }[] = [];

    if (metrics.overdueCount > 0) {
      list.push({
        title: `${metrics.overdueCount} Overdue Vendor Bills`,
        desc: `You have ${currency} ${metrics.overdueTotal.toLocaleString()} in overdue payables requiring immediate settlement to avoid supplier service disruption.`,
        type: 'warning'
      });
    }

    if (categorySpendData.length > 0) {
      const topCat = categorySpendData[0];
      const topCatPct = metrics.totalMonthSpent > 0 
        ? Math.round((topCat.value / metrics.totalMonthSpent) * 100) 
        : 0;
      list.push({
        title: `Primary Cost Driver: ${topCat.name}`,
        desc: `${topCat.name} accounts for ${currency} ${topCat.value.toLocaleString()} (${topCatPct}% of total expenditure).`,
        type: 'info'
      });
    }

    if (pettyCashFloat.currentBalance <= (pettyCashFloat.minimumThreshold || 3000)) {
      list.push({
        title: 'Petty Cash Float Running Low',
        desc: `Current float balance is ${currency} ${pettyCashFloat.currentBalance.toLocaleString()} (below ${currency} ${pettyCashFloat.minimumThreshold.toLocaleString()} threshold). Top up to maintain uninterrupted shop operations.`,
        type: 'warning'
      });
    } else {
      list.push({
        title: 'Healthy Petty Cash Reserves',
        desc: `Shop cash drawer is funded at ${currency} ${pettyCashFloat.currentBalance.toLocaleString()} (${Math.round((pettyCashFloat.currentBalance / (pettyCashFloat.targetFloat || 10000)) * 100)}% of target float).`,
        type: 'positive'
      });
    }

    return list;
  }, [metrics, categorySpendData, pettyCashFloat, currency]);

  return (
    <div className="space-y-6">
      {/* Top Action & Greeting Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
              Financial Intelligence
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Expenses & Cash Outflow Control
          </h3>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onOpenPettyCashModal}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-2 shadow-2xs"
          >
            <Wallet className="w-4 h-4 text-emerald-600" />
            Top-up Petty Cash
          </button>
          <button
            onClick={onOpenRecordModal}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Monthly Spend */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between transition-all hover:border-blue-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Month-to-Date Spend
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">
              {currency} {metrics.totalMonthSpent.toLocaleString()}
            </h4>
            <div className="flex items-center gap-1.5 mt-1">
              {metrics.monthOverMonthChange > 0 ? (
                <span className="text-[11px] font-bold text-rose-600 flex items-center">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +{metrics.monthOverMonthChange}%
                </span>
              ) : metrics.monthOverMonthChange < 0 ? (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center">
                  <ArrowDownRight className="w-3.5 h-3.5" /> {metrics.monthOverMonthChange}%
                </span>
              ) : (
                <span className="text-[11px] font-bold text-slate-400">0%</span>
              )}
              <span className="text-[11px] text-slate-400 font-medium">vs last month</span>
            </div>
          </div>
        </div>

        {/* Card 2: Payables Outstanding */}
        <div 
          onClick={() => onNavigateTab('payables')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:border-amber-300 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-600 transition-colors">
              Accounts Payable (Unpaid)
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">
              {currency} {metrics.payablesTotal.toLocaleString()}
            </h4>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-slate-500 font-medium">
                {metrics.payablesCount} pending bills
              </span>
              {metrics.overdueCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                  {metrics.overdueCount} Overdue
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Pending Approvals */}
        <div 
          onClick={() => onNavigateTab('pending')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:border-purple-300 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-purple-600 transition-colors">
              Pending Approvals
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.pendingCount} <span className="text-sm font-bold text-slate-400">Claims</span>
            </h4>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Valued at {currency} {metrics.pendingTotal.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Card 4: Petty Cash Float */}
        <div 
          onClick={() => onNavigateTab('petty_cash')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:border-emerald-300 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
              Petty Cash Float
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">
              {currency} {(pettyCashFloat.currentBalance || 0).toLocaleString()}
            </h4>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-slate-500 font-medium">
                Target: {currency} {(pettyCashFloat.targetFloat || 10000).toLocaleString()}
              </span>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                pettyCashFloat.currentBalance < (pettyCashFloat.minimumThreshold || 3000)
                  ? "bg-rose-50 text-rose-600"
                  : "bg-emerald-50 text-emerald-600"
              )}>
                {pettyCashFloat.currentBalance < (pettyCashFloat.minimumThreshold || 3000) ? 'Low Float' : 'Funded'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Business Insights Strip */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-5 text-white shadow-md">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
            Intelligent Spend Insights & Action Items
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {smartInsights.map((insight, idx) => (
            <div 
              key={idx} 
              className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  {insight.type === 'warning' ? (
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : insight.type === 'positive' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                  )}
                  <h5 className="text-xs font-bold text-white">{insight.title}</h5>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {insight.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Row: Monthly Trend & Category Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Area Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
                Expenditure Velocity & Trend
              </h4>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Historical monthly operational expense burn rate
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('analytics')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Full Analytics <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${formatCompactNumber(v)}`} />
                <Tooltip 
                  formatter={(value: any) => [`${currency} ${Number(value).toLocaleString()}`, 'Expenditure']}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#fff', border: 'none', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="spend" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#spendGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Donut (1 col) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
                Spend by Category
              </h4>
              <button
                onClick={() => onNavigateTab('categories')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                Manage
              </button>
            </div>
            <p className="text-xs text-slate-400 font-medium mb-4">
              Top operational cost allocations
            </p>

            <div className="h-44 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySpendData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categorySpendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${currency} ${Number(value).toLocaleString()}`, 'Amount']}
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#fff', border: 'none', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 mt-2 pt-3 border-t border-slate-100">
            {categorySpendData.slice(0, 3).map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="font-semibold text-slate-700 truncate max-w-[130px]">{cat.name}</span>
                </div>
                <span className="font-bold text-slate-900">
                  {currency} {cat.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions Register & Quick Navigation */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
              Recent Expense Records
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Live ledger of recorded receipts, disbursements, and vendor bills
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('transactions')}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto flex items-center gap-1.5"
          >
            View All Transactions ({expenses.length}) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No expenses recorded yet. Click "+ Record Expense" to log your first business transaction.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 font-bold">Voucher #</th>
                  <th className="pb-3 font-bold">Date</th>
                  <th className="pb-3 font-bold">Description</th>
                  <th className="pb-3 font-bold">Category</th>
                  <th className="pb-3 font-bold">Method</th>
                  <th className="pb-3 font-bold">Status</th>
                  <th className="pb-3 font-bold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentTransactions.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 font-mono font-bold text-slate-800">
                      {exp.expenseNumber}
                    </td>
                    <td className="py-3 text-slate-500 font-medium">
                      {exp.date}
                    </td>
                    <td className="py-3 font-bold text-slate-900 max-w-[200px] truncate">
                      {exp.title}
                      {exp.vendorName && (
                        <span className="block text-[10px] font-medium text-slate-400 truncate">
                          Payee: {exp.vendorName}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {exp.categoryName}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 font-medium">
                      {exp.paymentMethod}
                    </td>
                    <td className="py-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide",
                        exp.status === 'PAID' && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                        exp.status === 'PAYABLE' && "bg-amber-50 text-amber-700 border border-amber-200",
                        exp.status === 'PENDING' && "bg-purple-50 text-purple-700 border border-purple-200",
                        exp.status === 'APPROVED' && "bg-blue-50 text-blue-700 border border-blue-200",
                        exp.status === 'REJECTED' && "bg-rose-50 text-rose-700 border border-rose-200"
                      )}>
                        {exp.status}
                      </span>
                    </td>
                    <td className="py-3 text-right font-black text-slate-900">
                      {currency} {exp.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
