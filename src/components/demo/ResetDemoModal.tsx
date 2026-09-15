import React, { useState } from 'react';
import { motion } from 'motion/react';
import { RotateCcw, AlertTriangle, X, Check } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface ResetDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ResetDemoModal({ isOpen, onClose }: ResetDemoModalProps) {
  const { resetDemo } = useSettings();
  const [isResetting, setIsResetting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetDemo();
      setIsDone(true);
      setTimeout(() => {
        setIsDone(false);
        setIsResetting(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Reset demo failed:", err);
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center"
      >
        <button
          onClick={onClose}
          disabled={isResetting}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-50">
          <RotateCcw className={`w-7 h-7 ${isResetting ? 'animate-spin' : ''}`} />
        </div>

        <h3 className="text-lg font-black text-slate-900 tracking-tight">
          Reset Demo Workspace?
        </h3>

        <p className="text-xs text-slate-500 mt-2 leading-relaxed font-medium">
          This will restore the demo catalog, stock levels, historical sales, and suppliers back to their original state.
        </p>

        {isDone ? (
          <div className="mt-6 py-2.5 px-4 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Workspace Reset Complete!</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isResetting}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isResetting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Reset Data</span>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
