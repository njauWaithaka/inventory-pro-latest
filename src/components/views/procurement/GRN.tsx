import React, { useState, useEffect } from 'react';
import { Plus, Printer, Package, MoreVertical, Loader2, X, Check, ArrowRight, AlertCircle } from 'lucide-react';
import { collection, onSnapshot, query, where, doc, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { ProcurementService } from '../../../lib/procurementService';
import { GoodReceiptNote, PurchaseOrder, Product, GRNItem } from '../../../types';
import { motion, AnimatePresence } from 'motion/react';

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
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedGRN, setSelectedGRN] = useState<GoodReceiptNote | null>(null);

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

    // Fetch Suppliers
    const suppliersPath = `companies/${profile.companyId}/suppliers`;
    const unsubscribeSuppliers = onSnapshot(collection(db, suppliersPath), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeGrns();
      unsubscribePOs();
      unsubscribeProducts();
      unsubscribeSuppliers();
    };
  }, [profile?.companyId]);

  const handlePoSelect = (selectedPoId: string) => {
    setPoId(selectedPoId);
    const po = purchaseOrders.find(p => p.id === selectedPoId);
    if (po && po.items) {
      setGrnItems(po.items.map(item => {
        const remaining = item.quantity - (item.receivedQuantity || 0);
        return {
          productId: item.productId,
          orderedQuantity: item.quantity,
          receivedQuantity: remaining > 0 ? remaining : 0
        };
      }));
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
    console.log("[GRN.tsx] handleSubmit triggered.");
    console.log("[GRN.tsx] Initial state checklist:", {
      companyId: profile?.companyId,
      poId: poId,
      grnItemsLength: grnItems.length,
      grnItems: grnItems
    });

    if (!profile?.companyId) {
      console.error("[GRN.tsx] Missing companyId in profile:", profile);
      return;
    }
    if (!poId) {
      console.error("[GRN.tsx] Missing poId selected.");
      return;
    }
    if (grnItems.length === 0) {
      console.error("[GRN.tsx] grnItems array is empty.");
      return;
    }
    if (!notes.trim()) {
      console.error("[GRN.tsx] Verification note is missing.");
      alert("A valid verification note is required before the PO can be submitted.");
      return;
    }

    setSubmitting(true);
    try {
      const selectedPo = purchaseOrders.find(p => p.id === poId);
      console.log("[GRN.tsx] Selected purchase order metadata from memory state:", selectedPo);
      
      const grnNumber = `GRN-${Math.floor(1000 + Math.random() * 9000)}`;
      const payload = {
        grnNumber,
        poId,
        receivedDate: new Date().toISOString(),
        receivedBy: user?.displayName || profile?.name || 'User',
        supplierId: selectedPo?.supplierId || '',
        items: grnItems,
        notes,
        createdBy: user?.uid || '',
        userEmail: user?.email || ''
      };
      
      console.log("[GRN.tsx] Submitting GRN payload to ProcurementService.createGRN:", JSON.stringify(payload, null, 2));

      const result = await ProcurementService.createGRN(profile.companyId, payload);
      
      console.log("[GRN.tsx] ProcurementService.createGRN succeeded! Returned GRN:", result);

      setShowModal(false);
      setPoId('');
      setGrnItems([]);
      setNotes('');
    } catch (error) {
      console.error("[GRN.tsx] Error occurred during ProcurementService.createGRN submission! Error details:", error);
      if (error instanceof Error) {
        console.error("[GRN.tsx] Error name:", error.name);
        console.error("[GRN.tsx] Error message:", error.message);
        console.error("[GRN.tsx] Error stack:", error.stack);
      }
      alert(error instanceof Error ? error.message : "Failed to receive goods.");
    } finally {
      setSubmitting(false);
      console.log("[GRN.tsx] handleSubmit execution finished.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const eligiblePOs = purchaseOrders.filter(po => 
    po.status !== 'CLOSED' && 
    po.status !== 'FULLY RECEIVED' && 
    po.status !== 'RECEIVED' && 
    po.status !== 'CANCELLED'
  );

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
                 <button 
                   onClick={() => setSelectedGRN(grn)}
                   className="flex items-center gap-2 px-3.5 h-9 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-[10px] uppercase tracking-widest cursor-pointer"
                 >
                   <Printer className="w-3.5 h-3.5" />
                   View / Print
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
                    {eligiblePOs.map(po => {
                      const supplier = suppliers.find(s => s.id === po.supplierId);
                      const sName = po.supplierName || supplier?.name || 'Unknown Supplier';
                      return (
                        <option key={po.id} value={po.id}>{po.poNumber} - {sName}</option>
                      );
                    })}
                  </select>
                </div>

                {poId && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block">Line Verification</label>
                    <div className="space-y-3">
                      {grnItems.map((item, i) => {
                        const product = products.find(p => p.id === item.productId);
                        const po = purchaseOrders.find(p => p.id === poId);
                        const poItem = po?.items?.find(pi => pi.productId === item.productId);
                        const alreadyReceived = poItem?.receivedQuantity || 0;
                        const remaining = item.orderedQuantity - alreadyReceived;
                        return (
                          <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-lg border border-slate-100 flex items-center justify-center">
                                <Package className="w-5 h-5 text-slate-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900">{product?.name}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] font-semibold text-slate-500 uppercase tracking-tighter">
                                  <span>Ordered: {item.orderedQuantity}</span>
                                  <span>•</span>
                                  <span className="text-emerald-600">Received: {alreadyReceived}</span>
                                  <span>•</span>
                                  <span className="text-amber-600">Remaining: {remaining}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right shrink-0">
                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Receive Now</label>
                                <input 
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  disabled={remaining <= 0}
                                  value={item.receivedQuantity}
                                  onChange={(e) => updateReceivedQty(i, Math.min(remaining, Math.max(0, parseInt(e.target.value) || 0)))}
                                  className="w-20 h-9 bg-white border border-slate-200 rounded-lg px-2 text-xs font-bold text-center disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              </div>
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                                remaining <= 0 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                              )}>
                                <Check className="w-4 h-4" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="text-left space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block flex justify-between items-center">
                    <span>Verification Notes <span className="text-rose-500 font-extrabold">*</span></span>
                    <span className="text-[9px] text-rose-500 font-bold lowercase tracking-wider">Note is mandatory</span>
                  </label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    required
                    className={cn(
                      "w-full h-24 bg-slate-50 border rounded-xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all",
                      !notes.trim() && poId ? "border-rose-300 focus:ring-rose-500 bg-rose-50/10" : "border-slate-200"
                    )}
                    placeholder="Enter mandatory verification details, e.g. quality, quantity checks, damages, discrepancies..."
                  />
                  {!notes.trim() && poId && (
                    <div className="flex items-center gap-1.5 text-rose-600 text-[11px] font-bold mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Verification note is required to record the PO in the inventory system.
                    </div>
                  )}
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                <button 
                  type="submit"
                  disabled={submitting || !poId || grnItems.length === 0 || !notes.trim()}
                  className="px-10 h-12 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none shadow-lg shadow-blue-200"
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

      <AnimatePresence>
        {selectedGRN && (() => {
          const po = purchaseOrders.find(p => p.id === selectedGRN.poId);
          const supplier = suppliers.find(s => s.id === (selectedGRN.supplierId || po?.supplierId));
          const supplierName = po?.supplierName || supplier?.name || 'Unknown Supplier';
          
          return (
            <div className="fixed inset-0 z-[110] flex justify-center items-start overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static print:overflow-visible">
              <style>{`
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-grn-area, #printable-grn-area * {
                    visibility: visible !important;
                  }
                  #printable-grn-area {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    background: white !important;
                    padding: 0 !important;
                    border: none !important;
                    box-shadow: none !important;
                    margin: 0 !important;
                  }
                }
              `}</style>

              {/* Control panel buttons - hidden when printing */}
              <div className="fixed top-4 right-4 flex items-center gap-3 z-50 print:hidden bg-slate-900/85 p-2.5 rounded-2xl backdrop-blur-md shadow-2xl border border-slate-700/30">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print GRN
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGRN(null)}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl font-bold shadow-lg text-xs uppercase tracking-wider border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-4 h-4" /> Close
                </button>
              </div>

              {/* A4 Paper container */}
              <div 
                id="printable-grn-area"
                className="bg-white w-full max-w-[820px] my-8 p-10 shadow-2xl rounded-sm border border-slate-200 font-sans text-slate-800 leading-relaxed text-left print:shadow-none print:border-none print:my-0 print:p-0 print:w-full select-text"
              >
                {/* Outer boundary double border frame */}
                <div className="border-[2px] border-double border-slate-900/30 p-8 min-h-[1050px] flex flex-col justify-between bg-white">
                  <div>
                    {/* Header: Company and Doc Title */}
                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                      <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                          {profile?.companyName || 'INVENTORYPRO CO.'}
                        </h1>
                        <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px] mt-1">
                          {profile?.address || 'Nairobi, Kenya'}
                        </p>
                        <p className="text-slate-500 font-semibold text-[10px]">
                          Tel: {profile?.phone || '+254 700 000 000'} | Email: {user?.email || 'procurement@inventorypro.com'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-4 py-1.5 bg-slate-900 text-white font-black text-sm uppercase tracking-widest">
                          Goods Received Note
                        </span>
                        <p className="text-xs font-mono font-bold text-slate-700 mt-2">
                          GRN NO: {selectedGRN.grnNumber}
                        </p>
                      </div>
                    </div>

                    {/* Metadata boxes */}
                    <div className="grid grid-cols-2 gap-8 py-6 border-b border-slate-100">
                      {/* Left: Supplier Details */}
                      <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Supplier Details</h4>
                        <div className="space-y-1 text-xs">
                          <p className="font-extrabold text-slate-900 text-sm">{supplierName}</p>
                          {supplier?.email && <p className="text-slate-600">Email: <span className="font-bold text-slate-800">{supplier.email}</span></p>}
                          {supplier?.phone && <p className="text-slate-600">Phone: <span className="font-bold text-slate-800">{supplier.phone}</span></p>}
                          {supplier?.address && <p className="text-slate-600">Address: <span className="font-semibold text-slate-700">{supplier.address}</span></p>}
                        </div>
                      </div>

                      {/* Right: Receipt & Reference Info */}
                      <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Receipt & References</h4>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Date Received</p>
                            <p className="font-black text-slate-800 mt-0.5">{new Date(selectedGRN.receivedDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Received By</p>
                            <p className="font-black text-slate-800 mt-0.5">{selectedGRN.receivedBy}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Source PO Ref</p>
                            <p className="font-mono font-bold text-blue-600 mt-0.5">{po?.poNumber || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">PO Order Date</p>
                            <p className="font-bold text-slate-800 mt-0.5">{po?.date ? new Date(po.date).toLocaleDateString() : 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Table of Items */}
                    <div className="py-6">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-900 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                            <th className="pb-3 text-left w-12">S/N</th>
                            <th className="pb-3 text-left">Product Details</th>
                            <th className="pb-3 text-left">SKU</th>
                            <th className="pb-3 text-center">Ordered Qty</th>
                            <th className="pb-3 text-center">Received Qty</th>
                            <th className="pb-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedGRN.items?.map((item, index) => {
                            const product = products.find(p => p.id === item.productId);
                            const discrepancy = item.orderedQuantity - item.receivedQuantity;
                            return (
                              <tr key={index} className="text-slate-800 font-medium">
                                <td className="py-4 font-mono text-[11px]">{index + 1}</td>
                                <td className="py-4">
                                  <p className="font-bold text-slate-900 text-xs">{product?.name || 'Unknown Product'}</p>
                                </td>
                                <td className="py-4 font-mono text-[10px] text-slate-500">{product?.sku || 'N/A'}</td>
                                <td className="py-4 text-center font-bold text-slate-500">{item.orderedQuantity}</td>
                                <td className="py-4 text-center font-black text-slate-900">{item.receivedQuantity}</td>
                                <td className="py-4 text-center">
                                  {discrepancy <= 0 ? (
                                    <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black uppercase tracking-wider">
                                      Fully Recv
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-black uppercase tracking-wider">
                                      Shortfall: {discrepancy}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Verification Notes */}
                    {selectedGRN.notes && (
                      <div className="mt-4 p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Verification Remarks & Quality Check</h4>
                        <p className="text-xs font-semibold text-slate-700 leading-relaxed">{selectedGRN.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Signatures Footer */}
                  <div className="pt-12 border-t border-slate-100">
                    <div className="grid grid-cols-3 gap-8 text-[11px] text-slate-500">
                      <div>
                        <p className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Received By (Storeman)</p>
                        <div className="border-b border-slate-300 h-10 mt-2"></div>
                        <p className="mt-2 font-black text-slate-800">{selectedGRN.receivedBy}</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Verified By (Inspector)</p>
                        <div className="border-b border-slate-300 h-10 mt-2"></div>
                        <p className="mt-2 font-semibold text-slate-400">Signature / Date</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Authorizing Manager Stamp</p>
                        <div className="border-b border-slate-300 h-10 mt-2"></div>
                        <p className="mt-2 font-semibold text-slate-400">Stamp & Signature</p>
                      </div>
                    </div>

                    <div className="mt-12 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Powered by InventoryPro Cloud
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

