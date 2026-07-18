import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, ClipboardList, Loader2, Search, Trash2, Edit3, CheckCircle2, 
  XCircle, AlertTriangle, Layers, ArrowRight, TrendingUp, Sparkles, 
  RefreshCcw, Coins, Settings2, ShieldCheck, HelpCircle, ChevronDown, ChevronRight, FileText, Package, Factory
} from 'lucide-react';
import { collection, onSnapshot, query, setDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface BOMItem {
  componentId: string;
  quantity: number; // Qty required to make 1 unit of parent
}

interface BOMData {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  version: string;
  wasteFactor: number; // percentage loss e.g. 5 for 5%
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  items: BOMItem[];
  createdAt: string;
  updatedAt: string;
}

export function BOM() {
  const { user } = useAuth();
  const { profile, currency } = useSettings();

  const [products, setProducts] = useState<any[]>([]);
  const [boms, setBoms] = useState<BOMData[]>([]);
  const [productionOrders, setProductionOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Layout Tab selection
  const [activeTab, setActiveTab] = useState<'boms' | 'orders' | 'classify'>('boms');

  // Interactive controls
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedBOM, setSelectedBOM] = useState<BOMData | null>(null);
  
  // Production Simulator states
  const [isProducing, setIsProducing] = useState(false);
  const [produceQty, setProduceQty] = useState<number>(10);
  const [isSubmittingProduction, setIsSubmittingProduction] = useState(false);

  // Form states for creating/editing BOM
  const [formProductId, setFormProductId] = useState('');
  const [formVersion, setFormVersion] = useState('1.0');
  const [formWasteFactor, setFormWasteFactor] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'DRAFT' | 'INACTIVE'>('ACTIVE');
  const [formItems, setFormItems] = useState<BOMItem[]>([
    { componentId: '', quantity: 1 }
  ]);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // Product classification states
  const [classifyingProduct, setClassifyingProduct] = useState<any | null>(null);
  const [classificationGroup, setClassificationGroup] = useState('Raw Materials');

  // Accordion state for multi-level tree expand/collapse
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!profile?.companyId) return;

    setLoading(true);

    // Real-time Products snapshot
    const qProducts = collection(db, `companies/${profile.companyId}/products`);
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    // Real-time BOMs snapshot
    const qBoms = collection(db, `companies/${profile.companyId}/boms`);
    const unsubBoms = onSnapshot(qBoms, (snapshot) => {
      setBoms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BOMData)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'boms');
    });

    // Real-time Production orders snapshot
    const qOrders = collection(db, `companies/${profile.companyId}/production_orders`);
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setProductionOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

  // Map products and boms for fast, recursive calculations
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

  // Flattened total raw requirements (to check actual required components at the base level)
  const getFlattenedRequirements = (explodedItems: any[]): Record<string, { name: string; sku: string; needed: number; stock: number; price: number }> => {
    const requirements: Record<string, { name: string; sku: string; needed: number; stock: number; price: number }> = {};

    const traverse = (items: any[]) => {
      items.forEach(item => {
        if (item.isSubassembly && item.subItems.length > 0) {
          // If subassembly has BOM, we can choose to produce S_A on the fly. 
          // However, we also check if we already have the subassembly in stock.
          // In standard logistics, if subassembly stock is insufficient, we explode.
          const shortQty = Math.max(0, item.quantityNeeded - item.currentStock);
          if (shortQty > 0) {
            // Explode components of subassembly for the shortfall
            traverse(item.subItems);
          }
        } else {
          // Base raw component
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

  // Rolled-up Manufacturing Cost for 1 Unit of Product
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

  // Filtered BOMs Directory
  const filteredBoms = useMemo(() => {
    return boms.filter(bom => {
      const prod = productsMap.get(bom.productId);
      const nameMatch = prod?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const skuMatch = prod?.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch || skuMatch || bom.version.includes(searchTerm);
    });
  }, [boms, searchTerm, productsMap]);

  // Open Form to Create or Edit BOM
  const handleOpenForm = (bom?: BOMData) => {
    if (bom) {
      setSelectedBOM(bom);
      setFormProductId(bom.productId);
      setFormVersion(bom.version);
      setFormWasteFactor(bom.wasteFactor || 0);
      setFormStatus(bom.status);
      setFormItems(bom.items.length > 0 ? bom.items : [{ componentId: '', quantity: 1 }]);
    } else {
      setSelectedBOM(null);
      setFormProductId('');
      setFormVersion('1.0');
      setFormWasteFactor(0);
      setFormStatus('ACTIVE');
      setFormItems([{ componentId: '', quantity: 1 }]);
    }
    setIsFormOpen(true);
  };

  // Add Item Line to BOM Editor
  const handleAddFormItem = () => {
    setFormItems([...formItems, { componentId: '', quantity: 1 }]);
  };

  // Remove Item Line from BOM Editor
  const handleRemoveFormItem = (index: number) => {
    const updated = [...formItems];
    updated.splice(index, 1);
    setFormItems(updated.length > 0 ? updated : [{ componentId: '', quantity: 1 }]);
  };

  // Update Field inside Form Line
  const handleFormItemChange = (index: number, field: keyof BOMItem, value: any) => {
    const updated = [...formItems];
    updated[index] = {
      ...updated[index],
      [field]: field === 'quantity' ? parseFloat(value) || 0 : value
    };
    setFormItems(updated);
  };

  // Save BOM to Firestore
  const handleSaveBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !formProductId) return;

    // Validate recipe components
    const validItems = formItems.filter(item => item.componentId && item.quantity > 0);
    if (validItems.length === 0) {
      alert("Please add at least one valid component item to the Bill of Materials recipe.");
      return;
    }

    // Check for circular dependency
    const detectCircular = (childId: string, parentId: string, visited = new Set<string>()): boolean => {
      if (childId === parentId) return true;
      if (visited.has(childId)) return false;
      visited.add(childId);

      const subBom = bomsMap.get(childId);
      if (!subBom) return false;

      return subBom.items.some(item => detectCircular(item.componentId, parentId, new Set(visited)));
    };

    const hasCircular = validItems.some(item => detectCircular(item.componentId, formProductId));
    if (hasCircular) {
      alert("Error: Circular dependency detected! A subassembly component cannot have a recipe that requires the parent product.");
      return;
    }

    setIsSubmittingForm(true);

    try {
      const prodObj = productsMap.get(formProductId);
      const bomId = `bom_${formProductId}`;

      const bomPayload: BOMData = {
        id: bomId,
        productId: formProductId,
        productName: prodObj?.name || 'Recipe Product',
        productSku: prodObj?.sku || '',
        version: formVersion || '1.0',
        wasteFactor: formWasteFactor || 0,
        status: formStatus,
        items: validItems,
        createdAt: selectedBOM?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, `companies/${profile.companyId}/boms`, bomId), bomPayload);
      
      // Update product material group if not set, or mark it finished/subassembly
      const currentGroup = prodObj?.materialGroup;
      if (!currentGroup || currentGroup === 'Raw Materials') {
        const productRef = doc(db, `companies/${profile.companyId}/products`, formProductId);
        await updateDoc(productRef, {
          materialGroup: 'Finished Goods',
          updatedAt: new Date().toISOString()
        });
      }

      setIsFormOpen(false);
      setSelectedBOM(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'boms');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Delete BOM from Firestore
  const handleDeleteBOM = async (bomId: string) => {
    if (!profile?.companyId) return;
    if (!confirm("Are you sure you want to delete this manufacturing recipe (BOM)? This action cannot be undone.")) return;

    try {
      await deleteDoc(doc(db, `companies/${profile.companyId}/boms`, bomId));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'boms');
    }
  };

  // Toggle Accordion node
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Execute Assembly & Material Deductions
  const handleExecuteProduction = async () => {
    if (!profile?.companyId || !selectedBOM || !user) return;
    if (produceQty <= 0) {
      alert("Please enter a valid production quantity.");
      return;
    }

    const exploded = getExplodedBOM(selectedBOM.productId, produceQty);
    const flatRequirements = getFlattenedRequirements(exploded);

    // Verify stock availability
    const shortageItems: string[] = [];
    Object.keys(flatRequirements).forEach(cid => {
      const req = flatRequirements[cid];
      if (req.stock < req.needed) {
        shortageItems.push(`${req.name} (Shortage: ${(req.needed - req.stock).toFixed(1)})`);
      }
    });

    if (shortageItems.length > 0) {
      const confirmForce = confirm(
        `⚠️ WARNING: Insufficient Raw Materials!\n\nThe following items do not have enough stock:\n- ${shortageItems.join('\n- ')}\n\nDo you want to proceed and force assemble? This will drive components into NEGATIVE stock levels.`
      );
      if (!confirmForce) return;
    }

    setIsSubmittingProduction(true);

    try {
      const timestampStr = new Date().toISOString();
      const pOrderId = `order_${Date.now()}`;
      const rolledUpUnitCost = getRolledUpCost(selectedBOM.productId);

      // 1. Deduct component stocks and log individual stock movements
      for (const cid of Object.keys(flatRequirements)) {
        const req = flatRequirements[cid];
        const beforeQty = req.stock;
        const afterQty = Math.max(0, beforeQty - req.needed); // Clamp to zero if desired, or go negative if forced

        // Update ingredient product quantity
        const componentRef = doc(db, `companies/${profile.companyId}/products`, cid);
        await updateDoc(componentRef, {
          quantity: afterQty,
          currentStock: afterQty,
          updatedAt: timestampStr
        });

        // Write ledger stock movement
        const movementId = `move_${Date.now()}_${cid.slice(0, 5)}`;
        const movementRef = doc(db, `companies/${profile.companyId}/stockMovements`, movementId);
        await setDoc(movementRef, {
          id: movementId,
          productId: cid,
          type: 'adjustment', // Production material deduction
          quantity: -req.needed,
          beforeQty,
          afterQty,
          createdAt: timestampStr,
          createdBy: user.email || 'Manufacturing Operator',
          reason: `Production allocation for ${selectedBOM.productName} (x${produceQty})`
        });
      }

      // 2. Increase stock of the produced finished product
      const targetProd = productsMap.get(selectedBOM.productId);
      const finishedBeforeQty = targetProd?.quantity || 0;
      const finishedAfterQty = finishedBeforeQty + produceQty;

      const finishedRef = doc(db, `companies/${profile.companyId}/products`, selectedBOM.productId);
      await updateDoc(finishedRef, {
        quantity: finishedAfterQty,
        currentStock: finishedAfterQty,
        updatedAt: timestampStr
      });

      // Write ledger stock movement for the finished good
      const movementIdFinished = `move_${Date.now()}_prod_output`;
      const movementRefFinished = doc(db, `companies/${profile.companyId}/stockMovements`, movementIdFinished);
      await setDoc(movementRefFinished, {
        id: movementIdFinished,
        productId: selectedBOM.productId,
        type: 'purchase', // Added as a receipt of goods
        quantity: produceQty,
        beforeQty: finishedBeforeQty,
        afterQty: finishedAfterQty,
        createdAt: timestampStr,
        createdBy: user.email || 'Manufacturing Operator',
        reason: `Production output run complete`
      });

      // 3. Write record into production_orders (integrates with Production tab logs!)
      const orderRef = doc(db, `companies/${profile.companyId}/production_orders`, pOrderId);
      await setDoc(orderRef, {
        id: pOrderId,
        productName: selectedBOM.productName,
        productId: selectedBOM.productId,
        quantity: produceQty,
        status: 'COMPLETED',
        createdAt: timestampStr,
        updatedAt: timestampStr,
        materialsCost: rolledUpUnitCost * produceQty,
        items: Object.keys(flatRequirements).map(cid => ({
          productId: cid,
          productName: flatRequirements[cid].name,
          quantityRequired: flatRequirements[cid].needed,
          stockBefore: flatRequirements[cid].stock,
          stockAfter: Math.max(0, flatRequirements[cid].stock - flatRequirements[cid].needed)
        }))
      });

      alert(`🎉 Assembly Successful!\nProduced ${produceQty} units of "${selectedBOM.productName}". Components stocks have been deducted.`);
      setIsProducing(false);
      setProduceQty(10);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'production_orders');
    } finally {
      setIsSubmittingProduction(false);
    }
  };

  // Quick classify action
  const handleQuickClassify = async (productId: string, materialGroup: string) => {
    if (!profile?.companyId) return;
    try {
      const productRef = doc(db, `companies/${profile.companyId}/products`, productId);
      await updateDoc(productRef, {
        materialGroup,
        updatedAt: new Date().toISOString()
      });
      setClassifyingProduct(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    }
  };

  // Render multi-level exploded tree visualizer
  const renderTreeNodes = (items: any[], level = 0, parentKey = '') => {
    return items.map((item, idx) => {
      const key = `${parentKey}-${item.componentId}-${idx}`;
      const isExpanded = !!expandedNodes[key];
      const hasSubItems = item.subItems.length > 0;
      const isShortage = item.currentStock < item.quantityNeeded;

      return (
        <div key={key} className="space-y-2">
          <div 
            className={cn(
              "flex items-center justify-between p-3 rounded-xl border transition-all text-xs",
              level === 0 ? "bg-slate-50/60 border-slate-100" : "bg-white border-slate-100",
              isShortage ? "border-rose-100 bg-rose-50/30" : ""
            )}
            style={{ marginLeft: `${level * 24}px` }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {hasSubItems ? (
                <button 
                  onClick={() => toggleNode(key)}
                  className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>
              ) : (
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                </div>
              )}

              <div className="min-w-0 text-left">
                <p className="font-extrabold text-slate-900 truncate flex items-center gap-2">
                  {item.name}
                  {item.isSubassembly && (
                    <span className="text-[8px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                      Subassembly
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.sku}</p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-right shrink-0">
              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Qty Required</p>
                <p className="font-bold text-slate-900 mt-1">{(item.quantityNeeded).toFixed(1)} units</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">({item.quantityPerUnit} / unit)</p>
              </div>

              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">In Stock</p>
                <p className={cn("font-extrabold mt-1", isShortage ? "text-rose-600" : "text-emerald-600")}>
                  {item.currentStock} units
                </p>
                {isShortage && (
                  <span className="text-[8px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">
                    Shortage: {(item.quantityNeeded - item.currentStock).toFixed(1)}
                  </span>
                )}
              </div>

              <div className="w-20">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Unit Cost</p>
                <p className="font-black text-slate-900 mt-1">{currency}{(item.buyingPrice).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {hasSubItems && isExpanded && (
            <div className="relative">
              {/* Vertical link line indicator for subassembly tree */}
              <div 
                className="absolute left-3.5 top-0 bottom-2 w-0.5 border-l-2 border-dashed border-slate-200"
                style={{ marginLeft: `${level * 24}px` }}
              />
              {renderTreeNodes(item.subItems, level + 1, key)}
            </div>
          )}
        </div>
      );
    });
  };

  // Products available to serve as Finished Good / Subassembly recipes
  const eligibleProducts = useMemo(() => {
    return products.filter(p => p.materialGroup === 'Finished Goods' || p.materialGroup === 'Subassembly' || !p.materialGroup);
  }, [products]);

  // Products serving as Raw Components / Ingredients
  const ingredientProducts = useMemo(() => {
    return products; // All products can serve as raw materials
  }, [products]);

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-500 pb-20">
      
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Bill of Materials Redesign</h2>
          <p className="text-slate-500 text-sm font-semibold mt-1">Configure manufacturing recipes, track recursive cost roll-ups, and run inventory deductions.</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => handleOpenForm()}
            className="flex items-center gap-2 bg-[#0f172a] text-white px-5 h-11 rounded-2xl font-black uppercase tracking-wider hover:bg-slate-800 transition-all text-xs"
          >
            <Plus className="w-4 h-4" />
            Create Recipe (BOM)
          </button>
        </div>
      </div>

      {/* Nav Tabs Bar */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-max">
        <button
          onClick={() => setActiveTab('boms')}
          className={cn(
            "px-4 h-9 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all",
            activeTab === 'boms' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-950"
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          Recipes Directory ({filteredBoms.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={cn(
            "px-4 h-9 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all",
            activeTab === 'orders' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-950"
          )}
        >
          <Factory className="w-3.5 h-3.5" />
          Production Logs ({productionOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('classify')}
          className={cn(
            "px-4 h-9 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all",
            activeTab === 'classify' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-950"
          )}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Material Classifications
        </button>
      </div>

      {activeTab === 'boms' && (
        <div className="space-y-6">
          {/* Filters & search line */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search recipe by product name, SKU or version..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
              <Coins className="w-4 h-4 text-emerald-500" />
              <span>Cost values are dynamically calculated from current ingredients cost.</span>
            </div>
          </div>

          {/* Recipes Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Recipes Directory...</span>
              </div>
            ) : filteredBoms.length > 0 ? (
              filteredBoms.map((bom) => {
                const prod = productsMap.get(bom.productId);
                const exploded = getExplodedBOM(bom.productId, 1);
                const unitCost = getRolledUpCost(bom.productId);
                const sellingPrice = prod?.sellingPrice || prod?.price || 0;
                const margin = sellingPrice > 0 ? ((sellingPrice - unitCost) / sellingPrice) * 100 : 0;

                // Check readiness for at least 1 unit production
                const flatReqs = getFlattenedRequirements(exploded);
                let canAssemble = true;
                let shortCount = 0;
                Object.keys(flatReqs).forEach(cid => {
                  const req = flatReqs[cid];
                  if (req.stock < req.needed) {
                    canAssemble = false;
                    shortCount++;
                  }
                });

                return (
                  <motion.div 
                    layout
                    key={bom.id} 
                    className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div>
                      {/* Top status bar */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                          <ClipboardList className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                            bom.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                          )}>
                            v{bom.version} • {bom.status}
                          </span>
                          
                          {canAssemble ? (
                            <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                              Ready to Produce
                            </span>
                          ) : (
                            <span className="bg-rose-50 text-rose-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                              {shortCount} Component Shortage
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & SKU */}
                      <h3 className="font-extrabold text-slate-900 text-lg leading-tight uppercase tracking-tight truncate">
                        {bom.productName}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5 font-mono">
                        SKU: {bom.productSku || 'N/A'}
                      </p>

                      {/* Waste factor badge */}
                      {bom.wasteFactor > 0 && (
                        <span className="inline-block mt-2 bg-amber-50 text-amber-600 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                          Waste Allowance: {bom.wasteFactor}%
                        </span>
                      )}

                      {/* Core recipe stats */}
                      <div className="grid grid-cols-2 gap-4 mt-5 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-none">Manufacture Cost</p>
                          <p className="font-black text-slate-900 mt-1">{currency}{unitCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-none">Gross Margin</p>
                          <p className={cn(
                            "font-black mt-1",
                            margin > 25 ? "text-emerald-600" : margin > 0 ? "text-amber-600" : "text-rose-600"
                          )}>
                            {margin > 0 ? `${margin.toFixed(0)}%` : 'Negative'}
                          </p>
                        </div>
                      </div>

                      {/* Direct components summary list */}
                      <div className="mt-4 space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Direct Ingredients:</p>
                        <div className="text-[11px] text-slate-600 space-y-1">
                          {bom.items.slice(0, 3).map((item, i) => {
                            const cName = productsMap.get(item.componentId)?.name || 'Unknown Item';
                            return (
                              <div key={i} className="flex justify-between items-center font-semibold">
                                <span className="truncate max-w-[150px]">{cName}</span>
                                <span className="text-slate-500 font-bold">x{item.quantity}</span>
                              </div>
                            );
                          })}
                          {bom.items.length > 3 && (
                            <p className="text-[9px] text-slate-400 font-extrabold italic">+{bom.items.length - 3} more ingredients</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons footer */}
                    <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => handleOpenForm(bom)}
                          className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 hover:border-slate-300 transition-colors"
                          title="Edit Recipe"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                        <button 
                          onClick={() => handleDeleteBOM(bom.id)}
                          className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center hover:bg-rose-100 hover:border-rose-200 transition-colors"
                          title="Delete Recipe"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                      </div>

                      <button 
                        onClick={() => {
                          setSelectedBOM(bom);
                          setIsProducing(true);
                        }}
                        className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-4 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        <Factory className="w-3.5 h-3.5" />
                        Assemble / Produce
                      </button>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="col-span-full bg-white border border-slate-200 rounded-[2rem] p-20 flex flex-col items-center justify-center text-center shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
                  <ClipboardList className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">No Recipes Setup Yet</h3>
                <p className="text-slate-400 text-xs font-semibold max-w-sm leading-relaxed mt-2 uppercase tracking-wider">
                  You haven't defined any Bills of Materials. Setup recipes to calculate rolled costs and track automatic deductions.
                </p>
                <button 
                  onClick={() => handleOpenForm()}
                  className="mt-6 px-5 h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all"
                >
                  Create Your First BOM
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 uppercase tracking-tight text-sm">Manufacturing Assembly Logs</h3>
              <p className="text-xs text-slate-400 font-medium">Historical runs showing exactly which ingredients were resolved and deducted.</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="space-y-4">
            {productionOrders.length > 0 ? (
              productionOrders.map((ord) => (
                <div key={ord.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:border-slate-300 transition-all text-xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">{ord.productName}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Run ID: #{ord.id}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Produced Run Qty</p>
                        <p className="font-extrabold text-slate-900 text-sm">+{ord.quantity} units</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total Batch Cost</p>
                        <p className="font-extrabold text-emerald-600 text-sm">
                          {currency}{(ord.materialsCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                        COMPLETED
                      </span>
                    </div>
                  </div>

                  {/* Materials list of what was used */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Materials Allocated & Deducted:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {ord.items?.map((item: any, i: number) => (
                        <div key={i} className="bg-slate-50/60 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{item.productName}</p>
                            <p className="text-[9px] text-slate-400 font-mono">ID: {item.productId?.slice(0, 10)}</p>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="font-extrabold text-slate-700">-{item.quantityRequired} units</p>
                            <p className="text-[8px] text-slate-400 font-semibold">Ledger Updated</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>Manufacturing Date: {new Date(ord.createdAt).toLocaleString()}</span>
                    <span>Operator: {ord.createdBy || 'System'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl p-16 flex flex-col items-center justify-center text-center shadow-sm">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                  <Factory className="w-6 h-6 text-slate-300" />
                </div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">No Manufacturing Runs Logged</h4>
                <p className="text-slate-400 text-xs font-semibold mt-1">Run assembly on any configured Bill of Materials recipe to write stock ledger logs.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'classify' && (
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm text-xs space-y-6">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-tight">Material Classifications & Inventory Types</h3>
            <p className="text-slate-500 text-sm font-semibold mt-0.5">Define which inventory products are classified as Raw Materials, Finished Goods, or Subassemblies.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="pb-3">Product Name</th>
                  <th className="pb-3">SKU</th>
                  <th className="pb-3 text-center">In Stock</th>
                  <th className="pb-3">Current Classification</th>
                  <th className="pb-3 text-right">Quick Classify Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 font-bold text-slate-950">{prod.name}</td>
                    <td className="py-3.5 font-mono text-[10px] text-slate-400 font-semibold">{prod.sku}</td>
                    <td className="py-3.5 text-center font-extrabold text-slate-700">{prod.quantity} {prod.uom || 'units'}</td>
                    <td className="py-3.5">
                      <span className={cn(
                        "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider",
                        prod.materialGroup === 'Finished Goods' ? "bg-indigo-50 text-indigo-600" :
                        prod.materialGroup === 'Subassembly' ? "bg-amber-50 text-amber-600" :
                        "bg-slate-50 text-slate-600"
                      )}>
                        {prod.materialGroup || 'Raw Materials'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleQuickClassify(prod.id, 'Raw Materials')}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase tracking-wider border border-slate-200"
                        >
                          Raw Material
                        </button>
                        <button
                          onClick={() => handleQuickClassify(prod.id, 'Subassembly')}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded text-[9px] font-black uppercase tracking-wider border border-amber-100"
                        >
                          Subassembly
                        </button>
                        <button
                          onClick={() => handleQuickClassify(prod.id, 'Finished Goods')}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[9px] font-black uppercase tracking-wider border border-indigo-100"
                        >
                          Finished Good
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT RECIPE MODAL */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">
                    {selectedBOM ? 'Modify Recipe (BOM)' : 'Create Manufacturing Recipe'}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">Define ingredients and units required to assemble one finished good.</p>
                </div>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBOM} className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Select Finished product */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Finished Product</label>
                    <select
                      value={formProductId}
                      onChange={(e) => setFormProductId(e.target.value)}
                      required
                      disabled={!!selectedBOM}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="">-- Choose Product to build recipe for --</option>
                      {eligibleProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku || 'No SKU'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recipe Version</label>
                      <input 
                        type="text"
                        value={formVersion}
                        onChange={(e) => setFormVersion(e.target.value)}
                        placeholder="e.g. 1.0"
                        required
                        className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Waste Factor %</label>
                      <input 
                        type="number"
                        min="0"
                        max="50"
                        value={formWasteFactor}
                        onChange={(e) => setFormWasteFactor(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recipe Status</label>
                  <div className="flex gap-2">
                    {['ACTIVE', 'DRAFT', 'INACTIVE'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setFormStatus(st as any)}
                        className={cn(
                          "px-4 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                          formStatus === st 
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900"
                        )}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipe Line Items Editor */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recipe Ingredients & Quantities</span>
                    <button
                      type="button"
                      onClick={handleAddFormItem}
                      className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-xs font-extrabold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Ingredient
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="flex gap-3 items-center">
                        <span className="text-[10px] font-black text-slate-400 w-6 shrink-0">#{idx + 1}</span>
                        
                        <div className="flex-1">
                          <select
                            value={item.componentId}
                            onChange={(e) => handleFormItemChange(idx, 'componentId', e.target.value)}
                            required
                            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                          >
                            <option value="">-- Choose Ingredient component --</option>
                            {ingredientProducts.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.sku || 'No SKU'}) • {p.quantity || 0} in stock</option>
                            ))}
                          </select>
                        </div>

                        <div className="w-32 shrink-0">
                          <input 
                            type="number"
                            step="any"
                            min="0.0001"
                            value={item.quantity}
                            onChange={(e) => handleFormItemChange(idx, 'quantity', e.target.value)}
                            placeholder="Qty needed"
                            required
                            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFormItem(idx)}
                          className="w-10 h-11 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center hover:bg-rose-100 hover:border-rose-200 transition-colors shrink-0"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real-time Dynamic rolled manufacturing cost helper */}
                {formProductId && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                    <p className="font-black text-slate-800 uppercase tracking-widest text-[9px] mb-2">Recipe Cost Estimator</p>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Total Unit Ingredients Cost (incl. waste %):</span>
                      <span className="font-extrabold text-slate-900">
                        {currency}
                        {formItems.reduce((sum, item) => {
                          if (!item.componentId || !item.quantity) return sum;
                          const buyingP = productsMap.get(item.componentId)?.buyingPrice || productsMap.get(item.componentId)?.value || 0;
                          return sum + (buyingP * item.quantity * (1 + (formWasteFactor || 0) / 100));
                        }, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                  </div>
                )}

              </form>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="h-11 px-5 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleSaveBOM}
                  disabled={isSubmittingForm || !formProductId}
                  className="h-11 px-6 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black uppercase tracking-wider rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  {isSubmittingForm ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Recipe...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Save Recipe (BOM)
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRODUCTION ASSEMBLER PANEL */}
      <AnimatePresence>
        {isProducing && selectedBOM && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Factory className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">
                      Run Manufacturing & Production
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Assemble "{selectedBOM.productName}" and execute raw materials inventory deduction.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsProducing(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left hand controls & specs */}
                <div className="space-y-6 lg:border-r lg:border-slate-100 lg:pr-8">
                  
                  {/* Enter quantity */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Production Qty</label>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        min="1"
                        value={produceQty}
                        onChange={(e) => setProduceQty(Math.max(1, parseInt(e.target.value) || 0))}
                        className="flex-1 h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all text-center"
                      />
                      <span className="h-12 px-4 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-xs font-black text-slate-500 uppercase shrink-0">
                        Units
                      </span>
                    </div>
                  </div>

                  {/* Financial projections Card */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
                    <p className="font-black text-slate-800 uppercase tracking-widest text-[9px]">Financial Projections (Batch)</p>
                    
                    <div className="space-y-2 divide-y divide-slate-100 text-xs text-slate-600">
                      <div className="flex justify-between items-center py-2">
                        <span>Unit Rolled Materials Cost:</span>
                        <span className="font-extrabold text-slate-900">
                          {currency}{getRolledUpCost(selectedBOM.productId).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span>Total Run Materials Cost:</span>
                        <span className="font-extrabold text-slate-900">
                          {currency}{(getRolledUpCost(selectedBOM.productId) * produceQty).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span>Projected Sales Value:</span>
                        <span className="font-black text-indigo-600">
                          {currency}{((productsMap.get(selectedBOM.productId)?.sellingPrice || productsMap.get(selectedBOM.productId)?.price || 0) * produceQty).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-[10px] text-indigo-700 font-semibold leading-relaxed">
                    ⚙️ Clicking "Execute Assembly" will instantly deduct ingredients stock values and add output units to "{selectedBOM.productName}".
                  </div>
                </div>

                {/* Right hand exploded multi-level tree visualizer */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Multi-Level Materials Requirements Analysis</p>
                    <span className="text-[10px] font-bold text-indigo-600">Recursive Explosion Active</span>
                  </div>

                  {/* Hierarchical tree of components */}
                  <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/30 space-y-3 max-h-[400px] overflow-y-auto">
                    {renderTreeNodes(getExplodedBOM(selectedBOM.productId, produceQty))}
                  </div>

                  {/* Summary check indicators */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>Base Ingredient Lines Required:</span>
                    <span className="font-black text-slate-900">
                      {Object.keys(getFlattenedRequirements(getExplodedBOM(selectedBOM.productId, produceQty))).length} items
                    </span>
                  </div>
                </div>

              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProducing(false)}
                  className="h-11 px-5 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel Run
                </button>
                <button
                  onClick={handleExecuteProduction}
                  disabled={isSubmittingProduction}
                  className="h-11 px-6 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black uppercase tracking-wider rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  {isSubmittingProduction ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Assembling Stocks...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Execute Assembly (x{produceQty} Units)
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
