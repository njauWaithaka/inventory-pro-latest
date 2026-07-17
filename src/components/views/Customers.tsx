import React, { useState, useEffect } from 'react';
import { 
  Users, Mail, Phone, MapPin, Plus, 
  MoreVertical, Search, Filter, Loader2, X, Edit2, Trash2, FileText, DollarSign, Award
} from 'lucide-react';
import { collection, onSnapshot, query, where, setDoc, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const CUSTOMERS_SEED = [
  {
    id: 'C-001',
    name: 'Acme Corporation',
    email: 'ap@acme.com',
    phone: '+254 712 345678',
    address: '100 Industrial Area Rd, Nairobi',
    invoices: 3,
    balance: 12551.48,
    taxPin: 'P051234567Y',
    creditLimit: 50000,
    paymentTerms: 'Net 30'
  },
  {
    id: 'C-002',
    name: 'Globex East Africa',
    email: 'orders@globex.co.ke',
    phone: '+254 722 000111',
    address: '22 Mombasa Rd, Nairobi',
    invoices: 1,
    balance: 0.00,
    taxPin: 'P051987654Z',
    creditLimit: 150000,
    paymentTerms: 'Net 60'
  },
  {
    id: 'C-003',
    name: 'Initech Solutions',
    email: 'finance@initech.co.ke',
    phone: '+254 733 999888',
    address: '88 Office Plaza, Westlands',
    invoices: 2,
    balance: 4280.00,
    taxPin: 'P052111222K',
    creditLimit: 30000,
    paymentTerms: 'Net 15'
  },
  {
    id: 'C-004',
    name: 'Umbrella Retailers',
    email: 'purchasing@umbrella.co.ke',
    phone: '+254 701 555444',
    address: '7 Thika Road Mall, Nairobi',
    invoices: 0,
    balance: 0.00,
    taxPin: 'P051000999Q',
    creditLimit: 0,
    paymentTerms: 'Cash on Delivery'
  }
];

export function Customers() {
  const { user } = useAuth();
  const { profile, settings } = useSettings();
  const currency = settings?.currency || 'KSh';
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxPin, setTaxPin] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Cash on Delivery');

  useEffect(() => {
    if (!profile?.companyId) {
      setLoading(false);
      return;
    }
    const path = `companies/${profile.companyId}/customers`;
    const q = collection(db, path);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile?.companyId]);

  const seedCustomers = async () => {
    if (!user || !profile?.companyId) return;
    const path = `companies/${profile.companyId}/customers`;
    try {
      for (const customer of CUSTOMERS_SEED) {
        const docId = `${profile.companyId}_${customer.id}`;
        await setDoc(doc(db, path, docId), {
          ...customer,
          id: docId,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setTaxPin('');
    setCreditLimit('');
    setPaymentTerms('Cash on Delivery');
    setShowModal(true);
  };

  const handleOpenEditModal = (customer: any) => {
    setIsEditing(true);
    setCurrentId(customer.id);
    setName(customer.name || '');
    setEmail(customer.email || '');
    setPhone(customer.phone || '');
    setAddress(customer.address || '');
    setTaxPin(customer.taxPin || '');
    setCreditLimit(customer.creditLimit?.toString() || '');
    setPaymentTerms(customer.paymentTerms || 'Cash on Delivery');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !name) return;
    setIsSubmitting(true);

    const path = `companies/${profile.companyId}/customers`;
    try {
      const data = {
        name,
        email,
        phone,
        address,
        taxPin,
        creditLimit: parseFloat(creditLimit) || 0,
        paymentTerms,
        updatedAt: new Date().toISOString(),
      };

      if (isEditing && currentId) {
        await updateDoc(doc(db, path, currentId), data);
      } else {
        const id = `CUST-${Date.now().toString().slice(-6)}`;
        await setDoc(doc(db, path, `${profile.companyId}_${id}`), {
          ...data,
          id: `${profile.companyId}_${id}`,
          balance: 0,
          invoices: 0,
          createdAt: new Date().toISOString()
        });
      }
      setShowModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!profile?.companyId || !window.confirm("Are you sure you want to delete this customer profile?")) return;
    const path = `companies/${profile.companyId}/customers`;
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.taxPin || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Customers</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage customer profiles, payment terms, and credit limits</p>
        </div>
        <div className="flex items-center gap-2">
          {customers.length === 0 && (
            <button 
              onClick={seedCustomers}
              className="px-4 h-11 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700 transition-all shrink-0"
            >
              Seed Sample Customers
            </button>
          )}
          <button 
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 bg-[#0f172a] text-white px-5 h-11 rounded-lg font-bold hover:bg-slate-800 transition-all text-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search customers by name, email, or Tax PIN..."
            className="w-full pl-11 pr-4 h-12 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-slate-300 focus:bg-white transition-all font-medium text-slate-900 text-sm placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((customer) => (
          <div key={customer.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col group hover:border-slate-300 transition-all text-left">
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#0f172a] rounded-xl flex items-center justify-center text-white shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 tracking-tight leading-tight group-hover:text-blue-600 transition-colors uppercase text-base">{customer.name}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{customer.id?.replace(`${profile?.companyId}_`, '') || customer.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => handleOpenEditModal(customer)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleDeleteCustomer(customer.id)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-slate-500">
                  <Mail className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-xs font-semibold truncate">{customer.email || 'No email registered'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-500">
                  <Phone className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-xs font-semibold">{customer.phone || 'No phone registered'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-xs font-semibold truncate">{customer.address || 'No address registered'}</span>
                </div>
              </div>

              {/* Tax & Profile Metadata Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-left">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Tax PIN</span>
                  <span className="text-xs font-extrabold text-slate-700">{customer.taxPin || 'N/A'}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Payment Terms</span>
                  <span className="text-xs font-extrabold text-slate-700 truncate block">{customer.paymentTerms || 'COD'}</span>
                </div>
                <div className="col-span-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Credit Limit</span>
                    <span className="text-xs font-black text-slate-700">{currency}{(customer.creditLimit || 0).toLocaleString()}</span>
                  </div>
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm",
                    customer.creditLimit > 0 ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-100 text-slate-500 border-slate-200"
                  )}>
                    {customer.creditLimit > 0 ? "Active Account" : "Cash Only"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-auto px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-slate-300" /> {customer.invoices || 0} invoices</span>
              <div className="text-right">
                <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">A/R Balance</span>
                <span className={cn(
                  "font-black text-sm",
                  customer.balance > 0 ? "text-amber-600" : "text-emerald-600"
                )}>
                  {currency}{(customer.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {filteredCustomers.length === 0 && (
          <div className="col-span-full py-16 text-center flex flex-col items-center justify-center bg-white border border-dashed border-slate-200 rounded-3xl">
             <Users className="w-12 h-12 text-slate-300 mb-3" />
             <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">No customers found</p>
             <p className="text-xs text-slate-400 mt-1">Add a customer or seed sample profiles to start managing accounts</p>
          </div>
        )}
      </div>

      {/* CRUD Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden text-left flex flex-col"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">{isEditing ? 'Edit Customer Profile' : 'Add New Customer'}</h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Customer / Company Name *
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Acme East Africa"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Email Address
                    </label>
                    <input 
                      type="email" 
                      placeholder="info@acme.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Phone Number
                    </label>
                    <input 
                      type="text" 
                      placeholder="+254 712 345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Tax PIN (KRA PIN)
                  </label>
                  <input 
                    type="text" 
                    placeholder="P051234567Y"
                    value={taxPin}
                    onChange={(e) => setTaxPin(e.target.value)}
                    className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm uppercase"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Credit Limit
                    </label>
                    <input 
                      type="number" 
                      step="1"
                      placeholder="e.g. 50000"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Payment Terms
                    </label>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm bg-white"
                    >
                      <option value="Cash on Delivery">Cash on Delivery</option>
                      <option value="Net 15">Net 15 Days</option>
                      <option value="Net 30">Net 30 Days</option>
                      <option value="Net 60">Net 60 Days</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Physical Address
                  </label>
                  <input 
                    type="text" 
                    placeholder="Mombasa Road, Industrial Area, Nairobi"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                  />
                </div>

                <div className="pt-4 flex gap-2 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 h-11 border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? 'Save Changes' : 'Create Profile')}
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
