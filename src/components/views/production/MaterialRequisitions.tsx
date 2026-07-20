import React, { useState, useMemo } from 'react';
import { 
  FileText, ClipboardCheck, ArrowRight, Loader2, CheckCircle2, 
  XCircle, Search, Trash2, ShieldCheck, ShoppingCart, User, Factory, Calendar
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface RequisitionItem {
  componentId: string;
  productName: string;
  sku: string;
  quantityRequested: number;
  quantityIssued: number;
}

interface Requisition {
  id: string;
  requisitionNumber: string;
  productId: string;
  productName: string;
  targetQty: number;
  requester: string;
  department: string;
  createdAt: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'ISSUED' | 'CANCELLED';
  items: RequisitionItem[];
}

interface MaterialRequisitionsProps {
  requisitions: Requisition[];
  products: any[];
  onApprove: (reqId: string) => Promise<void>;
  onCancel: (reqId: string) => Promise<void>;
  onIssue: (reqId: string, issuedBy: string, receiver: string) => Promise<void>;
  onDelete: (reqId: string) => Promise<void>;
  currency: string;
}

export function MaterialRequisitions({
  requisitions,
  products,
  onApprove,
  onCancel,
  onIssue,
  onDelete,
  currency
}: MaterialRequisitionsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);

  // Issues Form states
  const [issuedBy, setIssuedBy] = useState('Production Supervisor');
  const [receiver, setReceiver] = useState('Floor Operator');
  const [isIssuing, setIsIssuing] = useState(false);

  // Map products
  const productsMap = useMemo(() => new Map<string, any>(products.map(p => [p.id, p])), [products]);

  // Filtered requisitions list
  const filteredRequisitions = useMemo(() => {
    return requisitions.filter(req => {
      const matchesSearch = 
        req.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        req.requisitionNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requisitions, searchTerm, statusFilter]);

  const selectedReq = useMemo(() => {
    return requisitions.find(r => r.id === selectedReqId) || null;
  }, [requisitions, selectedReqId]);

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqId || isIssuing) return;
    
    // Safety check for inventory
    const shortages: string[] = [];
    selectedReq?.items.forEach(item => {
      const stock = productsMap.get(item.componentId)?.quantity || 0;
      if (stock < item.quantityRequested) {
        shortages.push(`${item.productName} (In Stock: ${stock}, Requested: ${item.quantityRequested})`);
      }
    });

    if (shortages.length > 0) {
      const proceed = confirm(
        `⚠️ WARNING: Severe Stock Shortages!\n\nThe following items do not have enough stock in warehouse to satisfy this requisition:\n- ${shortages.join('\n- ')}\n\nDo you still want to force issue these materials? This will drive warehouse counts into negative levels.`
      );
      if (!proceed) return;
    }

    setIsIssuing(true);
    try {
      await onIssue(selectedReqId, issuedBy, receiver);
      alert('🎉 Materials Issued successfully! Raw stock has been transferred to WIP shop floor.');
      setSelectedReqId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search requisitions by ID, number, or product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 shrink-0">
          {['ALL', 'DRAFT', 'PENDING', 'APPROVED', 'ISSUED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={cn(
                "px-3.5 h-8 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border",
                statusFilter === st 
                  ? "bg-slate-900 text-white border-slate-900" 
                  : "bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-900"
              )}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Requisitions List */}
        <div className={cn("space-y-4", selectedReqId ? "xl:col-span-2" : "xl:col-span-3")}>
          <div className="space-y-4">
            {filteredRequisitions.length > 0 ? (
              filteredRequisitions.map((req) => {
                const isSelected = selectedReqId === req.id;
                return (
                  <div 
                    key={req.id}
                    onClick={() => setSelectedReqId(isSelected ? null : req.id)}
                    className={cn(
                      "bg-white border rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group",
                      isSelected ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
                    )}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className={cn(
                          "w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 transition-colors",
                          req.status === 'ISSUED' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                          req.status === 'APPROVED' ? "bg-blue-50 border-blue-100 text-blue-600" :
                          req.status === 'PENDING' ? "bg-amber-50 border-amber-100 text-amber-600" :
                          "bg-slate-50 border-slate-100 text-slate-400"
                        )}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight flex items-center gap-1.5 flex-wrap">
                            Req: {req.requisitionNumber}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            <span>To Produce: {req.productName} (x{req.targetQty})</span>
                            <span>•</span>
                            <span>Created {new Date(req.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 shrink-0 text-right self-end md:self-auto">
                        <div>
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">Dept / Requester</p>
                          <p className="font-extrabold text-slate-900 mt-1 uppercase tracking-tight text-[11px]">
                            {req.department} • {req.requester}
                          </p>
                        </div>
                        
                        <span className={cn(
                          "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border shrink-0",
                          req.status === 'ISSUED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          req.status === 'APPROVED' ? "bg-blue-50 text-blue-600 border-blue-100" :
                          req.status === 'PENDING' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          req.status === 'CANCELLED' ? "bg-rose-50 text-rose-600 border-rose-100" :
                          "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {req.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white border border-slate-200 rounded-[2rem] p-20 flex flex-col items-center justify-center text-center shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">No Material Requisitions Found</h3>
                <p className="text-slate-400 text-xs font-semibold max-w-sm mt-2 leading-relaxed uppercase tracking-wider">
                  Generate material requisitions from the MRP shortage analysis page or view existing store requests here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Selected Requisition Details Sidebar */}
        {selectedReq && (
          <div className="bg-white border border-slate-900 rounded-[2rem] shadow-lg overflow-hidden flex flex-col text-xs text-left">
            {/* Header Block */}
            <div className="p-6 bg-slate-900 text-white relative">
              <button 
                onClick={() => setSelectedReqId(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
              
              <span className={cn(
                "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                selectedReq.status === 'ISSUED' ? "bg-emerald-500 text-white" :
                selectedReq.status === 'APPROVED' ? "bg-blue-500 text-white" :
                selectedReq.status === 'PENDING' ? "bg-amber-500 text-white" :
                "bg-slate-700 text-slate-300"
              )}>
                {selectedReq.status}
              </span>

              <h3 className="font-extrabold text-base leading-tight uppercase tracking-tight mt-3 text-white">
                Req: {selectedReq.requisitionNumber}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Target: {selectedReq.productName} (x{selectedReq.targetQty} units)
              </p>

              <div className="grid grid-cols-2 gap-4 mt-5 p-3 bg-white/10 rounded-2xl">
                <div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Requester</p>
                  <p className="text-xs font-black text-white mt-1 uppercase">{selectedReq.requester}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Department</p>
                  <p className="text-xs font-black text-white mt-1 uppercase">{selectedReq.department}</p>
                </div>
              </div>
            </div>

            {/* Requisition Status Actions */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">State Actions</p>
              <div className="flex flex-wrap gap-2">
                {selectedReq.status === 'PENDING' && (
                  <button
                    onClick={() => onApprove(selectedReq.id)}
                    className="px-4 h-9 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-1.5"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" /> Approve Requisition
                  </button>
                )}

                {['PENDING', 'APPROVED'].includes(selectedReq.status) && (
                  <button
                    onClick={() => onCancel(selectedReq.id)}
                    className="px-4 h-9 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Cancel Requisition
                  </button>
                )}

                {selectedReq.status === 'DRAFT' && (
                  <button
                    onClick={() => onDelete(selectedReq.id)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-rose-600 border border-slate-200 rounded-xl transition-all"
                    title="Delete Requisition Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Line Items */}
            <div className="p-5 space-y-4 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Requested Material List</p>

              <div className="space-y-3">
                {selectedReq.items.map((item, i) => {
                  const currentStock = productsMap.get(item.componentId)?.quantity || 0;
                  const isShort = currentStock < item.quantityRequested && selectedReq.status !== 'ISSUED';

                  return (
                    <div key={i} className={cn(
                      "p-3 rounded-2xl border text-xs space-y-2",
                      isShort ? "bg-rose-50/20 border-rose-100" : "bg-slate-50/60 border-slate-100"
                    )}>
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 truncate uppercase tracking-tight">{item.productName}</p>
                          <p className="text-[9px] text-slate-400 font-mono">SKU: {item.sku}</p>
                        </div>
                        
                        <div className="text-right font-black">
                          <span className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                            isShort ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"
                          )}>
                            Stock: {currentStock}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-slate-200/50">
                        <div>
                          <p className="text-[8px] font-semibold text-slate-400 uppercase">Requested Qty</p>
                          <p className="font-extrabold text-slate-800">{item.quantityRequested.toFixed(1)}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-semibold text-slate-400 uppercase">Issued Qty</p>
                          <p className="font-extrabold text-slate-800">{item.quantityIssued.toFixed(1)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Material Issue Goods Out Box (when approved) */}
            {selectedReq.status === 'APPROVED' && (
              <form onSubmit={handleIssueSubmit} className="p-5 border-t border-slate-100 bg-blue-50/30 space-y-4">
                <div className="flex items-center gap-2">
                  <Factory className="w-4 h-4 text-blue-600" />
                  <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Material Issue Dispatcher</h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Issued By</label>
                    <input 
                      type="text" 
                      value={issuedBy}
                      onChange={(e) => setIssuedBy(e.target.value)}
                      className="w-full h-9 bg-white border border-slate-200 rounded-xl px-3 font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Received By</label>
                    <input 
                      type="text" 
                      value={receiver}
                      onChange={(e) => setReceiver(e.target.value)}
                      className="w-full h-9 bg-white border border-slate-200 rounded-xl px-3 font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isIssuing}
                  className="w-full h-11 bg-slate-900 text-white font-black uppercase tracking-wider rounded-xl hover:bg-slate-800 transition-all text-[10px] flex items-center justify-center gap-2"
                >
                  {isIssuing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Issue Materials to WIP Shop Floor"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
