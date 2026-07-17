import React, { useState, useEffect } from 'react';
import { 
  Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, 
  Banknote, Receipt, User, Package, Loader2, CheckCircle2,
  Scan, Pause, RotateCcw, Smartphone, Printer, X, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../lib/utils';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category?: string;
  sku?: string;
}

export function POS() {
  const { user } = useAuth();
  const { profile, company, currency } = useSettings();
  const userName = profile?.name || 'Cashier';

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [printType, setPrintType] = useState<'receipt' | 'invoice'>('receipt');

  // Held Carts State
  const [heldCarts, setHeldCarts] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('pos_held_carts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Today's Sales Indicators State
  const [todaySales, setTodaySales] = useState(0);
  const [todayOrdersCount, setTodayOrdersCount] = useState(0);

  // Sync Held Carts with LocalStorage
  useEffect(() => {
    localStorage.setItem('pos_held_carts', JSON.stringify(heldCarts));
  }, [heldCarts]);

  // Real-time Database Subscription for today's sales data
  useEffect(() => {
    if (!profile?.companyId) return;

    // Start of today in local time
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const receiptsRef = collection(db, `companies/${profile.companyId}/receipts`);
    
    const unsubscribe = onSnapshot(receiptsRef, (snapshot) => {
      let salesSum = 0;
      let count = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        let docDate: Date | null = null;
        
        if (data.timestamp) {
          if (typeof data.timestamp.toDate === 'function') {
            docDate = data.timestamp.toDate();
          } else if (data.timestamp instanceof Date) {
            docDate = data.timestamp;
          } else {
            docDate = new Date(data.timestamp);
          }
        }
        
        if (docDate && docDate >= startOfToday) {
          salesSum += Number(data.total || 0);
          count++;
        }
      });

      setTodaySales(salesSum);
      setTodayOrdersCount(count);
    }, (error) => {
      console.error("Error listening to receipts: ", error);
    });

    return unsubscribe;
  }, [profile?.companyId]);

  const handlePrintPOS = () => {
    window.print();
  };

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    const newHeldCart = {
      id: `held_${Date.now()}`,
      items: cart,
      timestamp: new Date().toISOString(),
      total: total
    };
    setHeldCarts(prev => [newHeldCart, ...prev]);
    setCart([]);
  };

  const handleRestoreCart = (heldId: string) => {
    const selected = heldCarts.find(hc => hc.id === heldId);
    if (!selected) return;
    setCart(selected.items);
    setHeldCarts(prev => prev.filter(hc => hc.id !== heldId));
    setShowHeldModal(false);
  };

  const handleDeleteHeldCart = (heldId: string) => {
    setHeldCarts(prev => prev.filter(hc => hc.id !== heldId));
  };

  useEffect(() => {
    if (!profile?.companyId) return;
    
    const q = collection(db, `companies/${profile.companyId}/products`);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
      setLoading(false);
    });

    return unsubscribe;
  }, [profile?.companyId]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        if (cart.length > 0 && !isProcessing) {
          handleCheckout(paymentMethod);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isProcessing, paymentMethod]);

  const filteredProducts = products.filter(p => {
    const name = p.name || '';
    const sku = p.sku || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const quickAccessProducts = products.slice(0, 8);

  const addToCart = (product: any, qty: number = 1) => {
    const availableQty = typeof product.quantity === 'number' ? product.quantity : 0;
    if (availableQty <= 0) return; // Out of stock

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => {
          if (item.id === product.id) {
            const newQty = Math.min(availableQty, item.quantity + qty);
            return { ...item, quantity: newQty };
          }
          return item;
        });
      }
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: product.sellingPrice || product.value || 0, 
        quantity: Math.min(availableQty, qty),
        category: product.category,
        sku: product.sku,
        ...(product.image ? { image: product.image } : {})
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    const product = products.find(p => p.id === id);
    const availableQty = product ? (typeof product.quantity === 'number' ? product.quantity : 0) : 999999;
    
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.min(availableQty, Math.max(1, item.quantity + delta));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = total * 16 / 116; // 16% VAT Included
  const subtotal = total - tax; // VAT Exclusive Subtotal

  const handleCheckout = async (method: string) => {
    if (!user || !profile?.companyId || cart.length === 0) return;
    setIsProcessing(true);
    try {
      const receiptData = {
        customerName: 'Walk-in Customer',
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          ...(item.image ? { image: item.image } : {})
        })),
        subtotal,
        tax,
        total,
        paymentMethod: method,
        timestamp: serverTimestamp(),
        status: 'PAID',
        type: 'receipt',
        currency: currency
      };
      
      // 1. Create Receipt
      const receiptRef = await addDoc(collection(db, `companies/${profile.companyId}/receipts`), receiptData);
      const receiptId = receiptRef.id;

      // 2. Reduce Inventory & Create Movements & Record Unified Sales
      for (const item of cart) {
        const productRef = doc(db, `companies/${profile.companyId}/products`, item.id);
        const original = products.find(p => p.id === item.id);
        const beforeQty = original?.quantity || 0;
        const finalQty = beforeQty - item.quantity;
        
        await updateDoc(productRef, {
          quantity: finalQty,
          currentStock: finalQty,
          unitsSold: increment(item.quantity),
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp(),
        });

        // Write Unified Sale Record
        const saleId = `sale_${Date.now()}_${item.id}`;
        await setDoc(doc(db, `companies/${profile.companyId}/sales`, saleId), {
          id: saleId,
          saleId: saleId,
          productId: item.id,
          productName: item.name,
          quantitySold: item.quantity,
          sellingPrice: item.price,
          totalAmount: item.quantity * item.price,
          saleDate: new Date().toISOString().split('T')[0],
          customerId: (receiptData as any).customerId || "Walk-in Customer",
          createdAt: new Date().toISOString(),
          timestamp: serverTimestamp(),
        });

        const movementId = `mov_${Date.now()}_${item.id}`;
        await setDoc(doc(db, `companies/${profile.companyId}/stockMovements`, movementId), {
          id: movementId,
          productId: item.id,
          type: 'sale',
          quantity: item.quantity,
          beforeQty,
          afterQty: finalQty,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
          reference: receiptId,

          // Audit and Analytical Fields (Target Schema Alignment)
          transactionId: movementId,
          transactionType: 'Sale',
          previousStock: beforeQty,
          newStock: finalQty,
          reason: `POS Sale - Receipt #${receiptId}`,
          userId: user.uid,
          timestamp: serverTimestamp(),
        });
      }

      // 3. Generate Delivery Note (Explicit user request)
      // Note: This does NOT reduce stock, as we already did that above.
      const deliveryNoteId = `DN-POS-${Date.now()}`;
      await setDoc(doc(db, `companies/${profile.companyId}/deliveryNotes`, deliveryNoteId), {
        id: deliveryNoteId,
        orderId: receiptId,
        customer: receiptData.customerName,
        date: new Date().toISOString().split('T')[0],
        status: 'delivered', // POS sales are usually delivered immediately
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          sku: item.sku || ''
        })),
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        source: 'POS'
      });

      // 4. Generate Corresponding Standard Paid Invoice (Explicit request: "after sale also update the invoice")
      const invoiceId = `INV-POS-${Date.now()}`;
      const invoiceData = {
        id: invoiceId,
        customer: 'Walk-in Customer',
        amount: total,
        status: 'paid',
        type: 'standard',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          sku: item.sku || ''
        })),
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        source: 'POS',
        receiptId: receiptId
      };
      await setDoc(doc(db, `companies/${profile.companyId}/invoices`, invoiceId), invoiceData);

      // Save sale details for interactive print/view modal
      setCompletedSale({
        receiptId,
        invoiceId,
        customerName: 'Walk-in Customer',
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          sku: item.sku || ''
        })),
        subtotal,
        tax,
        total,
        paymentMethod: method,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date()
      });

      setCart([]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'receipts');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] bg-[#F8FAFC] font-sans scroll-smooth overflow-hidden">
      <div className="max-w-[1600px] mx-auto h-full p-4 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        
        {/* Left: Cart Panel */}
        <aside className="flex flex-col h-full min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden sticky top-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                Current Cart
              </h2>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{cart.length} items</p>
            </div>
            <button 
              onClick={() => setCart([])}
              className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
              title="Clear Cart"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

           <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
            <AnimatePresence mode="popLayout">
              {cart.map((item) => {
                const prod = products.find(p => p.id === item.id);
                const available = prod ? prod.quantity : 0;
                const isMax = item.quantity >= available;
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    key={item.id}
                    className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-100 rounded-xl group"
                  >
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-100 shrink-0">
                      <Package className="w-5 h-5 text-slate-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-emerald-600 font-bold">{currency} {item.price.toLocaleString()}</p>
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-200/50 px-1 rounded">
                          {available} in stock
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden h-7">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="px-1.5 hover:bg-slate-50 transition-colors border-r border-slate-200 h-full"
                        >
                          <Minus className="w-3 h-3 text-slate-500" />
                        </button>
                        <span className="w-6 text-[11px] font-bold text-center text-slate-700">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          disabled={isMax}
                          className={cn(
                            "px-1.5 transition-colors border-l border-slate-200 h-full",
                            isMax ? "bg-slate-50 cursor-not-allowed text-slate-300" : "hover:bg-slate-50 text-slate-500"
                          )}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 py-10">
                <ShoppingCart className="w-12 h-12 mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Cart is empty</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4 shrink-0">
            <div className="flex gap-2 text-[10px] items-center mb-2">
               <button 
                 onClick={handleHoldCart}
                 disabled={cart.length === 0}
                 className={cn(
                   "flex-1 h-8 flex items-center justify-center gap-2 border rounded-lg font-bold uppercase tracking-wider transition-colors",
                   cart.length > 0 
                     ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-50" 
                     : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                 )}
                 title="Hold Current Cart"
               >
                  <Pause className="w-3 h-3" /> Hold
               </button>
               <button 
                 onClick={() => setShowHeldModal(true)}
                 disabled={heldCarts.length === 0}
                 className={cn(
                   "flex-1 h-8 flex items-center justify-center gap-2 border rounded-lg font-bold uppercase tracking-wider transition-colors",
                   heldCarts.length > 0 
                     ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-50" 
                     : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                 )}
                 title="Restore Held Cart"
               >
                  <RotateCcw className="w-3 h-3" /> Restore {heldCarts.length > 0 && `(${heldCarts.length})`}
               </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Subtotal (VAT Excl.)</span>
                <span>{currency} {subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-wider pb-2">
                <span>VAT (16% Included)</span>
                <span>{currency} {tax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-3">
                <span className="text-xl font-bold text-slate-900 uppercase">Total</span>
                <span className="text-3xl font-black text-emerald-600">
                  {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'cash', icon: Banknote, label: 'Cash' },
                { id: 'mpesa', icon: Smartphone, label: 'M-Pesa' },
                { id: 'card', icon: CreditCard, label: 'Card' },
                { id: 'split', icon: RotateCcw, label: 'Split' },
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 h-14 rounded-xl border transition-all",
                    paymentMethod === method.id 
                      ? "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-sm" 
                      : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                  )}
                >
                  <method.icon className={cn("w-5 h-5", paymentMethod === method.id ? "text-emerald-600" : "text-slate-400")} />
                  <span className="text-[9px] font-bold uppercase tracking-tighter">{method.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => handleCheckout(paymentMethod)}
              disabled={cart.length === 0 || isProcessing}
              className="w-full h-14 bg-[#0F172A] text-white rounded-xl font-bold uppercase tracking-[0.2em] shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Complete Sale
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Right: Products Panel */}
        <div className="min-w-0 flex flex-col h-full min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Header Area */}
          <div className="p-4 lg:p-6 border-b border-slate-100 space-y-4 shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Point of Sale</h1>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {userName} • Shift #1 • Cashier Mode
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Today Sales', value: `${currency} ${todaySales.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: Banknote },
                    { label: 'Orders', value: todayOrdersCount.toString(), icon: Receipt },
                    { label: 'Held', value: heldCarts.length > 0 ? `${heldCarts.length} ${heldCarts.length === 1 ? 'Cart' : 'Carts'}` : 'None', icon: Pause, hideMobile: true },
                  ].map((stat, i) => (
                    <div key={i} className={cn(
                      "bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 flex items-center gap-3 min-w-[120px]",
                      stat.hideMobile && "hidden md:flex"
                    )}>
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shrink-0">
                        <stat.icon className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">{stat.label}</p>
                        <h4 className="text-xs font-black text-slate-900 truncate leading-none mt-0.5">{stat.value}</h4>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <button className="h-11 px-6 bg-[#0F172A] text-white rounded-xl flex items-center gap-2 font-bold text-sm hover:bg-slate-800 transition-all shadow-md shrink-0">
                <Scan className="w-4 h-4" />
                <span className="hidden sm:inline">Scan Barcode</span>
              </button>
            </div>

            <div className="relative">
              {/* Fade masks to indicate horizontal scrollable categories on small screens */}
              <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
              <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
              
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 border",
                      activeCategory === cat 
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/10 scale-[1.02]" 
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-white hover:border-emerald-500 hover:text-emerald-600"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Product Grid Area */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 no-scrollbar">
            
            {/* Quick Access Row */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Quick Access</h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Frequently Sold Products</span>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {quickAccessProducts.map(product => {
                  const isOutOfStock = (product.quantity || 0) <= 0;
                  return (
                    <button 
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={cn(
                        "min-w-[150px] bg-white border p-3 rounded-xl shadow-sm hover:shadow-md transition-all text-left flex flex-col group relative overflow-hidden",
                        isOutOfStock 
                          ? "border-slate-150 bg-slate-50/50 opacity-60 cursor-not-allowed" 
                          : "border-slate-100 hover:border-emerald-500/30"
                      )}
                    >
                      {!isOutOfStock && (
                        <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-50 rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Plus className="w-4 h-4 text-emerald-600" />
                        </div>
                      )}
                      {isOutOfStock && (
                        <div className="absolute top-0 right-0 bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-bl-lg text-[7px] font-black uppercase tracking-wider border-l border-b border-rose-100">
                          OOS
                        </div>
                      )}
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-1 opacity-60 truncate block">{product.category || 'Retail'}</span>
                      <h4 className="text-[11px] font-black text-slate-900 truncate mb-1 uppercase">{product.name}</h4>
                      
                      {/* Live Stock Level */}
                      <span className={cn(
                        "text-[8px] font-bold uppercase tracking-wider block mb-2",
                        isOutOfStock 
                          ? "text-rose-500 font-extrabold" 
                          : product.quantity <= (product.reorderPoint ?? product.minStock ?? 10) 
                            ? "text-amber-500 font-extrabold" 
                            : "text-emerald-500 font-semibold"
                      )}>
                        {isOutOfStock ? "Out of Stock" : `${product.quantity} left`}
                      </span>

                      <p className={cn("text-xs font-black mt-auto", isOutOfStock ? "text-slate-400" : "text-emerald-600")}>
                        {currency} {(product.sellingPrice || product.value || 0).toLocaleString()}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Grid */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest px-1">Product Grid</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => {
                  const isOutOfStock = (product.quantity || 0) <= 0;
                  return (
                    <div 
                      key={product.id} 
                      className={cn(
                        "bg-white border rounded-xl p-4 flex flex-col shadow-sm group transition-all relative overflow-hidden",
                        isOutOfStock 
                          ? "border-slate-200 bg-slate-50/50" 
                          : "border-slate-100 hover:border-emerald-500/50"
                      )}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                            {product.category || 'Retail'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider block px-1.5 py-0.5 rounded",
                            isOutOfStock 
                              ? "text-rose-600 bg-rose-50 border border-rose-100" 
                              : product.quantity <= (product.reorderPoint ?? product.minStock ?? 10) 
                                ? "text-amber-600 bg-amber-50 border border-amber-100" 
                                : "text-emerald-600 bg-emerald-50 border border-emerald-100"
                          )}>
                             {isOutOfStock ? "OUT OF STOCK" : `${product.quantity} units`}
                          </span>
                        </div>
                      </div>
                      
                      <h4 className={cn(
                        "text-[13px] font-bold mb-0.5 truncate uppercase tracking-tight",
                        isOutOfStock ? "text-slate-400 line-through" : "text-slate-900"
                      )}>{product.name}</h4>
                      <p className="text-[9px] text-slate-400 font-medium mb-4 uppercase tracking-tighter opacity-60">SKU: {product.sku}</p>
                      
                      <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
                        <p className={cn("text-base font-black", isOutOfStock ? "text-slate-400" : "text-emerald-600")}>
                          {currency} {(product.sellingPrice || product.value || 0).toLocaleString()}
                        </p>
                        <button 
                          onClick={() => addToCart(product)}
                          disabled={isOutOfStock}
                          className={cn(
                            "rounded-lg w-9 h-9 flex items-center justify-center shadow-md transition-all",
                            isOutOfStock 
                              ? "bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed shadow-none"
                              : "bg-[#0F172A] text-white hover:bg-emerald-600 hover:scale-105 active:scale-95"
                          )}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Cart Toggle */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button 
          onClick={() => {
            const aside = document.querySelector('aside');
            if (aside) {
              aside.classList.toggle('hidden');
              aside.classList.toggle('fixed');
              aside.classList.toggle('inset-0');
              aside.classList.toggle('z-[60]');
            }
          }}
          className="w-14 h-14 bg-[#0F172A] text-white rounded-2xl shadow-xl flex items-center justify-center relative active:scale-95 transition-transform"
        >
          <ShoppingCart className="w-6 h-6" />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#0F172A]">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* Success Notification */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex flex-col items-center gap-3 border-4 border-white pointer-events-auto">
               <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
               </div>
               <div className="text-center">
                  <h3 className="text-lg font-bold uppercase">Sale Successful!</h3>
                  <p className="text-[10px] font-medium opacity-80 uppercase tracking-widest mt-0.5">Receipt recorded & stock updated</p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kenya Tax Invoice & Receipt Print Dialog */}
      <AnimatePresence>
        {completedSale && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <style>{`
              @media print {
                body {
                  visibility: hidden !important;
                }
                #printable-area, #printable-area * {
                  visibility: visible !important;
                }
                #printable-area {
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
                ${printType === 'receipt' ? `
                  #printable-area {
                    width: 76mm !important;
                    max-width: 76mm !important;
                    font-size: 11px !important;
                    line-height: 1.2 !important;
                    padding: 5px !important;
                  }
                  .no-print-thermal {
                    display: none !important;
                  }
                ` : ''}
              }
            `}</style>
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-8 flex flex-col md:flex-row h-[85vh]"
            >
              {/* Left Column: Action controls (hidden on print anyway) */}
              <div className="p-8 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-between md:w-[350px] bg-slate-50 shrink-0">
                <div className="space-y-6">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <CheckCircle2 className="w-3 h-3" /> Checkout Success
                    </span>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-3">Print Documents</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1 font-sans">Select document layout below.</p>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => setPrintType('receipt')}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all text-left",
                        printType === 'receipt'
                          ? "bg-[#0F172A] border-[#0F172A] text-white shadow-md shadow-slate-900/10"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <Receipt className="w-4 h-4" />
                      Thermal Receipt (76mm)
                    </button>
                    <button
                      onClick={() => setPrintType('invoice')}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all text-left",
                        printType === 'invoice'
                          ? "bg-[#0F172A] border-[#0F172A] text-white shadow-md shadow-slate-900/10"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <FileText className="w-4 h-4" />
                      Standard Sales Invoice (A4)
                    </button>
                  </div>


                </div>

                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <button
                    onClick={handlePrintPOS}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 shadow-emerald-950/10"
                  >
                    <Printer className="w-4 h-4" />
                    Print Current
                  </button>
                  <button
                    onClick={() => setCompletedSale(null)}
                    className="w-full h-12 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Close & New Sale
                  </button>
                </div>
              </div>

              {/* Right Column: Visual Preview of printed content */}
              <div className="flex-1 bg-slate-100 p-6 overflow-y-auto no-scrollbar flex justify-center items-start">
                <div 
                  id="printable-area" 
                  className={cn(
                    "bg-white shadow-lg border border-slate-200 font-sans text-slate-900",
                    printType === 'receipt' 
                      ? "w-[320px] p-6 text-xs text-left leading-relaxed divide-y divide-dashed divide-slate-300"
                      : "w-[100%] max-w-[650px] p-10 text-xs text-left"
                  )}
                >
                  {printType === 'receipt' ? (
                    // THERMAL RECEIPT PREVIEW (76mm style)
                    <div className="space-y-4">
                      <div className="text-center space-y-1 pb-4">
                        <h2 className="text-base font-black uppercase tracking-tight">{company?.name || 'INVENTORYPRO CO.'}</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{company?.address || 'Nairobi, Kenya'}</p>
                        <p className="text-[10px] font-medium text-slate-500">{company?.phone || '+254 700 000 000'}</p>

                        <p className="text-[11px] font-black uppercase tracking-widest border border-slate-900 px-2 py-0.5 mt-2 inline-block">Sales Invoice</p>
                      </div>

                      <div className="space-y-1 py-3 text-[10px]">
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">RECEIPT NO:</span>
                          <span className="font-bold text-slate-800">{completedSale.receiptId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">INVOICE REF:</span>
                          <span className="font-bold text-slate-800">{completedSale.invoiceId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">DATE & TIME:</span>
                          <span className="font-bold text-slate-800">{new Date(completedSale.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">CASHIER:</span>
                          <span className="font-bold text-slate-800">{userName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">CUSTOMER:</span>
                          <span className="font-bold text-slate-800">{completedSale.customerName}</span>
                        </div>
                      </div>

                      <div className="py-3">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-dashed border-slate-300 text-slate-500 font-bold">
                              <th className="pb-1 uppercase">Item</th>
                              <th className="pb-1 text-center uppercase">Qty</th>
                              <th className="pb-1 text-right uppercase">Price</th>
                              <th className="pb-1 text-right uppercase">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-dashed divide-slate-100">
                            {completedSale.items.map((item: any, i: number) => (
                              <tr key={i} className="text-slate-800">
                                <td className="py-2 pr-2 font-semibold">
                                  {item.name}
                                  {item.sku && <span className="block text-[8px] text-slate-400 font-mono">SKU: {item.sku}</span>}
                                </td>
                                <td className="py-2 text-center font-bold">{item.quantity}</td>
                                <td className="py-2 text-right font-medium">{currency}{(item.price).toLocaleString()}</td>
                                <td className="py-2 text-right font-bold">{currency}{(item.price * item.quantity).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="py-3 space-y-1.5 border-t border-dashed border-slate-300">
                        <div className="flex justify-between text-slate-600">
                          <span className="font-semibold">Subtotal (VAT Excl.):</span>
                          <span className="font-bold">{currency}{(completedSale.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="font-semibold">VAT (16% Rate A):</span>
                          <span className="font-bold">{currency}{(completedSale.tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200">
                          <span>TOTAL PAID:</span>
                          <span>{currency}{(completedSale.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      <div className="py-4 text-center">
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          Thank you for shopping with us!<br />
                          M-Pesa / Cash sale confirmed.
                        </div>
                      </div>
                    </div>
                  ) : (
                    // BUSINESS SALES INVOICE PREVIEW (A4 style)
                    <div className="space-y-8 font-sans">
                      {/* Logo and Invoice Title */}
                      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                        <div>
                          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{company?.name || 'INVENTORYPRO CO.'}</h1>
                          <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">{company?.address || 'Nairobi, Kenya'}</p>
                          <p className="text-slate-500 font-semibold text-[10px]">{company?.phone || '+254 700 000 000'}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-4 py-1.5 bg-slate-900 text-white font-black text-sm uppercase tracking-widest">Sales Invoice</span>
                          <p className="text-xs font-mono font-bold text-slate-700 mt-2">INVOICE NO: {completedSale.invoiceId}</p>
                        </div>
                      </div>

                      {/* Buyer Details */}
                      <div className="py-4">
                        <div className="space-y-1.5 max-w-md">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buyer Details</h4>
                          <div className="text-[11px] space-y-1">
                            <p className="font-bold text-slate-900 text-sm">{completedSale.customerName}</p>
                            <p className="font-semibold text-slate-600">PIN: <strong className="text-slate-400">Not Provided (Walk-in Customer)</strong></p>
                            <p className="text-slate-600">Payment Status: <strong className="text-emerald-600 uppercase">FULLY PAID (POS)</strong></p>
                          </div>
                        </div>
                      </div>

                      {/* Invoice Metadata Box */}
                      <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl text-[11px]">
                        <div>
                          <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Date of Issue</p>
                          <p className="font-black text-slate-800 mt-0.5">{completedSale.date}</p>
                        </div>
                        <div>
                          <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Due Date</p>
                          <p className="font-black text-slate-800 mt-0.5">{completedSale.date}</p>
                        </div>
                        <div>
                          <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Payment Method</p>
                          <p className="font-black text-slate-800 mt-0.5 uppercase">{completedSale.paymentMethod}</p>
                        </div>
                        <div>
                          <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Currency</p>
                          <p className="font-black text-slate-800 mt-0.5 uppercase">{currency} (KES)</p>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div>
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
                            {completedSale.items.map((item: any, i: number) => (
                              <tr key={i} className="text-slate-800 font-medium">
                                <td className="py-4 font-bold text-slate-900">{item.name}</td>
                                <td className="py-4 font-mono text-[10px] text-slate-500">{item.sku || 'N/A'}</td>
                                <td className="py-4 text-center font-bold">{item.quantity}</td>
                                <td className="py-4 text-right font-semibold">{currency}{(item.price).toLocaleString()}</td>
                                <td className="py-4 text-center font-bold text-slate-600">Rate A (16%)</td>
                                <td className="py-4 text-right font-black text-slate-900">{currency}{(item.price * item.quantity).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Summaries & Calculations breakdown */}
                      <div className="flex justify-end pt-6 border-t border-slate-200">
                        {/* Calculations Breakdown */}
                        <div className="space-y-2 text-right w-full max-w-xs">
                          <div className="flex justify-between text-slate-500 text-[11px] font-semibold">
                            <span>Subtotal (VAT Exclusive)</span>
                            <span>{currency}{(completedSale.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[11px] font-semibold">
                            <span>Tax Base (Rate A - 16%)</span>
                            <span>{currency}{(completedSale.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[11px] font-semibold">
                            <span>VAT Total Amount (16%)</span>
                            <span>{currency}{(completedSale.tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-slate-900 text-sm font-black pt-2 border-t-2 border-slate-900">
                            <span>Grand Total (VAT Inclusive)</span>
                            <span>{currency}{(completedSale.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Held Carts Modal */}
      <AnimatePresence>
        {showHeldModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-6"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Pause className="w-5 h-5 text-emerald-600" />
                  Held Carts ({heldCarts.length})
                </h3>
                <button 
                  onClick={() => setShowHeldModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[400px] py-4 space-y-3 no-scrollbar">
                {heldCarts.map((hc) => (
                  <div key={hc.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center gap-4 hover:border-emerald-500/30 transition-all">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700">
                        {hc.items.length} {hc.items.length === 1 ? 'item' : 'items'} • {hc.items.slice(0, 2).map((item: any) => item.name).join(', ')}{hc.items.length > 2 && '...'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">
                        Held at {new Date(hc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(hc.timestamp).toLocaleDateString()}
                      </p>
                      <p className="text-xs font-black text-emerald-600 mt-1">
                        {currency} {hc.total.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => handleRestoreCart(hc.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                      >
                        Restore
                      </button>
                      <button 
                        onClick={() => handleDeleteHeldCart(hc.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {heldCarts.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Pause className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-bold">No held carts available</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
