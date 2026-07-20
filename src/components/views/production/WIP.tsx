import React, { useMemo } from 'react';
import { 
  Layers, Hammer, Hourglass, PlayCircle, Loader2, ClipboardList, 
  ArrowRight, AlertTriangle, CheckCircle2, TrendingUp, Calendar, BadgeAlert
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface WIPProps {
  orders: any[];
  issues: any[];
  outputs: any[];
  products: any[];
  currency: string;
}

export function WIP({ orders, issues, outputs, products, currency }: WIPProps) {
  // Map of products for lookup
  const productsMap = useMemo(() => new Map<string, any>(products.map(p => [p.id, p])), [products]);

  // List of production runs currently on the floor
  const activeRuns = useMemo(() => {
    return orders.filter(o => o.status === 'RELEASED' || o.status === 'IN_PROGRESS' || o.status === 'QA');
  }, [orders]);

  // Calculate WIP stock on the floor in real-time
  // For each ingredient: Total Quantity Issued - Total Quantity Consumed
  const floorInventory = useMemo(() => {
    const issuedQuantities: Record<string, { name: string; sku: string; qty: number; price: number }> = {};
    const consumedQuantities: Record<string, number> = {};

    // 1. Accumulate all issued quantities
    issues.forEach(issue => {
      if (issue.items) {
        issue.items.forEach((item: any) => {
          const prod = productsMap.get(item.componentId);
          if (!issuedQuantities[item.componentId]) {
            issuedQuantities[item.componentId] = {
              name: item.productName || prod?.name || 'Raw Ingredient',
              sku: item.sku || prod?.sku || 'N/A',
              qty: 0,
              price: prod?.buyingPrice || prod?.value || 0
            };
          }
          issuedQuantities[item.componentId].qty += item.quantityIssued || 0;
        });
      }
    });

    // 2. Accumulate all consumed quantities from COMPLETED orders
    // In our simplified setup, when a production order is completed, we consume the BOM ingredients.
    orders.forEach(order => {
      if (order.status === 'COMPLETED' && order.items) {
        order.items.forEach((item: any) => {
          consumedQuantities[item.componentId] = (consumedQuantities[item.componentId] || 0) + (item.quantityConsumed || item.quantityRequired || 0);
        });
      }
    });

    // 3. Subtract consumed from issued to find current floor balance
    const balanceList: any[] = [];
    let totalWIPValue = 0;

    Object.keys(issuedQuantities).forEach(cid => {
      const issued = issuedQuantities[cid];
      const consumed = consumedQuantities[cid] || 0;
      const currentFloorQty = Math.max(0, issued.qty - consumed);
      const totalCost = currentFloorQty * issued.price;

      if (currentFloorQty > 0) {
        totalWIPValue += totalCost;
        balanceList.push({
          id: cid,
          name: issued.name,
          sku: issued.sku,
          issuedQty: issued.qty,
          consumedQty: consumed,
          floorQty: currentFloorQty,
          price: issued.price,
          value: totalCost
        });
      }
    });

    return { list: balanceList, totalWIPValue };
  }, [issues, orders, productsMap]);

  return (
    <div className="space-y-6 text-left">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Active Floor Runs
            </span>
            <span className="text-2xl font-black text-slate-900 block mt-1.5">
              {activeRuns.length}
            </span>
            <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1 block">
              Currently processing
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Hammer className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Floor Materials Value (WIP)
            </span>
            <span className="text-2xl font-black text-slate-900 block mt-1.5">
              {currency}{floorInventory.totalWIPValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-1 block">
              Issued and on shop floor
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Ingredients Dispatched
            </span>
            <span className="text-2xl font-black text-slate-900 block mt-1.5">
              {floorInventory.list.length} Items
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 block">
              Unique component lines
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <ClipboardList className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* WIP Inventory Ledger */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">Shop Floor WIP Materials</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Raw ingredients dispatched from warehouse to the floor, waiting to be consumed by finished goods outputs.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="pb-3">Ingredient</th>
                  <th className="pb-3 text-center">Total Issued</th>
                  <th className="pb-3 text-center">Total Consumed</th>
                  <th className="pb-3 text-center bg-slate-50/50">WIP Floor Stock</th>
                  <th className="pb-3 text-right">WIP Asset Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {floorInventory.list.length > 0 ? (
                  floorInventory.list.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3">
                        <p className="font-bold text-slate-900">{item.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono font-bold">SKU: {item.sku}</p>
                      </td>
                      <td className="py-3 text-center font-extrabold text-slate-500">
                        {item.issuedQty.toFixed(1)}
                      </td>
                      <td className="py-3 text-center font-extrabold text-slate-400">
                        {item.consumedQty.toFixed(1)}
                      </td>
                      <td className="py-3 text-center font-black text-indigo-600 bg-slate-50/50">
                        {item.floorQty.toFixed(1)}
                      </td>
                      <td className="py-3 text-right font-black text-slate-900">
                        {currency}{item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-bold uppercase tracking-wider">
                      Shop floor currently has zero materials. Complete a Requisition and Goods Issue to transfer raw stock.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Runs Sidebar */}
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
          <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight mb-4">Active Production Floor Runs</h4>
          <div className="space-y-4">
            {activeRuns.length > 0 ? (
              activeRuns.map((run) => (
                <div key={run.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-xs text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping m-4" />
                  <span className={cn(
                    "text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border",
                    run.status === 'IN_PROGRESS' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                    run.status === 'QA' ? "bg-amber-50 text-amber-600 border-amber-100" :
                    "bg-slate-100 text-slate-600 border-slate-200"
                  )}>
                    {run.status}
                  </span>
                  
                  <h5 className="font-black text-slate-900 uppercase tracking-tight mt-3">
                    {run.productName}
                  </h5>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Order Qty: {run.quantityPlanned} units
                  </p>

                  <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-200/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <div>
                      <span>Scheduled Start</span>
                      <p className="font-black text-slate-800 mt-0.5">{run.startDate ? new Date(run.startDate).toLocaleDateString() : 'Today'}</p>
                    </div>
                    <div>
                      <span>Scheduled End</span>
                      <p className="font-black text-slate-800 mt-0.5">{run.endDate ? new Date(run.endDate).toLocaleDateString() : 'Next 2 Days'}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                No active runs on the floor right now.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
