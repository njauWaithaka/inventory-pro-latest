import React, { useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { BarChart3, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ComprehensiveAnalyticsResult } from '../../../lib/comprehensiveAnalyticsService';

interface SalesPerformanceTrendProps {
  analytics: ComprehensiveAnalyticsResult;
  currency?: string;
}

type AggregationInterval = 'daily' | 'weekly' | 'monthly';
type MetricViewMode = 'both' | 'sales' | 'profit';

export function SalesPerformanceTrend({
  analytics,
  currency = 'KSh'
}: SalesPerformanceTrendProps) {
  const [interval, setInterval] = useState<AggregationInterval>('daily');
  const [metricMode, setMetricMode] = useState<MetricViewMode>('both');

  const getChartData = () => {
    switch (interval) {
      case 'weekly':
        return analytics.salesTrendWeekly;
      case 'monthly':
        return analytics.salesTrendMonthly;
      case 'daily':
      default:
        return analytics.salesTrendDaily;
    }
  };

  const chartData = getChartData();
  const totalSalesInPeriod = chartData.reduce((sum, item) => sum + (item.sales || 0), 0);
  const totalProfitInPeriod = chartData.reduce((sum, item) => sum + (item.profit || 0), 0);
  const marginPct = totalSalesInPeriod > 0 ? ((totalProfitInPeriod / totalSalesInPeriod) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm text-left flex flex-col justify-between min-w-0 w-full">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                Gross Sales & Gross Profit Trajectory
              </h3>
            </div>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Historical gross sales revenue and gross profit margins over time
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Mode Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setMetricMode('both')}
                className={cn(
                  "px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all",
                  metricMode === 'both'
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                All Metrics
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('sales')}
                className={cn(
                  "px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all",
                  metricMode === 'sales'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                Gross Sales
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('profit')}
                className={cn(
                  "px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all",
                  metricMode === 'profit'
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                Gross Profit
              </button>
            </div>

            {/* Aggregation Interval Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              {(['daily', 'weekly', 'monthly'] as AggregationInterval[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setInterval(tab)}
                  className={cn(
                    "px-3 py-1 text-[10px] sm:text-xs font-bold rounded-lg capitalize transition-all",
                    interval === tab
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Micro-metrics summary banner */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Gross Sales</span>
            <span className="text-xs sm:text-sm font-black text-blue-600">
              {currency}{Math.round(totalSalesInPeriod).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Gross Profit</span>
            <span className="text-xs sm:text-sm font-black text-emerald-600">
              {currency}{Math.round(totalProfitInPeriod).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Gross Margin</span>
            <span className="text-xs sm:text-sm font-black text-indigo-600">
              {marginPct}%
            </span>
          </div>
        </div>

        {/* Chart Viewport */}
        <div className="h-[240px] sm:h-[280px] md:h-[300px] w-full min-h-[200px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
            <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                dy={10} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                width={40}
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <Tooltip 
                formatter={(val: any, name: any) => [
                  `${currency}${Number(val).toLocaleString()}`, 
                  name === 'Gross Sales' || name === 'sales' ? 'Gross Sales' : 'Gross Profit'
                ]}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                labelStyle={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              
              {(metricMode === 'both' || metricMode === 'sales') && (
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  name="Gross Sales" 
                  stroke="#3b82f6" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#salesGradient)" 
                />
              )}
              
              {(metricMode === 'both' || metricMode === 'profit') && (
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  name="Gross Profit" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#profitGradient)" 
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
