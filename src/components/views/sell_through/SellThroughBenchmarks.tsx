import React from 'react';
import { 
  Award, TrendingUp, Sparkles, CheckCircle2, 
  ArrowRight, ShieldCheck, HelpCircle, Layers, Activity
} from 'lucide-react';
import { SellThroughAnalysisResult } from '../../../lib/sellThroughService';
import { cn } from '../../../lib/utils';

interface SellThroughBenchmarksProps {
  benchmarks: SellThroughAnalysisResult['benchmarks'];
  currentSTR: number;
}

export function SellThroughBenchmarks({ benchmarks, currentSTR }: SellThroughBenchmarksProps) {
  const industryList = [
    { sector: 'Fashion & Apparel', targetRange: '45% - 55%', avg: 50, note: 'High seasonal turnover, markdown sensitive' },
    { sector: 'FMCG & Essentials', targetRange: '70% - 85%', avg: 78, note: 'High baseline velocity, continuous replenishment' },
    { sector: 'Electronics & Tech', targetRange: '55% - 65%', avg: 60, note: 'Moderate shelf life, depreciation risk' },
    { sector: 'Home & Living', targetRange: '40% - 50%', avg: 46, note: 'Longer deliberation cycle, steady replenishment' }
  ];

  const lifecycleStages = [
    { name: '1. Launch (Wk 1-3)', expectedSTR: '15% - 25%', focus: 'Initial traction & channel placement', color: 'border-blue-300 bg-blue-50/50 text-blue-900' },
    { name: '2. Growth (Wk 4-8)', expectedSTR: '40% - 60%', focus: 'Peak velocity & reorder trigger window', color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900' },
    { name: '3. Maturity (Wk 9-12)', expectedSTR: '65% - 80%', focus: 'Full-price harvest & margin optimization', color: 'border-indigo-300 bg-indigo-50/50 text-indigo-900' },
    { name: '4. Decline / Exit', expectedSTR: '85% - 95%', focus: 'Targeted markdown & terminal clearance', color: 'border-amber-300 bg-amber-50/50 text-amber-900' }
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              The Health & Benchmark Ribbon
            </h3>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Comparative benchmarks across global retail sectors, historical YoY performance, and product lifecycle stages
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black border border-emerald-100">
          <ShieldCheck className="w-3.5 h-3.5" />
          Industry Standard
        </span>
      </div>

      <div className="p-5 space-y-6">
        
        {/* Row 1: Sector Benchmarks vs Current Performance */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            Global Sector STR Benchmarks vs. Current Enterprise Pace ({currentSTR}%)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {industryList.map((item, idx) => {
              const isAboveSector = currentSTR >= item.avg;
              return (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800 text-xs">{item.sector}</span>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                        isAboveSector ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {isAboveSector ? 'Above Sector' : 'Within Range'}
                      </span>
                    </div>
                    <div className="text-xl font-black text-slate-900 my-1">{item.targetRange}</div>
                    <p className="text-[10px] text-slate-500">{item.note}</p>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${item.avg}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 2: Product Lifecycle Stage STR Trajectory Roadmap */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            Product Lifecycle Stage Matrix (Target STR Evolution)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {lifecycleStages.map((stage, idx) => (
              <div key={idx} className={cn("p-4 rounded-xl border flex flex-col justify-between", stage.color)}>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider block opacity-75">{stage.name}</span>
                  <div className="text-xl font-black my-1">{stage.expectedSTR}</div>
                  <p className="text-[11px] font-medium opacity-90 leading-snug">{stage.focus}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
