import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Bookmark, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Calendar, 
  User, 
  Phone, 
  FileText, 
  ArrowRight, 
  Package, 
  RefreshCw, 
  Trash2, 
  Send, 
  Printer, 
  ExternalLink,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Building,
  Tag,
  Plus
} from 'lucide-react';
import { Product, StockReservation, ReservationStatus } from '../../../types';
import { ReservationService } from '../../../lib/reservationService';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  reservations: StockReservation[];
  preSelectedProduct?: Product | null;
  companyId: string;
  currency: string;
  currentUser: {
    uid?: string;
    displayName?: string;
    email?: string;
  };
  onSuccessToast?: (msg: string) => void;
}

const REASON_PRESETS = [
  'Customer Hold / Layaway',
  'Pending Invoice Payment',
  'B2B Wholesale Allocation',
  'Sales Quotation Hold',
  'Showroom / Exhibition Display',
  'Production & Assembly Buffer',
  'Warranty Replacement Hold',
  'VIP Client Pre-Order'
];

const EXPIRY_PRESETS = [
  { label: '24 Hours', hours: 24 },
  { label: '3 Days', hours: 72 },
  { label: '7 Days', hours: 168 },
  { label: '14 Days', hours: 336 },
  { label: '30 Days', hours: 720 },
];

export function ReservationModal({
  isOpen,
  onClose,
  products,
  reservations,
  preSelectedProduct,
  companyId,
  currency,
  currentUser,
  onSuccessToast
}: ReservationModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reservedFor, setReservedFor] = useState<string>('');
  const [contactInfo, setContactInfo] = useState<string>('');
  const [reason, setReason] = useState<string>(REASON_PRESETS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [location, setLocation] = useState<string>('Main Warehouse');
  const [notes, setNotes] = useState<string>('');
  const [expiryHours, setExpiryHours] = useState<number>(168); // 7 days default
  const [customExpiryDate, setCustomExpiryDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');

  // List view state
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');
  const [listSearch, setListSearch] = useState<string>('');
  const [selectedSlipReservation, setSelectedSlipReservation] = useState<StockReservation | null>(null);

  // Initialize or respond to preSelectedProduct
  useEffect(() => {
    if (preSelectedProduct) {
      setSelectedProductId(preSelectedProduct.id);
      setActiveTab('create');
      setQuantity(1);
    } else if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [preSelectedProduct, products]);

  // Selected product metadata
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const onHandStock = useMemo(() => {
    if (!selectedProduct) return 0;
    return Number(selectedProduct.quantity ?? selectedProduct.currentStock ?? 0);
  }, [selectedProduct]);

  const alreadyReserved = useMemo(() => {
    if (!selectedProduct) return 0;
    return Number(selectedProduct.reservedStock ?? 0);
  }, [selectedProduct]);

  const availableStock = useMemo(() => {
    return Math.max(0, onHandStock - alreadyReserved);
  }, [onHandStock, alreadyReserved]);

  // KPI Calculations for active reservations
  const kpis = useMemo(() => {
    const active = reservations.filter(r => r.status === 'ACTIVE');
    const totalUnits = active.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalVal = active.reduce((sum, r) => sum + (r.totalValue || (r.quantity * (r.unitPrice || 0))), 0);
    
    const now = Date.now();
    const expiringSoon = active.filter(r => {
      if (!r.expiryDate) return false;
      const exp = new Date(r.expiryDate).getTime();
      const diffHours = (exp - now) / (1000 * 60 * 60);
      return diffHours > 0 && diffHours <= 48;
    }).length;

    return {
      activeCount: active.length,
      totalUnits,
      totalVal,
      expiringSoon
    };
  }, [reservations]);

  // Filtered reservations list
  const filteredReservations = useMemo(() => {
    return reservations.filter(r => {
      const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
      const q = listSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        r.reservationNumber.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.reservedFor.toLowerCase().includes(q) ||
        (r.contactInfo && r.contactInfo.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [reservations, filterStatus, listSearch]);

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setErrorMsg('Please select a valid product.');
      return;
    }
    if (quantity <= 0) {
      setErrorMsg('Quantity must be greater than 0.');
      return;
    }
    if (quantity > availableStock) {
      setErrorMsg(`Cannot reserve ${quantity} units. Only ${availableStock} units available.`);
      return;
    }
    if (!reservedFor.trim()) {
      setErrorMsg('Please specify who this stock is reserved for (Customer/Order).');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      let finalExpiryIso: string;
      if (customExpiryDate) {
        finalExpiryIso = new Date(customExpiryDate).toISOString();
      } else {
        finalExpiryIso = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
      }

      const unitPrice = Number(selectedProduct.sellingPrice ?? selectedProduct.price ?? selectedProduct.unitPrice ?? 0);
      const chosenReason = reason === 'Other' ? customReason : reason;

      const created = await ReservationService.createReservation(companyId, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku || 'N/A',
        quantity,
        reservedFor: reservedFor.trim(),
        contactInfo: contactInfo.trim(),
        reason: chosenReason,
        expiryDate: finalExpiryIso,
        unitPrice,
        notes: notes.trim(),
        location,
        createdBy: currentUser.uid || 'system',
        createdByName: currentUser.displayName || currentUser.email || 'Inventory Staff',
        userEmail: currentUser.email || ''
      });

      setActionSuccessMsg(`Hold #${created.reservationNumber} confirmed! ${quantity} units reserved.`);
      if (onSuccessToast) {
        onSuccessToast(`Successfully reserved ${quantity} units of ${selectedProduct.name} for ${reservedFor}`);
      }

      // Reset form
      setQuantity(1);
      setReservedFor('');
      setContactInfo('');
      setNotes('');
      setCustomExpiryDate('');
      setActiveTab('list');
      setFilterStatus('ACTIVE');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create reservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFulfill = async (res: StockReservation) => {
    if (!confirm(`Fulfill reservation #${res.reservationNumber} for ${res.reservedFor}? This will deduct ${res.quantity} units from inventory on-hand.`)) {
      return;
    }
    try {
      await ReservationService.fulfillReservation(
        companyId,
        res,
        currentUser.uid || 'system',
        currentUser.displayName || currentUser.email || 'Staff'
      );
      setActionSuccessMsg(`Reservation #${res.reservationNumber} marked as FULFILLED!`);
    } catch (err: any) {
      alert('Error fulfilling reservation: ' + err.message);
    }
  };

  const handleRelease = async (res: StockReservation) => {
    if (!confirm(`Release hold on #${res.reservationNumber}? This will unlock ${res.quantity} units back into available inventory.`)) {
      return;
    }
    try {
      await ReservationService.releaseReservation(
        companyId,
        res,
        currentUser.uid || 'system',
        currentUser.displayName || currentUser.email || 'Staff',
        'Hold cancelled / stock returned to pool'
      );
      setActionSuccessMsg(`Reservation #${res.reservationNumber} released. Stock returned to available pool.`);
    } catch (err: any) {
      alert('Error releasing reservation: ' + err.message);
    }
  };

  const handleExtendExpiry = async (res: StockReservation) => {
    const currentExp = res.expiryDate ? new Date(res.expiryDate) : new Date();
    const newExp = new Date(currentExp.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await ReservationService.extendReservationExpiry(companyId, res.id, newExp);
      setActionSuccessMsg(`Reservation #${res.reservationNumber} extended by 7 days.`);
    } catch (err: any) {
      alert('Error extending reservation: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">Stock Reservations & Holds</h2>
                <span className="bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Inventory Lock
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Reserve products for customer orders, B2B quotes, and layaways without overselling.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3.5 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-slate-500 font-medium text-[11px]">Active Holds</p>
              <p className="text-lg font-bold text-slate-900">{kpis.activeCount} <span className="text-xs font-normal text-slate-400">orders</span></p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Bookmark className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-slate-500 font-medium text-[11px]">Units Reserved</p>
              <p className="text-lg font-bold text-slate-900">{kpis.totalUnits.toLocaleString()} <span className="text-xs font-normal text-slate-400">items</span></p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-slate-500 font-medium text-[11px]">Locked Value</p>
              <p className="text-lg font-bold text-emerald-600">{currency} {kpis.totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Tag className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-slate-500 font-medium text-[11px]">Expiring Soon (48h)</p>
              <p className={`text-lg font-bold ${kpis.expiringSoon > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{kpis.expiringSoon} <span className="text-xs font-normal text-slate-400">holds</span></p>
            </div>
            <div className={`w-8 h-8 rounded-lg ${kpis.expiringSoon > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'} flex items-center justify-center font-bold`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white">
          <button
            onClick={() => { setActiveTab('create'); setErrorMsg(''); setActionSuccessMsg(''); }}
            className={`flex items-center gap-2 py-3.5 px-4 font-bold text-xs border-b-2 transition-all ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Plus className="w-4 h-4" />
            New Stock Reservation
          </button>
          <button
            onClick={() => { setActiveTab('list'); setErrorMsg(''); setActionSuccessMsg(''); }}
            className={`flex items-center gap-2 py-3.5 px-4 font-bold text-xs border-b-2 transition-all ${
              activeTab === 'list'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            Active & Past Holds ({reservations.length})
          </button>
        </div>

        {/* Success / Info banner */}
        {actionSuccessMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button onClick={() => setActionSuccessMsg('')} className="text-emerald-600 font-bold hover:underline">Dismiss</button>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {activeTab === 'create' ? (
            <form onSubmit={handleCreateReservation} className="space-y-6 max-w-3xl mx-auto">
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Product Selection Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-indigo-600" />
                    Select Inventory Product <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Search by name or SKU</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter product dropdown..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-9 pr-3 h-10 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value);
                      setErrorMsg('');
                    }}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {products
                      .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())))
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.sku ? `(${p.sku})` : ''} — Stock: {p.quantity ?? p.currentStock ?? 0}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Selected Product Stock Status Card */}
                {selectedProduct && (
                  <div className="mt-3 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{selectedProduct.name}</h4>
                        <p className="text-xs text-slate-500">
                          SKU: <span className="font-mono font-bold text-slate-700">{selectedProduct.sku || 'N/A'}</span> • Category: {selectedProduct.category || 'General'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-center shadow-xs">
                          <span className="block text-[10px] uppercase font-bold text-slate-400">Total On-Hand</span>
                          <span className="text-xs font-bold text-slate-800">{onHandStock}</span>
                        </div>
                        <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-center shadow-xs">
                          <span className="block text-[10px] uppercase font-bold text-amber-600">Reserved</span>
                          <span className="text-xs font-bold text-amber-700">{alreadyReserved}</span>
                        </div>
                        <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center shadow-xs">
                          <span className="block text-[10px] uppercase font-bold text-emerald-600">Available to Reserve</span>
                          <span className="text-sm font-black text-emerald-700">{availableStock}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Reservation Parameters */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Bookmark className="w-4 h-4 text-indigo-600" />
                  Reservation Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Quantity to Reserve <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, availableStock)}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Max available: {availableStock} units
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Reserved For / Customer <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. Acme Corp / Jane Doe"
                        value={reservedFor}
                        onChange={(e) => setReservedFor(e.target.value)}
                        className="w-full pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Customer Contact / Phone / Email
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. +1 555-0192 or email"
                        value={contactInfo}
                        onChange={(e) => setContactInfo(e.target.value)}
                        className="w-full pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Reason / Purpose
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      {REASON_PRESETS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                      <option value="Other">Other (Custom Reason)</option>
                    </select>

                    {reason === 'Other' && (
                      <input
                        type="text"
                        placeholder="Specify custom reason..."
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        className="mt-2 w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Warehouse Location
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <select
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="Main Warehouse">Main Warehouse</option>
                        <option value="Downtown Retail Store">Downtown Retail Store</option>
                        <option value="Northside Distribution">Northside Distribution</option>
                        <option value="Eastside Logistics Hub">Eastside Logistics Hub</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Expiration Duration Presets */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Hold Expiry Duration
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EXPIRY_PRESETS.map(preset => (
                      <button
                        type="button"
                        key={preset.hours}
                        onClick={() => {
                          setExpiryHours(preset.hours);
                          setCustomExpiryDate('');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          expiryHours === preset.hours && !customExpiryDate
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">or Custom:</span>
                      <input
                        type="datetime-local"
                        value={customExpiryDate}
                        onChange={(e) => {
                          setCustomExpiryDate(e.target.value);
                          setExpiryHours(0);
                        }}
                        className="h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Internal Notes & Fulfillment Instructions
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Customer will collect on Friday afternoon. Deposit invoice #1042 issued."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Total Estimated Value Summary */}
              {selectedProduct && (
                <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    <div>
                      <span className="text-xs font-bold text-indigo-950">Estimated Reserved Stock Value</span>
                      <p className="text-[11px] text-indigo-700">
                        {quantity} unit(s) @ {currency} {Number(selectedProduct.sellingPrice || selectedProduct.price || 0).toFixed(2)} / unit
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-indigo-900">
                      {currency} {(quantity * Number(selectedProduct.sellingPrice || selectedProduct.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 h-11 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || availableStock <= 0}
                  className="px-6 h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Locking Stock...
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4" />
                      Confirm Stock Hold
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Tab 2: Active & Past Holds List */
            <div className="space-y-4">
              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by ref #, customer, SKU, product..."
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    className="w-full pl-9 pr-3 h-10 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  {(['ACTIVE', 'ALL', 'FULFILLED', 'RELEASED', 'EXPIRED'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        filterStatus === st
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st === 'ACTIVE' ? 'Active Holds' : st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reservations Table / Cards */}
              {filteredReservations.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
                  <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-700">No Reservations Found</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {filterStatus === 'ACTIVE'
                      ? 'There are currently no active stock holds. You can reserve stock for upcoming customer orders anytime.'
                      : 'No records match your selected filter criteria.'}
                  </p>
                  <button
                    onClick={() => { setActiveTab('create'); }}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 h-9 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create First Reservation
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReservations.map(res => {
                    const isExpired = res.status === 'ACTIVE' && res.expiryDate && new Date(res.expiryDate).getTime() < Date.now();
                    const expiryDateObj = res.expiryDate ? new Date(res.expiryDate) : null;
                    const hoursLeft = expiryDateObj ? Math.round((expiryDateObj.getTime() - Date.now()) / (1000 * 60 * 60)) : null;

                    return (
                      <div
                        key={res.id}
                        className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                              {res.reservationNumber}
                            </span>

                            {res.status === 'ACTIVE' ? (
                              isExpired ? (
                                <span className="bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Expired
                                </span>
                              ) : (
                                <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
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

                            <span className="text-[11px] text-slate-400">
                              Location: <span className="font-medium text-slate-600">{res.location || 'Main Warehouse'}</span>
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              {res.productName}
                              <span className="text-xs font-mono font-normal text-slate-500">[{res.sku}]</span>
                            </h4>
                            <p className="text-xs text-slate-600 mt-0.5">
                              Reserved for: <strong className="text-slate-900 font-bold">{res.reservedFor}</strong>
                              {res.contactInfo && <span className="text-slate-500"> • {res.contactInfo}</span>}
                              {res.reason && <span className="text-indigo-600 font-medium"> • {res.reason}</span>}
                            </p>
                          </div>

                          {res.notes && (
                            <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                              "{res.notes}"
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                            <span className="flex items-center gap-1">
                              <Package className="w-3.5 h-3.5 text-slate-400" />
                              Qty: <strong className="text-slate-800">{res.quantity} units</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              <Tag className="w-3.5 h-3.5 text-slate-400" />
                              Val: <strong className="text-slate-800">{currency} {(res.totalValue || (res.quantity * (res.unitPrice || 0))).toFixed(2)}</strong>
                            </span>
                            {expiryDateObj && res.status === 'ACTIVE' && (
                              <span className={`flex items-center gap-1 font-medium ${
                                hoursLeft !== null && hoursLeft < 24 ? 'text-rose-600' : hoursLeft !== null && hoursLeft < 72 ? 'text-amber-600' : 'text-slate-500'
                              }`}>
                                <Clock className="w-3.5 h-3.5" />
                                {hoursLeft !== null && hoursLeft > 0 
                                  ? `Expires in ${hoursLeft > 48 ? `${Math.round(hoursLeft / 24)} days` : `${hoursLeft}h`}` 
                                  : 'Expired'} ({expiryDateObj.toLocaleDateString()})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions for this reservation */}
                        <div className="flex flex-wrap md:flex-col items-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                          {res.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => handleFulfill(res)}
                                className="px-3 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                                title="Fulfill & deduct from stock on-hand"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Fulfill Hold
                              </button>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleExtendExpiry(res)}
                                  className="px-2.5 h-8 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                  title="Extend expiration by +7 days"
                                >
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  +7 Days
                                </button>
                                <button
                                  onClick={() => handleRelease(res)}
                                  className="px-2.5 h-8 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                  title="Cancel hold and return stock to pool"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-500" />
                                  Release
                                </button>
                              </div>
                            </>
                          )}

                          <button
                            onClick={() => setSelectedSlipReservation(res)}
                            className="px-2.5 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-500" />
                            Hold Slip
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-500" />
            <span>Reserved stock is locked from general checkout and automatically synced to Procurement &gt; Reservations.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Printable Slip Preview Sub-Modal */}
      {selectedSlipReservation && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Stock Reservation Slip</h3>
              </div>
              <button
                onClick={() => setSelectedSlipReservation(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 bg-slate-50/50 font-mono text-xs space-y-3">
              <div className="text-center border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold tracking-wider text-slate-900">INVENTORY RESERVATION HOLD</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">REF: {selectedSlipReservation.reservationNumber}</p>
                <div className="mt-2 inline-block bg-slate-900 text-white font-bold px-3 py-1 text-[10px] rounded tracking-widest uppercase">
                  STATUS: {selectedSlipReservation.status}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">RESERVED FOR</span>
                  <span className="font-bold text-slate-900">{selectedSlipReservation.reservedFor}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CONTACT INFO</span>
                  <span className="font-bold text-slate-900">{selectedSlipReservation.contactInfo || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">RESERVED DATE</span>
                  <span>{new Date(selectedSlipReservation.reservedDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">EXPIRY DATE</span>
                  <span className="text-rose-600 font-bold">{selectedSlipReservation.expiryDate ? new Date(selectedSlipReservation.expiryDate).toLocaleDateString() : 'None'}</span>
                </div>
              </div>

              <div className="border-t border-b border-slate-200 py-2.5 my-2">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>{selectedSlipReservation.productName} ({selectedSlipReservation.sku})</span>
                  <span>x{selectedSlipReservation.quantity}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[10px] mt-1">
                  <span>Location: {selectedSlipReservation.location || 'Main Warehouse'}</span>
                  <span>Total: {currency} {(selectedSlipReservation.totalValue || 0).toFixed(2)}</span>
                </div>
              </div>

              {selectedSlipReservation.notes && (
                <div className="text-[10px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                  <strong>Notes:</strong> {selectedSlipReservation.notes}
                </div>
              )}

              <div className="text-center text-[10px] text-slate-400 pt-1">
                Generated by Invenio Inventory OS • Authorized Hold Document
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 h-9 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Hold Slip
              </button>
              <button
                onClick={() => setSelectedSlipReservation(null)}
                className="px-4 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
