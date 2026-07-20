import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Factory, BarChart3, Loader2, Clock, CheckCircle2, AlertTriangle, 
  Play, Check, XCircle, Search, Trash2, ArrowRight, Layers, FileText, 
  ChevronRight, ChevronDown, Package, ClipboardList, ShieldCheck, RefreshCcw,
  Boxes, Calendar, Settings, DollarSign, Activity, Hammer, BadgeCheck, Scale
} from 'lucide-react';
import { collection, onSnapshot, query, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Sub-components import
import { MRP } from './MRP';
import { MaterialRequisitions } from './MaterialRequisitions';
import { ProductionPlanning } from './ProductionPlanning';
import { WIP } from './WIP';
import { QualityControl } from './QualityControl';
import { CostAnalysis } from './CostAnalysis';
import { ProductionAnalytics } from './ProductionAnalytics';

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
  status: 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'QA' | 'COMPLETED' | 'CANCELLED';
  bomId: string;
  createdAt: string;
  updatedAt: string;
  materialsCost?: number;
  items: ProductionOrderItem[];
  requisitionId?: string;
  issueId?: string;
  hasIssued?: boolean;
}

export function ProductionOrders({ initialTab }: { initialTab?: string }) {
  const { user } = useAuth();
  const { profile, currency } = useSettings();

  // Unified State Stores
  const [products, setProducts] = useState<any[]>([]);
  const [boms, setBoms] = useState<BOMData[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [qcLogs, setQcLogs] = useState<any[]>([]);
  const [outputs, setOutputs] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Active Hub Tab Selection
  const [activeTab, setActiveTab] = useState<
    'analytics' | 'boms' | 'planning' | 'mrp' | 'requisitions' | 'issues' | 'orders' | 'wip' | 'output' | 'qc' | 'costing'
  >((initialTab as any) || 'analytics');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);

  // Filter/Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Detail view state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Direct Creation states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [plannedQty, setPlannedQty] = useState<number>(10);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Output Posting states
  const [outputOrderId, setOutputOrderId] = useState('');
  const [outputQty, setOutputQty] = useState<number>(10);
  const [wastageActual, setWastageActual] = useState<number>(0);
  const [isSubmittingOutput, setIsSubmittingOutput] = useState(false);

  // Real-time Firestore Subscriptions
  useEffect(() => {
    if (!profile?.companyId) return;

    setLoading(true);

    const companyPath = `companies/${profile.companyId}`;

    const unsubProducts = onSnapshot(collection(db, `${companyPath}/products`), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    const unsubBoms = onSnapshot(collection(db, `${companyPath}/boms`), (snapshot) => {
      setBoms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BOMData)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'boms'));

    const unsubOrders = onSnapshot(collection(db, `${companyPath}/production_orders`), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionOrder)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'production_orders');
      setLoading(false);
    });

    const unsubPlans = onSnapshot(collection(db, `${companyPath}/production_plans`), (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'production_plans'));

    const unsubReqs = onSnapshot(collection(db, `${companyPath}/material_requisitions`), (snapshot) => {
      setRequisitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'material_requisitions'));

    const unsubIssues = onSnapshot(collection(db, `${companyPath}/material_issues`), (snapshot) => {
      setIssues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'material_issues'));

    const unsubQc = onSnapshot(collection(db, `${companyPath}/qc_logs`), (snapshot) => {
      setQcLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'qc_logs'));

    const unsubOutputs = onSnapshot(collection(db, `${companyPath}/production_outputs`), (snapshot) => {
      setOutputs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'production_outputs'));

    return () => {
      unsubProducts();
      unsubBoms();
      unsubOrders();
      unsubPlans();
      unsubReqs();
      unsubIssues();
      unsubQc();
      unsubOutputs();
    };
  }, [profile?.companyId]);

  const productsMap = useMemo(() => new Map<string, any>(products.map(p => [p.id, p])), [products]);
  const bomsMap = useMemo(() => new Map<string, BOMData>(boms.map(b => [b.productId, b])), [boms]);

  // --- Production Planning Handlers ---
  const handleAddPlan = async (newPlan: any) => {
    if (!profile?.companyId) return;
    const planId = `PLAN-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;
    const payload = {
      ...newPlan,
      id: planId,
      planningNumber: planId,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, `companies/${profile.companyId}/production_plans`, planId), payload);
  };

  const handleApprovePlan = async (planId: string) => {
    if (!profile?.companyId) return;
    await updateDoc(doc(db, `companies/${profile.companyId}/production_plans`, planId), {
      status: 'APPROVED'
    });
  };

  const handleCancelPlan = async (planId: string) => {
    if (!profile?.companyId) return;
    await updateDoc(doc(db, `companies/${profile.companyId}/production_plans`, planId), {
      status: 'CANCELLED'
    });
  };

  const handleDeletePlan = async (planId: string) => {
    if (!profile?.companyId) return;
    await deleteDoc(doc(db, `companies/${profile.companyId}/production_plans`, planId));
  };

  const handleRunMRP = (planId: string) => {
    setActiveTab('mrp');
  };

  // --- MRP & Material Requisition Handlers ---
  const handleGenerateRequisition = async (productId: string, quantity: number, shortages: any[]) => {
    if (!profile?.companyId || !user) return;

    const reqId = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;
    const product = productsMap.get(productId);

    // Create a corresponding production order first in DRAFT mode
    const orderId = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
    const exploded = shortages.map(s => ({
      componentId: s.componentId,
      productId: s.componentId,
      productName: s.productName,
      sku: s.sku,
      quantityRequired: s.quantityRequested,
      quantityConsumed: 0
    }));

    const orderPayload: ProductionOrder = {
      id: orderId,
      productId,
      productName: product?.name || 'Production Product',
      quantityPlanned: quantity,
      quantityProduced: 0,
      status: 'DRAFT',
      bomId: bomsMap.get(productId)?.id || 'DEFAULT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      materialsCost: 0,
      items: exploded,
      requisitionId: reqId
    };

    await setDoc(doc(db, `companies/${profile.companyId}/production_orders`, orderId), orderPayload);

    // Create stores requisition
    const reqPayload = {
      id: reqId,
      requisitionNumber: reqId,
      productionOrderId: orderId,
      productId,
      productName: product?.name || 'Product',
      targetQty: quantity,
      requester: user.email || 'MRP System',
      department: 'Production Floor',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      items: shortages
    };

    await setDoc(doc(db, `companies/${profile.companyId}/material_requisitions`, reqId), reqPayload);
    setActiveTab('requisitions');
  };

  const handleApproveRequisition = async (reqId: string) => {
    if (!profile?.companyId) return;
    await updateDoc(doc(db, `companies/${profile.companyId}/material_requisitions`, reqId), {
      status: 'APPROVED'
    });
  };

  const handleCancelRequisition = async (reqId: string) => {
    if (!profile?.companyId) return;
    await updateDoc(doc(db, `companies/${profile.companyId}/material_requisitions`, reqId), {
      status: 'CANCELLED'
    });
  };

  const handleDeleteRequisition = async (reqId: string) => {
    if (!profile?.companyId) return;
    await deleteDoc(doc(db, `companies/${profile.companyId}/material_requisitions`, reqId));
  };

  // --- Material Goods Issue Handlers (Deducts Stock to WIP) ---
  const handleIssueMaterials = async (reqId: string, issuedBy: string, receiver: string) => {
    if (!profile?.companyId || !user) return;

    const req = requisitions.find(r => r.id === reqId);
    if (!req) return;

    const timestampStr = new Date().toISOString();
    const issueId = `ISS-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Deduct component stocks from main warehouse and write movements logs
    for (const item of req.items) {
      const prod = productsMap.get(item.componentId);
      const beforeQty = prod?.quantity || 0;
      const afterQty = beforeQty - item.quantityRequested;

      await updateDoc(doc(db, `companies/${profile.companyId}/products`, item.componentId), {
        quantity: afterQty,
        currentStock: afterQty,
        updatedAt: timestampStr
      });

      // Write movement log
      const moveId = `move_issue_${Date.now()}_${item.componentId.slice(0, 4)}`;
      await setDoc(doc(db, `companies/${profile.companyId}/stockMovements`, moveId), {
        id: moveId,
        productId: item.componentId,
        type: 'transfer',
        quantity: -item.quantityRequested,
        beforeQty,
        afterQty,
        createdAt: timestampStr,
        createdBy: user.email || 'Stores Manager',
        reason: `Dispatched to Floor WIP (Requisition #${req.requisitionNumber})`
      });
    }

    // 2. Create Material Issue Document
    const issuePayload = {
      id: issueId,
      issueNumber: issueId,
      requisitionId: reqId,
      productionOrderId: req.productionOrderId,
      issuedAt: timestampStr,
      issuedBy,
      receiver,
      items: req.items.map((it: any) => ({
        ...it,
        quantityIssued: it.quantityRequested
      }))
    };

    await setDoc(doc(db, `companies/${profile.companyId}/material_issues`, issueId), issuePayload);

    // 3. Update Requisition state
    await updateDoc(doc(db, `companies/${profile.companyId}/material_requisitions`, reqId), {
      status: 'ISSUED',
      items: req.items.map((it: any) => ({ ...it, quantityIssued: it.quantityRequested }))
    });

    // 4. Update linked Production Order -> Automatically RELEASE and link issue
    await updateDoc(doc(db, `companies/${profile.companyId}/production_orders`, req.productionOrderId), {
      status: 'RELEASED',
      issueId,
      hasIssued: true,
      updatedAt: timestampStr
    });
  };

  // --- Quality Control Handlers ---
  const handleAddQCLog = async (log: any) => {
    if (!profile?.companyId) return;
    const qcId = `QC-${Math.floor(1000 + Math.random() * 9000)}`;
    const payload = {
      ...log,
      id: qcId,
      qcNumber: qcId,
      inspectedAt: new Date().toISOString()
    };
    await setDoc(doc(db, `companies/${profile.companyId}/qc_logs`, qcId), payload);

    // Automatically complete production order if passed QA
    if (log.status === 'PASSED') {
      await updateDoc(doc(db, `companies/${profile.companyId}/production_orders`, log.productionOrderId), {
        status: 'COMPLETED',
        updatedAt: new Date().toISOString()
      });
    } else {
      await updateDoc(doc(db, `companies/${profile.companyId}/production_orders`, log.productionOrderId), {
        status: 'CANCELLED',
        updatedAt: new Date().toISOString()
      });
    }
  };

  const handleDeleteQCLog = async (qcId: string) => {
    if (!profile?.companyId) return;
    await deleteDoc(doc(db, `companies/${profile.companyId}/qc_logs`, qcId));
  };

  // --- Ad-hoc Production Order Creation ---
  const handleCreateProductionOrder = async (productId: string, quantity: number) => {
    if (!profile?.companyId) return;

    const bom = bomsMap.get(productId);
    if (!bom) return;

    const orderId = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
    const prodObj = productsMap.get(productId);

    const items = bom.items.map(item => {
      const comp = productsMap.get(item.componentId);
      const reqQty = item.quantity * quantity * (1 + (bom.wasteFactor || 0) / 100);
      return {
        componentId: item.componentId,
        productId: item.componentId,
        productName: comp?.name || 'Ingredient',
        sku: comp?.sku || 'N/A',
        quantityRequired: reqQty,
        quantityConsumed: 0
      };
    });

    const payload: ProductionOrder = {
      id: orderId,
      productId,
      productName: prodObj?.name || 'Product',
      quantityPlanned: quantity,
      quantityProduced: 0,
      status: 'RELEASED', // Direct creation schedules it for floor
      bomId: bom.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items
    };

    await setDoc(doc(db, `companies/${profile.companyId}/production_orders`, orderId), payload);
    setActiveTab('orders');
  };

  // --- Finished Goods Receiving / Output Posting ---
  const handlePostFinishedGoodsOutput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !user || !outputOrderId) return;

    const order = orders.find(o => o.id === outputOrderId);
    if (!order) return;

    setIsSubmittingOutput(true);
    try {
      const timestampStr = new Date().toISOString();
      const outputId = `OUT-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. If order was issued previously (hasIssued), we deduct raw materials from WIP floor stock (already deducted from main).
      // If it was NOT issued (direct ad-hoc PO), we deduct from main stock now!
      if (!order.hasIssued) {
        for (const item of order.items) {
          const prod = productsMap.get(item.componentId);
          const beforeQty = prod?.quantity || 0;
          const afterQty = beforeQty - item.quantityRequired;

          await updateDoc(doc(db, `companies/${profile.companyId}/products`, item.componentId), {
            quantity: afterQty,
            currentStock: afterQty,
            updatedAt: timestampStr
          });

          // Move log
          const moveId = `move_adhoc_${Date.now()}_${item.componentId.slice(0, 4)}`;
          await setDoc(doc(db, `companies/${profile.companyId}/stockMovements`, moveId), {
            id: moveId,
            productId: item.componentId,
            type: 'adjustment',
            quantity: -item.quantityRequired,
            beforeQty,
            afterQty,
            createdAt: timestampStr,
            createdBy: user.email || 'Production Floor',
            reason: `Direct deduction for Output Order Run #${order.id}`
          });
        }
      }

      // 2. Add finished goods to inventory stock
      const finProd = productsMap.get(order.productId);
      const finBeforeQty = finProd?.quantity || 0;
      const finAfterQty = finBeforeQty + outputQty;

      await updateDoc(doc(db, `companies/${profile.companyId}/products`, order.productId), {
        quantity: finAfterQty,
        currentStock: finAfterQty,
        updatedAt: timestampStr
      });

      // Write Output log
      await setDoc(doc(db, `companies/${profile.companyId}/stockMovements`, `move_prod_out_${Date.now()}`), {
        id: `move_prod_out_${Date.now()}`,
        productId: order.productId,
        type: 'purchase',
        quantity: outputQty,
        beforeQty: finBeforeQty,
        afterQty: finAfterQty,
        createdAt: timestampStr,
        createdBy: user.email || 'Production Dispatcher',
        reason: `Production output posting from batch #${order.id}`
      });

      // 3. Save Finished Goods Output Receipt Log
      const outputPayload = {
        id: outputId,
        outputNumber: outputId,
        productionOrderId: outputOrderId,
        productId: order.productId,
        productName: order.productName,
        quantityProduced: outputQty,
        wastageActual,
        createdAt: timestampStr
      };

      await setDoc(doc(db, `companies/${profile.companyId}/production_outputs`, outputId), outputPayload);

      // 4. Set order to QA state (Quality check pending)
      await updateDoc(doc(db, `companies/${profile.companyId}/production_orders`, outputOrderId), {
        status: 'QA',
        quantityProduced: outputQty,
        updatedAt: timestampStr
      });

      alert('🎉 Production output received! Batch transferred to QA Inspection Hold.');
      setOutputOrderId('');
      setOutputQty(10);
      setWastageActual(0);
      setActiveTab('qc'); // Redirect to QC checklist!
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingOutput(false);
    }
  };

  // Filtered orders list for parent orders tab
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = order.productName.toLowerCase().includes(searchTerm.toLowerCase()) || order.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, searchTerm, statusFilter]);

  // Selected Order
  const currentSelectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-screen bg-slate-50/50 pb-20 text-left">
      
      {/* Sub-Sidebar Production Hub Rail */}
      <div className="w-full lg:w-64 shrink-0 bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm space-y-6 self-start">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight flex items-center gap-1.5">
            <Factory className="w-5 h-5 text-indigo-600" />
            Production Hub
          </h3>
        </div>

        <nav className="space-y-1">
          {[
            { id: 'analytics', label: 'Production Analytics', icon: BarChart3 },
            { id: 'boms', label: 'Bills of Materials', icon: Boxes },
            { id: 'planning', label: 'Production Planning', icon: Calendar },
            { id: 'mrp', label: 'Material Requirements (MRP)', icon: Scale },
            { id: 'requisitions', label: 'Material Requisitions', icon: FileText },
            { id: 'issues', label: 'Material Issue', icon: ClipboardList },
            { id: 'orders', label: 'Production Orders', icon: Factory },
            { id: 'wip', label: 'Work In Progress (WIP)', icon: Layers },
            { id: 'output', label: 'Production Output', icon: Package },
            { id: 'qc', label: 'Quality Control', icon: ShieldCheck },
            { id: 'costing', label: 'Cost Analysis', icon: DollarSign }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedOrderId(null);
              }}
              className={cn(
                "w-full h-10 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2.5 transition-all text-left border",
                activeTab === tab.id 
                  ? "bg-slate-950 border-slate-950 text-white shadow-md shadow-slate-900/10" 
                  : "bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Tab Screens Panel */}
      <div className="flex-1 space-y-6">
        
        {activeTab === 'analytics' && (
          <ProductionAnalytics 
            orders={orders}
            requisitions={requisitions}
            plans={plans}
            qcLogs={qcLogs}
            products={products}
            currency={currency}
          />
        )}

        {activeTab === 'boms' && (
          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base uppercase tracking-tight">
                  Configured Bills of Materials (BOM)
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Reference recipes and manufacturing structures configured inside your separate Bills of Materials page.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {boms.length > 0 ? (
                boms.map((bom) => (
                  <div key={bom.id} className="p-5 border border-slate-200 rounded-3xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">{bom.productName}</h4>
                        <p className="text-[9px] text-slate-400 font-mono">SKU: {bom.productSku}</p>
                      </div>
                      <span className="bg-slate-100 text-slate-700 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                        Version {bom.version || '1.0'}
                      </span>
                    </div>

                    <div className="h-px bg-slate-100" />

                    <div className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                      {bom.items && bom.items.map((item, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{productsMap.get(item.componentId)?.name || 'Ingredient'}</span>
                          <span className="font-bold text-slate-900">{item.quantity} units</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                      <span>Wastage Factor: {bom.wasteFactor || 0}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  No configured Bills of Materials recipes found. Configure some in the separate BOM tab.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'planning' && (
          <ProductionPlanning 
            plans={plans}
            products={products}
            onAddPlan={handleAddPlan}
            onApprovePlan={handleApprovePlan}
            onCancelPlan={handleCancelPlan}
            onDeletePlan={handleDeletePlan}
            onRunMRP={handleRunMRP}
            currency={currency}
          />
        )}

        {activeTab === 'mrp' && (
          <MRP 
            products={products}
            boms={boms}
            plans={plans}
            onGenerateRequisition={handleGenerateRequisition}
            onCreateProductionOrder={handleCreateProductionOrder}
            currency={currency}
          />
        )}

        {activeTab === 'requisitions' && (
          <MaterialRequisitions 
            requisitions={requisitions}
            products={products}
            onApprove={handleApproveRequisition}
            onCancel={handleCancelRequisition}
            onIssue={handleIssueMaterials}
            onDelete={handleDeleteRequisition}
            currency={currency}
          />
        )}

        {activeTab === 'issues' && (
          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm space-y-6">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">Material Goods Issue Logs</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Audit of components physically transferred out of central warehouse and dispatched into shop floor Work in Progress (WIP).
              </p>
            </div>

            <div className="space-y-4">
              {issues.length > 0 ? (
                issues.map((issue) => (
                  <div key={issue.id} className="p-5 border border-slate-200 rounded-3xl space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-tight">Issue Ref: {issue.issueNumber}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                          Requisition: {issue.requisitionId} • Date: {new Date(issue.issuedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Authorized By</p>
                        <p className="font-black text-slate-900 text-[10px] uppercase">{issue.issuedBy}</p>
                      </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    <div className="overflow-x-auto text-[11px]">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                            <th className="pb-1">Component</th>
                            <th className="pb-1 text-center">SKU</th>
                            <th className="pb-1 text-right">Dispatched Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                          {issue.items && issue.items.map((item: any, idx: number) => (
                            <tr key={idx}>
                              <td className="py-2 text-slate-900 font-bold">{item.productName}</td>
                              <td className="py-2 text-center font-mono text-[10px]">{item.sku}</td>
                              <td className="py-2 text-right font-black text-slate-900">{item.quantityIssued.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  No goods issue logs found. Apporve and release stock requisitions to record transfers.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">Active Production Scheduling</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Scheduled factory run cards, status overrides, and floor monitoring sheets.
                </p>
              </div>
            </div>

            {/* Simple table or cards directory of orders */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              <div className={cn("space-y-4", selectedOrderId ? "xl:col-span-2" : "xl:col-span-3")}>
                <div className="space-y-4">
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order) => {
                      const isSel = selectedOrderId === order.id;
                      const progress = order.quantityPlanned > 0 ? Math.min(100, Math.round((order.quantityProduced / order.quantityPlanned) * 100)) : 0;
                      return (
                        <div 
                          key={order.id}
                          onClick={() => setSelectedOrderId(isSel ? null : order.id)}
                          className={cn(
                            "bg-white border rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden",
                            isSel ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
                          )}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                                <Factory className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">{order.productName}</h4>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                  <span>ID: {order.id}</span>
                                  <span>•</span>
                                  <span>Planned {new Date(order.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-6 text-right shrink-0 self-end md:self-auto">
                              <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Completed</p>
                                <p className="font-extrabold text-slate-900 mt-0.5">{order.quantityProduced} / {order.quantityPlanned}</p>
                              </div>

                              <span className={cn(
                                "text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border",
                                order.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                order.status === 'IN_PROGRESS' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                                order.status === 'RELEASED' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                "bg-slate-50 text-slate-500 border-slate-200"
                              )}>
                                {order.status}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-slate-900" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">View checklist</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-[2rem] p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                      No production orders recorded in this category.
                    </div>
                  )}
                </div>
              </div>

              {/* Order checklist sidebar */}
              {currentSelectedOrder && (
                <div className="bg-white border border-slate-900 rounded-[2rem] shadow-md overflow-hidden text-xs text-left flex flex-col">
                  <div className="p-6 bg-slate-900 text-white relative">
                    <button onClick={() => setSelectedOrderId(null)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
                      <XCircle className="w-5 h-5" />
                    </button>
                    <span className="text-[8px] font-black bg-slate-700 px-2 py-0.5 rounded-full uppercase tracking-widest">{currentSelectedOrder.status}</span>
                    <h4 className="font-extrabold text-sm uppercase tracking-tight mt-3 text-white">{currentSelectedOrder.productName}</h4>
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">Planned size: {currentSelectedOrder.quantityPlanned} units</p>
                  </div>

                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status transition Controls</p>
                    <div className="flex flex-wrap gap-2">
                      {currentSelectedOrder.status === 'DRAFT' && (
                        <button
                          onClick={() => {
                            updateDoc(doc(db, `companies/${profile.companyId}/production_orders`, currentSelectedOrder.id), { status: 'RELEASED' });
                          }}
                          className="px-3 h-8 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 text-[8px]"
                        >
                          Release scheduling
                        </button>
                      )}

                      {currentSelectedOrder.status === 'RELEASED' && (
                        <button
                          onClick={() => {
                            updateDoc(doc(db, `companies/${profile.companyId}/production_orders`, currentSelectedOrder.id), { status: 'IN_PROGRESS' });
                          }}
                          className="px-3 h-8 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 text-[8px]"
                        >
                          Start Floor run
                        </button>
                      )}

                      {['DRAFT', 'RELEASED', 'IN_PROGRESS'].includes(currentSelectedOrder.status) && (
                        <button
                          onClick={() => handleCancelPlan(currentSelectedOrder.id)}
                          className="px-3 h-8 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-black uppercase tracking-widest hover:bg-rose-100 text-[8px]"
                        >
                          Cancel order
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-5 space-y-3 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Required Components checklist</p>
                    <div className="space-y-2">
                      {currentSelectedOrder.items && currentSelectedOrder.items.map((item, index) => (
                        <div key={index} className="p-2.5 border border-slate-100 rounded-xl flex justify-between items-center">
                          <div>
                            <p className="font-extrabold text-slate-900">{item.productName}</p>
                            <p className="text-[8px] text-slate-400 font-mono">Qty: {item.quantityRequired.toFixed(1)} required</p>
                          </div>

                          <span className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
                            currentSelectedOrder.hasIssued ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          )}>
                            {currentSelectedOrder.hasIssued ? 'Floor WIP ready' : 'Stores Hold'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'wip' && (
          <WIP 
            orders={orders}
            issues={issues}
            outputs={outputs}
            products={products}
            currency={currency}
          />
        )}

        {activeTab === 'output' && (
          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm space-y-6">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">Post Finished Goods Production Output</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Record completed floor quantities to adjust stock, clear active shop WIP balances, and file certificates.
              </p>
            </div>

            <form onSubmit={handlePostFinishedGoodsOutput} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Select Floor Run *</label>
                <select
                  value={outputOrderId}
                  onChange={(e) => {
                    setOutputOrderId(e.target.value);
                    const order = orders.find(o => o.id === e.target.value);
                    if (order) {
                      setOutputQty(order.quantityPlanned - order.quantityProduced);
                    }
                  }}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  required
                >
                  <option value="">-- Choose In-Progress Order --</option>
                  {orders.filter(o => o.status === 'IN_PROGRESS' || o.status === 'RELEASED').map(o => (
                    <option key={o.id} value={o.id}>
                      Batch {o.id.substring(0, 6).toUpperCase()} - {o.productName} ({o.quantityPlanned} units planned)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Finished Quantity Received *</label>
                <input
                  type="number"
                  min="1"
                  value={outputQty}
                  onChange={(e) => setOutputQty(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Actual Wastage (Defective components count)</label>
                <input
                  type="number"
                  min="0"
                  value={wastageActual}
                  onChange={(e) => setWastageActual(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingOutput || !outputOrderId}
                className="w-full h-11 bg-slate-900 text-white font-black uppercase tracking-wider rounded-2xl hover:bg-slate-800 transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmittingOutput ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Posting Output Receipt...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" /> Post Finished Output Receipt
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'qc' && (
          <QualityControl 
            logs={qcLogs}
            orders={orders}
            onAddLog={handleAddQCLog}
            onDeleteLog={handleDeleteQCLog}
            currency={currency}
          />
        )}

        {activeTab === 'costing' && (
          <CostAnalysis 
            orders={orders}
            boms={boms}
            products={products}
            currency={currency}
          />
        )}

      </div>
    </div>
  );
}
