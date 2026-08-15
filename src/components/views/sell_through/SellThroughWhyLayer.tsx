import React from 'react';
import { 
  HelpCircle, Eye, Tag, Clock, Scale, 
  TrendingUp, TrendingDown, AlertTriangle, 
  ShieldAlert, Sparkles, ShoppingCart, DollarSign
} from 'lucide-react';
import { SellThroughAnalysisResult } from '../../../lib/sellThroughService';
import { cn } from '../../../lib/utils';

interface SellThroughWhyLayerProps {
  whyLayer: SellThroughAnalysisResult['whyLayer'];
  currency: string;
}

export function SellThroughWhyLayer({ whyLayer, currency }: SellThroughWhyLayerProps) {
  const { 
    trafficConversionSummary, 
    discountAnalysis, 
    shelfLifeMetrics, 
    competitorPricing, 
    fillRateImpact 
  } = whyLayer;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <HelpCircle className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              The "Why" Layer: Leading Indicators & Context
            </h3>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            Sell-through is a lagging outcome. Diagnose root causes across traffic, conversion, discounting, and competitor pricing.
          </p>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-black border border-purple-100">
          <Sparkles className="w-3.5 h-3.5" />
          Root Cause Engine
        </span>
      </div>

      {/* 4 Quadrants / Diagnostic Cards */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Diagnostic 1: Traffic vs Conversion Matrix */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                Traffic vs Conversion
              </span>
              <span className="text-xs font-bold text-blue-600">
                {trafficConversionSummary.overallAvgConversion}% Conv
              </span>
            </div>
            
            <h4 className="text-sm font-bold text-slate-900 mb-1">
              Merchandising vs Marketing
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              If STR is low with high conversion, drive more traffic (Marketing). If conversion is low, refine pricing/imagery.
            </p>
          </div>

          <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200/60 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">High Traffic / Low Conv:</span>
              <span className="font-bold text-rose-600">{trafficConversionSummary.highTrafficLowConversionCount} SKUs (Price Fix)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Low Traffic / High Conv:</span>
              <span className="font-bold text-indigo-600">{trafficConversionSummary.lowTrafficHighConversionCount} SKUs (Push Ads)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Optimal Velocity:</span>
              <span className="font-bold text-emerald-600">{trafficConversionSummary.highTrafficHighConversionCount} SKUs</span>
            </div>
          </div>
        </div>

        {/* Diagnostic 2: Average Discount & Margin Sacrifice */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                Discount & Margin Impact
              </span>
              <span className="text-xs font-bold text-amber-600">
                {discountAnalysis.overallAvgDiscount}% Avg Disc
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 mb-1">
              Margin vs Velocity Tradeoff
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Assessing whether high sell-through was achieved organically or via margin erosion and markdowns.
            </p>
          </div>

          <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200/60 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Est. Margin Sacrificed:</span>
              <span className="font-bold text-rose-600">{currency}{discountAnalysis.marginErosionEst.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Full Price STR Pace:</span>
              <span className="font-bold text-blue-600">{discountAnalysis.fullPriceSTRPct}%</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Discount-Driven STR:</span>
              <span className="font-bold text-emerald-600">{discountAnalysis.discountedSTRPct}%</span>
            </div>
          </div>
        </div>

        {/* Diagnostic 3: Days to Sell (Shelf Life) */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Shelf Life & Days to Sell
              </span>
              <span className="text-xs font-bold text-indigo-600">
                {shelfLifeMetrics.avgDaysToSell} Days Avg
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 mb-1">
              Time on Shelf
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Average time elapsed for a newly received inventory batch to be 100% liquidated by customer sales.
            </p>
          </div>

          <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200/60 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Fastest Mover Clearance:</span>
              <span className="font-bold text-emerald-600">{shelfLifeMetrics.fastestMovingDays} days</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Slowest Stagnant Unit:</span>
              <span className="font-bold text-rose-600">{shelfLifeMetrics.slowestMovingDays} days</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Target Turnover Cycle:</span>
              <span className="font-bold text-slate-700">30 days</span>
            </div>
          </div>
        </div>

        {/* Diagnostic 4: Competitor Pricing & Fill Rate Bottleneck */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-emerald-600" />
                Competitor Pricing Index
              </span>
              <span className="text-xs font-bold text-slate-700">
                {competitorPricing.avgIndex}x Index
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 mb-1">
              Price Elasticity & Fill Impact
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Comparison against market benchmarks and estimated revenue lost due to stockout backorders.
            </p>
          </div>

          <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200/60 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Lost Rev from Stockouts:</span>
              <span className="font-bold text-rose-600">{currency}{fillRateImpact.lostRevenueFromStockouts.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Overpriced vs Market:</span>
              <span className="font-bold text-amber-600">{competitorPricing.overpricedSKUsCount} SKUs</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Underpriced Advantage:</span>
              <span className="font-bold text-emerald-600">{competitorPricing.underpricedSKUsCount} SKUs</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
