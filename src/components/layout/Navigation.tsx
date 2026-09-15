import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Package,
  Grid3X3,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronDown,
  Bell,
  Search,
  Plus,
  User,
  Warehouse,
  FileText,
  ShoppingCart,
  Factory,
  Users,
  ShieldCheck,
  AlertCircle,
  CircleHelp,
  Wrench,
  Building,
  ClipboardCheck,
  Layers,
  ClipboardList,
  Gauge,
  Receipt,
  Truck,
  FileX,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ShoppingBag,
  Boxes,
  Contact,
  TrendingUp,
  LineChart,
  UserRound,
  Clock,
  DollarSign,
  Sparkles,
  Scale,
  Calendar,
  Percent,
  CreditCard,
  Wallet,
  Tag,
  Bookmark,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  MessageSquare,
  Building2,
  Check,
  ArrowRight,
  HelpCircle,
  Sliders,
} from "lucide-react";
import { ViewType, Product } from "../../types";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { collection, onSnapshot, doc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { AccountConversionModal } from "../demo/AccountConversionModal";
import { ResetDemoModal } from "../demo/ResetDemoModal";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  isOpen: boolean;
  onToggle: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const menuItems = [
  { id: "dashboard" as ViewType, label: "Dashboard", icon: LayoutDashboard },
  { id: "pos" as ViewType, label: "POS", icon: ShoppingCart },
  { id: "inventory" as ViewType, label: "Inventory", icon: Package },
  { id: "demand" as ViewType, label: "Demand", icon: TrendingUp },
  { id: "categories" as ViewType, label: "Categories", icon: Grid3X3 },
];

const menuGroups = [
  {
    id: "sales",
    label: "Sales",
    icon: Receipt,
    children: [
      { id: "invoices" as ViewType, label: "Invoices", icon: FileText },
      { id: "receipts" as ViewType, label: "Receipts", icon: ClipboardList },
      {
        id: "delivery_notes" as ViewType,
        label: "Delivery Notes",
        icon: Truck,
      },
      {
        id: "credit_notes" as ViewType,
        label: "Credit Notes / Returns",
        icon: RotateCcw,
      },
    ],
  },
  {
    id: "procurement",
    label: "Procurement",
    icon: ShoppingCart,
    children: [
      {
        id: "purchase_orders" as ViewType,
        label: "Purchase Orders",
        icon: ShoppingBag,
      },
      { id: "suppliers" as ViewType, label: "Suppliers", icon: Users },
      { id: "grn" as ViewType, label: "GRN", icon: Package },
      { id: "mro_issues" as ViewType, label: "MRO Issues", icon: Wrench },
      { id: "expenses" as ViewType, label: "Expenses", icon: Receipt },
      { id: "reservations" as ViewType, label: "Reservations", icon: Bookmark },
      {
        id: "procurement_hub" as ViewType,
        label: "Procurement Hub",
        icon: ShoppingCart,
      },
    ],
  },
  {
    id: "contacts",
    label: "Contacts",
    icon: Contact,
    children: [
      { id: "customers" as ViewType, label: "Customers", icon: UserRound },
      {
        id: "suppliers" as ViewType,
        label: "Suppliers",
        icon: Building,
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: TrendingUp,
    children: [
      { id: "analytics" as ViewType, label: "Analytics", icon: BarChart3 },
      { id: "profit_tracking" as ViewType, label: "Profit Tracking", icon: DollarSign },
      { id: "reports" as ViewType, label: "Reports", icon: FileText },
      { id: "warranties" as ViewType, label: "Warranties", icon: ShieldCheck },
      { id: "expiry_tracking" as ViewType, label: "Expiry Tracking", icon: Clock },
      { id: "alerts" as ViewType, label: "Alerts", icon: Bell, badge: "!" },
    ],
  },
];

const footerItems = [
  { id: "help" as ViewType, label: "Help & Tutorials", icon: CircleHelp },
  { id: "settings" as ViewType, label: "Settings", icon: Settings },
];

const NavButton = ({
  item,
  isSub = false,
  isCollapsed,
  isActive,
  onClick,
}: {
  item: any;
  isSub?: boolean;
  isCollapsed: boolean;
  isActive: boolean;
  onClick: () => void;
  key?: React.Key;
}) => {
  return (
    <button
      title={item.label}
      onClick={onClick}
      className={cn(
        "flex h-10 items-center transition-colors duration-200 group relative rounded-lg",
        isCollapsed
          ? "w-full justify-center px-0 mx-0"
          : cn("w-[calc(100%-16px)] mx-2 gap-3 px-4", isSub ? "pl-10" : "px-4"),
        isActive
          ? "bg-[#102A5C] text-[#38BDF8]"
          : "text-slate-300 hover:bg-white/10 hover:text-white",
      )}
    >
      <item.icon
        className={cn(
          "w-5 h-5 shrink-0 transition-colors",
          isActive ? "text-[#38BDF8]" : "text-slate-400 group-hover:text-white",
        )}
      />
      {!isCollapsed && (
        <span
          className={cn(
            "text-[13px] font-semibold tracking-tight truncate transition-opacity duration-300",
            isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100",
          )}
        >
          {item.label}
        </span>
      )}
      {!isCollapsed && item.badge && (
        <span className="absolute right-4 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[18px] text-center">
          {item.badge}
        </span>
      )}
      {isCollapsed && isActive && (
        <div className="absolute left-0 w-1 h-6 bg-[#38BDF8] rounded-r-full" />
      )}
    </button>
  );
};

export function Sidebar({
  currentView,
  onViewChange,
  isOpen,
  onToggle,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { user } = useAuth();
  const { profile } = useSettings();
  const [activeAlertsCount, setActiveAlertsCount] = React.useState(0);
  const [isLargeScreen, setIsLargeScreen] = React.useState(false);
  const [expandedSections, setExpandedSections] = React.useState<
    Record<string, boolean>
  >({
    sales: false,
    procurement: true,
    contacts: false,
    insights: false,
  });

  React.useEffect(() => {
    const parentGroup = menuGroups.find((group) =>
      group.children.some((child) => child.id === currentView)
    );
    if (parentGroup) {
      setExpandedSections((prev) => ({ ...prev, [parentGroup.id]: true }));
    }
  }, [currentView]);

  React.useEffect(() => {
    if (!profile?.companyId) return;

    const path = `companies/${profile.companyId}/inventory_alerts`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const active = snapshot.docs.filter((doc) => {
        const data = doc.data();
        return data.status !== "resolved" && data.status !== "dismissed";
      });
      setActiveAlertsCount(active.length);
    });

    return () => unsubscribe();
  }, [profile?.companyId]);

  const toggleSection = (section: string) => {
    if (isCollapsed) {
      onToggleCollapse();
      setExpandedSections((prev) => ({ ...prev, [section]: true }));
    } else {
      setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    }
  };

  React.useEffect(() => {
    const checkScreen = () => setIsLargeScreen(window.innerWidth >= 768);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  const handleNavClick = (id: ViewType) => {
    if (isCollapsed) {
      onToggleCollapse();
      // Find if this ID belongs to a group and expand it
      const parentGroup = menuGroups.find((group) =>
        group.children.some((child) => child.id === id),
      );
      if (parentGroup) {
        setExpandedSections((prev) => ({ ...prev, [parentGroup.id]: true }));
      }
    }

    onViewChange(id);
    if (window.innerWidth < 768) onToggle();
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Content */}
      <motion.aside
        initial={false}
        animate={{
          x: isOpen || isLargeScreen ? 0 : -260,
          width: isLargeScreen ? (isCollapsed ? 64 : 260) : 260,
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "fixed top-0 left-0 bottom-0 bg-[#0F172A] text-slate-300 z-50 flex flex-col border-r border-[#1E293B] h-screen transition-all duration-300 overflow-visible",
          !isOpen && "hidden md:flex",
        )}
      >
        {/* Toggle Button */}
        {isLargeScreen && (
          <button
            onClick={onToggleCollapse}
            className="absolute -right-4 top-16 w-8 h-8 bg-white border border-slate-300 rounded-full flex items-center justify-center text-[#0F172A] shadow-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all z-[80]"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Brand Header */}
        <div
          className={cn(
            "p-6 shrink-0 flex items-center overflow-hidden transition-all duration-300",
            isCollapsed ? "justify-center px-2" : "gap-3",
          )}
        >
          <div className="w-10 h-10 bg-[#10b981] rounded-lg flex items-center justify-center shadow-lg shadow-[#10b981]/20 shrink-0">
            <BarChart3
              className={cn(
                "w-6 h-6 text-white transition-all",
                isCollapsed ? "w-5 h-5" : "w-6 h-6",
              )}
            />
          </div>
          {!isCollapsed && (
            <div className="flex-1 flex items-center justify-between min-w-0">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <h1 className="text-lg font-extrabold text-white leading-none">
                  Aquivo
                </h1>
                <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-wider">
                  Smart Decisions
                </p>
              </motion.div>
              <button
                onClick={onToggle}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
          {/* Top Scroll Fade */}
          <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#0F172A] to-transparent z-10 pointer-events-none" />

          <nav
            className={cn(
              "h-full px-3 py-4 pb-10 scrollbar-hide overflow-x-visible",
              isCollapsed
                ? "overflow-y-visible space-y-4"
                : "overflow-y-auto space-y-6",
            )}
          >
            {/* Top-level Items */}
            <div className="space-y-1">
              {menuItems.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  isCollapsed={isCollapsed}
                  isActive={currentView === item.id}
                  onClick={() => handleNavClick(item.id)}
                />
              ))}
            </div>

            {/* Collapsed Group Icons */}
            {isCollapsed ? (
              <div className="space-y-1">
                {menuGroups.map((group) => {
                  const hasAlertsInGroup = group.id === "insights" && activeAlertsCount > 0;
                  const groupWithBadge = hasAlertsInGroup
                    ? { ...group, badge: activeAlertsCount.toString() }
                    : group;
                  return (
                    <NavButton
                      key={group.id}
                      item={groupWithBadge}
                      isCollapsed={true}
                      isActive={group.children.some(
                        (child) => child.id === currentView,
                      )}
                      onClick={() => toggleSection(group.id)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="space-y-6">
                {menuGroups.map((group) => (
                  <div key={group.id} className="space-y-1">
                    <button
                      onClick={() => toggleSection(group.id)}
                      className="w-full px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between hover:text-white transition-colors mb-2"
                    >
                      <div className="flex items-center gap-2">
                        <group.icon className="w-3.5 h-3.5" />
                        {group.label}
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 transition-transform duration-200",
                          !expandedSections[group.id] && "-rotate-90",
                        )}
                      />
                    </button>
                    {expandedSections[group.id] && (
                      <div className="w-full space-y-1">
                        {group.children.map((child) => {
                          const itemWithBadge = child.id === "alerts"
                            ? { ...child, badge: activeAlertsCount > 0 ? activeAlertsCount.toString() : undefined }
                            : child;
                          return (
                            <NavButton
                              key={child.id}
                              item={itemWithBadge}
                              isSub={true}
                              isCollapsed={false}
                              isActive={currentView === child.id}
                              onClick={() => handleNavClick(child.id)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </nav>

          {/* Bottom Scroll Fade */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#0F172A] to-transparent z-10 pointer-events-none" />
        </div>

        {/* Footer Area */}
        <div
          className={cn(
            "p-4 space-y-1 mt-auto shrink-0 border-t border-[#1E293B] bg-[#0F172A]",
            isCollapsed && "flex flex-col items-center",
          )}
        >
          {footerItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isCollapsed={isCollapsed}
              isActive={currentView === item.id}
              onClick={() => handleNavClick(item.id)}
            />
          ))}
        </div>
      </motion.aside>
    </>
  );
}

export function Navbar({ 
  onMenuClick, 
  currentView,
  onNavigate,
}: { 
  onMenuClick: () => void; 
  currentView?: ViewType;
  onNavigate?: (view: ViewType) => void;
}) {
  const { user, logout } = useAuth();
  const { profile, company } = useSettings();
  const isDemo = Boolean(user?.isDemo || user?.isAnonymous);
  const title = profile?.name || user?.displayName || (isDemo ? "Demo Guest" : (user?.email?.split("@")[0] || "User"));
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [alertsList, setAlertsList] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [conversionInitialMode, setConversionInitialMode] = useState<'register' | 'login'>('register');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile?.companyId) return;

    const path = `companies/${profile.companyId}/inventory_alerts`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const allAlerts = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      const active = allAlerts.filter((data: any) => data.status !== "resolved" && data.status !== "dismissed");
      setActiveAlertCount(active.length);
      setAlertsList(active.slice(0, 8)); // Top 8 active alerts
    });

    return () => unsubscribe();
  }, [profile?.companyId]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleResolveAlert = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile?.companyId) return;
    setResolvingId(alertId);
    try {
      const alertRef = doc(db, `companies/${profile.companyId}/inventory_alerts`, alertId);
      await setDoc(alertRef, { status: "resolved", resolvedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error("Failed to resolve alert:", err);
    } finally {
      setResolvingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (!profile?.companyId || alertsList.length === 0) return;
    try {
      const batch = writeBatch(db);
      alertsList.forEach(alert => {
        const alertRef = doc(db, `companies/${profile.companyId}/inventory_alerts`, alert.id);
        batch.set(alertRef, { status: "read" }, { merge: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const handleNavigate = (view: ViewType) => {
    setShowNotifications(false);
    setShowProfileMenu(false);
    if (onNavigate) {
      onNavigate(view);
    }
  };

  const isPOS = currentView === "pos";

  return (
    <>
      <header className={cn(
        "sticky top-0 z-30 h-16 flex items-center px-4 sm:px-6 lg:px-8 transition-colors duration-200",
        isPOS
          ? "bg-white sm:bg-[#f8f9fa] border-b border-[#e4e6e9] text-[#1a1c20] shadow-[0_1px_3px_rgba(20,20,30,0.05)]"
          : "bg-brand-header border-b border-brand-border text-slate-900"
      )}>
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onMenuClick}
            className={cn(
              "md:hidden p-2 rounded-lg transition-colors",
              isPOS ? "text-[#1a1c20] hover:bg-[#f1f2f4]" : "text-slate-500 hover:bg-slate-100"
            )}
            title="Open Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="relative flex-1 max-w-[200px] sm:max-w-sm group text-left">
            <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors", isPOS ? "text-[#9096a0]" : "text-slate-400")} />
            <input
              type="text"
              placeholder="Search across inventory..."
              className={cn(
                "w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none transition-all",
                isPOS
                  ? "bg-white border-[#e4e6e9] text-[#1a1c20] focus:border-[#1a8a5f] focus:ring-1 focus:ring-[#1a8a5f]/20 placeholder-[#9096a0] shadow-xs"
                  : "bg-slate-100 border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white placeholder-slate-400"
              )}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-4">
          {/* Real-time Connection & Sync Latency Indicator */}
          <ConnectionStatusIndicator isPOS={isPOS} />

          {/* Notifications Bell with Interactive Popover */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProfileMenu(false);
              }}
              className={cn(
                "p-2.5 rounded-full relative transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer",
                showNotifications
                  ? "bg-blue-50 text-blue-600 ring-2 ring-blue-500/20"
                  : isPOS 
                    ? "text-[#1a1c20] hover:bg-[#f1f2f4] hover:text-[#1a8a5f]" 
                    : "text-slate-500 hover:bg-slate-100 hover:text-blue-600"
              )}
              title="Inventory Notifications & Alerts"
            >
              <Bell className="w-5 h-5 transition-transform duration-300" />

              {activeAlertCount > 0 && (
                <span className="absolute top-2 right-2 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-rose-500 text-[9px] font-black text-white shadow-sm ring-2 ring-white overflow-hidden">
                    {activeAlertCount > 99 ? '99+' : activeAlertCount}
                  </span>
                </span>
              )}
            </button>

            {/* Notification Popover */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-left"
                >
                  {/* Header */}
                  <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 leading-tight">Notifications</h4>
                        <p className="text-[10px] font-bold text-slate-400">
                          {activeAlertCount > 0 ? `${activeAlertCount} active alerts` : 'All systems normal'}
                        </p>
                      </div>
                    </div>
                    {activeAlertCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline px-2 py-1"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Body List */}
                  <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
                    {alertsList.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-800">No Active Alerts</p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] mx-auto">
                          Stock levels, expiring products, and purchase orders are in good standing.
                        </p>
                      </div>
                    ) : (
                      alertsList.map((alert) => {
                        const isCritical = alert.severity === 'high' || alert.severity === 'critical' || alert.type === 'out_of_stock';
                        const isWarning = alert.severity === 'medium' || alert.type === 'low_stock';

                        return (
                          <div 
                            key={alert.id}
                            className="p-3.5 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 group"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                isCritical ? "bg-rose-100 text-rose-600" : isWarning ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                              )}>
                                {isCritical ? <ShieldAlert className="w-4 h-4" /> : isWarning ? <AlertTriangle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {alert.title || alert.productName || 'Inventory Alert'}
                                </p>
                                <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                                  {alert.message || alert.description || `Item requires attention (SKU: ${alert.sku || alert.productId || 'N/A'})`}
                                </p>
                                <span className="text-[9px] font-bold text-slate-400 mt-1 block">
                                  {alert.createdAt ? new Date(alert.createdAt).toLocaleDateString() : 'Recent'}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => handleResolveAlert(alert.id, e)}
                              disabled={resolvingId === alert.id}
                              className="opacity-80 group-hover:opacity-100 text-[10px] font-bold text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-md border border-slate-200 transition-all shrink-0 cursor-pointer"
                              title="Mark Resolved"
                            >
                              {resolvingId === alert.id ? '...' : <Check className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => handleNavigate('alerts')}
                      className="w-full py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span>View All Inventory Alerts</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Profile Circle with Interactive Popover Menu */}
          <div className="relative" ref={profileRef}>
            <div 
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
              }}
              className={cn(
                "flex items-center gap-2 border-l pl-4 ml-1 sm:ml-0 cursor-pointer group select-none", 
                isPOS ? "border-[#e4e6e9]" : "border-slate-200"
              )}
            >
              <div className="hidden lg:block text-right">
                <p className={cn("text-[13px] font-bold leading-none capitalize", isPOS ? "text-[#1a1c20]" : "text-slate-900")}>
                  {title}
                </p>
                <p className={cn("text-[10px] mt-1 font-medium", isPOS ? "text-[#6b6f78]" : "text-slate-500")}>
                  {profile?.role || "Inventory Manager"}
                </p>
              </div>

              <div
                className={cn(
                  "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border shadow-xs overflow-hidden shrink-0 transition-all",
                  showProfileMenu 
                    ? "ring-2 ring-blue-500 border-blue-500" 
                    : isPOS 
                      ? "bg-[#f1f2f4] border-[#e4e6e9] group-hover:ring-2 group-hover:ring-[#1a8a5f]" 
                      : "bg-slate-100 border-slate-200 group-hover:ring-2 group-hover:ring-blue-500"
                )}
                title="Account & Profile Menu"
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xs font-black text-slate-700 uppercase">
                    {(title || "U").charAt(0)}
                  </span>
                )}
              </div>
            </div>

            {/* Profile Popover Menu */}
            <AnimatePresence>
              {showProfileMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 mt-3 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-left"
                >
                  {/* User Profile Header Card */}
                  <div className="p-4 bg-gradient-to-br from-slate-900 to-[#0F172A] text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center font-black text-base text-white shrink-0 overflow-hidden">
                        {user?.photoURL ? (
                          <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span>{(title || "U").charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold truncate leading-tight">{title}</h4>
                        <p className="text-[11px] text-slate-300 truncate mt-0.5 font-mono">{user?.email || "Signed in"}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[10px] font-semibold text-slate-300 capitalize">{company?.name || "Workspace"} • {profile?.role || "Admin"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="p-2 space-y-0.5 text-xs font-semibold text-slate-700">
                    <button
                      onClick={() => handleNavigate('settings')}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Company & Account Settings</span>
                    </button>

                    <button
                      onClick={() => handleNavigate('reports')}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span>Executive Reports & Logs</span>
                    </button>

                    <button
                      onClick={() => handleNavigate('analytics')}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
                    >
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                      <span>Analytics & Inventory Velocity</span>
                    </button>

                    <button
                      onClick={() => handleNavigate('alerts')}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center justify-between transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Bell className="w-4 h-4 text-slate-400" />
                        <span>Inventory Alerts Center</span>
                      </div>
                      {activeAlertCount > 0 && (
                        <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                          {activeAlertCount}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => handleNavigate('inventory_pro_chat')}
                      className="w-full px-3 py-2 rounded-xl hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      <span className="font-bold">Aquivo Intelligence AI</span>
                    </button>

                    <button
                      onClick={() => handleNavigate('help')}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4 text-slate-400" />
                      <span>Help & Documentation</span>
                    </button>
                  </div>

                  {/* Demo Conversion & Reset Options if in Demo Mode */}
                  {isDemo && (
                    <div className="p-2 border-t border-slate-100 bg-blue-50/40 space-y-1">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          setConversionInitialMode('register');
                          setShowConversionModal(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-2.5 transition-all text-xs font-bold text-left cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-4 h-4 text-blue-200" />
                        <span>Save Workspace (Register)</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowResetModal(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-amber-700 hover:bg-amber-50 flex items-center gap-2.5 transition-colors text-xs font-semibold text-left cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 text-amber-600" />
                        <span>Reset Demo Data</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          setConversionInitialMode('login');
                          setShowConversionModal(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 flex items-center gap-2.5 transition-colors text-xs font-semibold text-left cursor-pointer"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <span>Sign In with Existing Account</span>
                      </button>
                    </div>
                  )}

                  {/* Sign Out Section */}
                  <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                    <button
                      onClick={() => setShowLogoutConfirm(true)}
                      className="w-full px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors text-xs font-bold text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>{isDemo ? "Exit Demo Session" : "Sign Out"}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Account Conversion & Reset Modals */}
      <AccountConversionModal
        isOpen={showConversionModal}
        onClose={() => setShowConversionModal(false)}
        initialMode={conversionInitialMode}
      />

      <ResetDemoModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
      />

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center"
            >
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Confirm Sign Out</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed font-medium">
                Are you sure you want to end your current session? You will need to log in again to access the workspace.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    setShowProfileMenu(false);
                    logout();
                  }}
                  className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-200 cursor-pointer"
                >
                  Yes, Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export function BottomNav({
  currentView,
  onViewChange,
}: {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 md:hidden flex items-center justify-between px-2 pb-safe z-40 h-16 sm:h-20 shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
      {menuItems.filter((item) => item.id !== "inventory_pro_chat").map((item) => (
        <button
          key={item.id}
          onClick={() => onViewChange(item.id)}
          className={cn(
            "flex flex-col items-center justify-center flex-1 gap-1 h-full min-w-[64px] transition-all",
            currentView === item.id ? "text-blue-600" : "text-slate-400",
          )}
        >
          <div
            className={cn(
              "p-1.5 rounded-lg transition-all",
              currentView === item.id ? "bg-blue-50" : "",
            )}
          >
            <item.icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[10px] font-bold tracking-tight">
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
