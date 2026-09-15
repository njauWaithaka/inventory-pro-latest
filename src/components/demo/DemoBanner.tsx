import React, { useState } from 'react';
import { Sparkles, RotateCcw, ArrowRight, Shield, UserPlus, LogIn } from 'lucide-react';
import { AccountConversionModal } from './AccountConversionModal';
import { ResetDemoModal } from './ResetDemoModal';

interface DemoBannerProps {
  onOpenCreateAccount?: () => void;
}

export function DemoBanner({ onOpenCreateAccount }: DemoBannerProps) {
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [modalMode, setModalMode] = useState<'register' | 'login'>('register');

  const handleOpenRegister = () => {
    if (onOpenCreateAccount) {
      onOpenCreateAccount();
    } else {
      setModalMode('register');
      setShowConversionModal(true);
    }
  };

  const handleOpenLogin = () => {
    setModalMode('login');
    setShowConversionModal(true);
  };

  return (
    <>
      <div 
        id="aquivo-demo-banner"
        className="bg-slate-900 border-b border-slate-800 text-white px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40 shadow-xs"
      >
        {/* Left Side: Status pill and description */}
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            DEMO MODE
          </span>
          <span className="hidden sm:inline-block text-xs font-semibold text-slate-300">
            Sample business workspace
          </span>
          <span className="hidden md:inline-block text-[11px] text-slate-500">
            • Real-time POS, live inventory velocity & autonomous reorder engine
          </span>
        </div>

        {/* Right Side: Quick Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Reset Demo */}
          <button
            onClick={() => setShowResetModal(true)}
            title="Restore default demo catalog & stock records"
            className="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700/60 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden xs:inline">Reset Demo</span>
          </button>

          {/* Sign In Link */}
          <button
            onClick={handleOpenLogin}
            className="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700/60 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Sign In</span>
          </button>

          {/* Create Account CTA */}
          <button
            onClick={handleOpenRegister}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <AccountConversionModal
        isOpen={showConversionModal}
        onClose={() => setShowConversionModal(false)}
        initialMode={modalMode}
      />

      <ResetDemoModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
      />
    </>
  );
}
