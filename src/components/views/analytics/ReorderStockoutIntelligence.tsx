import React, { useState } from 'react';
import { 
  AlertTriangle, ShieldAlert, Package, ShoppingCart, 
  ArrowRight, Clock, CheckCircle2, ChevronRight 
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ComprehensiveAnalyticsResult } from '../../../lib/comprehensiveAnalyticsService';

interface ReorderStockoutIntelligenceProps {
  analytics: ComprehensiveAnalyticsResult;
  currency?: string;
  onNavigateToProcurement?: (sku?: string) => void;
}

export function ReorderStockoutIntelligence({
  analytics,
  currency = 'KSh',
  onNavigateToProcurement
}: ReorderStockoutIntelligenceProps) {
  const { stockoutRiskBreakdown, reorderOpportunities } = analytics;
  const [selectedTimeline, setSelectedTimeline] = useState<'critical' | '7days' | '14days' | '30days'>('critical');

  const getTimelineData = () => {
    switch (selectedTimeline) {
      case '7days':
        return {
          title: 'Stockout Projected within 7 Days',
          badge: 'High Urgency',
          color: 'text-amber-700 bg-amber-50 border-amber-200',
          items: stockoutRiskBreakdown.next7Days
        };
      case '14days':
        return {
          title: 'Stockout Projected within 14 Days',
          badge: 'Replenishment Window',
          color: 'text-blue-700 bg-blue-50 border-blue-200',
          items: stockoutRiskBreakdown.next14Days
        };
      case '30days':
        return {
          title: 'Stockout Projected within 30 Days',
          badge: 'Planning Horizon',
          color: 'text-slate-700 bg-slate-50 border-slate-200',
          items: stockoutRiskBreakdown.next30Days
        };
      case 'critical':
      default:
        return {
          title: 'Immediate Stockout / Depleted (0-3 Days)',
          badge: 'Critical Stockout',
          color: 'text-rose-700 bg-rose-50 border-rose-200',
          items: stockoutRiskBreakdown.criticalNow
        };
    }
  };

  const currentTimeline = getTimelineData();

  return (
    <div className="space-y-6 text-left">
      {/* 1. Stockout Risk Overview & Horizon Cards */}
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                Estimated Stockout Horizon & Demand Velocity
              </h3>
            </div>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Runout estimations derived from current inventory ÷ average daily sales demand
            </p>
          </div>
        </div>

        {/* 4 Timeline Selector Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { id: 'critical', label: 'Critical / 0-3d', count: stockoutRiskBreakdown.criticalNow.length, color: 'text-rose-600', border: 'border-rose-200 hover:border-rose-400', bg: 'bg-rose-50/50' },
            { id: '7days', label: 'Next 7 Days', count: stockoutRiskBreakdown.next7Days.length, color: 'text-amber-600', border: 'border-amber-200 hover:border-amber-400', bg: 'bg-amber-50/50' },
            { id: '14days', label: 'Next 14 Days', count: stockoutRiskBreakdown.next14Days.length, color: 'text-blue-600', border: 'border-blue-200 hover:border-blue-400', bg: 'bg-blue-50/50' },
            { id: '30days', label: 'Next 30 Days', count: stockoutRiskBreakdown.next30Days.length, color: 'text-slate-600', border: 'border-slate-200 hover:border-slate-400', bg: 'bg-slate-50/50' },
          ].map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedTimeline(card.id as any)}
              className={cn(
                "p-3.5 sm:p-4 rounded-xl border text-left transition-all",
                card.border,
                selectedTimeline === card.id 
                  ? "ring-2 ring-blue-500 bg-white shadow-sm" 
                  : card.bg
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight">
                  {card.label}
                </span>
                <span className={cn("text-lg sm:text-xl font-black", card.color)}>
                  {card.count}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">
                {card.count === 1 ? '1 SKU at risk' : `${card.count} SKUs at risk`}
              </p>
            </button>
          ))}
        </div>

        {/* Selected Horizon Product List */}
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-black text-slate-900">
              {currentTimeline.title}
            </span>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", currentTimeline.color)}>
              {currentTimeline.badge} ({currentTimeline.items.length})
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto">
            {currentTimeline.items.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-medium">
                No items currently projected to stock out in this time horizon.
              </div>
            ) : (
              currentTimeline.items.map((prod, idx) => (
                <div key={prod.id || idx} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs truncate max-w-[220px]">
                        {prod.name || prod.productName}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {prod.sku}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500 mt-1">
                      <span>Category: {prod.category || 'General'}</span>
                      <span>•</span>
                      <span>Stock: <strong className="text-slate-900">{prod.quantity || 0} units</strong></span>
                      <span>•</span>
                      <span>Daily Demand: <strong className="text-slate-900">{Number(prod.dailyDemand || 0).toFixed(1)}/day</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-right">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Stock Remaining</span>
                      <span className="text-xs font-black text-rose-600 font-mono">
                        {prod.coverageDays !== null ? `${prod.coverageDays} days` : 'Depleted'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 2. Reorder Opportunities ("REORDER NOW") Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                Reorder Opportunities & Suggested Quantities
              </h3>
            </div>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Products where stock is below reorder point or replenishment lead-time threshold
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold rounded-lg w-fit shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            {reorderOpportunities.length} SKU{reorderOpportunities.length === 1 ? '' : 's'} Reorder Ready
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Product Info</th>
                <th className="px-6 py-4 text-right">Current Stock</th>
                <th className="px-6 py-4 text-right">Avg Daily Sales</th>
                <th className="px-6 py-4 text-right">Days Coverage</th>
                <th className="px-6 py-4 text-right">Reorder Level</th>
                <th className="px-6 py-4 text-right">Suggested Reorder Qty</th>
                <th className="px-6 py-4 text-center">Urgency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reorderOpportunities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400 text-xs font-medium">
                    All inventory is currently above minimum reorder thresholds.
                  </td>
                </tr>
              ) : (
                reorderOpportunities.slice(0, 10).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                          {item.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                          SKU: {item.sku} • {item.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900 font-mono text-xs">
                      {item.currentStock} units
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-600 font-mono text-xs">
                      {item.averageDailyDemand.toFixed(2)}/day
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold font-mono text-xs">
                      <span className={cn(
                        item.daysOfStockRemaining !== null && item.daysOfStockRemaining <= 3 
                          ? "text-rose-600" 
                          : "text-amber-600"
                      )}>
                        {item.daysOfStockRemaining !== null ? `${item.daysOfStockRemaining} days` : '0 days'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-500 font-mono text-xs">
                      {item.reorderPoint} units
                    </td>
                    <td className="px-6 py-4 text-right font-black text-blue-600 font-mono text-xs">
                      +{item.suggestedOrderQuantity} units
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "text-[9px] font-black uppercase px-2 py-0.5 rounded border tracking-wider",
                        item.orderUrgency === 'CRITICAL'
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {item.orderUrgency === 'CRITICAL' ? 'CRITICAL' : 'REORDER NOW'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-bold text-slate-400">
          <span>Showing {Math.min(10, reorderOpportunities.length)} of {reorderOpportunities.length} reorder opportunities</span>
          <span className="font-mono text-blue-600 font-black">
            Suggested Reorder Qty = (Reorder Point - Current Stock) + (14-Day Cycle Demand)
          </span>
        </div>
      </div>
    </div>
  );
}
