import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Plus, FileX, Download, 
  ChevronDown, Calendar, User, DollarSign, 
  ArrowDownRight, RefreshCcw, Loader2, X, Trash2
} from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function CreditNotes() {
  const { user } = useAuth();
  const { profile, settings } = useSettings();
  const currency = settings?.currency || '$';
  const [searchTerm, setSearchTerm] = useState('');
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [invoiceId, setInvoiceId] = useState('');
  const [customer, setCustomer] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Damaged Goods');

  useEffect(() => {
    if (!profile?.companyId) {
      setLoading(false);
      return;
    }
    const path = `companies/${profile.companyId}/credit_notes`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCredits(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error loading credit notes:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, [profile?.companyId]);

  const handleIssueCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !invoiceId || !customer || !amount) return;
    setIsSubmitting(true);

    try {
      const path = `companies/${profile.companyId}/credit_notes`;
      const creditId = `CN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await addDoc(collection(db, path), {
        noteId: creditId,
        invoiceId,
        customer,
        amount: parseFloat(amount),
        reason,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });

      // Reset
      setInvoiceId('');
      setCustomer('');
      setAmount('');
      setReason('Damaged Goods');
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
            onClick={() => setShowCreateModal(true)}
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
          <div>Customer</div>
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
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cn_item.reason}</span>
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
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden text-left"
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
                    Reference Invoice ID
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. INV-2024-001"
                    required
                    value={invoiceId}
                    onChange={(e) => setInvoiceId(e.target.value)}
                    className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                  />
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
                      Credit Amount
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
                      Reason
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm bg-white"
                    >
                      <option value="Damaged Goods">Damaged Goods</option>
                      <option value="Pricing Error">Pricing Error</option>
                      <option value="Customer Return">Customer Return</option>
                      <option value="Billing Adjustment">Billing Adjustment</option>
                    </select>
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

