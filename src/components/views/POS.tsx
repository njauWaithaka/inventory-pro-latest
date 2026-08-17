import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, 
  Banknote, Receipt, Package, Loader2, CheckCircle2,
  Scan, Pause, RotateCcw, Smartphone, X, FileText,
  Coins, UserCheck, AlertCircle, Sparkles,
  Keyboard, Users, UserPlus, Phone, Mail, Check,
  ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Printer,
  Store, Hash, Calendar, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../lib/utils';
import { InsightBadge } from '../common/InsightBadge';

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
  const { profile, company, currency } = useSettings();
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

  // Tender State
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

  // Today's Sales Metrics
  const [todaySales, setTodaySales] = useState(0);
  const [todayOrdersCount, setTodayOrdersCount] = useState(0);

  // Fetch Products & Customers & Today Receipts
  useEffect(() => {
    if (!profile?.companyId) return;

    const productsRef = collection(db, `companies/${profile.companyId}/products`);
    const unsubscribeProducts = onSnapshot(productsRef, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(prods);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `companies/${profile.companyId}/products`);
      setLoading(false);
    });

    const customersRef = collection(db, `companies/${profile.companyId}/customers`);
    const unsubscribeCustomers = onSnapshot(customersRef, (snapshot) => {
      const custs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDbCustomers(custs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `companies/${profile.companyId}/customers`);
    });

    // Today's Receipts
    const todayStr = new Date().toISOString().split('T')[0];
    const receiptsRef = collection(db, `companies/${profile.companyId}/receipts`);
    const unsubscribeReceipts = onSnapshot(receiptsRef, (snapshot) => {
      let salesSum = 0;
      let count = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.date === todayStr || (data.createdAt && data.createdAt.startsWith(todayStr))) {
          salesSum += (data.total || 0);
          count++;
        }
      });
      setTodaySales(salesSum);
      setTodayOrdersCount(count);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeCustomers();
      unsubscribeReceipts();
    };
  }, [profile?.companyId]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setShowScannerModal(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          handleInitiateCheckout();
        }
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setShowConfirmModal(false);
        setShowScannerModal(false);
        setShowCustomerModal(false);
        setShowHeldModal(false);
        setShowOrderBasketModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ['All', ...Array.from(cats)];
  }, [products]);

  const getSellingPrice = (product: any): number => {
    if (typeof product.sellingPrice === 'number' && product.sellingPrice > 0) {
      return product.sellingPrice;
    }
    if (typeof product.price === 'number' && product.price > 0) {
      return product.price;
    }
    if (typeof product.buyingPrice === 'number' && product.buyingPrice > 0) {
      return Math.round(product.buyingPrice * 1.3);
    }
    return typeof product.value === 'number' ? product.value : 0;
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, activeCategory]);

  const addToCart = (product: any) => {
    const currentStock = typeof product.quantity === 'number' ? product.quantity : 0;
    if (currentStock <= 0) return;

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= currentStock) {
          return prev;
        }
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: getSellingPrice(product),
        buyingPrice: product.buyingPrice || product.value || 0,
        sellingPrice: getSellingPrice(product),
        quantity: 1,
        image: product.image,
        category: product.category,
        sku: product.sku
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const prod = products.find(p => p.id === id);
        const maxStock = prod ? (typeof prod.quantity === 'number' ? prod.quantity : 0) : 999999;
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        if (newQty > maxStock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const setItemQuantityDirect = (id: string, qty: number) => {
    const prod = products.find(p => p.id === id);
    const maxStock = prod ? (typeof prod.quantity === 'number' ? prod.quantity : 0) : 999999;
    const finalQty = Math.max(1, Math.min(qty, maxStock));
    
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: finalQty } : item
    ));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Cart Calculations
  const rawTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = 0;
  const discountPercent = 0;
  const total = rawTotal;
  const subtotal = Math.round(total / 1.16);
  const tax = total - subtotal;

  const numericTendered = typeof cashTendered === 'number' ? cashTendered : 0;
  const changeDue = Math.max(0, numericTendered - total);
  const isCashInsufficient = paymentMethod === 'cash' && numericTendered > 0 && numericTendered < total;

  // Search Enter Key Handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredProducts.length > 0) {
      e.preventDefault();
      const firstInStock = filteredProducts.find(p => (p.quantity || 0) > 0);
      if (firstInStock) {
        addToCart(firstInStock);
        setSearchQuery('');
      }
    }
  };

  // Barcode Submission
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matched = products.find(p => 
      (p.barcode && p.barcode.toLowerCase() === barcodeInput.trim().toLowerCase()) ||
      (p.sku && p.sku.toLowerCase() === barcodeInput.trim().toLowerCase())
    );

    if (matched) {
      if ((matched.quantity || 0) > 0) {
        addToCart(matched);
        setBarcodeInput('');
        setShowScannerModal(false);
      }
    } else {
      alert(`No product found with barcode/SKU: ${barcodeInput}`);
    }
  };

  // Hold & Retrieve Carts
  const handleHoldCart = () => {
    if (cart.length === 0) return;
    const newHeld = [
      ...heldCarts,
      {
        id: `held_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: cart,
        customerName: customerName,
        customerPhone: customerPhone,
        total: total,
      }
    ];
    setHeldCarts(newHeld);
    localStorage.setItem('pos_held_carts', JSON.stringify(newHeld));
    setCart([]);
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
  };

  const handleRestoreHeldCart = (heldItem: any) => {
    setCart(heldItem.items);
    setCustomerName(heldItem.customerName || 'Walk-in Customer');
    setCustomerPhone(heldItem.customerPhone || '');
    const updated = heldCarts.filter(h => h.id !== heldItem.id);
    setHeldCarts(updated);
    localStorage.setItem('pos_held_carts', JSON.stringify(updated));
    setShowHeldModal(false);
  };

  const handleDeleteHeldCart = (id: string) => {
    const updated = heldCarts.filter(h => h.id !== id);
    setHeldCarts(updated);
    localStorage.setItem('pos_held_carts', JSON.stringify(updated));
  };

  // Save New Customer
  const handleSaveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !newCustName.trim()) return;

    setIsSavingCust(true);
    try {
      const custData = {
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        email: newCustEmail.trim(),
        companyId: profile.companyId,
        createdAt: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, `companies/${profile.companyId}/customers`), custData);
      setCustomerName(newCustName.trim());
      setCustomerPhone(newCustPhone.trim());
      setNewCustName('');
      setNewCustPhone('');
      setNewCustEmail('');
      setShowCustomerModal(false);
    } catch (err) {
      console.error("Error creating customer in POS:", err);
    } finally {
      setIsSavingCust(false);
    }
  };

  // Trigger Checkout Flow
  const handleInitiateCheckout = () => {
    if (cart.length === 0) return;
    setCheckoutStep('confirm');
    setShowConfirmModal(true);
    setCashTendered(total);
  };

  const handlePrintPOS = () => {
    window.print();
  };

  // Complete Sale & Firebase Updates
  const handleCompleteSale = async () => {
    if (!profile?.companyId || !user || cart.length === 0 || isProcessing) return;

    setIsProcessing(true);
    try {
      const receiptId = `RCP-POS-${Date.now()}`;
      const finalCustName = customerName.trim() || 'Walk-in Customer';

      // 1. Create Receipt Record
      const receiptData = {
        id: receiptId,
        receiptId: receiptId,
        customerName: finalCustName,
        customerPhone: customerPhone.trim(),
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          sku: item.sku || '',
          category: item.category || ''
        })),
        rawTotal,
        discountPercent,
        discountAmount,
        subtotal,
        tax,
        total,
        paymentMethod,
        mpesaCode: paymentMethod === 'mpesa' ? mpesaCode : '',
        cashTendered: paymentMethod === 'cash' ? (numericTendered || total) : total,
        changeDue: paymentMethod === 'cash' ? changeDue : 0,
        cashier: userName,
        cashierId: user.uid,
        status: 'PAID',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      };

      await setDoc(doc(db, `companies/${profile.companyId}/receipts`, receiptId), receiptData);

      // 2. Decrement Products & Record Sales & Movements
      for (const item of cart) {
        const prodRef = doc(db, `companies/${profile.companyId}/products`, item.id);
        const prod = products.find(p => p.id === item.id);
        const beforeQty = prod ? (typeof prod.quantity === 'number' ? prod.quantity : 0) : 0;
        const finalQty = Math.max(0, beforeQty - item.quantity);

        await updateDoc(prodRef, {
          quantity: increment(-item.quantity),
          unitsSold: increment(item.quantity),
          lastSoldAt: new Date().toISOString(),
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
      <div className="min-h-[60vh] flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const storeDisplayName = profile?.companyName || company?.name || 'INVENTORY PRO STORE';
  const storeAddress = company?.address || profile?.address || 'Main Branch, Retail Street';
  const storePhone = company?.phone || profile?.phone || '+254 700 000 000';
  const storeEmail = company?.email || profile?.email || 'sales@inventorypro.com';
  const storeTaxPin = company?.taxId || company?.pin || 'P051234567Z';

  return (
    <div className="-mx-4 -mt-3 -mb-4 sm:-mx-6 sm:-mt-4 sm:-mb-6 lg:-mx-8 lg:-mt-4 lg:-mb-8 xl:-mx-10 xl:-mt-4 xl:-mb-10 min-h-[calc(100vh-64px)] h-auto xl:h-[calc(100vh-64px)] bg-[#eef0f2] text-[#1a1c20] font-sans p-3 sm:p-5 overflow-y-auto xl:overflow-hidden pb-36 sm:pb-40 md:pb-24 xl:pb-5">
      <div className="max-w-[1700px] mx-auto h-full grid grid-cols-1 xl:grid-cols-[1fr_390px] 2xl:grid-cols-[1fr_430px] gap-4 sm:gap-5">
        
        {/* ========================================== */}
        {/* LEFT PANEL: PRODUCT CATALOG                */}
        {/* ========================================== */}
        <div className="min-w-0 flex flex-col h-full min-h-[520px] xl:min-h-0 space-y-4 overflow-y-auto no-scrollbar text-left">
          
          {/* Top Bar Header Row */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shrink-0">
            {/* Store & Cashier Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#22b37a] to-[#189163] flex items-center justify-center text-white shadow-[0_2px_8px_rgba(26,138,95,0.25)] shrink-0">
                <Store className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold text-[#1a1c20] tracking-tight">POS terminal</h1>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-[#e6f7f0] text-[#1a8a5f] rounded-md border border-[#c3ecd8] shrink-0">
                    Live system
                  </span>
                </div>
                <p className="text-xs text-[#6b6f78] font-normal truncate mt-0.5">
                  Cashier: <span className="text-[#1a1c20] font-medium">{userName}</span>
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="bg-white px-4 py-2 rounded-[10px] border border-[#e4e6e9] shadow-[0_2px_8px_rgba(20,20,30,0.08)] min-w-[120px]">
                <p className="text-[11px] font-medium text-[#6b6f78]">Today's revenue</p>
                <p className="text-base sm:text-lg font-bold text-[#1a1c20] leading-tight font-sans">
                  {currency} {todaySales.toLocaleString()}
                </p>
              </div>

              <div className="bg-white px-4 py-2 rounded-[10px] border border-[#e4e6e9] shadow-[0_2px_8px_rgba(20,20,30,0.08)] min-w-[80px]">
                <p className="text-[11px] font-medium text-[#6b6f78]">Receipts</p>
                <p className="text-base sm:text-lg font-bold text-[#1a1c20] leading-tight font-sans">
                  {todayOrdersCount}
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Intelligence Telemetry */}
          <InsightBadge
            elementId="sales_revenue_velocity"
            variant="compact"
            className="w-full"
          />

          {/* Search Bar & Scan Button */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9096a0]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search product name, SKU, or scan barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full h-12 pl-11 pr-14 bg-white border border-[#e4e6e9] rounded-[10px] text-sm text-[#1a1c20] placeholder-[#9096a0] focus:border-[#1a8a5f] focus:ring-1 focus:ring-[#1a8a5f]/20 outline-none transition-all shadow-[0_2px_8px_rgba(20,20,30,0.08)]"
              />
              <span className="hidden sm:inline-block absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#9096a0] bg-[#f8f9fa] px-2 py-0.5 rounded border border-[#e4e6e9] pointer-events-none">
                /
              </span>
            </div>

            <button 
              onClick={() => setShowScannerModal(true)}
              className="h-12 px-5 bg-gradient-to-b from-[#22b37a] to-[#189163] hover:brightness-105 active:scale-98 text-white rounded-[10px] flex items-center gap-2 font-semibold text-sm transition-all shadow-[0_2px_8px_rgba(26,138,95,0.25)] shrink-0"
            >
              <Scan className="w-4 h-4" />
              <span className="hidden sm:inline">Scan barcode</span>
            </button>

            {/* Quick View Order Trigger Button for Mobile/Tablet */}
            <button 
              type="button"
              onClick={() => setShowOrderBasketModal(true)}
              className={cn(
                "xl:hidden h-12 px-3.5 rounded-[10px] flex items-center gap-2 font-medium text-xs transition-all shrink-0 border border-[#e4e6e9]",
                cart.length > 0
                  ? "bg-white text-[#1a8a5f] shadow-[0_2px_8px_rgba(20,20,30,0.08)]"
                  : "bg-white text-[#6b6f78] shadow-[0_2px_8px_rgba(20,20,30,0.08)]"
              )}
              title="View Active Order Basket"
            >
              <div className="relative flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
                {cart.length > 0 && (
                  <span className="absolute -top-2.5 -right-3 w-5 h-5 bg-[#1a8a5f] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </div>
              <span className="font-semibold text-xs">
                {cart.length > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <span className="hidden sm:inline">Order</span>
                    <span className="font-bold text-[#1a8a5f] bg-[#e6f7f0] px-2 py-0.5 rounded border border-[#c3ecd8] text-[11px]">
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
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            {categories.map(cat => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-[10px] text-sm font-medium transition-all shrink-0",
                    isActive 
                      ? "bg-[#1a8a5f] text-white shadow-xs" 
                      : "bg-white border border-[#e4e6e9] text-[#1a1c20] hover:bg-[#f8f9fa]"
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Main Product Catalog Grid */}
          <div className="space-y-2.5 flex-1 pb-4">
            <div className="flex justify-between items-center px-0.5">
              <h3 className="text-sm font-semibold text-[#1a1c20]">
                Product catalog · {filteredProducts.length} items
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filteredProducts.map(product => {
                const isOutOfStock = (product.quantity || 0) <= 0;
                const isLowStock = !isOutOfStock && product.quantity <= (product.reorderPoint ?? product.minStock ?? 10);

                if (isOutOfStock) {
                  return (
                    <div 
                      key={product.id}
                      className="bg-[#f4f5f6] border border-[#e4e6e9] rounded-[10px] p-3.5 flex flex-col justify-between opacity-85 cursor-not-allowed min-h-[145px] shadow-none"
                    >
                      <div>
                        <span className="text-[10px] font-bold text-[#d94848] uppercase tracking-wider block">
                          OUT OF STOCK
                        </span>
                        <h4 className="text-sm font-medium text-[#9096a0] line-through leading-snug line-clamp-2 mt-1">
                          {product.name}
                        </h4>
                        <p className="text-[10px] text-[#9096a0] font-mono mt-1">
                          SKU: {product.sku || 'N/A'}
                        </p>
                      </div>

                      <div className="mt-3 pt-2">
                        <p className="text-base sm:text-lg font-bold text-[#9096a0] font-sans">
                          {currency} {getSellingPrice(product).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={product.id} 
                    onClick={() => addToCart(product)}
                    className="bg-white border border-[#e4e6e9] rounded-[10px] p-3.5 flex flex-col justify-between shadow-[0_2px_8px_rgba(20,20,30,0.08)] hover:shadow-[0_4px_12px_rgba(20,20,30,0.12)] transition-all cursor-pointer min-h-[145px] active:scale-[0.98]"
                  >
                    <div>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider block",
                        isLowStock ? "text-[#d94848]" : "text-[#1a8a5f]"
                      )}>
                        {isLowStock ? `LOW: ${product.quantity}` : `STK: ${product.quantity}`}
                      </span>

                      <h4 className="text-sm font-medium text-[#1a1c20] leading-snug line-clamp-2 mt-1">
                        {product.name}
                      </h4>
                      <p className="text-[10px] text-[#9096a0] font-mono mt-1">
                        SKU: {product.sku || 'N/A'}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 flex items-center justify-between gap-1">
                      <p className="text-base sm:text-lg font-bold text-[#1a1c20] font-sans truncate">
                        {currency} {getSellingPrice(product).toLocaleString()}
                      </p>

                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(product);
                        }}
                        className="w-7 h-7 rounded-full bg-gradient-to-b from-[#22b37a] to-[#189163] text-white flex items-center justify-center shadow-[0_2px_6px_rgba(26,138,95,0.3)] hover:scale-105 active:scale-95 transition-transform shrink-0"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="py-16 text-center text-[#9096a0] space-y-2 bg-white rounded-[10px] border border-[#e4e6e9] shadow-[0_2px_8px_rgba(20,20,30,0.08)]">
                <Package className="w-12 h-12 mx-auto text-[#9096a0]" />
                <p className="text-sm font-semibold text-[#1a1c20]">No matching products found</p>
                <p className="text-xs text-[#6b6f78]">Try adjusting your search query or category filter</p>
              </div>
            )}
          </div>
        </div>

        {/* ========================================== */}
        {/* RIGHT PANEL: CART & CHECKOUT TERMINAL       */}
        {/* ========================================== */}
        <aside id="pos-cart-panel" className="hidden xl:flex min-w-0 flex-col h-full bg-white border border-[#e4e6e9] rounded-2xl shadow-[0_6px_20px_rgba(20,20,30,0.12)] overflow-hidden text-left xl:min-h-0">
          
          {/* Cart Header */}
          <div className="px-5 py-4 border-b border-[#e4e6e9] flex items-center justify-between shrink-0 bg-white">
            <div>
              <h2 className="text-base font-bold text-[#1a1c20] leading-tight">Active order</h2>
              <p className="text-xs text-[#6b6f78] mt-0.5">
                {cart.reduce((s, i) => s + i.quantity, 0)} items selected
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleHoldCart}
                disabled={cart.length === 0}
                className="px-2.5 py-1 bg-white hover:bg-[#f8f9fa] border border-[#e4e6e9] rounded-lg text-[10px] font-bold text-[#6b6f78] uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1 shadow-2xs"
                title="Hold Basket"
              >
                <Pause className="w-3 h-3 text-amber-500" />
                Hold
              </button>

              <button 
                onClick={() => setShowHeldModal(true)}
                className="px-2.5 py-1 bg-white hover:bg-[#f8f9fa] border border-[#e4e6e9] rounded-lg text-[10px] font-bold text-[#6b6f78] uppercase tracking-wider transition-all flex items-center gap-1 shadow-2xs relative"
                title="View Held Baskets"
              >
                <RotateCcw className="w-3 h-3 text-[#1a8a5f]" />
                Held {heldCarts.length > 0 && <span className="px-1.5 py-0.2 bg-[#1a8a5f] text-white text-[9px] rounded-full font-mono">{heldCarts.length}</span>}
              </button>

              {cart.length > 0 && (
                <button 
                  onClick={() => setCart([])}
                  className="p-1.5 text-[#9096a0] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  title="Clear Cart"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar bg-white">
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
                    className="p-3 bg-white border border-[#e4e6e9] rounded-[10px] hover:border-[#d0d3d8] transition-all shadow-[0_2px_6px_rgba(20,20,30,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 bg-[#f8f9fa] rounded-lg flex items-center justify-center border border-[#e4e6e9] shrink-0">
                          {item.image ? (
                            <img src={item.image} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-4 h-4 text-[#9096a0]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-[#1a1c20] truncate leading-tight">{item.name}</h4>
                          <p className="text-[11px] text-[#1a8a5f] font-semibold mt-0.5">
                            {currency} {item.price.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-[#1a1c20]">
                          {currency} {(item.price * item.quantity).toLocaleString()}
                        </p>
                        {isMax && (
                          <span className="text-[8px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Max Stock</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#e4e6e9]">
                      {/* Quantity Bar */}
                      <div className="flex items-center bg-[#f8f9fa] border border-[#e4e6e9] rounded-lg overflow-hidden h-7">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="px-2 hover:bg-[#e4e6e9] text-[#1a1c20] transition-colors border-r border-[#e4e6e9] h-full flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        
                        <input
                          type="number"
                          min="1"
                          max={maxStock}
                          value={item.quantity}
                          onChange={(e) => setItemQuantityDirect(item.id, parseInt(e.target.value) || 1)}
                          className="w-10 text-[11px] font-bold text-center text-[#1a1c20] bg-transparent outline-none focus:bg-white font-mono"
                        />

                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          disabled={isMax}
                          className={cn(
                            "px-2 transition-colors border-l border-[#e4e6e9] h-full flex items-center justify-center",
                            isMax ? "bg-[#f8f9fa] text-[#9096a0] cursor-not-allowed" : "hover:bg-[#e4e6e9] text-[#1a1c20]"
                          )}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 text-[#9096a0] hover:text-rose-600 transition-colors"
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
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 bg-white">
                <div className="w-14 h-14 flex items-center justify-center text-[#9096a0] mb-2">
                  <Receipt className="w-12 h-12 stroke-[1.2]" />
                </div>
                <p className="text-sm font-medium text-[#6b6f78]">Order basket is empty</p>
                <p className="text-xs text-[#9096a0] mt-1 max-w-[200px]">
                  Click products on the left or press / to search
                </p>
              </div>
            )}
          </div>

          {/* Cart Footer & Calculations */}
          <div className="p-5 bg-white border-t border-[#e4e6e9] space-y-3 shrink-0">
            
            {/* Totals Breakdown */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-sm text-[#6b6f78]">
                <span>Net subtotal</span>
                <span className="font-medium text-[#1a1c20]">{currency} {subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-[#6b6f78]">
                <span>VAT (16%)</span>
                <span className="font-medium text-[#1a1c20]">{currency} {tax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-base sm:text-lg font-bold text-[#1a1c20]">Total payable</span>
                <span className="text-xl sm:text-2xl font-bold text-[#1a1c20]">
                  {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Primary CTA: CHECK OUT */}
            <button
              onClick={handleInitiateCheckout}
              disabled={cart.length === 0 || isProcessing}
              className={cn(
                "w-full h-12 rounded-[10px] font-semibold text-sm transition-all flex items-center justify-center shrink-0",
                cart.length === 0 || isProcessing
                  ? "bg-[#e2e4e8] text-[#9096a0] cursor-not-allowed shadow-none"
                  : "bg-gradient-to-b from-[#22b37a] to-[#189163] text-white shadow-[0_4px_12px_rgba(26,138,95,0.3)] hover:brightness-105 active:scale-[0.99]"
              )}
            >
              <span>Check out</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Floating Order Bar for Mobile/Tablet (< 1280px / xl) */}
      {cart.length > 0 && !showOrderBasketModal && !showConfirmModal && (
        <div 
          onClick={() => setShowOrderBasketModal(true)}
          className="xl:hidden fixed bottom-20 sm:bottom-24 md:bottom-6 left-3 sm:left-6 right-3 sm:left-auto sm:right-6 sm:w-96 z-35 bg-white/95 backdrop-blur-md border border-emerald-300 p-3 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200 cursor-pointer hover:border-emerald-500 transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 uppercase tracking-wide truncate">
                {cart.reduce((s, i) => s + i.quantity, 0)} Items Selected
              </p>
              <p className="text-xs font-black text-emerald-700 font-mono">
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
            className="px-4 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 shadow-sm active:scale-95 transition-all"
          >
            <span>View Order</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================== */}
      {/* MODALS & NOTIFICATIONS                     */}
      {/* ========================================== */}

      {/* 1. CHECKOUT MODAL */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-[#1a1c20] rounded-3xl w-full max-w-lg shadow-[0_12px_36px_rgba(20,20,30,0.18)] border border-[#e4e6e9] overflow-hidden flex flex-col p-6 space-y-5 text-left"
            >
              {/* Header & Step Indicator */}
              <div className="flex justify-between items-center pb-3.5 border-b border-[#e4e6e9]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1a8a5f] uppercase tracking-wider">Checkout</span>
                    <span className="text-[#9096a0] font-bold">•</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                        checkoutStep === 'confirm' 
                          ? "bg-[#1a8a5f] text-white shadow-2xs" 
                          : "bg-[#e6f7f0] text-[#1a8a5f] border border-[#c3ecd8]"
                      )}>
                        1. Confirm {checkoutStep === 'payment' && '✓'}
                      </span>
                      <ChevronRight className="w-3 h-3 text-[#9096a0]" />
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                        checkoutStep === 'payment' 
                          ? "bg-[#1a8a5f] text-white shadow-2xs" 
                          : "bg-[#f8f9fa] text-[#6b6f78] border border-[#e4e6e9]"
                      )}>
                        2. Payment
                      </span>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-[#1a1c20] uppercase tracking-wide">
                    {checkoutStep === 'confirm' ? 'Confirm Order Details' : 'Select Payment & Settle'}
                  </h3>
                </div>

                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className="p-1.5 hover:bg-[#f8f9fa] rounded-full text-[#9096a0] hover:text-[#1a1c20] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* STEP 1: CONFIRM ORDER */}
              {checkoutStep === 'confirm' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Customer Assignment Card */}
                  <div className="bg-[#f8f9fa] p-4 rounded-2xl border border-[#e4e6e9] space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-[#6b6f78] uppercase tracking-wider flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-[#1a8a5f]" /> Customer Assigned
                        </p>
                        <p className="text-sm font-bold text-[#1a1c20] mt-0.5 flex items-center gap-2">
                          <span>{customerName}</span>
                          {customerPhone && <span className="text-xs text-[#6b6f78] font-mono font-normal">({customerPhone})</span>}
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
                            className="px-2.5 py-1 bg-white hover:bg-[#f8f9fa] text-[#1a1c20] text-[10px] font-bold rounded-lg uppercase tracking-wider border border-[#e4e6e9] transition-colors shadow-2xs"
                          >
                            Walk-in
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setShowCustomerModal(true)}
                          className="px-3 py-1 bg-[#e6f7f0] hover:bg-[#d5f3e4] border border-[#c3ecd8] text-[#1a8a5f] text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 shadow-2xs"
                        >
                          <Users className="w-3 h-3" />
                          {customerName === 'Walk-in Customer' ? 'Assign Customer' : 'Change'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Order List */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-[#6b6f78] uppercase tracking-wider">
                      <span>Itemized Order ({cart.length} SKUs)</span>
                      <span>Total Units: {cart.reduce((sum, i) => sum + i.quantity, 0)}</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-[#e4e6e9] rounded-2xl bg-white p-3 space-y-2 text-xs divide-y divide-[#e4e6e9]">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-[#1a1c20] text-xs pt-2 first:pt-0">
                          <div className="min-w-0 pr-2">
                            <p className="truncate font-bold text-[#1a1c20]">{item.name}</p>
                            <p className="text-[10px] text-[#9096a0] font-mono">{item.sku || 'No SKU'} • {currency} {item.price.toLocaleString()} each</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono text-xs text-[#6b6f78] mr-2 font-bold">{item.quantity}x</span>
                            <span className="font-bold text-[#1a1c20] font-mono">{currency} {(item.quantity * item.price).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Bar */}
                  <div className="p-4 bg-[#f8f9fa] border border-[#e4e6e9] rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-[#9096a0] uppercase tracking-wider block">Total Amount Due</span>
                    </div>
                    <span className="text-xl font-bold font-mono text-[#1a8a5f]">
                      {currency} {total.toLocaleString()}
                    </span>
                  </div>

                  {/* Proceed to Payment CTA */}
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutStep('payment');
                      setCashTendered(total);
                    }}
                    className="w-full h-12 bg-gradient-to-b from-[#22b37a] to-[#189163] hover:brightness-105 active:scale-[0.99] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-[0_2px_8px_rgba(26,138,95,0.25)] flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* STEP 2: PAYMENT & SETTLEMENT */}
              {checkoutStep === 'payment' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Payment Method Selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'cash', label: 'Cash', icon: Banknote },
                      { id: 'mpesa', label: 'M-Pesa', icon: Smartphone },
                      { id: 'card', label: 'Card', icon: CreditCard },
                    ].map(method => {
                      const Icon = method.icon;
                      const isSelected = paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id)}
                          className={cn(
                            "py-3 px-2 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 shadow-2xs",
                            isSelected
                              ? "bg-[#e6f7f0] border-[#1a8a5f] text-[#1a8a5f] ring-2 ring-[#1a8a5f]/20 font-bold"
                              : "bg-white border-[#e4e6e9] text-[#6b6f78] hover:bg-[#f8f9fa] hover:text-[#1a1c20]"
                          )}
                        >
                          <Icon className={cn("w-5 h-5", isSelected ? "text-[#1a8a5f]" : "text-[#9096a0]")} />
                          <span className="text-xs uppercase font-bold tracking-wider">{method.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* CASH PAYMENT FLOW */}
                  {paymentMethod === 'cash' && (
                    <div className="p-4 bg-[#f8f9fa] border border-[#e4e6e9] rounded-2xl space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-xs font-bold text-[#1a1c20]">
                        <span className="flex items-center gap-1.5">
                          <Coins className="w-4 h-4 text-amber-500" /> Cash Tendered
                        </span>
                        {changeDue > 0 ? (
                          <span className="text-[#1a8a5f] font-bold bg-[#e6f7f0] px-2.5 py-0.5 rounded-md border border-[#c3ecd8] font-mono text-xs">
                            Change Due: {currency} {changeDue.toLocaleString()}
                          </span>
                        ) : isCashInsufficient ? (
                          <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 font-mono text-[10px]">
                            Short by: {currency} {(total - numericTendered).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[#9096a0] font-mono text-[11px]">Exact Amount</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#9096a0]">{currency}</span>
                          <input
                            type="number"
                            placeholder={total.toString()}
                            value={cashTendered}
                            onChange={(e) => setCashTendered(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full h-11 pl-10 pr-3 bg-white border border-[#e4e6e9] rounded-xl text-sm font-mono font-bold text-[#1a1c20] outline-none focus:border-[#1a8a5f] focus:ring-2 focus:ring-[#1a8a5f]/20 transition-all"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => setCashTendered(total)}
                          className="px-4 h-11 bg-white hover:bg-[#f8f9fa] text-[#1a1c20] text-xs font-bold rounded-xl uppercase tracking-wider transition-colors shrink-0 border border-[#e4e6e9] shadow-2xs"
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
                            className="px-3 py-1 bg-white hover:bg-[#e6f7f0] hover:text-[#1a8a5f] border border-[#e4e6e9] text-[#1a1c20] rounded-lg text-xs font-bold font-mono transition-all shrink-0 shadow-2xs"
                          >
                            +{val}
                          </button>
                        ))}
                      </div>

                      {isCashInsufficient && (
                        <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 pt-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Please tender at least {currency} {total.toLocaleString()} to complete sale.
                        </p>
                      )}
                    </div>
                  )}

                  {/* M-PESA PAYMENT FLOW */}
                  {paymentMethod === 'mpesa' && (
                    <div className="bg-[#f8f9fa] border border-[#e4e6e9] p-4 rounded-2xl space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-[#e6f7f0] border border-[#c3ecd8] text-[#1a8a5f] flex items-center justify-center">
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#1a1c20] uppercase tracking-wide">M-Pesa Express (STK Push)</p>
                            <p className="text-[10px] text-[#6b6f78] font-medium">Send prompt directly to customer phone</p>
                          </div>
                        </div>
                        <span className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border",
                          stkStatus === 'confirmed' ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                          stkStatus === 'sent' ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse" :
                          stkStatus === 'sending' ? "bg-blue-100 text-blue-800 border-blue-300" :
                          "bg-white text-[#6b6f78] border-[#e4e6e9]"
                        )}>
                          {stkStatus === 'confirmed' ? '✓ Paid' :
                           stkStatus === 'sent' ? '● Awaiting PIN...' :
                           stkStatus === 'sending' ? 'Sending...' : 'Ready'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Phone className="w-3.5 h-3.5 text-[#9096a0] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            placeholder="e.g. 0712345678"
                            value={mpesaPhone}
                            onChange={(e) => {
                              setMpesaPhone(e.target.value);
                              if (stkStatus === 'confirmed') setStkStatus('idle');
                            }}
                            className="w-full h-10 pl-9 pr-3 bg-white border border-[#e4e6e9] rounded-xl text-xs font-mono font-bold text-[#1a1c20] outline-none focus:border-[#1a8a5f] transition-colors shadow-2xs"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleSendStk}
                          disabled={!mpesaPhone.trim() || stkStatus === 'sending'}
                          className={cn(
                            "h-10 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-xs",
                            stkStatus === 'confirmed'
                              ? "bg-[#f8f9fa] text-[#1a1c20] border border-[#e4e6e9] hover:bg-[#e4e6e9]"
                              : "bg-gradient-to-b from-[#22b37a] to-[#189163] text-white hover:brightness-105"
                          )}
                        >
                          {stkStatus === 'sending' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>SEND STK</span>
                            </>
                          )}
                        </button>
                      </div>

                      {(stkStatus === 'confirmed' || mpesaCode) && (
                        <div className="bg-[#e6f7f0] border border-[#c3ecd8] p-3 rounded-xl space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#1a1c20] uppercase">M-Pesa Ref Code:</span>
                            <input
                              type="text"
                              value={mpesaCode}
                              onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                              placeholder="e.g. QK89X0P1"
                              className="flex-1 h-8 px-2 bg-white border border-[#c3ecd8] rounded-lg font-mono font-bold text-xs text-[#1a8a5f] uppercase outline-none focus:border-[#1a8a5f]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CARD PAYMENT FLOW */}
                  {paymentMethod === 'card' && (
                    <div className="bg-[#f8f9fa] border border-[#e4e6e9] p-4 rounded-2xl space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1a1c20] uppercase tracking-wide">POS Card Terminal</p>
                          <p className="text-[10px] text-[#6b6f78] font-medium">Swipe/Tap customer debit or credit card</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#1a1c20] uppercase">Auth Code:</span>
                        <input
                          type="text"
                          placeholder="e.g. AUTH-88912"
                          value={cardAuthCode}
                          onChange={(e) => setCardAuthCode(e.target.value)}
                          className="flex-1 h-9 px-3 bg-white border border-[#e4e6e9] rounded-xl text-xs font-mono font-bold text-[#1a1c20] outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 2 Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('confirm')}
                      className="px-4 h-12 bg-[#f8f9fa] hover:bg-[#e4e6e9] text-[#1a1c20] rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-[#e4e6e9]"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteSale}
                      disabled={isProcessing || isCashInsufficient}
                      className="flex-1 h-12 bg-gradient-to-b from-[#22b37a] to-[#189163] hover:brightness-105 active:scale-[0.99] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-[0_2px_8px_rgba(26,138,95,0.25)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing Sale...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Complete Sale ({currency} {total.toLocaleString()})</span>
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

      {/* 2. CUSTOMER MODAL */}
      <AnimatePresence>
        {showCustomerModal && (
          <div className="fixed inset-0 z-[135] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-[#1a1c20] rounded-3xl w-full max-w-md shadow-[0_12px_36px_rgba(20,20,30,0.18)] border border-[#e4e6e9] overflow-hidden flex flex-col p-6 space-y-4 text-left"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#e4e6e9]">
                <h3 className="text-base font-bold text-[#1a1c20] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#1a8a5f]" />
                  Assign Customer
                </h3>
                <button 
                  onClick={() => setShowCustomerModal(false)}
                  className="p-1.5 hover:bg-[#f8f9fa] rounded-full text-[#9096a0] hover:text-[#1a1c20] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="flex bg-[#f1f2f4] p-1 rounded-xl border border-[#e4e6e9]">
                <button
                  onClick={() => setCustModalTab('select')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5",
                    custModalTab === 'select' 
                      ? "bg-white text-[#1a1c20] shadow-2xs" 
                      : "text-[#6b6f78] hover:text-[#1a1c20]"
                  )}
                >
                  <Users className="w-3.5 h-3.5 text-[#1a8a5f]" /> Select Customer
                </button>
                <button
                  onClick={() => setCustModalTab('create')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5",
                    custModalTab === 'create' 
                      ? "bg-white text-[#1a1c20] shadow-2xs" 
                      : "text-[#6b6f78] hover:text-[#1a1c20]"
                  )}
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#1a8a5f]" /> Add New
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
                      "w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between group shadow-2xs",
                      customerName === 'Walk-in Customer'
                        ? "bg-[#e6f7f0] border-[#1a8a5f] text-[#1a8a5f] font-bold"
                        : "bg-white border-[#e4e6e9] hover:border-[#d0d3d8] text-[#1a1c20]"
                    )}
                  >
                    <div>
                      <p className="text-xs font-bold uppercase">Walk-in Customer</p>
                      <p className="text-[10px] text-[#6b6f78] mt-0.5">Default retail walk-in customer</p>
                    </div>
                    {customerName === 'Walk-in Customer' && (
                      <Check className="w-4 h-4 text-[#1a8a5f]" />
                    )}
                  </button>

                  {/* Search Existing Customers */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#9096a0] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search customer by name or phone..."
                      value={custSearchQuery}
                      onChange={(e) => setCustSearchQuery(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 bg-white border border-[#e4e6e9] rounded-xl text-xs text-[#1a1c20] placeholder-[#9096a0] outline-none focus:border-[#1a8a5f]"
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
                            "p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between shadow-2xs",
                            isSelected 
                              ? "bg-[#e6f7f0] border-[#1a8a5f] text-[#1a8a5f] font-bold" 
                              : "bg-white border-[#e4e6e9] hover:border-[#d0d3d8] text-[#1a1c20]"
                          )}
                        >
                          <div>
                            <p className="text-xs font-bold text-[#1a1c20]">{c.name}</p>
                            <p className="text-[10px] text-[#9096a0] font-mono mt-0.5">{c.phone || 'No phone'} {c.email ? `• ${c.email}` : ''}</p>
                          </div>
                          <span className="text-[10px] font-bold text-[#1a8a5f] bg-[#e6f7f0] px-2 py-0.5 rounded border border-[#c3ecd8]">
                            Select
                          </span>
                        </div>
                      );
                    })}

                    {filteredCustomers.length === 0 && (
                      <p className="text-center text-xs text-[#9096a0] py-6">
                        No saved customers found matching "{custSearchQuery}"
                      </p>
                    )}
                  </div>
                </div>
              )}

              {custModalTab === 'create' && (
                <form onSubmit={handleSaveNewCustomer} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#6b6f78] uppercase tracking-wider mb-1">
                      Customer / Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jane Doe or Acme Ltd"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-[#e4e6e9] rounded-xl text-xs font-bold text-[#1a1c20] outline-none focus:border-[#1a8a5f]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#6b6f78] uppercase tracking-wider mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+254 700 000000"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-[#e4e6e9] rounded-xl text-xs font-bold text-[#1a1c20] outline-none focus:border-[#1a8a5f]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#6b6f78] uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="client@example.com"
                      value={newCustEmail}
                      onChange={(e) => setNewCustEmail(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-[#e4e6e9] rounded-xl text-xs font-bold text-[#1a1c20] outline-none focus:border-[#1a8a5f]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setCustModalTab('select')}
                      className="flex-1 h-10 bg-[#f8f9fa] hover:bg-[#e4e6e9] text-[#1a1c20] rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-[#e4e6e9]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingCust || !newCustName.trim()}
                      className="flex-1 h-10 bg-gradient-to-b from-[#22b37a] to-[#189163] hover:brightness-105 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-[0_2px_8px_rgba(26,138,95,0.25)] flex items-center justify-center"
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
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-[#1a1c20] rounded-3xl w-full max-w-md shadow-[0_12px_36px_rgba(20,20,30,0.18)] border border-[#e4e6e9] overflow-hidden flex flex-col p-6 space-y-4 text-left"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#e4e6e9]">
                <h3 className="text-base font-bold text-[#1a1c20] flex items-center gap-2">
                  <Scan className="w-5 h-5 text-[#1a8a5f]" />
                  Barcode / SKU Scanner
                </h3>
                <button 
                  onClick={() => setShowScannerModal(false)}
                  className="p-1.5 hover:bg-[#f8f9fa] rounded-full text-[#9096a0] hover:text-[#1a1c20] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleBarcodeSubmit} className="space-y-4">
                <p className="text-xs text-[#6b6f78] font-medium">
                  Scan barcode using USB handheld scanner or type barcode / SKU directly:
                </p>

                <div className="relative">
                  <Scan className="w-4 h-4 text-[#9096a0] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={scannerInputRef}
                    autoFocus
                    type="text"
                    placeholder="Scan or enter barcode number..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full h-12 pl-10 pr-3 bg-white border border-[#e4e6e9] rounded-xl text-sm font-mono font-bold text-[#1a1c20] outline-none focus:border-[#1a8a5f]"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScannerModal(false)}
                    className="flex-1 h-11 bg-[#f8f9fa] hover:bg-[#e4e6e9] text-[#1a1c20] rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-[#e4e6e9]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-11 bg-gradient-to-b from-[#22b37a] to-[#189163] hover:brightness-105 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-[0_2px_8px_rgba(26,138,95,0.25)]"
                  >
                    Add Product
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. HELD BASKETS MODAL */}
      <AnimatePresence>
        {showHeldModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-[#1a1c20] rounded-3xl w-full max-w-lg shadow-[0_12px_36px_rgba(20,20,30,0.18)] border border-[#e4e6e9] overflow-hidden flex flex-col p-6 space-y-4 text-left max-h-[85vh]"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#e4e6e9]">
                <div>
                  <h3 className="text-base font-bold text-[#1a1c20] flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-[#1a8a5f]" />
                    Held Orders ({heldCarts.length})
                  </h3>
                  <p className="text-xs text-[#6b6f78] font-medium">Resume or remove pending customer orders</p>
                </div>
                <button 
                  onClick={() => setShowHeldModal(false)}
                  className="p-1.5 hover:bg-[#f8f9fa] rounded-full text-[#9096a0] hover:text-[#1a1c20] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 overflow-y-auto flex-1 no-scrollbar">
                {heldCarts.map((held) => (
                  <div key={held.id} className="p-4 bg-[#f8f9fa] border border-[#e4e6e9] rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                    <div>
                      <p className="text-xs font-bold text-[#1a1c20]">{held.customerName || 'Walk-in Customer'}</p>
                      <p className="text-[10px] text-[#6b6f78] font-mono mt-0.5">
                        {held.items.length} SKUs • Held at {held.timestamp}
                      </p>
                      <p className="text-xs font-bold font-mono text-[#1a8a5f] mt-1">
                        {currency} {held.total.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteHeldCart(held.id)}
                        className="p-2 text-[#9096a0] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Delete Held Cart"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRestoreHeldCart(held)}
                        className="px-3.5 py-1.5 bg-gradient-to-b from-[#22b37a] to-[#189163] hover:brightness-105 text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-all shadow-[0_2px_8px_rgba(26,138,95,0.25)]"
                      >
                        Resume
                      </button>
                    </div>
                  </div>
                ))}

                {heldCarts.length === 0 && (
                  <div className="text-center py-10 space-y-1">
                    <Pause className="w-8 h-8 text-[#9096a0] mx-auto" />
                    <p className="text-xs font-bold text-[#1a1c20] uppercase tracking-wider">No Held Orders</p>
                    <p className="text-[10px] text-[#6b6f78]">Park a cart by clicking "Hold" on the order panel.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. SUCCESS POPUP */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[140] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-[#1a8a5f] text-white px-8 py-5 rounded-2xl shadow-2xl flex flex-col items-center gap-2 border border-[#1a8a5f] pointer-events-auto">
               <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-white" />
               </div>
               <div className="text-center">
                  <h3 className="text-lg font-bold uppercase tracking-wider">Sale Completed!</h3>
                  <p className="text-xs font-medium opacity-90 uppercase tracking-wider mt-0.5">Receipt generated & stock updated</p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. STANDARDIZED & PROFESSIONAL RECEIPT & INVOICE PRINT DIALOG */}
      <AnimatePresence>
        {completedSale && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #pos-printable-receipt, #pos-printable-receipt * {
                  visibility: visible !important;
                }
                #pos-printable-receipt {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  background: white !important;
                  color: black !important;
                  box-shadow: none !important;
                  border: none !important;
                  padding: 10px !important;
                  margin: 0 !important;
                }
                ${printType === 'receipt' ? `
                  #pos-printable-receipt {
                    width: 76mm !important;
                    max-width: 76mm !important;
                    font-size: 11px !important;
                    line-height: 1.2 !important;
                    padding: 4px !important;
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
              className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl border border-[#e4e6e9] overflow-hidden my-8 flex flex-col md:flex-row h-[85vh] text-left"
            >
              {/* Left Column: Action controls */}
              <div className="p-6 border-b md:border-b-0 md:border-r border-[#e4e6e9] flex flex-col justify-between md:w-[320px] bg-[#f8f9fa] shrink-0">
                <div className="space-y-5">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#e6f7f0] text-[#1a8a5f] rounded-full text-[10px] font-bold uppercase tracking-wider border border-[#c3ecd8]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Checkout Success
                    </span>
                    <h3 className="text-xl font-bold text-[#1a1c20] uppercase tracking-tight mt-3">Print Documents</h3>
                    <p className="text-xs text-[#6b6f78] font-semibold mt-1">Select document format below.</p>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => setPrintType('receipt')}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all text-left",
                        printType === 'receipt'
                          ? "bg-[#1a8a5f] border-[#1a8a5f] text-white shadow-xs"
                          : "bg-white border-[#e4e6e9] text-[#1a1c20] hover:bg-[#f8f9fa]"
                      )}
                    >
                      <Receipt className="w-4 h-4" />
                      Thermal Receipt (76mm/80mm)
                    </button>
                    <button
                      onClick={() => setPrintType('invoice')}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all text-left",
                        printType === 'invoice'
                          ? "bg-[#1a8a5f] border-[#1a8a5f] text-white shadow-xs"
                          : "bg-white border-[#e4e6e9] text-[#1a1c20] hover:bg-[#f8f9fa]"
                      )}
                    >
                      <FileText className="w-4 h-4" />
                      Standard Sales Invoice (A4)
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-[#e4e6e9]">
                  <button
                    onClick={handlePrintPOS}
                    className="w-full h-12 bg-gradient-to-b from-[#22b37a] to-[#189163] hover:brightness-105 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_2px_8px_rgba(26,138,95,0.25)]"
                  >
                    <Printer className="w-4 h-4" /> Print Document
                  </button>
                  <button
                    onClick={() => setCompletedSale(null)}
                    className="w-full h-10 bg-white hover:bg-[#f8f9fa] text-[#1a1c20] rounded-xl font-bold text-xs uppercase tracking-wider transition-all border border-[#e4e6e9]"
                  >
                    Next Sale
                  </button>
                </div>
              </div>

              {/* Right Column: Standardized & Professional Receipt Preview */}
              <div className="flex-1 bg-[#f1f2f4] p-6 overflow-y-auto flex items-start justify-center">
                <div 
                  id="pos-printable-receipt" 
                  className="bg-white p-7 shadow-lg border border-[#e4e6e9] rounded-2xl w-full max-w-[420px] text-xs font-mono text-[#1a1c20]"
                >
                  {/* Header: Store Identity */}
                  <div className="text-center pb-4 border-b border-dashed border-[#e4e6e9] space-y-1">
                    <h2 className="text-base sm:text-lg font-bold text-[#1a1c20] uppercase tracking-tight">{storeDisplayName}</h2>
                    <p className="text-[11px] text-[#6b6f78] font-sans font-medium">{storeAddress}</p>
                    <p className="text-[10px] text-[#9096a0] font-sans">Tel: {storePhone} • PIN: {storeTaxPin}</p>
                    <div className="pt-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-[#1a1c20] text-white px-2.5 py-0.5 rounded">
                        OFFICIAL SALES RECEIPT
                      </span>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="py-3 border-b border-dashed border-[#e4e6e9] space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[#6b6f78]">Receipt No:</span>
                      <span className="font-bold text-[#1a1c20] font-mono">{completedSale.receiptId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6b6f78]">Date & Time:</span>
                      <span className="font-medium text-[#1a1c20]">{new Date().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6b6f78]">Cashier:</span>
                      <span className="font-bold text-[#1a1c20]">{userName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6b6f78]">Customer:</span>
                      <span className="font-bold text-[#1a1c20]">{completedSale.customerName}</span>
                    </div>
                    {completedSale.customerPhone && (
                      <div className="flex justify-between">
                        <span className="text-[#6b6f78]">Phone:</span>
                        <span className="font-medium text-[#1a1c20]">{completedSale.customerPhone}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#6b6f78]">Payment:</span>
                      <span className="font-bold uppercase text-[#1a8a5f]">{completedSale.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Line Items Table with Graceful Word Wrapping for Long Names */}
                  <div className="py-3 space-y-2 border-b border-dashed border-[#e4e6e9]">
                    <div className="grid grid-cols-[1fr_50px_70px_70px] font-bold text-[10px] text-[#6b6f78] uppercase tracking-wider border-b border-[#e4e6e9] pb-1">
                      <span>Item / SKU</span>
                      <span className="text-center">Qty</span>
                      <span className="text-right">Price</span>
                      <span className="text-right">Total</span>
                    </div>

                    {completedSale.items.map((item: any) => (
                      <div key={item.id} className="grid grid-cols-[1fr_50px_70px_70px] text-[11px] gap-1 items-start py-0.5">
                        <div className="min-w-0 pr-1">
                          <p className="font-bold text-[#1a1c20] break-words whitespace-normal leading-snug">{item.name}</p>
                          {item.sku && <p className="text-[9px] text-[#9096a0] font-mono">SKU: {item.sku}</p>}
                        </div>
                        <span className="text-center text-[#1a1c20] font-bold">{item.quantity}</span>
                        <span className="text-right text-[#6b6f78] font-mono">{currency}{item.price.toLocaleString()}</span>
                        <span className="text-right font-bold text-[#1a1c20] font-mono">{currency}{(item.quantity * item.price).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Financial Summary */}
                  <div className="py-3 space-y-1.5 border-b border-dashed border-[#e4e6e9] text-[11px]">
                    {completedSale.discountAmount > 0 && (
                      <div className="flex justify-between text-[#6b6f78]">
                        <span>Gross Subtotal:</span>
                        <span>{currency}{(completedSale.rawTotal || completedSale.total).toLocaleString()}</span>
                      </div>
                    )}
                    {completedSale.discountAmount > 0 && (
                      <div className="flex justify-between text-[#1a8a5f] font-semibold">
                        <span>Discount ({completedSale.discountPercent}%):</span>
                        <span>-{currency}{(completedSale.discountAmount).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#6b6f78]">
                      <span>Subtotal (Excl. VAT):</span>
                      <span>{currency}{(completedSale.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-[#6b6f78]">
                      <span>VAT (16% Included):</span>
                      <span>{currency}{(completedSale.tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm sm:text-base font-bold text-[#1a1c20] pt-1.5 border-t border-[#e4e6e9]">
                      <span>TOTAL PAID:</span>
                      <span className="text-[#1a8a5f] font-mono">{currency}{(completedSale.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    
                    {completedSale.paymentMethod === 'cash' && completedSale.cashTendered > 0 && (
                      <>
                        <div className="flex justify-between text-[#6b6f78] pt-1 text-[11px]">
                          <span>Cash Tendered:</span>
                          <span className="font-bold">{currency}{(completedSale.cashTendered).toLocaleString()}</span>
                        </div>
                        {completedSale.changeDue > 0 && (
                          <div className="flex justify-between text-[#1a8a5f] font-bold text-[11px]">
                            <span>Change Due:</span>
                            <span>{currency}{(completedSale.changeDue).toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}

                    {completedSale.paymentMethod === 'mpesa' && completedSale.mpesaCode && (
                      <div className="flex justify-between text-[#6b6f78] font-mono text-[10px] pt-1">
                        <span>M-Pesa Ref:</span>
                        <span className="font-bold">{completedSale.mpesaCode}</span>
                      </div>
                    )}
                  </div>

                  {/* Receipt Footer */}
                  <div className="py-4 text-center space-y-1">
                    <p className="text-[10px] font-bold text-[#1a1c20] uppercase">Thank you for shopping with us!</p>
                    <p className="text-[9px] text-[#6b6f78]">Goods once sold are not returnable without valid receipt.</p>
                    <p className="text-[8px] text-[#9096a0] pt-2 font-mono uppercase tracking-widest">--- POWERED BY INVENTORY PRO ---</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. ACTIVE ORDER BASKET DRAWER (Triggered by 'View Order') */}
      {showOrderBasketModal && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="absolute inset-0"
            onClick={() => setShowOrderBasketModal(false)}
          />

          <motion.div 
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative z-10 w-full sm:max-w-md md:max-w-lg lg:max-w-xl h-[92vh] sm:h-[94vh] max-h-[880px] bg-white border-t sm:border border-[#e4e6e9] rounded-t-3xl sm:rounded-3xl shadow-[0_12px_36px_rgba(20,20,30,0.18)] flex flex-col overflow-hidden text-left"
          >
            {/* Drawer Header */}
            <div className="px-4 py-3.5 border-b border-[#e4e6e9] flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 bg-gradient-to-b from-[#22b37a] to-[#189163] text-white rounded-xl flex items-center justify-center shadow-xs shrink-0">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-[#1a1c20] uppercase tracking-tight truncate">
                      Active Order Basket
                    </h2>
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-[#e6f7f0] text-[#1a8a5f] border border-[#c3ecd8] rounded-full shrink-0">
                      {cart.reduce((s, i) => s + i.quantity, 0)} Items
                    </span>
                  </div>
                  <p className="text-[10px] text-[#6b6f78] font-semibold truncate">
                    Review and complete sale
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  type="button"
                  onClick={handleHoldCart}
                  disabled={cart.length === 0}
                  className="px-2.5 py-1 bg-white hover:bg-[#f8f9fa] border border-[#e4e6e9] rounded-lg text-[10px] font-bold text-[#6b6f78] uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1 shadow-2xs"
                  title="Hold Basket"
                >
                  <Pause className="w-3 h-3 text-amber-500" />
                  <span className="hidden min-[400px]:inline">Hold</span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setShowOrderBasketModal(false);
                    setShowHeldModal(true);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-[#f8f9fa] border border-[#e4e6e9] rounded-lg text-[10px] font-bold text-[#6b6f78] uppercase tracking-wider transition-all flex items-center gap-1 shadow-2xs relative"
                  title="View Held Baskets"
                >
                  <RotateCcw className="w-3 h-3 text-[#1a8a5f]" />
                  <span className="hidden min-[400px]:inline">Held</span>
                  {heldCarts.length > 0 && (
                    <span className="px-1.5 py-0.2 bg-[#1a8a5f] text-white text-[9px] rounded-full font-mono">
                      {heldCarts.length}
                    </span>
                  )}
                </button>

                <button 
                  type="button"
                  onClick={() => setCart([])}
                  disabled={cart.length === 0}
                  className="p-1.5 text-[#9096a0] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-40"
                  title="Clear Cart"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button 
                  type="button"
                  onClick={() => setShowOrderBasketModal(false)}
                  className="p-1.5 hover:bg-[#f8f9fa] rounded-full text-[#9096a0] hover:text-[#1a1c20] transition-colors ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Item list in drawer */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar bg-[#f8f9fa]">
              {cart.map((item) => (
                <div key={item.id} className="p-3 bg-white border border-[#e4e6e9] rounded-xl shadow-2xs flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-[#1a1c20] truncate">{item.name}</h4>
                    <p className="text-[10px] text-[#1a8a5f] font-mono font-bold mt-0.5">
                      {currency} {item.price.toLocaleString()} x {item.quantity} = {currency} {(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-[#f8f9fa] border border-[#e4e6e9] rounded-lg overflow-hidden h-7">
                      <button 
                        onClick={() => updateQuantity(item.id, -1)}
                        className="px-2 hover:bg-[#e4e6e9] text-[#1a1c20] transition-colors border-r border-[#e4e6e9] h-full flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-[11px] font-bold text-center text-[#1a1c20] font-mono">
                        {item.quantity}
                      </span>
                      <button 
                        onClick={() => updateQuantity(item.id, 1)}
                        className="px-2 hover:bg-[#e4e6e9] text-[#1a1c20] transition-colors border-l border-[#e4e6e9] h-full flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="p-1 text-[#9096a0] hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-[#e4e6e9] space-y-3 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-[#1a1c20] uppercase">TOTAL PAYABLE:</span>
                <span className="text-xl font-bold text-[#1a8a5f] font-mono">
                  {currency} {total.toLocaleString()}
                </span>
              </div>

              <button
                onClick={() => {
                  setShowOrderBasketModal(false);
                  handleInitiateCheckout();
                }}
                disabled={cart.length === 0}
                className="w-full h-12 bg-gradient-to-b from-[#22b37a] to-[#189163] hover:brightness-105 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-[0_2px_8px_rgba(26,138,95,0.25)] flex items-center justify-center gap-2"
              >
                <span>CHECK OUT</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
