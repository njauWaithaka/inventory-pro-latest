import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Plus, FileText, Download, 
  ChevronDown, Calendar, User, CheckCircle2, 
  ArrowUpRight, Loader2, X, Package, 
  Trash2, ShoppingCart, Minus, Printer,
  Activity, Layers, Waves, Droplets, Plug, Sun, Sprout,
  Building, CreditCard, ShieldCheck, Truck, Sparkles, MapPin, Phone, Mail, Award
} from 'lucide-react';
import { collection, onSnapshot, query, setDoc, doc, updateDoc, getDocs, orderBy, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface QuotationItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  sku: string;
  vatRate: number; // custom VAT rate for this item (default 16%)
}

const statusStyles = {
  sent: "bg-blue-50 text-blue-600 border-blue-100",
  accepted: "bg-emerald-50 text-emerald-600 border-emerald-100",
  expired: "bg-rose-50 text-rose-600 border-rose-100",
  draft: "bg-slate-50 text-slate-500 border-slate-100",
  converted: "bg-indigo-50 text-indigo-600 border-indigo-100",
  rejected: "bg-red-50 text-red-600 border-red-100",
};

// Corporate/Inventory Pro themed Logo
interface BrandLogoProps {
  companyName?: string;
}

const BrandLogo = ({ companyName }: BrandLogoProps) => {
  const name = (companyName || 'INVENTORYPRO CO.').toUpperCase();
  const words = name.split(' ');
  const part1 = words[0] || 'INVENTORY';
  const part2 = words.slice(1).join(' ') || 'PRO';

  return (
    <div className="border border-emerald-900 p-2 font-sans max-w-[230px] bg-white inline-block">
      <div className="relative bg-emerald-600 text-white p-2.5 font-black tracking-tighter text-xs flex flex-col items-start leading-none overflow-hidden rounded-sm">
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-extrabold border border-white px-1 py-0.5 rounded-sm bg-emerald-700">IP</span>
          <span className="text-xs uppercase tracking-wider font-extrabold">{part1}</span>
        </div>
        <span className="text-[14px] uppercase tracking-widest font-black mt-1 text-emerald-100">{part2}</span>
        <div className="absolute right-0 bottom-0 top-0 w-12 opacity-10 flex flex-col justify-around pointer-events-none">
          <div className="h-0.5 bg-white rounded-full w-full transform rotate-12"></div>
          <div className="h-0.5 bg-white rounded-full w-full transform -rotate-12"></div>
          <div className="h-0.5 bg-white rounded-full w-full transform rotate-12"></div>
        </div>
      </div>
      <div className="text-[9px] text-emerald-800 italic font-bold mt-1 text-center">
        Business <span className="font-sans font-extrabold text-emerald-600">Inventory</span> Solutions
      </div>
    </div>
  );
};

// High-fidelity Footer Icons themed around InventoryPro
const FooterIcons = () => {
  const items = [
    { name: 'Products', icon: <Package className="w-4 h-4 text-emerald-600" /> },
    { name: 'Quotations', icon: <FileText className="w-4 h-4 text-emerald-600" /> },
    { name: 'Logistics', icon: <Truck className="w-4 h-4 text-emerald-600" /> },
    { name: 'Payments', icon: <CreditCard className="w-4 h-4 text-emerald-600" /> },
    { name: 'Security', icon: <ShieldCheck className="w-4 h-4 text-emerald-600" /> },
    { name: 'Enterprise', icon: <Building className="w-4 h-4 text-emerald-600" /> },
  ];
  return (
    <div className="flex justify-around items-center gap-2 py-3 border-t border-slate-200 mt-6 bg-slate-50/50 rounded-xl px-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex flex-col items-center text-center">
          <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center bg-white shadow-sm">
            {item.icon}
          </div>
          <span className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tight">{item.name}</span>
        </div>
      ))}
    </div>
  );
};

export function Quotations() {
  const { user } = useAuth();
  const { profile, company, currency } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewQuotationOpen, setIsNewQuotationOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  // Selected quotation for viewing/printing
  const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);

  // Form tabs for better UX on numerous fields
  const [activeTab, setActiveTab] = useState<'client' | 'terms' | 'bank' | 'supplier'>('client');

  // New Quotation Form States
  const [customerName, setCustomerName] = useState('');
  const [customerAccountNo, setCustomerAccountNo] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [subject, setSubject] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedItems, setSelectedItems] = useState<QuotationItem[]>([]);

  // Supplier details
  const [supplierStore, setSupplierStore] = useState('Dundori Rd Main Store, PO Box 41762-00100, NAIROBI 100');
  const [supplierPhone, setSupplierPhone] = useState('(+254 20) 6968 000, 558335');
  const [supplierEmail, setSupplierEmail] = useState('d&s@dayliff.com');
  const [supplierKraPin, setSupplierKraPin] = useState('P000591252N');

  // Terms
  const [deliveryTerms, setDeliveryTerms] = useState('SUBJECT AVAILABILITY IN STOCK');
  const [validityTerms, setValidityTerms] = useState('SUBJECT TO CONFIRMATION AT DATE OF ORDER');
  const [paymentTerms, setPaymentTerms] = useState('AS PER THE D&S WARRANTY TERMS');
  const [warrantyTerms, setWarrantyTerms] = useState('IN FULL WITH ORDER');

  // Bank details
  const [bankAccountName, setBankAccountName] = useState('Davis & Shirtliff Ltd.');
  const [bankName, setBankName] = useState('Standard Chartered');
  const [bankBranch, setBankBranch] = useState('Chiromo');
  const [bankCurrency, setBankCurrency] = useState('KES');
  const [bankAccountNo, setBankAccountNo] = useState('0104033637700');
  const [bankCode, setBankCode] = useState('02');

  useEffect(() => {
    if (!profile?.companyId) return;
    const path = `companies/${profile.companyId}/quotations`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setQuotations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile?.companyId]);

  useEffect(() => {
    if (isNewQuotationOpen && profile?.companyId) {
      const q = collection(db, `companies/${profile.companyId}/products`);
      getDocs(q).then(snapshot => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      const custQ = collection(db, `companies/${profile.companyId}/customers`);
      getDocs(custQ).then(snapshot => {
        setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      // Pre-fill fields with user/company context
      if (profile?.name) {
        setSalesperson(profile.name);
      }
      if (company?.name) {
        setBankAccountName(company.name);
      } else {
        setBankAccountName('InventoryPro Client');
      }
      if (company?.address) {
        setSupplierStore(company.address);
      } else {
        setSupplierStore('Nairobi, Kenya');
      }
      if (company?.phone) {
        setSupplierPhone(company.phone);
      } else {
        setSupplierPhone('+254 700 000 000');
      }
      if (profile?.email) {
        setSupplierEmail(profile.email);
      } else {
        setSupplierEmail('sales@inventorypro.com');
      }
      if (currency) {
        setBankCurrency(currency === '$' ? 'USD' : currency);
      }

      // Generic business payment & delivery coordinates instead of hardcoded Davis & Shirtliff
      setBankName('KCB Bank Kenya');
      setBankBranch('Nairobi Corporate');
      setBankAccountNo('12938472901');
      setBankCode('01');
      setPaymentTerms('50% ON ORDER, BALANCE ON DELIVERY');
      setWarrantyTerms('1 YEAR MANUFACTURER WARRANTY');
      setDeliveryTerms('IMMEDIATELY UPON LPO CONFIRMATION');
      setValidityTerms('VALID FOR 30 DAYS FROM DATE OF ISSUANCE');
    }
  }, [isNewQuotationOpen, profile?.companyId, company, profile?.name, profile?.email, currency]);

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
        sku: product.sku || '',
        vatRate: 16 // standard Kenya VAT is 16%
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

  const updateItemPrice = (productId: string, price: number) => {
    setSelectedItems(prev => prev.map(item => 
      item.productId === productId ? { ...item, price: Math.max(0, price) } : item
    ));
  };

  const updateItemVat = (productId: string, vatRate: number) => {
    setSelectedItems(prev => prev.map(item => 
      item.productId === productId ? { ...item, vatRate: Math.max(0, vatRate) } : item
    ));
  };

  const calculateSubtotal = () => {
    return selectedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  };

  const calculateVatTotal = () => {
    return selectedItems.reduce((acc, item) => acc + ((item.price * item.quantity) * (item.vatRate / 100)), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateVatTotal();
  };

  const handleSubmitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.companyId || !customerName || selectedItems.length === 0) return;

    setIsSubmitting(true);
    const quotationId = `SQ-${Date.now().toString().slice(-6)}`;
    const subtotal = calculateSubtotal();
    const vatAmount = calculateVatTotal();
    const totalAmount = calculateTotal();
    
    try {
      const quotationData = {
        id: quotationId,
        customer: customerName,
        customerAccountNo: customerAccountNo || '157552',
        customerAddress: customerAddress || 'Kenya',
        subject: subject || 'Water & Energy Supply Solutions',
        salesperson: salesperson || profile?.name || 'Bashir Ouma',
        amount: totalAmount,
        subtotal: subtotal,
        vatAmount: vatAmount,
        status: 'draft',
        date: quotationDate || new Date().toISOString().split('T')[0],
        expiryDate: expiryDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: selectedItems,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        // Supplier details
        supplierStore,
        supplierPhone,
        supplierEmail,
        supplierKraPin,
        // Terms
        deliveryTerms,
        validityTerms,
        paymentTerms,
        warrantyTerms,
        // Bank details
        bankAccountName,
        bankName,
        bankBranch,
        bankCurrency,
        bankAccountNo,
        bankCode
      };

      await setDoc(doc(db, `companies/${profile.companyId}/quotations`, quotationId), quotationData);

      setIsNewQuotationOpen(false);
      // Reset state fields
      setCustomerName('');
      setCustomerAccountNo('');
      setCustomerAddress('');
      setSubject('');
      setSalesperson('');
      setQuotationDate(new Date().toISOString().split('T')[0]);
      setExpiryDate('');
      setSupplierStore('Dundori Rd Main Store, PO Box 41762-00100, NAIROBI 100');
      setSupplierPhone('(+254 20) 6968 000, 558335');
      setSupplierEmail('d&s@dayliff.com');
      setSupplierKraPin('P000591252N');
      setDeliveryTerms('SUBJECT AVAILABILITY IN STOCK');
      setValidityTerms('SUBJECT TO CONFIRMATION AT DATE OF ORDER');
      setPaymentTerms('AS PER THE D&S WARRANTY TERMS');
      setWarrantyTerms('IN FULL WITH ORDER');
      setBankAccountName('Davis & Shirtliff Ltd.');
      setBankName('Standard Chartered');
      setBankBranch('Chiromo');
      setBankCurrency('KES');
      setBankAccountNo('0104033637700');
      setBankCode('02');
      setSelectedItems([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'quotations');
    } finally {
      setIsSubmitting(false);
    }
  };

  const convertToInvoice = async (quotation: any, type: 'standard' | 'proforma') => {
    if (!user || !profile?.companyId) return;
    
    // Prevent duplicate conversions unless explicitly allowed
    if (quotation.status === 'converted' || quotation.convertedTo) {
      const allowMultiple = window.confirm(
        `This quotation (${quotation.id}) has already been converted to invoice ${quotation.convertedTo || ''}.\n\nDo you want to explicitly allow converting it again?`
      );
      if (!allowMultiple) return;
    }

    setIsSubmitting(true);
    
    try {
      const prefix = type === 'standard' ? 'INV' : 'PRO';
      const invoiceId = `${prefix}-${Date.now().toString().slice(-6)}`;
      
      // Determine default payment and invoice status
      let invoiceStatus = type === 'standard' ? 'pending' : 'proforma';
      let paymentStatus = 'unpaid';

      // Ask user to confirm payment immediately if standard invoice
      if (type === 'standard') {
        const confirmPayment = window.confirm(
          `Quotation ${quotation.id} is being converted to Invoice ${invoiceId}.\n\nHas payment been confirmed? Click OK to automatically mark the invoice as Paid, or Cancel to leave it as Unpaid (Pending).`
        );
        if (confirmPayment) {
          invoiceStatus = 'paid';
          paymentStatus = 'paid';
        }
      }

      const invoiceData = {
        id: invoiceId,
        customer: quotation.customer,
        customerAccountNo: quotation.customerAccountNo || '',
        customerAddress: quotation.customerAddress || '',
        subject: quotation.subject || '',
        salesperson: quotation.salesperson || '',
        amount: quotation.amount,
        subtotal: quotation.subtotal || quotation.amount,
        vatAmount: quotation.vatAmount || 0,
        discountAmount: quotation.discountAmount || 0,
        status: invoiceStatus,
        paymentStatus: paymentStatus,
        type: type === 'standard' ? 'standard' : 'proforma',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: quotation.items.map((it: any) => ({
          productId: it.productId,
          name: it.name,
          quantity: it.quantity,
          price: it.price,
          sku: it.sku || '',
          vatRate: it.vatRate ?? 16,
          discount: it.discount || 0,
          tax: it.tax || 0,
          total: it.quantity * it.price
        })),
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        source_type: 'quotation',
        source_id: quotation.id,
        sourceQuotationId: quotation.id,
        sourceQuotationNumber: quotation.id,
        linkToQuotation: quotation.id,

        // Copy terms & notes
        deliveryTerms: quotation.deliveryTerms || '',
        validityTerms: quotation.validityTerms || '',
        paymentTerms: quotation.paymentTerms || '',
        warrantyTerms: quotation.warrantyTerms || '',
        notes: quotation.notes || '',
        terms: quotation.terms || '',

        // Supplier details
        supplierStore: quotation.supplierStore || '',
        supplierPhone: quotation.supplierPhone || '',
        supplierEmail: quotation.supplierEmail || '',
        supplierKraPin: quotation.supplierKraPin || '',

        // Bank details
        bankAccountName: quotation.bankAccountName || '',
        bankName: quotation.bankName || '',
        bankBranch: quotation.bankBranch || '',
        bankCurrency: quotation.bankCurrency || '',
        bankAccountNo: quotation.bankAccountNo || '',
        bankCode: quotation.bankCode || ''
      };

      // 1. Create Invoice
      await setDoc(doc(db, `companies/${profile.companyId}/invoices`, invoiceId), invoiceData);

      // 2. Mark Quotation as converted
      await updateDoc(doc(db, `companies/${profile.companyId}/quotations`, quotation.id), {
        status: 'converted',
        convertedTo: invoiceId,
        converted_at: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 3. Record conversion audit log
      const conversionLogId = `log_conv_${Date.now()}`;
      await setDoc(doc(db, `companies/${profile.companyId}/auditLogs`, conversionLogId), {
        id: conversionLogId,
        eventType: 'quotation_converted',
        action: 'Quotation Converted',
        details: `Quotation ${quotation.id} converted to ${type} Invoice ${invoiceId}`,
        userId: user.uid,
        userEmail: user.email || '',
        userName: profile.name || user.displayName || 'User',
        timestamp: new Date().toISOString(),
        createdAt: serverTimestamp()
      });

      // Record payment audit log if confirmed
      if (invoiceStatus === 'paid') {
        const paymentLogId = `log_pay_${Date.now()}`;
        await setDoc(doc(db, `companies/${profile.companyId}/auditLogs`, paymentLogId), {
          id: paymentLogId,
          eventType: 'invoice_payment_confirmed',
          action: 'Invoice Payment Confirmed',
          details: `Payment confirmed for Invoice ${invoiceId} (Converted from Quotation ${quotation.id})`,
          userId: user.uid,
          userEmail: user.email || '',
          userName: profile.name || user.displayName || 'User',
          timestamp: new Date().toISOString(),
          createdAt: serverTimestamp()
        });
      }

      // 4. Reduce Inventory, Record Sales, and Create Audit logs ONLY if Standard (Real) Invoice
      if (type === 'standard') {
        const productsRef = collection(db, `companies/${profile.companyId}/products`);
        const productsSnap = await getDocs(productsRef);
        const productsList = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

        for (const item of quotation.items) {
          const product = productsList.find(p => p.id === item.productId);
          const beforeQty = product?.quantity || 0;
          const finalQty = beforeQty - item.quantity;

          // Update product qty
          const productRef = doc(db, `companies/${profile.companyId}/products`, item.productId);
          await updateDoc(productRef, {
            quantity: finalQty,
            currentStock: finalQty,
            unitsSold: increment(item.quantity),
            updatedAt: new Date().toISOString(),
            serverUpdatedAt: serverTimestamp()
          });

          // Record Unified Sale
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
            customerId: quotation.customer || "Walk-in Customer",
            createdAt: new Date().toISOString(),
            timestamp: serverTimestamp()
          });

          // Create stockMovement / Audit Log
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
            reason: `Converted Quotation Sale - Invoice #${invoiceId}`,
            userId: user.uid,
            timestamp: serverTimestamp()
          });
        }

        // Generate Delivery Note
        const deliveryNoteId = `DN-${Date.now()}`;
        await setDoc(doc(db, `companies/${profile.companyId}/deliveryNotes`, deliveryNoteId), {
          id: deliveryNoteId,
          orderId: invoiceId,
          customer: quotation.customer,
          date: new Date().toISOString().split('T')[0],
          status: 'pending',
          items: quotation.items,
          createdAt: new Date().toISOString(),
          createdBy: user.uid
        });
      }

      // 5. Trigger dynamic alert synchronization
      const { AlertService } = await import('../../../lib/alertService');
      await AlertService.runAlertSync(profile.companyId);

      alert(`Successfully converted to ${type} invoice: ${invoiceId}${invoiceStatus === 'paid' ? ' (Marked as Paid)' : ' (Pending Payment)'}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'convert_quotation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateQuotationStatus = async (quotationId: string, status: string) => {
    if (!profile?.companyId) return;
    try {
      await updateDoc(doc(db, `companies/${profile.companyId}/quotations`, quotationId), {
        status,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'update_quotation_status');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 lg:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-left">Sales Quotations</h2>
          <p className="text-slate-500 text-sm font-medium mt-1 text-left">Generate and manage quotes matching D&S standard layouts</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-11 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          <button 
            onClick={() => setIsNewQuotationOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#0f172a] text-white px-5 h-11 rounded-lg font-bold hover:bg-slate-800 transition-all text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Quotation
          </button>
        </div>
      </div>

      {/* New Quotation Dialog */}
      <AnimatePresence>
        {isNewQuotationOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-left">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewQuotationOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-6xl max-h-[92vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Create Corporate Quotation</h3>
                  <p className="text-xs text-slate-500 font-medium">Configure metadata, terms, and bank details matching Sales Quote standards</p>
                </div>
                <button 
                  onClick={() => setIsNewQuotationOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8">
                  {/* Left Column: Multi-tab Input form */}
                  <div className="space-y-6">
                    {/* Tabs navigation */}
                    <div className="flex border-b border-slate-200">
                      {[
                        { id: 'client', label: 'Client Details', icon: <User className="w-4 h-4" /> },
                        { id: 'terms', label: 'Terms', icon: <Truck className="w-4 h-4" /> },
                        { id: 'bank', label: 'Bank Details', icon: <CreditCard className="w-4 h-4" /> },
                        { id: 'supplier', label: 'Supplier Info', icon: <Building className="w-4 h-4" /> }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id as any)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all focus:outline-none",
                            activeTab === tab.id 
                              ? "border-blue-600 text-blue-600" 
                              : "border-transparent text-slate-400 hover:text-slate-600"
                          )}
                        >
                          {tab.icon}
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="bg-slate-50/40 p-5 rounded-2xl border border-slate-100 space-y-4">
                      {activeTab === 'client' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-blue-500" /> Buyer & Metadata Settings
                          </h4>

                          <div className="bg-slate-100/60 p-4 rounded-xl border border-slate-200/50">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">
                              Select Customer Profile (Optional)
                            </label>
                            <select
                              onChange={(e) => {
                                const selectedCustId = e.target.value;
                                if (selectedCustId === 'custom') {
                                  setCustomerName('');
                                  setCustomerAccountNo('');
                                  setCustomerAddress('');
                                } else {
                                  const cust = customers.find(c => c.id === selectedCustId);
                                  if (cust) {
                                    setCustomerName(cust.name);
                                    setCustomerAccountNo(cust.id?.replace(`${profile?.companyId}_`, '') || cust.id);
                                    setCustomerAddress(cust.address || 'Kenya');
                                  }
                                }
                              }}
                              className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all font-bold text-slate-800 text-xs"
                            >
                              <option value="custom">-- Create Custom / Walk-in Customer --</option>
                              {customers.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name} (Tax PIN: {c.taxPin || 'None'})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Customer Name</label>
                              <input 
                                type="text"
                                required
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="e.g. DEPRISS GROUP LIMITED"
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Account No</label>
                              <input 
                                type="text"
                                value={customerAccountNo}
                                onChange={(e) => setCustomerAccountNo(e.target.value)}
                                placeholder="e.g. 157552"
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Customer Address / Country</label>
                            <input 
                              type="text"
                              value={customerAddress}
                              onChange={(e) => setCustomerAddress(e.target.value)}
                              placeholder="e.g. Kenya"
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Quotation Date</label>
                              <input 
                                type="date"
                                value={quotationDate}
                                onChange={(e) => setQuotationDate(e.target.value)}
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Expiry Date (Valid Until)</label>
                              <input 
                                type="date"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Salesperson</label>
                              <input 
                                type="text"
                                value={salesperson}
                                onChange={(e) => setSalesperson(e.target.value)}
                                placeholder="e.g. Bashir Ouma"
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Quotation Subject</label>
                              <input 
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="e.g. Caustic soda / Water treatment chemical"
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'terms' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <Award className="w-4 h-4 text-sky-500" /> Commercial Terms of Offer
                          </h4>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Delivery Terms</label>
                            <input 
                              type="text"
                              value={deliveryTerms}
                              onChange={(e) => setDeliveryTerms(e.target.value)}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Validity Terms</label>
                            <input 
                              type="text"
                              value={validityTerms}
                              onChange={(e) => setValidityTerms(e.target.value)}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Payment Terms</label>
                            <input 
                              type="text"
                              value={paymentTerms}
                              onChange={(e) => setPaymentTerms(e.target.value)}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Warranty Terms</label>
                            <input 
                              type="text"
                              value={warrantyTerms}
                              onChange={(e) => setWarrantyTerms(e.target.value)}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {activeTab === 'bank' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-emerald-500" /> Bank Deposit Coordinates
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Account Name</label>
                              <input 
                                type="text"
                                value={bankAccountName}
                                onChange={(e) => setBankAccountName(e.target.value)}
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Bank Name</label>
                              <input 
                                type="text"
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Bank Branch</label>
                              <input 
                                type="text"
                                value={bankBranch}
                                onChange={(e) => setBankBranch(e.target.value)}
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Currency</label>
                              <input 
                                type="text"
                                value={bankCurrency}
                                onChange={(e) => setBankCurrency(e.target.value)}
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Bank Code</label>
                              <input 
                                type="text"
                                value={bankCode}
                                onChange={(e) => setBankCode(e.target.value)}
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Account Number</label>
                            <input 
                              type="text"
                              value={bankAccountNo}
                              onChange={(e) => setBankAccountNo(e.target.value)}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {activeTab === 'supplier' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <Building className="w-4 h-4 text-purple-500" /> Supplier Profile Details
                          </h4>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Supplier Store & Address</label>
                            <textarea 
                              rows={2}
                              value={supplierStore}
                              onChange={(e) => setSupplierStore(e.target.value)}
                              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Supplier Phone</label>
                              <input 
                                type="text"
                                value={supplierPhone}
                                onChange={(e) => setSupplierPhone(e.target.value)}
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Supplier Email</label>
                              <input 
                                type="text"
                                value={supplierEmail}
                                onChange={(e) => setSupplierEmail(e.target.value)}
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block">Supplier KRA PIN No</label>
                            <input 
                              type="text"
                              value={supplierKraPin}
                              onChange={(e) => setSupplierKraPin(e.target.value)}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-semibold text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Fast search and add products block */}
                    <div className="pt-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-3 block">Product List (Tap to add)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[190px] overflow-y-auto pr-2">
                        {products.map(product => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => addItem(product)}
                            className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-blue-200 transition-all group text-left shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                                <Package className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">{product.name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">SKU: {product.sku}</p>
                              </div>
                            </div>
                            <span className="text-xs font-black text-emerald-600 shrink-0">{currency}{product.value?.toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Selected items basket & quote checkout */}
                  <div className="flex flex-col bg-slate-50 border border-slate-200/60 rounded-[2rem] overflow-hidden">
                    <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-indigo-600" /> Quotation Items
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400">{selectedItems.length} items</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[250px] max-h-[400px]">
                      {selectedItems.map(item => (
                        <div key={item.productId} className="flex flex-col gap-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                          <div className="flex justify-between items-start gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                              <p className="text-[9px] font-bold text-slate-400 mt-0.5">SKU: {item.sku}</p>
                            </div>
                            <button 
                              type="button"
                              onClick={() => removeItem(item.productId)}
                              className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-slate-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2 items-end">
                            <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Unit Price</label>
                              <input 
                                type="number" 
                                value={item.price}
                                onChange={(e) => updateItemPrice(item.productId, parseFloat(e.target.value) || 0)}
                                className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 block">VAT %</label>
                              <input 
                                type="number" 
                                value={item.vatRate}
                                onChange={(e) => updateItemVat(item.productId, parseFloat(e.target.value) || 0)}
                                className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                              />
                            </div>
                            <div className="flex justify-end">
                              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden h-8">
                                <button 
                                  type="button"
                                  onClick={() => updateItemQuantity(item.productId, item.quantity - 1)}
                                  className="px-2 border-r border-slate-200 hover:bg-white"
                                >
                                  <Minus className="w-3 h-3 text-slate-500" />
                                </button>
                                <span className="w-8 text-[11px] font-bold text-center">{item.quantity}</span>
                                <button 
                                  type="button"
                                  onClick={() => updateItemQuantity(item.productId, item.quantity + 1)}
                                  className="px-2 border-l border-slate-200 hover:bg-white"
                                >
                                  <Plus className="w-3 h-3 text-slate-500" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {selectedItems.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 py-24">
                          <ShoppingCart className="w-12 h-12 mb-2" />
                          <p className="text-xs font-black uppercase tracking-widest">No items added</p>
                        </div>
                      )}
                    </div>

                    <div className="p-6 bg-slate-900 text-white mt-auto rounded-t-[2rem]">
                      <div className="space-y-2 mb-6">
                        <div className="flex justify-between items-center text-xs opacity-70">
                          <span>Subtotal</span>
                          <span>{currency}{calculateSubtotal().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs opacity-70">
                          <span>VAT Total</span>
                          <span>{currency}{calculateVatTotal().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-white/10">
                          <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">Estimated Total</span>
                          <h5 className="text-2xl font-black">{currency}{calculateTotal().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h5>
                        </div>
                      </div>
                      <button 
                        onClick={handleSubmitQuotation}
                        disabled={isSubmitting || !customerName || selectedItems.length === 0}
                        className="w-full h-12 bg-[#0066cc] hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-[0.2em] text-xs shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                        Save Quotation
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main List Filters */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search quotations..."
            className="w-full pl-11 pr-4 h-12 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-slate-300 focus:bg-white transition-all font-medium text-slate-900 text-sm placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-12 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-50">
            <Filter className="w-4 h-4" /> Filter <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
        </div>
      </div>

      {/* Quotations List Grid/Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="hidden lg:grid grid-cols-[140px_1fr_120px_120px_130px_180px] gap-4 px-8 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">
          <div>Quote ID</div>
          <div>Customer</div>
          <div className="text-center">Date</div>
          <div className="text-center">Expiry</div>
          <div className="text-right">Amount</div>
          <div className="text-center">Status / Actions</div>
        </div>
        <div className="divide-y divide-slate-100 font-sans">
          {(quotations.length > 0 ? quotations : []).filter(q => 
            q.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (q.customer && q.customer.toLowerCase().includes(searchTerm.toLowerCase()))
          ).map((q) => (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={q.id} 
              className="group hover:bg-slate-50 transition-all font-sans text-left"
            >
              <div className="hidden lg:grid grid-cols-[140px_1fr_120px_120px_130px_180px] gap-4 px-8 py-5 items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-white transition-all">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-900 text-sm">{q.id}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-sm truncate block max-w-full">{q.customer}</span>
                  {q.subject && <span className="text-[10px] font-medium text-slate-400 block truncate max-w-xs">{q.subject}</span>}
                </div>
                <div className="text-center text-xs font-semibold text-slate-500">{q.date}</div>
                <div className="text-center text-[11px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">{q.expiryDate}</div>
                <div className="text-right font-black text-slate-900 text-sm">
                  {currency}{(q.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-1.5 w-full">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border flex-1 text-center self-center",
                      statusStyles[q.status as keyof typeof statusStyles]
                    )}>
                      {q.status}
                    </span>
                    <button 
                      onClick={() => setSelectedQuotation(q)}
                      className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-lg border border-slate-200 transition-all shrink-0"
                      title="View & Print Quote"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {q.status === 'draft' && (
                    <button 
                      onClick={() => updateQuotationStatus(q.id, 'sent')}
                      className="w-full h-7 bg-blue-50 text-blue-600 rounded-lg text-[8px] font-black uppercase border border-blue-100 hover:bg-blue-100 transition-all"
                    >
                      Mark as Sent
                    </button>
                  )}

                  {q.status === 'sent' && (
                    <div className="flex gap-1 w-full">
                      <button 
                        onClick={() => updateQuotationStatus(q.id, 'accepted')}
                        className="flex-1 h-7 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-black uppercase border border-emerald-100 hover:bg-emerald-100 transition-all"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => updateQuotationStatus(q.id, 'rejected')}
                        className="flex-1 h-7 bg-rose-50 text-rose-600 rounded-lg text-[8px] font-black uppercase border border-rose-100 hover:bg-rose-100 transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {q.status === 'accepted' && (
                    <div className="flex gap-1 w-full">
                       <button 
                          onClick={() => convertToInvoice(q, 'standard')}
                          className="flex-1 p-1 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 hover:bg-emerald-100 transition-all text-[8px] font-black uppercase tracking-tighter"
                       >
                          To Invoice
                       </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Card */}
              <div className="lg:hidden p-5 space-y-4">
                 <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-slate-900 text-sm">{q.id}</h3>
                        <p className="text-xs font-bold text-slate-400 mt-0.5">{q.customer}</p>
                        {q.subject && <p className="text-[10px] text-slate-500 italic mt-0.5">{q.subject}</p>}
                    </div>
                    <span className={cn(
                        "px-2 px-1 rounded-full text-[8px] font-bold uppercase tracking-widest border",
                        statusStyles[q.status as keyof typeof statusStyles]
                    )}>
                        {q.status}
                    </span>
                 </div>
                 <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedQuotation(q)}
                      className="flex-1 h-9 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <Printer className="w-3.5 h-3.5" /> View & Print
                    </button>
                    {q.status === 'accepted' && (
                        <button 
                            onClick={() => convertToInvoice(q, 'standard')}
                            className="flex-1 h-9 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            <ArrowUpRight className="w-3 h-3" /> To Invoice
                        </button>
                    )}
                 </div>
              </div>
            </motion.div>
          ))}
          {quotations.length === 0 && !loading && (
            <div className="p-12 text-center text-slate-400">
               <FileText className="w-12 h-12 mx-auto opacity-10 mb-4" />
               <p className="text-sm font-bold uppercase tracking-widest text-slate-300">No quotations found</p>
            </div>
          )}
        </div>
      </div>

      {/* Corporate A4 Detailed Print Dialog */}
      <AnimatePresence>
        {selectedQuotation && (
          <div className="fixed inset-0 z-[110] flex justify-center items-start overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static print:overflow-visible">
            
            {/* Print Dialog Backdrop control button */}
            <div className="fixed top-4 right-4 flex items-center gap-3 z-50 print:hidden bg-slate-900/50 p-2 rounded-2xl backdrop-blur-md shadow-lg border border-slate-700/30">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg text-sm transition-all"
              >
                <Printer className="w-4 h-4" /> Print Quote
              </button>
              <button
                onClick={() => setSelectedQuotation(null)}
                className="bg-white hover:bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl font-bold shadow-lg text-sm border border-slate-200 transition-all flex items-center gap-1.5"
              >
                <X className="w-4 h-4" /> Close
              </button>
            </div>

            {/* A4 Paper Container matching Davis & Shirtliff layout */}
            <div className="bg-white w-full max-w-[820px] my-8 p-10 shadow-2xl rounded-sm border border-slate-200 font-sans text-slate-800 leading-relaxed text-left print:shadow-none print:border-none print:my-0 print:p-0 print:w-full select-text">
              
              {/* Outer boundary frame */}
              <div className="border-[2px] border-double border-emerald-900/30 p-6 min-h-[1050px] flex flex-col justify-between">
                
                {/* Header section */}
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <BrandLogo companyName={selectedQuotation.bankAccountName && selectedQuotation.bankAccountName !== 'Davis & Shirtliff Ltd.' ? selectedQuotation.bankAccountName : (company?.name || 'INVENTORYPRO')} />
                      
                      {/* Left Column Supplier metadata */}
                      <div className="text-[10px] text-slate-700 mt-4 leading-normal font-sans">
                        <p className="font-bold text-slate-900 uppercase tracking-wider">{selectedQuotation.bankAccountName && selectedQuotation.bankAccountName !== 'Davis & Shirtliff Ltd.' ? selectedQuotation.bankAccountName : (company?.name || 'INVENTORYPRO CO.')}</p>
                        <p>{selectedQuotation.supplierStore && !selectedQuotation.supplierStore.includes('Dundori Rd') ? selectedQuotation.supplierStore : (company?.address || 'Nairobi, Kenya')}</p>
                        <p className="mt-2"><span className="font-bold text-slate-900">Tel:</span> {selectedQuotation.supplierPhone && !selectedQuotation.supplierPhone.includes('6968 000') ? selectedQuotation.supplierPhone : (company?.phone || '+254 700 000 000')}</p>
                        <p><span className="font-bold text-slate-900">Email:</span> {selectedQuotation.supplierEmail && !selectedQuotation.supplierEmail.includes('dayliff.com') ? selectedQuotation.supplierEmail : (profile?.email || 'sales@inventorypro.com')}</p>
                        <p className="mt-3 font-semibold text-slate-900"><span className="font-bold text-slate-900">Salesperson:</span> {selectedQuotation.salesperson && selectedQuotation.salesperson !== 'Bashir Ouma' ? selectedQuotation.salesperson : (profile?.name || 'Sales Representative')}</p>
                      </div>
                    </div>

                    {/* Right column quote metadata */}
                    <div className="text-right flex flex-col items-end">
                      <h1 className="text-2xl font-black text-emerald-800 tracking-wider mb-3">SALES QUOTE</h1>
                      
                      <table className="text-xs text-left">
                        <tbody>
                          <tr>
                            <td className="font-bold text-slate-500 pr-6 py-0.5">Date</td>
                            <td className="font-bold text-slate-900">{selectedQuotation.date ? new Date(selectedQuotation.date).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : 'N/A'}</td>
                          </tr>
                          <tr>
                            <td className="font-bold text-slate-500 pr-6 py-0.5">Quote No</td>
                            <td className="font-bold text-slate-900">{selectedQuotation.id}</td>
                          </tr>
                          <tr>
                            <td className="font-bold text-slate-500 pr-6 py-0.5">Due Date</td>
                            <td className="font-bold text-slate-900">{selectedQuotation.expiryDate ? new Date(selectedQuotation.expiryDate).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : 'N/A'}</td>
                          </tr>
                          <tr>
                            <td className="font-bold text-slate-500 pr-6 py-0.5">Account No</td>
                            <td className="font-bold text-emerald-600">{selectedQuotation.customerAccountNo || '157552'}</td>
                          </tr>
                        </tbody>
                      </table>

                      <div className="text-[10px] text-slate-800 text-right mt-6 leading-normal">
                        <p className="font-black text-slate-950 uppercase text-xs">{selectedQuotation.customer || 'DEPRISS GROUP LIMITED'}</p>
                        <p className="font-semibold text-slate-600">{selectedQuotation.customerAddress || 'Kenya'}</p>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-800 border-[1px] my-4" />

                  {/* Subject Line */}
                  {selectedQuotation.subject && (
                    <div className="mb-6 text-xs leading-normal">
                      <p><span className="font-black text-slate-900">Subject:</span> <span className="font-bold text-slate-800 uppercase">{selectedQuotation.subject}</span></p>
                    </div>
                  )}

                  {/* Salutation */}
                  <div className="text-xs text-slate-700 mb-4 font-semibold">
                    <p>Yours faithfully,</p>
                  </div>

                  {/* Items Table */}
                  <div className="mt-4 overflow-hidden border border-emerald-950/20 rounded-sm">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-emerald-600 text-white font-black uppercase text-[10px] tracking-wider border-b border-emerald-950/25 divide-x divide-emerald-950/20">
                          <th className="px-3 py-2 w-[55%]">Description</th>
                          <th className="px-3 py-2 text-center w-[10%]">Qty</th>
                          <th className="px-3 py-2 text-center w-[10%]">VAT %</th>
                          <th className="px-3 py-2 text-right pr-4 w-[12%]">Unit Price</th>
                          <th className="px-3 py-2 text-right pr-4 w-[13%]">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {selectedQuotation.items && selectedQuotation.items.map((item: any, idx: number) => (
                          <tr key={idx} className="divide-x divide-slate-200 hover:bg-slate-50 transition-colors font-medium text-slate-900">
                            <td className="px-3 py-2.5 font-bold">{item.name || 'DAYLIFF CHEMICAL'}</td>
                            <td className="px-3 py-2.5 text-center">{item.quantity}</td>
                            <td className="px-3 py-2.5 text-center">{item.vatRate ?? 16}</td>
                            <td className="px-3 py-2.5 text-right pr-4">{(item.price || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-3 py-2.5 text-right pr-4">{(item.price * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          </tr>
                        ))}
                        {/* Empty spacing rows to simulate printable balance of PDF table */}
                        {[...Array(Math.max(1, 5 - (selectedQuotation.items?.length || 0)))].map((_, i) => (
                          <tr key={`empty-${i}`} className="h-6 divide-x divide-slate-200">
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Calculations totals alignment */}
                  <div className="flex justify-end mt-4">
                    <div className="w-[45%] border border-slate-900 text-xs font-semibold">
                      <div className="grid grid-cols-[1fr_120px] border-b border-slate-900 px-3 py-1.5">
                        <span className="font-bold text-slate-500">Subtotal</span>
                        <span className="text-right font-black">
                          {currency}{(selectedQuotation.subtotal ?? (selectedQuotation.amount / 1.16)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                      </div>
                      <div className="grid grid-cols-[1fr_120px] border-b border-slate-900 px-3 py-1.5">
                        <span className="font-bold text-slate-500">VAT</span>
                        <span className="text-right font-black">
                          {currency}{(selectedQuotation.vatAmount ?? (selectedQuotation.amount - (selectedQuotation.amount / 1.16))).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                      </div>
                      <div className="grid grid-cols-[1fr_120px] bg-slate-50 px-3 py-2 font-black text-slate-900 text-sm">
                        <span>Total {selectedQuotation.bankCurrency || 'KES'}</span>
                        <span className="text-right">
                          {currency}{(selectedQuotation.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Commercial terms footer details */}
                  <div className="mt-6 text-[10px] space-y-1.5 border-t border-slate-200 pt-4 leading-normal font-sans text-slate-700">
                    <p><span className="font-black text-slate-950 uppercase w-20 inline-block">Delivery</span> {selectedQuotation.deliveryTerms && !selectedQuotation.deliveryTerms.includes('SUBJECT AVAILABILITY') ? selectedQuotation.deliveryTerms : 'IMMEDIATELY UPON LPO CONFIRMATION'}</p>
                    <p><span className="font-black text-slate-950 uppercase w-20 inline-block">Validity</span> {selectedQuotation.validityTerms && !selectedQuotation.validityTerms.includes('SUBJECT TO CONFIRMATION') ? selectedQuotation.validityTerms : 'VALID FOR 30 DAYS FROM DATE OF ISSUANCE'}</p>
                    <p><span className="font-black text-slate-950 uppercase w-20 inline-block">Payment</span> {selectedQuotation.paymentTerms && !selectedQuotation.paymentTerms.includes('D&S WARRANTY') ? selectedQuotation.paymentTerms : '50% ON ORDER, BALANCE ON DELIVERY'}</p>
                    <p><span className="font-black text-slate-950 uppercase w-20 inline-block">Warranty</span> {selectedQuotation.warrantyTerms && !selectedQuotation.warrantyTerms.includes('IN FULL WITH ORDER') ? selectedQuotation.warrantyTerms : '1 YEAR MANUFACTURER WARRANTY'}</p>
                  </div>

                  {/* Closing pleasantry */}
                  <p className="text-[10px] font-bold text-slate-600 mt-6 italic">We trust this is in order and look forward to receiving your instructions in due course.</p>
                </div>

                {/* Bottom bank block + signatures */}
                <div>
                  {/* Bank details container table */}
                  <div className="mt-6">
                    <div className="bg-emerald-600 text-white px-3 py-1 text-[9px] font-black uppercase rounded-t-sm border border-emerald-950/20">
                      Bank Details
                    </div>
                    <table className="w-full text-[9px] border-collapse border border-slate-950/20 font-semibold">
                      <thead>
                        <tr className="bg-slate-100 text-slate-500 border-b border-slate-950/20 divide-x divide-slate-950/20 text-left">
                          <th className="px-2 py-1">Account Name</th>
                          <th className="px-2 py-1">Bank</th>
                          <th className="px-2 py-1">Bank Branch</th>
                          <th className="px-2 py-1">Currency</th>
                          <th className="px-2 py-1">Account No</th>
                          <th className="px-2 py-1">Bank Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="divide-x divide-slate-950/20 text-slate-900 bg-white">
                          <td className="px-2 py-1.5 font-bold">{selectedQuotation.bankAccountName && selectedQuotation.bankAccountName !== 'Davis & Shirtliff Ltd.' ? selectedQuotation.bankAccountName : (company?.name || 'InventoryPro Ltd.')}</td>
                          <td className="px-2 py-1.5">{selectedQuotation.bankName && selectedQuotation.bankName !== 'Standard Chartered' ? selectedQuotation.bankName : 'KCB Bank Kenya'}</td>
                          <td className="px-2 py-1.5">{selectedQuotation.bankBranch && selectedQuotation.bankBranch !== 'Chiromo' ? selectedQuotation.bankBranch : 'Nairobi Corporate'}</td>
                          <td className="px-2 py-1.5 font-bold">{selectedQuotation.bankCurrency || 'KES'}</td>
                          <td className="px-2 py-1.5 font-black text-slate-950">{selectedQuotation.bankAccountNo && selectedQuotation.bankAccountNo !== '0104033637700' ? selectedQuotation.bankAccountNo : '12938472901'}</td>
                          <td className="px-2 py-1.5">{selectedQuotation.bankCode && selectedQuotation.bankCode !== '02' ? selectedQuotation.bankCode : '01'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Quote Confirmation Sign-off section */}
                  <div className="mt-4 border border-emerald-950/15 p-3 bg-slate-50/50 rounded-sm">
                    <p className="text-emerald-600 font-black uppercase text-[9px] tracking-wider mb-3">Quote Confirmation</p>
                    <p className="text-[10px] font-bold text-slate-700 mb-4">We are happy with the quote. Please proceed with the order.</p>
                    <div className="grid grid-cols-3 gap-6 text-[10px] font-semibold text-slate-500 pt-2">
                      <div className="flex items-end">
                        <span className="mr-1">Name</span>
                        <div className="border-b border-slate-400 flex-1 h-4"></div>
                      </div>
                      <div className="flex items-end">
                        <span className="mr-1">Date</span>
                        <div className="border-b border-slate-400 flex-1 h-4"></div>
                      </div>
                      <div className="flex items-end">
                        <span className="mr-1">Sign</span>
                        <div className="border-b border-slate-400 flex-1 h-4"></div>
                      </div>
                    </div>
                  </div>

                  {/* Brand category icons footer line */}
                  <FooterIcons />

                  {/* Slogan */}
                  <div className="text-center text-xs font-black tracking-wider text-slate-500 uppercase mt-4">
                    Smart Inventory & <span className="text-emerald-500">Business Growth</span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
