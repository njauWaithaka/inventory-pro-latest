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
import { DemoBanner } from './components/demo/DemoBanner';
import { DemoLoadingScreen } from './components/demo/DemoLoadingScreen';
import { AccountConversionModal } from './components/demo/AccountConversionModal';

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
  const { user, loading: authLoading, isDemo, authError, retryAnonymousAuth, loginWithGoogle, loginWithEmail, registerWithEmail, connectionError } = useAuth();
  const { profile, company, loading: settingsLoading, createCompany } = useSettings();
  const [companyName, setCompanyName] = useState('');
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);

  // Authentication Interface States (fallback if explicitly requested)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [formAuthError, setFormAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormAuthError(null);
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
      setFormAuthError(err?.message || "Authentication failed.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setFormAuthError(null);
    setIsSubmittingAuth(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setFormAuthError(err?.message || "Could not sign in with Google account.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // 1. Loading screen while authenticating (anonymous session) and initializing workspace
  if (authLoading || settingsLoading) {
    return (
      <DemoLoadingScreen 
        error={authError} 
        onRetry={retryAnonymousAuth} 
      />
    );
  }

  // 2. If no user (e.g. offline failure before anonymous auth completes)
  if (!user) {
    return (
      <DemoLoadingScreen 
        error={authError || "Establishing demo workspace session..."} 
        onRetry={retryAnonymousAuth} 
      />
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
        {isDemo && (
          <DemoBanner onOpenCreateAccount={() => setShowConversionModal(true)} />
        )}
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
      {currentView !== 'inventory_pro_chat' && currentView !== 'pos' && (
        <InventoryProFloatingWidget onNavigate={setCurrentView} />
      )}

      {/* Account Conversion Modal for Demo Visitors */}
      <AccountConversionModal
        isOpen={showConversionModal}
        onClose={() => setShowConversionModal(false)}
        initialMode="register"
      />
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

