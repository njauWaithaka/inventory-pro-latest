import React, { useState } from 'react';
import { DollarSign, Package, TrendingUp, Layers, Award } from 'lucide-react';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { ComprehensiveAnalyticsResult } from '../../../lib/comprehensiveAnalyticsService';

interface TopProductsAnalyticsProps {
  analytics: ComprehensiveAnalyticsResult;
  currency?: string;
}

type TopPerspective = 'sales' | 'units' | 'profit' | 'value';

export function TopProductsAnalytics({
  analytics,
  currency = 'KSh'
}: TopProductsAnalyticsProps) {
  const [perspective, setPerspective] = useState<TopPerspective>('sales');

  const getPerspectiveData = () => {
    switch (perspective) {
      case 'units':
        return {
          title: 'Top Products by Units Sold',
          subtitle: 'Highest volume movers driving fulfillment throughput',
          icon: Package,
          items: analytics.topProductsByUnits,
          valueFormatter: (val: number) => `${val.toLocaleString()} units`,
          barColor: 'bg-emerald-500'
        };
      case 'profit':
        return {
          title: 'Top Products by Gross Profit',
          subtitle: 'Highest gross profit generators maximizing bottom line',
          icon: TrendingUp,
          items: analytics.topProductsByProfit,
          valueFormatter: (val: number) => `${currency}${Math.round(val).toLocaleString()}`,
          barColor: 'bg-indigo-500'
        };
      case 'value':
        return {
          title: 'Top Products by Inventory Value',
          subtitle: 'Items holding the largest share of working capital in stock',
          icon: Layers,
          items: analytics.topProductsByInventoryValue,
          valueFormatter: (val: number) => `${currency}${Math.round(val).toLocaleString()}`,
          barColor: 'bg-amber-500'
        };
      case 'sales':
      default:
        return {
          title: 'Top Products by Sales Revenue',
          subtitle: 'Top grossing catalog items driving total revenue',
          icon: DollarSign,
          items: analytics.topProductsBySales,
          valueFormatter: (val: number) => `${currency}${Math.round(val).toLocaleString()}`,
          barColor: 'bg-blue-500'
        };
    }
  };

  const currentView = getPerspectiveData();
  const maxVal = currentView.items.length > 0 ? Math.max(...currentView.items.map(i => i.value), 1) : 1;

  return (
    <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm text-left flex flex-col justify-between min-w-0 w-full">
      <div>
        {/* Header with 4 Perspective Switchers */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                {currentView.title}
              </h3>
            </div>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              {currentView.subtitle}
            </p>
          </div>

          {/* Perspective Selector Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            {[
              { id: 'sales', label: 'By Revenue' },
              { id: 'units', label: 'By Units' },
              { id: 'profit', label: 'By Profit' },
              { id: 'value', label: 'By Capital' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPerspective(tab.id as TopPerspective)}
                className={cn(
                  "px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all",
                  perspective === tab.id
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product Items List */}
        <div className="space-y-4">
          {currentView.items.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs font-medium">
              No products found for this perspective.
            </div>
          ) : (
            currentView.items.map((item, idx) => {
              const barWidth = Math.max(8, Math.min(100, (item.value / maxVal) * 100));

              return (
                <div key={item.id || idx} className="space-y-1.5 group">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:inline">
                        ({item.sku})
                      </span>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-slate-400 hidden xs:inline">
                        {item.subMetric}
                      </span>
                      <span className="font-black text-slate-900 font-mono">
                        {currentView.valueFormatter(item.value)}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-500", currentView.barColor)}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-4 mt-6 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
        <span>Ranking based on selected date period</span>
        <span className="text-blue-600 font-extrabold">Top 5 Performers</span>
      </div>
    </div>
  );
}
