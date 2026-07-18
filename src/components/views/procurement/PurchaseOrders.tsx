import React, { useState, useEffect } from 'react';
import { Plus, Printer, Search, MoreVertical, Loader2, ShoppingCart, X, Package, Trash2, CheckCircle2, Eye, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { collection, onSnapshot, query, where, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { ProcurementService } from '../../../lib/procurementService';
import { PurchaseOrder, POItem, Product, POStatus } from '../../../types';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmationModal } from '../../ConfirmationModal';

export function PurchaseOrders() {
  const { user } = useAuth();
  const { profile, company, settings } = useSettings();
  const currency = settings?.currency || company?.currency || 'KSh';

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    type?: "danger" | "warning" | "info" | "success";
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  const handlePrintPO = () => {
    window.print();
  };

  // New PO State
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<POItem[]>([]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  useEffect(() => {
    if (!profile?.companyId) {
      console.log("PurchaseOrders.tsx useEffect: No profile or companyId found yet.", profile);
      return;
    }
    const poPath = `companies/${profile.companyId}/purchaseOrders`;
    console.log("PurchaseOrders.tsx useEffect: Subscribing to purchase orders path:", poPath);
    
    const unsubscribe = onSnapshot(collection(db, poPath), (snapshot) => {
      console.log("PurchaseOrders.tsx snapshot listener triggered! Document count:", snapshot.docs.length);
      const orders = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log("PurchaseOrders.tsx found PO doc in snapshot:", doc.id, data);
        return { id: doc.id, ...data } as PurchaseOrder;
      });
      console.log("PurchaseOrders.tsx final state array to set:", orders);
      setPurchaseOrders(orders);
      setLoading(false);
    }, (err) => {
      console.error("PurchaseOrders.tsx snapshot listener error:", err);
      setLoading(false);
    });

    const productsPath = `companies/${profile.companyId}/products`;
    console.log("PurchaseOrders.tsx useEffect: Subscribing to products path:", productsPath);
    const unsubscribeProducts = onSnapshot(collection(db, productsPath), (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      console.log("PurchaseOrders.tsx products snapshot update. Product count:", prods.length);
      setProducts(prods);
    }, (err) => {
      console.error("PurchaseOrders.tsx products listener error:", err);
    });

    const suppliersPath = `companies/${profile.companyId}/suppliers`;
    console.log("PurchaseOrders.tsx useEffect: Subscribing to suppliers path:", suppliersPath);
    const unsubscribeSuppliers = onSnapshot(collection(db, suppliersPath), (snapshot) => {
      const sups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("PurchaseOrders.tsx suppliers snapshot update. Supplier count:", sups.length);
      setSuppliers(sups);
    }, (err) => {
      console.error("PurchaseOrders.tsx suppliers listener error:", err);
    });

    return () => {
      console.log("PurchaseOrders.tsx useEffect cleanup: unsubscribing from listeners for companyId =", profile.companyId);
      unsubscribe();
      unsubscribeProducts();
      unsubscribeSuppliers();
    };
  }, [profile?.companyId]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  };

  const formatExpectedDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  };

  const handleAutoSeed = async () => {
    if (!profile?.companyId) return;
    setSubmitting(true);
    setError(null);
    try {
      // 1. Seed some suppliers
      const suppliersPath = `companies/${profile.companyId}/suppliers`;
      const demoSuppliers = [
        { id: `sup_1`, name: 'TechSource Distributors', email: 'sales@techsource.com', phone: '+1 555 7010', address: '500 Supply Rd', reliability: '91.3/100', payable: 0, status: 'Excellent' },
        { id: `sup_2`, name: 'Pacific Components', email: 'ap@pacificcomp.com', phone: '+1 555 7020', address: '12 Harbor Ave', reliability: '85/100', payable: 0, status: 'Good' },
        { id: `sup_3`, name: 'BeanWorld Roasters', email: 'orders@beanworld.com', phone: '+1 555 7030', address: '5 Roastery Ln', reliability: '88/100', payable: 0, status: 'Good' }
      ];
      for (const s of demoSuppliers) {
        await setDoc(doc(db, suppliersPath, s.id), {
          ...s,
          createdAt: new Date().toISOString()
        });
      }

      // 2. Seed some products
      const productsPath = `companies/${profile.companyId}/products`;
      const demoProducts = [
        { id: `prod_1`, name: 'Industrial Nitrogen Pack', sku: 'NIT-IND-01', quantity: 150, value: 4500, buyingPrice: 30, sellingPrice: 50, uom: 'kg', status: 'In Stock' },
        { id: `prod_2`, name: 'Biodegradable Packaging Bag', sku: 'PKG-BIO-05', quantity: 1000, value: 500, buyingPrice: 0.5, sellingPrice: 1.2, uom: 'pcs', status: 'In Stock' },
        { id: `prod_3`, name: 'Heavy Duty Product Labels', sku: 'LBL-HD-12', quantity: 5000, value: 150, buyingPrice: 0.03, sellingPrice: 0.1, uom: 'pcs', status: 'In Stock' }
      ];
      for (const p of demoProducts) {
        await setDoc(doc(db, productsPath, p.id), {
          ...p,
          createdAt: new Date().toISOString()
        });
      }
      
      // Auto select the first supplier to make it easy
      setSupplierId('sup_1');
      // Add one default item
      setItems([{ productId: 'prod_1', quantity: 10, unitPrice: 30, receivedQuantity: 0 }]);
      setError(null);
    } catch (err: any) {
      console.error("Auto seeding failed", err);
      setError("Failed to auto-seed demo data. Please try creating suppliers and products manually.");
    } finally {
      setSubmitting(false);
    }
  };

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, unitPrice: 0, receivedQuantity: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-fill price if product selected with multiple fallback strategies
    if (field === 'productId' && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].unitPrice = product.buyingPrice ?? product.value ?? 0;
      }
    }
    
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("PurchaseOrders.tsx handleSubmit: trigger check. Profile.companyId =", profile?.companyId, ", supplierId =", supplierId, ", items =", items);
    if (!profile?.companyId) {
      console.error("PurchaseOrders.tsx handleSubmit rejected: companyId is missing!");
      setError("Unable to submit: Company identification is missing. Please make sure you are logged in and have selected a company workspace.");
      return;
    }
    if (!supplierId) {
      console.error("PurchaseOrders.tsx handleSubmit rejected: supplierId is missing!");
      setError("Please select a valid supplier before placing the purchase order.");
      return;
    }
    if (items.length === 0) {
      console.error("PurchaseOrders.tsx handleSubmit rejected: items list is empty!");
      setError("Please add at least one item to the purchase order.");
      return;
    }
    
    setError(null);
    setConfirmConfig({
      isOpen: true,
      title: "Place Purchase Order",
      message: "Are you sure you want to finalize and dispatch this purchase order to the selected supplier?",
      confirmText: "Place Order",
      type: "success",
      onConfirm: async () => {
        setSubmitting(true);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        console.log("Starting purchase order creation inside onConfirm callback...");
        try {
          const totalAmount = items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0);
          const poNumber = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
          
          console.log("Calculated total amount:", totalAmount, "PO Number:", poNumber);
          
          const selectedSupplier = suppliers.find(s => s.id === supplierId);
          console.log("Selected supplier:", selectedSupplier);
          
          const mappedItems = items.map(item => {
            const product = products.find(p => p.id === item.productId);
            return {
              productId: item.productId || '',
              quantity: Number(item.quantity) || 0,
              unitPrice: Number(item.unitPrice) || 0,
              receivedQuantity: Number(item.receivedQuantity) || 0,
              productName: product?.name || '',
              sku: product?.sku || ''
            };
          });
          console.log("Mapped items:", mappedItems);

          const payload = {
            poNumber,
            supplierId: supplierId || '',
            date: new Date().toISOString(),
            totalAmount: Number(totalAmount) || 0,
            status: 'PENDING' as POStatus,
            items: mappedItems,
            notes: notes || '',
            expectedDeliveryDate: expectedDeliveryDate || '',
            createdBy: user?.uid || '',
            createdByName: user?.displayName || profile?.name || 'User',
            userEmail: user?.email || '',
            supplierName: selectedSupplier?.name || '',
            supplierEmail: selectedSupplier?.email || '',
            supplierPhone: selectedSupplier?.phone || '',
            supplierKraPin: selectedSupplier?.kraPin || ''
          };
          console.log("Payload to ProcurementService.createPurchaseOrder:", payload);

          const result = await ProcurementService.createPurchaseOrder(profile!.companyId!, payload);
          console.log("ProcurementService.createPurchaseOrder success! Result:", result);
          
          setShowModal(false);
          setSupplierId('');
          setItems([]);
          setNotes('');
          setError(null);
          console.log("States reset successfully.");
        } catch (err: any) {
          console.error("Error creating purchase order inside onConfirm block:", err);
          let msg = "Failed to save purchase order. Please verify that all fields are correct and try again.";
          if (err instanceof Error) {
            try {
              const parsed = JSON.parse(err.message);
              if (parsed && parsed.error) {
                msg = parsed.error;
              }
            } catch {
              msg = err.message;
            }
          }
          setError(msg);
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const handleApprove = (poId: string, poNumber: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Approve Purchase Order",
      message: `Are you sure you want to approve purchase order ${poNumber}? This will authorize stock intake and adjust procurement states.`,
      confirmText: "Approve Order",
      type: "success",
      onConfirm: async () => {
        if (!profile?.companyId) return;
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await ProcurementService.updatePOStatus(profile.companyId, poId, 'APPROVED');
        } catch (error) {
          console.error(error);
        }
      }
    });
  };

  const handleClosePO = (poId: string, poNumber: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Close Purchase Order",
      message: `Are you sure you want to close purchase order ${poNumber}? This will mark it as CLOSED, preventing any further deliveries from being posted.`,
      confirmText: "Close Order",
      type: "warning",
      onConfirm: async () => {
        if (!profile?.companyId) return;
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await ProcurementService.updatePOStatus(profile.companyId, poId, 'CLOSED');
        } catch (error) {
          console.error(error);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Purchase Orders</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Place orders with suppliers</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setError(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-[#0f172a] text-white px-5 h-10 rounded-lg font-bold hover:bg-slate-800 transition-all text-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create PO
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {purchaseOrders.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((po) => {
          const supplier = suppliers.find(s => s.id === po.supplierId);
          return (
            <div key={po.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-slate-300 transition-all text-left flex flex-col md:flex-row md:items-center justify-between gap-4 group">
              <div className="flex items-center gap-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-extrabold text-slate-900 tracking-tight">{po.poNumber}</h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      po.status === 'FULLY RECEIVED' || po.status === 'RECEIVED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                      po.status === 'PARTIALLY RECEIVED' || po.status === 'PARTIAL' ? "bg-amber-50 text-amber-600 border-amber-100" :
                      po.status === 'CLOSED' || po.status === 'CANCELLED' ? "bg-slate-100 text-slate-600 border-slate-200" :
                      "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {po.status}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-400 text-[11px] font-medium">
                    <span className="text-slate-600 font-bold">{supplier?.name || 'Unknown Supplier'}</span>
                    <span>•</span>
                    <span>Ordered {formatDate(po.date)}</span>
                    {po.expectedDeliveryDate && (
                      <>
                        <span>•</span>
                        <span className="text-amber-600 font-semibold">Expected: {formatExpectedDate(po.expectedDeliveryDate)}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{po.items?.length || 0} items</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-lg font-black text-slate-900">{currency}{(po.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="flex items-center gap-2">
                   {po.status === 'PENDING' && (
                     <button 
                       onClick={() => handleApprove(po.id, po.poNumber)}
                       className="flex items-center gap-2 px-3 h-9 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all text-[10px] uppercase tracking-widest"
                     >
                       <CheckCircle2 className="w-3.5 h-3.5" />
                       Approve
                     </button>
                   )}
                   {(po.status === 'PENDING' || po.status === 'PARTIALLY RECEIVED' || po.status === 'PARTIAL' || po.status === 'APPROVED' || po.status === 'SHIPPED') && (
                     <button 
                       onClick={() => handleClosePO(po.id, po.poNumber)}
                       className="flex items-center gap-2 px-3 h-9 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-all text-[10px] uppercase tracking-widest"
                     >
                       Close PO
                     </button>
                   )}
                                       <button 
                      onClick={() => setSelectedPO(po)}
                      className="flex items-center gap-2 px-3 h-9 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-[10px] uppercase tracking-widest"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View & Print
                    </button>
                </div>
              </div>
            </div>
          );
        })}
        {purchaseOrders.length === 0 && (
          <div className="p-12 text-center text-slate-400">
             <ShoppingCart className="w-12 h-12 mx-auto opacity-10 mb-4" />
             <p className="text-sm font-bold uppercase tracking-widest text-slate-300">No purchase orders found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Create Purchase Order</h3>
                <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold text-left animate-in fade-in slide-in-from-top-2 duration-200">
                    {error}
                  </div>
                )}
                
                {suppliers.length === 0 || products.length === 0 ? (
                  <div className="p-8 border border-amber-100 bg-amber-50 rounded-2xl text-left space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-extrabold text-amber-900 text-sm">Prerequisites Missing</h4>
                        <p className="text-xs text-amber-700/90 mt-1 leading-relaxed">
                          To place a purchase order, you need at least one supplier and one product configured. 
                          Currently, your suppliers or products list is empty. 
                          Click the button below to automatically seed high-quality demo suppliers and products so you can test this workflow immediately!
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleAutoSeed}
                        disabled={submitting}
                        className="px-5 h-10 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Auto-Seed Demo Setup"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="text-left">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Supplier</label>
                        <select 
                          required
                          value={supplierId}
                          onChange={(e) => setSupplierId(e.target.value)}
                          className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        >
                          <option value="">Select Supplier</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="text-left">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Expected Delivery Date</label>
                        <input 
                          type="date"
                          required
                          value={expectedDeliveryDate}
                          onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                          className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Order Items</label>
                        <button type="button" onClick={addItem} className="text-blue-600 text-[10px] font-bold uppercase tracking-widest hover:underline">+ Add Item</button>
                      </div>
                      
                      <div className="space-y-3">
                        {items.map((item, i) => (
                          <div key={i} className="flex gap-3 items-end">
                            <div className="flex-1 text-left">
                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Product</label>
                              <select 
                                required
                                value={item.productId}
                                onChange={(e) => updateItem(i, 'productId', e.target.value)}
                                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-bold"
                              >
                                <option value="">Select Product</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </div>
                            <div className="w-24 text-left">
                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Qty</label>
                              <input 
                                type="number"
                                required
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value))}
                                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-bold"
                              />
                            </div>
                            <div className="w-32 text-left">
                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Price</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{currency}</span>
                                <input 
                                  type="number"
                                  required
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => updateItem(i, 'unitPrice', parseFloat(e.target.value))}
                                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 text-xs font-bold"
                                />
                              </div>
                            </div>
                            <button type="button" onClick={() => removeItem(i)} className="h-11 w-11 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Notes</label>
                      <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Internal notes or delivery instructions..."
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="text-left">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Amount</p>
                  <p className="text-2xl font-black text-slate-900">{currency}{items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toLocaleString()}</p>
                </div>
                {suppliers.length > 0 && products.length > 0 && (
                  <button 
                    type="submit"
                    disabled={submitting || items.length === 0}
                    className="px-10 h-12 bg-[#0f172a] text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Order"}
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        type={confirmConfig.type}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {/* PO Document Viewer Modal */}
      <AnimatePresence>
        {selectedPO && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPO(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <style>{`
              @media print {
                body {
                  visibility: hidden !important;
                }
                #printable-po-area, #printable-po-area * {
                  visibility: visible !important;
                }
                #printable-po-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  background: white !important;
                  color: black !important;
                  box-shadow: none !important;
                  border: none !important;
                  padding: 20px !important;
                  margin: 0 !important;
                }
              }
            `}</style>
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-8 flex flex-col md:flex-row h-[85vh] z-10 text-left"
            >
              {/* Absolute Close button */}
              <button
                onClick={() => setSelectedPO(null)}
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors z-20 border border-slate-100"
                title="Close Viewer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Controls Panel */}
              <div className="p-8 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-between md:w-[320px] bg-slate-50 shrink-0">
                <div className="space-y-6">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <FileText className="w-3 h-3" /> Purchase Order Viewer
                    </span>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-3">Procurement</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">Review this Purchase Order document. Ready for dispatch to supplier.</p>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-blue-800 font-bold text-[10px] uppercase tracking-widest">
                      <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                      Status: {selectedPO.status}
                    </div>
                    <p className="text-[10px] text-blue-700 font-semibold leading-relaxed">
                      Purchase order details are verified. Ready for printing or saving to digital formats.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <button
                    onClick={handlePrintPO}
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Printer className="w-4 h-4" />
                    Print Purchase Order
                  </button>
                  <button
                    onClick={() => setSelectedPO(null)}
                    className="w-full h-12 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Close Viewer
                  </button>
                </div>
              </div>

              {/* A4 Document Preview */}
              <div className="flex-1 bg-slate-100 p-6 overflow-y-auto no-scrollbar flex justify-center items-start">
                <div 
                  id="printable-po-area" 
                  className="bg-white shadow-lg border border-slate-200 w-full max-w-[650px] p-10 text-xs text-left text-slate-900 font-sans"
                >
                  {/* Logo and PO Title */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                    <div>
                      <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{company?.name || 'INVENTORYPRO CO.'}</h1>
                      <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">{company?.address || 'Nairobi, Kenya'}</p>
                      <p className="text-slate-500 font-semibold text-[10px]">{company?.phone || '+254 700 000 000'}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-4 py-1.5 bg-slate-900 text-white font-black text-sm uppercase tracking-widest">Purchase Order</span>
                      <p className="text-xs font-mono font-bold text-slate-700 mt-2">PO NO: {selectedPO.poNumber || selectedPO.id}</p>
                    </div>
                  </div>

                  {/* Buyer & Supplier Details */}
                  <div className="py-6 grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier Details</h4>
                      <div className="text-[11px] space-y-1">
                        <p className="font-bold text-slate-900 text-sm">{selectedPO.supplierName || 'Unknown Supplier'}</p>
                        {selectedPO.supplierEmail && <p className="text-slate-600">Email: <strong className="text-slate-800">{selectedPO.supplierEmail}</strong></p>}
                        {selectedPO.supplierPhone && <p className="text-slate-600">Phone: <strong className="text-slate-800">{selectedPO.supplierPhone}</strong></p>}
                        {selectedPO.supplierKraPin && <p className="text-slate-600">KRA PIN: <strong className="text-slate-800 font-mono">{selectedPO.supplierKraPin}</strong></p>}
                      </div>
                    </div>
                    <div className="space-y-1.5 font-sans">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Order Info</h4>
                      <div className="text-[11px] space-y-1 text-right">
                        <p className="font-semibold text-slate-600">Order Date: <strong className="text-slate-800 font-bold">{selectedPO.date ? new Date(selectedPO.date).toLocaleDateString() : 'N/A'}</strong></p>
                        {selectedPO.expectedDeliveryDate && (
                          <p className="font-semibold text-slate-600">Expected Delivery: <strong className="text-amber-600 font-bold">{new Date(selectedPO.expectedDeliveryDate).toLocaleDateString()}</strong></p>
                        )}
                        <p className="text-slate-600">Status: <strong className="text-blue-600 uppercase font-black">{selectedPO.status}</strong></p>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="py-2 border-t border-slate-100">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-900 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                          <th className="pb-3 text-left">Product / Service</th>
                          <th className="pb-3 text-left">SKU</th>
                          <th className="pb-3 text-center">Ordered Qty</th>
                          <th className="pb-3 text-center">Received Qty</th>
                          <th className="pb-3 text-right">Unit Price</th>
                          <th className="pb-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedPO.items && selectedPO.items.length > 0 ? (
                          selectedPO.items.map((item: any, i: number) => (
                            <tr key={i} className="text-slate-800 font-medium">
                              <td className="py-4 font-bold text-slate-900">{item.productName || 'Unknown Product'}</td>
                              <td className="py-4 font-mono text-[10px] text-slate-500">{item.sku || 'N/A'}</td>
                              <td className="py-4 text-center font-black text-slate-800">x{item.quantity}</td>
                              <td className="py-4 text-center font-bold text-slate-500 font-bold">x{item.receivedQuantity || 0}</td>
                              <td className="py-4 text-right font-semibold">{currency}{(item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="py-4 text-right font-black text-slate-900">{currency}{((item.unitPrice || 0) * (item.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-400">No items listed in this purchase order.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Notes & Summary */}
                  <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-end pt-6 border-t border-slate-200 mt-4 gap-4">
                    <div className="text-[10px] text-slate-500 leading-relaxed max-w-xs text-left col-span-3">
                      {selectedPO.notes && (
                        <>
                          <p className="font-bold text-slate-700">Special Instructions / Notes:</p>
                          <p>{selectedPO.notes}</p>
                        </>
                      )}
                    </div>
                    <div className="space-y-1 text-right w-full max-w-xs font-sans">
                      <div className="flex justify-between text-slate-500 text-[11px] font-semibold">
                        <span>Subtotal (VAT Excl)</span>
                        <span>{currency}{(selectedPO.subtotal || (selectedPO.totalAmount / 1.16)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px] font-semibold">
                        <span>VAT (16%)</span>
                        <span>{currency}{(selectedPO.taxAmount || (selectedPO.totalAmount - (selectedPO.totalAmount / 1.16))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-900 text-sm font-black pt-2 border-t-2 border-slate-900">
                        <span>Grand Total</span>
                        <span>{currency}{(selectedPO.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 pt-8 border-t border-dashed border-slate-200 flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                     <div>Authorized By: {selectedPO.createdByName || 'Procurement Officer'}</div>
                     <div>Signature: _______________________</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

