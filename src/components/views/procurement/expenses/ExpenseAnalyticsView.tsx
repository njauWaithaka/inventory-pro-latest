import React, { useMemo } from 'react';
import { 
  BarChart3, PieChart as PieIcon, TrendingDown, TrendingUp, 
  Sparkles, DollarSign, ArrowUpRight, ArrowDownRight, 
  Layers, CreditCard, Building2, ShieldAlert, Award
} from 'lucide-react';
import { Expense, ExpenseCategory } from '../../../../types';
import { formatCompactNumber, cn } from '../../../../lib/utils';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, 
  PieChart, Pie, Cell, Tooltip, XAxis, YAxis, Legend 
} from 'recharts';

interface ExpenseAnalyticsViewProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  companyId: string;
  currency: string;
}

export function ExpenseAnalyticsView({
  expenses,
  categories,
  companyId,
  currency
}: ExpenseAnalyticsViewProps) {
  const now = new Date();

  // 1. Monthly 6-month burn trend
  const monthlyTrend = useMemo(() => {
    const data: { month: string; spend: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
      
      const monthExpenses = expenses.filter(e => e.date?.startsWith(key));
      const spend = monthExpenses.reduce((s, e) => s + e.amount, 0);
      data.push({ month: monthLabel, spend, count: monthExpenses.length });
    }
    return data;
  }, [expenses]);

  // 2. Department spend breakdown
  const departmentSpend = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      const dept = e.department || 'Operations';
      map[dept] = (map[dept] || 0) + e.amount;
    });

    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  // 3. Category donut data
  const categorySpend = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};

    categories.forEach(c => {
      map[c.id] = { name: c.name, value: 0, color: c.color || '#3B82F6' };
    });

    expenses.forEach(e => {
      if (map[e.categoryId]) {
        map[e.categoryId].value += e.amount;
      } else {
        map[e.categoryId] = {
          name: e.categoryName || 'Other',
          value: e.amount,
          color: '#94A3B8'
        };
      }
    });

    return Object.values(map)
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [expenses, categories]);

  // 4. Payment Method breakdown
  const paymentMethodSpend = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      const method = e.paymentMethod || 'Other';
      map[method] = (map[method] || 0) + e.amount;
    });

    return Object.entries(map)
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  // 5. Top 5 Vendors Pareto
  const topVendors = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      const vendor = e.vendorName?.trim() || 'Direct Expense';
      map[vendor] = (map[vendor] || 0) + e.amount;
    });

    const sorted = Object.entries(map)
      .map(([vendor, total]) => ({ vendor, total }))
      .sort((a, b) => b.total - a.total);

    const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

    return sorted.slice(0, 5).map(v => ({
      ...v,
      percentage: grandTotal > 0 ? Math.round((v.total / grandTotal) * 100) : 0
    }));
  }, [expenses]);

  const totalAllTimeSpend = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const avgExpensePerDay = useMemo(() => {
    return expenses.length > 0 ? Math.round(totalAllTimeSpend / 30) : 0;
  }, [totalAllTimeSpend, expenses]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
              Cost Intelligence & Benchmarks
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Multi-dimensional Analytics
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Expense Analytics & Cost Control
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Identify operational inefficiencies, track burn rates, and discover cost-saving opportunities
          </p>
        </div>
      </div>

      {/* AI Cost Optimization Insights */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <h4 className="text-sm font-bold uppercase tracking-wider text-blue-200">
            Intelligent Cost Optimization Recommendations
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/10">
            <h5 className="font-bold text-white mb-1">Payment Method Consolidation</h5>
            <p className="text-slate-300 leading-relaxed">
              M-Pesa and Cash payments account for a substantial volume of small vouchers. Consolidating small disbursements into weekly petty cash floats reduces transaction fees by up to ~12%.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/10">
            <h5 className="font-bold text-white mb-1">Top Vendor Volume Negotiation</h5>
            <p className="text-slate-300 leading-relaxed">
              Your top 3 vendors account for <strong>{topVendors.slice(0, 3).reduce((s, v) => s + v.percentage, 0)}%</strong> of total supplier outflows. Inquire about volume discount terms or 30-day early settlement rebates.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/10">
            <h5 className="font-bold text-white mb-1">Input VAT Recovery Potential</h5>
            <p className="text-slate-300 leading-relaxed">
              Ensure all receipts from major suppliers include valid ETR / PIN receipts to claim full 16% input VAT credits on your monthly corporate tax returns.
            </p>
          </div>
        </div>
      </div>

      {/* Charts Grid: Monthly Trend & Department Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
                6-Month Expenditure Run-Rate
              </h4>
              <p className="text-xs text-slate-400 font-medium">
                Monthly total cash outflow progression
              </p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
              Historical
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsSpendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${formatCompactNumber(v)}`} />
                <Tooltip 
                  formatter={(val: any) => [`${currency} ${Number(val).toLocaleString()}`, 'Total Outflow']}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#fff', border: 'none', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="spend" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#analyticsSpendGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
                Spend by Department
              </h4>
              <p className="text-xs text-slate-400 font-medium">
                Operational resource allocation across company units
              </p>
            </div>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentSpend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${formatCompactNumber(v)}`} />
                <Tooltip 
                  formatter={(val: any) => [`${currency} ${Number(val).toLocaleString()}`, 'Department Spend']}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#fff', border: 'none', fontSize: '12px' }}
                />
                <Bar dataKey="amount" fill="#6366F1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Category Donut & Top Vendors Pareto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Share */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
                Category Distribution
              </h4>
              <p className="text-xs text-slate-400 font-medium">
                Relative share of operational expenditures
              </p>
            </div>
            <PieIcon className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categorySpend}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categorySpend.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: any) => [`${currency} ${Number(val).toLocaleString()}`, 'Total Spend']}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#fff', border: 'none', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-slate-100">
            {categorySpend.slice(0, 4).map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="font-semibold text-slate-700 truncate">{c.name}</span>
                </div>
                <span className="font-bold text-slate-900 shrink-0">{currency} {formatCompactNumber(c.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Vendors Pareto */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
                Top 5 Supplier & Vendor Outflows
              </h4>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xs text-slate-400 font-medium mb-4">
              Largest recipients of corporate disbursements
            </p>

            <div className="space-y-3">
              {topVendors.map((v, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 truncate max-w-[200px]">
                      {idx + 1}. {v.vendor}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{v.percentage}% of spend</span>
                      <span className="font-black text-slate-900">{currency} {v.total.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full"
                      style={{ width: `${v.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Total All-Time Recorded Expenses: <strong className="text-slate-900 font-bold">{currency} {totalAllTimeSpend.toLocaleString()}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
