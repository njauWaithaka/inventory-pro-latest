import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wifi, 
  WifiOff, 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  Cloud, 
  CloudOff, 
  Zap,
  HardDrive
} from 'lucide-react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import firebaseConfig from '../../../firebase-applet-config.json';

export type ConnectionQuality = 'optimal' | 'moderate' | 'slow' | 'offline';

interface ConnectionStatusIndicatorProps {
  isPOS?: boolean;
}

export function ConnectionStatusIndicator({ isPOS = false }: ConnectionStatusIndicatorProps) {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [showPopover, setShowPopover] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const measureLatency = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setLatencyMs(null);
      return;
    }

    setIsPinging(true);
    const startTime = performance.now();

    try {
      // Direct server round-trip check to verify live Firestore connectivity & latency
      await getDocFromServer(doc(db, 'test', 'connection'));
      const duration = Math.max(1, Math.round(performance.now() - startTime));
      setLatencyMs(duration);
      setIsOnline(true);
      setLastChecked(new Date());
    } catch (err: any) {
      const errMsg = err?.message?.toLowerCase() || '';
      const isClientOffline = errMsg.includes('offline') || errMsg.includes('unavailable') || errMsg.includes('network');
      
      if (isClientOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        setIsOnline(false);
        setLatencyMs(null);
      } else {
        // Server replied with response (e.g. document not found or auth validation) - connection is alive
        const duration = Math.max(1, Math.round(performance.now() - startTime));
        setLatencyMs(duration);
        setIsOnline(true);
        setLastChecked(new Date());
      }
    } finally {
      setIsPinging(false);
    }
  }, []);

  // Initial check & interval ping
  useEffect(() => {
    measureLatency();

    const handleOnline = () => {
      setIsOnline(true);
      measureLatency();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLatencyMs(null);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        measureLatency();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Heartbeat latency check every 25 seconds when window is active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        measureLatency();
      }
    }, 25000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [measureLatency]);

  // Click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getQuality = (): ConnectionQuality => {
    if (!isOnline) return 'offline';
    if (latencyMs === null) return 'optimal';
    if (latencyMs < 200) return 'optimal';
    if (latencyMs <= 500) return 'moderate';
    return 'slow';
  };

  const quality = getQuality();

  const getQualityText = () => {
    switch (quality) {
      case 'optimal':
        return 'Optimal';
      case 'moderate':
        return 'Moderate';
      case 'slow':
        return 'Slow Sync';
      case 'offline':
        return 'Offline';
    }
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Visual Indicator Button in Navbar */}
      <button
        onClick={() => setShowPopover(!showPopover)}
        className={cn(
          "flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all select-none cursor-pointer border shadow-2xs",
          isOnline
            ? quality === 'optimal'
              ? isPOS 
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70"
                : "bg-emerald-50/70 border-emerald-200/80 text-emerald-700 hover:bg-emerald-100/60"
              : quality === 'moderate'
                ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/60"
                : "bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100/60"
            : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/80 animate-pulse"
        )}
        title={isOnline ? `Firestore Connected (${latencyMs ? `${latencyMs}ms` : 'checking...'})` : "Firestore Offline (Cached Locally)"}
        aria-label="Connection Status"
      >
        {/* Status indicator dot with pulse animation */}
        <span className="relative flex h-2 w-2">
          {isOnline && (
            <span 
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                quality === 'optimal' ? "bg-emerald-400" : quality === 'moderate' ? "bg-amber-400" : "bg-orange-400"
              )} 
            />
          )}
          <span 
            className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              isOnline
                ? quality === 'optimal'
                  ? "bg-emerald-500"
                  : quality === 'moderate'
                    ? "bg-amber-500"
                    : "bg-orange-500"
                : "bg-rose-500"
            )} 
          />
        </span>

        {/* Status text and latency badge */}
        {isOnline ? (
          <div className="flex items-center gap-1">
            <span className="hidden sm:inline font-medium">
              {quality === 'slow' ? 'High Latency' : 'Online'}
            </span>
            {latencyMs !== null ? (
              <span className={cn(
                "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md",
                quality === 'optimal' 
                  ? "bg-emerald-100/80 text-emerald-800" 
                  : quality === 'moderate' 
                    ? "bg-amber-100 text-amber-900" 
                    : "bg-orange-100 text-orange-900"
              )}>
                {latencyMs}ms
              </span>
            ) : (
              <span className="text-[10px] text-emerald-600 font-mono">Sync</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-rose-700">
            <CloudOff className="w-3 h-3 text-rose-500" />
            <span className="font-bold text-[11px]">Offline</span>
          </div>
        )}
      </button>

      {/* Real-time Connection Details Popover */}
      <AnimatePresence>
        {showPopover && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2.5 w-76 sm:w-84 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-left"
          >
            {/* Popover Header */}
            <div className={cn(
              "p-4 border-b transition-colors",
              isOnline 
                ? quality === 'optimal'
                  ? "bg-emerald-50/70 border-emerald-100 text-emerald-950"
                  : "bg-amber-50/70 border-amber-100 text-amber-950"
                : "bg-rose-50/70 border-rose-100 text-rose-950"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shadow-2xs",
                    isOnline 
                      ? quality === 'optimal' ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                      : "bg-rose-500 text-white"
                  )}>
                    {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-tight flex items-center gap-1.5">
                      {isOnline ? 'Firestore Connected' : 'Offline Mode Active'}
                    </h4>
                    <p className="text-[10px] opacity-75 font-medium mt-0.5">
                      {isOnline ? 'Real-time database sync active' : 'Changes queued in local storage'}
                    </p>
                  </div>
                </div>

                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  isOnline
                    ? quality === 'optimal'
                      ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                      : "bg-amber-100 border-amber-200 text-amber-800"
                    : "bg-rose-100 border-rose-200 text-rose-800"
                )}>
                  {getQualityText()}
                </span>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="p-3.5 space-y-2.5 bg-white text-slate-700">
              {/* Sync Latency Metric */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-800 leading-none">Sync Latency</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Round-trip database ping</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-xs font-black font-mono",
                    latencyMs === null ? "text-slate-400" :
                    quality === 'optimal' ? "text-emerald-600" :
                    quality === 'moderate' ? "text-amber-600" : "text-orange-600"
                  )}>
                    {latencyMs !== null ? `${latencyMs} ms` : '—'}
                  </p>
                  <span className="text-[9px] font-medium text-slate-400">
                    {lastChecked ? formatTimeAgo(lastChecked) : 'Checking'}
                  </span>
                </div>
              </div>

              {/* Offline Resilience / Local Cache Status */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <HardDrive className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-800 leading-none">Local Persistence</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">IndexedDB Multi-Tab Cache</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                  Active
                </span>
              </div>

              {/* Database Cluster Info */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Database className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 leading-none">Database Node</p>
                    <p className="text-[9px] text-slate-400 truncate max-w-[130px] sm:max-w-[160px] mt-0.5" title={firebaseConfig.firestoreDatabaseId || "default"}>
                      {firebaseConfig.firestoreDatabaseId || "default"}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-600 font-mono">
                  Long-Polling
                </span>
              </div>

              {/* Offline Guidance Notice */}
              {!isOnline && (
                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[10px] text-amber-900 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold mb-0.5 text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Seamless Offline Mode</span>
                  </div>
                  POS sales, stock counts, and edits are stored locally and will automatically synchronize with the cloud once network connectivity is restored.
                </div>
              )}
            </div>

            {/* Footer Action: Ping / Re-test Latency */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 pl-1 font-medium">
                Auto-refreshes every 25s
              </span>
              <button
                onClick={measureLatency}
                disabled={isPinging}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <RefreshCw className={cn("w-3 h-3 text-slate-500", isPinging && "animate-spin text-blue-600")} />
                <span>{isPinging ? "Pinging..." : "Test Latency"}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
