import React, { useState, useEffect } from 'react';
import { Plus, Printer, Package, MoreVertical, Loader2, X, Check, ArrowRight } from 'lucide-react';
import { collection, onSnapshot, query, where, doc, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { ProcurementService } from '../../../lib/procurementService';
import { GoodReceiptNote, PurchaseOrder, Product, GRNItem } from '../../../types';
import { motion } from 'motion/react';

export function GRN() {
  const { user } = useAuth();
  const { profile, settings } = useSettings();
  const currency = settings?.currency || 'KSh';
  const [grns, setGrns] = useState<GoodReceiptNote[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New GRN State
  const [poId, setPoId] = useState('');
  const [grnItems, setGrnItems] = useState<GRNItem[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!profile?.companyId) return;
    
    // Fetch GRNs
    const grnPath = `companies/${profile.companyId}/grns`;
    const unsubscribeGrns = onSnapshot(collection(db, grnPath), (snapshot) => {
      setGrns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GoodReceiptNote)));
      setLoading(false);
    });

    // Fetch POs (only approved/shipped for GRN creation)
    const poPath = `companies/${profile.companyId}/purchaseOrders`;
    const unsubscribePOs = onSnapshot(collection(db, poPath), (snapshot) => {
      setPurchaseOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder)));
    });

    // Fetch Products
    const productsPath = `companies/${profile.companyId}/products`;
    const unsubscribeProducts = onSnapshot(collection(db, productsPath), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    return () => {
      unsubscribeGrns();
      unsubscribePOs();
      unsubscribeProducts();
    };
  }, [profile?.companyId]);

  const handlePoSelect = (selectedPoId: string) => {
    setPoId(selectedPoId);
    const po = purchaseOrders.find(p => p.id === selectedPoId);
    if (po && po.items) {
      setGrnItems(po.items.map(item => ({
        productId: item.productId,
        orderedQuantity: item.quantity,
        receivedQuantity: item.quantity // Default to full receipt
      })));
    } else {
      setGrnItems([]);
    }
  };

  const updateReceivedQty = (index: number, qty: number) => {
    const newItems = [...grnItems];
    newItems[index].receivedQuantity = qty;
    setGrnItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !poId || grnItems.length === 0) return;

    setSubmitting(true);
    try {
      const selectedPo = purchaseOrders.find(p => p.id === poId);
      const grnNumber = `GRN-${Math.floor(1000 + Math.random() * 9000)}`;

      await ProcurementService.createGRN(profile.companyId, {
        grnNumber,
        poId,
        receivedDate: new Date().toISOString(),
        receivedBy: user?.displayName || 'User',
        supplierId: selectedPo?.supplierId || '',
        items: grnItems,
        notes
      });

      setShowModal(false);
      setPoId('');
      setGrnItems([]);
      setNotes('');
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const eligiblePOs = purchaseOrders.filter(po => po.status === 'APPROVED' || po.status === 'SHIPPED');

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Goods Received Notes (GRN)</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Verify and post incoming supplier deliveries</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#0f172a] text-white px-5 h-10 rounded-lg font-bold hover:bg-slate-800 transition-all text-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            Receive Goods (GRN)
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {grns.sort((a, b) => (b.receivedDate || '').localeCompare(a.receivedDate || '')).map((grn) => {
          const po = purchaseOrders.find(p => p.id === grn.poId);
          return (
            <div key={grn.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-slate-300 transition-all text-left flex flex-col md:flex-row md:items-center justify-between gap-4 group">
              <div className="flex items-center gap-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-extrabold text-slate-900 tracking-tight">{grn.grnNumber}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                      POSTED
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-slate-400 border border-slate-100 uppercase">
                      Ref: {po?.poNumber || 'Unknown PO'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-400 text-[11px] font-medium">
                    <span>Received {new Date(grn.receivedDate).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>By {grn.receivedBy}</span>
                    <span>•</span>
                    <span>{grn.items?.length || 0} product lines</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <button className="flex items-center gap-2 px-3 h-9 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-[10px] uppercase tracking-widest">
                   <Printer className="w-3.5 h-3.5" />
                   Print
                 </button>
              </div>
            </div>
          );
        })}
        {grns.length === 0 && (
          <div className="p-12 text-center text-slate-400">
             <Package className="w-12 h-12 mx-auto opacity-10 mb-4" />
             <p className="text-sm font-bold uppercase tracking-widest text-slate-300">No goods received notes found</p>
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
                <div>
                  <h3 className="text-xl font-bold text-slate-900">New GRN</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Post Goods Receipt</p>
                </div>
                <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
                <div className="text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Select Purchase Order</label>
                  <select 
                    required
                    value={poId}
                    onChange={(e) => handlePoSelect(e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">Select an Approved PO</option>
                    {eligiblePOs.map(po => (
                      <option key={po.id} value={po.id}>{po.poNumber} - {purchaseOrders.find(p => p.id === po.id)?.supplierId}</option>
                    ))}
                  </select>
                </div>

                {poId && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block">Line Verification</label>
                    <div className="space-y-3">
                      {grnItems.map((item, i) => {
                        const product = products.find(p => p.id === item.productId);
                        return (
                          <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-lg border border-slate-100 flex items-center justify-center">
                                <Package className="w-5 h-5 text-slate-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900">{product?.name}</p>
                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">Ordered: {item.orderedQuantity}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right shrink-0">
                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Received Qty</label>
                                <input 
                                  type="number"
                                  min="0"
                                  max={item.orderedQuantity}
                                  value={item.receivedQuantity}
                                  onChange={(e) => updateReceivedQty(i, parseInt(e.target.value))}
                                  className="w-20 h-9 bg-white border border-slate-200 rounded-lg px-2 text-xs font-bold text-center"
                                />
                              </div>
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                <Check className="w-4 h-4 text-emerald-600" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Verification Notes</label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Condition of goods, discrepancy notes, etc..."
                  />
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                <button 
                  type="submit"
                  disabled={submitting || !poId || grnItems.length === 0}
                  className="px-10 h-12 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-200"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      Post to Inventory
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

