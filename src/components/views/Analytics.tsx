import React, { useState, useEffect, useMemo } from 'react';

import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, ScatterChart, Scatter, ZAxis, Legend
} from 'recharts';
import { cn, formatCompactNumber, getSellThroughRate, getProductMovementSpeed } from '../../lib/utils';
import { ABCAnalysisSection } from './ABCAnalysisSection';
import { SKUMovementDashboard } from './SKUMovementDashboard';
import { 
  calculateStockTurnover, 
  calculateMonthlyTurnoverTrend, 
  getDateRangeForPeriod, 
  TimePeriod 
} from '../../lib/stockTurnoverService';
import { 
  TrendingUp, DollarSign, Package, BarChart3, Calendar, RotateCcw, FileDown, 
  Activity, MousePointer2, Clock, Ban, ChevronDown, CheckCircle2, ShieldCheck, 
  AlertTriangle, RefreshCw, Sparkles, HelpCircle, ArrowRight, UserCheck, Inbox,
  CornerDownRight, Database, ListFilter, AlertCircle
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, doc, setDoc, updateDoc, getDocs, writeBatch 
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
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [movementsLoaded, setMovementsLoaded] = useState(false);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);

  // Filter States
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('This Month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    if (!profile?.companyId) return;

    const prodQuery = collection(db, `companies/${profile.companyId}/products`);
    const unsubscribeProducts = onSnapshot(prodQuery, (snapshot) => {
      setProducts(snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          movement: getProductMovementSpeed(data)
        };
      }));
      setProductsLoaded(true);
    }, (error) => {
      console.error("Query error in Analytics products:", error);
      setProductsLoaded(true);
    });

    const movQuery = collection(db, `companies/${profile.companyId}/stockMovements`);
    const unsubscribeMovements = onSnapshot(movQuery, (snapshot) => {
      setStockMovements(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
      setMovementsLoaded(true);
    }, (error) => {
      console.error("Query error in Analytics movements:", error);
      setMovementsLoaded(true);
    });

    const invQuery = collection(db, `companies/${profile.companyId}/invoices`);
    const unsubscribeInvoices = onSnapshot(invQuery, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setInvoicesLoaded(true);
    }, (error) => {
      console.error("Query error in Analytics invoices:", error);
      setInvoicesLoaded(true);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeMovements();
      unsubscribeInvoices();
    };
  }, [profile?.companyId]);

  const loading = !productsLoaded || !movementsLoaded || !invoicesLoaded;

  // Custom range memo
  const customRange = useMemo(() => {
    if (!customStartDate || !customEndDate) return undefined;
    return {
      start: new Date(customStartDate + 'T00:00:00'),
      end: new Date(customEndDate + 'T23:59:59')
    };
  }, [customStartDate, customEndDate]);

  // Date range memo
  const dateRange = useMemo(() => {
    return getDateRangeForPeriod(selectedPeriod, customRange);
  }, [selectedPeriod, customRange]);

  // Overall statistics memo
  const overallStats = useMemo(() => {
    return calculateStockTurnover(products, stockMovements, dateRange);
  }, [products, stockMovements, dateRange]);

  // Turnover Trend (Line Chart) data
  const turnoverRatioData = useMemo(() => {
    return calculateMonthlyTurnoverTrend(products, stockMovements);
  }, [products, stockMovements]);

  // Dynamic Metrics Calculation
  const allProducts = [...products];
  
  const totalCapital = allProducts.reduce((sum, p) => sum + ((p.value || p.buyingPrice || 0) * (p.quantity || 0)), 0);
  const totalSKUs = allProducts.length;

  const totalUnitsSold = allProducts.reduce((sum, p) => sum + (p.unitsSold || 0), 0);
  const totalUnitsReceived = allProducts.reduce((sum, p) => {
    const received = typeof p.unitsReceived === 'number' && p.unitsReceived > 0
      ? p.unitsReceived 
      : p.quantity + (p.unitsSold || 0);
    return sum + received;
  }, 0);
  const averageSTR = totalUnitsReceived > 0 ? (totalUnitsSold / totalUnitsReceived) * 100 : 0;

  // Calculate Sales, Gross Profit, and Net Profit from Invoices
  const salesMetrics = useMemo(() => {
    const salesInvoices = invoices.filter(inv => inv.type === 'standard' || !inv.type);
    
    const filteredInvoices = salesInvoices.filter(inv => {
      const invDateStr = inv.date || inv.createdAt;
      if (!invDateStr) return true;
      const invDate = new Date(invDateStr);
      if (isNaN(invDate.getTime())) return true;
      if (dateRange?.start && invDate < dateRange.start) return false;
      if (dateRange?.end && invDate > dateRange.end) return false;
      return true;
    });

    let totalSales = 0;
    let totalCOGS = 0;

    filteredInvoices.forEach(inv => {
      const items = inv.items || [];
      if (items.length === 0) {
        const amt = Number(inv.amount) || 0;
        totalSales += amt;
        totalCOGS += amt * 0.65;
      } else {
        items.forEach((it: any) => {
          const qty = Number(it.quantity) || 1;
          const price = Number(it.price || it.unitPrice) || 0;
          const lineTotal = Number(it.total) || qty * price;
          totalSales += lineTotal;

          const prod = products.find(p => p.id === it.productId || p.sku === it.sku || p.name === it.name);
          let unitCost = Number(prod?.buyingPrice || prod?.value || it.buyingPrice || it.cost || 0);
          if (unitCost <= 0) {
            unitCost = price > 0 ? price * 0.65 : lineTotal * 0.65;
          }
          totalCOGS += qty * unitCost;
        });
      }
    });

    const grossProfit = totalSales - totalCOGS;
    const operatingExpenses = Math.round(totalSales * 0.12);
    const netProfit = grossProfit - operatingExpenses;

    return { totalSales, grossProfit, netProfit };
  }, [invoices, products, dateRange]);

  // Overall/Average Turnover value for the stat card
  const overallTurnover = overallStats.overallRatio;
  
  const categoryStats = allProducts.reduce((acc: any[], p) => {
    const existing = acc.find(c => c.name === p.category);
    const val = (p.value || p.buyingPrice || 0) * (p.quantity || 0);
    if (existing) {
      existing.value += val;
    } else {
      acc.push({ 
        id: acc.length + 1, 
        name: p.category || 'Uncategorized', 
        value: val, 
        color: COLORS[acc.length % COLORS.length] 
      });
    }
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  const categoriesList = useMemo(() => {
    const list = new Set<string>();
    products.forEach(p => {
      if (p.category) list.add(p.category);
    });
    return ['All', ...Array.from(list)];
  }, [products]);

  const filteredProductsStats = useMemo(() => {
    return overallStats.productsStats.filter(stat => {
      const matchesSearch = stat.productName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            stat.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || stat.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [overallStats.productsStats, searchQuery, selectedCategory]);

  const movementDataMap = allProducts.reduce((acc, p) => {
    let key = p.movement || 'slow';
    
    if (!acc[key]) acc[key] = { value: 0, items: 0 };
    acc[key].value += (p.value || p.buyingPrice || 0) * (p.quantity || 0);
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
        <div className="flex flex-wrap items-center gap-3">
          {/* Period selector pills */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(['Today', 'This Week', 'This Month', 'This Year', 'Custom'] as TimePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  "px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all",
                  selectedPeriod === period
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Custom Date Picker Fields */}
          {selectedPeriod === 'Custom' && (
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-1 duration-150">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 text-xs font-bold text-slate-700 bg-transparent border-0 outline-none focus:ring-0 cursor-pointer"
              />
              <span className="text-slate-400 text-[10px] font-black uppercase">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 text-xs font-bold text-slate-700 bg-transparent border-0 outline-none focus:ring-0 cursor-pointer"
              />
            </div>
          )}

          <button 
            onClick={() => {
              // Trigger simple refresh by reloading window or resetting loaded states
              setProductsLoaded(false);
              setMovementsLoaded(false);
            }}
            className="flex items-center gap-2 px-3 sm:px-4 h-9 sm:h-10 border border-slate-200 rounded-xl bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-[10px] sm:text-xs shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
            <span className="truncate">Refresh</span>
          </button>
          <button className="flex items-center gap-2 bg-[#0f172a] text-white px-3 sm:px-5 h-9 sm:h-10 rounded-xl font-bold hover:bg-slate-800 transition-all text-[10px] sm:text-xs shrink-0">
            <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="truncate">Export Report</span>
          </button>
        </div>
      </div>

      {/* Mini Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-base font-bold text-slate-900 leading-none truncate font-mono">{overallTurnover.toFixed(2)}x</p>
            <p className="text-[8px] sm:text-[10px] font-medium text-slate-400 mt-0.5 sm:mt-1 leading-tight truncate">Turnover ({selectedPeriod})</p>
          </div>
        </div>
        
        {/* Total Inventory */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-900 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-base font-bold text-slate-900 leading-none truncate">{formatCompactNumber(totalCapital, currency)}</p>
            <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 mt-0.5 sm:mt-1 leading-tight truncate">Total Value</p>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0">
            <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-base font-bold text-slate-900 leading-none truncate">{totalSKUs.toLocaleString()}</p>
            <p className="text-[8px] sm:text-[10px] font-medium text-slate-400 mt-0.5 sm:mt-1 leading-tight truncate">Active SKUs</p>
          </div>
        </div>

        {/* Total Sales Card */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-3 text-left">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-base font-bold text-slate-900 leading-none truncate">{currency}{Math.round(salesMetrics.totalSales).toLocaleString()}</p>
            <p className="text-[8px] sm:text-[10px] font-medium text-slate-400 mt-0.5 sm:mt-1 leading-tight truncate">Total Sales</p>
          </div>
        </div>

        {/* Gross Profit Card */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-3 text-left">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-base font-bold text-slate-900 leading-none truncate">{currency}{Math.round(salesMetrics.grossProfit).toLocaleString()}</p>
            <p className="text-[8px] sm:text-[10px] font-medium text-slate-400 mt-0.5 sm:mt-1 leading-tight truncate">Gross Profit</p>
          </div>
        </div>

        {/* Net Profit Card */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-3 text-left">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-base font-bold text-slate-900 leading-none truncate">{currency}{Math.round(salesMetrics.netProfit).toLocaleString()}</p>
            <p className="text-[8px] sm:text-[10px] font-medium text-slate-400 mt-0.5 sm:mt-1 leading-tight truncate">Net Profit</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        {/* Line Chart: Turnover Trend */}
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm text-left flex flex-col justify-between min-w-0 w-full">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">Stock Turnover Trend</h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">Monthly turnover ratio (Line Chart)</p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-xs font-bold w-fit shrink-0">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                {overallTurnover.toFixed(2)}x Current Rate
              </div>
            </div>
            <div className="h-[240px] sm:h-[280px] md:h-[300px] w-full min-h-[200px] min-w-0 mt-4">
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
                <LineChart data={turnoverRatioData} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                    dy={10} 
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    width={36}
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                    tickFormatter={(val) => `${val}x`}
                    domain={[0, 'auto']}
                  />
                  <Tooltip 
                    formatter={(val: any) => [`${Number(val).toFixed(2)}x`, "Turnover Rate"]}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                    labelStyle={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="turnover" 
                    name="Turnover Rate" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} 
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 mt-4 border-t border-slate-100 text-center">
            <div className="text-left">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">6-Mo Avg</span>
              <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                {(turnoverRatioData.reduce((s, i) => s + i.turnover, 0) / Math.max(1, turnoverRatioData.length)).toFixed(2)}x
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Peak Month</span>
              <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                {Math.max(...turnoverRatioData.map(i => i.turnover), 0).toFixed(2)}x
              </span>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Status</span>
              <span className="text-xs sm:text-sm font-extrabold text-emerald-600">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Pie Chart: Cash Tied by Category */}
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col text-left min-w-0 w-full">
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

        {/* Automatic SKU Movement Classification & Inventory Aging Dashboard */}
        <div className="lg:col-span-2">
          <SKUMovementDashboard 
            products={allProducts} 
            movements={stockMovements} 
            currency={currency} 
          />
        </div>

        {/* ABC Analysis Section */}
        <div className="lg:col-span-2">
          <ABCAnalysisSection products={allProducts} currency={currency} />
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

      {/* Product-level Stock Turnover Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm text-left">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Product Turnover & Inventory Velocity</h3>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Ratios computed from real transaction logs for period: <span className="font-bold text-blue-600">{selectedPeriod}</span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            {/* Search input */}
            <div className="relative w-full sm:w-60">
              <input
                type="text"
                placeholder="Search name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 pl-8 text-xs font-semibold border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors bg-slate-50/50"
              />
              <svg
                className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-40 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors bg-white text-slate-700"
            >
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Product Info</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Units Sold</th>
                <th className="px-6 py-4 text-right">Beg. Stock</th>
                <th className="px-6 py-4 text-right">End. Stock</th>
                <th className="px-6 py-4 text-right">Avg. Stock</th>
                <th className="px-6 py-4 text-right">COGS</th>
                <th className="px-6 py-4 text-right">Turnover Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProductsStats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-xs font-medium">
                    No matching products found.
                  </td>
                </tr>
              ) : (
                filteredProductsStats.map((stat) => {
                  let speedBadgeColor = "text-amber-600 bg-amber-50 border-amber-100/40";
                  let speedText = "Moderate";
                  if (stat.turnoverRatio >= 4.0) {
                    speedBadgeColor = "text-emerald-600 bg-emerald-50 border-emerald-100/40";
                    speedText = "High Velocity";
                  } else if (stat.turnoverRatio < 1.0) {
                    speedBadgeColor = "text-rose-600 bg-rose-50 border-rose-100/40";
                    speedText = "Slow Velocity";
                  }

                  return (
                    <tr key={stat.productId} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate max-w-[200px]">
                            {stat.productName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                            SKU: {stat.sku || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-tight">
                          {stat.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-800 font-mono text-xs">
                        {stat.unitsSold.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-500 font-mono text-xs">
                        {stat.beginningStock.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-500 font-mono text-xs">
                        {stat.endingStock.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-700 font-mono text-xs">
                        {stat.averageStock.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900 font-mono text-xs">
                        {currency}{stat.cogs.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-xs font-black text-slate-950 font-mono">
                            {stat.turnoverRatio.toFixed(2)}x
                          </span>
                          <span className={cn("text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border tracking-wider", speedBadgeColor)}>
                            {speedText}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-bold text-slate-400">
          <span>Showing {filteredProductsStats.length} of {overallStats.productsStats.length} products</span>
          <span className="font-mono text-blue-600 font-black">
            Turnover Ratio = Units Sold (or COGS) ÷ Average Inventory (Quantity or Value)
          </span>
        </div>
      </div>
    </div>
  );
}
