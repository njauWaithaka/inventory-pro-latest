import React, { useState, useMemo } from 'react';
import { 
  BarChart2, TrendingUp, DollarSign, ArrowRight, Percent, Award, Clipboard, 
  Settings, AlertTriangle, CheckCircle2, ChevronRight, Activity, Layers, Coins
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface CostLog {
  id: string;
  orderId: string;
  productName: string;
  targetQty: number;
  materialsCostStd: number;
  materialsCostAct: number;
  laborCost: number;
  overheadCost: number;
  totalCostStd: number;
  totalCostAct: number;
  variance: number; // Act - Std (negative is favorable, positive is unfavorable)
  status: 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL';
}

interface CostAnalysisProps {
  orders: any[];
  boms: any[];
  products: any[];
  currency: string;
}

export function CostAnalysis({ orders, boms, products, currency }: CostAnalysisProps) {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [laborInput, setLaborInput] = useState(150);
  const [overheadInput, setOverheadInput] = useState(100);
  const [calculationsSaved, setCalculationsSaved] = useState<CostLog[]>([]);

  // Maps
  const bomsMap = useMemo(() => new Map<string, any>(boms.map(b => [b.productId, b])), [boms]);
  const productsMap = useMemo(() => new Map<string, any>(products.map(p => [p.id, p])), [products]);

  // Closed/Completed orders available for Cost Audit
  const completedOrders = useMemo(() => {
    return orders.filter(o => o.status === 'COMPLETED');
  }, [orders]);

  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Calculate standard vs actual cost for the selected order
  const selectedCostDetails = useMemo(() => {
    if (!selectedOrder) return null;

    const bom = bomsMap.get(selectedOrder.productId);
    if (!bom) return null;

    // Standard materials cost based on BOM recipe
    let stdMaterialsTotal = 0;
    bom.items.forEach((item: any) => {
      const prod = productsMap.get(item.componentId);
      const price = prod?.buyingPrice || prod?.value || 0;
      stdMaterialsTotal += item.quantity * price * selectedOrder.quantityPlanned;
    });

    // Actual materials cost (in our system, it corresponds to the actual ingredients consumed)
    let actMaterialsTotal = 0;
    if (selectedOrder.items) {
      selectedOrder.items.forEach((item: any) => {
        const price = item.buyingPrice || productsMap.get(item.componentId)?.buyingPrice || productsMap.get(item.componentId)?.value || 0;
        actMaterialsTotal += (item.quantityConsumed || item.quantityRequired) * price;
      });
    } else {
      actMaterialsTotal = stdMaterialsTotal; // Fallback
    }

    const stdTotal = stdMaterialsTotal + laborInput + overheadInput;
    const actTotal = actMaterialsTotal + laborInput + overheadInput;
    const variance = actTotal - stdTotal;
    const variancePercent = stdTotal > 0 ? (variance / stdTotal) * 100 : 0;

    let status: 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL' = 'NEUTRAL';
    if (variance < 0) status = 'FAVORABLE';
    else if (variance > 0) status = 'UNFAVORABLE';

    return {
      stdMaterialsTotal,
      actMaterialsTotal,
      stdTotal,
      actTotal,
      variance,
      variancePercent,
      status
    };
  }, [selectedOrder, laborInput, overheadInput, bomsMap, productsMap]);

  const handleSaveCalculation = () => {
    if (!selectedOrder || !selectedCostDetails) return;

    const newLog: CostLog = {
      id: Math.random().toString(36).substring(7),
      orderId: selectedOrder.id,
      productName: selectedOrder.productName,
      targetQty: selectedOrder.quantityPlanned,
      materialsCostStd: selectedCostDetails.stdMaterialsTotal,
      materialsCostAct: selectedCostDetails.actMaterialsTotal,
      laborCost: laborInput,
      overheadCost: overheadInput,
      totalCostStd: selectedCostDetails.stdTotal,
      totalCostAct: selectedCostDetails.actTotal,
      variance: selectedCostDetails.variance,
      status: selectedCostDetails.status
    };

    setCalculationsSaved([newLog, ...calculationsSaved]);
    alert('🎉 Cost Analysis sheet archived and compiled to analytics.');
    setSelectedOrderId('');
  };

  return (
    <div className="space-y-6 text-left">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Audit Inputs Form */}
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm space-y-5">
          <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2">
            <Coins className="w-5 h-5 text-indigo-600" />
            Cost Variance Worksheet
          </h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            Compare theoretical recipes standard costs against actual floor direct consumption, adding labor and overhead adjustments.
          </p>

          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Select Completed Batch</label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="">-- Select Completed Order --</option>
                {completedOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    Run {o.id.substring(0, 6).toUpperCase()} - {o.productName} ({o.quantityPlanned} units)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Allocated Labor Cost</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">{currency}</span>
                  <input
                    type="number"
                    min="0"
                    value={laborInput}
                    onChange={(e) => setLaborInput(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl pl-8 pr-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Overhead Recovery</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">{currency}</span>
                  <input
                    type="number"
                    min="0"
                    value={overheadInput}
                    onChange={(e) => setOverheadInput(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl pl-8 pr-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {selectedCostDetails && (
              <button
                onClick={handleSaveCalculation}
                className="w-full h-11 bg-slate-900 text-white font-black uppercase tracking-wider rounded-xl hover:bg-slate-800 transition-all text-[10px] flex items-center justify-center gap-2"
              >
                Archive cost sheets & logs
              </button>
            )}
          </div>
        </div>

        {/* Costing Report Display */}
        <div className="lg:col-span-2">
          {selectedCostDetails && selectedOrder ? (
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">
                    Batch Manufacturing Cost variance
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Order Ref: RUN-{selectedOrder.id.substring(0, 8).toUpperCase()} • Product: {selectedOrder.productName}
                  </p>
                </div>

                <span className={cn(
                  "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border",
                  selectedCostDetails.status === 'FAVORABLE' 
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                    : "bg-rose-50 text-rose-600 border-rose-100"
                )}>
                  {selectedCostDetails.status} VARIANCE
                </span>
              </div>

              {/* Main Variance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Theoretical Cost (BOM)</p>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {currency}{selectedCostDetails.stdTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Actual Direct Cost</p>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {currency}{selectedCostDetails.actTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </p>
                </div>

                <div className={cn(
                  "p-4 rounded-2xl border",
                  selectedCostDetails.status === 'FAVORABLE' ? "bg-emerald-50/40 border-emerald-100" : "bg-rose-50/40 border-rose-100"
                )}>
                  <p className={cn("text-[9px] font-black uppercase tracking-widest", selectedCostDetails.status === 'FAVORABLE' ? "text-emerald-600" : "text-rose-600")}>
                    Variance Amount (%)
                  </p>
                  <p className={cn("text-xl font-black mt-1", selectedCostDetails.status === 'FAVORABLE' ? "text-emerald-600" : "text-rose-600")}>
                    {selectedCostDetails.variance > 0 ? '+' : ''}{selectedCostDetails.variance.toLocaleString(undefined, { maximumFractionDigits: 1 })} ({selectedCostDetails.variancePercent.toFixed(1)}%)
                  </p>
                </div>
              </div>

              {/* Breakdown Ledger */}
              <div className="space-y-3 pt-2">
                <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Cost Element Breakdown</h5>
                
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="flex justify-between p-3.5 text-xs font-semibold bg-slate-50/30">
                    <span className="text-slate-500">Direct Raw Ingredients std / act:</span>
                    <span className="font-extrabold text-slate-800">
                      {currency}{selectedCostDetails.stdMaterialsTotal.toLocaleString()} Std vs. {currency}{selectedCostDetails.actMaterialsTotal.toLocaleString()} Act
                    </span>
                  </div>
                  <div className="flex justify-between p-3.5 text-xs font-semibold">
                    <span className="text-slate-500">Allocated Labor Charge:</span>
                    <span className="font-extrabold text-slate-800">{currency}{laborInput.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3.5 text-xs font-semibold bg-slate-50/30">
                    <span className="text-slate-500">Manufacturing Overhead Recovery:</span>
                    <span className="font-extrabold text-slate-800">{currency}{overheadInput.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-[2rem] p-16 text-center shadow-sm flex flex-col items-center justify-center">
              <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <BarChart2 className="w-6 h-6 text-slate-300" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">Select completed batch to audit</h4>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest max-w-xs mt-1.5 leading-relaxed">
                Choose an order that has been fully completed from the drop-down selector to calculate variances.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Historical Audit Sheets */}
      {calculationsSaved.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm overflow-hidden">
          <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight mb-4">Archived Variance Audits</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="pb-3">Order Ref</th>
                  <th className="pb-3">Product Name</th>
                  <th className="pb-3 text-center">Batch Size</th>
                  <th className="pb-3 text-right">Standard Total</th>
                  <th className="pb-3 text-right">Actual Total</th>
                  <th className="pb-3 text-right">Variance Amount</th>
                  <th className="pb-3 text-center">Audit Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calculationsSaved.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 font-mono font-bold text-slate-600">
                      RUN-{log.orderId.substring(0, 6).toUpperCase()}
                    </td>
                    <td className="py-3 font-extrabold text-slate-900">
                      {log.productName}
                    </td>
                    <td className="py-3 text-center font-bold text-slate-800">
                      {log.targetQty} units
                    </td>
                    <td className="py-3 text-right font-bold text-slate-500">
                      {currency}{log.totalCostStd.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 text-right font-extrabold text-slate-800">
                      {currency}{log.totalCostAct.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td className={cn(
                      "py-3 text-right font-black",
                      log.status === 'FAVORABLE' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {log.variance > 0 ? '+' : ''}{log.variance.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 text-center">
                      <span className={cn(
                        "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border",
                        log.status === 'FAVORABLE' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        "bg-rose-50 text-rose-600 border-rose-100"
                      )}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
