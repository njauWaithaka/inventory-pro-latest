import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Plus, Truck, Download, 
  ChevronDown, Calendar, User, Package, 
  CheckCircle2, Clock, AlertCircle, MapPin, Loader2,
  X, Printer, FileText
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const statusStyles = {
  delivered: "bg-emerald-50 text-emerald-600 border-emerald-100",
  shipped: "bg-blue-50 text-blue-600 border-blue-100",
  pending: "bg-amber-50 text-amber-600 border-amber-100",
  cancelled: "bg-rose-50 text-rose-600 border-rose-100",
};

export function DeliveryNotes() {
  const { user } = useAuth();
  const { profile, company } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);

  useEffect(() => {
    if (!profile?.companyId) return;
    const path = `companies/${profile.companyId}/deliveryNotes`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDeliveryNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile?.companyId]);

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
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Delivery Notes</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Track dispatch and shipping performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-11 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-sm">
            <Download className="w-4 h-4" />
            Bulk Print
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#0f172a] text-white px-5 h-11 rounded-lg font-bold hover:bg-slate-800 transition-all text-sm shadow-sm">
            <Plus className="w-4 h-4" />
            Create Dispatch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Out for Delivery', value: deliveryNotes.filter(dn => dn.status === 'shipped').length.toString(), sub: 'Active shipments', color: 'blue' },
          { label: 'Delivered (MTD)', value: deliveryNotes.filter(dn => dn.status === 'delivered').length.toString(), sub: 'Successful drops', color: 'emerald' },
          { label: 'Pending Dispatch', value: deliveryNotes.filter(dn => dn.status === 'pending').length.toString(), sub: 'Needs attention', color: 'amber' },
          { label: 'Total Notes', value: deliveryNotes.length.toString(), sub: 'Lifetime count', color: 'rose' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <h4 className="text-2xl font-black text-slate-900 mt-1 text-left">{stat.value}</h4>
            <p className="text-[10px] font-medium text-slate-500 mt-1 text-left line-clamp-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search by ID, Order, or Customer..."
            className="w-full pl-11 pr-4 h-12 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-slate-300 focus:bg-white transition-all font-medium text-slate-900 text-sm placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="shrink-0 flex items-center gap-2 px-4 h-12 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-50">
            <Truck className="w-4 h-4" /> Carrier <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="hidden lg:grid grid-cols-[140px_140px_1fr_140px_140px_140px] gap-4 px-8 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <div>Note ID</div>
          <div>Order Reference</div>
          <div>Customer</div>
          <div className="text-center">Ship Date</div>
          <div className="text-center">Carrier</div>
          <div className="text-center">Status</div>
        </div>
        <div className="divide-y divide-slate-100 font-sans">
          {(deliveryNotes.length > 0 ? deliveryNotes : []).filter(dn => 
            dn.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
            dn.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (dn.orderId && dn.orderId.toLowerCase().includes(searchTerm.toLowerCase()))
          ).map((dn) => (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={dn.id} 
              className="group hover:bg-slate-50 transition-all font-sans text-left"
            >
              <div className="hidden lg:grid grid-cols-[140px_140px_1fr_140px_140px_140px] gap-4 px-8 py-5 items-center">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-white transition-all">
                    <Truck className="w-4 h-4" />
                  </div>
                  <button 
                    onClick={() => setSelectedNote(dn)}
                    className="font-bold text-slate-900 text-sm whitespace-nowrap hover:text-blue-600 transition-colors text-left font-sans cursor-pointer"
                    title="View Delivery Note"
                  >
                    {dn.id?.replace(`${profile?.companyId}_`, '') || dn.id}
                  </button>
                </div>
                <div>
                  <button 
                    onClick={() => setSelectedNote(dn)}
                    className="text-[11px] font-bold text-zinc-500 bg-slate-100 hover:bg-slate-200 hover:text-blue-600 px-2 py-1 rounded w-fit italic truncate max-w-full text-left transition-colors cursor-pointer"
                    title="View Delivery Note"
                  >
                    #{dn.orderId?.replace(`${profile?.companyId}_`, '') || dn.orderId}
                  </button>
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-sm">{dn.customer}</span>
                </div>
                <div className="text-center text-xs font-semibold text-slate-500">{dn.date}</div>
                <div className="text-center">
                   <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {dn.carrier || 'Standard'}
                   </div>
                </div>
                <div className="flex justify-center">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border",
                    statusStyles[dn.status as keyof typeof statusStyles]
                  )}>
                    {dn.status}
                  </span>
                </div>
              </div>

              {/* Mobile Card */}
              <div className="lg:hidden p-5 flex items-start gap-4 text-left">
                 <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100 shrink-0">
                    <Truck className="w-5 h-5" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                       <div>
                          <h3 
                            onClick={() => setSelectedNote(dn)}
                            className="font-bold text-slate-900 text-sm leading-none truncate hover:text-blue-600 cursor-pointer transition-colors"
                            title="View Delivery Note"
                          >
                            {dn.id?.replace(`${profile?.companyId}_`, '') || dn.id}
                          </h3>
                          <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest truncate">{dn.customer}</p>
                       </div>
                       <span className={cn(
                          "px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border",
                          statusStyles[dn.status as keyof typeof statusStyles]
                       )}>
                          {dn.status}
                       </span>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-slate-500">
                       <button 
                         onClick={() => setSelectedNote(dn)}
                         className="flex items-center gap-1.5 truncate hover:text-blue-600 transition-colors font-bold cursor-pointer text-left"
                         title="View Delivery Note"
                       >
                         <Package className="w-3 h-3" /> #{dn.orderId?.replace(`${profile?.companyId}_`, '') || dn.orderId}
                       </button>
                       <span className="flex items-center gap-1.5 truncate"><MapPin className="w-3 h-3" /> {dn.carrier || 'Standard'}</span>
                    </div>
                 </div>
              </div>
            </motion.div>
          ))}
          {deliveryNotes.length === 0 && !loading && (
            <div className="p-12 text-center text-slate-400">
               <Truck className="w-12 h-12 mx-auto opacity-10 mb-4" />
               <p className="text-sm font-bold uppercase tracking-widest text-slate-300">No delivery notes found</p>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Note Detailed View/Print Dialog */}
      <AnimatePresence>
        {selectedNote && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-y-auto text-left">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNote(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <style>{`
              @media print {
                body {
                  visibility: hidden !important;
                }
                #printable-delivery-note, #printable-delivery-note * {
                  visibility: visible !important;
                }
                #printable-delivery-note {
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
                onClick={() => setSelectedNote(null)}
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors z-20 border border-slate-100 cursor-pointer"
                title="Close Viewer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Controls Panel */}
              <div className="p-8 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-between md:w-[320px] bg-slate-50 shrink-0">
                <div className="space-y-6">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <Truck className="w-3 h-3" /> Delivery Note
                    </span>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-3">Dispatch Slip</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">Review the details and item checklist of this delivery dispatch note.</p>
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-[10px] uppercase tracking-widest">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Status: {selectedNote.status}
                    </div>
                    <p className="text-[10px] text-emerald-700 font-semibold leading-relaxed">
                      This dispatch record is registered under your company profile and ready for transport.
                     </p>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <button
                    onClick={() => window.print()}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Print Note (A4)
                  </button>
                  <button
                    onClick={() => setSelectedNote(null)}
                    className="w-full h-12 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Close Viewer
                  </button>
                </div>
              </div>

              {/* A4 Delivery Note Preview Area */}
              <div className="flex-1 bg-slate-100 p-6 overflow-y-auto no-scrollbar flex justify-center items-start">
                <div 
                  id="printable-delivery-note" 
                  className="bg-white shadow-lg border border-slate-200 w-full max-w-[650px] p-10 text-xs text-left text-slate-900 font-sans"
                >
                  {/* Logo and Delivery Note Title */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                    <div>
                      <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{company?.name || 'INVENTORYPRO CO.'}</h1>
                      <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">{company?.address || 'Nairobi, Kenya'}</p>
                      <p className="text-slate-500 font-semibold text-[10px]">{company?.phone || '+254 700 000 000'}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-4 py-1.5 bg-slate-900 text-white font-black text-sm uppercase tracking-widest">Delivery Note</span>
                      <p className="text-xs font-mono font-bold text-slate-700 mt-2">NOTE ID: {selectedNote.id?.replace(`${profile?.companyId}_`, '') || selectedNote.id}</p>
                    </div>
                  </div>

                  {/* Customer and Order details */}
                  <div className="grid grid-cols-2 gap-8 py-6 border-b border-slate-100">
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ship To</h4>
                      <div className="text-[11px] space-y-1">
                        <p className="font-bold text-slate-900 text-sm">{selectedNote.customer}</p>
                        <p className="text-slate-600">Status: <strong className="uppercase text-slate-900">{selectedNote.status}</strong></p>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Information</h4>
                      <div className="text-[11px] space-y-1">
                        <p className="font-semibold text-slate-600">Order Reference: <strong className="text-slate-900">#{selectedNote.orderId?.replace(`${profile?.companyId}_`, '') || selectedNote.orderId}</strong></p>
                        <p className="font-semibold text-slate-600">Date Issued: <strong className="text-slate-900">{selectedNote.date}</strong></p>
                        <p className="font-semibold text-slate-600">Carrier: <strong className="text-slate-900">{selectedNote.carrier || 'Standard'}</strong></p>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="mt-8">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <th className="py-2.5">Item / Product</th>
                          <th className="py-2.5">SKU</th>
                          <th className="py-2.5 text-right">Qty Shipped</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px] font-semibold text-slate-700">
                        {selectedNote.items && selectedNote.items.length > 0 ? (
                          selectedNote.items.map((item: any, idx: number) => (
                            <tr key={idx}>
                              <td className="py-3 font-bold text-slate-900">{item.name}</td>
                              <td className="py-3 font-mono text-slate-500">{item.sku || 'N/A'}</td>
                              <td className="py-3 text-right font-bold text-slate-900">{item.quantity}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="py-8 text-center text-slate-400 italic">
                              No items listed in this dispatch note.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer disclaimer */}
                  <div className="mt-16 pt-6 border-t border-slate-100 flex justify-between items-end text-slate-400 text-[9px] font-semibold">
                    <div>
                      <p>Thank you for choosing {company?.name || 'InventoryPro Co.'}</p>
                      <p className="mt-1">Please inspect goods upon delivery.</p>
                    </div>
                    <div className="text-right space-y-4">
                      <p className="border-b border-slate-300 w-32 inline-block"></p>
                      <p className="uppercase tracking-widest font-black text-slate-500">Receiver's Signature</p>
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
