/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  Zap, 
  Tag,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useDynamicInsights } from '../../contexts/InsightsContext';
import { DynamicInsight, InsightElementId, InsightSeverity } from '../../lib/dynamicInsightsService';

interface InsightBadgeProps {
  elementId?: InsightElementId;
  insights?: DynamicInsight[];
  className?: string;
  variant?: 'pill' | 'banner' | 'card' | 'inline' | 'tileSubtext' | 'compact';
  showIcon?: boolean;
  fallbackText?: string;
  fallbackSeverity?: InsightSeverity;
  label?: string;
  intervalMs?: number;
  showControls?: boolean;
  showDots?: boolean;
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
    bg: 'bg-emerald-50/80 hover:bg-emerald-50/95',
    border: 'border-emerald-200/90',
    text: 'text-emerald-950',
    dot: 'bg-emerald-500',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: Sparkles,
    accentLabel: 'Optimized',
  },
  yellow: {
    bg: 'bg-amber-50/80 hover:bg-amber-50/95',
    border: 'border-amber-200/90',
    text: 'text-amber-950',
    dot: 'bg-amber-500',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: AlertTriangle,
    accentLabel: 'Action Required',
  },
  red: {
    bg: 'bg-rose-50/80 hover:bg-rose-50/95',
    border: 'border-rose-200/90',
    text: 'text-rose-950',
    dot: 'bg-rose-500',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: ShieldAlert,
    accentLabel: 'Critical Alert',
  },
  neutral: {
    bg: 'bg-slate-50/80 hover:bg-slate-50/95',
    border: 'border-slate-200/90',
    text: 'text-slate-900',
    dot: 'bg-blue-500',
    badgeBg: 'bg-blue-100/70 text-blue-800 border-blue-200',
    icon: Zap,
    accentLabel: 'Live Telemetry',
  },
};

export function InsightBadge({
  elementId,
  insights: customInsights,
  className,
  variant = 'banner',
  showIcon = true,
  fallbackText,
  fallbackSeverity = 'neutral',
  label,
  intervalMs = 6500,
  showControls = true,
  showDots = true,
}: InsightBadgeProps) {
  const { getInsightsList, isRegenerating } = useDynamicInsights();
  
  // Resolve list of insights to cycle through
  const insightsList: DynamicInsight[] = React.useMemo(() => {
    if (customInsights && customInsights.length > 0) {
      return customInsights;
    }
    if (elementId) {
      return getInsightsList(elementId);
    }
    return [
      {
        elementId: 'dashboard_executive_kpis',
        severity: fallbackSeverity,
        text: fallbackText || 'Monitoring live inventory telemetry.',
        relatedSku: null,
      },
    ];
  }, [customInsights, elementId, getInsightsList, fallbackSeverity, fallbackText]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const totalCount = Math.max(insightsList.length, 1);

  // Keep index within bounds if list shrinks
  useEffect(() => {
    if (currentIndex >= totalCount) {
      setCurrentIndex(0);
    }
  }, [currentIndex, totalCount]);

  // Automatic cycling timer (pauses on hover)
  useEffect(() => {
    if (totalCount <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalCount);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [totalCount, isPaused, intervalMs]);

  const currentInsight: DynamicInsight = insightsList[currentIndex] || {
    elementId: elementId || 'dashboard_executive_kpis',
    severity: fallbackSeverity,
    text: fallbackText || 'Monitoring live inventory telemetry.',
    relatedSku: null,
  };

  const severity = currentInsight.severity || fallbackSeverity;
  const config = severityConfig[severity] || severityConfig.neutral;
  const Icon = config.icon;
  const activeLabel = currentInsight.label || label || config.accentLabel;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + totalCount) % totalCount);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % totalCount);
  };

  // --- 1. PILL VARIANT ---
  if (variant === 'pill') {
    return (
      <div
        id={elementId ? `insight-pill-${elementId}` : 'insight-pill'}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200 shadow-2xs group relative overflow-hidden',
          config.bg,
          config.border,
          config.text,
          isRegenerating && 'animate-pulse opacity-90',
          className
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`pill-${currentIndex}-${currentInsight.text}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="inline-flex items-center gap-1.5"
          >
            {showIcon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate max-w-[280px] sm:max-w-md">{currentInsight.text}</span>
            {currentInsight.relatedSku && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/90 border border-current/20 ml-1 shrink-0">
                {currentInsight.relatedSku}
              </span>
            )}
          </motion.div>
        </AnimatePresence>

        {totalCount > 1 && (
          <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-current/15 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
            <span className="text-[10px] font-mono">
              {currentIndex + 1}/{totalCount}
            </span>
          </div>
        )}
      </div>
    );
  }

  // --- 2. TILE SUBTEXT VARIANT ---
  if (variant === 'tileSubtext') {
    return (
      <div
        id={elementId ? `insight-subtext-${elementId}` : 'insight-subtext'}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={cn(
          'flex items-start gap-1.5 text-xs font-medium pt-1.5 border-t border-slate-100 mt-2 transition-all relative overflow-hidden min-h-[38px]',
          config.text,
          isRegenerating && 'opacity-80 animate-pulse',
          className
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 transition-colors duration-300', config.dot)} />
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`subtext-${currentIndex}-${currentInsight.text}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <p className="leading-snug">
                {currentInsight.text}
                {currentInsight.relatedSku && (
                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                    {currentInsight.relatedSku}
                  </span>
                )}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // --- 3. INLINE VARIANT ---
  if (variant === 'inline') {
    return (
      <span
        id={elementId ? `insight-inline-${elementId}` : 'insight-inline'}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border relative overflow-hidden',
          config.bg,
          config.border,
          config.text,
          className
        )}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={`inline-${currentIndex}-${currentInsight.text}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className="inline-flex items-center gap-1"
          >
            {showIcon && <Icon className="w-3 h-3 shrink-0" />}
            <span>{currentInsight.text}</span>
          </motion.span>
        </AnimatePresence>
      </span>
    );
  }

  // --- 4. COMPACT ROTATOR VARIANT ---
  if (variant === 'compact') {
    return (
      <div
        id={elementId ? `insight-compact-${elementId}` : 'insight-compact'}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={cn(
          'px-3 py-2 rounded-xl border flex items-center justify-between gap-2.5 text-xs transition-all duration-200 shadow-2xs group',
          config.bg,
          config.border,
          className
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showIcon && (
            <span className={cn('p-1 rounded-md bg-white/80 border border-current/10 shrink-0 shadow-2xs', config.text)}>
              <Icon className="w-3 h-3" />
            </span>
          )}
          <div className="flex-1 min-w-0 relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={`compact-${currentIndex}-${currentInsight.text}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={cn('font-medium truncate', config.text)}
              >
                <strong className="font-bold mr-1">{activeLabel}:</strong>
                {currentInsight.text}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {totalCount > 1 && showControls && (
          <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handlePrev}
              className="p-0.5 rounded hover:bg-black/5 text-current"
              title="Previous insight"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono font-semibold">
              {currentIndex + 1}/{totalCount}
            </span>
            <button
              onClick={handleNext}
              className="p-0.5 rounded hover:bg-black/5 text-current"
              title="Next insight"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- 5. CARD VARIANT ---
  if (variant === 'card') {
    return (
      <div
        id={elementId ? `insight-card-${elementId}` : 'insight-card'}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={cn(
          'p-3.5 rounded-2xl border transition-all duration-200 flex flex-col gap-2 shadow-2xs relative group',
          config.bg,
          config.border,
          isRegenerating && 'opacity-90 animate-pulse',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={cn('p-1.5 rounded-lg bg-white/85 border border-current/10 shadow-2xs', config.text)}>
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span className={cn('text-[11px] font-black uppercase tracking-wider', config.text)}>
              {activeLabel}
            </span>
            {currentInsight.metricValue && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/90 border border-current/10 text-slate-700">
                {currentInsight.metricValue}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {currentInsight.relatedSku && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs flex items-center gap-1">
                <Tag className="w-2.5 h-2.5 text-slate-400" />
                {currentInsight.relatedSku}
              </span>
            )}

            {totalCount > 1 && (
              <div className="flex items-center gap-1 ml-1 bg-white/70 px-1.5 py-0.5 rounded-full border border-current/10">
                <button
                  onClick={handlePrev}
                  className="p-0.5 rounded hover:bg-black/5 text-slate-600 transition-colors"
                  title="Previous insight"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-mono font-bold text-slate-700">
                  {currentIndex + 1}/{totalCount}
                </span>
                <button
                  onClick={handleNext}
                  className="p-0.5 rounded hover:bg-black/5 text-slate-600 transition-colors"
                  title="Next insight"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden min-h-[44px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`card-${currentIndex}-${currentInsight.text}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <p className={cn('text-xs font-medium leading-relaxed', config.text)}>
                {currentInsight.text}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {totalCount > 1 && showDots && (
          <div className="flex items-center gap-1 pt-1 justify-end">
            {insightsList.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={cn(
                  'h-1 rounded-full transition-all duration-300',
                  idx === currentIndex
                    ? cn('w-4', config.dot)
                    : 'w-1.5 bg-black/15 hover:bg-black/30'
                )}
                title={`Switch to insight ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- 6. DEFAULT BANNER VARIANT (Full Featured Rotator) ---
  return (
    <div
      id={elementId ? `insight-banner-${elementId}` : 'insight-banner'}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={cn(
        'px-3.5 py-2.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-all duration-200 shadow-2xs group relative overflow-hidden',
        config.bg,
        config.border,
        isRegenerating && 'opacity-90 animate-pulse',
        className
      )}
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1 w-full">
        {showIcon && (
          <div className={cn('p-1.5 rounded-lg bg-white/90 border border-current/10 shrink-0 mt-0.5 sm:mt-0 shadow-2xs', config.text)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
        <div className="min-w-0 flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`banner-${currentIndex}-${currentInsight.text}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5"
            >
              <span className={cn('text-[11px] font-black uppercase tracking-wider shrink-0', config.text)}>
                {activeLabel}:
              </span>
              <p className={cn('font-medium leading-snug inline', config.text)}>
                {currentInsight.text}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {currentInsight.metricValue && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/80 text-slate-800 border border-slate-200 shadow-2xs">
            {currentInsight.metricValue}
          </span>
        )}

        {currentInsight.relatedSku && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs flex items-center gap-1">
            <Tag className="w-2.5 h-2.5 text-slate-400" />
            {currentInsight.relatedSku}
          </span>
        )}

        {/* Carousel indicator & controls */}
        {totalCount > 1 && (
          <div className="flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200/80 shadow-2xs">
            <button
              onClick={handlePrev}
              className="p-0.5 rounded hover:bg-black/5 text-slate-600 transition-colors"
              title="Previous insight"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-700 px-0.5">
              {currentIndex + 1}/{totalCount}
            </span>
            <button
              onClick={handleNext}
              className="p-0.5 rounded hover:bg-black/5 text-slate-600 transition-colors"
              title="Next insight"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {isRegenerating && (
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping shrink-0" title="Syncing intelligence..." />
        )}
      </div>
    </div>
  );
}
