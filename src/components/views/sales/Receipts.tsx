import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Plus, Receipt, Download, 
  ChevronDown, Calendar, User, DollarSign, CheckCircle2, 
  ArrowUpRight, Link as LinkIcon, Loader2, X, Printer
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function Receipts() {
  const { user } = useAuth();
  const { profile, company, currency } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  const formatReceiptDate = (rc: any) => {
    if (!rc) return 'N/A';
    if (rc.timestamp) {
      if (typeof rc.timestamp.toDate === 'function') {
        return rc.timestamp.toDate().toLocaleDateString();
      }
      const d = new Date(rc.timestamp);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString();
      }
    }
    if (rc.date) return rc.date;
    return new Date().toLocaleDateString();
  };

  const handlePrintReceipt = (rc: any) => {
    window.print();
  };

  useEffect(() => {
    if (!profile?.companyId) return;
    const path = `companies/${profile.companyId}/receipts`;
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Payment Receipts</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Record and track all customer payments</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (receipts.length === 0) return;
              const csvHeaders = ["Receipt ID", "Date", "Customer", "Payment Method", "Items Count", "Subtotal", "Tax", "Total Amount"];
              const csvRows = receipts.map(r => [
                r.id || r.receiptId || '',
                r.date || formatReceiptDate(r),
                `"${(r.customerName || 'Walk-in Customer').replace(/"/g, '""')}"`,
                r.paymentMethod || 'Cash',
                r.items ? r.items.length : 1,
                (r.subtotal || 0).toFixed(2),
                (r.tax || 0).toFixed(2),
                (r.total || 0).toFixed(2)
              ]);
              const csvContent = "data:text/csv;charset=utf-8," + [csvHeaders.join(','), ...csvRows.map(e => e.join(','))].join('\n');
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", `Receipts_Report_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-11 border border-slate-200 rounded-xl bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-sm shadow-2xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#0f172a] text-white px-5 h-11 rounded-lg font-bold hover:bg-slate-800 transition-all text-sm shadow-sm">
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100 font-sans">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Total Received (MTD)', value: `${currency}${receipts.reduce((acc, r) => acc + (r.total || 0), 0).toLocaleString()}`, sub: 'vs last month +15%', color: 'blue' },
            { label: 'Avg Payment Time', value: 'Instant', sub: 'POS Transactions', color: 'emerald' },
            { label: 'Receipt Count', value: receipts.length.toString(), sub: 'Today', color: 'amber' },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <h4 className="text-2xl font-black text-slate-900 mt-1 text-left">{stat.value}</h4>
              <p className="text-[10px] font-medium text-slate-500 mt-1 leading-none text-left">{stat.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 shadow-sm mt-6 mb-6">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Search receipts by ID or customer..."
              className="w-full pl-11 pr-4 h-12 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-slate-300 focus:bg-white transition-all font-medium text-slate-900 text-sm placeholder-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-12 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-50">
              <Filter className="w-4 h-4" /> Payment Method <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="hidden lg:grid grid-cols-[140px_140px_1fr_120px_120px_140px] gap-4 px-8 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">
            <div>Receipt ID</div>
            <div>Linked Order</div>
            <div>Customer</div>
            <div className="text-center">Date</div>
            <div className="text-right">Amount</div>
            <div className="text-center">Method</div>
          </div>
          <div className="divide-y divide-slate-100 font-sans">
            {(receipts.length > 0 ? receipts : []).filter(rc => 
              rc.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
              (rc.customerName && rc.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
            ).map((rc) => (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={rc.id} 
                className="group hover:bg-slate-50 transition-all font-sans text-left"
              >
                <div className="hidden lg:grid grid-cols-[140px_140px_1fr_120px_120px_140px] gap-4 px-8 py-5 items-center">
                  <div 
                    onClick={() => setSelectedReceipt(rc)}
                    className="flex items-center gap-3 cursor-pointer group/id"
                  >
                    <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-white transition-all group-hover/id:text-blue-600 group-hover/id:border-blue-200">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-slate-900 text-sm truncate max-w-[120px] group-hover/id:text-blue-600 transition-colors">{rc.id?.slice(-8) || rc.id}</span>
                  </div>
                  <div>
                    <button 
                      onClick={() => setSelectedReceipt(rc)}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-[11px] font-bold transition-all hover:underline"
                    >
                       <LinkIcon className="w-3 h-3" />
                       {rc.id?.slice(-8)}
                    </button>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{rc.customerName || 'Walk-in'}</span>
                  </div>
                  <div className="text-center text-xs font-semibold text-slate-500">
                    {formatReceiptDate(rc)}
                  </div>
                  <div className="text-right font-black text-slate-900 text-sm">
                    {currency}{(rc.total || 0).toLocaleString()}
                  </div>
                  <div className="flex justify-center">
                    <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200">
                      {rc.paymentMethod || 'Default'}
                    </span>
                  </div>
                </div>

                {/* Mobile Card */}
                <div className="lg:hidden p-5 space-y-4 text-left">
                  <div className="flex justify-between items-start">
                    <div 
                      onClick={() => setSelectedReceipt(rc)}
                      className="cursor-pointer"
                    >
                      <h3 className="font-bold text-slate-900 text-sm hover:text-blue-600 transition-colors">{rc.id?.slice(-8) || rc.id}</h3>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReceipt(rc);
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 mt-0.5 inline-flex items-center gap-1 hover:underline"
                      >
                        <LinkIcon className="w-2.5 h-2.5" />
                        Linked: {rc.id?.slice(-8)}
                      </button>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200">
                      {rc.paymentMethod || 'Default'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                     <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Customer</p>
                        <p className="font-bold text-slate-900 text-xs">{rc.customerName || 'Walk-in'}</p>
                     </div>
                     <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Date</p>
                        <p className="font-bold text-slate-700 text-xs">{formatReceiptDate(rc)}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Amount</p>
                        <p className="font-black text-slate-900 text-sm">{currency}{(rc.total || 0).toLocaleString()}</p>
                     </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {receipts.length === 0 && !loading && (
              <div className="p-12 text-center text-slate-400">
                 <Receipt className="w-12 h-12 mx-auto opacity-10 mb-4" />
                 <p className="text-sm font-bold uppercase tracking-widest text-slate-300">No receipts found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable Receipt Viewer Modal */}
      <AnimatePresence>
        {selectedReceipt && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto text-left">
            <div className="absolute inset-0" onClick={() => setSelectedReceipt(null)} />
            
            <style>{`
              @media print {
                body {
                  visibility: hidden !important;
                }
                #printable-receipt-area, #printable-receipt-area * {
                  visibility: visible !important;
                }
                #printable-receipt-area {
                  position: absolute !important;
                  left: 50% !important;
                  top: 0 !important;
                  transform: translateX(-50%) !important;
                  width: 320px !important;
                  background: white !important;
                  color: black !important;
                  box-shadow: none !important;
                  border: none !important;
                  padding: 10px !important;
                  margin: 0 !important;
                }
              }
            `}</style>
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 flex flex-col md:flex-row h-[85vh] relative z-10"
            >
              {/* Controls */}
              <div className="p-8 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-between md:w-[300px] bg-slate-50 shrink-0">
                <div className="space-y-6">
                  <div className="flex justify-between items-start md:block">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                        <Receipt className="w-3 h-3" /> Receipt Viewer
                      </span>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-3">Payment Receipt</h3>
                      <p className="text-xs text-slate-500 font-semibold mt-1">Review your payment receipt details. Ready for standard thermal printing or PDF sharing.</p>
                    </div>
                    <button 
                      onClick={() => setSelectedReceipt(null)}
                      className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-[10px] uppercase tracking-widest">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Status: {selectedReceipt.status || 'PAID'}
                    </div>
                    <p className="text-[10px] text-emerald-700 font-semibold leading-relaxed">
                      This represents a fully completed and processed payment transaction.
                    </p>
                  </div>


                </div>

                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <button
                    onClick={() => handlePrintReceipt(selectedReceipt)}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
                  >
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </button>
                  <button
                    onClick={() => setSelectedReceipt(null)}
                    className="w-full h-12 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all hidden md:block"
                  >
                    Close Preview
                  </button>
                </div>
              </div>

              {/* Receipt Preview */}
              <div className="flex-1 bg-slate-100 p-6 overflow-y-auto no-scrollbar flex justify-center items-start relative">
                <button 
                  onClick={() => setSelectedReceipt(null)}
                  className="absolute top-4 right-4 p-2 bg-white text-slate-400 hover:text-slate-600 rounded-full shadow-md hover:scale-105 transition-all hidden md:block"
                >
                  <X className="w-5 h-5" />
                </button>

                <div 
                  id="printable-receipt-area" 
                  className="bg-white w-full max-w-[360px] p-6 shadow-lg border border-slate-200 font-mono text-slate-900 rounded-xl text-xs"
                >
                  <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-300">
                    <h2 className="text-base sm:text-lg font-black uppercase tracking-tight">{profile?.companyName || company?.name || 'INVENTORY PRO STORE'}</h2>
                    <p className="text-[10px] font-sans font-medium text-slate-500">{company?.address || profile?.address || 'Main Branch, Retail Street'}</p>
                    <p className="text-[10px] font-sans text-slate-500">Tel: {company?.phone || profile?.phone || '+254 700 000 000'}</p>

                    <div className="pt-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-2.5 py-0.5 rounded">
                        OFFICIAL SALES RECEIPT
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 py-3 text-[11px] border-b border-dashed border-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Receipt No:</span>
                      <span className="font-bold text-slate-900 font-mono">{selectedReceipt.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Date & Time:</span>
                      <span className="font-medium text-slate-800">{formatReceiptDate(selectedReceipt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Customer:</span>
                      <span className="font-bold text-slate-900">{selectedReceipt.customerName || 'Walk-in Customer'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Method:</span>
                      <span className="font-bold uppercase text-emerald-700">{selectedReceipt.paymentMethod || 'CASH'}</span>
                    </div>
                  </div>

                  <div className="py-3">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-dashed border-slate-300 text-slate-500 font-bold text-[10px]">
                          <th className="pb-1 uppercase">Item</th>
                          <th className="pb-1 text-center uppercase">Qty</th>
                          <th className="pb-1 text-right uppercase">Price</th>
                          <th className="pb-1 text-right uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dashed divide-slate-100">
                        {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                          selectedReceipt.items.map((item: any, i: number) => (
                            <tr key={i} className="text-slate-900">
                              <td className="py-1.5 pr-1 font-semibold break-words whitespace-normal leading-snug">
                                {item.name}
                                {item.sku && <span className="block text-[9px] text-slate-400 font-mono">SKU: {item.sku}</span>}
                              </td>
                              <td className="py-1.5 text-center font-bold">{item.quantity}</td>
                              <td className="py-1.5 text-right font-medium font-mono">{currency}{(item.price || 0).toLocaleString()}</td>
                              <td className="py-1.5 text-right font-black font-mono">{currency}{((item.price || 0) * (item.quantity || 1)).toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr className="text-slate-900">
                            <td className="py-1.5 pr-1 font-semibold break-words">
                              Standard Payment Receipt
                            </td>
                            <td className="py-1.5 text-center font-bold">1</td>
                            <td className="py-1.5 text-right font-mono">{currency}{(selectedReceipt.total || 0).toLocaleString()}</td>
                            <td className="py-1.5 text-right font-black font-mono">{currency}{(selectedReceipt.total || 0).toLocaleString()}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="py-3 space-y-1.5 border-t border-dashed border-slate-300 text-[11px]">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal (Excl. VAT):</span>
                      <span className="font-bold font-mono">
                        {currency}
                        {(selectedReceipt.subtotal !== undefined ? selectedReceipt.subtotal : (selectedReceipt.total || 0) / 1.16).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>VAT (16% Included):</span>
                      <span className="font-bold font-mono">
                        {currency}
                        {(selectedReceipt.tax !== undefined ? selectedReceipt.tax : (selectedReceipt.total || 0) * 0.16 / 1.16).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm sm:text-base font-black text-slate-900 pt-1.5 border-t border-slate-200">
                      <span>TOTAL PAID:</span>
                      <span className="text-emerald-700 font-mono">{currency}{(selectedReceipt.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="pt-4 pb-2 text-center space-y-1 border-t border-dashed border-slate-300 mt-2">
                    <p className="text-[10px] text-slate-900 font-bold uppercase tracking-wider">Thank you for your business!</p>
                    <p className="text-[9px] text-slate-500">Goods once sold are not returnable without valid receipt.</p>
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
