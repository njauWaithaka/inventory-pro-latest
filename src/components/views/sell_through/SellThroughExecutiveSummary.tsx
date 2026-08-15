import React from 'react';
import { 
  Percent, TrendingUp, TrendingDown, Target, CheckCircle2, 
  AlertTriangle, AlertCircle, PackageCheck, ShoppingCart, 
  Truck, ArrowUpRight, ArrowDownRight, Clock, ShieldAlert,
  HelpCircle, BarChart3, Layers
} from 'lucide-react';
import { SellThroughAnalysisResult } from '../../../lib/sellThroughService';
import { cn } from '../../../lib/utils';

interface SellThroughExecutiveSummaryProps {
  summary: SellThroughAnalysisResult['executiveSummary'];
  currency: string;
}

export function SellThroughExecutiveSummary({ summary, currency }: SellThroughExecutiveSummaryProps) {
  const isAboveTarget = summary.strVsTarget >= 0;
  const isPriorPositive = summary.strVsPriorPeriod >= 0;
  const isFillRateAboveTarget = summary.fillRateVsTarget >= 0;

  // Status color mappings
  const healthBadgeConfig = {
    excellent: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500 ring-emerald-300',
      label: 'Optimal Pace',
      desc: 'Sell-through is exceeding baseline targets'
    },
    good: {
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-500 ring-blue-300',
      label: 'On Target Pace',
      desc: 'Balanced inventory velocity across channels'
    },
    warning: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500 ring-amber-300',
      label: 'Pace Lagging',
      desc: 'Stock velocity is falling behind season targets'
    },
    critical: {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      dot: 'bg-rose-500 ring-rose-300',
      label: 'Critical Bottleneck',
      desc: 'Severe inventory aging and low sell-through'
    }
  }[summary.healthStatus];

  return (
    <div className="space-y-4">
      {/* 4 Primary Headline KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Current STR (Period-to-Date) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none group-hover:bg-blue-100/50 transition-colors" />
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-blue-600" />
              Current STR (PTD)
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100">
              Period-to-Date
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {summary.currentSTR}%
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              ({summary.totalUnitsSold.toLocaleString()} / {(summary.totalUnitsOnHand + summary.totalUnitsSold).toLocaleString()} units)
            </span>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Revenue Realized</span>
              <span className="font-bold text-slate-800">{currency}{summary.totalRevenue.toLocaleString()}</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, summary.currentSTR)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Card 2: STR vs Target Gauge */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none group-hover:bg-indigo-100/50 transition-colors" />
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-600" />
              STR vs. Target
            </span>
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border",
              isAboveTarget 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}>
              {isAboveTarget ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isAboveTarget ? `+${summary.strVsTarget}%` : `${summary.strVsTarget}%`}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {summary.targetSTR}%
            </h3>
            <span className="text-xs font-semibold text-slate-500">Target Goal</span>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Progress to Target</span>
              <span className="font-bold text-slate-800">
                {isAboveTarget ? 'Goal Achieved' : `${Math.abs(summary.strVsTarget)}% Gap`}
              </span>
            </div>
            <div className="relative w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all duration-500", isAboveTarget ? "bg-emerald-500" : "bg-amber-500")}
                style={{ width: `${Math.min(100, (summary.currentSTR / (summary.targetSTR || 1)) * 100)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Card 3: STR vs. Prior Period & Health */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50/50 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none group-hover:bg-purple-100/50 transition-colors" />
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              Velocity & Prior Delta
            </span>
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border",
              isPriorPositive 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-rose-50 text-rose-700 border-rose-200"
            )}>
              {isPriorPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {isPriorPositive ? `+${summary.strVsPriorPeriod}%` : `${summary.strVsPriorPeriod}%`} MoM
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {summary.avgWeeksOfSupply} <span className="text-sm font-bold text-slate-500">Wks</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">Stock Cover</span>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border w-full justify-center", healthBadgeConfig.bg)}>
              <span className={cn("w-2 h-2 rounded-full ring-2", healthBadgeConfig.dot)} />
              <span>{healthBadgeConfig.label}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Order & Unit Fill Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none group-hover:bg-emerald-100/50 transition-colors" />
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
              Order & Unit Fill Rate
            </span>
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border",
              isFillRateAboveTarget 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}>
              Target: {summary.targetFillRate}%
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {summary.overallFillRate}%
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              ({summary.totalUnitsShipped.toLocaleString()} / {summary.totalUnitsDemanded.toLocaleString()} shipped)
            </span>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Backorders / Loss</span>
              <span className={cn("font-bold", summary.backorderedUnits > 0 ? "text-rose-600" : "text-emerald-600")}>
                {summary.backorderedUnits > 0 ? `${summary.backorderedUnits} units (${currency}${summary.lostSalesValue.toLocaleString()})` : 'Zero Backorders'}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, summary.overallFillRate)}%` }} 
              />
            </div>
          </div>
        </div>

      </div>

      {/* Sub-Banner Strip: Key Inventory Flow Numbers */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-slate-900/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Inventory Throughput Formula</div>
            <div className="text-sm font-bold text-slate-200">
              Units Sold ({summary.totalUnitsSold.toLocaleString()}) ÷ Total Available ({(summary.totalUnitsOnHand + summary.totalUnitsSold).toLocaleString()}) = <span className="text-blue-400 font-black">{summary.currentSTR}% STR</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-300">
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
            <span className="text-slate-400 mr-1.5">Units Demanded:</span>
            <strong className="text-white font-mono">{summary.totalUnitsDemanded.toLocaleString()}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
            <span className="text-slate-400 mr-1.5">Units Shipped:</span>
            <strong className="text-emerald-400 font-mono">{summary.totalUnitsShipped.toLocaleString()}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
            <span className="text-slate-400 mr-1.5">On-Hand Stock:</span>
            <strong className="text-indigo-400 font-mono">{summary.totalUnitsOnHand.toLocaleString()}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
