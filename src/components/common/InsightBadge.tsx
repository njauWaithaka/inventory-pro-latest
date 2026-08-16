/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Sparkles, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  Zap, 
  Tag,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDynamicInsights } from '../../contexts/InsightsContext';
import { InsightElementId, InsightSeverity } from '../../lib/dynamicInsightsService';

interface InsightBadgeProps {
  elementId: InsightElementId;
  className?: string;
  variant?: 'pill' | 'banner' | 'card' | 'inline' | 'tileSubtext';
  showIcon?: boolean;
  fallbackText?: string;
  fallbackSeverity?: InsightSeverity;
  label?: string;
}

const severityConfig: Record<
  InsightSeverity,
  {
    bg: string;
    border: string;
    text: string;
    dot: string;
    badgeBg: string;
    icon: React.ComponentType<{ className?: string }>;
    accentLabel: string;
  }
> = {
  green: {
    bg: 'bg-emerald-50/80 hover:bg-emerald-50',
    border: 'border-emerald-200/90',
    text: 'text-emerald-900',
    dot: 'bg-emerald-500',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: Sparkles,
    accentLabel: 'Optimized',
  },
  yellow: {
    bg: 'bg-amber-50/80 hover:bg-amber-50',
    border: 'border-amber-200/90',
    text: 'text-amber-950',
    dot: 'bg-amber-500',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: AlertTriangle,
    accentLabel: 'Action Required',
  },
  red: {
    bg: 'bg-rose-50/80 hover:bg-rose-50',
    border: 'border-rose-200/90',
    text: 'text-rose-950',
    dot: 'bg-rose-500',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: ShieldAlert,
    accentLabel: 'Critical Alert',
  },
  neutral: {
    bg: 'bg-slate-50/80 hover:bg-slate-50',
    border: 'border-slate-200/90',
    text: 'text-slate-800',
    dot: 'bg-blue-500',
    badgeBg: 'bg-blue-100/70 text-blue-800 border-blue-200',
    icon: Zap,
    accentLabel: 'Telemetry',
  },
};

export function InsightBadge({
  elementId,
  className,
  variant = 'banner',
  showIcon = true,
  fallbackText,
  fallbackSeverity = 'neutral',
  label,
}: InsightBadgeProps) {
  const { getInsight, isRegenerating } = useDynamicInsights();
  const insight = getInsight(elementId);

  const severity = insight?.severity || fallbackSeverity;
  const text = insight?.text || fallbackText || 'Analyzing live operational telemetry...';
  const relatedSku = insight?.relatedSku;
  const config = severityConfig[severity] || severityConfig.neutral;
  const Icon = config.icon;

  if (variant === 'pill') {
    return (
      <div
        id={`insight-pill-${elementId}`}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-200 shadow-2xs',
          config.bg,
          config.border,
          config.text,
          isRegenerating && 'animate-pulse opacity-90',
          className
        )}
      >
        {showIcon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate">{text}</span>
        {relatedSku && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/80 border border-current/20 ml-1">
            {relatedSku}
          </span>
        )}
        {isRegenerating && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping ml-1 shrink-0" />
        )}
      </div>
    );
  }

  if (variant === 'tileSubtext') {
    return (
      <div
        id={`insight-subtext-${elementId}`}
        className={cn(
          'flex items-start gap-1.5 text-xs font-medium pt-1.5 border-t border-slate-100 mt-2 transition-all',
          config.text,
          isRegenerating && 'opacity-80 animate-pulse',
          className
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-1.5', config.dot)} />
        <p className="leading-snug flex-1">
          {text}
          {relatedSku && (
            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
              {relatedSku}
            </span>
          )}
        </p>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span
        id={`insight-inline-${elementId}`}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border',
          config.bg,
          config.border,
          config.text,
          className
        )}
      >
        {showIcon && <Icon className="w-3 h-3 shrink-0" />}
        <span>{text}</span>
      </span>
    );
  }

  if (variant === 'card') {
    return (
      <div
        id={`insight-card-${elementId}`}
        className={cn(
          'p-3.5 rounded-2xl border transition-all duration-200 flex flex-col gap-1.5 shadow-2xs',
          config.bg,
          config.border,
          isRegenerating && 'opacity-90 animate-pulse',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={cn('p-1 rounded-lg bg-white/80 border border-current/10 shadow-2xs', config.text)}>
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span className={cn('text-[11px] font-bold uppercase tracking-wider', config.text)}>
              {label || config.accentLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {relatedSku && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs flex items-center gap-1">
                <Tag className="w-2.5 h-2.5 text-slate-400" />
                {relatedSku}
              </span>
            )}
            {isRegenerating && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                Live Sync
              </span>
            )}
          </div>
        </div>

        <p className={cn('text-xs font-medium leading-relaxed', config.text)}>
          {text}
        </p>
      </div>
    );
  }

  // Default: 'banner'
  return (
    <div
      id={`insight-banner-${elementId}`}
      className={cn(
        'px-3.5 py-2.5 rounded-xl border flex items-start sm:items-center justify-between gap-3 text-xs transition-all duration-200 shadow-2xs',
        config.bg,
        config.border,
        isRegenerating && 'opacity-90 animate-pulse',
        className
      )}
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
        {showIcon && (
          <div className={cn('p-1 rounded-lg bg-white/80 border border-current/10 shrink-0 mt-0.5 sm:mt-0', config.text)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
        <div className="min-w-0">
          <p className={cn('font-medium leading-snug', config.text)}>
            {text}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {relatedSku && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs flex items-center gap-1">
            <Tag className="w-2.5 h-2.5 text-slate-400" />
            {relatedSku}
          </span>
        )}
        {isRegenerating && (
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping shrink-0" title="Regenerating insight..." />
        )}
      </div>
    </div>
  );
}
