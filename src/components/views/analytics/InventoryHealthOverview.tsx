import React from 'react';
import { 
  ShieldCheck, AlertTriangle, AlertCircle, Clock, 
  Ban, TrendingUp, Activity, DollarSign, CheckCircle2 
} from 'lucide-react';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { ComprehensiveAnalyticsResult } from '../../../lib/comprehensiveAnalyticsService';

interface InventoryHealthOverviewProps {
  analytics: ComprehensiveAnalyticsResult;
  currency?: string;
}

export function InventoryHealthOverview({
  analytics,
  currency = 'KSh'
}: InventoryHealthOverviewProps) {
  const {
    healthScorePct,
    healthSummaryString,
    healthBreakdown,
    movementCounts,
    slowDeadStockValue,
    slowDeadStockValuePct,
    capitalAtRiskValue,
    capitalAtRiskPct,
    inventoryAccuracyPct,
    hasSufficientCountData,
    inventoryValueComparison
  } = analytics;

  return (
    <div className="space-y-6 text-left">
      {/* 1. Inventory Health Progress & Status Card */}
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                Inventory Health Index & Risk Distribution
              </h3>
            </div>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Holistic catalog health scoring based on coverage adequacy and stock movement velocity
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-black shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {healthScorePct}% Healthy Catalog
          </div>
        </div>

        {/* Multi-segment Health Bar */}
        <div className="space-y-2 mt-4">
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
            {healthBreakdown.healthy.pct > 0 && (
              <div 
                className="h-full bg-emerald-500 transition-all duration-500" 
                style={{ width: `${healthBreakdown.healthy.pct}%` }} 
                title={`Healthy: ${healthBreakdown.healthy.count} SKUs (${healthBreakdown.healthy.pct}%)`}
              />
            )}
            {healthBreakdown.lowStock.pct > 0 && (
              <div 
                className="h-full bg-amber-400 transition-all duration-500" 
                style={{ width: `${healthBreakdown.lowStock.pct}%` }} 
                title={`Low Stock: ${healthBreakdown.lowStock.count} SKUs (${healthBreakdown.lowStock.pct}%)`}
              />
            )}
            {healthBreakdown.critical.pct > 0 && (
              <div 
                className="h-full bg-rose-500 transition-all duration-500" 
                style={{ width: `${healthBreakdown.critical.pct}%` }} 
                title={`Critical: ${healthBreakdown.critical.count} SKUs (${healthBreakdown.critical.pct}%)`}
              />
            )}
            {healthBreakdown.overstocked.pct > 0 && (
              <div 
                className="h-full bg-indigo-500 transition-all duration-500" 
                style={{ width: `${healthBreakdown.overstocked.pct}%` }} 
                title={`Overstocked: ${healthBreakdown.overstocked.count} SKUs (${healthBreakdown.overstocked.pct}%)`}
              />
            )}
          </div>

          {/* Subtitle Breakdown String */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500 pt-1">
            <span className="text-slate-800 font-bold">{healthSummaryString}</span>
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Healthy ({healthBreakdown.healthy.count})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Low ({healthBreakdown.lowStock.count})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Critical ({healthBreakdown.critical.count})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" /> Overstocked ({healthBreakdown.overstocked.count})
              </span>
            </div>
          </div>
        </div>

        {/* 3 Key Health Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
          {/* Slow / Dead Stock Value */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">Slow / Dead Stock Value</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <p className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                {currency}{Math.round(slowDeadStockValue).toLocaleString()}
              </p>
            </div>
            <p className="text-[11px] font-semibold text-amber-700 mt-2">
              {slowDeadStockValuePct}% of total inventory capital is locked in non-moving items.
            </p>
          </div>

          {/* Inventory Capital at Risk */}
          <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-tight">Inventory Capital at Risk</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <p className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                {currency}{Math.round(capitalAtRiskValue).toLocaleString()}
              </p>
            </div>
            <p className="text-[11px] font-semibold text-rose-700 mt-2">
              {capitalAtRiskPct}% of inventory value subject to stockout loss or severe overstocking.
            </p>
          </div>

          {/* Inventory Accuracy */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Inventory Accuracy</span>
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <p className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                {hasSufficientCountData && inventoryAccuracyPct !== null 
                  ? `${inventoryAccuracyPct.toFixed(1)}%` 
                  : 'Not enough count data'}
              </p>
            </div>
            <p className="text-[11px] font-medium text-slate-500 mt-2">
              {hasSufficientCountData 
                ? 'Derived from physical count reconciliations and audit variance logs.' 
                : 'Not enough count/reconciliation data to compute physical count accuracy.'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Fast / Moderate / Slow / Obsolete Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Fast Moving</span>
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900">{movementCounts.fast.count} SKUs</p>
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mt-1">
            <span>{movementCounts.fast.pct}% of catalog</span>
            <span className="font-mono">{formatCompactNumber(movementCounts.fast.value, currency)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Moderate Moving</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900">{movementCounts.moderate.count} SKUs</p>
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mt-1">
            <span>{movementCounts.moderate.pct}% of catalog</span>
            <span className="font-mono">{formatCompactNumber(movementCounts.moderate.value, currency)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Slow Moving</span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900">{movementCounts.slow.count} SKUs</p>
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mt-1">
            <span>{movementCounts.slow.pct}% of catalog</span>
            <span className="font-mono">{formatCompactNumber(movementCounts.slow.value, currency)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Obsolete / Dead</span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900">{movementCounts.obsolete.count} SKUs</p>
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mt-1">
            <span>{movementCounts.obsolete.pct}% of catalog</span>
            <span className="font-mono">{formatCompactNumber(movementCounts.obsolete.value, currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
