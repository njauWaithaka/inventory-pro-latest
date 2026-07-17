import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, BarChart3, Clock, 
  ArrowRightLeft, Percent, DollarSign, 
  Calendar, RefreshCcw, Download,
  CheckCircle2, XCircle, AlertCircle, ShoppingCart, User, FileText
} from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { motion } from 'motion/react';

const COLORS = ['#10b981', '#3b82f6', '#f43f5e', '#f59e0b', '#8b5cf6'];

export function SalesAnalytics() {
  const { profile, currency } = useSettings();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) return;

    const qryInvoices = query(
      collection(db, `companies/${profile.companyId}/invoices`)
    );
    
    const unsubInvoices = onSnapshot(qryInvoices, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error loading invoices for Sales Analytics:", error);
      setLoading(false);
    });

    return () => unsubInvoices();
  }, [profile?.companyId]);

  // Filter to standard sales invoices (not proformas)
  const salesInvoices = useMemo(() => {
    return invoices.filter(inv => inv.type === 'standard');
  }, [invoices]);

  // Sales Metrics Calculations
  const totalInvoices = salesInvoices.length;
  
  const totalRevenue = useMemo(() => {
    return salesInvoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);
  }, [salesInvoices]);

  const paidRevenue = useMemo(() => {
    return salesInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((acc, inv) => acc + (inv.amount || 0), 0);
  }, [salesInvoices]);

  const pendingRevenue = useMemo(() => {
    return salesInvoices
      .filter(inv => inv.status === 'pending')
      .reduce((acc, inv) => acc + (inv.amount || 0), 0);
  }, [salesInvoices]);

  const overdueRevenue = useMemo(() => {
    return salesInvoices
      .filter(inv => inv.status === 'overdue')
      .reduce((acc, inv) => acc + (inv.amount || 0), 0);
  }, [salesInvoices]);

  const outstandingRevenue = pendingRevenue + overdueRevenue;

  const averageInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
  
  // Collection rate based on paid amount vs total standard sales amount
  const collectionRate = totalRevenue > 0 ? (paidRevenue / totalRevenue) * 100 : 0;

  // Invoice Status Distribution Data
  const statusData = useMemo(() => {
    const paidCount = salesInvoices.filter(inv => inv.status === 'paid').length;
    const pendingCount = salesInvoices.filter(inv => inv.status === 'pending').length;
    const overdueCount = salesInvoices.filter(inv => inv.status === 'overdue').length;
    const draftCount = salesInvoices.filter(inv => inv.status === 'draft').length;

    return [
      { name: 'Paid', value: paidCount, color: '#10b981' },
      { name: 'Pending', value: pendingCount, color: '#3b82f6' },
      { name: 'Overdue', value: overdueCount, color: '#f43f5e' },
      { name: 'Draft', value: draftCount, color: '#94a3b8' },
    ].filter(d => d.value > 0);
  }, [salesInvoices]);

  // Sales Trend Data grouped by Date
  const salesTrendData = useMemo(() => {
    const revenueByDate: { [key: string]: number } = {};
    
    // Initialize last 7 days with 0s to make sure we have some trend even with sparse data
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      revenueByDate[dateStr] = 0;
    }

    salesInvoices.forEach(inv => {
      if (inv.date) {
        revenueByDate[inv.date] = (revenueByDate[inv.date] || 0) + (inv.amount || 0);
      }
    });

    return Object.keys(revenueByDate)
      .sort()
      .map(date => {
        // Format date from YYYY-MM-DD to simple DD MMM
        const parts = date.split('-');
        let formattedLabel = date;
        if (parts.length === 3) {
          const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          if (!isNaN(dObj.getTime())) {
            formattedLabel = dObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
          }
        }
        return {
          date: formattedLabel,
          Revenue: revenueByDate[date],
        };
      });
  }, [salesInvoices]);

  // Top Selling Products processed from invoice items
  const topProducts = useMemo(() => {
    const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
    
    salesInvoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach((item: any) => {
          const key = item.productId || item.name;
          if (!key) return;
          if (!productSales[key]) {
            productSales[key] = { name: item.name || 'Unknown Product', quantity: 0, revenue: 0 };
          }
          productSales[key].quantity += (item.quantity || 0);
          productSales[key].revenue += ((item.quantity || 0) * (item.price || 0));
        });
      }
    });

    return Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [salesInvoices]);

  // Top Customers processed from invoices
  const topCustomers = useMemo(() => {
    const customerPurchases: { [key: string]: { name: string; count: number; total: number } } = {};

    salesInvoices.forEach(inv => {
      if (inv.customer) {
        if (!customerPurchases[inv.customer]) {
          customerPurchases[inv.customer] = { name: inv.customer, count: 0, total: 0 };
        }
        customerPurchases[inv.customer].count += 1;
        customerPurchases[inv.customer].total += (inv.amount || 0);
      }
    });

    return Object.values(customerPurchases)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [salesInvoices]);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const maxProductRevenue = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.revenue)) : 1;
  const maxCustomerRevenue = topCustomers.length > 0 ? Math.max(...topCustomers.map(c => c.total)) : 1;

  const stats = [
    { label: 'Total Revenue', value: `${currency}${totalRevenue.toLocaleString()}`, sub: 'All standard sales invoices', icon: DollarSign, color: 'blue' },
    { label: 'Collection Rate', value: `${collectionRate.toFixed(1)}%`, sub: 'Paid / Total Sales ratio', icon: Percent, color: 'emerald' },
    { label: 'Avg Invoice Value', value: `${currency}${Math.round(averageInvoiceValue).toLocaleString()}`, sub: 'Average transaction size', icon: TrendingUp, color: 'indigo' },
    { label: 'Outstanding Sales', value: `${currency}${outstandingRevenue.toLocaleString()}`, sub: 'Pending & Overdue invoices', icon: Clock, color: 'amber' },
  ];

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-500">
      {/* Top Sales Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", 
              stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
              stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
              stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
              "bg-amber-50 text-amber-600"
            )}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1 truncate">{stat.label}</p>
              <h4 className="text-xl font-black text-slate-900 leading-none truncate">{stat.value}</h4>
              <p className="text-[9px] font-medium text-slate-500 mt-1 truncate">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
        {/* Sales Revenue Trend */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Sales Revenue Trend</h3>
            <p className="text-xs font-semibold text-slate-500 mt-1">Daily sales invoicing activity and trend</p>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrendData} margin={{ left: 10, right: 10, top: 10 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                  tickFormatter={(value) => `${currency}${formatCompactNumber(value, '')}`}
                />
                <Tooltip 
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${currency}${value.toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invoice Payment Status */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Invoice Statuses</h3>
            <p className="text-xs font-semibold text-slate-500 mt-1">Status distribution of sales invoices</p>
          </div>
          <div className="h-[240px] w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData.length > 0 ? statusData : [{ name: 'No Sales', value: 1, color: '#e2e8f0' }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  {statusData.length === 0 && <Cell fill="#e2e8f0" />}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900">{totalInvoices}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Invoices</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {statusData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] font-bold text-slate-600">{item.name}: {item.value}</span>
              </div>
            ))}
            {statusData.length === 0 && (
              <div className="col-span-2 text-center text-[10px] font-bold text-slate-400">
                No active sales invoices
              </div>
            )}
          </div>
        </div>

        {/* Detailed Breakdowns */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Top Customers Card */}
           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group text-left">
              <div className="flex items-center gap-3 mb-5">
                 <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-500" />
                 </div>
                 <span className="text-xs font-black uppercase tracking-widest text-slate-700">Top Customers</span>
              </div>
              <div className="space-y-4">
                 {topCustomers.map((cust, i) => (
                    <div key={i}>
                       <div className="flex justify-between text-[11px] font-bold mb-1">
                          <span className="truncate max-w-[150px]">{cust.name}</span>
                          <span className="font-black">{currency}{cust.total.toLocaleString()}</span>
                       </div>
                       <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(cust.total / maxCustomerRevenue) * 100}%` }} />
                       </div>
                    </div>
                 ))}
                 {topCustomers.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-400">
                       No customer transaction data
                    </div>
                 )}
              </div>
           </div>

           {/* Top Selling Products Card */}
           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group text-left">
              <div className="flex items-center gap-3 mb-5">
                 <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-emerald-500" />
                 </div>
                 <span className="text-xs font-black uppercase tracking-widest text-slate-700">Top Selling Products</span>
              </div>
              <div className="space-y-4">
                 {topProducts.map((prod, i) => (
                    <div key={i}>
                       <div className="flex justify-between text-[11px] font-bold mb-1">
                          <span className="truncate max-w-[150px]">{prod.name}</span>
                          <span className="font-black">{currency}{prod.revenue.toLocaleString()}</span>
                       </div>
                       <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(prod.revenue / maxProductRevenue) * 100}%` }} />
                       </div>
                    </div>
                 ))}
                 {topProducts.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-400">
                       No products sold yet
                    </div>
                 )}
              </div>
           </div>

           {/* Sales Value Breakdown Split */}
           <div className="bg-slate-900 p-6 rounded-3xl text-white relative overflow-hidden group text-left">
              <div className="flex items-center gap-3 mb-5">
                 <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                 </div>
                 <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Revenue Split</span>
              </div>
              <div className="space-y-4">
                 <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                       <span>Paid Revenue</span>
                       <span>{currency}{paidRevenue.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-400" style={{ width: `${totalRevenue > 0 ? (paidRevenue/totalRevenue)*100 : 0}%` }} />
                    </div>
                 </div>
                 <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                       <span>Outstanding Revenue</span>
                       <span>{currency}{outstandingRevenue.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-amber-400" style={{ width: `${totalRevenue > 0 ? (outstandingRevenue/totalRevenue)*100 : 0}%` }} />
                    </div>
                 </div>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 text-[9px] text-slate-400 font-medium leading-relaxed">
                 Manage collections effectively to reduce the outstanding revenue margin.
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

