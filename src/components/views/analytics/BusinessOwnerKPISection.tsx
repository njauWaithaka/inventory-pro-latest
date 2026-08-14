import React from 'react';
import { 
  TrendingUp, DollarSign, Package, BarChart3, ShieldCheck, 
  AlertTriangle, RotateCcw, Activity, ShieldAlert, Sparkles, CheckCircle2 
} from 'lucide-react';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { ComprehensiveAnalyticsResult } from '../../../lib/comprehensiveAnalyticsService';

interface BusinessOwnerKPISectionProps {
  analytics: ComprehensiveAnalyticsResult;
  currency?: string;
  selectedPeriod: string;
}

export function BusinessOwnerKPISection({
  analytics,
  currency = 'KSh',
  selectedPeriod
}: BusinessOwnerKPISectionProps) {
  const {
    salesComparison,
    netProfitComparison,
    grossProfitComparison,
    grossMarginPctComparison,
    inventoryValueComparison,
    sellThroughRateComparison,
    turnoverComparison,
    stockCoverageDays,
    stockCoverageStatus,
    stockCoverageLabel,
    hasSufficientSalesData,
    stockAtRiskCount,
    criticalRiskCount,
    lowRiskCount,
    stockAtRiskSummaryString,
    inventoryAccuracyPct,
    hasSufficientCountData,
    accuracyComparison
  } = analytics;

  // Helper for trend badge rendering
  const renderTrendBadge = (
    pctChange: number | null, 
    suffix: string = '%', 
    invertPositive: boolean = false
  ) => {
    if (pctChange === null || isNaN(pctChange)) {
      return (
        <span className="text-[10px] font-bold text-slate-400">
          Prior baseline
        </span>
      );
    }
    
    const isPositive = pctChange >= 0;
    const isGood = invertPositive ? !isPositive : isPositive;
    const colorClass = isGood 
      ? 'text-emerald-700 bg-emerald-50 border-emerald-100' 
      : 'text-rose-700 bg-rose-50 border-rose-100';

    return (
      <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold border leading-none", colorClass)}>
        {isPositive ? '+' : ''}{pctChange.toFixed(1)}{suffix} vs prior
      </span>
    );
  };

  // Stock coverage status badge color
  const getCoverageColorClass = () => {
    switch (stockCoverageStatus) {
      case 'CRITICAL':
        return 'bg-rose-500 text-white';
      case 'LOW':
        return 'bg-amber-500 text-white';
      case 'HEALTHY':
        return 'bg-emerald-500 text-white';
      case 'HIGH COVERAGE':
        return 'bg-blue-500 text-white';
      case 'OVERSTOCKED':
        return 'bg-indigo-500 text-white';
      default:
        return 'bg-slate-200 text-slate-700';
    }
  };

  return (
    <div className="space-y-3 text-left">
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          Executive Business Performance & Inventory KPIs
        </h3>
        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
          {selectedPeriod} Period
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Sales */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            {renderTrendBadge(salesComparison.pctChange)}
          </div>
          <div className="mt-3">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sales</p>
            <p className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5 tracking-tight">
              {currency}{Math.round(salesComparison.current).toLocaleString()}
            </p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1">
              <span>COGS: {currency}{Math.round(analytics.cogsComparison.current).toLocaleString()}</span>
              <span className="font-mono text-[10px]">Prev: {currency}{formatCompactNumber(salesComparison.prior, '')}</span>
            </div>
          </div>
        </div>

        {/* 2. Net Profit */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              {analytics.netMarginPctComparison.current.toFixed(1)}% Net Margin
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Net Profit</p>
            <p className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5 tracking-tight">
              {currency}{Math.round(netProfitComparison.current).toLocaleString()}
            </p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1">
              <span>OpEx (~12%): {currency}{Math.round(salesComparison.current * 0.12).toLocaleString()}</span>
              {renderTrendBadge(netProfitComparison.pctChange)}
            </div>
          </div>
        </div>

        {/* 3. Gross Margin */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            {renderTrendBadge(grossMarginPctComparison.delta, '% margin delta')}
          </div>
          <div className="mt-3">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Margin</p>
            <p className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5 tracking-tight">
              {grossMarginPctComparison.current.toFixed(1)}%
            </p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1">
              <span>Gross Profit: {currency}{Math.round(grossProfitComparison.current).toLocaleString()}</span>
              <span className="font-mono text-[10px]">Prev: {grossMarginPctComparison.prior.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* 4. Total Inventory Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shrink-0">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Current Asset
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Total Inventory Value</p>
            <p className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5 tracking-tight">
              {currency}{Math.round(inventoryValueComparison.current).toLocaleString()}
            </p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1">
              <span>{analytics.totalInventoryUnits.toLocaleString()} units</span>
              <span>{analytics.totalActiveSKUs} active SKUs</span>
            </div>
          </div>
        </div>

        {/* 5. Sell-Through Rate */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 shrink-0">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            {renderTrendBadge(sellThroughRateComparison.delta, '% pts')}
          </div>
          <div className="mt-3">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Sell-Through Rate (STR)</p>
            <p className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5 tracking-tight">
              {sellThroughRateComparison.current.toFixed(1)}%
            </p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1">
              <span>Sold / Available</span>
              <span className="font-mono text-[10px]">Prev: {sellThroughRateComparison.prior.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* 6. Stock Coverage */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className={cn("text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider", getCoverageColorClass())}>
              {stockCoverageStatus}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Stock Coverage</p>
            <p className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5 tracking-tight">
              {stockCoverageDays !== null ? `${stockCoverageDays} days` : 'Insufficient sales data'}
            </p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1">
              <span>{hasSufficientSalesData ? `~${analytics.avgDailyUnitsSold.toFixed(1)} units/day sold` : 'Requires sales logs'}</span>
              <span className="text-[10px] text-slate-400">Target: 15–45d</span>
            </div>
          </div>
        </div>

        {/* 7. Stock at Risk */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 shrink-0">
              <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
              Movement-Aware
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Stock at Risk</p>
            <p className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5 tracking-tight">
              {stockAtRiskCount} SKU{stockAtRiskCount === 1 ? '' : 's'}
            </p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1">
              <span className="text-rose-600 font-bold">{criticalRiskCount} Critical</span>
              <span className="text-amber-600 font-bold">{lowRiskCount} Low</span>
            </div>
          </div>
        </div>

        {/* 8. Stock Turnover / Inventory Accuracy */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            {renderTrendBadge(turnoverComparison.delta, 'x')}
          </div>
          <div className="mt-3">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Stock Turnover</p>
            <p className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5 tracking-tight font-mono">
              {turnoverComparison.current.toFixed(2)}x
            </p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1">
              <span>COGS ÷ Avg Inventory</span>
              <span className="font-mono text-[10px]">Prev: {turnoverComparison.prior.toFixed(2)}x</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
