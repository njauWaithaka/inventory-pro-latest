import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Plus, FileX, Download, 
  ChevronDown, Calendar, User, DollarSign, 
  ArrowDownRight, RefreshCcw, Loader2, X, Trash2, Package
} from 'lucide-react';
import { collection, onSnapshot, setDoc, deleteDoc, doc, getDocs, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';

export function CreditNotes() {
  const { user } = useAuth();
  const { profile, settings } = useSettings();
  const currency = settings?.currency || 'KSh';
  const [searchTerm, setSearchTerm] = useState('');
  const [credits, setCredits] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [invoiceId, setInvoiceId] = useState('');
  const [customer, setCustomer] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Customer Return');
  const [returnedItems, setReturnedItems] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.companyId) {
      setLoading(false);
      return;
    }

    // Subscribe to credit notes
    const path = `companies/${profile.companyId}/credit_notes`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCredits(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error loading credit notes:", error);
      setLoading(false);
    });

    // Subscribe to products
    const productsPath = `companies/${profile.companyId}/products`;
    const unsubscribeProducts = onSnapshot(collection(db, productsPath), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Subscribe to invoices
    const invoicesPath = `companies/${profile.companyId}/invoices`;
    const unsubscribeInvoices = onSnapshot(collection(db, invoicesPath), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filter only standard, active invoices that have items to return
      const filtered = docs.filter((inv: any) => inv.status !== 'proforma' && inv.type !== 'proforma');
      setInvoices(filtered);
    });

    return () => {
      unsubscribe();
      unsubscribeProducts();
      unsubscribeInvoices();
    };
  }, [profile?.companyId]);

  const handleInvoiceSelect = (selectedInvoiceId: string) => {
    setInvoiceId(selectedInvoiceId);
    const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
    if (selectedInvoice) {
      setCustomer(selectedInvoice.customer || '');
      
      const invoiceCreditNotes = credits.filter(cn => cn.invoiceId === selectedInvoiceId);
      
      const items = (selectedInvoice.items || []).map((item: any) => {
        const previouslyReturned = invoiceCreditNotes.reduce((sum, cn) => {
          if (cn.returnedItems) {
            const matchingItem = cn.returnedItems.find((ri: any) => ri.productId === item.productId);
            return sum + (matchingItem ? Number(matchingItem.quantity) || 0 : 0);
          } else if (cn.productId === item.productId) {
            return sum + (Number(cn.quantity) || 0);
          }
          return sum;
        }, 0);

        const maxAllowed = Math.max(0, (Number(item.quantity) || 0) - previouslyReturned);

        return {
          productId: item.productId,
          name: item.name || '',
          sku: item.sku || '',
          soldQuantity: Number(item.quantity) || 0,
          previouslyReturned,
          maxAllowed,
          returnedQuantity: 0,
          price: Number(item.price) || 0
        };
      });
      setReturnedItems(items);
      setAmount('0');
    } else {
      setCustomer('');
      setReturnedItems([]);
      setAmount('');
    }
  };

  const handleQuantityChange = (productId: string, val: string) => {
    const qty = parseInt(val) || 0;
    const updated = returnedItems.map(item => {
      if (item.productId === productId) {
        const clampedQty = Math.max(0, Math.min(item.maxAllowed, qty));
        return { ...item, returnedQuantity: clampedQty };
      }
      return item;
    });
    setReturnedItems(updated);

    const totalRefund = updated.reduce((sum, item) => sum + (item.returnedQuantity * item.price), 0);
    setAmount(totalRefund.toString());
  };

  const handleIssueCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !invoiceId || !customer || !amount) return;
    
    const itemsToReturn = returnedItems.filter(item => item.returnedQuantity > 0);
    if (itemsToReturn.length === 0) {
      alert("Please specify at least one product with returned quantity greater than 0.");
      return;
    }

    setIsSubmitting(true);

    try {
      const creditId = `CN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const cnDocRef = doc(db, `companies/${profile.companyId}/credit_notes`, creditId);

      // 1. Issue Credit Note Document
      await setDoc(cnDocRef, {
        noteId: creditId,
        id: creditId,
        invoiceId,
        customer,
        amount: parseFloat(amount),
        reason,
        status: 'Approved', // confirmed/approved credit note
        returnedItems: itemsToReturn.map(item => ({
          productId: item.productId,
          name: item.name,
          sku: item.sku || '',
          quantity: item.returnedQuantity,
          price: item.price
        })),
        // For backwards compatibility with older single-item view:
        productId: itemsToReturn.length === 1 ? itemsToReturn[0].productId : '',
        productName: itemsToReturn.length === 1 ? itemsToReturn[0].name : '',
        quantity: itemsToReturn.length === 1 ? itemsToReturn[0].returnedQuantity : 0,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });

      // 2. Automatically restock inventory for each returned item individually
      for (const item of itemsToReturn) {
        const productId = item.productId;
        const qtyReturned = item.returnedQuantity;
        const productRef = doc(db, `companies/${profile.companyId}/products`, productId);
        
        // Fetch fresh product snapshot for exact quantity calculation
        const freshSnap = await getDoc(productRef);
        const originalProduct = products.find(p => p.id === productId) || {};
        const freshData = freshSnap.exists() ? freshSnap.data() : originalProduct;
        
        const beforeQty = Number(freshData.quantity) || 0;
        const finalQty = beforeQty + qtyReturned;

        // Decrease unitsSold so sell-through metrics and other reports update correctly
        const beforeUnitsSold = Number(freshData.unitsSold) || 0;
        const finalUnitsSold = Math.max(0, beforeUnitsSold - qtyReturned);

        // Update product stock levels
        await updateDoc(productRef, {
          quantity: finalQty,
          currentStock: finalQty,
          unitsSold: finalUnitsSold,
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp()
        });

        // 3. Create stock movement record for each returned item to maintain complete audit trail
        const movementId = `mov_${Date.now()}_${productId}_return`;
        const movementRef = doc(db, `companies/${profile.companyId}/stockMovements`, movementId);
        
        await setDoc(movementRef, {
          id: movementId,
          productId: productId,
          type: 'return',
          quantity: qtyReturned,
          beforeQty: beforeQty,
          afterQty: finalQty,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || '',
          reference: creditId,

          // Target schema analytical and audit mapping
          transactionId: movementId,
          transactionType: 'Return',
          previousStock: beforeQty,
          newStock: finalQty,
          reason: `Customer Return - Credit Note #${creditId} (${reason})`,
          userId: user?.uid || '',
          timestamp: serverTimestamp()
        });
      }

      // 4. Trigger dynamic alerts and reorder metrics recalculation instantly
      const { AlertService } = await import('../../../lib/alertService');
      await AlertService.runAlertSync(profile.companyId);

      // Reset Form State
      setInvoiceId('');
      setCustomer('');
      setAmount('');
      setReturnedItems([]);
      setReason('Customer Return');
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error issuing credit note:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCredit = async (id: string) => {
    if (!profile?.companyId || !window.confirm("Are you sure you want to delete this credit note?")) return;
    try {
      await deleteDoc(doc(db, `companies/${profile.companyId}/credit_notes`, id));
    } catch (error) {
      console.error("Error deleting credit note:", error);
    }
  };

  const filteredCredits = credits.filter(c => 
    (c.noteId || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.customer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.invoiceId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCreditsAmount = credits.reduce((sum, c) => sum + (c.amount || 0), 0);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 lg:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Credit Notes / Returns</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage refunds, returns, and billing adjustments</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setInvoiceId('');
              setCustomer('');
              setAmount('');
              setReturnedItems([]);
              setReason('Customer Return');
              setShowCreateModal(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#0f172a] text-white px-5 h-11 rounded-lg font-bold hover:bg-slate-800 transition-all text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Issue Credit Note
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-left">
        {[
          { label: 'Total Credits Issued', value: `${currency}${totalCreditsAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, sub: `${credits.length} transaction(s) recorded`, color: 'rose' },
          { label: 'Return Rate', value: 'Live Tracker', sub: 'Calculated from credits', color: 'emerald' },
          { label: 'Active Returns', value: credits.length.toString(), sub: 'In system logs', color: 'amber' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <h4 className="text-2xl font-black text-slate-900 mt-1">{stat.value}</h4>
            <p className="text-[10px] font-medium text-slate-500 mt-1 leading-none">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search credits by note ID, customer, or invoice..."
            className="w-full pl-11 pr-4 h-12 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-slate-300 focus:bg-white transition-all font-medium text-slate-900 text-sm placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="hidden lg:grid grid-cols-[140px_140px_1fr_120px_120px_100px] gap-4 px-8 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">
          <div>Note ID</div>
          <div>Reference Invoice</div>
          <div>Customer / Return Product</div>
          <div className="text-center">Issued Date</div>
          <div className="text-right">Amount</div>
          <div className="text-center">Actions</div>
        </div>
        <div className="divide-y divide-slate-100 font-sans">
          {filteredCredits.map((cn_item) => (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={cn_item.id} 
              className="group hover:bg-slate-50 transition-all font-sans text-left"
            >
              <div className="hidden lg:grid grid-cols-[140px_140px_1fr_120px_120px_100px] gap-4 px-8 py-5 items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-white transition-all">
                    <FileX className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-900 text-sm">{cn_item.noteId}</span>
                </div>
                <div className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit">
                   {cn_item.invoiceId}
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-sm">{cn_item.customer}</span>
                  {cn_item.returnedItems && cn_item.returnedItems.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {cn_item.returnedItems.map((item: any, idx: number) => (
                        <span key={idx} className="block text-[11px] font-bold text-slate-500 leading-none">
                          Returned: <strong className="text-slate-700">{item.name} (x{item.quantity})</strong>
                        </span>
                      ))}
                    </div>
                  ) : cn_item.productName ? (
                    <span className="block text-[11px] font-bold text-slate-500 leading-none mt-0.5">
                      Returned: <strong className="text-slate-700">{cn_item.productName} (x{cn_item.quantity})</strong>
                    </span>
                  ) : null}
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{cn_item.reason}</span>
                </div>
                <div className="text-center text-xs font-semibold text-slate-500">{cn_item.date}</div>
                <div className="text-right font-black text-rose-600 text-sm">
                  -{currency}{(cn_item.amount || 0).toLocaleString()}
                </div>
                <div className="flex justify-center">
                  <button 
                    onClick={() => handleDeleteCredit(cn_item.id)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mobile Card */}
              <div className="lg:hidden p-5 space-y-3">
                 <div className="flex justify-between items-start">
                    <div>
                       <h3 className="font-bold text-slate-900 text-sm">{cn_item.noteId}</h3>
                       <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{cn_item.customer}</p>
                       {cn_item.returnedItems && cn_item.returnedItems.length > 0 ? (
                         <div className="mt-1 space-y-0.5">
                           {cn_item.returnedItems.map((item: any, idx: number) => (
                             <p key={idx} className="text-[11px] font-semibold text-slate-500">
                               Returned: {item.name} (x{item.quantity})
                             </p>
                           ))}
                         </div>
                       ) : cn_item.productName ? (
                         <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                           Returned: {cn_item.productName} (x{cn_item.quantity})
                         </p>
                       ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-rose-600 text-sm">-{currency}{(cn_item.amount || 0).toLocaleString()}</span>
                      <button 
                        onClick={() => handleDeleteCredit(cn_item.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                 </div>
                 <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                    <span className="flex items-center gap-1.5"><RefreshCcw className="w-3 h-3" /> {cn_item.reason}</span>
                    <span>Ref: {cn_item.invoiceId}</span>
                 </div>
              </div>
            </motion.div>
          ))}

          {filteredCredits.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FileX className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold">No credit notes found</p>
              <p className="text-xs text-slate-400 mt-1">Issue a new credit note to start tracking adjustments</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden text-left"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Issue Credit Note</h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleIssueCredit} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Reference Invoice
                  </label>
                  <select
                    required
                    value={invoiceId}
                    onChange={(e) => handleInvoiceSelect(e.target.value)}
                    className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm bg-white"
                  >
                    <option value="">-- Select Reference Invoice --</option>
                    {invoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.id} - {inv.customer} ({currency}{(inv.amount || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                {invoiceId && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Customer Name
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Acme Corp"
                      required
                      readOnly
                      value={customer}
                      className="w-full px-4 h-11 border border-slate-150 bg-slate-50 rounded-xl font-semibold text-slate-700 text-sm cursor-not-allowed"
                    />
                  </div>
                )}

                {invoiceId && returnedItems.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Returned Products & Quantities
                    </label>
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-slate-50/50 max-h-60 overflow-y-auto">
                      {returnedItems.map((item) => (
                        <div key={item.productId} className="p-3.5 flex items-center justify-between gap-4 bg-white text-xs">
                          <div className="flex-1 min-w-0 text-left">
                            <p className="font-bold text-slate-900 truncate">{item.name}</p>
                            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                              Sold: {item.soldQuantity} | Prev Returned: {item.previouslyReturned} | Max Returnable: <span className="font-extrabold text-slate-600">{item.maxAllowed}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-bold">{currency}{item.price.toLocaleString()} ea</span>
                            <input 
                              type="number"
                              min="0"
                              max={item.maxAllowed}
                              value={item.returnedQuantity}
                              onChange={(e) => handleQuantityChange(item.productId, e.target.value)}
                              className="w-16 h-9 border border-slate-200 rounded-lg text-center font-bold text-slate-900 focus:outline-none focus:border-slate-400"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {invoiceId && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                        Refund Amount ({currency})
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                        Reason for Credit
                      </label>
                      <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm bg-white"
                      >
                        <option value="Customer Return">Customer Return</option>
                        <option value="Pricing Error">Pricing Error</option>
                        <option value="Billing Adjustment">Billing Adjustment</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 h-11 border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting || !invoiceId}
                    className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Issue Credit'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
