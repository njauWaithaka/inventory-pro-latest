import React, { useState } from 'react';
import { 
  ResponsiveContainer, ComposedChart, Line, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  BarChart, AreaChart, Area, Cell 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Layers, Award, 
  AlertTriangle, CheckCircle2, ArrowRight, Package, 
  Percent, ShieldCheck, Flame, ShoppingBag, Eye
} from 'lucide-react';
import { 
  SellThroughAnalysisResult, TimeGranularity 
} from '../../../lib/sellThroughService';
import { cn } from '../../../lib/utils';

interface SellThroughVisualAnalyticsProps {
  analytics: SellThroughAnalysisResult;
  currency: string;
  granularity: TimeGranularity;
}

export function SellThroughVisualAnalytics({
  analytics,
  currency,
  granularity
}: SellThroughVisualAnalyticsProps) {
  const [activeChartTab, setActiveChartTab] = useState<'str_vs_cover' | 'fillrate_trend' | 'waterfall_funnel' | 'matrix_heatmap' | 'top_bottom_10'>('str_vs_cover');
  const [topBottomFilter, setTopBottomFilter] = useState<'all' | 'winners' | 'losers'>('all');

  const trendData = analytics.trendSeries[granularity] || analytics.trendSeries.daily;
  const { funnelWaterfall, categoryHeatmap, topWinners, bottomLosers } = analytics;

  // Status color for heatmap
  const getHeatmapColor = (status: string) => {
    switch (status) {
      case 'thriving': return 'bg-emerald-500 text-white border-emerald-600 shadow-xs';
      case 'healthy': return 'bg-emerald-100 text-emerald-900 border-emerald-200';
      case 'moderate': return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'lagging': return 'bg-orange-100 text-orange-900 border-orange-200';
      case 'critical': return 'bg-rose-500 text-white border-rose-600';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      
      {/* Top Header & Visual View Selector */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              Visual Analytics & Inventory Story
            </h3>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            Identify bottleneck stages, inventory cover pressure, category heatmaps, and SKU outliers
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {[
            { id: 'str_vs_cover', label: 'STR & Stock Cover' },
            { id: 'fillrate_trend', label: 'Fill Rate Trajectory' },
            { id: 'waterfall_funnel', label: 'Waterfall Funnel' },
            { id: 'matrix_heatmap', label: 'Category Matrix' },
            { id: 'top_bottom_10', label: 'Top/Bottom 10' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveChartTab(tab.id as any)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                activeChartTab === tab.id
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart Canvas Area */}
      <div className="p-5">

        {/* TAB 1: STR vs. Stock Cover (Dual Y-Axis Composed Chart) */}
        {activeChartTab === 'str_vs_cover' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-4">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
                  Primary Y-Axis: Sell-Through Rate (%)
                </span>
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-purple-600 inline-block" />
                  Secondary Y-Axis: Stock Cover (Weeks of Supply)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                💡 Insight: High stock cover with declining STR reveals overstock choking cash flow.
              </span>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 15, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="left"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#3b82f6', fontWeight: 700 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 'auto']}
                    tick={{ fontSize: 11, fill: '#9333ea', fontWeight: 700 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                    tickFormatter={(v) => `${v} wks`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: any, name: any) => {
                      if (name === 'Sell-Through Rate') return [`${val}%`, name];
                      if (name === 'Stock Cover (Weeks)') return [`${val} Weeks`, name];
                      if (name === 'Target STR Goal') return [`${val}%`, name];
                      return [val, name];
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="str" 
                    name="Sell-Through Rate" 
                    stroke="#2563eb" 
                    strokeWidth={3} 
                    dot={{ r: 3, fill: '#2563eb' }} 
                    activeDot={{ r: 6 }} 
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="targetStr" 
                    name="Target STR Goal" 
                    stroke="#cbd5e1" 
                    strokeDasharray="4 4" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="stockCoverWeeks" 
                    name="Stock Cover (Weeks)" 
                    stroke="#9333ea" 
                    strokeWidth={2.5} 
                    dot={{ r: 3, fill: '#9333ea' }} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 2: Fill Rate Trajectory */}
        {activeChartTab === 'fillrate_trend' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
              <span className="font-bold text-emerald-900">
                Order & Unit Fill Rate SLA Performance (Units Shipped ÷ Units Demanded × 100)
              </span>
              <span className="text-emerald-700 font-bold">
                Overall Period Fill Rate: {analytics.executiveSummary.overallFillRate}%
              </span>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillRateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: '#10b981', fontWeight: 700 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    formatter={(v: any, name: any) => [`${v}%`, name]}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  
                  <Area 
                    type="monotone" 
                    dataKey="fillRate" 
                    name="On-Hand Unit Fill Rate (%)" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#fillRateGrad)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 3: The Waterfall / Funnel */}
        {activeChartTab === 'waterfall_funnel' && (
          <div className="space-y-6">
            <div className="text-xs text-slate-500 font-medium">
              The Inventory Waterfall highlights volume conversion stages and leakage points from stock intake to customer fulfillment.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
              
              {/* Stage 1: Beginning Inventory */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center relative flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">1. Beginning Stock</span>
                <h4 className="text-2xl font-black text-slate-900 my-2">{funnelWaterfall.beginningInventory.toLocaleString()}</h4>
                <span className="text-[11px] text-slate-500 font-medium">Initial on-hand units</span>
              </div>

              {/* Stage 2: Received Inbound */}
              <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200 text-center relative flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">2. Inbound Received</span>
                <h4 className="text-2xl font-black text-blue-900 my-2">+{funnelWaterfall.unitsReceived.toLocaleString()}</h4>
                <span className="text-[11px] text-blue-700 font-medium">Total Avail: {funnelWaterfall.totalAvailable.toLocaleString()}</span>
              </div>

              {/* Stage 3: Units Demanded */}
              <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200 text-center relative flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">3. Customer Demand</span>
                <h4 className="text-2xl font-black text-purple-900 my-2">{funnelWaterfall.unitsDemanded.toLocaleString()}</h4>
                <span className="text-[11px] text-purple-700 font-medium">Order intent recorded</span>
              </div>

              {/* Stage 4: Units Sold / Shipped */}
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 text-center relative flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">4. Units Shipped (Sold)</span>
                <h4 className="text-2xl font-black text-emerald-900 my-2">{funnelWaterfall.unitsShipped.toLocaleString()}</h4>
                <span className="text-[11px] text-emerald-700 font-bold">{analytics.executiveSummary.currentSTR}% STR Conversion</span>
              </div>

              {/* Stage 5: Units Left */}
              <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 text-center relative flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">5. Remaining On-Hand</span>
                <h4 className="text-2xl font-black text-indigo-900 my-2">{funnelWaterfall.unitsLeft.toLocaleString()}</h4>
                <span className="text-[11px] text-indigo-700 font-medium">Carryover inventory</span>
              </div>

            </div>

            {/* Funnel Bottleneck Diagnostic Bar */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Inventory Pipeline Realization</span>
                <span className="text-emerald-400 font-black">{analytics.executiveSummary.currentSTR}% Realized</span>
              </div>
              <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${analytics.executiveSummary.currentSTR}%` }} title="Units Sold" />
                <div className="bg-amber-500 h-full" style={{ width: `${Math.min(10, funnelWaterfall.backordered > 0 ? 5 : 0)}%` }} title="Backorders" />
                <div className="bg-slate-600 h-full flex-1" title="Remaining Stock" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>✅ Units Shipped: {funnelWaterfall.unitsShipped.toLocaleString()}</span>
                <span>⚠️ Backorders / Gaps: {funnelWaterfall.backordered.toLocaleString()} units</span>
                <span>📦 Active Stock Remaining: {funnelWaterfall.unitsLeft.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Category Matrix (Heatmap Grid) */}
        {activeChartTab === 'matrix_heatmap' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-700">
                Department & Category Cross-Channel Sell-Through Performance Matrix
              </span>
              
              {/* Heatmap Legend */}
              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded bg-emerald-500 text-white">≥75% Thriving</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">55-74% Healthy</span>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">40-54% Moderate</span>
                <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800">25-39% Lagging</span>
                <span className="px-2 py-0.5 rounded bg-rose-500 text-white">&lt;25% Critical</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1">
              {categoryHeatmap.map((cell, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-2xs hover:scale-[1.02]",
                    getHeatmapColor(cell.status)
                  )}
                >
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-75">{cell.department}</span>
                      <h5 className="text-xs font-black truncate">{cell.category}</h5>
                    </div>
                    <span className="text-base font-black tracking-tight">{cell.str}%</span>
                  </div>

                  <div className="space-y-1 text-[11px] opacity-90 border-t border-black/10 pt-2">
                    <div className="flex items-center justify-between">
                      <span>Channel:</span>
                      <span className="font-bold truncate max-w-[110px]">{cell.channel}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Units Sold:</span>
                      <span className="font-bold">{cell.unitsSold.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Fill Rate:</span>
                      <span className="font-bold">{cell.fillRate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: Top 10 Winners & Bottom 10 Losers */}
        {activeChartTab === 'top_bottom_10' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTopBottomFilter('all')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg border",
                    topBottomFilter === 'all' ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  Split View (Winners & Losers)
                </button>
                <button
                  type="button"
                  onClick={() => setTopBottomFilter('winners')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg border",
                    topBottomFilter === 'winners' ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  Top 10 Fast Movers (Reorder)
                </button>
                <button
                  type="button"
                  onClick={() => setTopBottomFilter('losers')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg border",
                    topBottomFilter === 'losers' ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  Bottom 10 Stagnant (Markdown)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Winners Column */}
              {(topBottomFilter === 'all' || topBottomFilter === 'winners') && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-emerald-600" />
                      Top 10 Sell-Through Winners (High Velocity)
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Target Replenishment</span>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {topWinners.map((item, i) => (
                      <div key={item.productId || i} className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between text-xs hover:border-emerald-300 transition-colors">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-mono font-bold text-slate-400 mr-2">#{i + 1} {item.sku}</span>
                          <span className="font-bold text-slate-800 truncate block">{item.name}</span>
                          <span className="text-[10px] text-slate-400">{item.category} • {item.daysOfInventory} Days Cover</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-emerald-600 block">{item.sellThroughRate}%</span>
                          <span className="text-[10px] font-semibold text-slate-500">{item.unitsSold} sold / {item.currentStock} stock</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Losers Column */}
              {(topBottomFilter === 'all' || topBottomFilter === 'losers') && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Bottom 10 Stagnant SKUs (Markdown Candidates)
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Aging Risk</span>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {bottomLosers.map((item, i) => (
                      <div key={item.productId || i} className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between text-xs hover:border-rose-300 transition-colors">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-mono font-bold text-slate-400 mr-2">#{i + 1} {item.sku}</span>
                          <span className="font-bold text-slate-800 truncate block">{item.name}</span>
                          <span className="text-[10px] text-slate-400">{item.category} • {item.daysOfInventory} Days Cover</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-rose-600 block">{item.sellThroughRate}%</span>
                          <span className="text-[10px] font-semibold text-slate-500">{item.unitsSold} sold / {item.currentStock} stock</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
