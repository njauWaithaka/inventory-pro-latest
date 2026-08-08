import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, 
  Banknote, Receipt, Package, Loader2, CheckCircle2,
  Scan, Pause, RotateCcw, Smartphone, X, FileText,
  Percent, Coins, UserCheck, AlertCircle, Sparkles,
  Camera, Keyboard, ArrowRight, ShieldCheck, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../lib/utils';

interface CartItem {
  id: string;
  name: string;
  price: number;
  buyingPrice?: number;
  sellingPrice?: number;
  quantity: number;
  image?: string;
  category?: string;
  sku?: string;
}

export function POS() {
  const { user } = useAuth();
  const { profile, currency } = useSettings();
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

  // Customer & POS Tender Enhancements
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [cashTendered, setCashTendered] = useState<number | ''>('');
  const [mpesaCode, setMpesaCode] = useState('');

  // Scanner Modal
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);

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

  // Products Subscription
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

  const handlePrintPOS = () => {
    window.print();
  };

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const getBuyingPrice = (product: any): number => {
    if (typeof product?.buyingPrice === 'number' && product.buyingPrice > 0) return product.buyingPrice;
    if (typeof product?.value === 'number' && product.value > 0) return product.value;
    return 0;
  };

  const getSellingPrice = (product: any): number => {
    if (typeof product?.sellingPrice === 'number' && product.sellingPrice > 0) return product.sellingPrice;
    if (typeof product?.price === 'number' && product.price > 0) return product.price;
    const buy = getBuyingPrice(product);
    return buy > 0 ? buy * 1.3 : 0;
  };

  const filteredProducts = products.filter(p => {
    const name = p.name || '';
    const sku = p.sku || '';
    const barcode = p.barcode || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          barcode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const quickAccessProducts = products.slice(0, 10);

  const addToCart = (product: any, qty: number = 1) => {
    const availableQty = typeof product.quantity === 'number' ? product.quantity : 0;
    if (availableQty <= 0) return; // Out of stock

    const sellPrice = getSellingPrice(product);
    const buyPrice = getBuyingPrice(product);

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
        price: sellPrice,
        sellingPrice: sellPrice,
        buyingPrice: buyPrice,
        quantity: Math.min(availableQty, qty),
        category: product.category,
        sku: product.sku,
        ...(product.image ? { image: product.image } : {})
      }];
    });
  };

  const setItemQuantityDirect = (id: string, newQty: number) => {
    const product = products.find(p => p.id === id);
    const availableQty = product ? (typeof product.quantity === 'number' ? product.quantity : 0) : 999999;
    
    if (isNaN(newQty) || newQty < 1) return;
    const clamped = Math.min(availableQty, newQty);

    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: clamped } : item));
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

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    const newHeldCart = {
      id: `held_${Date.now()}`,
      items: cart,
      customerName,
      customerPhone,
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
    if (selected.customerName) setCustomerName(selected.customerName);
    if (selected.customerPhone) setCustomerPhone(selected.customerPhone);
    setHeldCarts(prev => prev.filter(hc => hc.id !== heldId));
    setShowHeldModal(false);
  };

  const handleDeleteHeldCart = (heldId: string) => {
    setHeldCarts(prev => prev.filter(hc => hc.id !== heldId));
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus Search: F2 or Ctrl+K or '/'
      if (e.key === 'F2' || (e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement !== searchInputRef.current)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      // Complete Sale: Ctrl+Enter
      if (e.ctrlKey && e.key === 'Enter') {
        if (cart.length > 0 && !isProcessing) {
          handleCheckout(paymentMethod);
        }
        return;
      }
      // Escape: Close modals
      if (e.key === 'Escape') {
        setShowCustomerModal(false);
        setShowHeldModal(false);
        setShowScannerModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isProcessing, paymentMethod]);

  // Search Submit (Enter) -> Auto-add if exact match or 1 result
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      const term = searchQuery.trim().toLowerCase();
      // Look for exact SKU or Barcode match first
      const exactMatch = products.find(p => 
        (p.sku && p.sku.toLowerCase() === term) || 
        (p.barcode && p.barcode.toLowerCase() === term) ||
        (p.name && p.name.toLowerCase() === term)
      );

      if (exactMatch) {
        addToCart(exactMatch);
        setSearchQuery('');
      } else if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
        setSearchQuery('');
      }
    }
  };

  // Barcode Scanner Modal Submit
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const term = barcodeInput.trim().toLowerCase();
    const matched = products.find(p => 
      (p.barcode && p.barcode.toLowerCase() === term) ||
      (p.sku && p.sku.toLowerCase() === term) ||
      (p.name && p.name.toLowerCase().includes(term))
    );

    if (matched) {
      addToCart(matched);
      setBarcodeInput('');
    }
  };

  // Calculations
  const rawTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = (rawTotal * discountPercent) / 100;
  const total = Math.max(0, rawTotal - discountAmount);
  const tax = total * 16 / 116; // 16% VAT Included
  const subtotal = total - tax; // VAT Exclusive Subtotal

  const numericTendered = typeof cashTendered === 'number' ? cashTendered : 0;
  const changeDue = paymentMethod === 'cash' && numericTendered > total ? numericTendered - total : 0;
  const isCashInsufficient = paymentMethod === 'cash' && cashTendered !== '' && numericTendered < total;

  const handleCheckout = async (method: string) => {
    if (!user || !profile?.companyId || cart.length === 0) return;
    if (isCashInsufficient) return;

    setIsProcessing(true);
    try {
      const finalCustName = customerName.trim() || 'Walk-in Customer';
      const receiptData = {
        customerName: finalCustName,
        customerPhone: customerPhone.trim() || '',
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          sku: item.sku || '',
          ...(item.image ? { image: item.image } : {})
        })),
        rawTotal,
        discountPercent,
        discountAmount,
        subtotal,
        tax,
        total,
        cashTendered: method === 'cash' ? (numericTendered || total) : total,
        changeDue: method === 'cash' ? changeDue : 0,
        paymentMethod: method,
        mpesaCode: method === 'mpesa' ? mpesaCode : '',
        timestamp: serverTimestamp(),
        status: 'PAID',
        type: 'receipt',
        currency: currency
      };
      
      // 1. Create Receipt
      const receiptRef = await addDoc(collection(db, `companies/${profile.companyId}/receipts`), receiptData);
      const receiptId = receiptRef.id;

      // 2. Reduce Inventory & Write Movements & Write Sales
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

        // Unified Sale Record
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
          customerId: finalCustName,
          createdAt: new Date().toISOString(),
          timestamp: serverTimestamp(),
        });

        // Stock Movement
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
          transactionId: movementId,
          transactionType: 'Sale',
          previousStock: beforeQty,
          newStock: finalQty,
          reason: `POS Sale - Receipt #${receiptId}`,
          userId: user.uid,
          timestamp: serverTimestamp(),
        });
      }

      // 3. Generate Delivery Note
      const deliveryNoteId = `DN-POS-${Date.now()}`;
      await setDoc(doc(db, `companies/${profile.companyId}/deliveryNotes`, deliveryNoteId), {
        id: deliveryNoteId,
        orderId: receiptId,
        customer: finalCustName,
        date: new Date().toISOString().split('T')[0],
        status: 'delivered',
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

      // 4. Generate Paid Invoice
      const invoiceId = `INV-POS-${Date.now()}`;
      const invoiceData = {
        id: invoiceId,
        customer: finalCustName,
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
        customerName: finalCustName,
        customerPhone: customerPhone.trim(),
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          sku: item.sku || ''
        })),
        rawTotal,
        discountPercent,
        discountAmount,
        subtotal,
        tax,
        total,
        cashTendered: method === 'cash' ? (numericTendered || total) : total,
        changeDue: method === 'cash' ? changeDue : 0,
        paymentMethod: method,
        mpesaCode: method === 'mpesa' ? mpesaCode : '',
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date()
      });

      setCart([]);
      setCashTendered('');
      setMpesaCode('');
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
    <div className="h-[calc(100vh-64px)] bg-[#F8FAFC] font-sans overflow-hidden">
      <div className="max-w-[1700px] mx-auto h-full p-2.5 sm:p-4 grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] gap-3 sm:gap-4">
        
        {/* ========================================== */}
        {/* LEFT PANEL: CART & CHECKOUT ENGINE          */}
        {/* ========================================== */}
        <aside className="flex flex-col h-full min-h-0 bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Cart Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-xs">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 leading-tight">Current Basket</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{cart.reduce((s, i) => s + i.quantity, 0)} Items</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleHoldCart}
                disabled={cart.length === 0}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 uppercase tracking-wider transition-all disabled:opacity-30 flex items-center gap-1 shadow-2xs"
                title="Hold Basket"
              >
                <Pause className="w-3 h-3 text-amber-500" />
                Hold
              </button>

              <button 
                onClick={() => setShowHeldModal(true)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 uppercase tracking-wider transition-all flex items-center gap-1 shadow-2xs relative"
                title="View Held Baskets"
              >
                <RotateCcw className="w-3 h-3 text-blue-500" />
                Held {heldCarts.length > 0 && <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[9px] rounded-full">{heldCarts.length}</span>}
              </button>

              <button 
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-30"
                title="Clear Cart"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Customer Bar */}
          <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200/60 flex items-center justify-between shrink-0">
            <button 
              onClick={() => setShowCustomerModal(true)}
              className="flex items-center gap-2 text-left hover:text-emerald-600 transition-colors min-w-0 flex-1 group"
            >
              <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center border border-slate-200 shrink-0 text-slate-600 group-hover:border-emerald-500 group-hover:text-emerald-600 shadow-2xs">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-tight">Customer</p>
                <p className="text-xs font-bold text-slate-900 truncate">{customerName}</p>
              </div>
            </button>

            <button 
              onClick={() => setShowCustomerModal(true)}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-wider transition-all shadow-2xs"
            >
              Select
            </button>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
            <AnimatePresence mode="popLayout">
              {cart.map((item) => {
                const prod = products.find(p => p.id === item.id);
                const maxStock = prod ? (typeof prod.quantity === 'number' ? prod.quantity : 0) : 999999;
                const isMax = item.quantity >= maxStock;

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={item.id}
                    className="p-2.5 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-all shadow-2xs group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-200/70 shrink-0">
                          {item.image ? (
                            <img src={item.image} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate leading-tight">{item.name}</h4>
                          <p className="text-[10px] text-slate-500 font-semibold font-mono mt-0.5">
                            {currency} {item.price.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-slate-900">{currency} {(item.price * item.quantity).toLocaleString()}</p>
                        {isMax && (
                          <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Max Stock</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
                      {/* Editable Quantity Bar */}
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden h-7">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="px-2 hover:bg-slate-200 text-slate-700 transition-colors border-r border-slate-200 h-full flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        
                        <input
                          type="number"
                          min="1"
                          max={maxStock}
                          value={item.quantity}
                          onChange={(e) => setItemQuantityDirect(item.id, parseInt(e.target.value) || 1)}
                          className="w-10 text-[11px] font-black text-center text-slate-900 bg-transparent outline-none focus:bg-white"
                        />

                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          disabled={isMax}
                          className={cn(
                            "px-2 transition-colors border-l border-slate-200 h-full flex items-center justify-center",
                            isMax ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "hover:bg-slate-200 text-slate-700"
                          )}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {cart.length === 0 && (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/40">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xs border border-slate-200 mb-3 text-slate-300">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cart is Empty</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">Click products on the right or press <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[9px] font-mono font-bold text-slate-700">F2</kbd> or <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[9px] font-mono font-bold text-slate-700">/</kbd> to search</p>
              </div>
            )}
          </div>

          {/* Cart Footer & Calculations */}
          <div className="p-3.5 bg-slate-50/90 border-t border-slate-200 space-y-3 shrink-0">
            
            {/* Discount selector */}
            <div className="p-2.5 bg-white border border-slate-200/80 rounded-xl space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span className="flex items-center gap-1 text-slate-700"><Percent className="w-3 h-3 text-emerald-600" /> Discount</span>
                {discountPercent > 0 && (
                  <span className="text-emerald-600 font-black">-{currency} {discountAmount.toLocaleString()} ({discountPercent}%)</span>
                )}
              </div>
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {[0, 5, 10, 15, 20].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setDiscountPercent(pct)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border shrink-0",
                      discountPercent === pct
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {pct === 0 ? 'None' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Totals Breakdown */}
            <div className="space-y-1 pt-0.5">
              {discountPercent > 0 && (
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 line-through">
                  <span>Subtotal Before Discount</span>
                  <span>{currency} {rawTotal.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Subtotal (Excl. VAT)</span>
                <span>{currency} {subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>VAT (16% Included)</span>
                <span>{currency} {tax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                <span className="text-base font-black text-slate-900 uppercase tracking-wider">TOTAL</span>
                <span className="text-2xl font-black text-emerald-600">
                  {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-4 gap-1.5">
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
                    "flex flex-col items-center justify-center gap-1 h-11 rounded-xl border transition-all",
                    paymentMethod === method.id 
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs font-bold" 
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <method.icon className={cn("w-3.5 h-3.5", paymentMethod === method.id ? "text-white" : "text-slate-500")} />
                  <span className="text-[9px] font-bold uppercase tracking-tighter">{method.label}</span>
                </button>
              ))}
            </div>

            {/* Cash Tendered Input Helper */}
            {paymentMethod === 'cash' && cart.length > 0 && (
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-amber-500" /> Amount Received</span>
                  {changeDue > 0 && (
                    <span className="text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Change: {currency} {changeDue.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{currency}</span>
                    <input
                      type="number"
                      placeholder={total.toString()}
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full h-8 pl-8 pr-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button 
                    onClick={() => setCashTendered(total)}
                    className="px-2.5 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors shrink-0"
                  >
                    Exact
                  </button>
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                  {[500, 1000, 2000, 5000].map(val => (
                    <button
                      key={val}
                      onClick={() => setCashTendered(val)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-600 rounded text-[9px] font-bold font-mono transition-all shrink-0"
                    >
                      +{val}
                    </button>
                  ))}
                </div>

                {isCashInsufficient && (
                  <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Insufficient cash amount entered
                  </p>
                )}
              </div>
            )}

            {/* M-Pesa Ref Code */}
            {paymentMethod === 'mpesa' && cart.length > 0 && (
              <div className="p-2.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-1 animate-in fade-in duration-150">
                <label className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-emerald-600" /> M-Pesa Transaction Ref Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. QK89X0P1"
                  value={mpesaCode}
                  onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                  className="w-full h-8 px-2.5 bg-white border border-emerald-200 rounded-lg text-xs font-mono font-bold text-slate-900 uppercase outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Primary CTA: COMPLETE SALE */}
            <button
              onClick={() => handleCheckout(paymentMethod)}
              disabled={cart.length === 0 || isProcessing || isCashInsufficient}
              className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-wider shadow-md hover:bg-emerald-600 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>COMPLETE SALE</span>
                  <span className="text-[11px] font-black font-mono bg-slate-800 group-hover:bg-emerald-800 px-2 py-0.5 rounded text-white ml-1">
                    {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* ========================================== */}
        {/* RIGHT PANEL: PRODUCT SEARCH & DENSE GRID   */}
        {/* ========================================== */}
        <div className="min-w-0 flex flex-col h-full min-h-0 bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Header & Prominent Search Bar */}
          <div className="p-3.5 sm:p-5 border-b border-slate-100 space-y-3 shrink-0 bg-white">
            
            {/* Secondary Compact Info Bar */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>Point of Sale</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 uppercase tracking-widest">Live Shift</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {userName} • Sandbox Retail System
                </p>
              </div>

              {/* Compact Metrics */}
              <div className="flex items-center gap-2">
                <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 flex items-center gap-2">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Today Sales</p>
                    <p className="text-xs font-black text-slate-900 leading-none">{currency} {todaySales.toLocaleString()}</p>
                  </div>
                </div>

                <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Orders</p>
                    <p className="text-xs font-black text-slate-900 leading-none">{todayOrdersCount}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Prominent Search Bar with Barcode Scan CTA */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search product name, SKU, or barcode... (Press Enter to add)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full h-11 pl-10 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.5 rounded pointer-events-none">
                  F2 / /
                </span>
              </div>

              <button 
                onClick={() => setShowScannerModal(true)}
                className="h-11 px-4 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-wider transition-all shadow-sm shrink-0"
              >
                <Scan className="w-4 h-4" />
                <span className="hidden sm:inline">SCAN</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all shrink-0 border",
                    activeCategory === cat 
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs" 
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid Area */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 no-scrollbar">
            
            {/* Quick Access Row */}
            {quickAccessProducts.length > 0 && searchQuery === '' && activeCategory === 'All' && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" /> Fast Pick Products
                  </h3>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">1-Click Add</span>
                </div>
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                  {quickAccessProducts.map(product => {
                    const isOutOfStock = (product.quantity || 0) <= 0;
                    return (
                      <button 
                        key={product.id}
                        onClick={() => addToCart(product)}
                        disabled={isOutOfStock}
                        className={cn(
                          "min-w-[130px] max-w-[150px] bg-white border p-2.5 rounded-xl shadow-2xs hover:shadow-xs transition-all text-left flex flex-col group relative overflow-hidden shrink-0",
                          isOutOfStock 
                            ? "border-slate-200 bg-slate-50/50 opacity-60 cursor-not-allowed" 
                            : "border-slate-200 hover:border-emerald-500"
                        )}
                      >
                        <h4 className="text-xs font-bold text-slate-900 truncate uppercase">{product.name}</h4>
                        
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-wider block mt-1",
                          isOutOfStock 
                            ? "text-rose-600 font-black" 
                            : product.quantity <= (product.reorderPoint ?? product.minStock ?? 10) 
                              ? "text-amber-600 font-black" 
                              : "text-slate-400"
                        )}>
                          {isOutOfStock ? "Out of Stock" : `Stock: ${product.quantity}`}
                        </span>

                        <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between">
                          <p className={cn("text-xs font-black", isOutOfStock ? "text-slate-400" : "text-emerald-600")}>
                            {currency} {getSellingPrice(product).toLocaleString()}
                          </p>
                          <div className="w-5 h-5 bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white rounded-md flex items-center justify-center transition-colors">
                            <Plus className="w-3 h-3" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dense Main Product Grid */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                  Product Catalogue ({filteredProducts.length})
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {filteredProducts.map(product => {
                  const isOutOfStock = (product.quantity || 0) <= 0;
                  const isLowStock = !isOutOfStock && product.quantity <= (product.reorderPoint ?? product.minStock ?? 10);

                  return (
                    <div 
                      key={product.id} 
                      onClick={() => !isOutOfStock && addToCart(product)}
                      className={cn(
                        "bg-white border rounded-xl p-3 flex flex-col shadow-2xs group transition-all relative overflow-hidden cursor-pointer",
                        isOutOfStock 
                          ? "border-slate-200 bg-slate-50/60 opacity-60 cursor-not-allowed" 
                          : "border-slate-200/90 hover:border-emerald-500 hover:shadow-xs active:scale-[0.98]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider truncate">
                          {product.category || 'General'}
                        </span>
                        
                        {/* Stock Badge */}
                        <span className={cn(
                          "text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0",
                          isOutOfStock 
                            ? "text-rose-700 bg-rose-50 border border-rose-200" 
                            : isLowStock 
                              ? "text-amber-700 bg-amber-50 border border-amber-200" 
                              : "text-emerald-700 bg-emerald-50 border border-emerald-200"
                        )}>
                          {isOutOfStock ? "OUT OF STOCK" : isLowStock ? `LOW: ${product.quantity}` : `Stock: ${product.quantity}`}
                        </span>
                      </div>

                      <h4 className={cn(
                        "text-xs font-bold truncate leading-tight uppercase",
                        isOutOfStock ? "text-slate-400 line-through" : "text-slate-900"
                      )}>
                        {product.name}
                      </h4>
                      <p className="text-[9px] text-slate-400 font-mono truncate mt-0.5">SKU: {product.sku || 'N/A'}</p>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block leading-none">Selling Price</span>
                          <p className={cn("text-xs sm:text-sm font-black mt-0.5", isOutOfStock ? "text-slate-400" : "text-emerald-600")}>
                            {currency} {getSellingPrice(product).toLocaleString()}
                          </p>
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          disabled={isOutOfStock}
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-2xs shrink-0",
                            isOutOfStock 
                              ? "bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed"
                              : "bg-slate-900 text-white hover:bg-emerald-600 active:scale-95"
                          )}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredProducts.length === 0 && (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Package className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600">No matching products found</p>
                  <p className="text-[10px] text-slate-400">Try adjusting your search query or category filter</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODALS & NOTIFICATIONS                     */}
      {/* ========================================== */}

      {/* Barcode Scanner Modal */}
      <AnimatePresence>
        {showScannerModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-6 space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Scan className="w-5 h-5 text-emerald-600" />
                  Barcode / SKU Scanner
                </h3>
                <button 
                  onClick={() => setShowScannerModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleBarcodeSubmit} className="space-y-4">
                <p className="text-xs text-slate-500 font-medium">
                  Scan barcode using USB handheld scanner or type barcode number directly:
                </p>

                <div className="relative">
                  <input
                    ref={scannerInputRef}
                    autoFocus
                    type="text"
                    placeholder="Scan or enter barcode / SKU..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full h-12 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                  <Keyboard className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScannerModal(false)}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    Done
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
                  >
                    Add to Cart
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customer Details Modal */}
      <AnimatePresence>
        {showCustomerModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-6 space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  Select / Add Customer
                </h3>
                <button 
                  onClick={() => setShowCustomerModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Customer Name / Business
                  </label>
                  <input
                    type="text"
                    placeholder="Walk-in Customer"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="+254 700 000000"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setCustomerName('Walk-in Customer');
                      setCustomerPhone('');
                    }}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    Walk-in Default
                  </button>
                  <button
                    onClick={() => setShowCustomerModal(false)}
                    className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
                  >
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Held Carts Modal */}
      <AnimatePresence>
        {showHeldModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-6 space-y-4 max-h-[80vh]"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-blue-600" />
                  Held Baskets ({heldCarts.length})
                </h3>
                <button 
                  onClick={() => setShowHeldModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {heldCarts.map((hc) => (
                  <div key={hc.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{hc.customerName || 'Walk-in Customer'}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {hc.items?.length || 0} items • {currency} {hc.total?.toLocaleString() || 0}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{new Date(hc.timestamp).toLocaleTimeString()}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleRestoreCart(hc.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-2xs"
                      >
                        Restore
                      </button>
                      <button 
                        onClick={() => handleDeleteHeldCart(hc.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {heldCarts.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-8">No held baskets available</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sale Success Notification */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex flex-col items-center gap-2 border-4 border-white pointer-events-auto">
               <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
               </div>
               <div className="text-center">
                  <h3 className="text-lg font-bold uppercase tracking-wider">Sale Completed!</h3>
                  <p className="text-[10px] font-medium opacity-90 uppercase tracking-widest mt-0.5">Receipt generated & inventory updated</p>
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
              {/* Left Column: Action controls */}
              <div className="p-6 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-between md:w-[320px] bg-slate-50 shrink-0">
                <div className="space-y-5">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Checkout Success
                    </span>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-3">Print Documents</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">Select document layout below.</p>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => setPrintType('receipt')}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all text-left",
                        printType === 'receipt'
                          ? "bg-slate-900 border-slate-900 text-white shadow-md"
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
                          ? "bg-slate-900 border-slate-900 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <FileText className="w-4 h-4" />
                      Standard Sales Invoice (A4)
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-200">
                  <button
                    onClick={handlePrintPOS}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                  >
                    <Receipt className="w-4 h-4" /> Print Document
                  </button>
                  <button
                    onClick={() => setCompletedSale(null)}
                    className="w-full h-10 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Next Sale
                  </button>
                </div>
              </div>

              {/* Right Column: Print Preview */}
              <div className="flex-1 bg-slate-200/50 p-6 overflow-y-auto flex items-start justify-center">
                <div id="printable-area" className="bg-white p-6 shadow-xl border border-slate-200 rounded-2xl w-full max-w-[400px] text-xs font-mono">
                  <div className="text-center pb-4 border-b border-dashed border-slate-300 space-y-1">
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">{profile?.companyName || 'RETAIL POS STORE'}</h2>
                    <p className="text-[10px] text-slate-500 font-sans">Official Sales Receipt</p>
                    <p className="text-[10px] text-slate-400 font-mono">Receipt #: {completedSale.receiptId}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Date: {new Date().toLocaleString()}</p>
                  </div>

                  <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Customer:</span>
                      <span className="font-bold text-slate-900">{completedSale.customerName}</span>
                    </div>
                    {completedSale.customerPhone && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Phone:</span>
                        <span className="font-bold text-slate-900">{completedSale.customerPhone}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cashier:</span>
                      <span className="font-bold text-slate-900">{userName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment:</span>
                      <span className="font-bold uppercase text-emerald-600">{completedSale.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="py-3 space-y-2 border-b border-dashed border-slate-300">
                    <div className="flex justify-between font-bold text-[10px] text-slate-400 uppercase tracking-wider">
                      <span>Item</span>
                      <span>Qty x Price</span>
                      <span>Total</span>
                    </div>
                    {completedSale.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-[11px]">
                        <span className="font-bold text-slate-900 max-w-[150px] truncate">{item.name}</span>
                        <span className="text-slate-500">{item.quantity} x {item.price.toLocaleString()}</span>
                        <span className="font-bold text-slate-900">{currency}{(item.quantity * item.price).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="py-3 space-y-1.5 border-b border-dashed border-slate-300">
                    {completedSale.discountAmount > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>Subtotal Before Discount:</span>
                        <span>{currency}{(completedSale.rawTotal || completedSale.total).toLocaleString()}</span>
                      </div>
                    )}
                    {completedSale.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-semibold">
                        <span>Discount ({completedSale.discountPercent}%):</span>
                        <span>-{currency}{(completedSale.discountAmount).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal (Excl. VAT):</span>
                      <span>{currency}{(completedSale.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>VAT (16% Included):</span>
                      <span>{currency}{(completedSale.tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200">
                      <span>TOTAL PAID:</span>
                      <span>{currency}{(completedSale.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {completedSale.paymentMethod === 'cash' && completedSale.cashTendered > 0 && (
                      <>
                        <div className="flex justify-between text-slate-600 pt-1 text-[11px]">
                          <span>Cash Tendered:</span>
                          <span className="font-bold">{currency}{(completedSale.cashTendered).toLocaleString()}</span>
                        </div>
                        {completedSale.changeDue > 0 && (
                          <div className="flex justify-between text-emerald-700 font-black text-[11px]">
                            <span>Change Returned:</span>
                            <span>{currency}{(completedSale.changeDue).toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}
                    {completedSale.paymentMethod === 'mpesa' && completedSale.mpesaCode && (
                      <div className="flex justify-between text-slate-700 font-mono text-[10px] pt-1">
                        <span>M-Pesa Ref:</span>
                        <span className="font-bold">{completedSale.mpesaCode}</span>
                      </div>
                    )}
                  </div>

                  <div className="py-4 text-center space-y-1">
                    <p className="text-[10px] font-bold text-slate-700 uppercase">Thank you for shopping with us!</p>
                    <p className="text-[9px] text-slate-400">Goods once sold are not returnable</p>
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
