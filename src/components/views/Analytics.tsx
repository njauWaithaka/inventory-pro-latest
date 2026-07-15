import React, { useState, useEffect, useMemo } from 'react';

import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, ScatterChart, Scatter, ZAxis, Legend
} from 'recharts';
import { cn, formatCompactNumber, getSellThroughRate, getProductMovementSpeed } from '../../lib/utils';
import { 
  TrendingUp, DollarSign, Package, BarChart3, Calendar, RotateCcw, FileDown, 
  Activity, MousePointer2, Clock, Ban, ChevronDown, CheckCircle2, ShieldCheck, 
  AlertTriangle, RefreshCw, Sparkles, HelpCircle, ArrowRight, UserCheck, Inbox,
  CornerDownRight, Database, ListFilter, AlertCircle
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, doc, setDoc, updateDoc, getDocs, writeBatch, Timestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { motion } from 'motion/react';

const COLORS = ['#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#64748b'];

export function Analytics() {
  const { user } = useAuth();
  const { profile, company, currency } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) return;
    const q = collection(db, `companies/${profile.companyId}/products`);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          movement: getProductMovementSpeed(data)
        };
      }));
      setLoading(false);
    }, (error) => {
      console.error("Query error in Analytics:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, [profile?.companyId]);

  // Dynamic Metrics Calculation
  const allProducts = [...products];
  
  const totalCapital = allProducts.reduce((sum, p) => sum + (p.value * p.quantity), 0);
  const totalSKUs = allProducts.length;

  const totalUnitsSold = allProducts.reduce((sum, p) => sum + (p.unitsSold || 0), 0);
  const totalUnitsReceived = allProducts.reduce((sum, p) => {
    const received = typeof p.unitsReceived === 'number' && p.unitsReceived > 0
      ? p.unitsReceived 
      : p.quantity + (p.unitsSold || 0);
    return sum + received;
  }, 0);
  const averageSTR = totalUnitsReceived > 0 ? (totalUnitsSold / totalUnitsReceived) * 100 : 0;
  
  const turnoverRatioData = useMemo(() => {
    let totalSold = 0;
    let totalStock = 0;
    products.forEach(p => {
      totalSold += parseFloat(p.unitsSold || 0);
      totalStock += parseFloat(p.quantity || 0);
    });
    const ratio = totalStock > 0 ? (totalSold / totalStock) * 3 : 3.5;
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m, idx) => {
      const variation = Math.sin(idx) * 0.4;
      return {
        name: m,
        turnover: Math.max(0.5, parseFloat((ratio + variation).toFixed(1)))
      };
    });
  }, [products]);
  
  const categoryStats = allProducts.reduce((acc: any[], p) => {
    const existing = acc.find(c => c.name === p.category);
    const val = p.value * p.quantity;
    if (existing) {
      existing.value += val;
    } else {
      acc.push({ 
        id: acc.length + 1, 
        name: p.category, 
        value: val, 
        color: COLORS[acc.length % COLORS.length] 
      });
    }
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  const movementDataMap = allProducts.reduce((acc, p) => {
    let key = p.movement || 'slow';
    
    if (!acc[key]) acc[key] = { value: 0, items: 0 };
    acc[key].value += p.value * p.quantity;
    acc[key].items += p.quantity; // Summing quantities as requested
    return acc;
  }, {} as any);

  const MOVEMENT_DATA = [
    { name: 'Fast Moving', key: 'fast', color: 'bg-blue-500', icon: TrendingUp, desc: 'High demand, maintain stock' },
    { name: 'Moderate', key: 'moderate', color: 'bg-emerald-500', icon: Activity, desc: 'Steady sales, monitor trends' },
    { name: 'Slow Moving', key: 'slow', color: 'bg-amber-500', icon: Clock, desc: 'Consider discounts' },
    { name: 'Obsolete', key: 'obsolete', color: 'bg-rose-500', icon: Ban, desc: 'Liquidate or clear' },
  ].map(m => {
    const data = movementDataMap[m.key] || { value: 0, items: 0 };
    return {
      ...m,
      value: data.value,
      items: data.items,
      percentage: totalCapital > 0 ? Math.round((data.value / totalCapital) * 100) : 0
    };
  });

  // ABC Analysis (70/20/10 rule simulation based on value density)
  const sortedByValue = [...allProducts].sort((a, b) => (b.value * b.quantity) - (a.value * a.quantity));
  
  // Scatter Data: Price vs Quantity
  const scatterData = allProducts.map(p => ({
    name: p.name,
    quantity: p.quantity,
    price: p.value,
    totalValue: p.value * p.quantity,
    category: p.category
  })).slice(0, 50); // Top 50 to avoid clutter

  let cumulativeValue = 0;
  const abcAnalysis = [
    { class: 'A', limit: 0.7, items: [] as any[], val: 0, color: 'bg-emerald-500', desc: 'High-value items requiring tight control.' },
    { class: 'B', limit: 0.9, items: [] as any[], val: 0, color: 'bg-blue-500', desc: 'Medium-value items. Balance control and efficiency.' },
    { class: 'C', limit: 1.0, items: [] as any[], val: 0, color: 'bg-slate-400', desc: 'Low-value items. Simplify ordering processes.' },
  ];

  sortedByValue.forEach(p => {
    const pVal = p.value * p.quantity;
    cumulativeValue += pVal;
    const ratio = totalCapital > 0 ? cumulativeValue / totalCapital : 1;
    if (ratio <= 0.7) {
      abcAnalysis[0].items.push(p);
      abcAnalysis[0].val += pVal;
    } else if (ratio <= 0.9) {
      abcAnalysis[1].items.push(p);
      abcAnalysis[1].val += pVal;
    } else {
      abcAnalysis[2].items.push(p);
      abcAnalysis[2].val += pVal;
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Analytics</h2>
          <p className="text-slate-500 text-[11px] sm:text-sm font-medium mt-1">Deep insights into inventory performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="flex items-center gap-2 px-3 sm:px-4 h-9 sm:h-10 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-[10px] sm:text-xs shrink-0">
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
            <span className="truncate">Last 30 Days</span> <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          <button className="flex items-center gap-2 px-3 sm:px-4 h-9 sm:h-10 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-[10px] sm:text-xs shrink-0">
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
            <span className="truncate">Refresh</span>
          </button>
          <button className="flex items-center gap-2 bg-[#0f172a] text-white px-3 sm:px-5 h-9 sm:h-10 rounded-lg font-bold hover:bg-slate-800 transition-all text-[10px] sm:text-xs shrink-0">
            <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="truncate">Export Report</span>
          </button>
        </div>
      </div>

      {/* Mini Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-4">
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-emerald-50 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-500" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-base md:text-lg font-bold text-slate-900 leading-none truncate">4.2x</p>
            <p className="text-[8px] sm:text-[10px] md:text-xs font-medium text-slate-400 mt-0.5 sm:mt-1.5 leading-tight truncate">Avg Turnover</p>
          </div>
        </div>
        {/* Total Inventory */}
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-4">
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-slate-900 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0">
            <DollarSign className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-base md:text-lg font-bold text-slate-900 leading-none truncate">{formatCompactNumber(totalCapital, currency)}</p>
            <p className="text-[8px] sm:text-[10px] md:text-xs font-bold text-slate-400 mt-0.5 sm:mt-1.5 leading-tight truncate">Total Value</p>
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-4">
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-emerald-500 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0">
            <Package className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-base md:text-lg font-bold text-slate-900 leading-none truncate">{totalSKUs.toLocaleString()}</p>
            <p className="text-[8px] sm:text-[10px] md:text-xs font-medium text-slate-400 mt-0.5 sm:mt-1.5 leading-tight truncate">Active SKUs</p>
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-4 text-left">
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-amber-100 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4 sm:w-6 sm:h-6 text-amber-500" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-base md:text-lg font-bold text-slate-900 leading-none truncate">87%</p>
            <p className="text-[8px] sm:text-[10px] md:text-xs font-medium text-slate-400 mt-0.5 sm:mt-1.5 leading-tight truncate">Fill Rate</p>
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-4 text-left col-span-2 md:col-span-1">
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-50 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-blue-500" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-base md:text-lg font-bold text-slate-900 leading-none truncate font-mono">{averageSTR.toFixed(1)}%</p>
            <p className="text-[8px] sm:text-[10px] md:text-xs font-medium text-slate-400 mt-0.5 sm:mt-1.5 leading-tight truncate">Sell-Through Rate</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart: Turnover Trend */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="mb-0">
            <h3 className="text-lg font-extrabold text-slate-900">Stock Turnover Trend</h3>
            <p className="text-xs font-medium text-slate-400 mt-0.5">Monthly turnover ratio (Line Chart)</p>
          </div>
          <div className="h-[320px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={turnoverRatioData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  tickFormatter={(val) => `${val}x`}
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                  labelStyle={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}
                />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="turnover" name="Turnover Rate" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Cash Tied by Category */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col text-left">
          <div className="mb-6">
            <h3 className="text-xl font-extrabold text-slate-900">Category Distribution</h3>
            <p className="text-xs font-medium text-slate-400 mt-0.5">Inventory value share (Pie Chart)</p>
          </div>
          <div className="flex-1 flex flex-col sm:flex-row items-center sm:justify-between gap-8 py-2">
            <div className="relative w-44 h-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats.length > 0 ? categoryStats : [{ name: 'No Data', value: 1, color: '#f1f5f9' }]}
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${currency}${value.toLocaleString()}`, 'Value']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Value</p>
                <p className="text-xl font-black text-slate-900 leading-none mt-1">
                  {currency}{totalCapital >= 1000000 
                    ? `${(totalCapital / 1000000).toFixed(1)}M` 
                    : totalCapital.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex-1 w-full space-y-3 min-w-[200px]">
              {categoryStats.slice(0, 5).map((cat) => (
                <div key={cat.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-900 transition-colors uppercase tracking-tight truncate max-w-[100px]">{cat.name}</span>
                  </div>
                  <span className="text-[11px] font-black text-slate-900">{formatCompactNumber(cat.value, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column Chart: Movement by Item Count */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="mb-6">
            <h3 className="text-lg font-extrabold text-slate-900">Inventory Movement</h3>
            <p className="text-xs font-medium text-slate-400 mt-0.5">Items per movement category (Column Chart)</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOVEMENT_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="items" name="Total Units" radius={[6, 6, 0, 0]}>
                  {MOVEMENT_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color.includes('blue') ? '#3b82f6' : entry.color.includes('emerald') ? '#10b981' : entry.color.includes('amber') ? '#f59e0b' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Horizontal Bar Chart: Value by Category */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="mb-6">
            <h3 className="text-lg font-extrabold text-slate-900">Value Ranking</h3>
            <p className="text-xs font-medium text-slate-400 mt-0.5">Top categories by total value (Bar Chart)</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={categoryStats.slice(0, 6)} margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} 
                  width={80}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(val: number) => [`${currency}${val.toLocaleString()}`, 'Value']}
                  contentStyle={{ borderRadius: '12px' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scatter Plot: Price vs Quantity Analysis */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="mb-6">
            <h3 className="text-lg font-extrabold text-slate-900">Price vs Quantity (Scatter Plot)</h3>
            <p className="text-xs font-medium text-slate-400 mt-0.5">Identifying high-value outliers and stocking efficiency</p>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  type="number" 
                  dataKey="quantity" 
                  name="Stock Quantity" 
                  axisLine={false} 
                  tickLine={false}
                  label={{ value: 'Quantity', position: 'insideBottom', offset: -10, fontSize: 10, fontWeight: 700 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="price" 
                  name="Unit Price" 
                  axisLine={false} 
                  tickLine={false}
                  tickFormatter={(val) => `${currency}${val}`}
                  label={{ value: 'Price', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 700 }}
                />
                <ZAxis type="number" dataKey="totalValue" range={[64, 400]} name="Total Value" />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  content={({ payload }) => {
                    if (payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xl text-left">
                          <p className="text-xs font-black text-slate-900 mb-2 truncate max-w-[200px]">{data.name}</p>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-500">Price: <span className="text-slate-900">{currency}{data.price}</span></p>
                            <p className="text-[10px] font-bold text-slate-500">Stock: <span className="text-slate-900">{data.quantity} units</span></p>
                            <p className="text-[10px] font-bold text-slate-500">Value: <span className="text-blue-600">{currency}{data.totalValue.toLocaleString()}</span></p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter name="Products" data={scatterData} fill="#3b82f6" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Existing Analysis Progress Visualizations */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Stock Movement Analysis</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">Inventory categorized by sales velocity</p>
            </div>
            <div className="bg-slate-50 px-4 sm:px-5 py-2 sm:py-3 rounded-2xl border border-slate-100 sm:min-w-[200px]">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Inventory Value</p>
              <p className="text-lg sm:text-xl font-black text-slate-900">
                <span className="sm:hidden">{formatCompactNumber(totalCapital, currency)}</span>
                <span className="hidden sm:inline">{currency}{totalCapital.toLocaleString()}</span>
              </p>
            </div>
          </div>
          
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            {MOVEMENT_DATA.map((segment, i) => (
              <motion.div 
                key={i} 
                initial={{ width: 0 }}
                animate={{ width: `${segment.percentage}%` }}
                className={cn("h-full transition-all duration-1000", segment.color)} 
                title={`${segment.name}: ${segment.percentage}%`}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {MOVEMENT_DATA.map((item, i) => (
              <motion.div 
                key={i} 
                whileHover={{ y: -4 }}
                className="p-4 sm:p-5 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col justify-between hover:bg-white hover:border-slate-200 hover:shadow-md transition-all duration-300 relative overflow-hidden"
              >
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white shadow-sm", item.color)}>
                      <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.name}</p>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 leading-none">
                      {formatCompactNumber(item.value, currency)}
                    </h4>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100/50">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-xs font-bold text-slate-700">{item.items.toLocaleString()} items</p>
                      <p className={cn("text-[11px] font-black", item.color.replace('bg-', 'text-'))}>{item.percentage}%</p>
                    </div>
                    <p className="text-[10px] font-medium text-slate-400 leading-tight">{item.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ABC Analysis */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">ABC Analysis</h3>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Value-based inventory classification</p>
            </div>
          </div>

          <div className="space-y-6">
            {abcAnalysis.map((item, i) => (
              <div key={i} className="space-y-3 pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", item.color)} />
                    <span className="text-sm font-bold text-slate-900">Class {item.class}</span>
                  </div>
                  <span className="text-sm font-black text-slate-900">{currency}{item.val.toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                <div className="flex items-center gap-4 text-[10px] font-bold text-left">
                  <span className="text-slate-400">Items: <span className="text-slate-900">{item.items.length}</span> <span className="text-slate-400 font-medium tracking-tight">({totalSKUs > 0 ? Math.round((item.items.length/totalSKUs)*100) : 0}%)</span></span>
                  <span className="text-slate-400">Value: <span className="text-blue-600">{totalCapital > 0 ? Math.round((item.val/totalCapital)*100) : 0}%</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sell-Through Rate (STR) Performance */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm text-left flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">STR Performance Card</h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">Percentage of inventory sold compared to received</p>
              </div>
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-widest border border-blue-100/30">
                Formula Match
              </span>
            </div>

            <div className="space-y-5">
              {[...allProducts]
                .map(p => ({
                  ...p,
                  str: getSellThroughRate(p)
                }))
                .sort((a, b) => b.str - a.str)
                .slice(0, 5)
                .map((p, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 truncate max-w-[180px]">{p.name}</span>
                      <span className="font-extrabold text-slate-950 font-mono">{p.str.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          p.str >= 70 ? "bg-emerald-500" : p.str >= 40 ? "bg-blue-500" : "bg-amber-500"
                        )}
                        style={{ width: `${Math.min(100, p.str)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                      <span>Sold: {p.unitsSold || 0} units</span>
                      <span>Received: {p.unitsReceived || (p.quantity + (p.unitsSold || 0))} units</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <div className="pt-4 mt-6 border-t border-slate-100 text-[10px] font-bold text-slate-400 leading-relaxed">
            Standard Retail Formula: <br />
            <span className="font-mono bg-slate-100/50 px-1.5 py-0.5 rounded text-blue-600 font-extrabold block mt-1 tracking-wide">
              STR = (Units Sold / Units Received) × 100
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}
