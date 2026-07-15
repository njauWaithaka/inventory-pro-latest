import React, { useState, useEffect } from 'react';
import { Plus, Printer, Search, MoreVertical, Loader2, ShoppingCart, X, Package, Trash2, CheckCircle2 } from 'lucide-react';
import { collection, onSnapshot, query, where, doc, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { ProcurementService } from '../../../lib/procurementService';
import { PurchaseOrder, POItem, Product, POStatus } from '../../../types';
import { motion } from 'motion/react';
import { ConfirmationModal } from '../../ConfirmationModal';

export function PurchaseOrders() {
  const { user } = useAuth();
  const { profile, settings } = useSettings();
  const currency = settings?.currency || 'KSh';

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

  // New PO State
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<POItem[]>([]);

  useEffect(() => {
    if (!profile?.companyId) return;
    const poPath = `companies/${profile.companyId}/purchaseOrders`;
    const unsubscribe = onSnapshot(collection(db, poPath), (snapshot) => {
      setPurchaseOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder)));
      setLoading(false);
    });

    const productsPath = `companies/${profile.companyId}/products`;
    const unsubscribeProducts = onSnapshot(collection(db, productsPath), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const suppliersPath = `companies/${profile.companyId}/suppliers`;
    const unsubscribeSuppliers = onSnapshot(collection(db, suppliersPath), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeProducts();
      unsubscribeSuppliers();
    };
  }, [profile?.companyId]);

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, unitPrice: 0, receivedQuantity: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-fill price if product selected
    if (field === 'productId' && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].unitPrice = product.value; // Assuming value is cost price
      }
    }
    
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !supplierId || items.length === 0) return;
    
    setConfirmConfig({
      isOpen: true,
      title: "Place Purchase Order",
      message: "Are you sure you want to finalize and dispatch this purchase order to the selected supplier?",
      confirmText: "Place Order",
      type: "success",
      onConfirm: async () => {
        setSubmitting(true);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
          const poNumber = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
          
          await ProcurementService.createPurchaseOrder(profile.companyId, {
            poNumber,
            supplierId,
            date: new Date().toISOString(),
            totalAmount,
            status: 'PENDING',
            items,
            notes
          });
          
          setShowModal(false);
          setSupplierId('');
          setItems([]);
          setNotes('');
        } catch (error) {
          console.error(error);
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
            onClick={() => setShowModal(true)}
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
                      po.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                      po.status === 'RECEIVED' ? "bg-slate-100 text-slate-600 border-slate-200" :
                      "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {po.status}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-400 text-[11px] font-medium">
                    <span className="text-slate-600 font-bold">{supplier?.name || 'Unknown Supplier'}</span>
                    <span>•</span>
                    <span>Ordered {new Date(po.date).toLocaleDateString()}</span>
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
                   <button className="flex items-center gap-2 px-3 h-9 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-[10px] uppercase tracking-widest">
                     <Printer className="w-3.5 h-3.5" />
                     Print
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
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="text-left">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Amount</p>
                  <p className="text-2xl font-black text-slate-900">{currency}{items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toLocaleString()}</p>
                </div>
                <button 
                  type="submit"
                  disabled={submitting || items.length === 0}
                  className="px-10 h-12 bg-[#0f172a] text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Order"}
                </button>
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
    </div>
  );
}

