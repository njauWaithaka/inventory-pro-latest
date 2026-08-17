import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bookmark, Plus, Search, Filter, Clock, CheckCircle2, 
  AlertCircle, DollarSign, Package, MoreVertical, Eye, 
  RefreshCw, Trash2, Printer, ArrowRight, ExternalLink,
  ShieldAlert, Sparkles, Building, Tag, ShoppingCart, 
  ChevronRight, Calendar, User, Phone, AlertTriangle,
  ArrowUpRight, FileText, Download, Check, X, Truck
} from 'lucide-react';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { Product, StockReservation, PurchaseOrder, ViewType } from '../../../types';
import { ReservationService } from '../../../lib/reservationService';
import { ReservationModal } from '../inventory/ReservationModal';
import { ConfirmationModal } from '../../ConfirmationModal';
import { motion, AnimatePresence } from 'motion/react';
import { InsightBadge } from '../../common/InsightBadge';

interface ReservationsProps {
  onNavigate?: (view: ViewType) => void;
}

export function Reservations({ onNavigate }: ReservationsProps) {
  const { user } = useAuth();
  const { profile, company, settings } = useSettings();
  const currency = settings?.currency || company?.currency || 'KSh';

  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search State
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ALL' | 'SHORTFALL' | 'EXPIRING' | 'FULFILLED' | 'RELEASED'>('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [selectedReason, setSelectedReason] = useState<string>('all');
  
  // Modals & Action States
  const [isNewReservationModalOpen, setIsNewReservationModalOpen] = useState(false);
  const [selectedSlipReservation, setSelectedSlipReservation] = useState<StockReservation | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Real-time Firestore Subscriptions
  useEffect(() => {
    if (!profile?.companyId) return;

    // 1. Reservations subscription
    const reservationsPath = `companies/${profile.companyId}/reservations`;
    const unsubscribeReservations = onSnapshot(
      collection(db, reservationsPath),
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as StockReservation[];
        docs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setReservations(docs);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching reservations:', error);
        setLoading(false);
      }
    );

    // 2. Products subscription
    const productsPath = `companies/${profile.companyId}/products`;
    const unsubscribeProducts = onSnapshot(
      collection(db, productsPath),
      (snapshot) => {
        const prods = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as Product[];
        setProducts(prods);
      },
      (error) => {
        console.error('Error fetching products:', error);
      }
    );

    // 3. Purchase Orders subscription
    const poPath = `companies/${profile.companyId}/purchaseOrders`;
    const unsubscribePOs = onSnapshot(
      collection(db, poPath),
      (snapshot) => {
        const pos = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as PurchaseOrder[];
        setPurchaseOrders(pos);
      },
      (error) => {
        console.error('Error fetching POs:', error);
      }
    );

    return () => {
      unsubscribeReservations();
      unsubscribeProducts();
      unsubscribePOs();
    };
  }, [profile?.companyId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Product map lookup for fast access
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Derived Analytics & KPIs
  const kpis = useMemo(() => {
    const active = reservations.filter((r) => r.status === 'ACTIVE');
    const totalUnitsReserved = active.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalValueLocked = active.reduce((sum, r) => sum + (r.totalValue || (r.quantity * (r.unitPrice || 0))), 0);

    const now = Date.now();
    const expiringSoon = active.filter((r) => {
      if (!r.expiryDate) return false;
      const exp = new Date(r.expiryDate).getTime();
      const diffHours = (exp - now) / (1000 * 60 * 60);
      return diffHours > 0 && diffHours <= 48;
    });

    // Check items with shortfall: available stock (on-hand - reserved) is 0 or less than reorder level
    const shortfallReservations = active.filter((r) => {
      const prod = productMap.get(r.productId);
      if (!prod) return false;
      const currentQty = Number(prod.quantity ?? prod.currentStock ?? 0);
      const currentReserved = Number(prod.reservedStock ?? 0);
      const available = currentQty - currentReserved;
      const reorderPoint = Number(prod.reorderPoint ?? prod.reorderLevel ?? prod.minStock ?? 5);
      return available <= 0 || available < reorderPoint;
    });

    const fulfilledCount = reservations.filter((r) => r.status === 'FULFILLED').length;

    return {
      activeCount: active.length,
      totalUnitsReserved,
      totalValueLocked,
      expiringSoonCount: expiringSoon.length,
      shortfallCount: shortfallReservations.length,
      fulfilledCount,
      totalCount: reservations.length
    };
  }, [reservations, productMap]);

  // Filtered reservations list
  const filteredReservations = useMemo(() => {
    const now = Date.now();
    return reservations.filter((r) => {
      // Tab matching
      if (activeTab === 'ACTIVE' && r.status !== 'ACTIVE') return false;
      if (activeTab === 'FULFILLED' && r.status !== 'FULFILLED') return false;
      if (activeTab === 'RELEASED' && (r.status !== 'RELEASED' && r.status !== 'EXPIRED')) return false;
      if (activeTab === 'EXPIRING') {
        if (r.status !== 'ACTIVE' || !r.expiryDate) return false;
        const diffHours = (new Date(r.expiryDate).getTime() - now) / (1000 * 60 * 60);
        if (diffHours <= 0 || diffHours > 48) return false;
      }
      if (activeTab === 'SHORTFALL') {
        if (r.status !== 'ACTIVE') return false;
        const prod = productMap.get(r.productId);
        if (!prod) return false;
        const currentQty = Number(prod.quantity ?? prod.currentStock ?? 0);
        const currentReserved = Number(prod.reservedStock ?? 0);
        const available = currentQty - currentReserved;
        const reorderPoint = Number(prod.reorderPoint ?? prod.reorderLevel ?? prod.minStock ?? 5);
        if (available > 0 && available >= reorderPoint) return false;
      }

      // Warehouse filter
      if (selectedWarehouse !== 'all' && r.location !== selectedWarehouse) return false;

      // Reason filter
      if (selectedReason !== 'all' && r.reason !== selectedReason) return false;

      // Search query matching
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesRef = r.reservationNumber?.toLowerCase().includes(q);
        const matchesProduct = r.productName?.toLowerCase().includes(q);
        const matchesSku = r.sku?.toLowerCase().includes(q);
        const matchesCustomer = r.reservedFor?.toLowerCase().includes(q);
        const matchesContact = r.contactInfo?.toLowerCase().includes(q);
        const matchesReason = r.reason?.toLowerCase().includes(q);
        const matchesNotes = r.notes?.toLowerCase().includes(q);
        if (!matchesRef && !matchesProduct && !matchesSku && !matchesCustomer && !matchesContact && !matchesReason && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [reservations, activeTab, selectedWarehouse, selectedReason, searchTerm, productMap]);

  // Distinct locations & reasons for dropdown filters
  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    reservations.forEach((r) => {
      if (r.location) set.add(r.location);
    });
    return Array.from(set);
  }, [reservations]);

  const uniqueReasons = useMemo(() => {
    const set = new Set<string>();
    reservations.forEach((r) => {
      if (r.reason) set.add(r.reason);
    });
    return Array.from(set);
  }, [reservations]);

  // Actions
  const handleFulfillReservation = (res: StockReservation) => {
    setConfirmConfig({
      isOpen: true,
      title: `Fulfill Reservation #${res.reservationNumber}`,
      message: `Are you sure you want to mark this hold for ${res.reservedFor} as fulfilled? This will deduct ${res.quantity} unit(s) of "${res.productName}" from active inventory.`,
      confirmText: 'Confirm Fulfillment',
      type: 'info',
      onConfirm: async () => {
        try {
          await ReservationService.fulfillReservation(
            profile?.companyId || '',
            res,
            user?.uid || 'system',
            profile?.displayName || user?.displayName || user?.email || 'Staff'
          );
          showToast(`Reservation #${res.reservationNumber} fulfilled successfully.`);
        } catch (err: any) {
          showToast(`Error: ${err.message || 'Failed to fulfill reservation'}`);
        } finally {
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleReleaseReservation = (res: StockReservation) => {
    setConfirmConfig({
      isOpen: true,
      title: `Release Hold #${res.reservationNumber}`,
      message: `Release the stock reservation for ${res.reservedFor}? This will return ${res.quantity} unit(s) of "${res.productName}" back to the general available inventory pool.`,
      confirmText: 'Release Stock Hold',
      type: 'warning',
      onConfirm: async () => {
        try {
          await ReservationService.releaseReservation(
            profile?.companyId || '',
            res,
            user?.uid || 'system',
            profile?.displayName || user?.displayName || user?.email || 'Staff',
            'Cancelled from Procurement Reservations'
          );
          showToast(`Hold on #${res.reservationNumber} released. Stock returned to available pool.`);
        } catch (err: any) {
          showToast(`Error: ${err.message || 'Failed to release reservation'}`);
        } finally {
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleExtendExpiry = async (res: StockReservation) => {
    const currentExp = res.expiryDate ? new Date(res.expiryDate) : new Date();
    const newExp = new Date(currentExp.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await ReservationService.extendReservationExpiry(profile?.companyId || '', res.id, newExp);
      showToast(`Reservation #${res.reservationNumber} extended by 7 days.`);
    } catch (err: any) {
      showToast(`Error extending reservation: ${err.message}`);
    }
  };

  const handleExportCSV = () => {
    if (reservations.length === 0) {
      showToast('No reservations to export.');
      return;
    }
    const headers = ['Reservation #', 'Product', 'SKU', 'Quantity', 'Unit Price', 'Total Value', 'Reserved For', 'Contact', 'Reason', 'Status', 'Location', 'Reserved Date', 'Expiry Date', 'Notes'];
    const rows = filteredReservations.map(r => [
      `"${r.reservationNumber || ''}"`,
      `"${(r.productName || '').replace(/"/g, '""')}"`,
      `"${r.sku || ''}"`,
      r.quantity || 0,
      r.unitPrice || 0,
      r.totalValue || (r.quantity * (r.unitPrice || 0)),
      `"${(r.reservedFor || '').replace(/"/g, '""')}"`,
      `"${(r.contactInfo || '').replace(/"/g, '""')}"`,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      r.status,
      `"${r.location || 'Main Warehouse'}"`,
      r.reservedDate || '',
      r.expiryDate || '',
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `procurement_reservations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported reservations CSV.');
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 text-xs font-bold"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
            <button onClick={() => setToastMessage('')} className="text-slate-400 hover:text-white ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Procurement Reservations
            </h1>
            <span className="bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full">
              Stock Holds
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-1">
            Monitor reserved inventory, customer allocations, stock commitments, and procurement replenishment triggers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="h-10 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            title="Export filtered reservations to CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('purchase_orders')}
              className="h-10 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <span>Purchase Orders</span>
            </button>
          )}

          <button
            onClick={() => setIsNewReservationModalOpen(true)}
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 hover:scale-[1.01] active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            <span>New Reservation</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Holds */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Stock Holds</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {kpis.activeCount}
              <span className="text-xs font-normal text-slate-400 ml-1.5">orders</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {kpis.totalUnitsReserved.toLocaleString()} total units committed
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0 border border-indigo-100">
            <Bookmark className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Committed Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Committed Value</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              {currency} {formatCompactNumber(kpis.totalValueLocked)}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {currency} {kpis.totalValueLocked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 border border-emerald-100">
            <Tag className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Replenishment Shortfalls */}
        <div className={cn(
          "p-5 rounded-2xl border shadow-sm flex items-center justify-between transition-all hover:shadow-md",
          kpis.shortfallCount > 0 
            ? "bg-rose-50/40 border-rose-200" 
            : "bg-white border-slate-200"
        )}>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reorder Shortfalls</p>
              {kpis.shortfallCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </div>
            <h3 className={cn("text-2xl font-black mt-1", kpis.shortfallCount > 0 ? "text-rose-600" : "text-slate-900")}>
              {kpis.shortfallCount}
              <span className="text-xs font-normal text-slate-400 ml-1.5">items low</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {kpis.shortfallCount > 0 ? "Reserved stock exceeds free pool" : "All reserved items healthy"}
            </p>
          </div>
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center font-bold shrink-0 border",
            kpis.shortfallCount > 0 
              ? "bg-rose-100/70 text-rose-600 border-rose-200" 
              : "bg-slate-50 text-slate-400 border-slate-200"
          )}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Expiring Soon */}
        <div className={cn(
          "p-5 rounded-2xl border shadow-sm flex items-center justify-between transition-all hover:shadow-md",
          kpis.expiringSoonCount > 0 
            ? "bg-amber-50/40 border-amber-200" 
            : "bg-white border-slate-200"
        )}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Expiring in 48h</p>
            <h3 className={cn("text-2xl font-black mt-1", kpis.expiringSoonCount > 0 ? "text-amber-600" : "text-slate-900")}>
              {kpis.expiringSoonCount}
              <span className="text-xs font-normal text-slate-400 ml-1.5">holds</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {kpis.fulfilledCount} historical holds fulfilled
            </p>
          </div>
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center font-bold shrink-0 border",
            kpis.expiringSoonCount > 0 
              ? "bg-amber-100/70 text-amber-600 border-amber-200" 
              : "bg-slate-50 text-slate-400 border-slate-200"
          )}>
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Dynamic Intelligence Telemetry */}
      <InsightBadge
        elementId="procurement_reservations_health"
        variant="banner"
        className="w-full"
      />

      {/* Main Content Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
        
        {/* Navigation Tabs */}
        <div className="px-6 py-2 border-b border-slate-100 flex items-center justify-between overflow-x-auto no-scrollbar gap-4">
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            {[
              { id: 'ACTIVE', label: `Active Holds (${kpis.activeCount})` },
              { id: 'SHORTFALL', label: `Low Stock / Shortfall (${kpis.shortfallCount})`, alert: kpis.shortfallCount > 0 },
              { id: 'EXPIRING', label: `Expiring Soon (${kpis.expiringSoonCount})` },
              { id: 'ALL', label: `All Holds (${kpis.totalCount})` },
              { id: 'FULFILLED', label: `Fulfilled (${kpis.fulfilledCount})` },
              { id: 'RELEASED', label: 'Released / Cancelled' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "relative py-3.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5",
                  activeTab === tab.id 
                    ? "text-indigo-600 border-indigo-600" 
                    : "text-slate-400 border-transparent hover:text-slate-600"
                )}
              >
                <span>{tab.label}</span>
                {tab.alert && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 py-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest hidden lg:inline">
              Showing {filteredReservations.length} records
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference #, product, SKU, customer, contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 h-10 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Secondary Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Warehouse Filter */}
            {uniqueLocations.length > 0 && (
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="all">All Locations</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            )}

            {/* Reason Filter */}
            {uniqueReasons.length > 0 && (
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="all">All Reasons</option>
                {uniqueReasons.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}

            {(selectedWarehouse !== 'all' || selectedReason !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedWarehouse('all');
                  setSelectedReason('all');
                  setSearchTerm('');
                }}
                className="h-10 px-3 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-xl transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Reservations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Reference & Status</th>
                <th className="px-6 py-4">Product & SKU</th>
                <th className="px-6 py-4">Reserved For / Customer</th>
                <th className="px-6 py-4 text-center">Quantity</th>
                <th className="px-6 py-4 text-right">Committed Value</th>
                <th className="px-6 py-4 text-center">Available Stock</th>
                <th className="px-6 py-4">Expiry / SLA</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredReservations.map((res) => {
                const prod = productMap.get(res.productId);
                const currentQty = Number(prod?.quantity ?? prod?.currentStock ?? 0);
                const currentReserved = Number(prod?.reservedStock ?? 0);
                const freeStock = Math.max(0, currentQty - currentReserved);
                const isShortfall = freeStock <= 0;

                const isExpired = res.status === 'ACTIVE' && res.expiryDate && new Date(res.expiryDate).getTime() < Date.now();
                const expiryDateObj = res.expiryDate ? new Date(res.expiryDate) : null;
                const hoursLeft = expiryDateObj ? Math.round((expiryDateObj.getTime() - Date.now()) / (1000 * 60 * 60)) : null;

                return (
                  <tr key={res.id} className="hover:bg-slate-50/60 transition-colors group">
                    {/* Column 1: Reference & Status */}
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md inline-block">
                          {res.reservationNumber}
                        </span>
                        <div>
                          {res.status === 'ACTIVE' ? (
                            isExpired ? (
                              <span className="bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Expired
                              </span>
                            ) : (
                              <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Active Hold
                              </span>
                            )
                          ) : res.status === 'FULFILLED' ? (
                            <span className="bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                              Fulfilled
                            </span>
                          ) : (
                            <span className="bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                              {res.status}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {new Date(res.createdAt || res.reservedDate).toLocaleDateString()}
                        </p>
                      </div>
                    </td>

                    {/* Column 2: Product & SKU */}
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-900 block leading-tight">
                          {res.productName}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600">
                            {res.sku || 'N/A'}
                          </span>
                          <span>•</span>
                          <span>{res.location || 'Main Warehouse'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Column 3: Reserved For / Customer */}
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {res.reservedFor}
                        </span>
                        {res.contactInfo && (
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {res.contactInfo}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-indigo-600 block">
                          {res.reason}
                        </span>
                      </div>
                    </td>

                    {/* Column 4: Quantity */}
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {res.quantity} {prod?.uom || 'units'}
                      </span>
                    </td>

                    {/* Column 5: Committed Value */}
                    <td className="px-6 py-4 text-right">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black text-slate-900">
                          {currency} {(res.totalValue || (res.quantity * (res.unitPrice || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          @{currency} {Number(res.unitPrice || 0).toFixed(2)}/u
                        </span>
                      </div>
                    </td>

                    {/* Column 6: Available Stock & Shortfall Alert */}
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded-md",
                          freeStock > 5 ? "text-emerald-700 bg-emerald-50" :
                          freeStock > 0 ? "text-amber-700 bg-amber-50" :
                          "text-rose-700 bg-rose-50"
                        )}>
                          {freeStock} free / {currentQty} total
                        </span>
                        {isShortfall && res.status === 'ACTIVE' && (
                          <span className="text-[9px] font-black uppercase text-rose-600 tracking-wider mt-0.5 flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Shortfall
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 7: Expiry / SLA */}
                    <td className="px-6 py-4">
                      {expiryDateObj && res.status === 'ACTIVE' ? (
                        <div className="space-y-0.5">
                          <span className={cn(
                            "text-xs font-bold flex items-center gap-1",
                            hoursLeft !== null && hoursLeft < 24 ? "text-rose-600" :
                            hoursLeft !== null && hoursLeft < 72 ? "text-amber-600" :
                            "text-slate-600"
                          )}>
                            <Clock className="w-3.5 h-3.5" />
                            {hoursLeft !== null && hoursLeft > 0 
                              ? `${hoursLeft > 48 ? `${Math.round(hoursLeft / 24)} days` : `${hoursLeft}h`} left` 
                              : 'Expired'}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {expiryDateObj.toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* Column 8: Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {res.status === 'ACTIVE' && (
                          <>
                            <button
                              onClick={() => handleFulfillReservation(res)}
                              className="px-2.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                              title="Fulfill hold and deduct inventory"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Fulfill</span>
                            </button>

                            <button
                              onClick={() => handleExtendExpiry(res)}
                              className="px-2 h-8 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                              title="Extend expiration by 7 days"
                            >
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span className="hidden 2xl:inline">+7d</span>
                            </button>

                            <button
                              onClick={() => handleReleaseReservation(res)}
                              className="px-2 h-8 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                              title="Release hold and return stock to pool"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => setSelectedSlipReservation(res)}
                          className="px-2.5 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                          title="Print hold slip"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500" />
                          <span className="hidden sm:inline">Slip</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredReservations.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <Bookmark className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                    <h3 className="text-sm font-bold text-slate-700">No Reservations Found</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {activeTab === 'ACTIVE'
                        ? 'There are currently no active stock holds. Reserved inventory from Inventory or POS will automatically show up here.'
                        : 'No records matching the selected tab and filters.'}
                    </p>
                    <button
                      onClick={() => setIsNewReservationModalOpen(true)}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 h-9 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Create New Hold
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Reservation Modal */}
      <ReservationModal
        isOpen={isNewReservationModalOpen}
        onClose={() => setIsNewReservationModalOpen(false)}
        products={products}
        reservations={reservations}
        companyId={profile?.companyId || ''}
        currency={currency}
        currentUser={{
          uid: user?.uid,
          displayName: profile?.displayName || user?.displayName || '',
          email: user?.email || ''
        }}
        onSuccessToast={showToast}
      />

      {/* Printable Hold Slip Modal */}
      {selectedSlipReservation && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Stock Reservation Slip</h3>
              </div>
              <button
                onClick={() => setSelectedSlipReservation(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 bg-slate-50/50 font-mono text-xs space-y-3">
              <div className="text-center border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold tracking-wider text-slate-900">
                  {company?.name || 'PROCUREMENT DEPARTMENT'}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">STOCK HOLD DOCKET</p>
                <div className="mt-2 inline-block bg-slate-900 text-white font-bold px-3 py-1 text-[10px] rounded tracking-widest uppercase">
                  REF: {selectedSlipReservation.reservationNumber}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">CUSTOMER / HOLD FOR</span>
                  <span className="font-bold text-slate-900">{selectedSlipReservation.reservedFor}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CONTACT INFO</span>
                  <span className="font-bold text-slate-900">{selectedSlipReservation.contactInfo || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">LOCATION / BRANCH</span>
                  <span className="font-bold text-slate-900">{selectedSlipReservation.location || 'Main Warehouse'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">RESERVATION STATUS</span>
                  <span className="font-bold text-indigo-700 uppercase">{selectedSlipReservation.status}</span>
                </div>
              </div>

              <div className="border-t border-b border-slate-200 py-3 space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>{selectedSlipReservation.productName}</span>
                  <span>{selectedSlipReservation.quantity} unit(s)</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[10px]">
                  <span>SKU: {selectedSlipReservation.sku || 'N/A'}</span>
                  <span>@{currency} {Number(selectedSlipReservation.unitPrice || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 text-xs">
                  <span>TOTAL ESTIMATED VALUATION:</span>
                  <span className="text-indigo-700">{currency} {(selectedSlipReservation.totalValue || (selectedSlipReservation.quantity * (selectedSlipReservation.unitPrice || 0))).toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                <div>
                  <span className="text-slate-400 block">RESERVED DATE:</span>
                  <span>{new Date(selectedSlipReservation.reservedDate || selectedSlipReservation.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">HOLD EXPIRATION:</span>
                  <span className="font-bold text-rose-600">
                    {selectedSlipReservation.expiryDate ? new Date(selectedSlipReservation.expiryDate).toLocaleString() : 'No expiry set'}
                  </span>
                </div>
              </div>

              {selectedSlipReservation.notes && (
                <div className="bg-white p-2 rounded border border-slate-200 text-[10px] text-slate-600">
                  <span className="font-bold block text-slate-400">NOTES:</span>
                  {selectedSlipReservation.notes}
                </div>
              )}

              <div className="text-center pt-2 text-[9px] text-slate-400 uppercase tracking-widest">
                Generated via Invenio Cloud ERP • Stock locked from general pool
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedSlipReservation(null)}
                className="px-4 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Print Docket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        type={confirmConfig.type}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
