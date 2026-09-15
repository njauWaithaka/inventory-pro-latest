import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Mail, 
  Lock, 
  User, 
  ShieldCheck, 
  Building2,
  LogIn
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AccountConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'register' | 'login';
}

export function AccountConversionModal({ isOpen, onClose, initialMode = 'register' }: AccountConversionModalProps) {
  const { linkWithGoogle, linkWithEmail, loginWithGoogle, loginWithEmail } = useAuth();
  const [mode, setMode] = useState<'register' | 'login'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleAuth = async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (mode === 'register') {
        await linkWithGoogle();
        setSuccessMessage("Account created successfully! Your demo data is now saved to your permanent account.");
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        await loginWithGoogle();
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to authenticate with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) {
          throw new Error("Please enter your full name.");
        }
        await linkWithEmail(email, password, name);
        setSuccessMessage("Account created successfully! Your demo data is now saved to your permanent account.");
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        await loginWithEmail(email, password);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to authenticate.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mb-3 ring-4 ring-blue-50/50">
            {mode === 'register' ? <Sparkles className="w-6 h-6" /> : <LogIn className="w-6 h-6" />}
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {mode === 'register' ? "Create Your Aquivo Account" : "Sign In to Aquivo"}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            {mode === 'register' 
              ? "Save your current demo workspace data and unlock unlimited transactions, team access & integrations."
              : "Access your existing production workspace or business profile."}
          </p>
        </div>

        {/* Success Banner */}
        {successMessage ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-semibold mb-5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p>{successMessage}</p>
          </div>
        ) : null}

        {/* Error Banner */}
        {error ? (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-medium mb-5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <p className="leading-snug">{error}</p>
          </div>
        ) : null}

        {!successMessage && (
          <>
            {/* Google One-Click CTA */}
            <button
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer mb-4"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{mode === 'register' ? 'Continue with Google' : 'Sign In with Google'}</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Or with email
              </span>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {mode === 'register' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Kamau"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{mode === 'register' ? 'Save & Create Permanent Account' : 'Sign In'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Toggle Mode */}
            <div className="mt-5 pt-4 border-t border-slate-100 text-center">
              {mode === 'register' ? (
                <p className="text-xs text-slate-500 font-medium">
                  Already have an Aquivo account?{' '}
                  <button
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-500 font-medium">
                  Need a new account?{' '}
                  <button
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                  >
                    Create Account
                  </button>
                </p>
              )}
            </div>

            {/* Benefits Footnote */}
            {mode === 'register' && (
              <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-slate-400 font-medium">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" /> Free 14-day trial
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-blue-500" /> Preserves demo data
                </span>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
