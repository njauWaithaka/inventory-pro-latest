import React from 'react';
import { 
  AlertTriangle, CheckCircle2, ShieldAlert, AlertCircle, 
  ArrowRight, Sparkles, TrendingUp, DollarSign 
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ComprehensiveAnalyticsResult } from '../../../lib/comprehensiveAnalyticsService';

interface ActionableInsightsSectionProps {
  insights: ComprehensiveAnalyticsResult['actionableInsights'];
  onActionClick?: (tab: string) => void;
}

export function ActionableInsightsSection({
  insights = [],
  onActionClick
}: ActionableInsightsSectionProps) {
  if (insights.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0 mt-0.5" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0 mt-0.5" />;
      default:
        return <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0 mt-0.5" />;
    }
  };

  const getContainerStyle = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-rose-50/70 border-rose-200/80 text-rose-950';
      case 'warning':
        return 'bg-amber-50/70 border-amber-200/80 text-amber-950';
      case 'success':
        return 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950';
      default:
        return 'bg-blue-50/70 border-blue-200/80 text-blue-950';
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm text-left space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-black text-xs">
            AI
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Actionable Business Intelligence & Insights
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Real-time diagnostic observations based on transaction velocity and stock conditions
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline-block">
          {insights.length} Diagnostic Insight{insights.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((insight, idx) => (
          <div 
            key={idx}
            className={cn(
              "p-3.5 sm:p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all",
              getContainerStyle(insight.type)
            )}
          >
            <div className="flex items-start gap-3">
              {getIcon(insight.type)}
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                  {insight.title}
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-700 font-medium mt-1 leading-relaxed">
                  {insight.description}
                </p>
              </div>
            </div>

            {insight.actionLabel && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => onActionClick && onActionClick(insight.actionTab || 'overview')}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-900 bg-white/80 hover:bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs transition-all"
                >
                  <span>{insight.actionLabel}</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
