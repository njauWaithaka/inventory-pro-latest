import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Package, Calendar, User, FileText, 
  RefreshCcw, CheckCircle2, AlertCircle, Search, Loader2, X, Plus, Trash2
} from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function Warranties() {
  const { user } = useAuth();
  const { profile } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [warranties, setWarranties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [product, setProduct] = useState('');
  const [sku, setSku] = useState('');
  const [customer, setCustomer] = useState('');
  const [invoice, setInvoice] = useState('');
  const [period, setPeriod] = useState('12 months');
  const [start, setStart] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!profile?.companyId) {
      setLoading(false);
      return;
    }
    const path = `companies/${profile.companyId}/warranties`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWarranties(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error loading warranties:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, [profile?.companyId]);

  const handleRegisterWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !product || !sku || !customer || !invoice) return;
    setIsSubmitting(true);

    try {
      const path = `companies/${profile.companyId}/warranties`;
      const warId = `WAR-${Math.floor(100000 + Math.random() * 900000)}`;
      
      const startDate = new Date(start);
      const months = parseInt(period);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + months);

      await addDoc(collection(db, path), {
        warId,
        product,
        sku,
        customer,
        invoice,
        period,
        start,
        end: endDate.toISOString().split('T')[0],
        status: 'Active',
        createdAt: new Date().toISOString()
      });

      // Reset
      setProduct('');
      setSku('');
      setCustomer('');
      setInvoice('');
      setPeriod('12 months');
      setStart(new Date().toISOString().split('T')[0]);
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error registering warranty:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWarranty = async (id: string) => {
    if (!profile?.companyId || !window.confirm("Are you sure you want to delete this warranty record?")) return;
    try {
      await deleteDoc(doc(db, `companies/${profile.companyId}/warranties`, id));
    } catch (error) {
      console.error("Error deleting warranty:", error);
    }
  };

  const handleUpdateStatus = async (id: string, currentStatus: string) => {
    if (!profile?.companyId) return;
    const nextStatus = currentStatus === 'Active' ? 'Claimed' : 'Active';
    try {
      await updateDoc(doc(db, `companies/${profile.companyId}/warranties`, id), {
        status: nextStatus
      });
    } catch (error) {
      console.error("Error updating warranty status:", error);
    }
  };

  const filteredWarranties = warranties.filter(w => 
    (w.warId || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (w.product || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.customer || '').toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Warranties</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage product claims, serial registrations, and expirations</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 bg-slate-900 text-white px-5 h-11 rounded-lg font-bold hover:bg-slate-800 transition-all text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Register Warranty
        </button>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search by ID, product, SKU, or customer..."
            className="w-full pl-11 pr-4 h-12 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-slate-300 focus:bg-white transition-all font-medium text-slate-900 text-sm placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredWarranties.map((war) => {
          const isExpired = new Date(war.end) < new Date();
          return (
            <div key={war.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col text-left">
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900">{war.warId}</h3>
                      <span className={cn(
                        "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        isExpired 
                          ? "bg-rose-50 text-rose-600 border-rose-100" 
                          : war.status === 'Claimed' 
                            ? "bg-amber-50 text-amber-600 border-amber-100"
                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          isExpired ? "bg-rose-500" : war.status === 'Claimed' ? "bg-amber-500" : "bg-emerald-500"
                        )} />
                        {isExpired ? 'Expired' : war.status}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 mt-1">{war.product}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5">{war.sku}</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteWarranty(war.id)}
                    className="p-1 text-slate-300 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-medium text-slate-400">Customer: <span className="text-slate-900 font-bold">{war.customer}</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-medium text-slate-400">Invoice: <span className="text-slate-900 font-bold">{war.invoice}</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-medium text-slate-400">Period: <span className="text-slate-900 font-bold">{war.period}</span></span>
                  </div>
                  <div className="flex items-center justify-between pb-1">
                     <span className="text-xs font-medium text-slate-400">Valid: <span className="text-slate-900 font-bold">{war.start} → {war.end}</span></span>
                  </div>
                </div>
              </div>

              <div className="mt-auto grid grid-cols-2 p-1 gap-1 border-t border-slate-100 bg-slate-50/50">
                <button 
                  onClick={() => handleUpdateStatus(war.id, war.status)}
                  disabled={isExpired}
                  className="flex items-center justify-center h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  {war.status === 'Claimed' ? 'Mark Active' : 'Mark Claimed'}
                </button>
                <button 
                  onClick={() => {
                    alert(`Warranty replacement order created for ${war.product} (Ref: ${war.warId})`);
                  }}
                  disabled={isExpired}
                  className="flex items-center justify-center h-10 px-4 rounded-xl bg-slate-900 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  Replace Item
                </button>
              </div>
            </div>
          );
        })}

        {filteredWarranties.length === 0 && (
          <div className="col-span-full text-center py-16 bg-white border border-slate-200 rounded-2xl">
            <ShieldCheck className="w-16 h-16 mx-auto mb-3 opacity-25 text-slate-400" />
            <p className="text-sm font-bold text-slate-700">No warranties registered yet</p>
            <p className="text-xs text-slate-400 mt-1">Click "Register Warranty" to log a product warranty plan.</p>
          </div>
        )}
      </div>

      {/* Register Warranty Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden text-left"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Register Warranty</h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegisterWarranty} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Product Name
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Wireless Charger Pad"
                    required
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      SKU
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. WCP-15W"
                      required
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Invoice ID
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. INV-0001"
                      required
                      value={invoice}
                      onChange={(e) => setInvoice(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Customer Name
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Acme Corp"
                    required
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Warranty Period
                    </label>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm bg-white"
                    >
                      <option value="6 months">6 Months</option>
                      <option value="12 months">12 Months</option>
                      <option value="24 months">24 Months</option>
                      <option value="36 months">36 Months</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Start Date
                    </label>
                    <input 
                      type="date" 
                      required
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                    />
                  </div>
                </div>

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
                    disabled={isSubmitting}
                    className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register'}
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

