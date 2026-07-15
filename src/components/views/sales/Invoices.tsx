import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Plus, FileText, Download, MoreHorizontal, 
  ChevronDown, Calendar, User, DollarSign, CheckCircle2, 
  Clock, AlertCircle, ArrowUpRight, Loader2, X, Package, 
  Trash2, ShoppingCart, Printer
} from 'lucide-react';
import { collection, onSnapshot, query, where, setDoc, doc, addDoc, serverTimestamp, updateDoc, increment, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const statusStyles = {
  paid: "bg-emerald-50 text-emerald-600 border-emerald-100",
  pending: "bg-blue-50 text-blue-600 border-blue-100",
  overdue: "bg-rose-50 text-rose-600 border-rose-100",
  draft: "bg-slate-50 text-slate-500 border-slate-100",
  proforma: "bg-amber-50 text-amber-600 border-amber-100",
};

interface InvoiceItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  sku: string;
}

export function Invoices({ filterType }: { filterType?: 'standard' | 'proforma' }) {
  const { user } = useAuth();
  const { profile, company, currency } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  
  // New Invoice Form State
  const [customerName, setCustomerName] = useState('');
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [dueDate, setDueDate] = useState('');
  const isProforma = false;

  const handlePrintInvoice = () => {
    window.print();
  };

  useEffect(() => {
    if (!profile?.companyId) return;
    const path = `companies/${profile.companyId}/invoices`;
    
    let q = query(collection(db, path), orderBy('createdAt', 'desc'));
    if (filterType) {
      q = query(collection(db, path), where('type', '==', filterType), orderBy('createdAt', 'desc'));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile?.companyId, filterType]);

  useEffect(() => {
    if (isNewInvoiceOpen && profile?.companyId) {
      const q = collection(db, `companies/${profile.companyId}/products`);
      getDocs(q).then(snapshot => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    }
  }, [isNewInvoiceOpen, profile?.companyId]);

  const addItem = (product: any) => {
    setSelectedItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.value || 0,
        sku: product.sku || ''
      }];
    });
  };

  const removeItem = (productId: string) => {
    setSelectedItems(prev => prev.filter(item => item.productId !== productId));
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    setSelectedItems(prev => prev.map(item => 
      item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item
    ));
  };

  const calculateTotal = () => {
    return selectedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  };

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.companyId || !customerName || selectedItems.length === 0) return;

    setIsSubmitting(true);
    const totalAmount = calculateTotal();
    const type = isProforma ? 'PRO' : 'INV';
    const invoiceId = `${type}-${Date.now()}`;
    
    try {
      const invoiceData = {
        id: invoiceId,
        customer: customerName,
        amount: totalAmount,
        status: isProforma ? 'proforma' : 'pending',
        type: isProforma ? 'proforma' : 'standard',
        date: new Date().toISOString().split('T')[0],
        dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: selectedItems,
        createdAt: new Date().toISOString(),
        createdBy: user.uid
      };

      // 1. Create Invoice
      await setDoc(doc(db, `companies/${profile.companyId}/invoices`, invoiceId), invoiceData);

      // 2. ONLY Reduce Inventory & Create Movements & Record Unified Sales IF NOT PROFORMA
      if (!isProforma) {
        for (const item of selectedItems) {
          const productRef = doc(db, `companies/${profile.companyId}/products`, item.productId);
          const product = products.find(p => p.id === item.productId);
          const beforeQty = product?.quantity || 0;
          const finalQty = beforeQty - item.quantity;

          await updateDoc(productRef, {
            quantity: finalQty,
            currentStock: finalQty,
            unitsSold: increment(item.quantity),
            updatedAt: new Date().toISOString(),
            serverUpdatedAt: serverTimestamp(),
          });

          // Write Unified Sale Record
          const saleId = `sale_${Date.now()}_${item.productId}`;
          await setDoc(doc(db, `companies/${profile.companyId}/sales`, saleId), {
            id: saleId,
            saleId: saleId,
            productId: item.productId,
            productName: item.name || product?.name || "Product",
            quantitySold: item.quantity,
            sellingPrice: item.price,
            totalAmount: item.quantity * item.price,
            saleDate: new Date().toISOString().split('T')[0],
            customerId: customerName || "Walk-in Customer",
            createdAt: new Date().toISOString(),
            timestamp: serverTimestamp(),
          });

          const movementId = `mov_${Date.now()}_${item.productId}`;
          await setDoc(doc(db, `companies/${profile.companyId}/stockMovements`, movementId), {
            id: movementId,
            productId: item.productId,
            type: 'sale',
            quantity: item.quantity,
            beforeQty: beforeQty,
            afterQty: finalQty,
            createdAt: new Date().toISOString(),
            createdBy: user.uid,
            reference: invoiceId,

            // Audit and Analytical Fields (Target Schema Alignment)
            transactionId: movementId,
            transactionType: 'Sale',
            previousStock: beforeQty,
            newStock: finalQty,
            reason: `Invoice Sale - Invoice #${invoiceId}`,
            userId: user.uid,
            timestamp: serverTimestamp(),
          });
        }

        // 3. Generate Delivery Note (Only for regular invoices)
        const deliveryNoteId = `DN-${Date.now()}`;
        await setDoc(doc(db, `companies/${profile.companyId}/deliveryNotes`, deliveryNoteId), {
          id: deliveryNoteId,
          orderId: invoiceId,
          customer: customerName,
          date: new Date().toISOString().split('T')[0],
          status: 'pending',
          items: selectedItems,
          createdAt: new Date().toISOString(),
          createdBy: user.uid
        });
      }

      setIsNewInvoiceOpen(false);
      setCustomerName('');
      setSelectedItems([]);
      setDueDate('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'invoices');
    } finally {
      setIsSubmitting(false);
    }
  };

  const postToInvoice = async (proformaInvoice: any) => {
    if (!user || !profile?.companyId) return;
    setIsSubmitting(true);
    
    try {
      const invoiceId = `INV-${Date.now()}`;
      const invoiceData = {
        ...proformaInvoice,
        id: invoiceId,
        status: 'pending',
        type: 'standard',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        source_type: 'proforma',
        source_id: proformaInvoice.id,
        converted_date: new Date().toISOString()
      };

      // 1. Create Real Invoice
      await setDoc(doc(db, `companies/${profile.companyId}/invoices`, invoiceId), invoiceData);

      // 2. Mark Proforma as Converted
      await updateDoc(doc(db, `companies/${profile.companyId}/invoices`, proformaInvoice.id), {
        status: 'paid',
        isConverted: true,
        convertedTo: invoiceId,
        converted_date: new Date().toISOString()
      });

      // 3. Reduce Inventory & Create Movements & Record Unified Sales
      for (const item of proformaInvoice.items) {
        const productRef = doc(db, `companies/${profile.companyId}/products`, item.productId);
        
        // Fetch current product state
        const q = collection(db, `companies/${profile.companyId}/products`);
        const snapshot = await getDocs(q);
        const productsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const product = productsList.find(p => p.id === item.productId);
        const beforeQty = (product as any)?.quantity || 0;
        const finalQty = beforeQty - item.quantity;

        await updateDoc(productRef, {
          quantity: finalQty,
          currentStock: finalQty,
          unitsSold: increment(item.quantity),
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp(),
        });

        // Write Unified Sale Record
        const saleId = `sale_${Date.now()}_${item.productId}`;
        await setDoc(doc(db, `companies/${profile.companyId}/sales`, saleId), {
          id: saleId,
          saleId: saleId,
          productId: item.productId,
          productName: item.name || (product as any)?.name || "Product",
          quantitySold: item.quantity,
          sellingPrice: item.price,
          totalAmount: item.quantity * item.price,
          saleDate: new Date().toISOString().split('T')[0],
          customerId: proformaInvoice.customer || "Walk-in Customer",
          createdAt: new Date().toISOString(),
          timestamp: serverTimestamp(),
        });

        const movementId = `mov_${Date.now()}_${item.productId}`;
        await setDoc(doc(db, `companies/${profile.companyId}/stockMovements`, movementId), {
          id: movementId,
          productId: item.productId,
          type: 'sale',
          quantity: item.quantity,
          beforeQty: beforeQty,
          afterQty: finalQty,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
          reference: invoiceId,

          // Audit and Analytical Fields (Target Schema Alignment)
          transactionId: movementId,
          transactionType: 'Sale',
          previousStock: beforeQty,
          newStock: finalQty,
          reason: `Converted Proforma Sale - Invoice #${invoiceId}`,
          userId: user.uid,
          timestamp: serverTimestamp(),
        });
      }

      // 4. Generate Delivery Note
      const deliveryNoteId = `DN-${Date.now()}`;
      await setDoc(doc(db, `companies/${profile.companyId}/deliveryNotes`, deliveryNoteId), {
        id: deliveryNoteId,
        orderId: invoiceId,
        customer: proformaInvoice.customer,
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        items: proformaInvoice.items,
        createdAt: new Date().toISOString(),
        createdBy: user.uid
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'post_invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const stats = [
    { label: 'Total Invoiced', value: `${currency}${invoices.reduce((acc, inv) => acc + (inv.amount || 0), 0).toLocaleString()}`, trend: '+12%', color: 'blue' },
    { label: 'Total Invoice', value: invoices.length.toString(), trend: '+8%', color: 'emerald' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 lg:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Sales Invoices</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage billing and track customer payments</p>
        </div>
        <div className="flex items-center gap-2 text-left">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-11 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-sm">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button 
            onClick={() => setIsNewInvoiceOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#0f172a] text-white px-5 h-11 rounded-lg font-bold hover:bg-slate-800 transition-all text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isNewInvoiceOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewInvoiceOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Create New Invoice</h3>
                  <p className="text-xs text-slate-500 font-medium">Draft a new sales invoice and generate dispatch note</p>
                </div>
                <button 
                  onClick={() => setIsNewInvoiceOpen(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1.5 block">Customer Name</label>
                      <input 
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Enter customer name..."
                        className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1.5 block">Payment Due Date</label>
                      <input 
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium text-sm"
                      />
                    </div>

                    <div className="pt-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-3 block">Product Inventory</label>
                      <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 no-scrollbar">
                        {products.map(product => (
                          <button
                            key={product.id}
                            onClick={() => addItem(product)}
                            className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-blue-200 transition-all group text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                                <Package className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">{product.name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">SKU: {product.sku} • Stock: {product.quantity}</p>
                              </div>
                            </div>
                            <span className="text-xs font-black text-emerald-600">{currency}{product.value?.toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col bg-slate-50/50 rounded-[2rem] border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-white/50 flex items-center justify-between bg-white/50">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-emerald-600" /> Invoice Items
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400">{selectedItems.length} items selected</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {selectedItems.map(item => (
                        <div key={item.productId} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                            <p className="text-[9px] font-bold text-emerald-600">{currency}{item.price.toLocaleString()}</p>
                          </div>
                          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden h-8">
                            <button 
                              onClick={() => updateItemQuantity(item.productId, item.quantity - 1)}
                              className="px-2 border-r border-slate-200 hover:bg-white transition-colors"
                            >
                              <Minus className="w-3 h-3 text-slate-500" />
                            </button>
                            <span className="w-8 text-[11px] font-bold text-center">{item.quantity}</span>
                            <button 
                              onClick={() => updateItemQuantity(item.productId, item.quantity + 1)}
                              className="px-2 border-l border-slate-200 hover:bg-white transition-colors"
                            >
                              <Plus className="w-3 h-3 text-slate-500" />
                            </button>
                          </div>
                          <button 
                            onClick={() => removeItem(item.productId)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {selectedItems.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                          <ShoppingCart className="w-12 h-12 mb-2" />
                          <p className="text-xs font-black uppercase tracking-widest">Cart is empty</p>
                        </div>
                      )}
                    </div>

                    <div className="p-6 bg-[#0F172A] text-white">
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">Total Amount</span>
                        <h5 className="text-3xl font-black">{currency}{calculateTotal().toLocaleString()}</h5>
                      </div>
                      <button 
                        onClick={handleSubmitInvoice}
                        disabled={isSubmitting || !customerName || selectedItems.length === 0}
                        className={cn(
                          "w-full h-14 text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-xs shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50",
                          isProforma ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/20" : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20"
                        )}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            {isProforma ? <Clock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                            {isProforma ? 'Save Proforma' : 'Post Invoice'}
                          </>
                        )}
                      </button>
                      <p className="mt-4 text-[9px] text-center text-slate-500 font-medium leading-relaxed">
                        {isProforma 
                          ? "Proforma invoices do not reduce inventory until they are posted as tax invoices." 
                          : "By posting, you will reduce inventory and automatically generate a delivery dispatch note."
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <div className="flex items-end justify-between mt-1">
              <h4 className="text-2xl font-black text-slate-900">{stat.value}</h4>
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                stat.trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              )}>{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search invoices by ID or customer..."
            className="w-full pl-11 pr-4 h-12 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-slate-300 focus:bg-white transition-all font-medium text-slate-900 text-sm placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-12 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 text-left">
            <Filter className="w-4 h-4" /> Status <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-12 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 text-left">
            <Calendar className="w-4 h-4" /> Date Range <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="hidden lg:grid grid-cols-[140px_1fr_120px_120px_100px_120px] gap-4 px-8 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">
          <div>Invoice ID</div>
          <div>Customer</div>
          <div>Issue Date</div>
          <div>Due Date</div>
          <div className="text-right">Amount</div>
          <div className="text-center">Status</div>
          <div className="text-right">Actions</div>
        </div>
        <div className="divide-y divide-slate-100 font-sans">
          {(invoices.length > 0 ? invoices : []).filter(inv => 
            inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (inv.customer && inv.customer.toLowerCase().includes(searchTerm.toLowerCase()))
          ).map((inv) => (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={inv.id} 
              className="group hover:bg-slate-50 transition-all text-left"
            >
              <div className="hidden lg:grid grid-cols-[140px_1fr_120px_120px_100px_120px] gap-4 px-8 py-5 items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-white transition-all">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-900 text-sm">{inv.id?.replace(`${profile?.companyId}_`, '') || inv.id}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-sm">{inv.customer}</span>
                </div>
                <div className="text-xs font-semibold text-slate-500">{inv.date}</div>
                <div className="text-xs font-semibold text-slate-500">{inv.dueDate}</div>
                <div className="text-right font-black text-slate-900 text-sm">
                  {currency}{(inv.amount || 0).toLocaleString()}
                </div>
                <div className="flex justify-center">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                    statusStyles[inv.status as keyof typeof statusStyles]
                  )}>
                    {inv.status}
                  </span>
                </div>
                <div className="flex justify-end">
                   {inv.status === 'proforma' ? (
                     <button 
                        onClick={() => postToInvoice(inv)}
                        disabled={isSubmitting}
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all font-bold text-[10px] uppercase tracking-wider flex items-center gap-2"
                     >
                        {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpRight className="w-3 h-3" />}
                        Post
                     </button>
                   ) : (
                     <button 
                        onClick={() => setSelectedInvoice(inv)}
                        className="p-2 text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 rounded-lg transition-all flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider"
                     >
                        <Printer className="w-3.5 h-3.5" />
                        Print
                     </button>
                   )}
                </div>
              </div>
 
              {/* Mobile Card */}
              <div className="lg:hidden p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{inv.id?.replace(`${profile?.companyId}_`, '') || inv.id}</h3>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">{inv.customer}</p>
                  </div>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border",
                    statusStyles[inv.status as keyof typeof statusStyles]
                  )}>
                    {inv.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Amount</p>
                      <p className="font-black text-slate-900 text-sm">{currency}{(inv.amount || 0).toLocaleString()}</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Due Date</p>
                      <p className="font-bold text-slate-700 text-xs">{inv.dueDate}</p>
                   </div>
                </div>
                <div className="flex justify-end pt-3 border-t border-slate-100">
                   {inv.status === 'proforma' ? (
                     <button 
                        onClick={() => postToInvoice(inv)}
                        disabled={isSubmitting}
                        className="px-3 h-8 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5"
                     >
                        {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        Post
                     </button>
                   ) : (
                     <button 
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-3 h-8 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5"
                     >
                        <Printer className="w-3.5 h-3.5" />
                        Print
                     </button>
                   )}
                </div>
              </div>
            </motion.div>
          ))}
          {invoices.length === 0 && !loading && (
            <div className="p-12 text-center text-slate-400">
               <FileText className="w-12 h-12 mx-auto opacity-10 mb-4" />
               <p className="text-sm font-bold uppercase tracking-widest text-slate-300">No invoices found</p>
            </div>
          )}
        </div>
      </div>

      {/* Kenya Sales Invoice Detailed Print Dialog */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-y-auto text-left">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInvoice(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <style>{`
              @media print {
                body {
                  visibility: hidden !important;
                }
                #printable-invoice-area, #printable-invoice-area * {
                  visibility: visible !important;
                }
                #printable-invoice-area {
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
              className="relative bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-8 flex flex-col md:flex-row h-[85vh] z-10"
            >
              {/* Absolute Close button */}
              <button
                onClick={() => setSelectedInvoice(null)}
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors z-20 border border-slate-100"
                title="Close Viewer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Controls */}
              <div className="p-8 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-between md:w-[320px] bg-slate-50 shrink-0">
                <div className="space-y-6">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <FileText className="w-3 h-3" /> Invoice Viewer
                    </span>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-3">Sales Invoice</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">Review your Sales Invoice document. Ready for digital or paper distribution.</p>
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-[10px] uppercase tracking-widest">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Status: {selectedInvoice.status}
                    </div>
                    <p className="text-[10px] text-emerald-700 font-semibold leading-relaxed">
                      This document has been fully posted and synchronized to the general ledger.
                     </p>
                  </div>


                </div>

                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <button
                    onClick={handlePrintInvoice}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Printer className="w-4 h-4" />
                    Print Invoice (A4)
                  </button>
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="w-full h-12 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Close Viewer
                  </button>
                </div>
              </div>

              {/* A4 Sales Invoice Preview */}
              <div className="flex-1 bg-slate-100 p-6 overflow-y-auto no-scrollbar flex justify-center items-start">
                <div 
                  id="printable-invoice-area" 
                  className="bg-white shadow-lg border border-slate-200 w-full max-w-[650px] p-10 text-xs text-left text-slate-900 font-sans"
                >
                  {/* Logo and Invoice Title */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                    <div>
                      <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{company?.name || 'INVENTORYPRO CO.'}</h1>
                      <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">{company?.address || 'Nairobi, Kenya'}</p>
                      <p className="text-slate-500 font-semibold text-[10px]">{company?.phone || '+254 700 000 000'}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-4 py-1.5 bg-slate-900 text-white font-black text-sm uppercase tracking-widest">Sales Invoice</span>
                      <p className="text-xs font-mono font-bold text-slate-700 mt-2">INVOICE NO: {selectedInvoice.id?.replace(`${profile?.companyId}_`, '') || selectedInvoice.id}</p>
                    </div>
                  </div>

                  {/* Buyer Details */}
                  <div className="py-4">
                    <div className="space-y-1.5 max-w-md">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buyer Details</h4>
                      <div className="text-[11px] space-y-1">
                        <p className="font-bold text-slate-900 text-sm">{selectedInvoice.customer}</p>
                        <p className="font-semibold text-slate-600">PIN: <strong className="text-slate-400">Not Provided</strong></p>
                        <p className="text-slate-600">Payment Status: <strong className={cn(
                          "uppercase",
                          selectedInvoice.status === 'paid' ? "text-emerald-600" : "text-amber-600"
                        )}>{selectedInvoice.status}</strong></p>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Metadata Box */}
                  <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl text-[11px]">
                    <div>
                      <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Date of Issue</p>
                      <p className="font-black text-slate-800 mt-0.5">{selectedInvoice.date}</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Due Date</p>
                      <p className="font-black text-slate-800 mt-0.5">{selectedInvoice.dueDate}</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Payment Method</p>
                      <p className="font-black text-slate-800 mt-0.5 uppercase">M-PESA / BANK</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Currency</p>
                      <p className="font-black text-slate-800 mt-0.5 uppercase">{currency} (KES)</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="py-2">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-900 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                          <th className="pb-3 text-left">Product / Service</th>
                          <th className="pb-3 text-left">SKU</th>
                          <th className="pb-3 text-center">Quantity</th>
                          <th className="pb-3 text-right">Unit Price</th>
                          <th className="pb-3 text-center">Tax Category</th>
                          <th className="pb-3 text-right">Amount (Incl. VAT)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                          selectedInvoice.items.map((item: any, i: number) => (
                            <tr key={i} className="text-slate-800 font-medium">
                              <td className="py-4 font-bold text-slate-900">{item.name}</td>
                              <td className="py-4 font-mono text-[10px] text-slate-500">{item.sku || 'N/A'}</td>
                              <td className="py-4 text-center font-bold">{item.quantity}</td>
                              <td className="py-4 text-right font-semibold">{currency}{(item.price || 0).toLocaleString()}</td>
                              <td className="py-4 text-center font-bold text-slate-600">Rate A (16%)</td>
                              <td className="py-4 text-right font-black text-slate-900">{currency}{( (item.price || 0) * (item.quantity || 1) ).toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr className="text-slate-800 font-medium">
                            <td className="py-4 font-bold text-slate-900">Standard Business Supply Bill</td>
                            <td className="py-4 font-mono text-[10px] text-slate-500 font-bold">N/A</td>
                            <td className="py-4 text-center font-bold">1</td>
                            <td className="py-4 text-right font-semibold">{currency}{(selectedInvoice.amount || 0).toLocaleString()}</td>
                            <td className="py-4 text-center font-bold text-slate-600 font-bold">Rate A (16%)</td>
                            <td className="py-4 text-right font-black text-slate-900">{currency}{(selectedInvoice.amount || 0).toLocaleString()}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Summaries & Calculations breakdown */}
                  <div className="flex justify-end pt-6 border-t border-slate-200">
                    {/* Calculations Breakdown */}
                    <div className="space-y-2 text-right w-full max-w-xs">
                      <div className="flex justify-between text-slate-500 text-[11px] font-semibold">
                        <span>Subtotal (VAT Exclusive)</span>
                        <span>{currency}{(selectedInvoice.amount * 0.862068).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px] font-semibold">
                        <span>Tax Base (Rate A - 16%)</span>
                        <span>{currency}{(selectedInvoice.amount * 0.862068).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px] font-semibold">
                        <span>VAT Total Amount (16%)</span>
                        <span>{currency}{(selectedInvoice.amount * 0.137931).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-900 text-sm font-black pt-2 border-t-2 border-slate-900">
                        <span>Grand Total (VAT Inclusive)</span>
                        <span>{currency}{(selectedInvoice.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
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

function Minus({ className }: { className?: string }) {
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
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}

