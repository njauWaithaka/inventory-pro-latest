import React, { useState } from 'react';
import { 
  Sliders, TrendingUp, Sparkles, DollarSign, 
  AlertTriangle, CheckCircle2, ShieldAlert, ArrowRight, 
  ShoppingBag, Target, RefreshCw, Layers
} from 'lucide-react';
import { SellThroughAnalysisResult, ProductSellThroughRow } from '../../../lib/sellThroughService';
import { cn } from '../../../lib/utils';

interface SellThroughWhatIfModuleProps {
  analytics: SellThroughAnalysisResult;
  currency: string;
}

export function SellThroughWhatIfModule({ analytics, currency }: SellThroughWhatIfModuleProps) {
  const [discountPercent, setDiscountPercent] = useState<number>(15);
  const [targetFillRateGoal, setTargetFillRateGoal] = useState<number>(98);

  const { executiveSummary, bottomLosers, topWinners } = analytics;

  // 1. Markdown Simulation Calculation
  // Price elasticity assumption: each 10% markdown yields ~18% velocity lift
  const elasticityFactor = 1.8;
  const projectedSTRLift = Number((discountPercent * elasticityFactor * 0.7).toFixed(1));
  const slowMoversStockValue = bottomLosers.reduce((sum, r) => sum + r.stockValue, 0);
  const slowMoversUnits = bottomLosers.reduce((sum, r) => sum + r.currentStock, 0);
  const projectedUnitsLiquidated = Math.round(slowMoversUnits * ((projectedSTRLift + 20) / 100));
  const avgSlowPrice = bottomLosers.length > 0 ? (bottomLosers.reduce((sum, r) => sum + r.price, 0) / bottomLosers.length) : 40;
  const discountedPrice = avgSlowPrice * (1 - discountPercent / 100);
  const projectedCashUnlocked = Math.round(projectedUnitsLiquidated * discountedPrice);

  // 2. End-of-Period Run-Rate Projection
  const currentPaceSTR = executiveSummary.currentSTR;
  const projectedFinalSTR = Number(Math.min(98, currentPaceSTR * 1.25).toFixed(1));
  const targetSTR = executiveSummary.targetSTR;
  const projectedPaceGap = Number((projectedFinalSTR - targetSTR).toFixed(1));

  // 3. Reorder Point (ROP) Live Triggers
  const urgentReorderSKUs = topWinners.filter(r => r.daysOfInventory <= 14);

  // 4. Fill Rate Safety Stock Calculator
  const currentFill = executiveSummary.overallFillRate;
  const fillRateGap = Math.max(0, targetFillRateGoal - currentFill);
  const extraSafetyUnitsNeeded = Math.round((executiveSummary.totalUnitsDemanded * (fillRateGap / 100)) * 1.15);
  const estimatedSafetyStockCost = Math.round(extraSafetyUnitsNeeded * (executiveSummary.totalCogs / Math.max(1, executiveSummary.totalUnitsSold || 1)));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      
      {/* Module Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              Interactive "What-If" Simulation & Predictive Planning
            </h3>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            Test markdown elasticity scenarios, project season-end STR run-rates, and simulate safety stock for 98%+ SLA fill rates.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black border border-indigo-100">
          <Sparkles className="w-3.5 h-3.5" />
          Interactive Sandbox
        </span>
      </div>

      {/* Grid of 3 Interactive Simulators */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Simulator 1: Markdown Elasticity Simulator */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                1. Markdown Simulator
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                Slow-Movers Focus
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 mb-1">
              Test Price Reduction Elasticity
            </h4>
            <p className="text-[11px] text-slate-500 mb-4">
              Simulate cash flow unlock on {bottomLosers.length} stagnant SKUs by applying a targeted promotional discount.
            </p>

            {/* Slider */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">Simulated Markdown:</span>
                <span className="text-amber-600 font-mono text-sm">{discountPercent}% OFF</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                <span>5% Gentle</span>
                <span>25% Moderate</span>
                <span>50% Clearance</span>
              </div>
            </div>

            {/* Simulated Output Cards */}
            <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Projected STR Lift:</span>
                <span className="font-bold text-emerald-600">+{projectedSTRLift}% Velocity</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Units Liquidated:</span>
                <span className="font-bold text-slate-800">~{projectedUnitsLiquidated.toLocaleString()} units</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 font-bold">
                <span className="text-slate-700">Projected Cash Recovered:</span>
                <span className="text-indigo-600 font-mono">{currency}{projectedCashUnlocked.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Simulator 2: End-of-Period Season Run-Rate */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                2. Run-Rate Projection
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                Season Forecast
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 mb-1">
              End-of-Period STR Trajectory
            </h4>
            <p className="text-[11px] text-slate-500 mb-4">
              Linear trend forecast extending current sales velocity through remaining days in the selling cycle.
            </p>

            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Current PTD Realization:</span>
                <span className="text-xs font-bold text-slate-800">{currentPaceSTR}%</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Projected Final STR:</span>
                <span className="text-base font-black text-blue-600">{projectedFinalSTR}%</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Target Benchmark:</span>
                <span className="text-xs font-bold text-slate-700">{targetSTR}%</span>
              </div>

              <div className={cn(
                "p-2.5 rounded-lg text-xs font-bold flex items-center gap-2 border",
                projectedPaceGap >= 0 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                  : "bg-rose-50 text-rose-700 border-rose-200"
              )}>
                {projectedPaceGap >= 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                <span>
                  {projectedPaceGap >= 0 
                    ? `On track to beat goal by +${projectedPaceGap}%` 
                    : `Projected ${Math.abs(projectedPaceGap)}% short of target`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Simulator 3: Fill Rate & Safety Stock Planner */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                3. Fill Rate & Safety Stock
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                SLA Optimizer
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 mb-1">
              Safety Stock for Target Fill Rate
            </h4>
            <p className="text-[11px] text-slate-500 mb-3">
              Calculate extra buffer units required to eliminate stockouts and elevate on-hand fulfillment SLA.
            </p>

            {/* Target Slider */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">Target Fill Rate SLA:</span>
                <span className="text-emerald-600 font-mono text-sm">{targetFillRateGoal}%</span>
              </div>
              <input
                type="range"
                min="90"
                max="99"
                step="1"
                value={targetFillRateGoal}
                onChange={(e) => setTargetFillRateGoal(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
              />
            </div>

            <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Current Fill Rate:</span>
                <span className="font-bold text-slate-800">{currentFill}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Extra Buffer Units Needed:</span>
                <span className="font-bold text-emerald-600">+{extraSafetyUnitsNeeded.toLocaleString()} units</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 font-bold">
                <span className="text-slate-700">Estimated Working Capital:</span>
                <span className="text-blue-600 font-mono">{currency}{estimatedSafetyStockCost.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Live Reorder Point Alert Banner (Fast Movers at Risk of Stockout) */}
      {urgentReorderSKUs.length > 0 && (
        <div className="p-4 bg-amber-500/10 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <strong className="font-bold">Reorder Point (ROP) Triggers Detected:</strong>{' '}
              <span>{urgentReorderSKUs.length} fast-moving SKUs have &le;14 days of inventory left. Replenishment POs recommended immediately to prevent Fill Rate drop.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono font-bold">
            {urgentReorderSKUs.slice(0, 3).map(r => (
              <span key={r.productId} className="px-2 py-0.5 bg-amber-100 border border-amber-300 rounded text-[10px]">
                {r.sku} ({r.daysOfInventory}d left)
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
