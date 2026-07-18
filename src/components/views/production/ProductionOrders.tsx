import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Factory, BarChart3, Loader2, Clock, CheckCircle2, AlertTriangle, 
  Play, Check, XCircle, Search, Trash2, ArrowRight, Layers, FileText, 
  ChevronRight, ChevronDown, Package, ClipboardList, ShieldCheck, RefreshCcw
} from 'lucide-react';
import { collection, onSnapshot, query, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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

interface ProductionOrderItem {
  componentId: string;
  productId: string; // compatibility mapping
  productName: string;
  sku: string;
  quantityRequired: number;
  quantityConsumed: number;
}

interface ProductionOrder {
  id: string;
  productId: string;
  productName: string;
  quantityPlanned: number;
  quantityProduced: number;
  status: 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  bomId: string;
  createdAt: string;
  updatedAt: string;
  materialsCost?: number;
  items: ProductionOrderItem[];
}

export function ProductionOrders() {
  const { user } = useAuth();
  const { profile, currency } = useSettings();

  const [products, setProducts] = useState<any[]>([]);
  const [boms, setBoms] = useState<BOMData[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter/Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Detail view state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Creation modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [plannedQty, setPlannedQty] = useState<number>(10);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Production execution states
  const [qtyToProduce, setQtyToProduce] = useState<number>(0);
  const [isSubmittingProduction, setIsSubmittingProduction] = useState(false);

  useEffect(() => {
    if (!profile?.companyId) return;

    setLoading(true);

    // Real-time products fetch
    const qProducts = collection(db, `companies/${profile.companyId}/products`);
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    // Real-time BOMs fetch
    const qBoms = collection(db, `companies/${profile.companyId}/boms`);
    const unsubBoms = onSnapshot(qBoms, (snapshot) => {
      setBoms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BOMData)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'boms');
    });

    // Real-time production orders fetch
    const qOrders = collection(db, `companies/${profile.companyId}/production_orders`);
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionOrder)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'production_orders');
      setLoading(false);
    });

    return () => {
      unsubProducts();
      unsubBoms();
      unsubOrders();
    };
  }, [profile?.companyId]);

  // Map products and boms for O(1) lookups
  const productsMap = useMemo(() => {
    return new Map<string, any>(products.map(p => [p.id, p]));
  }, [products]);

  const bomsMap = useMemo(() => {
    return new Map<string, BOMData>(boms.map(b => [b.productId, b]));
  }, [boms]);

  // Recursively resolve ingredients tree (Multi-Level BOM Explosion)
  const getExplodedBOM = (productId: string, multiplier: number = 1, visited = new Set<string>()): any[] => {
    if (visited.has(productId)) return []; // Circular dependency safety net
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

  // Rolled-up Manufacturing Cost for 1 Unit
  const getRolledUpCost = (productId: string, visited = new Set<string>()): number => {
    if (visited.has(productId)) return 0;
    visited.add(productId);

    const bom = bomsMap.get(productId);
    if (!bom || !bom.items) {
      const prod = productsMap.get(productId);
      return prod?.buyingPrice || prod?.value || 0;
    }

    let total = 0;
    bom.items.forEach(item => {
      const hasSubBom = bomsMap.has(item.componentId);
      const componentCost = hasSubBom 
        ? getRolledUpCost(item.componentId, new Set(visited)) 
        : (productsMap.get(item.componentId)?.buyingPrice || productsMap.get(item.componentId)?.value || 0);

      total += componentCost * item.quantity * (1 + (bom.wasteFactor || 0) / 100);
    });

    return total;
  };

  // Selected Order Object
  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Set default qty to produce when selecting an order
  useEffect(() => {
    if (selectedOrder) {
      const remaining = Math.max(0, selectedOrder.quantityPlanned - selectedOrder.quantityProduced);
      setQtyToProduce(remaining);
    } else {
      setQtyToProduce(0);
    }
  }, [selectedOrder]);

  // Products that have configured recipes
  const productsWithBoms = useMemo(() => {
    return products.filter(p => bomsMap.has(p.id));
  }, [products, bomsMap]);

  // Live creation-preview for materials required
  const liveRequirements = useMemo(() => {
    if (!selectedProductId || plannedQty <= 0) return {};
    const exploded = getExplodedBOM(selectedProductId, plannedQty);
    return getFlattenedRequirements(exploded);
  }, [selectedProductId, plannedQty, productsMap, bomsMap]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = order.productName.toLowerCase().includes(searchTerm.toLowerCase()) || order.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, searchTerm, statusFilter]);

  // Handlers for creating a production order (DRAFT status)
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !selectedProductId || plannedQty <= 0) return;

    const bom = bomsMap.get(selectedProductId);
    if (!bom) {
      alert("Error: Selected product does not have an active BOM configured.");
      return;
    }

    setIsSubmittingOrder(true);

    try {
      const orderId = `PO-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;
      const prodObj = productsMap.get(selectedProductId);
      const exploded = getExplodedBOM(selectedProductId, plannedQty);
      const flatReqs = getFlattenedRequirements(exploded);

      const mappedItems: ProductionOrderItem[] = Object.keys(flatReqs).map(cid => ({
        componentId: cid,
        productId: cid,
        productName: flatReqs[cid].name,
        sku: flatReqs[cid].sku,
        quantityRequired: flatReqs[cid].needed,
        quantityConsumed: 0
      }));

      const totalCost = getRolledUpCost(selectedProductId) * plannedQty;

      const payload: ProductionOrder = {
        id: orderId,
        productId: selectedProductId,
        productName: prodObj?.name || 'Production Product',
        quantityPlanned: plannedQty,
        quantityProduced: 0,
        status: 'DRAFT',
        bomId: bom.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        materialsCost: totalCost,
        items: mappedItems
      };

      await setDoc(doc(db, `companies/${profile.companyId}/production_orders`, orderId), payload);

      setIsCreateOpen(false);
      setSelectedProductId('');
      setPlannedQty(10);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'production_orders');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // State transitions: Release Order
  const handleReleaseOrder = async (order: ProductionOrder) => {
    if (!profile?.companyId) return;

    // Check material shortages before releasing (informational warning)
    const shortItems: string[] = [];
    order.items.forEach(item => {
      const currentStock = productsMap.get(item.componentId)?.quantity || 0;
      if (currentStock < item.quantityRequired) {
        shortItems.push(`${item.productName} (Shortage: ${(item.quantityRequired - currentStock).toFixed(1)})`);
      }
    });

    if (shortItems.length > 0) {
      const proceed = confirm(
        `⚠️ WARNING: Ingredient shortages detected!\n\nThe following items do not have enough stock in warehouse:\n- ${shortItems.join('\n- ')}\n\nDo you still want to release this order for production scheduling?`
      );
      if (!proceed) return;
    }

    try {
      await updateDoc(doc(db, `companies/${profile.companyId}/production_orders`, order.id), {
        status: 'RELEASED',
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'production_orders');
    }
  };

  // State transitions: Start Production
  const handleStartProduction = async (order: ProductionOrder) => {
    if (!profile?.companyId) return;
    try {
      await updateDoc(doc(db, `companies/${profile.companyId}/production_orders`, order.id), {
        status: 'IN_PROGRESS',
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'production_orders');
    }
  };

  // State transitions: Cancel Order
  const handleCancelOrder = async (order: ProductionOrder) => {
    if (!profile?.companyId) return;
    if (!confirm("Are you sure you want to CANCEL this production order? Any materials already consumed will NOT be auto-reversed.")) return;

    try {
      await updateDoc(doc(db, `companies/${profile.companyId}/production_orders`, order.id), {
        status: 'CANCELLED',
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'production_orders');
    }
  };

  // State transitions: Delete Order (only for drafts or cancelled)
  const handleDeleteOrder = async (orderId: string) => {
    if (!profile?.companyId) return;
    if (!confirm("Are you sure you want to permanently delete this production order record?")) return;

    try {
      await deleteDoc(doc(db, `companies/${profile.companyId}/production_orders`, orderId));
      if (selectedOrderId === orderId) {
        setSelectedOrderId(null);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'production_orders');
    }
  };

  // Execution of actual production & stock consumption
  const handleExecuteProductionRun = async () => {
    if (!profile?.companyId || !selectedOrder || !user) return;
    if (qtyToProduce <= 0) {
      alert("Please enter a valid production output quantity.");
      return;
    }

    const remainingPlanned = selectedOrder.quantityPlanned - selectedOrder.quantityProduced;
    if (qtyToProduce > remainingPlanned) {
      alert(`Cannot produce more than the remaining planned quantity (${remainingPlanned} units).`);
      return;
    }

    // Verify stock availability for raw materials to be consumed
    const runDeductions: Record<string, { name: string; qty: number; currentStock: number }> = {};
    const shortages: string[] = [];

    selectedOrder.items.forEach(item => {
      const perUnitNeeded = item.quantityRequired / selectedOrder.quantityPlanned;
      const amountToConsume = perUnitNeeded * qtyToProduce;
      const currentStock = productsMap.get(item.componentId)?.quantity || 0;

      runDeductions[item.componentId] = {
        name: item.productName,
        qty: amountToConsume,
        currentStock
      };

      if (currentStock < amountToConsume) {
        shortages.push(`${item.productName} (Need ${amountToConsume.toFixed(1)}, Stock ${currentStock})`);
      }
    });

    if (shortages.length > 0) {
      const forceAssemble = confirm(
        `⚠️ WARNING: Insufficient Stock!\n\nThe following ingredients are short of the required run quantities:\n- ${shortages.join('\n- ')}\n\nDo you want to proceed and force consume raw materials? This will drive components into negative stock level.`
      );
      if (!forceAssemble) return;
    }

    setIsSubmittingProduction(true);

    try {
      const timestampStr = new Date().toISOString();

      // 1. Deduct component stocks and write ledger logs
      for (const cid of Object.keys(runDeductions)) {
        const itemDeduction = runDeductions[cid];
        const beforeQty = itemDeduction.currentStock;
        const afterQty = beforeQty - itemDeduction.qty;

        // Update product in Firestore
        const compRef = doc(db, `companies/${profile.companyId}/products`, cid);
        await updateDoc(compRef, {
          quantity: afterQty,
          currentStock: afterQty,
          updatedAt: timestampStr
        });

        // Write ledger stock movement
        const movementId = `move_${Date.now()}_consume_${cid.slice(0, 5)}`;
        const movementRef = doc(db, `companies/${profile.companyId}/stockMovements`, movementId);
        await setDoc(movementRef, {
          id: movementId,
          productId: cid,
          type: 'adjustment',
          quantity: -itemDeduction.qty,
          beforeQty,
          afterQty,
          createdAt: timestampStr,
          createdBy: user.email || 'Manufacturing System',
          reason: `Consumed in Production Order Run #${selectedOrder.id}`
        });
      }

      // 2. Add stock to the produced finished product & log output movement
      const finishedProd = productsMap.get(selectedOrder.productId);
      const finishedBeforeQty = finishedProd?.quantity || 0;
      const finishedAfterQty = finishedBeforeQty + qtyToProduce;

      const finishedRef = doc(db, `companies/${profile.companyId}/products`, selectedOrder.productId);
      await updateDoc(finishedRef, {
        quantity: finishedAfterQty,
        currentStock: finishedAfterQty,
        updatedAt: timestampStr
      });

      const finishedMoveId = `move_${Date.now()}_produce_output`;
      const finishedMoveRef = doc(db, `companies/${profile.companyId}/stockMovements`, finishedMoveId);
      await setDoc(finishedMoveRef, {
        id: finishedMoveId,
        productId: selectedOrder.productId,
        type: 'purchase',
        quantity: qtyToProduce,
        beforeQty: finishedBeforeQty,
        afterQty: finishedAfterQty,
        createdAt: timestampStr,
        createdBy: user.email || 'Manufacturing System',
        reason: `Finished Goods production output from Order #${selectedOrder.id}`
      });

      // 3. Update the Production Order items consumed counts and overall produced progress
      const updatedItems = selectedOrder.items.map(item => {
        const perUnitNeeded = item.quantityRequired / selectedOrder.quantityPlanned;
        const amountToConsume = perUnitNeeded * qtyToProduce;
        return {
          ...item,
          quantityConsumed: (item.quantityConsumed || 0) + amountToConsume
        };
      });

      const newQtyProduced = selectedOrder.quantityProduced + qtyToProduce;
      const isNowCompleted = newQtyProduced >= selectedOrder.quantityPlanned;
      const newStatus = isNowCompleted ? 'COMPLETED' : 'IN_PROGRESS';

      await updateDoc(doc(db, `companies/${profile.companyId}/production_orders`, selectedOrder.id), {
        quantityProduced: newQtyProduced,
        status: newStatus,
        items: updatedItems,
        updatedAt: timestampStr
      });

      alert(`🎉 Output Logged!\nProduced ${qtyToProduce} units of "${selectedOrder.productName}". Ingredients have been consumed and stock ledger updated successfully.`);
      
      if (isNowCompleted) {
        setSelectedOrderId(null);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'production_orders');
    } finally {
      setIsSubmittingProduction(false);
    }
  };

  // Helper Stats calculations
  const stats = useMemo(() => {
    let draft = 0;
    let active = 0;
    let completed = 0;
    let totalPlanned = 0;
    let totalProduced = 0;

    orders.forEach(o => {
      if (o.status === 'DRAFT') draft++;
      else if (o.status === 'RELEASED' || o.status === 'IN_PROGRESS') active++;
      else if (o.status === 'COMPLETED') completed++;

      totalPlanned += o.quantityPlanned || 0;
      totalProduced += o.quantityProduced || 0;
    });

    const efficiency = totalPlanned > 0 ? Math.round((totalProduced / totalPlanned) * 100) : 100;

    return { draft, active, completed, totalProduced, efficiency };
  }, [orders]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-left">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Production Execution</h2>
          <p className="text-slate-500 text-sm font-semibold mt-1">Connect BOM recipes to active floor execution, check material readiness, and post stock ledger items</p>
        </div>
        <button 
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-[#0f172a] text-white px-5 h-11 rounded-2xl font-black uppercase tracking-wider hover:bg-slate-800 transition-all text-xs shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Production Order
        </button>
      </div>

      {/* Analytics Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Draft Requests', value: stats.draft.toString(), bg: 'bg-slate-50 border-slate-200 text-slate-600' },
          { label: 'Active Scheduled', value: stats.active.toString(), bg: 'bg-blue-50/50 border-blue-100 text-blue-600' },
          { label: 'Completed Runs', value: stats.completed.toString(), bg: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
          { label: 'Total Output (Units)', value: stats.totalProduced.toLocaleString(), bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
          { label: 'Completion Rate', value: `${stats.efficiency}%`, bg: 'bg-white border-slate-200 text-slate-900' },
        ].map((stat, i) => (
          <div key={i} className={cn("p-5 rounded-3xl border shadow-sm", stat.bg)}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">{stat.label}</p>
            <h4 className="text-xl font-black mt-2 leading-none">{stat.value}</h4>
          </div>
        ))}
      </div>

      {/* Main interface layout: Split view if an order is selected, else Full-Width List */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* Orders directory list */}
        <div className={cn("space-y-4", selectedOrderId ? "xl:col-span-2" : "xl:col-span-3")}>
          
          {/* Filter, Search & Tab row */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search orders by product or run ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 shrink-0">
              {['ALL', 'DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((st) => (
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

          {/* Orders Listing */}
          <div className="space-y-4">
            {loading ? (
              <div className="bg-white border border-slate-200 rounded-[2rem] p-20 flex flex-col items-center justify-center gap-3 shadow-sm">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Active Queue...</span>
              </div>
            ) : filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const remaining = Math.max(0, order.quantityPlanned - order.quantityProduced);
                const progressPct = order.quantityPlanned > 0 ? Math.min(100, Math.round((order.quantityProduced / order.quantityPlanned) * 100)) : 0;
                const isSelected = selectedOrderId === order.id;

                // Simple check for raw component sufficiency
                let hasShortages = false;
                order.items.forEach(item => {
                  const stock = productsMap.get(item.componentId)?.quantity || 0;
                  const perUnitNeeded = item.quantityRequired / order.quantityPlanned;
                  const amountRemainingNeeded = perUnitNeeded * (order.quantityPlanned - order.quantityProduced);
                  if (stock < amountRemainingNeeded && order.status !== 'COMPLETED' && order.status !== 'CANCELLED') {
                    hasShortages = true;
                  }
                });

                return (
                  <div 
                    key={order.id}
                    onClick={() => setSelectedOrderId(isSelected ? null : order.id)}
                    className={cn(
                      "bg-white border rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group",
                      isSelected ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
                    )}
                  >
                    {/* Main order card details */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className={cn(
                          "w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 transition-colors",
                          order.status === 'COMPLETED' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                          order.status === 'IN_PROGRESS' ? "bg-indigo-50 border-indigo-100 text-indigo-600" :
                          order.status === 'RELEASED' ? "bg-blue-50 border-blue-100 text-blue-600" :
                          "bg-slate-50 border-slate-100 text-slate-400"
                        )}>
                          <Factory className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 text-left">
                          <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight truncate flex items-center gap-1.5 flex-wrap">
                            {order.productName}
                            {hasShortages && (
                              <span className="bg-amber-50 border border-amber-100 text-amber-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                                <AlertTriangle className="w-2 h-2" /> Material Short
                              </span>
                            )}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            <span className="font-mono text-slate-600">ID: {order.id}</span>
                            <span>•</span>
                            <span>Created {new Date(order.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status & Quantities values */}
                      <div className="flex items-center gap-6 shrink-0 text-right self-end md:self-auto">
                        <div>
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">Output Units</p>
                          <p className="font-extrabold text-slate-900 mt-1">
                            {order.quantityProduced} <span className="text-slate-400">/ {order.quantityPlanned}</span>
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">Progress</p>
                          <p className="font-extrabold text-slate-900 mt-1">{progressPct}%</p>
                        </div>

                        <span className={cn(
                          "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border shrink-0",
                          order.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          order.status === 'IN_PROGRESS' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                          order.status === 'RELEASED' ? "bg-blue-50 text-blue-600 border-blue-100" :
                          order.status === 'CANCELLED' ? "bg-rose-50 text-rose-600 border-rose-100" :
                          "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Progress slider bar */}
                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between gap-4">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-500",
                            order.status === 'COMPLETED' ? "bg-emerald-500" :
                            order.status === 'IN_PROGRESS' ? "bg-indigo-500" :
                            order.status === 'RELEASED' ? "bg-blue-400" :
                            "bg-slate-300"
                          )}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 group-hover:text-slate-900 transition-colors">
                        <span>Details & Execution</span>
                        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white border border-slate-200 rounded-[2rem] p-20 flex flex-col items-center justify-center text-center shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
                  <ClipboardList className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">No Production Runs Setup</h3>
                <p className="text-slate-400 text-xs font-semibold max-w-sm mt-2 leading-relaxed uppercase tracking-wider">
                  Create a production order instructions sheet based on your Bill of Materials recipes.
                </p>
                <button 
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-6 px-5 h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all"
                >
                  Create Your First Order
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Selected Order Detailed Panel Sidebar */}
        <AnimatePresence mode="wait">
          {selectedOrder && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white border border-slate-900 rounded-[2rem] shadow-lg overflow-hidden flex flex-col text-xs"
            >
              {/* Header block */}
              <div className="p-6 bg-slate-900 text-white relative text-left">
                <button 
                  onClick={() => setSelectedOrderId(null)}
                  className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
                
                <span className={cn(
                  "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                  selectedOrder.status === 'COMPLETED' ? "bg-emerald-500 text-white" :
                  selectedOrder.status === 'IN_PROGRESS' ? "bg-indigo-500 text-white" :
                  selectedOrder.status === 'RELEASED' ? "bg-blue-500 text-white" :
                  "bg-slate-700 text-slate-300"
                )}>
                  {selectedOrder.status}
                </span>

                <h3 className="font-extrabold text-base leading-tight uppercase tracking-tight mt-3 text-white">
                  {selectedOrder.productName}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  ID: {selectedOrder.id}
                </p>

                {/* Planned vs produced status */}
                <div className="grid grid-cols-2 gap-4 mt-5 p-3 bg-white/10 rounded-2xl">
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Planned Qty</p>
                    <p className="text-sm font-black text-white mt-1">{selectedOrder.quantityPlanned} units</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Completed Output</p>
                    <p className="text-sm font-black text-emerald-400 mt-1">{selectedOrder.quantityProduced} units</p>
                  </div>
                </div>
              </div>

              {/* Status Actions Controls Block */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 text-left space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">State Management Controls</p>
                <div className="flex flex-wrap gap-2">
                  
                  {/* Draft to Released */}
                  {selectedOrder.status === 'DRAFT' && (
                    <button
                      onClick={() => handleReleaseOrder(selectedOrder)}
                      className="px-4 h-9 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" /> Release Order
                    </button>
                  )}

                  {/* Released to In Progress */}
                  {selectedOrder.status === 'RELEASED' && (
                    <button
                      onClick={() => handleStartProduction(selectedOrder)}
                      className="px-4 h-9 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Start Production
                    </button>
                  )}

                  {/* Allow Cancel for Non-Final States */}
                  {['DRAFT', 'RELEASED', 'IN_PROGRESS'].includes(selectedOrder.status) && (
                    <button
                      onClick={() => handleCancelOrder(selectedOrder)}
                      className="px-4 h-9 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancel Order
                    </button>
                  )}

                  {/* Delete Option for Inactive / Cancelled */}
                  {['DRAFT', 'CANCELLED'].includes(selectedOrder.status) && (
                    <button
                      onClick={() => handleDeleteOrder(selectedOrder.id)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-rose-600 border border-slate-200 rounded-xl transition-all"
                      title="Delete Order Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Ingredients / Materials Allocation Block */}
              <div className="p-5 space-y-4 flex-1 text-left">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recipe Allocation Blueprint</p>
                  <span className="text-[9px] font-bold text-slate-400">Waste allowance included</span>
                </div>

                <div className="space-y-3">
                  {selectedOrder.items.map((item, i) => {
                    const currentStock = productsMap.get(item.componentId)?.quantity || 0;
                    const perUnit = item.quantityRequired / selectedOrder.quantityPlanned;
                    const runRemainingNeeded = perUnit * (selectedOrder.quantityPlanned - selectedOrder.quantityProduced);
                    const isShort = currentStock < runRemainingNeeded && selectedOrder.status !== 'COMPLETED' && selectedOrder.status !== 'CANCELLED';

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
                              Stock: {currentStock} units
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-200/50">
                          <div>
                            <p className="text-[8px] font-semibold text-slate-400 uppercase">Required</p>
                            <p className="font-bold text-slate-800">{item.quantityRequired.toFixed(1)}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-semibold text-slate-400 uppercase">Consumed</p>
                            <p className="font-bold text-slate-800">{item.quantityConsumed.toFixed(1)}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-semibold text-slate-400 uppercase">Remaining</p>
                            <p className="font-extrabold text-slate-800">{(item.quantityRequired - item.quantityConsumed).toFixed(1)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Execution panel when in progress */}
              {selectedOrder.status === 'IN_PROGRESS' && (
                <div className="p-5 border-t border-slate-100 bg-indigo-50/30 text-left space-y-4">
                  <div className="flex items-center gap-2">
                    <Factory className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Production Run Recorder</h4>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Quantity to produce in this run</label>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        min="1"
                        max={selectedOrder.quantityPlanned - selectedOrder.quantityProduced}
                        value={qtyToProduce}
                        onChange={(e) => setQtyToProduce(Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-24 h-10 bg-white border border-slate-200 rounded-xl px-3 font-bold text-center focus:ring-1 focus:ring-indigo-500 outline-none text-xs"
                      />
                      <button
                        onClick={() => {
                          const rem = selectedOrder.quantityPlanned - selectedOrder.quantityProduced;
                          setQtyToProduce(rem);
                        }}
                        className="px-3 h-10 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl font-bold uppercase text-[9px] tracking-wider transition-all shrink-0"
                      >
                        Max Remaining
                      </button>
                    </div>
                  </div>

                  {/* Materials live consumption estimation preview */}
                  <div className="p-3 bg-white border border-indigo-100 rounded-xl space-y-2">
                    <p className="text-[9px] font-bold text-indigo-900 uppercase">Estimated Material Consumption</p>
                    <div className="space-y-1 text-[11px] text-slate-600">
                      {selectedOrder.items.map((item, index) => {
                        const perUnit = item.quantityRequired / selectedOrder.quantityPlanned;
                        const toConsume = perUnit * qtyToProduce;
                        const currentStock = productsMap.get(item.componentId)?.quantity || 0;
                        const isShortage = currentStock < toConsume;

                        return (
                          <div key={index} className="flex justify-between items-center font-medium">
                            <span className="truncate max-w-[130px]">{item.productName}</span>
                            <span className={cn(
                              "font-bold",
                              isShortage ? "text-rose-600 font-black" : "text-slate-800"
                            )}>
                              Deduct: {toConsume.toFixed(1)} {isShortage && "(Short)"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteProductionRun}
                    disabled={isSubmittingProduction || qtyToProduce <= 0}
                    className="w-full h-11 bg-slate-900 text-white font-black uppercase tracking-wider rounded-xl hover:bg-slate-800 transition-all text-[10px] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmittingProduction ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post Run & Consume Materials"}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Creation Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 text-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-[2rem] shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0 text-left">
                <div className="flex items-center gap-2.5">
                  <Factory className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-black uppercase tracking-tight">Create Production Order Instruction</h3>
                </div>
                <button 
                  onClick={() => setIsCreateOpen(false)}
                  className="text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
                
                {productsWithBoms.length === 0 ? (
                  <div className="p-5 border border-amber-100 bg-amber-50/50 rounded-2xl space-y-3">
                    <div className="flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-extrabold text-amber-900 text-xs">No Active BOM Recipes Configured</h4>
                        <p className="text-[11px] text-amber-700/90 mt-1 leading-relaxed uppercase tracking-wider">
                          Before creating a production order, configure at least one recipe in the Bill of Materials tab first.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {/* Product selector */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Target Product (BOM Recipe List)</label>
                        <select
                          required
                          value={selectedProductId}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                          className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-extrabold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        >
                          <option value="">Select Finished Good / Subassembly</option>
                          {productsWithBoms.map(p => {
                            const bom = bomsMap.get(p.id);
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} (v{bom?.version || '1.0'})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Planned quantity input */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Planned Production Quantity</label>
                        <input 
                          type="number"
                          required
                          min="1"
                          value={plannedQty}
                          onChange={(e) => setPlannedQty(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* BOM explosion preview inside order creation */}
                    {selectedProductId && (
                      <div className="p-5 bg-indigo-50/30 border border-indigo-100 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider">Estimated Materials Requirement</span>
                          <span className="text-[9px] font-bold text-slate-400">Waste loss and components exploded</span>
                        </div>

                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {Object.keys(liveRequirements).map((cid) => {
                            const req = liveRequirements[cid];
                            const isShort = req.stock < req.needed;

                            return (
                              <div key={cid} className={cn(
                                "p-2.5 rounded-xl border flex items-center justify-between gap-4 text-xs font-semibold",
                                isShort ? "bg-rose-50/40 border-rose-100" : "bg-white border-slate-100"
                              )}>
                                <div className="min-w-0">
                                  <p className="font-extrabold text-slate-900 truncate">{req.name}</p>
                                  <p className="text-[9px] text-slate-400 font-mono">SKU: {req.sku}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-extrabold text-slate-800">Need: {req.needed.toFixed(1)} units</p>
                                  <p className={cn(
                                    "text-[9px] font-bold mt-0.5",
                                    isShort ? "text-rose-600" : "text-emerald-600"
                                  )}>
                                    Stock: {req.stock.toFixed(1)} units
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-2 border-t border-indigo-100 flex justify-between items-center text-[10px] font-black uppercase text-indigo-900 tracking-widest">
                          <span>Batch Recipe Cost</span>
                          <span>
                            {currency}{(getRolledUpCost(selectedProductId) * plannedQty).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {productsWithBoms.length > 0 && (
                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="flex-1 h-11 border border-slate-200 rounded-xl font-bold uppercase text-[10px] tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingOrder}
                      className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmittingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Draft Instruction"}
                    </button>
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
