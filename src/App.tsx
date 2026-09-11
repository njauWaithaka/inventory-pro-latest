/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar, Navbar, BottomNav } from './components/layout/Navigation';
import { Dashboard } from './components/views/Dashboard';
import { Inventory } from './components/views/Inventory';
import { Demand } from './components/views/Demand';
import { Categories } from './components/views/Categories';
import { Analytics } from './components/views/Analytics';
import { Help } from './components/views/Help';
import { Settings as SettingsView } from './components/views/Settings';
import { SupplierAnalytics } from './components/views/SupplierAnalytics';
import { Reports } from './components/views/Reports';
import { ExpiryTracking } from './components/views/ExpiryTracking';
import { ProfitTracking } from './components/views/ProfitTracking';
import { Warranties } from './components/views/Warranties';
import { Alerts } from './components/views/Alerts';
import { Customers } from './components/views/Customers';
import { Suppliers } from './components/views/Suppliers';
import { POS } from './components/views/POS';
import { BOM } from './components/views/production/BOM';
import { ProductionOrders } from './components/views/production/ProductionOrders';
import { PurchaseOrders } from './components/views/procurement/PurchaseOrders';
import { GRN } from './components/views/procurement/GRN';
import { MROIssues } from './components/views/procurement/MROIssues';
import { ProcurementHub } from './components/views/procurement/ProcurementHub';
import { Reservations } from './components/views/procurement/Reservations';
import { ExpensesHub } from './components/views/procurement/expenses/ExpensesHub';
import { SalesHub } from './components/views/sales/SalesHub';
import { Receipts } from './components/views/sales/Receipts';
import { DeliveryNotes } from './components/views/sales/DeliveryNotes';
import { CreditNotes } from './components/views/sales/CreditNotes';
import { InventoryProChat, InventoryProFloatingWidget } from './components/views/InventoryProChat';
import { SellThrough } from './components/views/SellThrough';
import { ViewType } from './types';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, Warehouse, ShieldCheck, FileText, AlertCircle, 
  ClipboardList, Wrench, ShoppingCart, Layers, Factory, User, Building,
  Gauge, Bell, Package, LogIn, Loader2, BarChart3, WifiOff
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { InsightsProvider } from './contexts/InsightsContext';
import { Mail, Lock, User as UserIcon } from 'lucide-react';

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1280 : false);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) {
        setIsSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { user, loading: authLoading, loginWithGoogle, loginWithEmail, registerWithEmail, connectionError } = useAuth();
  const { profile, company, loading: settingsLoading, createCompany } = useSettings();
  const [companyName, setCompanyName] = useState('');
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  // Authentication Interface States
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error("Please fill in your email address and password.");
      }
      if (authMode === 'signup' && !fullName.trim()) {
        throw new Error("Please enter your full name for your company profile.");
      }

      if (authMode === 'signin') {
        await loginWithEmail(email.trim(), password);
      } else {
        await registerWithEmail(email.trim(), password, fullName.trim());
      }
    } catch (err: any) {
      setAuthError(err?.message || "Authentication failed.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsSubmittingAuth(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setAuthError(err?.message || "Could not sign in with Google account.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };



  if (authLoading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg p-4 relative overflow-hidden">
        {/* Subtle decorative background shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
           <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-50/50 blur-3xl" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-50/50 blur-3xl" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-7 sm:p-9 rounded-[2rem] border border-slate-200 shadow-2xl relative z-10"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-[#10b981] rounded-2xl flex items-center justify-center shadow-lg shadow-[#10b981]/20 mb-4">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">InventoryPro</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Production Cloud ERP</p>
            </div>

            <div className="w-full h-px bg-slate-100 my-6" />

            {authError && (
              <div className="w-full flex items-start gap-2 bg-rose-50 text-rose-600 border border-rose-100 p-3.5 rounded-xl text-xs font-semibold text-left mb-4 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {/* One-Click Google Auth */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmittingAuth}
              className="w-full h-12 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs tracking-wide transition-all hover:border-slate-300 flex items-center justify-center gap-3 shadow-sm disabled:opacity-50"
            >
              {isSubmittingAuth ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Sign in with Google</span>
                </>
              )}
            </button>

            <div className="w-full flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">or with email</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {/* Email / Password Sign In or Sign Up Form */}
            <form onSubmit={handleAuthSubmit} className="w-full space-y-3.5">
              {/* Tab Selector */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={cn(
                    "py-2 rounded-lg transition-all",
                    authMode === 'signin' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={cn(
                    "py-2 rounded-lg transition-all",
                    authMode === 'signup' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Register
                </button>
              </div>

              {authMode === 'signup' && (
                <div className="text-left space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="text-left space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="text-left space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full h-12 mt-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 disabled:opacity-50"
              >
                {isSubmittingAuth ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    {authMode === 'signin' ? 'Sign In to Workspace' : 'Create Account'}
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-semibold text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Real-Time Cloud Firestore • Production Ready</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // If user is logged in but has no company, force company creation
  if (!profile?.companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-10 rounded-[2rem] border border-slate-200 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Building className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Create Your Company</h2>
            <p className="text-slate-500 text-sm mt-2">Set up your workspace to begin managing inventory.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Company Name</label>
              <input 
                type="text" 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm transition-all"
              />
            </div>
            
            <button 
              onClick={async () => {
                if (!companyName.trim()) return;
                setIsCreatingCompany(true);
                try {
                  await createCompany(companyName);
                } catch (err) {
                  console.error(err);
                } finally {
                  setIsCreatingCompany(false);
                }
              }}
              disabled={!companyName.trim() || isCreatingCompany}
              className="w-full h-12 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
            >
              {isCreatingCompany ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>Next Step</>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'pos': return <POS />;
      case 'dashboard': return <Dashboard onNavigate={setCurrentView} />;
      case 'inventory': return <Inventory />;
      case 'demand': return <Demand />;
      case 'categories': return <Categories />;
      case 'analytics': return <Analytics />;
      case 'sell_through': return <Analytics defaultTab="sell_through" />;
      case 'invoices':
      case 'quotations':
        return <SalesHub defaultView={currentView} />;
      case 'receipts': return <Receipts />;
      case 'delivery_notes': return <DeliveryNotes />;
      case 'credit_notes': return <CreditNotes />;
      case 'purchase_orders': return <PurchaseOrders />;
      case 'grn': return <GRN />;
      case 'mro_issues': return <MROIssues />;
      case 'procurement_hub': return <ProcurementHub onNavigate={setCurrentView} />;
      case 'reservations': return <Reservations onNavigate={setCurrentView} />;
      case 'expenses':
      case 'expense_dashboard':
      case 'expense_transactions':
      case 'pending_expenses':
      case 'payables':
      case 'expense_payables':
      case 'recurring_expenses':
      case 'petty_cash':
      case 'expense_budgets':
      case 'expense_reports':
      case 'expense_analytics':
      case 'expense_categories':
      case 'record_expense':
        return <ExpensesHub currentSubView={currentView} onNavigate={setCurrentView} />;
      case 'bom': return <BOM />;
      case 'production_orders': return <ProductionOrders initialTab="orders" />;
      case 'production_planning': return <ProductionOrders initialTab="planning" />;
      case 'mrp': return <ProductionOrders initialTab="mrp" />;
      case 'material_requisitions': return <ProductionOrders initialTab="requisitions" />;
      case 'material_issue': return <ProductionOrders initialTab="issues" />;
      case 'wip': return <ProductionOrders initialTab="wip" />;
      case 'production_output': return <ProductionOrders initialTab="output" />;
      case 'quality_control': return <ProductionOrders initialTab="qc" />;
      case 'cost_analysis': return <ProductionOrders initialTab="costing" />;
      case 'production_analytics': return <ProductionOrders initialTab="analytics" />;
      case 'customers': return <Customers />;
      case 'suppliers': return <Suppliers />;
      case 'supplier': return <SupplierAnalytics />;
      case 'reports': return <Reports />;
      case 'expiry_tracking': return <ExpiryTracking />;
      case 'profit_tracking': return <ProfitTracking />;
      case 'warranties': return <Warranties />;
      case 'alerts': return <Alerts onNavigate={setCurrentView} />;
      case 'help': return <Help onNavigate={setCurrentView} />;
      case 'settings': return <SettingsView />;
      case 'inventory_pro_chat': return <InventoryProChat onNavigate={setCurrentView} />;
      default: return <Dashboard onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen antialiased font-sans flex flex-col transition-colors duration-200 bg-brand-bg text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      
      <div className={cn(
        "transition-all duration-300 min-h-screen flex flex-col min-w-0 overflow-x-clip",
        isSidebarCollapsed ? "md:pl-[64px]" : "md:pl-[260px]",
        "pl-0"
      )}>
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} currentView={currentView} onNavigate={setCurrentView} />
        
        <main className="flex-1 px-4 pt-3 pb-4 sm:px-6 sm:pt-4 sm:pb-6 lg:px-8 lg:pt-4 lg:pb-8 xl:px-10 xl:pt-4 xl:pb-10 mb-20 lg:mb-0 w-full mx-auto min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, scale: 0.99, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.01, y: -5 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <BottomNav currentView={currentView} onViewChange={setCurrentView} />
      {currentView !== 'inventory_pro_chat' && <InventoryProFloatingWidget onNavigate={setCurrentView} />}
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <InsightsProvider>
        <AppContent />
      </InsightsProvider>
    </SettingsProvider>
  );
}

const SettingsPlaceholder = ({ title, description, icon: Icon, onExplore }: { title: string, description: string, icon: any, onExplore?: () => void }) => (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-12 bg-white rounded-2xl border border-slate-200 border-dashed">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100 shadow-sm">
        <Icon className="w-10 h-10 text-slate-400" />
      </div>
      <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
      <p className="text-slate-500 font-medium max-w-sm mt-2">{description}</p>
      <button 
        onClick={onExplore}
        className="mt-8 px-6 h-11 bg-[#0f172a] text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all cursor-pointer"
      >
        Explore Module
      </button>
    </div>
);

function PackageSearch({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.29 7 12 12 20.71 7"></polyline>
      <line x1="12" y1="22" x2="12" y2="12"></line>
      <circle cx="18" cy="18" r="3"></circle>
      <line x1="20.1" y1="20.1" x2="22" y2="22"></line>
    </svg>
  );
}

