import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { ViewType, Product } from "../../types";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../contexts/AuthContext";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

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
  { id: "categories" as ViewType, label: "Categories", icon: Grid3X3 },
  { id: "warehouses" as ViewType, label: "Warehouses", icon: Warehouse },
];

const menuGroups = [
  {
    id: "sales",
    label: "Sales",
    icon: Receipt,
    children: [
      { id: "quotations" as ViewType, label: "Quotations", icon: FileText },
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
      {
        id: "procurement_hub" as ViewType,
        label: "Procurement Hub",
        icon: ShoppingCart,
      },
    ],
  },
  {
    id: "production",
    label: "Production",
    icon: Factory,
    children: [
      { id: "bom" as ViewType, label: "Bills of Materials", icon: Boxes },
      {
        id: "production_orders" as ViewType,
        label: "Production Orders",
        icon: Factory,
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
        id: "suppliers_contact" as ViewType,
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
      { id: "spend_analysis" as ViewType, label: "Spend Analysis", icon: Layers },
      { id: "profit_tracking" as ViewType, label: "Profit Tracking", icon: DollarSign },
      { id: "forecast" as ViewType, label: "Forecast", icon: LineChart },
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
  const [isLargeScreen, setIsLargeScreen] = React.useState(false);
  const [expandedSections, setExpandedSections] = React.useState<
    Record<string, boolean>
  >({
    sales: false,
    procurement: false,
    production: false,
    contacts: false,
    insights: false,
  });

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
                  InventoryPro
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
                {menuGroups.map((group) => (
                  <NavButton
                    key={group.id}
                    item={group}
                    isCollapsed={true}
                    isActive={group.children.some(
                      (child) => child.id === currentView,
                    )}
                    onClick={() => toggleSection(group.id)}
                  />
                ))}
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
                        {group.children.map((child) => (
                          <NavButton
                            key={child.id}
                            item={child}
                            isSub={true}
                            isCollapsed={false}
                            isActive={currentView === child.id}
                            onClick={() => handleNavClick(child.id)}
                          />
                        ))}
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

export function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, profile, logout } = useAuth();
  const title = user?.displayName || user?.email?.split("@")[0] || "User";
  const [expiryAlertCount, setExpiryAlertCount] = useState(0);

  useEffect(() => {
    if (!profile?.companyId) return;

    const path = `companies/${profile.companyId}/products`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let count = 0;

      snapshot.docs.forEach((doc) => {
        const item = doc.data() as Product;
        if (item.expiryDate) {
          const exp = new Date(item.expiryDate);
          exp.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil(
            (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (diffDays <= 14) {
            count++;
          }
        }
      });
      setExpiryAlertCount(count);
    });

    return () => unsubscribe();
  }, [profile?.companyId]);

  return (
    <header className="sticky top-0 z-30 bg-brand-header border-b border-brand-border h-16 flex items-center px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="relative flex-1 max-w-[200px] sm:max-w-sm group text-left">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder-slate-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 ml-4">
        <div className="relative group">
          <button className="p-2.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 rounded-full relative transition-all duration-300 transform group-hover:scale-105 group-active:scale-95">
            <Bell className="w-5 h-5 transition-transform duration-300" />

            {expiryAlertCount > 0 && (
              <span className="absolute top-2 right-2 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-rose-500 text-[9px] font-black text-white shadow-sm ring-2 ring-white overflow-hidden">
                  {expiryAlertCount}
                </span>
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 group border-l border-slate-100 pl-4 ml-1 sm:ml-0 relative">
          <div className="hidden lg:block text-right">
            <p className="text-[13px] font-bold text-slate-900 leading-none capitalize">
              {title}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Inventory Manager</p>
          </div>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to log out?")) {
                logout();
              }
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-200 flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden shrink-0 hover:ring-2 hover:ring-blue-500 transition-all group"
            title="Log out"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 group-hover:text-blue-600" />
            )}
          </button>
        </div>
      </div>
    </header>
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
