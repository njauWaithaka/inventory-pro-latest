import React, { useState, useMemo } from 'react';
import { 
  Calculator, ClipboardCheck, AlertTriangle, CheckCircle2, 
  ArrowRight, FileText, Loader2, Package, Boxes, Layers
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface BOMItem {
  componentId: string;
  quantity: number;
}

interface BOMData {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  version: string;
  wasteFactor: number;
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  items: BOMItem[];
}

interface MRPProps {
  products: any[];
  boms: BOMData[];
  plans: any[];
  onGenerateRequisition: (productId: string, quantity: number, shortages: any[]) => Promise<void>;
  onCreateProductionOrder: (productId: string, quantity: number) => Promise<void>;
  currency: string;
}

export function MRP({ products, boms, plans, onGenerateRequisition, onCreateProductionOrder, currency }: MRPProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [adhocProductId, setAdhocProductId] = useState<string>('');
  const [targetQty, setTargetQty] = useState<number>(10);
  const [isCalculating, setIsCalculating] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [isSubmittingRequisition, setIsSubmittingRequisition] = useState(false);
  const [isCreatingPO, setIsCreatingPO] = useState(false);

  // Maps
  const productsMap = useMemo(() => new Map<string, any>(products.map(p => [p.id, p])), [products]);
  const bomsMap = useMemo(() => new Map<string, BOMData>(boms.map(b => [b.productId, b])), [boms]);

  // Approved plans to select from
  const approvedPlans = useMemo(() => {
    return plans.filter(p => p.status === 'APPROVED');
  }, [plans]);

  // Selected plan details
  const selectedPlan = useMemo(() => {
    return plans.find(p => p.id === selectedPlanId) || null;
  }, [plans, selectedPlanId]);

  // Set inputs if plan changes
  React.useEffect(() => {
    if (selectedPlan) {
      setAdhocProductId(selectedPlan.productId);
      setTargetQty(selectedPlan.targetQty || 10);
      setHasRun(false);
    }
  }, [selectedPlan]);

  // Recursively resolve ingredients tree (Multi-Level BOM Explosion)
  const getExplodedBOM = (productId: string, multiplier: number = 1, visited = new Set<string>()): any[] => {
    if (visited.has(productId)) return [];
    visited.add(productId);

    const bom = bomsMap.get(productId);
    if (!bom || !bom.items) return [];

    const exploded: any[] = [];
    bom.items.forEach((item) => {
      const prod = productsMap.get(item.componentId);
      if (!prod) return;

      const directQty = item.quantity * multiplier * (1 + (bom.wasteFactor || 0) / 100);
      const subBom = bomsMap.get(item.componentId);

      exploded.push({
        componentId: item.componentId,
        name: prod.name,
        sku: prod.sku,
        materialGroup: prod.materialGroup || 'Raw Materials',
        quantityPerUnit: item.quantity,
        quantityNeeded: directQty,
        currentStock: prod.quantity || 0,
        buyingPrice: prod.buyingPrice || prod.value || 0,
        isSubassembly: !!subBom,
        subItems: subBom ? getExplodedBOM(item.componentId, directQty, new Set(visited)) : []
      });
    });

    return exploded;
  };

  // Flattened total raw requirements
  const getFlattenedRequirements = (explodedItems: any[]): Record<string, { name: string; sku: string; needed: number; stock: number; price: number }> => {
    const requirements: Record<string, { name: string; sku: string; needed: number; stock: number; price: number }> = {};

    const traverse = (items: any[]) => {
      items.forEach(item => {
        if (item.isSubassembly && item.subItems.length > 0) {
          const shortQty = Math.max(0, item.quantityNeeded - item.currentStock);
          if (shortQty > 0) {
            traverse(item.subItems);
          }
        } else {
          if (!requirements[item.componentId]) {
            requirements[item.componentId] = {
              name: item.name,
              sku: item.sku,
              needed: 0,
              stock: item.currentStock,
              price: item.buyingPrice
            };
          }
          requirements[item.componentId].needed += item.quantityNeeded;
        }
      });
    };

    traverse(explodedItems);
    return requirements;
  };

  // Run MRP Calculation
  const handleCalculate = () => {
    const prodId = selectedPlan ? selectedPlan.productId : adhocProductId;
    if (!prodId) {
      alert('Please select a production plan or an ad-hoc product.');
      return;
    }
    if (targetQty <= 0) {
      alert('Please enter a valid target quantity.');
      return;
    }

    setIsCalculating(true);
    setTimeout(() => {
      setIsCalculating(false);
      setHasRun(true);
    }, 400);
  };

  const activeProductId = selectedPlan ? selectedPlan.productId : adhocProductId;
  const activeProduct = productsMap.get(activeProductId);
  const selectedBOM = bomsMap.get(activeProductId);

  // Requirements results
  const mrpResults = useMemo(() => {
    if (!hasRun || !activeProductId || targetQty <= 0) return { items: [], totalCost: 0, hasShortages: false, shortagesList: [] };

    const exploded = getExplodedBOM(activeProductId, targetQty);
    const flat = getFlattenedRequirements(exploded);

    let totalCost = 0;
    let hasShortages = false;
    const shortagesList: any[] = [];

    const items = Object.keys(flat).map(cid => {
      const item = flat[cid];
      const shortage = Math.max(0, item.needed - item.stock);
      const cost = item.needed * item.price;
      totalCost += cost;

      if (shortage > 0) {
        hasShortages = true;
        shortagesList.push({
          componentId: cid,
          productName: item.name,
          sku: item.sku,
          quantityRequested: shortage,
          quantityIssued: 0
        });
      }

      return {
        id: cid,
        name: item.name,
        sku: item.sku,
        needed: item.needed,
        stock: item.stock,
        shortage,
        price: item.price,
        cost
      };
    });

    return { items, totalCost, hasShortages, shortagesList };
  }, [hasRun, activeProductId, targetQty, bomsMap, productsMap]);

  const handleCreateRequisitionClick = async () => {
    if (isSubmittingRequisition) return;
    setIsSubmittingRequisition(true);
    try {
      await onGenerateRequisition(activeProductId, targetQty, mrpResults.shortagesList);
      alert('🎉 Material Requisition generated successfully! Draft stores requisition has been logged.');
      setHasRun(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingRequisition(false);
    }
  };

  const handleCreatePOClick = async () => {
    if (isCreatingPO) return;
    setIsCreatingPO(true);
    try {
      await onCreateProductionOrder(activeProductId, targetQty);
      alert('🎉 Production Order created successfully from MRP planning sheet.');
      setHasRun(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingPO(false);
    }
  };

  // Products with valid BOMs
  const productsWithBoms = useMemo(() => {
    return products.filter(p => bomsMap.has(p.id));
  }, [products, bomsMap]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
          <Calculator className="w-5 h-5 text-indigo-600" />
          Material Requirements Planning (MRP)
        </h3>
        <p className="text-slate-500 text-xs font-semibold mt-1 uppercase tracking-wider">
          Explode Bills of Materials, analyze warehouse shortages, and automatically trigger warehouse requisitions.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Plan Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
              Select Approved Production Plan
            </label>
            <select
              value={selectedPlanId}
              onChange={(e) => {
                setSelectedPlanId(e.target.value);
                if (e.target.value === '') {
                  setAdhocProductId('');
                }
              }}
              className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="">-- Direct Ad-hoc Run --</option>
              {approvedPlans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.planningNumber} - {p.productName} ({p.targetQty} {p.uom || 'units'})
                </option>
              ))}
            </select>
          </div>

          {/* Ad-hoc Product Selector */}
          {!selectedPlanId && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Select Product to Plan
              </label>
              <select
                value={adhocProductId}
                onChange={(e) => {
                  setAdhocProductId(e.target.value);
                  setHasRun(false);
                }}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="">-- Choose Product with Recipe --</option>
                {productsWithBoms.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Target Quantity */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
              Target Quantity to Produce
            </label>
            <input
              type="number"
              min="1"
              value={targetQty}
              onChange={(e) => {
                setTargetQty(Math.max(1, parseInt(e.target.value) || 0));
                setHasRun(false);
              }}
              disabled={!!selectedPlanId}
              className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:opacity-75"
            />
          </div>

          {/* Run Button */}
          <div className="flex items-end">
            <button
              onClick={handleCalculate}
              disabled={isCalculating || (!selectedPlanId && !adhocProductId)}
              className="w-full h-11 bg-slate-900 text-white font-black uppercase tracking-wider rounded-2xl hover:bg-slate-800 transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Calculating Requirements...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" /> Run MRP Explosion
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {hasRun && activeProductId && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Main Results Table */}
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">
                    MRP Ingredient Requirements
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    For {targetQty} units of {activeProduct?.name || 'Finished Product'} • BOM Recipe v{selectedBOM?.version || '1.0'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Est. Batch Materials Cost</p>
                  <p className="font-black text-emerald-600 text-sm mt-0.5">{currency}{mrpResults.totalCost.toLocaleString()}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="pb-3">Component / Ingredient</th>
                      <th className="pb-3 text-center">Required Qty</th>
                      <th className="pb-3 text-center">Available Stock</th>
                      <th className="pb-3 text-center">Shortage</th>
                      <th className="pb-3 text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mrpResults.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3">
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-[9px] text-slate-400 font-mono font-bold">SKU: {item.sku}</p>
                        </td>
                        <td className="py-3 text-center font-extrabold text-slate-700">
                          {item.needed.toFixed(1)}
                        </td>
                        <td className={cn("py-3 text-center font-extrabold", item.stock < item.needed ? "text-rose-600" : "text-emerald-600")}>
                          {item.stock.toFixed(1)}
                        </td>
                        <td className="py-3 text-center font-extrabold">
                          {item.shortage > 0 ? (
                            <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-md">
                              {item.shortage.toFixed(1)} short
                            </span>
                          ) : (
                            <span className="text-emerald-500 font-semibold">Sufficient</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-black text-slate-800">
                          {currency}{item.cost.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar Actions & Summary */}
          <div className="space-y-4">
            <div className="bg-slate-900 text-white rounded-[2rem] p-6 shadow-md text-left">
              <h4 className="font-extrabold uppercase tracking-widest text-[10px] text-slate-400">
                Material Feasibility Report
              </h4>

              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0",
                    mrpResults.hasShortages 
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-500" 
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  )}>
                    {mrpResults.hasShortages ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <h5 className="font-black uppercase tracking-tight text-xs">
                      {mrpResults.hasShortages ? 'Material Shortages Found' : 'All Materials Available'}
                    </h5>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-widest">
                      {mrpResults.hasShortages 
                        ? `${mrpResults.shortagesList.length} ingredient items need procurement/stores requisition.` 
                        : 'Warehouse has sufficient stock levels to start production directly.'}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-white/10 my-4" />

                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] text-slate-400 font-bold uppercase">
                    <span>Target Batch size:</span>
                    <span className="text-white font-black">{targetQty} units</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-bold uppercase">
                    <span>Material items required:</span>
                    <span className="text-white font-black">{mrpResults.items.length} ingredients</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-bold uppercase">
                    <span>Recipe checked:</span>
                    <span className="text-white font-black font-mono">BOM v{selectedBOM?.version}</span>
                  </div>
                </div>

                <div className="pt-4">
                  {mrpResults.hasShortages ? (
                    <div className="space-y-3">
                      <button
                        onClick={handleCreateRequisitionClick}
                        disabled={isSubmittingRequisition}
                        className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center justify-center gap-2 transition-all"
                      >
                        {isSubmittingRequisition ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <FileText className="w-4 h-4" /> Generate Material Requisition
                          </>
                        )}
                      </button>
                      <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-wider leading-relaxed">
                        Creates an internal stores request to transfer raw ingredients to the shop floor.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        onClick={handleCreatePOClick}
                        disabled={isCreatingPO}
                        className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center justify-center gap-2 transition-all"
                      >
                        {isCreatingPO ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Boxes className="w-4 h-4" /> Create Production Order
                          </>
                        )}
                      </button>
                      <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-wider leading-relaxed">
                        Materials are available! Instantly schedule and release this run to the factory floor.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
