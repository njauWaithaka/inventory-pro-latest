import React, { useState, useMemo } from 'react';
import { 
  Clipboard, Plus, Calendar, AlertCircle, Sparkles, TrendingUp, CheckCircle, 
  Trash2, Filter, ChevronRight, Play, Loader2, ArrowRight, Layers, FileText,
  Activity, ShieldAlert
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import { cn } from '../../../lib/utils';

interface Plan {
  id: string;
  planningNumber: string;
  productId: string;
  productName: string;
  targetQty: number;
  startDate: string;
  endDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  source: 'LOW_STOCK' | 'SALES_DEMAND' | 'FORECAST' | 'MANUAL';
  status: 'DRAFT' | 'APPROVED' | 'CONVERTED' | 'CANCELLED';
  notes?: string;
  createdAt: string;
}

interface ProductionPlanningProps {
  plans: Plan[];
  products: any[];
  onAddPlan: (plan: Omit<Plan, 'id' | 'planningNumber' | 'createdAt'>) => Promise<void>;
  onApprovePlan: (planId: string) => Promise<void>;
  onCancelPlan: (planId: string) => Promise<void>;
  onDeletePlan: (planId: string) => Promise<void>;
  onRunMRP: (planId: string) => void; // Redirect handler
  currency: string;
}

export function ProductionPlanning({
  plans,
  products,
  onAddPlan,
  onApprovePlan,
  onCancelPlan,
  onDeletePlan,
  onRunMRP,
  currency
}: ProductionPlanningProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [productId, setProductId] = useState('');
  const [targetQty, setTargetQty] = useState(10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [source, setSource] = useState<'LOW_STOCK' | 'SALES_DEMAND' | 'FORECAST' | 'MANUAL'>('MANUAL');
  const [notes, setNotes] = useState('');

  // Filtering
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Filtered Plans
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const matchSrc = sourceFilter === 'ALL' || p.source === sourceFilter;
      const matchPrio = priorityFilter === 'ALL' || p.priority === priorityFilter;
      return matchSrc && matchPrio;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [plans, sourceFilter, priorityFilter]);

  const productsWithBoms = useMemo(() => {
    return products.filter(p => p.materialGroup === 'Finished Goods' || p.materialGroup === 'Subassembly' || p.materialGroup === 'Finished Product' || true); // Allow all
  }, [products]);

  // Map of products for quick stock queries
  const productsMap = useMemo(() => new Map<string, any>(products.map(p => [p.id, p])), [products]);

  // Calculate Planning KPI Metrics
  const planningKPIs = useMemo(() => {
    let plannedProduction = 0;
    let pendingProduction = 0;
    let totalDemandGap = 0;

    plans.forEach(plan => {
      const prod = productsMap.get(plan.productId);
      const stock = prod?.quantity || 0;
      if (plan.status === 'APPROVED' || plan.status === 'CONVERTED') {
        plannedProduction += plan.targetQty;
        const gap = Math.max(0, plan.targetQty - stock);
        totalDemandGap += gap;
      } else if (plan.status === 'DRAFT') {
        pendingProduction += plan.targetQty;
      }
    });

    // Capacity utilization: Base utilization is 70%, increases with plans, max 100%
    const activePlansCount = plans.filter(p => p.status === 'APPROVED' || p.status === 'CONVERTED').length;
    const capacityUtilization = Math.min(100, 70 + activePlansCount * 3.5);

    return {
      plannedProduction,
      pendingProduction,
      totalDemandGap,
      capacityUtilization
    };
  }, [plans, productsMap]);

  // Charting Data for Production Planning
  const chartData = useMemo(() => {
    const grouped: Record<string, { name: string; planned: number; stock: number; short: number }> = {};
    plans.forEach(plan => {
      if (plan.status === 'CANCELLED') return;
      const prod = productsMap.get(plan.productId);
      const stock = prod?.quantity || 0;
      if (!grouped[plan.productId]) {
        grouped[plan.productId] = {
          name: plan.productName,
          planned: 0,
          stock: stock,
          short: 0
        };
      }
      grouped[plan.productId].planned += plan.targetQty;
    });

    return Object.values(grouped).map(g => {
      const short = Math.max(0, g.planned - g.stock);
      return {
        ...g,
        short
      };
    }).slice(0, 8); // top 8 items for clean layout
  }, [plans, productsMap]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || targetQty <= 0 || !startDate || !endDate) {
      alert('Please fill out all required fields.');
      return;
    }

    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    setIsSubmitting(true);
    try {
      await onAddPlan({
        productId,
        productName: prod.name,
        targetQty,
        startDate,
        endDate,
        priority,
        source,
        status: 'DRAFT',
        notes
      });
      setShowAddForm(false);
      setProductId('');
      setTargetQty(10);
      setStartDate('');
      setEndDate('');
      setNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Source filters */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {['ALL', 'LOW_STOCK', 'SALES_DEMAND', 'FORECAST', 'MANUAL'].map((src) => (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-all",
                  sourceFilter === src 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {src.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {['ALL', 'LOW', 'MEDIUM', 'HIGH'].map((prio) => (
              <button
                key={prio}
                onClick={() => setPriorityFilter(prio)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-all",
                  priorityFilter === prio 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {prio}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-5 h-11 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-wider rounded-2xl text-[10px] flex items-center gap-2 shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Production Plan
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Planned Production</span>
            <span className="text-2xl font-black text-slate-900 block mt-1.5">{planningKPIs.plannedProduction.toLocaleString()} Units</span>
            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest block mt-1">Released to floor</span>
          </div>
          <div className="w-11 h-11 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Demand vs Supply Gap</span>
            <span className={cn("text-2xl font-black block mt-1.5", planningKPIs.totalDemandGap > 0 ? "text-rose-600" : "text-slate-900")}>
              {planningKPIs.totalDemandGap.toLocaleString()} Units
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mt-1">Shortfall on active plans</span>
          </div>
          <div className={cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border",
            planningKPIs.totalDemandGap > 0 ? "bg-rose-50 border-rose-100 text-rose-500" : "bg-slate-50 border-slate-100 text-slate-500"
          )}>
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Capacity Utilization</span>
            <span className="text-2xl font-black text-indigo-600 block mt-1.5">{planningKPIs.capacityUtilization.toFixed(1)}%</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mt-1">Average floor load</span>
          </div>
          <div className="w-11 h-11 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Pending Production</span>
            <span className="text-2xl font-black text-slate-900 block mt-1.5">{planningKPIs.pendingProduction.toLocaleString()} Units</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mt-1">Worksheets in draft</span>
          </div>
          <div className="w-11 h-11 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-500 shrink-0">
            <Clipboard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Visual Chart Section: Supply & Shortage Gap Visualizer */}
      {chartData.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-500 animate-pulse" />
                Planning Supply Gap Analyzer
              </h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Aggregate target quantities versus current available warehouse stock levels.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600" /> Planned</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> On Hand</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Deficit</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="lg:col-span-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }}
                    labelClassName="text-slate-400 text-xs font-black uppercase tracking-wider"
                  />
                  <Bar dataKey="planned" fill="#2563eb" name="Planned Production" barSize={14} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="stock" fill="#10b981" name="On Hand Stock" barSize={14} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="short" stroke="#f43f5e" strokeWidth={2.5} activeDot={{ r: 5 }} name="Net Deficit Shortage" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Urgent Shortage Actions</p>
              <div className="space-y-2.5">
                {chartData.filter(d => d.short > 0).map((item, idx) => (
                  <div key={idx} className="p-3 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-700">
                    <div>
                      <p className="font-extrabold text-slate-900 uppercase tracking-tight">{item.name}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wider">Deficit: <span className="text-rose-600 font-black">{item.short} units</span></p>
                    </div>
                    <span className="bg-rose-100 text-rose-700 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider border border-rose-200 animate-pulse">
                      Critical
                    </span>
                  </div>
                ))}
                {chartData.filter(d => d.short > 0).length === 0 && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-center text-xs font-bold text-emerald-700 flex flex-col items-center gap-1">
                    <CheckCircle className="w-5 h-5" />
                    <span>No Current Stock Deficits!</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">
              New Production Plan Worksheet
            </h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Input requirements, target schedules, and lead sources for material planning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Finished Product *
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                required
              >
                <option value="">-- Select Product --</option>
                {productsWithBoms.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Target Quantity *
              </label>
              <input
                type="number"
                min="1"
                value={targetQty}
                onChange={(e) => setTargetQty(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                End Date (Expected Completion) *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Planning Priority
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "h-11 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border",
                      priority === p
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Trigger Lead Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as any)}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="MANUAL">Manual Request</option>
                <option value="LOW_STOCK">MRP Low Stock Trigger</option>
                <option value="SALES_DEMAND">Sales Contract / SO</option>
                <option value="FORECAST">Aggregate Forecast Run</option>
              </select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Planning Notes / Memo
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Specify production line parameters, customer name, etc."
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-5 h-11 bg-slate-100 text-slate-500 font-black uppercase tracking-wider rounded-2xl text-[10px] hover:bg-slate-200 transition-all"
            >
              Discard Plan
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 h-11 bg-slate-900 text-white font-black uppercase tracking-wider rounded-2xl text-[10px] hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Clipboard className="w-4 h-4" /> Save Draft Plan
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Plans List Table */}
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
          <div>
            <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">Active Production Schedules</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Review aggregate production targets, schedules, and transition to Material Requirements Planning.
            </p>
          </div>
          <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
            {filteredPlans.length} Plans Loaded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="pb-3">Planning Sheet</th>
                <th className="pb-3">Product</th>
                <th className="pb-3 text-center">Demand Qty</th>
                <th className="pb-3 text-center">Available Stock</th>
                <th className="pb-3 text-center">Suggested Prod Qty</th>
                <th className="pb-3 text-center">Priority</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPlans.length > 0 ? (
                filteredPlans.map((plan) => {
                  const prod = productsMap.get(plan.productId);
                  const stock = prod?.quantity || 0;
                  const isShortage = stock < plan.targetQty;
                  const suggestedQty = Math.max(0, plan.targetQty - stock);

                  return (
                    <tr 
                      key={plan.id} 
                      className={cn(
                        "hover:bg-slate-50 transition-colors",
                        isShortage && plan.status !== 'CANCELLED' ? "bg-rose-50/20" : ""
                      )}
                    >
                      <td className="py-3.5">
                        <p className="font-extrabold text-slate-900">{plan.planningNumber}</p>
                        <p className="text-[9px] text-slate-400 font-bold">Planned {new Date(plan.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="py-3.5">
                        <p className="font-extrabold text-slate-900">{plan.productName}</p>
                        {plan.notes && <p className="text-[10px] text-slate-400 font-semibold">{plan.notes}</p>}
                      </td>
                      <td className="py-3.5 text-center font-black text-slate-800">
                        {plan.targetQty} units
                      </td>
                      <td className="py-3.5 text-center">
                        <span className={cn(
                          "font-bold px-2 py-1 rounded-md text-xs",
                          isShortage && plan.status !== 'CANCELLED'
                            ? "bg-rose-100 text-rose-700 font-black border border-rose-200"
                            : "text-slate-600"
                        )}>
                          {stock} units
                        </span>
                        {isShortage && plan.status !== 'CANCELLED' && (
                          <span className="block text-[8px] text-rose-600 font-black uppercase tracking-widest mt-1">Shortage!</span>
                        )}
                      </td>
                      <td className="py-3.5 text-center font-black text-indigo-600">
                        {suggestedQty} units
                      </td>
                      <td className="py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border",
                            plan.priority === 'HIGH' ? "bg-rose-50 text-rose-600 border-rose-100" :
                            plan.priority === 'MEDIUM' ? "bg-amber-50 text-amber-600 border-amber-100" :
                            "bg-slate-50 text-slate-500 border-slate-200"
                          )}>
                            {plan.priority}
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                            {plan.source.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 text-center">
                        <span className={cn(
                          "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border",
                          plan.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          plan.status === 'CONVERTED' ? "bg-blue-50 text-blue-600 border-blue-100" :
                          plan.status === 'CANCELLED' ? "bg-rose-50 text-rose-600 border-rose-100" :
                          "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {plan.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {plan.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => onApprovePlan(plan.id)}
                                className="px-3 h-8 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                                title="Approve and Release Plan"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => onCancelPlan(plan.id)}
                                className="px-3 h-8 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                                title="Cancel Plan"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => onDeletePlan(plan.id)}
                                className="p-1.5 hover:bg-rose-50 text-rose-600 border border-transparent hover:border-rose-100 rounded-lg transition-all"
                                title="Delete Plan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {plan.status === 'APPROVED' && (
                            <button
                              onClick={() => onRunMRP(plan.id)}
                              className="px-3.5 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                            >
                              <Play className="w-3 h-3 fill-current" /> Run MRP
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold uppercase tracking-wider">
                    No Production Plans found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
