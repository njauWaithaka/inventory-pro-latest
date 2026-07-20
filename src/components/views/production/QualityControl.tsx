import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, AlertOctagon, CheckCircle2, Award, ClipboardCheck, Plus, 
  Trash2, User, Search, Loader2, BarChart3, Settings
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface QCLog {
  id: string;
  qcNumber: string;
  productionOrderId: string;
  productId: string;
  productName: string;
  batchNumber: string;
  quantityTested: number;
  quantityPassed: number;
  quantityFailed: number;
  defectType?: string;
  inspectedBy: string;
  inspectedAt: string;
  status: 'PASSED' | 'FAILED' | 'REJECTED';
  notes?: string;
}

interface QualityControlProps {
  logs: QCLog[];
  orders: any[];
  onAddLog: (log: Omit<QCLog, 'id' | 'qcNumber' | 'inspectedAt'>) => Promise<void>;
  onDeleteLog: (logId: string) => Promise<void>;
  currency: string;
}

export function QualityControl({ logs, orders, onAddLog, onDeleteLog, currency }: QualityControlProps) {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [orderId, setOrderId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [qtyTested, setQtyTested] = useState(10);
  const [qtyPassed, setQtyPassed] = useState(10);
  const [defectType, setDefectType] = useState('');
  const [inspectedBy, setInspectedBy] = useState('Quality Analyst');
  const [notes, setNotes] = useState('');

  // Calculated stats
  const qcStats = useMemo(() => {
    let totalTested = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    logs.forEach(log => {
      totalTested += log.quantityTested || 0;
      totalPassed += log.quantityPassed || 0;
      totalFailed += log.quantityFailed || 0;
    });

    const passRate = totalTested > 0 ? (totalPassed / totalTested) * 100 : 100;
    const failRate = totalTested > 0 ? (totalFailed / totalTested) * 100 : 0;

    return { totalTested, totalPassed, totalFailed, passRate, failRate };
  }, [logs]);

  // Orders available for inspection
  const openOrders = useMemo(() => {
    return orders.filter(o => o.status === 'QA' || o.status === 'IN_PROGRESS');
  }, [orders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !batchNumber || qtyTested <= 0 || !inspectedBy) {
      alert('Please fill out all required fields.');
      return;
    }

    if (qtyPassed > qtyTested) {
      alert('Passed quantity cannot exceed total tested quantity.');
      return;
    }

    const selectedOrder = orders.find(o => o.id === orderId);
    if (!selectedOrder) return;

    const qtyFailed = qtyTested - qtyPassed;
    const status = qtyFailed > 0 ? 'FAILED' : 'PASSED';

    setIsSubmitting(true);
    try {
      await onAddLog({
        productionOrderId: orderId,
        productId: selectedOrder.productId,
        productName: selectedOrder.productName,
        batchNumber,
        quantityTested: qtyTested,
        quantityPassed: qtyPassed,
        quantityFailed: qtyFailed,
        defectType,
        inspectedBy,
        status,
        notes
      });
      setShowForm(false);
      setOrderId('');
      setBatchNumber('');
      setQtyTested(10);
      setQtyPassed(10);
      setDefectType('');
      setNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      return log.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
             log.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
             log.qcNumber.toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a, b) => new Date(b.inspectedAt).getTime() - new Date(a.inspectedAt).getTime());
  }, [logs, searchTerm]);

  return (
    <div className="space-y-6 text-left">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Quality Yield Rate</span>
            <span className="text-2xl font-black text-slate-900 block mt-1.5">{qcStats.passRate.toFixed(1)}%</span>
            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest block mt-1">Excellent standard</span>
          </div>
          <div className="w-11 h-11 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
            <Award className="w-5 h-5 animate-bounce" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Inspected Batches</span>
            <span className="text-2xl font-black text-slate-900 block mt-1.5">{logs.length} Runs</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mt-1">Passed checks</span>
          </div>
          <div className="w-11 h-11 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-500 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Units Passed</span>
            <span className="text-2xl font-black text-emerald-600 block mt-1.5">{qcStats.totalPassed.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mt-1">Ready for sale</span>
          </div>
          <div className="w-11 h-11 bg-emerald-50/50 border border-emerald-100/50 rounded-2xl flex items-center justify-center text-emerald-500 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Defect Rejections</span>
            <span className={cn("text-2xl font-black block mt-1.5", qcStats.totalFailed > 0 ? "text-rose-600 animate-pulse" : "text-slate-900")}>
              {qcStats.totalFailed.toLocaleString()}
            </span>
            <span className="text-[10px] text-rose-500 font-bold uppercase tracking-widest block mt-1">Discarded / Reworked</span>
          </div>
          <div className="w-11 h-11 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-600 shrink-0">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search inspections by SKU, batch, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
          />
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 h-11 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-wider rounded-2xl text-[10px] flex items-center gap-2 shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Log QC Inspection Run
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">Record Quality Control Inspection</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Formally log batch counts, defects, and pass flags to complete production compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Select Floor Order *</label>
              <select
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                required
              >
                <option value="">-- Choose Active Order --</option>
                {openOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    Order {o.id.substring(0, 5)} - {o.productName} ({o.quantityPlanned} planned)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Batch / Lot Number *</label>
              <input 
                type="text"
                placeholder="e.g. BATCH-2026-A1"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Quantity Inspected *</label>
              <input 
                type="number"
                min="1"
                value={qtyTested}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 0);
                  setQtyTested(val);
                  setQtyPassed(val); // default to all passed
                }}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Quantity Passed *</label>
              <input 
                type="number"
                min="0"
                max={qtyTested}
                value={qtyPassed}
                onChange={(e) => setQtyPassed(Math.min(qtyTested, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Defect Classification</label>
              <select
                value={defectType}
                onChange={(e) => setDefectType(e.target.value)}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="">-- No Defects Detected --</option>
                <option value="CRITICAL_DAMAGE">Critical Structural Damage</option>
                <option value="COSMETIC_BLEMISH">Cosmetic/Finishing Blemish</option>
                <option value="SPEC_DEVIATION">Specification Deviation</option>
                <option value="WEIGHT_ERROR">Weight / Volume Variance</option>
                <option value="PACKAGING_FAULT">Faulty Outer Seal/Label</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Inspector Sign-off *</label>
              <input 
                type="text"
                value={inspectedBy}
                onChange={(e) => setInspectedBy(e.target.value)}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Remarks / QA Notes</label>
              <input 
                type="text"
                placeholder="Include remarks on test methodology or environmental factors."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 h-11 bg-slate-100 text-slate-500 font-black uppercase tracking-wider rounded-2xl text-[10px] hover:bg-slate-200 transition-all"
            >
              Discard Run
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 h-11 bg-slate-900 text-white font-black uppercase tracking-wider rounded-2xl text-[10px] hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "File Inspection Certificate"}
            </button>
          </div>
        </form>
      )}

      {/* QC Logs Table */}
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm overflow-hidden">
        <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight mb-4">Historical QC Inspection Log</h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="pb-3">Certificate ID</th>
                <th className="pb-3">Product Name</th>
                <th className="pb-3 text-center">Batch ID</th>
                <th className="pb-3 text-center">Tested / Passed</th>
                <th className="pb-3 text-center">Rejection</th>
                <th className="pb-3">Tester</th>
                <th className="pb-3 text-center">QA Status</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const failures = log.quantityTested - log.quantityPassed;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5">
                        <p className="font-extrabold text-slate-900">{log.qcNumber}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          {new Date(log.inspectedAt).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="py-3.5">
                        <p className="font-extrabold text-slate-900">{log.productName}</p>
                        {log.notes && <p className="text-[10px] text-slate-400 font-semibold">{log.notes}</p>}
                      </td>
                      <td className="py-3.5 text-center font-mono font-bold text-slate-600">
                        {log.batchNumber}
                      </td>
                      <td className="py-3.5 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-black text-slate-800">{log.quantityPassed} / {log.quantityTested}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">units</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-center font-bold text-rose-500">
                        {failures > 0 ? (
                          <span className="bg-rose-50 text-rose-600 text-[10px] px-2 py-0.5 rounded font-black uppercase">
                            {failures} failed
                          </span>
                        ) : (
                          <span className="text-emerald-500 font-semibold">0 Defects</span>
                        )}
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {log.inspectedBy}
                        </div>
                      </td>
                      <td className="py-3.5 text-center">
                        <span className={cn(
                          "text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border",
                          log.status === 'PASSED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          "bg-rose-50 text-rose-600 border-rose-100"
                        )}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => onDeleteLog(log.id)}
                          className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg border border-transparent hover:border-rose-100 transition-all"
                          title="Delete Log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    No Quality Control Certificate logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
