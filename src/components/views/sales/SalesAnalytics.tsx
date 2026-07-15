import React, { useState, useEffect } from 'react';
import { 
  FileText, TrendingUp, BarChart3, Clock, 
  ArrowRightLeft, Percent, DollarSign, 
  ChevronDown, Calendar, RefreshCcw, Download,
  CheckCircle2, XCircle, AlertCircle, ShoppingCart
} from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { motion } from 'motion/react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

export function SalesAnalytics() {
  const { profile, currency } = useSettings();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) return;

    const qryQuotations = query(collection(db, `companies/${profile.companyId}/quotations`));
    const unsubQuotations = onSnapshot(qryQuotations, (snapshot) => {
      setQuotations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qryInvoices = query(collection(db, `companies/${profile.companyId}/invoices`));
    const unsubInvoices = onSnapshot(qryInvoices, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubQuotations();
      unsubInvoices();
    };
  }, [profile?.companyId]);

  // Quotation Metrics
  const totalQuotations = quotations.length;
  const acceptedQuotations = quotations.filter(q => q.status === 'accepted' || q.status === 'converted').length;
  const rejectedQuotations = quotations.filter(q => q.status === 'rejected').length;
  const expiredQuotations = quotations.filter(q => q.status === 'expired').length;
  const draftQuotations = quotations.filter(q => q.status === 'draft').length;
  const sentQuotations = quotations.filter(q => q.status === 'sent').length;

  // Conversion Metrics
  const convertedToInvoice = quotations.filter(q => q.convertedTo?.startsWith('INV-')).length;
  const convertedToProforma = quotations.filter(q => q.convertedTo?.startsWith('PRO-')).length;
  const totalConverted = quotations.filter(q => q.status === 'converted').length;
  const conversionRate = totalQuotations > 0 ? (totalConverted / totalQuotations) * 100 : 0;

  // Sales Impact
  const revenueFromQuotes = invoices
    .filter(inv => inv.referenceQuotation)
    .reduce((acc, inv) => acc + (inv.amount || 0), 0);

  // Proforma Metrics
  const proformaInvoices = invoices.filter(inv => inv.type === 'proforma');
  const totalProforma = proformaInvoices.length;
  const convertedProforma = proformaInvoices.filter(inv => inv.isConverted).length;
  const proformaConversionRate = totalProforma > 0 ? (convertedProforma / totalProforma) * 100 : 0;

  const quoteStatusData = [
    { name: 'Draft', value: draftQuotations, color: '#94a3b8' },
    { name: 'Sent', value: sentQuotations, color: '#3b82f6' },
    { name: 'Accepted', value: acceptedQuotations, color: '#10b981' },
    { name: 'Rejected', value: rejectedQuotations, color: '#f43f5e' },
    { name: 'Expired', value: expiredQuotations, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const conversionFunnel = [
    { name: 'Quotations', value: totalQuotations },
    { name: 'Accepted', value: acceptedQuotations },
    { name: 'Invoiced', value: convertedToInvoice },
  ];

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const stats = [
    { label: 'Conversion Rate', value: `${conversionRate.toFixed(1)}%`, sub: 'Quotes to Sales', icon: Percent, color: 'blue' },
    { label: 'Quote Revenue', value: `${currency}${revenueFromQuotes.toLocaleString()}`, sub: 'From converted quotes', icon: DollarSign, color: 'emerald' },
    { label: 'Proforma Conv.', value: `${proformaConversionRate.toFixed(1)}%`, sub: 'Paid Proformas', icon: ArrowRightLeft, color: 'indigo' },
    { label: 'Open Quotes', value: (totalQuotations - totalConverted).toString(), sub: 'Awaiting action', icon: BarChart3, color: 'amber' },
  ];

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-500">
      {/* Mini Stats */}
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
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
              <h4 className="text-xl font-black text-slate-900 leading-none">{stat.value}</h4>
              <p className="text-[9px] font-medium text-slate-500 mt-1">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
        {/* Conversion Funnel */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Sales Pipeline Funnel</h3>
            <p className="text-xs font-semibold text-slate-500 mt-1">Quotations conversion stage distribution</p>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conversionFunnel} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={40}>
                   {conversionFunnel.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                   ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quotation Status Distribution */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Quote Status</h3>
            <p className="text-xs font-semibold text-slate-500 mt-1">Distribution of all prepared quotes</p>
          </div>
          <div className="h-[240px] w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={quoteStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {quoteStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900">{totalQuotations}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {quoteStatusData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] font-bold text-slate-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Breakdowns */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-slate-900 p-6 rounded-3xl text-white relative overflow-hidden group">
              <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                       <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-blue-400">Conversion Split</span>
                 </div>
                 <div className="space-y-4">
                    <div>
                       <div className="flex justify-between text-[11px] font-bold mb-1">
                          <span>To Tax Invoice</span>
                          <span>{convertedToInvoice}</span>
                       </div>
                       <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${totalConverted > 0 ? (convertedToInvoice/totalConverted)*100 : 0}%` }} />
                       </div>
                    </div>
                    <div>
                       <div className="flex justify-between text-[11px] font-bold mb-1">
                          <span>To Proforma</span>
                          <span>{convertedToProforma}</span>
                       </div>
                       <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${totalConverted > 0 ? (convertedToProforma/totalConverted)*100 : 0}%` }} />
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-500" />
                 </div>
                 <span className="text-xs font-black uppercase tracking-widest text-amber-500">Proforma Performance</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Created</p>
                    <p className="text-2xl font-black text-slate-900">{totalProforma}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Conversion Rate</p>
                    <p className="text-2xl font-black text-emerald-500">{proformaConversionRate.toFixed(1)}%</p>
                 </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-50">
                 <p className="text-[11px] font-medium text-slate-500">Conversion represents proformas that were turned into taxable sales units.</p>
              </div>
           </div>

           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                 </div>
                 <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Accepted Quotes</span>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-end">
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Accepted Count</p>
                       <p className="text-3xl font-black text-slate-900">{acceptedQuotations}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Impact Value</p>
                       <p className="text-xl font-black text-emerald-500">{currency}{revenueFromQuotes >= 1000 ? `${(revenueFromQuotes/1000).toFixed(1)}k` : revenueFromQuotes}</p>
                    </div>
                 </div>
                 <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${conversionRate}%` }} />
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
