import React from "react";
import { AlertTriangle, Trash2, HelpCircle, AlertCircle, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  type?: "danger" | "warning" | "info" | "success";
  isSubmitting?: boolean;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  type = "warning",
  isSubmitting = false
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  // Icon & theme matching the modal context type
  let icon = <AlertCircle className="w-6 h-6 text-blue-400" />;
  let iconBg = "bg-blue-500/10 border-blue-500/20";
  let confirmBtnTheme = "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/10 focus:ring-blue-500/30";

  if (type === "danger") {
    icon = <Trash2 className="w-5.5 h-5.5 text-rose-400" />;
    iconBg = "bg-rose-500/10 border-rose-500/20";
    confirmBtnTheme = "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/10 focus:ring-rose-500/30";
  } else if (type === "warning") {
    icon = <AlertTriangle className="w-5.5 h-5.5 text-amber-400" />;
    iconBg = "bg-amber-500/10 border-amber-500/20";
    confirmBtnTheme = "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/10 focus:ring-amber-500/30";
  } else if (type === "success") {
    icon = <HelpCircle className="w-5.5 h-5.5 text-emerald-400" />;
    iconBg = "bg-emerald-500/10 border-emerald-500/20";
    confirmBtnTheme = "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/10 focus:ring-emerald-500/30";
  }

  return (
    <AnimatePresence>
      <div 
        id="confirmation-modal-overlay"
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
          className="bg-[#0F172A] border border-white/10 rounded-[2rem] w-full max-w-md shadow-2xl relative overflow-hidden text-left"
        >
          {/* Subtle glow highlight according to type */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-20" style={{ color: type === "danger" ? "#F43F5E" : type === "warning" ? "#F59E0B" : type === "success" ? "#10B981" : "#3B82F6" }} />

          {/* Close button */}
          <button 
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="absolute top-5 right-5 p-1.5 rounded-lg border border-transparent hover:border-white/5 bg-white/[0.02] hover:bg-white/5 active:bg-white/10 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 sm:p-7.5">
            <div className="flex items-start gap-4">
              {/* Header Icon badge with ambient background */}
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${iconBg}`}>
                {icon}
              </div>

              <div className="flex-1 space-y-1.5 min-w-0 pr-6">
                <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
                <p className="text-[13px] leading-relaxed text-slate-300 font-sans">{message}</p>
              </div>
            </div>

            {/* Action controls panel */}
            <div className="mt-8 flex items-center justify-end gap-3 border-t border-white/5 pt-5">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/[0.02] hover:bg-white/5 active:bg-white/10 border border-white/5 hover:border-white/10 transition-all cursor-pointer disabled:opacity-40"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isSubmitting}
                className={`px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-lg active:scale-98 disabled:opacity-50 ${confirmBtnTheme}`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{confirmText}</span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
