import React from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

interface DemoLoadingScreenProps {
  error?: string | null;
  onRetry?: () => void;
}

export function DemoLoadingScreen({ error, onRetry }: DemoLoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 text-white px-4">
      {/* Background ambient accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center">
        {/* Brand mark */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/20 mb-6 ring-1 ring-white/20">
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </div>

        <h1 className="text-2xl font-black tracking-tight text-white mb-2">
          Aquivo ERP
        </h1>

        {error ? (
          <div className="bg-slate-800/80 border border-rose-500/30 rounded-2xl p-6 text-center backdrop-blur-md shadow-2xl mt-4">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-xl flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">Session Connection Error</p>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Demo Connection
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-base font-bold text-slate-200">
                Loading Aquivo Demo...
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Preparing your isolated workspace, inventory & retail ledger
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
