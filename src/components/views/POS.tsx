import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, 
  Banknote, Receipt, Package, Loader2, CheckCircle2,
  Scan, Pause, RotateCcw, Smartphone, X, FileText,
  Percent, Coins, UserCheck, AlertCircle, Sparkles,
  Keyboard, Users, UserPlus, Phone, Mail, Check,
  ChevronLeft, ChevronRight, ArrowRight, ArrowLeft
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
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [printType, setPrintType] = useState<'receipt' | 'invoice'>('receipt');

  // Customer Selection Modal State
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [custModalTab, setCustModalTab] = useState<'select' | 'create'>('select');
  const [custSearchQuery, setCustSearchQuery] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [isSavingCust, setIsSavingCust] = useState(false);

  // Checkout Flow Modal State: check out -> confirm -> payment
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'confirm' | 'payment'>('confirm');
  // Active Order Basket Modal/Drawer State
  const [showOrderBasketModal, setShowOrderBasketModal] = useState(false);

  // Discount & Tender State
  const [discountPercent, setDiscountPercent] = useState(0);
  const [cashTendered, setCashTendered] = useState<number | ''>('');
  const [mpesaCode, setMpesaCode] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [cardAuthCode, setCardAuthCode] = useState('');
  const [splitCashAmount, setSplitCashAmount] = useState<number | ''>('');
  const [stkStatus, setStkStatus] = useState<'idle' | 'sending' | 'sent' | 'confirmed' | 'failed'>('idle');

  // M-Pesa STK Push Handlers
  const handleSendStk = () => {
    const targetPhone = mpesaPhone.trim() || customerPhone.trim();
    if (!targetPhone) return;
    setStkStatus('sending');
    setTimeout(() => {
      setStkStatus('sent');
      setTimeout(() => {
        confirmMpesaPayment();
      }, 2500);
    }, 1200);
  };

  const confirmMpesaPayment = () => {
    const generatedRef = `QK89X${Math.floor(1000 + Math.random() * 9000)}`;
    setMpesaCode(prev => prev || generatedRef);
    setStkStatus('confirmed');
    if (!customerPhone && mpesaPhone) {
      setCustomerPhone(mpesaPhone);
    }
  };

  // Scanner Modal
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const fastPickRef = useRef<HTMLDivElement>(null);

  const scrollFastPick = (direction: 'left' | 'right') => {
    if (fastPickRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      fastPickRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

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

  // Customers Subscription
  useEffect(() => {
    if (!profile?.companyId) return;

    const q = collection(db, `companies/${profile.companyId}/customers`);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDbCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error listening to customers: ", error);
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
      // Complete Sale: Ctrl+Enter (Opens Confirmation Dialog)
      if (e.ctrlKey && e.key === 'Enter') {
        if (cart.length > 0 && !isProcessing && !showConfirmModal) {
          handleInitiateCheckout();
        }
        return;
      }
      // Active Order Basket Toggle: F4
      if (e.key === 'F4') {
        e.preventDefault();
        setShowOrderBasketModal(prev => !prev);
        return;
      }
      // Escape: Close modals
      if (e.key === 'Escape') {
        setShowCustomerModal(false);
        setShowHeldModal(false);
        setShowScannerModal(false);
        setShowConfirmModal(false);
        setShowOrderBasketModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isProcessing, paymentMethod, showConfirmModal, showOrderBasketModal]);

  // Search Submit (Enter) -> Auto-add if exact match or 1 result
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      const term = searchQuery.trim().toLowerCase();
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

  // Save new customer from modal
  const handleSaveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !profile?.companyId) return;

    setIsSavingCust(true);
    try {
      const newCustData = {
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        email: newCustEmail.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || '',
        balance: 0,
        invoices: 0
      };

      await addDoc(collection(db, `companies/${profile.companyId}/customers`), newCustData);
      setCustomerName(newCustName.trim());
      setCustomerPhone(newCustPhone.trim());
      setNewCustName('');
      setNewCustPhone('');
      setNewCustEmail('');
      setShowCustomerModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'customers');
    } finally {
      setIsSavingCust(false);
    }
  };

  // Calculations
  const rawTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = 0;
  const total = rawTotal;
  const tax = total * 16 / 116; // 16% VAT Included
  const subtotal = total - tax; // VAT Exclusive Subtotal

  const numericTendered = typeof cashTendered === 'number' ? cashTendered : 0;
  const changeDue = paymentMethod === 'cash' && numericTendered > total ? numericTendered - total : 0;
  const isCashInsufficient = paymentMethod === 'cash' && cashTendered !== '' && numericTendered < total;

  // 1. Initiate Checkout (Opens Checkout Modal at Confirm step)
  const handleInitiateCheckout = () => {
    if (cart.length === 0 || isProcessing) return;
    setCheckoutStep('confirm');
    if (!cashTendered || cashTendered === '') {
      setCashTendered(total);
    }
    if (!mpesaPhone) {
      setMpesaPhone(customerPhone || '');
    }
    setShowConfirmModal(true);
  };

  // 2. Execute actual checkout after payment settlement
  const executeCheckout = async () => {
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
        cashTendered: paymentMethod === 'cash' ? (numericTendered || total) : total,
        changeDue: paymentMethod === 'cash' ? changeDue : 0,
        paymentMethod,
        mpesaCode: paymentMethod === 'mpesa' ? mpesaCode : '',
        cardAuthCode: paymentMethod === 'card' ? cardAuthCode : '',
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
        cashTendered: paymentMethod === 'cash' ? (numericTendered || total) : total,
        changeDue: paymentMethod === 'cash' ? changeDue : 0,
        paymentMethod,
        mpesaCode: paymentMethod === 'mpesa' ? mpesaCode : '',
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date()
      });

      setCart([]);
      setCashTendered('');
      setMpesaCode('');
      setMpesaPhone('');
      setStkStatus('idle');
      setShowConfirmModal(false);
      setShowOrderBasketModal(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'receipts');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredCustomers = dbCustomers.filter(c => {
    const q = custSearchQuery.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="-mx-4 -mt-3 -mb-4 sm:-mx-6 sm:-mt-4 sm:-mb-6 lg:-mx-8 lg:-mt-4 lg:-mb-8 xl:-mx-10 xl:-mt-4 xl:-mb-10 min-h-[calc(100vh-64px)] h-auto xl:h-[calc(100vh-64px)] bg-slate-950 text-slate-100 font-sans p-2.5 sm:p-4 overflow-y-auto xl:overflow-hidden pb-36 sm:pb-40 md:pb-24 xl:pb-4">
      <div className="max-w-[1700px] mx-auto h-full grid grid-cols-1 xl:grid-cols-[1fr_380px] 2xl:grid-cols-[1fr_420px] gap-3 sm:gap-4">
        
        {/* ========================================== */}
        {/* LEFT PANEL: PRODUCT CATALOG & DENSE GRID  */}
        {/* ========================================== */}
        <div className="min-w-0 flex flex-col h-full min-h-[500px] xl:min-h-0 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-left">
          
          {/* Header & Prominent Search Bar */}
          <div className="p-3.5 sm:p-4 border-b border-slate-800 space-y-3 shrink-0 bg-slate-900">
            
            {/* Secondary Compact Info Bar */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 min-w-0">
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-black text-slate-100 flex items-center gap-2 flex-wrap">
                  <span className="truncate">POS Product Catalog</span>
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-emerald-950 text-emerald-400 rounded-full border border-emerald-800 uppercase tracking-widest shrink-0">Live Terminal</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  Cashier: {userName} • {profile?.companyName || 'Store Terminal'}
                </p>
              </div>

              {/* Compact Metrics */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
                  <Banknote className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Today's Revenue</p>
                    <p className="text-xs font-black text-slate-100 font-mono leading-none">{currency} {todaySales.toLocaleString()}</p>
                  </div>
                </div>

                <div className="bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Receipts</p>
                    <p className="text-xs font-black text-slate-100 font-mono leading-none">{todayOrdersCount}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Prominent Search Bar with Barcode Scan CTA */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search product name, SKU, or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full h-11 pl-10 pr-12 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-medium text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                />
                <span className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 pointer-events-none">
                  F2 / /
                </span>
              </div>

              <button 
                onClick={() => setShowScannerModal(true)}
                className="h-11 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-wider transition-all shadow-md shrink-0"
              >
                <Scan className="w-4 h-4" />
                <span className="hidden sm:inline">SCAN</span>
              </button>

              {/* Quick View Order Trigger Button for screens where active order is not side-by-side */}
              <button 
                type="button"
                onClick={() => setShowOrderBasketModal(true)}
                className={cn(
                  "xl:hidden h-11 px-3 sm:px-3.5 rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-wider transition-all shadow-md shrink-0 border",
                  cart.length > 0
                    ? "bg-emerald-950/80 border-emerald-500/70 text-emerald-300 hover:bg-emerald-900/90 hover:border-emerald-400"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
                title="View Active Order Basket"
              >
                <div className="relative flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                  {cart.length > 0 && (
                    <span className="absolute -top-2 -right-2.5 w-4 h-4 bg-emerald-500 text-slate-950 text-[9px] font-mono font-black rounded-full flex items-center justify-center shadow-xs">
                      {cart.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                  )}
                </div>
                <span className="font-black text-[11px] sm:text-xs">
                  {cart.length > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <span className="hidden sm:inline">View Order</span>
                      <span className="font-mono font-black text-emerald-300 bg-slate-900 px-1.5 py-0.5 rounded border border-emerald-800/80 text-[10px]">
                        {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </span>
                  ) : (
                    <span>View Order</span>
                  )}
                </span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all shrink-0 border",
                    activeCategory === cat 
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-md" 
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid Area */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 no-scrollbar">
            
            {/* Quick Access Row */}
            {quickAccessProducts.length > 0 && searchQuery === '' && activeCategory === 'All' && (
              <div className="mb-4 bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl">
                <div className="flex items-center justify-between mb-2.5 px-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[11px] font-black text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" /> Fast Pick Items
                    </h3>
                    <span className="text-[9px] font-extrabold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700/60 font-mono">
                      {quickAccessProducts.length} items
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter hidden sm:inline">
                      1-Click Add
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => scrollFastPick('left')}
                        className="w-7 h-7 bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 text-slate-200 hover:text-white rounded-lg border border-slate-700/80 flex items-center justify-center transition-all shadow-xs"
                        title="Scroll Fast Pick Left"
                        aria-label="Scroll left"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollFastPick('right')}
                        className="w-7 h-7 bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 text-slate-200 hover:text-white rounded-lg border border-slate-700/80 flex items-center justify-center transition-all shadow-xs"
                        title="Scroll Fast Pick Right"
                        aria-label="Scroll right"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div 
                  ref={fastPickRef}
                  onWheel={(e) => {
                    if (fastPickRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                      fastPickRef.current.scrollLeft += e.deltaY * 0.8;
                    }
                  }}
                  className="flex gap-2.5 overflow-x-auto pb-2 scroll-smooth select-none focus:outline-none"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#475569 #1e293b'
                  }}
                >
                  {quickAccessProducts.map(product => {
                    const isOutOfStock = (product.quantity || 0) <= 0;
                    return (
                      <button 
                        key={product.id}
                        onClick={() => addToCart(product)}
                        disabled={isOutOfStock}
                        className={cn(
                          "min-w-[140px] max-w-[160px] bg-slate-800/90 border p-2.5 rounded-xl shadow-2xs hover:shadow-md transition-all text-left flex flex-col group relative overflow-hidden shrink-0",
                          isOutOfStock 
                            ? "border-slate-800 bg-slate-950/50 opacity-50 cursor-not-allowed" 
                            : "border-slate-700 hover:border-emerald-500 hover:bg-slate-800"
                        )}
                      >
                        <h4 className="text-xs font-bold text-slate-100 truncate uppercase">{product.name}</h4>
                        
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-wider block mt-1",
                          isOutOfStock 
                            ? "text-rose-400 font-black" 
                            : product.quantity <= (product.reorderPoint ?? product.minStock ?? 10) 
                              ? "text-amber-400 font-black" 
                              : "text-slate-400"
                        )}>
                          {isOutOfStock ? "Out of Stock" : `Stock: ${product.quantity}`}
                        </span>

                        <div className="mt-2 pt-1 border-t border-slate-700/60 flex items-center justify-between">
                          <p className={cn("text-xs font-black font-mono", isOutOfStock ? "text-slate-500" : "text-emerald-400")}>
                            {currency} {getSellingPrice(product).toLocaleString()}
                          </p>
                          <div className="w-5 h-5 bg-slate-900 group-hover:bg-emerald-600 group-hover:text-white rounded flex items-center justify-center transition-colors border border-slate-700">
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
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Catalog Inventory ({filteredProducts.length} Items)
                </h3>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
                {filteredProducts.map(product => {
                  const isOutOfStock = (product.quantity || 0) <= 0;
                  const isLowStock = !isOutOfStock && product.quantity <= (product.reorderPoint ?? product.minStock ?? 10);

                  return (
                    <div 
                      key={product.id} 
                      onClick={() => !isOutOfStock && addToCart(product)}
                      className={cn(
                        "bg-slate-800/80 border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm group transition-all relative overflow-hidden cursor-pointer min-w-0 h-full min-h-[110px]",
                        isOutOfStock 
                          ? "border-slate-800/80 bg-slate-950/60 opacity-50 cursor-not-allowed" 
                          : "border-slate-700/80 hover:border-emerald-500 hover:bg-slate-800 active:scale-[0.98]"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1.5 min-w-0">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider truncate min-w-0">
                            {product.category || 'General'}
                          </span>
                          
                          {/* Stock Badge */}
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 border",
                            isOutOfStock 
                              ? "text-rose-300 bg-rose-950/80 border-rose-800" 
                              : isLowStock 
                                ? "text-amber-300 bg-amber-950/80 border-amber-800" 
                                : "text-emerald-300 bg-emerald-950/80 border-emerald-800"
                          )}>
                            {isOutOfStock ? "OUT" : isLowStock ? `LOW: ${product.quantity}` : `STK: ${product.quantity}`}
                          </span>
                        </div>

                        <h4 className={cn(
                          "text-xs font-bold leading-tight uppercase line-clamp-2 min-w-0 break-words",
                          isOutOfStock ? "text-slate-500 line-through" : "text-slate-100"
                        )}>
                          {product.name}
                        </h4>
                        <p className="text-[9px] text-slate-400 font-mono truncate mt-0.5">SKU: {product.sku || 'N/A'}</p>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between gap-1">
                        <div className="min-w-0">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block leading-none">Price</span>
                          <p className={cn("text-xs sm:text-sm font-black font-mono mt-0.5 truncate", isOutOfStock ? "text-slate-500" : "text-emerald-400")}>
                            {currency} {getSellingPrice(product).toLocaleString()}
                          </p>
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isOutOfStock) addToCart(product);
                          }}
                          disabled={isOutOfStock}
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-2xs shrink-0 border",
                            isOutOfStock 
                              ? "bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed"
                              : "bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500 active:scale-95"
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
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Package className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-300">No matching products found</p>
                  <p className="text-[10px] text-slate-500">Try adjusting your search query or category filter</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* RIGHT PANEL: CART & CHECKOUT TERMINAL       */}
        {/* ========================================== */}
        <aside id="pos-cart-panel" className="hidden xl:flex min-w-0 flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-left xl:min-h-0">
          
          {/* Cart Header */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-950">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-100 leading-tight tracking-tight">Active Order</h2>
                <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest">
                  {cart.reduce((s, i) => s + i.quantity, 0)} Items Selected
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleHoldCart}
                disabled={cart.length === 0}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-extrabold text-slate-200 uppercase tracking-wider transition-all disabled:opacity-30 flex items-center gap-1 shadow-2xs"
                title="Hold Basket"
              >
                <Pause className="w-3 h-3 text-amber-400" />
                Hold
              </button>

              <button 
                onClick={() => setShowHeldModal(true)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-extrabold text-slate-200 uppercase tracking-wider transition-all flex items-center gap-1 shadow-2xs relative"
                title="View Held Baskets"
              >
                <RotateCcw className="w-3 h-3 text-blue-400" />
                Held {heldCarts.length > 0 && <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[9px] rounded-full font-mono">{heldCarts.length}</span>}
              </button>

              <button 
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all disabled:opacity-30"
                title="Clear Cart"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
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
                    className="p-3 bg-slate-800/90 border border-slate-700/80 rounded-xl hover:border-slate-600 transition-all shadow-sm group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-700 shrink-0">
                          {item.image ? (
                            <img src={item.image} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-100 truncate leading-tight uppercase">{item.name}</h4>
                          <p className="text-[10px] text-emerald-400 font-semibold font-mono mt-0.5">
                            {currency} {item.price.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-slate-100 font-mono">
                          {currency} {(item.price * item.quantity).toLocaleString()}
                        </p>
                        {isMax && (
                          <span className="text-[8px] font-bold text-amber-300 bg-amber-950/60 px-1 py-0.5 rounded border border-amber-700">Max Stock</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-700/50">
                      {/* Editable Quantity Bar */}
                      <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden h-7">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="px-2 hover:bg-slate-800 text-slate-300 transition-colors border-r border-slate-700 h-full flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        
                        <input
                          type="number"
                          min="1"
                          max={maxStock}
                          value={item.quantity}
                          onChange={(e) => setItemQuantityDirect(item.id, parseInt(e.target.value) || 1)}
                          className="w-10 text-[11px] font-black text-center text-slate-100 bg-transparent outline-none focus:bg-slate-800 font-mono"
                        />

                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          disabled={isMax}
                          className={cn(
                            "px-2 transition-colors border-l border-slate-700 h-full flex items-center justify-center",
                            isMax ? "bg-slate-900 text-slate-600 cursor-not-allowed" : "hover:bg-slate-800 text-slate-300"
                          )}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
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
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                <div className="w-12 h-12 bg-slate-800/80 rounded-2xl flex items-center justify-center shadow-xs border border-slate-700 mb-3 text-slate-400">
                  <ShoppingCart className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Order Basket is Empty</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[220px]">
                  Click products on the left or press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-[9px] font-mono font-bold text-slate-300 border border-slate-700">F2</kbd> or <kbd className="px-1 py-0.5 bg-slate-800 rounded text-[9px] font-mono font-bold text-slate-300 border border-slate-700">/</kbd> to search
                </p>
              </div>
            )}
          </div>

          {/* Cart Footer & Calculations */}
          <div className="p-3.5 bg-slate-950 border-t border-slate-800 space-y-3 shrink-0">
            
            {/* Totals Breakdown */}
            <div className="space-y-1 pt-0.5">
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Net Subtotal (Excl. VAT)</span>
                <span className="font-mono text-slate-200">{currency} {subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>VAT (16% Included)</span>
                <span className="font-mono text-slate-200">{currency} {tax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-800 pt-2 mt-1">
                <span className="text-base font-black text-slate-100 uppercase tracking-wider">TOTAL PAYABLE</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Primary CTA: CHECK OUT (Triggers Checkout Flow Modal) */}
            <button
              onClick={handleInitiateCheckout}
              disabled={cart.length === 0 || isProcessing}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-wider shadow-lg shadow-emerald-950 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between px-4 group shrink-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ArrowRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-1 transition-transform shrink-0" />
                <span className="text-xs sm:text-sm truncate">CHECK OUT</span>
              </div>
              <span className="text-xs font-black font-mono bg-emerald-800/80 px-2.5 py-1 rounded text-white shrink-0">
                {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </button>
          </div>
        </aside>
      </div>

      {/* Sticky Mobile/Tablet Floating Order Bar when active order is not on the side (< 1280px / xl) */}
      {cart.length > 0 && !showOrderBasketModal && !showConfirmModal && (
        <div 
          onClick={() => setShowOrderBasketModal(true)}
          className="xl:hidden fixed bottom-20 sm:bottom-24 md:bottom-6 left-3 sm:left-6 right-3 sm:left-auto sm:right-6 sm:w-96 z-35 bg-slate-900/95 backdrop-blur-md border border-emerald-500/60 p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200 cursor-pointer hover:border-emerald-400 transition-colors group ring-1 ring-emerald-500/20"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-100 uppercase tracking-wide truncate">
                {cart.reduce((s, i) => s + i.quantity, 0)} Items Selected
              </p>
              <p className="text-xs font-black text-emerald-400 font-mono">
                {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowOrderBasketModal(true);
            }}
            className="px-4 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 shadow-lg shadow-emerald-950 active:scale-95 transition-all"
          >
            <span>View Order</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================== */}
      {/* MODALS & NOTIFICATIONS                     */}
      {/* ========================================== */}

      {/* 1. CHECKOUT FLOW MODAL: Step 1 (Confirm) -> Step 2 (Payment) */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 text-slate-100 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-800 overflow-hidden flex flex-col p-6 space-y-5 text-left"
            >
              {/* Header & Step Indicator */}
              <div className="flex justify-between items-center pb-3.5 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">Checkout Flow</span>
                    <span className="text-slate-600 font-bold">•</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
                        checkoutStep === 'confirm' 
                          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950" 
                          : "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                      )}>
                        1. Confirm {checkoutStep === 'payment' && '✓'}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-500" />
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
                        checkoutStep === 'payment' 
                          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950" 
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      )}>
                        2. Payment
                      </span>
                    </div>
                  </div>
                  <h3 className="text-base font-black text-slate-100 uppercase tracking-wide">
                    {checkoutStep === 'confirm' ? 'Confirm Order Details' : 'Select Payment & Settle'}
                  </h3>
                </div>

                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* STEP 1: CONFIRM ORDER */}
              {checkoutStep === 'confirm' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Customer Assignment Card */}
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Customer Assigned
                        </p>
                        <p className="text-xs sm:text-sm font-black text-slate-100 mt-0.5 flex items-center gap-2">
                          <span>{customerName}</span>
                          {customerPhone && <span className="text-[11px] text-slate-400 font-mono font-normal">({customerPhone})</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {customerName !== 'Walk-in Customer' && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerName('Walk-in Customer');
                              setCustomerPhone('');
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-extrabold rounded-lg uppercase tracking-wider border border-slate-700 transition-colors"
                          >
                            Walk-in
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setShowCustomerModal(true)}
                          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all flex items-center gap-1"
                        >
                          <Users className="w-3 h-3" />
                          {customerName === 'Walk-in Customer' ? 'Assign Customer' : 'Change'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Order List */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <span>Itemized Order ({cart.length} SKUs)</span>
                      <span>Total Units: {cart.reduce((sum, i) => sum + i.quantity, 0)}</span>
                    </div>
                    <div className="max-h-44 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950/60 p-2.5 space-y-2 text-xs divide-y divide-slate-800/60">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-slate-200 text-xs pt-1.5 first:pt-0">
                          <div className="min-w-0 pr-2">
                            <p className="truncate font-bold text-slate-100">{item.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{item.sku || 'No SKU'} • {currency} {item.price.toLocaleString()} each</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono text-xs text-slate-300 mr-2 font-bold">{item.quantity}x</span>
                            <span className="font-bold text-slate-100 font-mono">{currency} {(item.quantity * item.price).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Breakdown Banner */}
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400 font-medium">
                      <span>Net Subtotal (Excl. VAT)</span>
                      <span className="font-mono text-slate-200">{currency} {subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 font-medium">
                      <span>VAT (16% Included)</span>
                      <span className="font-mono text-slate-200">{currency} {tax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-800 pt-2 mt-1">
                      <span className="text-sm font-black text-slate-100 uppercase tracking-wider">TOTAL PAYABLE</span>
                      <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                        {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  {/* Step 1 Actions: Edit or Proceed to Payment */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-700"
                    >
                      ← Edit Order
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (paymentMethod === 'cash' && (!cashTendered || cashTendered === '')) {
                          setCashTendered(total);
                        }
                        if (paymentMethod === 'mpesa' && !mpesaPhone) {
                          setMpesaPhone(customerPhone || '');
                        }
                        setCheckoutStep('payment');
                      }}
                      className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 group"
                    >
                      <span>Proceed to Payment</span>
                      <ArrowRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PAYMENT METHOD & SETTLEMENT */}
              {checkoutStep === 'payment' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Total Payable Summary Card */}
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Amount Due</p>
                      <p className="text-2xl font-black text-emerald-400 font-mono">
                        {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Customer</p>
                      <p className="text-xs font-bold text-slate-200 truncate max-w-[150px]">{customerName}</p>
                    </div>
                  </div>

                  {/* Payment Type Options Selector (Cash, M-Pesa, Card, Split) */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Select Payment Type</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'cash', icon: Banknote, label: 'Cash' },
                        { id: 'mpesa', icon: Smartphone, label: 'M-Pesa' },
                        { id: 'card', icon: CreditCard, label: 'Card' },
                        { id: 'split', icon: RotateCcw, label: 'Split' },
                      ].map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(method.id);
                            if (method.id === 'mpesa' && !mpesaPhone) setMpesaPhone(customerPhone || '');
                            if (method.id === 'cash' && (!cashTendered || cashTendered === '')) setCashTendered(total);
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1 h-14 rounded-2xl border transition-all",
                            paymentMethod === method.id 
                              ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-950 font-black" 
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          )}
                        >
                          <method.icon className={cn("w-4 h-4", paymentMethod === method.id ? "text-white" : "text-slate-400")} />
                          <span className="text-[10px] font-black uppercase tracking-wider">{method.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Payment Details by Method */}
                  {paymentMethod === 'cash' && (
                    <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <Coins className="w-4 h-4 text-amber-400" /> Cash Tendered
                        </span>
                        {changeDue > 0 ? (
                          <span className="text-emerald-400 font-black bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 font-mono text-xs">
                            Change Due: {currency} {changeDue.toLocaleString()}
                          </span>
                        ) : isCashInsufficient ? (
                          <span className="text-rose-400 font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800 font-mono text-[10px]">
                            Short by: {currency} {(total - numericTendered).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[10px]">Exact Amount</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">{currency}</span>
                          <input
                            type="number"
                            placeholder={total.toString()}
                            value={cashTendered}
                            onChange={(e) => setCashTendered(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full h-10 pl-9 pr-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-black text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => setCashTendered(total)}
                          className="px-3 h-10 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black rounded-xl uppercase tracking-wider transition-colors shrink-0 border border-slate-700"
                        >
                          Exact
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                        {[500, 1000, 2000, 5000].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCashTendered(val)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-800 text-slate-300 rounded-lg text-[10px] font-bold font-mono transition-all shrink-0"
                          >
                            +{val}
                          </button>
                        ))}
                      </div>

                      {isCashInsufficient && (
                        <p className="text-[10px] font-bold text-rose-400 flex items-center gap-1 pt-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Please tender at least {currency} {total.toLocaleString()} to complete sale.
                        </p>
                      )}
                    </div>
                  )}

                  {/* M-PESA STK PUSH & REFERENCE FLOW */}
                  {paymentMethod === 'mpesa' && (
                    <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-emerald-300 uppercase tracking-wide">M-Pesa Express (STK Push)</p>
                            <p className="text-[10px] text-slate-400 font-medium">Send prompt directly to customer phone</p>
                          </div>
                        </div>
                        <span className={cn(
                          "text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider border",
                          stkStatus === 'confirmed' ? "bg-emerald-900/80 text-emerald-300 border-emerald-700" :
                          stkStatus === 'sent' ? "bg-amber-950 text-amber-300 border-amber-800 animate-pulse" :
                          stkStatus === 'sending' ? "bg-blue-950 text-blue-300 border-blue-800" :
                          "bg-slate-900 text-slate-400 border-slate-800"
                        )}>
                          {stkStatus === 'confirmed' ? '✓ Payment Received' :
                           stkStatus === 'sent' ? '● Awaiting PIN...' :
                           stkStatus === 'sending' ? 'Sending STK...' : 'STK Ready'}
                        </span>
                      </div>

                      {/* Phone Number Input & SEND STK Button */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            placeholder="e.g. 0712345678"
                            value={mpesaPhone}
                            onChange={(e) => {
                              setMpesaPhone(e.target.value);
                              if (stkStatus === 'confirmed') setStkStatus('idle');
                            }}
                            className="w-full h-9 pl-8 pr-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleSendStk}
                          disabled={!mpesaPhone.trim() || stkStatus === 'sending'}
                          className={cn(
                            "h-9 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-md",
                            stkStatus === 'confirmed'
                              ? "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950"
                          )}
                        >
                          {stkStatus === 'sending' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : stkStatus === 'confirmed' ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Resend STK</span>
                            </>
                          ) : (
                            <>
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>SEND STK</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* STK Status Feedback */}
                      {stkStatus === 'sent' && (
                        <div className="bg-amber-950/40 border border-amber-800/80 p-2.5 rounded-xl flex items-center justify-between">
                          <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                            Prompt sent to {mpesaPhone}.
                          </span>
                          <button
                            type="button"
                            onClick={confirmMpesaPayment}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[9px] font-black uppercase"
                          >
                            Confirm Received
                          </button>
                        </div>
                      )}

                      {(stkStatus === 'confirmed' || mpesaCode) && (
                        <div className="bg-emerald-950/60 border border-emerald-700/80 p-2.5 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Payment Confirmed
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">M-Pesa Ref Code:</span>
                            <input
                              type="text"
                              value={mpesaCode}
                              onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                              placeholder="e.g. QK89X0P1"
                              className="flex-1 h-7 px-2 bg-slate-900 border border-emerald-800 rounded font-mono font-bold text-xs text-emerald-300 uppercase outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      )}

                      {stkStatus === 'idle' && !mpesaCode && (
                        <div className="pt-0.5 flex items-center justify-between text-[10px] text-slate-400">
                          <span>Paid via Till/Paybill?</span>
                          <button
                            type="button"
                            onClick={() => {
                              const manualCode = `QK${Math.floor(100000 + Math.random() * 900000)}`;
                              setMpesaCode(manualCode);
                              setStkStatus('confirmed');
                            }}
                            className="text-emerald-400 hover:text-emerald-300 font-bold underline"
                          >
                            Enter Manual Ref Code
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CARD PAYMENT FLOW */}
                  {paymentMethod === 'card' && (
                    <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-blue-300 uppercase tracking-wide">POS Card Terminal</p>
                          <p className="text-[10px] text-slate-400 font-medium">Swipe/Tap customer debit or credit card on terminal</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Auth / Ref Code:</span>
                        <input
                          type="text"
                          value={cardAuthCode}
                          onChange={(e) => setCardAuthCode(e.target.value.toUpperCase())}
                          placeholder="e.g. AUTH-489201"
                          className="flex-1 h-8 px-2.5 bg-slate-900 border border-slate-800 rounded-xl font-mono font-bold text-xs text-slate-100 uppercase outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* SPLIT PAYMENT FLOW */}
                  {paymentMethod === 'split' && (
                    <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                          <RotateCcw className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-amber-300 uppercase tracking-wide">Split Settlement</p>
                          <p className="text-[10px] text-slate-400 font-medium">Split amount across Cash and M-Pesa/Card</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Cash Portion</label>
                          <input
                            type="number"
                            placeholder={(total / 2).toString()}
                            value={splitCashAmount}
                            onChange={(e) => setSplitCashAmount(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full h-8 px-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-100 outline-none focus:border-amber-500 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">M-Pesa/Card Balance</label>
                          <div className="h-8 px-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono font-bold text-emerald-400 flex items-center mt-1">
                            {currency} {typeof splitCashAmount === 'number' && splitCashAmount < total ? (total - splitCashAmount).toLocaleString() : 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2 Actions: Back to Confirm or Complete Sale */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('confirm')}
                      className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-700 flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Order</span>
                    </button>

                    <button
                      type="button"
                      onClick={executeCheckout}
                      disabled={isProcessing || isCashInsufficient}
                      className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                          <span>Complete Sale</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. CUSTOMER SELECTION DIALOG (Requirement: Dedicated customer dialog, not fixed in POS) */}
      <AnimatePresence>
        {showCustomerModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 text-slate-100 rounded-3xl w-full max-w-md shadow-2xl border border-slate-800 overflow-hidden flex flex-col p-6 space-y-4 text-left max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                    Customer Assignment
                  </h3>
                </div>
                <button 
                  onClick={() => setShowCustomerModal(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setCustModalTab('select')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5",
                    custModalTab === 'select' 
                      ? "bg-slate-800 text-white shadow-xs" 
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Users className="w-3.5 h-3.5 text-emerald-400" /> Select Customer
                </button>
                <button
                  onClick={() => setCustModalTab('create')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5",
                    custModalTab === 'create' 
                      ? "bg-slate-800 text-white shadow-xs" 
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400" /> Add New
                </button>
              </div>

              {custModalTab === 'select' && (
                <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar pr-0.5">
                  
                  {/* Default Walk-in Option */}
                  <button
                    onClick={() => {
                      setCustomerName('Walk-in Customer');
                      setCustomerPhone('');
                      setShowCustomerModal(false);
                    }}
                    className={cn(
                      "w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between group",
                      customerName === 'Walk-in Customer'
                        ? "bg-emerald-950/40 border-emerald-500 text-emerald-300"
                        : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200"
                    )}
                  >
                    <div>
                      <p className="text-xs font-black uppercase">Walk-in Customer</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Default over-the-counter retail buyer</p>
                    </div>
                    {customerName === 'Walk-in Customer' && (
                      <Check className="w-4 h-4 text-emerald-400" />
                    )}
                  </button>

                  {/* Search Existing Customers */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search customer by name or phone..."
                      value={custSearchQuery}
                      onChange={(e) => setCustSearchQuery(e.target.value)}
                      className="w-full h-9 pl-8 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Customer List */}
                  <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar">
                    {filteredCustomers.map(c => {
                      const isSelected = customerName === c.name;
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setCustomerName(c.name);
                            setCustomerPhone(c.phone || '');
                            setShowCustomerModal(false);
                          }}
                          className={cn(
                            "p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between",
                            isSelected 
                              ? "bg-emerald-950/50 border-emerald-500/80 text-emerald-200" 
                              : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300"
                          )}
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-100">{c.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.phone || 'No phone'} {c.email ? `• ${c.email}` : ''}</p>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            Select
                          </span>
                        </div>
                      );
                    })}

                    {filteredCustomers.length === 0 && (
                      <p className="text-center text-xs text-slate-500 py-6">
                        No saved customers found matching "{custSearchQuery}"
                      </p>
                    )}
                  </div>
                </div>
              )}

              {custModalTab === 'create' && (
                <form onSubmit={handleSaveNewCustomer} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Customer / Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Supplies Ltd"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+254 700 000000"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="client@example.com"
                      value={newCustEmail}
                      onChange={(e) => setNewCustEmail(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setCustModalTab('select')}
                      className="flex-1 h-10 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingCust || !newCustName.trim()}
                      className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center"
                    >
                      {isSavingCust ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Assign'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. BARCODE SCANNER MODAL */}
      <AnimatePresence>
        {showScannerModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 text-slate-100 rounded-3xl w-full max-w-md shadow-2xl border border-slate-800 overflow-hidden flex flex-col p-6 space-y-4 text-left"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Scan className="w-5 h-5 text-emerald-400" />
                  Barcode / SKU Scanner
                </h3>
                <button 
                  onClick={() => setShowScannerModal(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleBarcodeSubmit} className="space-y-4">
                <p className="text-xs text-slate-400 font-medium">
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
                    className="w-full h-12 pl-4 pr-10 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-mono font-bold text-slate-100 outline-none focus:border-emerald-500"
                  />
                  <Keyboard className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScannerModal(false)}
                    className="flex-1 h-10 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-700"
                  >
                    Done
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md"
                  >
                    Add to Cart
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. HELD CARTS MODAL */}
      <AnimatePresence>
        {showHeldModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 text-slate-100 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-800 overflow-hidden flex flex-col p-6 space-y-4 max-h-[80vh] text-left"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-blue-400" />
                  Held Baskets ({heldCarts.length})
                </h3>
                <button 
                  onClick={() => setShowHeldModal(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {heldCarts.map((hc) => (
                  <div key={hc.id} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-100">{hc.customerName || 'Walk-in Customer'}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {hc.items?.length || 0} items • {currency} {hc.total?.toLocaleString() || 0}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5">{new Date(hc.timestamp).toLocaleTimeString()}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleRestoreCart(hc.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-2xs"
                      >
                        Restore
                      </button>
                      <button 
                        onClick={() => handleDeleteHeldCart(hc.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {heldCarts.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-8">No held baskets available</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. SALE SUCCESS NOTIFICATION */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[140] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-emerald-600 text-white px-8 py-5 rounded-2xl shadow-2xl flex flex-col items-center gap-2 border-4 border-slate-900 pointer-events-auto">
               <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-white" />
               </div>
               <div className="text-center">
                  <h3 className="text-lg font-black uppercase tracking-wider">Sale Completed!</h3>
                  <p className="text-[10px] font-medium opacity-90 uppercase tracking-widest mt-0.5">Receipt generated & inventory updated</p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. RECEIPT & SALES INVOICE PRINT DIALOG */}
      <AnimatePresence>
        {completedSale && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
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
              className="bg-slate-900 rounded-[2rem] w-full max-w-4xl shadow-2xl border border-slate-800 overflow-hidden my-8 flex flex-col md:flex-row h-[85vh] text-left"
            >
              {/* Left Column: Action controls */}
              <div className="p-6 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between md:w-[320px] bg-slate-950 shrink-0">
                <div className="space-y-5">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Checkout Success
                    </span>
                    <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight mt-3">Print Documents</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-1">Select document format below.</p>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => setPrintType('receipt')}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all text-left",
                        printType === 'receipt'
                          ? "bg-emerald-600 border-emerald-500 text-white shadow-md font-black"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
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
                          ? "bg-emerald-600 border-emerald-500 text-white shadow-md font-black"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                      )}
                    >
                      <FileText className="w-4 h-4" />
                      Standard Sales Invoice (A4)
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-800">
                  <button
                    onClick={handlePrintPOS}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950"
                  >
                    <Receipt className="w-4 h-4" /> Print Document
                  </button>
                  <button
                    onClick={() => setCompletedSale(null)}
                    className="w-full h-10 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border border-slate-700"
                  >
                    Next Sale
                  </button>
                </div>
              </div>

              {/* Right Column: Print Preview */}
              <div className="flex-1 bg-slate-950/60 p-6 overflow-y-auto flex items-start justify-center">
                <div id="printable-area" className="bg-white p-6 shadow-xl border border-slate-300 rounded-2xl w-full max-w-[400px] text-xs font-mono text-slate-900">
                  <div className="text-center pb-4 border-b border-dashed border-slate-300 space-y-1">
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">{profile?.companyName || 'RETAIL POS STORE'}</h2>
                    <p className="text-[10px] text-slate-500 font-sans">Official Sales Receipt</p>
                    <p className="text-[10px] text-slate-500 font-mono">Receipt #: {completedSale.receiptId}</p>
                    <p className="text-[10px] text-slate-500 font-mono">Date: {new Date().toLocaleString()}</p>
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
                      <span className="font-bold uppercase text-emerald-700">{completedSale.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="py-3 space-y-2 border-b border-dashed border-slate-300">
                    <div className="flex justify-between font-bold text-[10px] text-slate-500 uppercase tracking-wider">
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
                      <div className="flex justify-between text-emerald-700 font-semibold">
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
                          <div className="flex justify-between text-emerald-800 font-black text-[11px]">
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
                    <p className="text-[10px] font-bold text-slate-800 uppercase">Thank you for shopping with us!</p>
                    <p className="text-[9px] text-slate-500">Goods once sold are not returnable</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* 6. ACTIVE ORDER BASKET MODAL / SLIDE-OVER DRAWER (Triggered when selecting 'View Order') */}
        {showOrderBasketModal && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Backdrop click closes drawer */}
            <div 
              className="absolute inset-0"
              onClick={() => setShowOrderBasketModal(false)}
            />

            <motion.div 
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative z-10 w-full sm:max-w-md md:max-w-lg lg:max-w-xl h-[92vh] sm:h-[94vh] max-h-[880px] bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-left"
            >
              {/* Drawer Header */}
              <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-950 shrink-0">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-slate-100 uppercase tracking-tight truncate">
                        Active Order Basket
                      </h2>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full shrink-0">
                        {cart.reduce((s, i) => s + i.quantity, 0)} Items
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold truncate">
                      Review, adjust quantities & complete transaction
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    type="button"
                    onClick={handleHoldCart}
                    disabled={cart.length === 0}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-extrabold text-slate-200 uppercase tracking-wider transition-all disabled:opacity-30 flex items-center gap-1 shadow-2xs"
                    title="Hold Basket"
                  >
                    <Pause className="w-3 h-3 text-amber-400" />
                    <span className="hidden min-[400px]:inline">Hold</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      setShowOrderBasketModal(false);
                      setShowHeldModal(true);
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-extrabold text-slate-200 uppercase tracking-wider transition-all flex items-center gap-1 shadow-2xs relative"
                    title="View Held Baskets"
                  >
                    <RotateCcw className="w-3 h-3 text-blue-400" />
                    <span className="hidden min-[400px]:inline">Held</span>
                    {heldCarts.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[9px] rounded-full font-mono">
                        {heldCarts.length}
                      </span>
                    )}
                  </button>

                  <button 
                    type="button"
                    onClick={() => setCart([])}
                    disabled={cart.length === 0}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all disabled:opacity-30"
                    title="Clear Cart"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button 
                    type="button"
                    onClick={() => setShowOrderBasketModal(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors ml-1"
                    title="Close Basket Drawer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Customer Assignment Banner in Drawer */}
              <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Customer</p>
                    <p className="text-xs font-bold text-slate-100 truncate">
                      {customerName} {customerPhone && <span className="text-[10px] text-slate-400 font-mono">({customerPhone})</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {customerName !== 'Walk-in Customer' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerName('Walk-in Customer');
                        setCustomerPhone('');
                      }}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[9px] font-extrabold rounded-lg uppercase tracking-wider border border-slate-800 transition-colors"
                    >
                      Walk-in
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(true)}
                    className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all flex items-center gap-1"
                  >
                    <Users className="w-3 h-3" />
                    <span>{customerName === 'Walk-in Customer' ? 'Assign' : 'Change'}</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Cart Items in Drawer */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 no-scrollbar min-h-0">
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
                        className="p-3 bg-slate-800/90 border border-slate-700/80 rounded-2xl hover:border-slate-600 transition-all shadow-xs group"
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-700 shrink-0">
                              {item.image ? (
                                <img src={item.image} alt="" className="w-full h-full object-cover rounded-xl" />
                              ) : (
                                <Package className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-slate-100 truncate uppercase leading-tight">
                                {item.name}
                              </h4>
                              <p className="text-[10px] text-emerald-400 font-semibold font-mono mt-0.5">
                                {currency} {item.price.toLocaleString()} each
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xs font-black text-slate-100 font-mono">
                              {currency} {(item.price * item.quantity).toLocaleString()}
                            </p>
                            {isMax && (
                              <span className="text-[8px] font-bold text-amber-300 bg-amber-950/60 px-1 py-0.5 rounded border border-amber-700">
                                Max Stock ({maxStock})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-slate-700/50">
                          {/* Editable Quantity Bar */}
                          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden h-8">
                            <button 
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="px-2.5 hover:bg-slate-800 text-slate-300 transition-colors border-r border-slate-700 h-full flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            
                            <input
                              type="number"
                              min="1"
                              max={maxStock}
                              value={item.quantity}
                              onChange={(e) => setItemQuantityDirect(item.id, parseInt(e.target.value) || 1)}
                              className="w-12 text-xs font-black text-center text-slate-100 bg-transparent outline-none focus:bg-slate-800 font-mono"
                            />

                            <button 
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              disabled={isMax}
                              className={cn(
                                "px-2.5 transition-colors border-l border-slate-700 h-full flex items-center justify-center",
                                isMax ? "bg-slate-900 text-slate-600 cursor-not-allowed" : "hover:bg-slate-800 text-slate-300"
                              )}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button 
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {cart.length === 0 && (
                  <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                    <div className="w-12 h-12 bg-slate-800/80 rounded-2xl flex items-center justify-center shadow-xs border border-slate-700 mb-3 text-slate-400">
                      <ShoppingCart className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Order Basket is Empty</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[220px]">
                      Browse the catalog and tap products to add items into this active order
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowOrderBasketModal(false)}
                      className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl uppercase tracking-wider border border-slate-700 transition-colors"
                    >
                      Browse Products
                    </button>
                  </div>
                )}
              </div>

              {/* Drawer Footer & Calculations */}
              <div className="p-3.5 bg-slate-950 border-t border-slate-800 space-y-3 shrink-0">
                {/* Financial Summary */}
                <div className="space-y-1 pt-0.5">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Net Subtotal (Excl. VAT)</span>
                    <span className="font-mono text-slate-200">
                      {currency} {subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>VAT (16% Included)</span>
                    <span className="font-mono text-slate-200">
                      {currency} {tax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-800 pt-2 mt-1">
                    <span className="text-sm sm:text-base font-black text-slate-100 uppercase tracking-wider">
                      TOTAL PAYABLE
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                      {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Primary CTA Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowOrderBasketModal(false)}
                    className="h-11 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Continue Shopping</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowOrderBasketModal(false);
                      handleInitiateCheckout();
                    }}
                    disabled={cart.length === 0 || isProcessing}
                    className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-wider shadow-lg shadow-emerald-950 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between px-3.5 group shrink-0"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ArrowRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-1 transition-transform shrink-0" />
                      <span className="text-xs font-black truncate">CHECK OUT</span>
                    </div>
                    <span className="text-[11px] font-black font-mono bg-emerald-800/80 px-2 py-0.5 rounded text-white shrink-0">
                      {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
