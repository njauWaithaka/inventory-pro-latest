import React, { useState, useEffect } from 'react';
import { Plus, Wrench, Loader2, Calendar, LayoutDashboard, X, Package, ArrowRight } from 'lucide-react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { cn } from '../../../lib/utils';
import { ProcurementService } from '../../../lib/procurementService';
import { MROIssue, Product } from '../../../types';
import { motion } from 'motion/react';

export function MROIssues() {
  const { user } = useAuth();
  const { profile, settings } = useSettings();
  const currency = settings?.currency || 'KSh';
  const [issues, setIssues] = useState<MROIssue[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Issue State
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [issuedTo, setIssuedTo] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!profile?.companyId) return;
    const q = collection(db, `companies/${profile.companyId}/mro_issues`);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIssues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MROIssue)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'mro_issues');
      setLoading(false);
    });

    const productsPath = `companies/${profile.companyId}/products`;
    const unsubscribeProducts = onSnapshot(collection(db, productsPath), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    return () => {
      unsubscribe();
      unsubscribeProducts();
    };
  }, [profile?.companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !productId || !issuedTo || quantity <= 0) return;

    setSubmitting(true);
    try {
      const issueNumber = `ISS-${Math.floor(1000 + Math.random() * 9000)}`;
      await ProcurementService.createMROIssue(profile.companyId, {
        issueNumber,
        productId,
        quantity,
        issuedTo,
        department,
        date: new Date().toISOString(),
        notes
      });

      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setProductId('');
    setQuantity(1);
    setIssuedTo('');
    setDepartment('');
    setNotes('');
  };

  const totalValue = issues.reduce((sum, issue) => {
    const product = products.find(p => p.id === issue.productId);
    return sum + (issue.quantity * (product?.value || 0));
  }, 0);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase">MRO Issues</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Maintenance, Repair, and Operations consumables distribution</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#0f172a] text-white px-5 h-10 rounded-xl font-bold hover:bg-slate-800 transition-all text-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Issue
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Issues', value: issues.length.toString(), color: 'text-slate-900' },
          { label: 'Value Consumed', value: `${currency}${totalValue.toLocaleString()}`, color: 'text-blue-600' },
          { label: 'Total Inventory Lines', value: products.length.toString(), color: 'text-emerald-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
            <h4 className={cn("text-3xl font-black mt-3", stat.color)}>{stat.value}</h4>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
           <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Issue History</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
                <tr className="border-b border-slate-100">
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Issue #</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipient / Dept</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Date</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {issues.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).map((issue) => {
                  const product = products.find(p => p.id === issue.productId);
                  return (
                    <tr key={issue.id} className="hover:bg-slate-50 transition-colors group">
                       <td className="px-6 py-4">
                          <span className="text-xs font-black text-slate-900">{issue.issueNumber}</span>
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <Package className="w-3.5 h-3.5 text-slate-300" />
                             <span className="text-xs font-bold text-slate-600">{product?.name || 'Unknown Product'}</span>
                          </div>
                       </td>
                       <td className="px-6 py-4">
                          <span className="text-xs font-black text-rose-600">-{issue.quantity}</span>
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900">{issue.issuedTo}</span>
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{issue.department}</span>
                          </div>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-slate-400">
                             <Calendar className="w-3.5 h-3.5" />
                             <span className="text-[10px] font-bold uppercase">{new Date(issue.date).toLocaleDateString()}</span>
                          </div>
                       </td>
                    </tr>
                  );
                })}
             </tbody>
          </table>
          {issues.length === 0 && (
             <div className="py-20 text-center">
                <Wrench className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                <p className="text-xs font-black text-slate-300 uppercase tracking-widest">No issues recorded</p>
             </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden"
          >
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">New MRO Issue</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Release Consumable Stock</p>
                </div>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Select Item</label>
                    <select 
                      required
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option value="">Select Item</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Stock: {p.quantity})</option>
                      ))}
                      {products.length === 0 && (
                      <option disabled>No items in inventory</option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Quantity</label>
                    <input 
                      type="number"
                      required
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value))}
                      className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Department</label>
                    <input 
                      type="text"
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Maintenance"
                      className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Issued To</label>
                  <input 
                    type="text"
                    required
                    value={issuedTo}
                    onChange={(e) => setIssuedTo(e.target.value)}
                    placeholder="Employee Name"
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Internal Notes</label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Reason for issue..."
                  />
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                <button 
                  type="submit"
                  disabled={submitting || !productId || !issuedTo}
                  className="px-10 h-12 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      Confirm Issue
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
