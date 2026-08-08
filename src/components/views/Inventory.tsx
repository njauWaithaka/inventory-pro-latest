import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Download,
  Upload,
  Plus,
  Package,
  Hash,
  ClipboardCheck,
  X,
  Check,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  query,
  setDoc,
  doc,
  updateDoc,
  where,
  deleteDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { handleFirestoreError, OperationType } from "../../lib/firestoreUtils";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { cn, formatCompactNumber, getSellThroughRate, getProductMovementSpeed } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { MovementSpeed, Product, PurchaseOrder } from "../../types";
import { ConfirmationModal } from "../ConfirmationModal";
import {
  TrendingUp,
  TrendingDown,
  Calendar as LucideCalendar,
  DollarSign,
  Activity,
  ArrowRightLeft,
  Truck,
  History,
  FileText,
  Clock,
  ArrowUpRight,
  ShoppingCart,
  QrCode,
  Camera
} from "lucide-react";
import { ScannerModal } from "../ScannerModal";

const BRANCHES = [
  { id: "main-wh", name: "Main Warehouse", location: "Building A, Industrial Zone" },
  { id: "downtown-store", name: "Downtown Retail Store", location: "456 Commerce Ave, City Center" },
  { id: "north-branch", name: "Northside Distribution", location: "789 Highway 10, Northern Sector" },
  { id: "eastside-hub", name: "Eastside Logistics Hub", location: "101 Terminal Rd, East Port" },
];

const movementStyles: Record<MovementSpeed, string> = {
  fast: "bg-emerald-50 text-emerald-600 border-emerald-100",
  moderate: "bg-blue-50 text-blue-600 border-blue-100",
  slow: "bg-amber-50 text-amber-600 border-amber-100",
  obsolete: "bg-rose-50 text-rose-600 border-rose-100",
};

import Papa from "papaparse";

export function Inventory() {
  const { user } = useAuth();
  const { profile, company, currency } = useSettings();

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    type?: "danger" | "warning" | "info" | "success";
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    productId: "",
    quantity: 0,
    reason: "manual",
    customReason: "",
    imageString: "",
  });

  const [activeInventoryTab, setActiveInventoryTab] = useState<"stock" | "transfers">("stock");
  const [isTransferringStock, setIsTransferringStock] = useState(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferData, setTransferData] = useState({
    productId: "",
    transferType: "out" as "in" | "out",
    otherBranchId: "downtown-store",
    quantity: 1,
    subtractSource: true,
    addDestination: true,
    notes: "",
  });
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseOrdersLoading, setPurchaseOrdersLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) return;

    const path = `companies/${profile.companyId}/purchaseOrders`;
    const q = collection(db, path);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as PurchaseOrder[];
        setPurchaseOrders(docs);
        setPurchaseOrdersLoading(false);
      },
      (error) => {
        console.error("Error loading purchase orders in inventory view:", error);
        setPurchaseOrdersLoading(false);
      },
    );

    return unsubscribe;
  }, [profile?.companyId]);

  useEffect(() => {
    if (!profile?.companyId) return;

    const path = `companies/${profile.companyId}/products`;
    const q = collection(db, path);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => {
          const data = doc.data() as Product;
          return {
            ...data,
            id: doc.id,
            movement: getProductMovementSpeed(data)
          };
        }) as Product[];
        setProducts(docs);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [profile?.companyId]);

  useEffect(() => {
    if (!profile?.companyId) return;

    const path = `companies/${profile.companyId}/stockMovements`;
    const q = collection(db, path);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        // Sort by createdAt descending
        docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMovements(docs);
        setMovementsLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        setMovementsLoading(false);
      },
    );

    return unsubscribe;
  }, [profile?.companyId]);

  useEffect(() => {
    if (!profile?.companyId) return;
    const triggerSync = async () => {
      try {
        const { AlertService } = await import("../../lib/alertService");
        await AlertService.runAlertSync(profile.companyId);
      } catch (err) {
        console.error("Failed to run alert sync on load:", err);
      }
    };
    triggerSync();
  }, [profile?.companyId]);

  const [dbCategories, setDbCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!profile?.companyId) return;

    const path = `companies/${profile.companyId}/categories`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const names = snapshot.docs.map(doc => doc.data().name as string).filter(Boolean);
      const defaults = ["Electronics", "Hardware", "Raw Materials", "Safety Gear", "Components"];
      const uniqueNames = Array.from(new Set([...names, ...defaults]));
      setDbCategories(uniqueNames);
    }, (error) => {
      console.error("Error loading categories in inventory:", error);
    });

    return unsubscribe;
  }, [profile?.companyId]);

  const [expiryFilter, setExpiryFilter] = useState<
    "all" | "expired" | "soon" | "healthy"
  >("all");
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: "",
    sku: "",
    category: "Electronics",
    quantity: 0,
    value: 0,
    movement: "moderate",
    expiryDate: "",
    manufactureDate: "",
    batchNumber: "",
    unitsSold: 0,
    unitsReceived: 0,
    warehouseId: "main-wh",
    uom: "Piece",
    materialGroup: "Finished Goods",
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.companyId) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const results_data = (results.data || []) as any[];
          for (const item of results_data) {
            const id = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const productData: Partial<Product> = {
              id,
              name: item.name || "Unknown Product",
              sku: item.sku || `SKU-${Date.now()}`,
              category: item.category || "General",
              quantity: parseFloat(item.quantity) || 0,
              value: parseFloat(item.value) || 0,
              movement: (item.movement || "moderate") as MovementSpeed,
              uom: item.uom || item.UoM || item.unitKey || "Piece",
              materialGroup: item.materialGroup || item.material_group || item.materialGroupKey || "Finished Goods",
              lastSold: new Date().toISOString().split("T")[0],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await setDoc(
              doc(db, `companies/${profile.companyId}/products`, id),
              productData,
            );
          }
          alert(`Successfully imported ${results_data?.length || 0} products.`);
        } catch (error) {
          console.error("Import failed:", error);
          alert("Import failed. Please check your CSV format.");
        } finally {
          setIsImporting(false);
          if (e.target) e.target.value = "";
        }
      },
      error: (error) => {
        console.error("CSV Parse Error:", error);
        setIsImporting(false);
        alert("Could not parse CSV file.");
      },
    });
  };

  const handleAuditChange = (productId: string, value: string) => {
    const count = parseInt(value);
    setAuditCounts((prev) => ({
      ...prev,
      [productId]: isNaN(count) ? 0 : count,
    }));
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !adjustmentData.productId) return;

    try {
      const product = products.find((p) => p.id === adjustmentData.productId);
      if (!product) return;

      const adjustmentValue = adjustmentData.quantity;
      const newQty = product.quantity + adjustmentValue;

      if (newQty < 0) {
        alert("Error: Stock cannot go below zero.");
        return;
      }

      const productRef = doc(
        db,
        `companies/${profile.companyId}/products`,
        product.id,
      );

      await updateDoc(productRef, {
        quantity: newQty,
        currentStock: newQty,
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: serverTimestamp(),
      });

      const finalReason =
        adjustmentData.reason === "manual"
          ? adjustmentData.customReason || "Manual Adjustment"
          : adjustmentData.reason;

       const movementId = `mov_${Date.now()}`;
      await setDoc(
        doc(db, `companies/${profile.companyId}/stockMovements`, movementId),
        {
          id: movementId,
          productId: product.id,
          type: adjustmentValue >= 0 ? "inbound" : "outbound",
          quantity: Math.abs(adjustmentValue),
          beforeQty: product.quantity,
          afterQty: newQty,
          reason: finalReason,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || "system",
          verificationImage: adjustmentData.imageString || "",

          // Audit and Analytical Fields (Target Schema Alignment)
          transactionId: movementId,
          transactionType: adjustmentValue >= 0 ? "Stock In" : (finalReason.toLowerCase().includes("damage") ? "Damage" : "Adjustment"),
          previousStock: product.quantity,
          newStock: newQty,
          userId: user?.uid || "system",
          timestamp: serverTimestamp(),
        },
      );

      setIsAdjustingStock(false);
      setAdjustmentData({
        productId: "",
        quantity: 0,
        reason: "manual",
        customReason: "",
        imageString: "",
      });

      // Trigger the AlertSync
      const { AlertService } = await import("../../lib/alertService");
      await AlertService.runAlertSync(profile.companyId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "products");
    }
  };

  const handleScanResult = async (
    product: Product,
    actionType: 'check-in' | 'check-out' | 'view',
    qty: number,
    notes?: string
  ) => {
    if (!profile?.companyId || actionType === 'view') return;

    const delta = actionType === 'check-in' ? qty : -qty;
    const newQty = product.quantity + delta;

    if (newQty < 0) {
      alert("Error: Stock cannot go below zero.");
      return;
    }

    const productRef = doc(db, `companies/${profile.companyId}/products`, product.id);
    await updateDoc(productRef, {
      quantity: newQty,
      currentStock: newQty,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
    });

    const movementId = `mov_scan_${Date.now()}`;
    await setDoc(doc(db, `companies/${profile.companyId}/stockMovements`, movementId), {
      id: movementId,
      productId: product.id,
      type: actionType === 'check-in' ? "inbound" : "outbound",
      quantity: qty,
      beforeQty: product.quantity,
      afterQty: newQty,
      reason: notes || `Camera Barcode ${actionType === 'check-in' ? 'Check-In' : 'Check-Out'}`,
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || "staff",
      transactionId: movementId,
      transactionType: actionType === 'check-in' ? "Scanner Check-In" : "Scanner Check-Out",
      previousStock: product.quantity,
      newStock: newQty,
      userId: user?.uid || "staff",
      timestamp: serverTimestamp(),
    });

    const { AlertService } = await import("../../lib/alertService");
    await AlertService.runAlertSync(profile.companyId);
  };

  const handleTransferStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !transferData.productId) {
      alert("Error: Please select a product to transfer.");
      return;
    }

    setIsSubmittingTransfer(true);

    try {
      const sourceProduct = products.find((p) => p.id === transferData.productId);
      if (!sourceProduct) {
        alert("Error: Could not find the selected product.");
        setIsSubmittingTransfer(false);
        return;
      }

      const qty = parseFloat(transferData.quantity as any);
      if (isNaN(qty) || qty <= 0) {
        alert("Error: Transfer quantity must be greater than zero.");
        setIsSubmittingTransfer(false);
        return;
      }

      const sourceWarehouseId = sourceProduct.warehouseId || "main-wh";
      const destWarehouseId = transferData.otherBranchId;

      if (sourceWarehouseId === destWarehouseId) {
        alert("Error: Source and destination branches cannot be the same.");
        setIsSubmittingTransfer(false);
        return;
      }

      const sourceQty = parseFloat(sourceProduct.quantity as any) || 0;

      // If transferring OUT
      if (transferData.transferType === "out") {
        if (sourceQty < qty) {
          alert(`Error: Insufficient stock at source. Only ${sourceQty} units available.`);
          setIsSubmittingTransfer(false);
          return;
        }

        // 1. Subtract from source product
        const sourceRef = doc(
          db,
          `companies/${profile.companyId}/products`,
          sourceProduct.id,
        );
        const newSourceQty = sourceQty - qty;
        await updateDoc(sourceRef, {
          quantity: newSourceQty,
          currentStock: newSourceQty,
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp(),
        });

        // 2. Find or create destination product
        const destProduct = products.find(
          (p) => p.sku === sourceProduct.sku && (p.warehouseId || "main-wh") === destWarehouseId
        );

        let finalDestQty = qty;
        if (destProduct) {
          const destProductQty = parseFloat(destProduct.quantity as any) || 0;
          finalDestQty = destProductQty + qty;
          const destRef = doc(
            db,
            `companies/${profile.companyId}/products`,
            destProduct.id,
          );
          await updateDoc(destRef, {
            quantity: finalDestQty,
            currentStock: finalDestQty,
            updatedAt: new Date().toISOString(),
            serverUpdatedAt: serverTimestamp(),
          });
        } else {
          // Create product in destination branch
          const newId = `prod_${Date.now()}_dest`;
          await setDoc(
            doc(db, `companies/${profile.companyId}/products`, newId),
            {
              ...sourceProduct,
              id: newId,
              productId: newId,
              productName: sourceProduct.name,
              warehouseId: destWarehouseId,
              quantity: qty,
              currentStock: qty,
              buyingPrice: sourceProduct.buyingPrice || sourceProduct.value || 0,
              sellingPrice: sourceProduct.sellingPrice || (sourceProduct.value ? sourceProduct.value * 1.3 : 0),
              status: "Active",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              serverCreatedAt: serverTimestamp(),
              serverUpdatedAt: serverTimestamp(),
            }
          );
        }

        // 3. Log Stock Movement
        const movementId = `mov_tr_${Date.now()}`;
        const reasonStr = transferData.notes || `Stock transfer to ${BRANCHES.find(b => b.id === destWarehouseId)?.name || destWarehouseId}`;
        await setDoc(
          doc(db, `companies/${profile.companyId}/stockMovements`, movementId),
          {
            id: movementId,
            productId: sourceProduct.id,
            productName: sourceProduct.name,
            sku: sourceProduct.sku,
            type: "transfer",
            transferType: "out",
            sourceWarehouseId: sourceWarehouseId,
            destWarehouseId: destWarehouseId,
            quantity: qty,
            beforeQty: sourceQty,
            afterQty: newSourceQty,
            createdAt: new Date().toISOString(),
            createdBy: user?.email || user?.uid || "staff",
            reason: reasonStr,

            // Audit and Analytical Fields (Target Schema Alignment)
            transactionId: movementId,
            transactionType: "Transfer",
            previousStock: sourceQty,
            newStock: newSourceQty,
            userId: user?.uid || "staff",
            timestamp: serverTimestamp(),
          }
        );
      } else {
        // If transferring IN (Receive Stock from another branch)
        if (transferData.subtractSource) {
          // Deduct from other branch product first
          const otherProduct = products.find(
            (p) => p.sku === sourceProduct.sku && (p.warehouseId || "main-wh") === destWarehouseId
          );

          if (!otherProduct) {
            alert(`Error: No matching product with SKU ${sourceProduct.sku} found at source branch (${BRANCHES.find(b => b.id === destWarehouseId)?.name || destWarehouseId}).`);
            setIsSubmittingTransfer(false);
            return;
          }

          const otherProductQty = parseFloat(otherProduct.quantity as any) || 0;
          if (otherProductQty < qty) {
            alert(`Error: Insufficient stock at source branch. Only ${otherProductQty} units available at ${BRANCHES.find(b => b.id === destWarehouseId)?.name || destWarehouseId}.`);
            setIsSubmittingTransfer(false);
            return;
          }

          // Subtract from source branch product
          const otherRef = doc(
            db,
            `companies/${profile.companyId}/products`,
            otherProduct.id,
          );
          await updateDoc(otherRef, {
            quantity: otherProductQty - qty,
            currentStock: otherProductQty - qty,
            updatedAt: new Date().toISOString(),
            serverUpdatedAt: serverTimestamp(),
          });
        }

        // Add to destination product (sourceProduct)
        const finalDestQty = sourceQty + qty;
        const sourceRef = doc(
          db,
          `companies/${profile.companyId}/products`,
          sourceProduct.id,
        );
        await updateDoc(sourceRef, {
          quantity: finalDestQty,
          currentStock: finalDestQty,
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp(),
        });

        // Log Stock Movement
        const movementId = `mov_tr_${Date.now()}`;
        const reasonStr = transferData.notes || `Stock transfer from ${BRANCHES.find(b => b.id === destWarehouseId)?.name || destWarehouseId}`;
        await setDoc(
          doc(db, `companies/${profile.companyId}/stockMovements`, movementId),
          {
            id: movementId,
            productId: sourceProduct.id,
            productName: sourceProduct.name,
            sku: sourceProduct.sku,
            type: "transfer",
            transferType: "in",
            sourceWarehouseId: destWarehouseId,
            destWarehouseId: sourceWarehouseId,
            quantity: qty,
            beforeQty: sourceQty,
            afterQty: finalDestQty,
            createdAt: new Date().toISOString(),
            createdBy: user?.email || user?.uid || "staff",
            reason: reasonStr,

            // Audit and Analytical Fields (Target Schema Alignment)
            transactionId: movementId,
            transactionType: "Transfer",
            previousStock: sourceQty,
            newStock: finalDestQty,
            userId: user?.uid || "staff",
            timestamp: serverTimestamp(),
          }
        );
      }

      alert("Stock transfer processed successfully!");
      setIsTransferringStock(false);
      setTransferData({
        productId: "",
        transferType: "out",
        otherBranchId: "downtown-store",
        quantity: 1,
        subtractSource: true,
        addDestination: true,
        notes: "",
      });
    } catch (error: any) {
      console.error("Failed to run stock transfer:", error);
      alert(`Error processing transfer: ${error?.message || String(error)}`);
      handleFirestoreError(error, OperationType.UPDATE, "products");
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.companyId || !newProduct.name || !newProduct.sku)
      return;

    try {
      const productId = `prod_${Date.now()}`;
      const buyPrice = Number(newProduct.buyingPrice) || Number(newProduct.value) || 0;
      const sellPrice = Number(newProduct.sellingPrice) || (buyPrice * 1.3) || 0;
      const initialQty = Number(newProduct.quantity) || 0;

      const productData = {
        ...newProduct,
        id: productId,
        productId: productId,
        productName: newProduct.name,
        buyingPrice: buyPrice,
        sellingPrice: sellPrice,
        value: buyPrice, // Keep value aligned with buyingPrice
        currentStock: initialQty,
        initialStock: initialQty,
        stockAddedDate: new Date().toISOString().split("T")[0],
        status: "Active",
        unitsReceived: typeof newProduct.unitsReceived === 'number' && newProduct.unitsReceived > 0 
          ? newProduct.unitsReceived 
          : initialQty,
        unitsSold: typeof newProduct.unitsSold === 'number' ? newProduct.unitsSold : 0,
        lastSold: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      };

      await setDoc(
        doc(db, `companies/${profile.companyId}/products`, productId),
        productData,
      );

      // Record movement
      const movementId = `mov_${Date.now()}`;
      await setDoc(
        doc(db, `companies/${profile.companyId}/stockMovements`, movementId),
        {
          id: movementId,
          productId,
          type: "adjustment",
          quantity: initialQty,
          beforeQty: 0,
          afterQty: initialQty,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,

          // Target schema audit fields
          transactionId: movementId,
          transactionType: "Stock In",
          previousStock: 0,
          newStock: initialQty,
          reason: "Initial Stock Load",
          userId: user.uid,
          timestamp: serverTimestamp(),
        },
      );

      setIsAddingProduct(false);
      setNewProduct({
        name: "",
        sku: "",
        category: "Electronics",
        quantity: 0,
        value: 0,
        movement: "moderate",
        expiryDate: "",
        manufactureDate: "",
        batchNumber: "",
        unitsSold: 0,
        unitsReceived: 0,
        warehouseId: "main-wh",
        uom: "Piece",
        materialGroup: "Finished Goods",
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "products");
    }
  };

  const finalizeAudit = async () => {
    if (!profile?.companyId) return;
    try {
      for (const id in auditCounts) {
        const product = products.find((p) => p.id === id);
        if (!product) continue;

        const actual = auditCounts[id];
        if (actual === product.quantity) continue;

        const productRef = doc(
          db,
          `companies/${profile.companyId}/products`,
          id,
        );
        await updateDoc(productRef, {
          quantity: actual,
          currentStock: actual,
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp(),
        });

        // Record movement
        const movementId = `mov_${Date.now()}_${id}`;
        await setDoc(
          doc(db, `companies/${profile.companyId}/stockMovements`, movementId),
          {
            id: movementId,
            productId: id,
            type: "adjustment",
            quantity: Math.abs(actual - product.quantity),
            beforeQty: product.quantity,
            afterQty: actual,
            createdAt: new Date().toISOString(),
            createdBy: user?.uid || "system",

            // Target schema audit fields
            transactionId: movementId,
            transactionType: actual - product.quantity >= 0 ? "Stock In" : "Adjustment",
            previousStock: product.quantity,
            newStock: actual,
            reason: "Physical Count Audit",
            userId: user?.uid || "system",
            timestamp: serverTimestamp(),
          },
        );
      }
      setIsAuditing(false);
      setAuditCounts({});
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "products");
    }
  };

  const handleDeleteProduct = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Remove Inventory Asset",
      message: "Are you sure you want to remove or dispose of this inventory product? This action cannot be undone.",
      confirmText: "Dispose Asset",
      type: "danger",
      onConfirm: async () => {
        if (!profile?.companyId) return;
        try {
          await deleteDoc(doc(db, `companies/${profile.companyId}/products`, id));
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, "products");
        } finally {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const allProducts = [...products];

  const todayTime = new Date().setHours(0, 0, 0, 0);
  const expiredCount = allProducts.filter((p) => {
    if (!p.expiryDate) return false;
    const exp = new Date(p.expiryDate).getTime();
    return exp < todayTime;
  }).length;

  const soonCount = allProducts.filter((p) => {
    if (!p.expiryDate) return false;
    const exp = new Date(p.expiryDate).getTime();
    const diffDays = Math.ceil((exp - todayTime) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 14;
  }).length;

  const healthyCount = allProducts.filter((p) => {
    if (!p.expiryDate) return true;
    const exp = new Date(p.expiryDate).getTime();
    const diffDays = Math.ceil((exp - todayTime) / (1000 * 60 * 60 * 24));
    return diffDays > 14;
  }).length;

  const displayProducts = allProducts.filter((p) => {
    // Search matching
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.batchNumber &&
        p.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;

    // Expiry status matching
    if (expiryFilter === "all") return true;
    if (!p.expiryDate) {
      return expiryFilter === "healthy";
    }

    const exp = new Date(p.expiryDate).getTime();
    const diffDays = Math.ceil((exp - todayTime) / (1000 * 60 * 60 * 24));

    if (expiryFilter === "expired") {
      return diffDays < 0;
    } else if (expiryFilter === "soon") {
      return diffDays >= 0 && diffDays <= 14;
    } else if (expiryFilter === "healthy") {
      return diffDays > 14;
    }
    return true;
  });

  // Sort displayProducts by nearest expiry date
  // Products that are expired or expiring soon come first. Products with no expiry date come last.
  displayProducts.sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return 0;
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-24 lg:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Stock Inventory
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Managing stock for{" "}
            <span className="text-blue-600 font-bold">
              {company?.name || "Workspace"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-11 border border-indigo-200 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-all text-xs shadow-sm shadow-indigo-600/20"
          >
            <QrCode className="w-4 h-4 text-white" />
            <span>Scan Barcode / QR</span>
          </button>
          <button
            onClick={() => setIsAdjustingStock(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-11 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-xs"
          >
            <ArrowUpDown className="w-4 h-4" />
            Stock Adjust
          </button>
          <button
            onClick={() => setIsTransferringStock(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-11 border border-indigo-200 rounded-lg bg-indigo-50/50 text-indigo-700 font-bold hover:bg-indigo-100/70 transition-all text-xs flex items-center"
          >
            <ArrowUpDown className="rotate-90 w-4 h-4 text-indigo-500 shrink-0" />
            <span>Stock Transfer</span>
          </button>
          <button
            onClick={() => {
              const initialCounts: Record<string, number> = {};
              displayProducts.forEach((p) => {
                initialCounts[p.id] = p.quantity;
              });
              setAuditCounts(initialCounts);
              setIsAuditing(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-11 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-xs"
          >
            <ClipboardCheck className="w-4 h-4" />
            Perform Audit
          </button>
          <div className="relative flex-1 sm:flex-none">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              id="csv-upload"
            />
            <button
              className={cn(
                "w-full h-11 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-xs flex items-center justify-center gap-2",
                isImporting && "opacity-50 pointer-events-none",
              )}
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isImporting ? "Importing..." : "Import CSV"}
            </button>
          </div>
          <button
            onClick={() => setIsAddingProduct(true)}
            className="hidden sm:flex flex-none items-center justify-center gap-2 bg-[#0f172a] text-white px-5 h-11 rounded-lg font-bold hover:bg-slate-800 transition-all text-xs"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      <AnimatePresence>
        {selectedProductDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-4xl rounded-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
                      {selectedProductDetail.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mt-0.5 uppercase tracking-widest">
                      {selectedProductDetail.sku} • {selectedProductDetail.category || "General"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProductDetail(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 animate-none" />
                </button>
              </div>

              {/* Scrollable Grid Container */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                
                {/* LEFT COLUMN: Basic Info, Taxonomy, Compliance & Reorder Point (lg:col-span-5) */}
                <div className="lg:col-span-5 space-y-6 pr-1 border-r border-slate-100/80">
                  
                  {/* 1. Quantitative Block */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                        Current Stock
                      </span>
                      <span className={cn(
                        "text-xl font-black",
                        selectedProductDetail.quantity <= (selectedProductDetail.reorderPoint ?? selectedProductDetail.minStock ?? 10) ? "text-rose-600" : "text-slate-900"
                      )}>
                        {selectedProductDetail.quantity.toLocaleString()} <span className="text-xs font-semibold text-slate-400">({selectedProductDetail.uom || "pcs"})</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                        Total Valuation
                      </span>
                      <span className="text-xl font-black text-indigo-600">
                        {currency} {(selectedProductDetail.value * selectedProductDetail.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                        Cost per Unit
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {currency} {parseFloat(selectedProductDetail.value as any || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                        Velocity Score
                      </span>
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider py-0.5 px-2 rounded-md",
                        selectedProductDetail.movement === 'fast' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                        selectedProductDetail.movement === 'moderate' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                        selectedProductDetail.movement === 'slow' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                        "bg-rose-50 text-rose-600 border border-rose-100 animate-pulse"
                      )}>
                        {selectedProductDetail.movement || "moderate"}
                      </span>
                    </div>

                    {/* STR Info block */}
                    <div className="pt-2 border-t border-slate-100 col-span-2 flex flex-col gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                        Sell-Through Metric (STR)
                      </span>
                      {(() => {
                        const str = getSellThroughRate(selectedProductDetail);
                        const sold = selectedProductDetail.unitsSold || 0;
                        const received = selectedProductDetail.unitsReceived || (selectedProductDetail.quantity + sold);
                        return (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-150 flex flex-col gap-1.5 mt-0.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-700">Sell-Through Rate:</span>
                              <span className={cn(
                                "font-black font-mono px-2 py-0.5 rounded text-[10px]",
                                str >= 70 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                str >= 40 ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                "bg-amber-50 text-amber-600 border border-amber-100"
                              )}>
                                {str.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all duration-300",
                                  str >= 70 ? "bg-emerald-500" : str >= 40 ? "bg-blue-500" : "bg-amber-500"
                                )}
                                style={{ width: `${Math.min(100, str)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] font-bold text-slate-400 mt-0.5">
                              <span>Sold: <span className="text-slate-800">{sold} units</span></span>
                              <span>Received: <span className="text-slate-800">{received} units</span></span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 2. Location details */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">
                      Warehousing & Placement
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Branch / Facility</span>
                        <span className="text-xs font-semibold text-slate-800">
                          {BRANCHES.find(b => b.id === (selectedProductDetail.warehouseId || "main-wh"))?.name || BRANCHES[0].name}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Precise Location</span>
                        <span className="text-xs font-semibold text-slate-500 italic">
                          {BRANCHES.find(b => b.id === (selectedProductDetail.warehouseId || "main-wh"))?.location || BRANCHES[0].location}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Product Characteristics & Taxonomy */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">
                      Classification & Logistics
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Material Group</span>
                        <span className="text-xs font-semibold text-slate-800">
                          {selectedProductDetail.materialGroup || "Finished Goods"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Base Unit of Measure</span>
                        <span className="text-xs font-semibold text-slate-800">
                          {selectedProductDetail.uom || "Piece"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Traceability & Manufacturing */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">
                      Compliance & Traceability
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Batch / Lot Number</span>
                        <span className="text-xs font-mono font-bold text-slate-700">
                          {selectedProductDetail.batchNumber || "UNBATCHED"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Manufacture Date</span>
                        <span className="text-xs font-semibold text-slate-700">
                          {selectedProductDetail.manufactureDate || "Not Recorded"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Expiry Status</span>
                        <div className="mt-1">
                          {selectedProductDetail.expiryDate ? (() => {
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const exp = new Date(selectedProductDetail.expiryDate);
                            exp.setHours(0,0,0,0);
                            const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            if (diff < 0) {
                              return <span className="bg-rose-50 text-rose-600 border border-rose-100 font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded">Expired</span>;
                            } else if (diff <= 30) {
                              return <span className="bg-amber-50 text-amber-600 border border-amber-100 font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded">Near Expiry</span>;
                            } else {
                              return <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded">Fresh</span>;
                            }
                          })() : <span className="text-xs font-semibold text-slate-400">Non-Perishable</span>}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Expiration Date</span>
                        <span className="text-xs font-semibold text-slate-700">
                          {selectedProductDetail.expiryDate || "Infinite Lifecycle"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Reorder Threshold Override Section */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">
                      Reorder point & alerts
                    </h4>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Average Daily Sales (ADS)</span>
                          <span className="font-bold text-slate-800">{(selectedProductDetail as any).averageDailySales ? (selectedProductDetail as any).averageDailySales.toFixed(2) : "0.00"} / day</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Auto Reorder Point</span>
                          <span className="font-bold text-slate-800">{(selectedProductDetail as any).calculatedReorderPoint || 0} units</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                          Manual Override Threshold (Units)
                        </label>
                        <input
                          type="number"
                          placeholder="No override set"
                          defaultValue={(selectedProductDetail as any).manualReorderPoint !== undefined && (selectedProductDetail as any).manualReorderPoint !== null ? (selectedProductDetail as any).manualReorderPoint : ""}
                          onBlur={async (e) => {
                            const val = e.target.value === "" ? null : Number(e.target.value);
                            try {
                              if (!profile?.companyId) return;
                              const pRef = doc(db, `companies/${profile.companyId}/products`, selectedProductDetail.id);
                              await updateDoc(pRef, {
                                manualReorderPoint: val
                              });
                              // Also trigger the AlertSync!
                              const { AlertService } = await import('../../lib/alertService');
                              await AlertService.runAlertSync(profile.companyId);
                              // Update local state to reflect override immediately
                              setSelectedProductDetail(prev => prev ? {
                                ...prev,
                                manualReorderPoint: val === null ? undefined : val,
                                minStock: val === null ? (prev as any).calculatedReorderPoint || 0 : val
                              } : null);
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold"
                        />
                        <p className="text-[9px] text-slate-400 mt-1 font-medium">
                          Leave blank to use the automatically calculated reorder point.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Registered / Last Updated */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">
                      System Registry Logs
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Registered At</span>
                        <span className="text-[11px] font-mono font-medium text-slate-400">
                          {selectedProductDetail.createdAt ? new Date(selectedProductDetail.createdAt).toLocaleString() : "--"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Last Updated</span>
                        <span className="text-[11px] font-mono font-medium text-slate-400">
                          {selectedProductDetail.updatedAt ? new Date(selectedProductDetail.updatedAt).toLocaleString() : "--"}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* RIGHT COLUMN: Lifecycle Insights, Analytics Cards Grid & Stock Movement Timeline (lg:col-span-7) */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Title Header */}
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100 shrink-0">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                      Product Lifecycle & Stock Insights
                    </h4>
                  </div>

                  {(() => {
                    // Extract and format product-specific movements
                    const prodMovements = movements.filter((m: any) => m.productId === selectedProductDetail.id);
                    
                    const getMovementDetails = (mov: any) => {
                      let delta = 0;
                      if (typeof mov.afterQty === 'number' && typeof mov.beforeQty === 'number') {
                        delta = mov.afterQty - mov.beforeQty;
                      } else {
                        const typeLower = (mov.type || '').toLowerCase();
                        const reasonLower = (mov.reason || '').toLowerCase();
                        const isOut = typeLower === 'sale' || typeLower === 'outbound' || reasonLower.includes('sale') || reasonLower.includes('sold') || reasonLower.includes('damage') || reasonLower.includes('expir') || reasonLower.includes('scrap');
                        delta = isOut ? -Math.abs(mov.quantity) : Math.abs(mov.quantity);
                      }

                      const typeLower = (mov.type || '').toLowerCase();
                      const reasonLower = (mov.reason || '').toLowerCase();

                      let category: 'sale' | 'restock' | 'transfer' | 'expired' | 'damaged' | 'adjustment' = 'adjustment';

                      if (typeLower === 'sale' || reasonLower.includes('sale') || reasonLower.includes('sold') || reasonLower.includes('invoice') || reasonLower.includes('pos')) {
                        category = 'sale';
                      } else if (typeLower === 'purchase' || reasonLower.includes('restock') || reasonLower.includes('replenish') || reasonLower.includes('purchase') || reasonLower.includes('receive') || reasonLower.includes('grn') || reasonLower.includes('inbound')) {
                        category = 'restock';
                      } else if (typeLower === 'transfer' || reasonLower.includes('transfer')) {
                        category = 'transfer';
                      } else if (reasonLower.includes('expir') || reasonLower.includes('spoil')) {
                        category = 'expired';
                      } else if (reasonLower.includes('damag') || reasonLower.includes('scrap') || reasonLower.includes('waste') || reasonLower.includes('defect')) {
                        category = 'damaged';
                      }

                      return { delta, category };
                    };

                    // Compute aggregates
                    let totalSalesQty = 0;
                    let lastSaleDate: string | null = null;
                    let totalReceivedQty = 0;
                    let lastRestockDate: string | null = null;
                    let totalTransferredQty = 0;
                    let totalExpiredQty = 0;
                    let totalDamagedQty = 0;

                    prodMovements.forEach((mov: any) => {
                      const { delta, category } = getMovementDetails(mov);
                      const mDate = mov.createdAt || mov.timestamp?.toDate?.()?.toISOString() || '';

                      if (category === 'sale') {
                        totalSalesQty += Math.abs(delta || mov.quantity || 0);
                        if (!lastSaleDate || new Date(mDate) > new Date(lastSaleDate)) {
                          lastSaleDate = mDate;
                        }
                      } else if (category === 'restock') {
                        totalReceivedQty += Math.abs(delta || mov.quantity || 0);
                        if (!lastRestockDate || new Date(mDate) > new Date(lastRestockDate)) {
                          lastRestockDate = mDate;
                        }
                      } else if (category === 'transfer') {
                        totalTransferredQty += Math.abs(delta || mov.quantity || 0);
                      } else if (category === 'expired') {
                        totalExpiredQty += Math.abs(delta || mov.quantity || 0);
                      } else if (category === 'damaged') {
                        totalDamagedQty += Math.abs(delta || mov.quantity || 0);
                      }
                    });

                    // Compute reordered from POs
                    let reorderedQty = 0;
                    purchaseOrders.forEach((po) => {
                      const activeStatuses = ['PENDING', 'APPROVED', 'SHIPPED', 'PARTIAL', 'PARTIALLY RECEIVED'];
                      if (activeStatuses.includes(po.status?.toUpperCase())) {
                        po.items?.forEach((item) => {
                          if (item.productId === selectedProductDetail.id) {
                            const needed = (item.quantity || 0) - (item.receivedQuantity || 0);
                            if (needed > 0) {
                              reorderedQty += needed;
                            }
                          }
                        });
                      }
                    });

                    return (
                      <>
                        {/* 2x3 Grid of Analytical Insights */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {/* 1. Sales */}
                          <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-xl flex flex-col justify-between min-h-[85px] hover:shadow-sm transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider">Total Sales</span>
                              <ShoppingCart className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="mt-1">
                              <span className="text-base font-black text-slate-800">{totalSalesQty.toLocaleString()}</span>
                              <span className="text-[10px] font-semibold text-slate-400 ml-1">{selectedProductDetail.uom || "pcs"}</span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 mt-0.5 truncate block">
                              Last Sold: {lastSaleDate ? new Date(lastSaleDate).toLocaleDateString() : 'Never'}
                            </span>
                          </div>

                          {/* 2. Restocks */}
                          <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl flex flex-col justify-between min-h-[85px] hover:shadow-sm transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Total Restocked</span>
                              <Truck className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="mt-1">
                              <span className="text-base font-black text-slate-800">{totalReceivedQty.toLocaleString()}</span>
                              <span className="text-[10px] font-semibold text-slate-400 ml-1">{selectedProductDetail.uom || "pcs"}</span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 mt-0.5 truncate block">
                              Last Restock: {lastRestockDate ? new Date(lastRestockDate).toLocaleDateString() : 'Never'}
                            </span>
                          </div>

                          {/* 3. Reordered */}
                          <div className="p-3 bg-amber-50/40 border border-amber-100 rounded-xl flex flex-col justify-between min-h-[85px] hover:shadow-sm transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">On-Order (PO)</span>
                              <Clock className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className="mt-1">
                              <span className="text-base font-black text-slate-800">{reorderedQty.toLocaleString()}</span>
                              <span className="text-[10px] font-semibold text-slate-400 ml-1">{selectedProductDetail.uom || "pcs"}</span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 mt-0.5 block">
                              Pending Purchase Orders
                            </span>
                          </div>

                          {/* 4. Transfers */}
                          <div className="p-3 bg-purple-50/40 border border-purple-100 rounded-xl flex flex-col justify-between min-h-[85px] hover:shadow-sm transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-purple-600 uppercase tracking-wider">Transfers</span>
                              <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="mt-1">
                              <span className="text-base font-black text-slate-800">{totalTransferredQty.toLocaleString()}</span>
                              <span className="text-[10px] font-semibold text-slate-400 ml-1">{selectedProductDetail.uom || "pcs"}</span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 mt-0.5 block">
                              Inter-Branch Transfers
                            </span>
                          </div>

                          {/* 5. Expired */}
                          <div className="p-3 bg-rose-50/40 border border-rose-100 rounded-xl flex flex-col justify-between min-h-[85px] hover:shadow-sm transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider">Expired / Disposed</span>
                              <LucideCalendar className="w-4 h-4 text-rose-500" />
                            </div>
                            <div className="mt-1">
                              <span className="text-base font-black text-slate-800">{totalExpiredQty.toLocaleString()}</span>
                              <span className="text-[10px] font-semibold text-slate-400 ml-1">{selectedProductDetail.uom || "pcs"}</span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 mt-0.5 block">
                              Expiry Loss Write-Offs
                            </span>
                          </div>

                          {/* 6. Damaged */}
                          <div className="p-3 bg-orange-50/40 border border-orange-100 rounded-xl flex flex-col justify-between min-h-[85px] hover:shadow-sm transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-orange-600 uppercase tracking-wider">Damaged Stock</span>
                              <Trash2 className="w-4 h-4 text-orange-500" />
                            </div>
                            <div className="mt-1">
                              <span className="text-base font-black text-slate-800">{totalDamagedQty.toLocaleString()}</span>
                              <span className="text-[10px] font-semibold text-slate-400 ml-1">{selectedProductDetail.uom || "pcs"}</span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 mt-0.5 block">
                              Scrapped & Waste Loss
                            </span>
                          </div>
                        </div>

                        {/* Interactive stock movement timeline ledger */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <History className="w-3.5 h-3.5 text-slate-400" />
                              Historical Stock Movements Ledger ({prodMovements.length})
                            </h5>
                          </div>

                          <div className="border border-slate-150 rounded-xl overflow-hidden bg-slate-50/30">
                            <div className="max-h-[300px] overflow-y-auto pr-1">
                              {prodMovements.length === 0 ? (
                                <div className="p-8 text-center flex flex-col items-center justify-center">
                                  <Activity className="w-8 h-8 text-slate-300 mb-2 animate-none" />
                                  <p className="text-xs text-slate-500 font-bold">No recorded stock movements</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Use Adjust or Transfer stock to log inventory actions</p>
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-100 bg-white">
                                  {prodMovements.map((mov: any) => {
                                    const { delta, category } = getMovementDetails(mov);
                                    
                                    // Style config depending on category
                                    let style = {
                                      iconBg: "bg-slate-50 border-slate-100 text-slate-500",
                                      icon: <FileText className="w-3.5 h-3.5" />,
                                      badgeClass: "bg-slate-50 text-slate-600 border-slate-100",
                                      title: "Manual Stock Adjustment",
                                    };

                                    if (category === 'sale') {
                                      style = {
                                        iconBg: "bg-blue-50 border-blue-100 text-blue-600",
                                        icon: <ShoppingCart className="w-3.5 h-3.5" />,
                                        badgeClass: "bg-blue-50 text-blue-600 border-blue-100",
                                        title: "Customer Sale Outbound",
                                      };
                                    } else if (category === 'restock') {
                                      style = {
                                        iconBg: "bg-emerald-50 border-emerald-100 text-emerald-600",
                                        icon: <Truck className="w-3.5 h-3.5" />,
                                        badgeClass: "bg-emerald-50 text-emerald-600 border-emerald-100",
                                        title: "Inventory Stock Restock",
                                      };
                                    } else if (category === 'transfer') {
                                      style = {
                                        iconBg: "bg-purple-50 border-purple-100 text-purple-600",
                                        icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
                                        badgeClass: "bg-purple-50 text-purple-600 border-purple-100",
                                        title: "Inter-Branch Stock Transfer",
                                      };
                                    } else if (category === 'expired') {
                                      style = {
                                        iconBg: "bg-rose-50 border-rose-100 text-rose-600",
                                        icon: <Clock className="w-3.5 h-3.5" />,
                                        badgeClass: "bg-rose-50 text-rose-600 border-rose-100",
                                        title: "Expiry Disposal Write-off",
                                      };
                                    } else if (category === 'damaged') {
                                      style = {
                                        iconBg: "bg-orange-50 border-orange-100 text-orange-600",
                                        icon: <AlertTriangle className="w-3.5 h-3.5" />,
                                        badgeClass: "bg-orange-50 text-orange-600 border-orange-100",
                                        title: "Damaged Stock Write-off",
                                      };
                                    }

                                    const isPositive = delta > 0;

                                    return (
                                      <div key={mov.id} className="p-3.5 hover:bg-slate-50/50 transition-colors flex items-start gap-3.5">
                                        <div className={cn("w-8 h-8 rounded-lg shrink-0 border flex items-center justify-center shadow-sm", style.iconBg)}>
                                          {style.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-extrabold text-slate-800 truncate">{style.title}</p>
                                            <span className={cn(
                                              "text-xs font-black font-mono px-2 py-0.5 rounded border shadow-sm shrink-0",
                                              isPositive ? "bg-emerald-50 text-emerald-700 border-emerald-150" : "bg-rose-50 text-rose-700 border-rose-150"
                                            )}>
                                              {isPositive ? "+" : "-"}{Math.abs(mov.quantity || 0).toLocaleString()}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-slate-500 font-bold mt-1 bg-slate-50 p-1.5 rounded border border-slate-100 italic">
                                            "{mov.reason || "No notes recorded"}"
                                          </p>
                                          <div className="flex flex-wrap items-center justify-between text-[9px] font-bold text-slate-400 mt-2 gap-x-4 gap-y-1">
                                            <span className="font-mono text-slate-400">
                                              Ledger: <span className="text-slate-600">{mov.beforeQty ?? 0}</span> → <span className="text-slate-800 font-bold">{mov.afterQty ?? 0}</span> {selectedProductDetail.uom || "pcs"}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                              <span className="text-slate-500 font-semibold">{mov.createdBy || "staff"}</span>
                                              <span>•</span>
                                              <span>{mov.createdAt ? new Date(mov.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '--'}</span>
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustmentData({
                      productId: selectedProductDetail.id,
                      quantity: selectedProductDetail.quantity,
                      reason: "manual",
                      customReason: "",
                      imageString: "",
                    });
                    setIsAdjustingStock(true);
                    setSelectedProductDetail(null);
                  }}
                  className="flex-1 min-w-[120px] h-11 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adjust Stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTransferData({
                      productId: selectedProductDetail.id,
                      transferType: "out",
                      otherBranchId: BRANCHES.find(b => b.id !== (selectedProductDetail.warehouseId || "main-wh"))?.id || BRANCHES[0].id,
                      quantity: 1,
                      subtractSource: true,
                      addDestination: true,
                      notes: `Inter-branch stock balancing for ${selectedProductDetail.name}`,
                    });
                    setIsTransferringStock(true);
                    setSelectedProductDetail(null);
                  }}
                  className="flex-1 min-w-[125px] h-11 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Transfer Stock
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProductDetail(null)}
                  className="w-full lg:w-auto px-6 h-11 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md shadow-slate-800/10"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAdjustingStock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-extrabold text-slate-900">
                  Stock Adjustment
                </h3>
                <button
                  onClick={() => setIsAdjustingStock(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAdjustStock} className="p-6 space-y-4">
                <div className="space-y-4 text-left">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Select Product
                    </label>
                    <select
                      required
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
                      value={adjustmentData.productId}
                      onChange={(e) =>
                        setAdjustmentData({
                          ...adjustmentData,
                          productId: e.target.value,
                        })
                      }
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) - Current: {p.quantity}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Adjustment Value (+ for Inbound, - for Outbound)
                    </label>
                    <input
                      required
                      type="number"
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
                      value={adjustmentData.quantity}
                      onChange={(e) =>
                        setAdjustmentData({
                          ...adjustmentData,
                          quantity: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Reason Category
                    </label>
                    <select
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
                      value={adjustmentData.reason}
                      onChange={(e) =>
                        setAdjustmentData({
                          ...adjustmentData,
                          reason: e.target.value,
                        })
                      }
                    >
                      <option value="manual">
                        Manual Adjustment (Type Below)
                      </option>
                      <option value="damaged">Damaged Stock</option>
                      <option value="return">Customer Return</option>
                      <option value="expired">Expired Stock</option>
                      <option value="found">Found during Audit</option>
                    </select>
                  </div>

                  {adjustmentData.reason === "manual" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                        Manual Entry Reason
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Stock transfer between warehouses"
                        className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
                        value={adjustmentData.customReason}
                        onChange={(e) =>
                          setAdjustmentData({
                            ...adjustmentData,
                            customReason: e.target.value,
                          })
                        }
                      />
                    </motion.div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Verification Photo / Receipt (Optional)
                    </label>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="verification-image-upload"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setAdjustmentData(prev => ({
                                ...prev,
                                imageString: reader.result as string
                              }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label
                        htmlFor="verification-image-upload"
                        className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-4 bg-slate-50 cursor-pointer hover:bg-slate-100/50 transition-all text-center gap-1.5"
                      >
                        <span className="text-xs font-bold text-slate-600">Select Image File</span>
                        <span className="text-[10px] font-semibold text-slate-400">PNG, JPG up to 5MB</span>
                      </label>
                      {adjustmentData.imageString && (
                        <div className="relative mt-1 w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
                          <img
                            src={adjustmentData.imageString}
                            alt="Verification preview"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setAdjustmentData(prev => ({ ...prev, imageString: "" }))}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-sm"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAdjustingStock(false)}
                    className="flex-1 h-12 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] h-12 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-blue-700 transition-all"
                  >
                    Adjust Stock
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTransferringStock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 leading-tight">
                    Stock Transfer
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5 uppercase tracking-widest">
                    In / Out Branch Movement
                  </p>
                </div>
                <button
                  onClick={() => setIsTransferringStock(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                >
                  <X className="w-6 h-6 animate-none" />
                </button>
              </div>

              <form onSubmit={handleTransferStock} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                    1. Select Inventory Product
                  </label>
                  <select
                    required
                    className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none text-slate-800"
                    value={transferData.productId}
                    onChange={(e) => {
                      const prodId = e.target.value;
                      const prod = products.find(p => p.id === prodId);
                      setTransferData({
                        ...transferData,
                        productId: prodId,
                        otherBranchId: BRANCHES.find(b => b.id !== (prod?.warehouseId || "main-wh"))?.id || BRANCHES[0].id
                      });
                    }}
                  >
                    <option value="" disabled>-- Choose a Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — {BRANCHES.find(b => b.id === (p.warehouseId || "main-wh"))?.name || BRANCHES[0].name} [{p.quantity} left]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      2. Transfer Direction
                    </label>
                    <select
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none text-slate-800"
                      value={transferData.transferType}
                      onChange={(e) =>
                        setTransferData({
                          ...transferData,
                          transferType: e.target.value as "in" | "out",
                        })
                      }
                    >
                      <option value="out">📤 Move Stock Out (Send)</option>
                      <option value="in">📥 Move Stock In (Receive)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      3. Target/Source Branch
                    </label>
                    <select
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none text-slate-800"
                      value={transferData.otherBranchId}
                      onChange={(e) =>
                        setTransferData({
                          ...transferData,
                          otherBranchId: e.target.value,
                        })
                      }
                    >
                      {(() => {
                        const selectedProduct = products.find(p => p.id === transferData.productId);
                        const productBranchId = selectedProduct?.warehouseId || "main-wh";
                        const availableBranches = BRANCHES.filter(b => b.id !== productBranchId);
                        return availableBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      4. Quantity to Move
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-3.5 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800"
                      value={transferData.quantity}
                      onChange={(e) =>
                        setTransferData({
                          ...transferData,
                          quantity: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                    />
                  </div>

                  {transferData.transferType === "in" && (
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        id="subtractSource"
                        type="checkbox"
                        className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-indigo-500"
                        checked={transferData.subtractSource}
                        onChange={(e) =>
                          setTransferData({
                            ...transferData,
                            subtractSource: e.target.checked,
                          })
                        }
                      />
                      <label htmlFor="subtractSource" className="text-xs text-slate-500 font-semibold select-none leading-tight cursor-pointer">
                        Deduct from source branch stock automatically
                      </label>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1.5 block">
                    Notes / Documentation Reference
                  </label>
                  <textarea
                    className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-lg text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-300 resize-none h-20"
                    placeholder="e.g. Branch stock balancing, Store replenishment..."
                    value={transferData.notes}
                    onChange={(e) =>
                      setTransferData({
                        ...transferData,
                        notes: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button
                    type="button"
                    disabled={isSubmittingTransfer}
                    onClick={() => setIsTransferringStock(false)}
                    className="flex-1 h-12 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTransfer}
                    className="flex-[2] h-12 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmittingTransfer && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                    {isSubmittingTransfer ? "Executing..." : "Execute Movement"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-extrabold text-slate-900">
                  Add New Product
                </h3>
                <button
                  onClick={() => setIsAddingProduct(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddProduct} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Product Name
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
                      value={newProduct.name}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      SKU Identifier
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
                      value={newProduct.sku}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, sku: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Category
                    </label>
                    <select
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none"
                      value={newProduct.category}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          category: e.target.value,
                        })
                      }
                    >
                      {dbCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Initial Store / Warehouse Branch
                    </label>
                    <select
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none text-slate-800"
                      value={newProduct.warehouseId || "main-wh"}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          warehouseId: e.target.value,
                        })
                      }
                    >
                      {BRANCHES.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
                      value={newProduct.quantity}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          quantity: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Initial Units Received
                    </label>
                    <input
                      type="number"
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all font-semibold"
                      placeholder="Defaults to stock count"
                      value={newProduct.unitsReceived || ""}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          unitsReceived: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Historical Units Sold
                    </label>
                    <input
                      type="number"
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
                      placeholder="e.g. 10"
                      value={newProduct.unitsSold || ""}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          unitsSold: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Buying Price / Cost ({currency})
                    </label>
                    <input
                      required
                      type="number"
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all font-semibold"
                      value={newProduct.buyingPrice ?? newProduct.value ?? ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setNewProduct({
                          ...newProduct,
                          buyingPrice: val,
                          value: val,
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Selling Price / Retail ({currency})
                    </label>
                    <input
                      required
                      type="number"
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all font-semibold"
                      value={newProduct.sellingPrice ?? ""}
                      placeholder="e.g. 150"
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          sellingPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800"
                      value={newProduct.expiryDate || ""}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          expiryDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Manufacture Date
                    </label>
                    <input
                      type="date"
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800"
                      value={newProduct.manufactureDate || ""}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          manufactureDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Batch Number
                    </label>
                    <input
                      type="text"
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
                      placeholder="e.g. BAT-3948"
                      value={newProduct.batchNumber || ""}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          batchNumber: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Base Unit of Measure (UoM)
                    </label>
                    <select
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none text-slate-800"
                      value={newProduct.uom || "Piece"}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          uom: e.target.value,
                        })
                      }
                    >
                      <option value="Piece">Piece (pcs)</option>
                      <option value="kg">Kilogram (kg)</option>
                      <option value="Gram">Gram (g)</option>
                      <option value="Liter">Liter (L)</option>
                      <option value="ml">Milliliter (mL)</option>
                      <option value="Meter">Meter (m)</option>
                      <option value="Yard">Yard (yd)</option>
                      <option value="Box">Box (box)</option>
                      <option value="Pack">Pack (pack)</option>
                      <option value="Roll">Roll (roll)</option>
                      <option value="Set">Set (set)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Material Group
                    </label>
                    <select
                      className="w-full h-11 bg-slate-50 border border-slate-100 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none text-slate-800"
                      value={newProduct.materialGroup || "Finished Goods"}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          materialGroup: e.target.value,
                        })
                      }
                    >
                      <option value="Raw Materials">Raw Materials</option>
                      <option value="Finished Goods">Finished Goods</option>
                      <option value="Semi-Finished Goods">Semi-Finished Goods</option>
                      <option value="Packaging Materials">Packaging Materials</option>
                      <option value="Spare Parts">Spare Parts</option>
                      <option value="Consumables">Consumables</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddingProduct(false)}
                    className="flex-1 h-12 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] h-12 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all"
                  >
                    Register Product
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAuditing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">
                    Stock Count Audit
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">
                    Verification of physical inventory vs system records
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsAuditing(false);
                    setAuditCounts({});
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {products.map((product) => {
                  const actual = auditCounts[product.id] ?? product.quantity;
                  const diff = actual - product.quantity;

                  return (
                    <div
                      key={product.id}
                      className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center gap-6 group"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-200">
                          <Hash className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm">
                            {product.name}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {product.sku}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-10">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            System
                          </p>
                          <p className="text-base font-extrabold text-slate-900">
                            {product.quantity}
                          </p>
                        </div>

                        <div className="flex flex-col items-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                            Actual
                          </p>
                          <input
                            type="number"
                            className="w-20 h-9 bg-white border border-slate-200 rounded-lg text-center text-slate-900 font-bold focus:border-blue-500 outline-none text-sm shadow-sm"
                            value={auditCounts[product.id] ?? ""}
                            placeholder={product.quantity.toString()}
                            onChange={(e) =>
                              handleAuditChange(product.id, e.target.value)
                            }
                          />
                        </div>

                        <div className="min-w-[70px] flex flex-col items-end">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            Variance
                          </p>
                          <div
                            className={cn(
                              "flex items-center gap-1 text-sm font-bold",
                              diff === 0
                                ? "text-slate-400"
                                : diff > 0
                                  ? "text-emerald-600"
                                  : "text-rose-600",
                            )}
                          >
                            {diff === 0
                              ? "--"
                              : `${diff > 0 ? "+" : ""}${diff}`}
                            {diff !== 0 && (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                <p className="text-[11px] text-slate-400 font-medium italic">
                  Note: Confirming counts will create a reconciliation
                  adjustment record.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setIsAuditing(false);
                      setAuditCounts({});
                    }}
                    className="px-6 h-10 rounded-lg font-bold text-slate-500 hover:text-slate-700 transition-colors text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={finalizeAudit}
                    className="px-6 h-11 bg-blue-600 rounded-lg text-white font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-blue-600/20 flex items-center gap-2 hover:bg-blue-700 transition-all"
                  >
                    <Check className="w-4 h-4" />
                    Finalize Audit
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Products",
            val: allProducts.length.toString(),
            sub: `${currency} ${(allProducts.reduce((acc, p) => acc + p.value * p.quantity, 0) / 1000).toFixed(1)}k value`,
            variant: "blue",
          },
          {
            label: "Low Stock Items",
            val: allProducts.filter((p) => p.quantity <= (p.reorderPoint ?? p.minStock ?? 10)).length.toString(),
            sub: "Needs reordering",
            variant: "rose",
          },
          {
            label: "Fast Moving",
            val: allProducts
              .filter((p) => p.movement === "fast")
              .length.toString(),
            sub: "High velocity",
            variant: "emerald",
          },
          {
            label: "Stock Valuation",
            val: formatCompactNumber(
              allProducts.reduce((acc, p) => acc + p.value * p.quantity, 0),
              currency,
            ),
            sub: "Total equity",
            variant: "indigo",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className={cn(
              "p-5 rounded-xl border flex flex-col justify-between h-32 shadow-sm",
              stat.variant === "blue"
                ? "bg-blue-50 border-blue-100 text-blue-600"
                : stat.variant === "emerald"
                  ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                  : stat.variant === "rose"
                    ? "bg-rose-50 border-rose-100 text-rose-600"
                    : stat.variant === "indigo"
                      ? "bg-indigo-50 border-indigo-100 text-indigo-600"
                      : "bg-white border-slate-200 text-slate-900",
            )}
          >
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                stat.variant === "gray" ? "text-slate-400" : "opacity-80",
              )}
            >
              {stat.label}
            </p>
            <h4 className="text-3xl font-black mt-1">{stat.val}</h4>
            <p
              className={cn(
                "text-[10px] font-medium mt-1",
                stat.variant === "gray" ? "text-slate-400" : "opacity-60",
              )}
            >
              {stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Filters Hub with Expiry Track Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Search by name, SKU, or batch identifier..."
              className="w-full pl-11 pr-4 h-12 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-slate-300 focus:bg-white transition-all font-medium text-slate-900 text-sm placeholder-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <button className="shrink-0 flex items-center gap-2 px-4 h-10 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors">
              <Filter className="w-3 h-3" /> All Status{" "}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
            <button className="shrink-0 flex items-center gap-2 px-4 h-10 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors">
              <Plus className="w-3 h-3" /> Categories{" "}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
            <button className="shrink-0 flex items-center gap-2 px-4 h-10 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors">
              <ArrowUpDown className="w-3 h-3" /> Velocity{" "}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
          </div>
        </div>

        {/* Expiry Tracking Action Tabs */}
        <div className="border-t border-slate-100 pt-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
            Shelf Life & Expiry Tracking
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {[
              {
                id: "all",
                label: "All Inventory",
                count: allProducts.length,
                activeColor: "bg-slate-900 text-white border-slate-900",
                inactiveColor:
                  "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-100",
              },
              {
                id: "expired",
                label: "Expired",
                count: expiredCount,
                activeColor: "bg-rose-500 text-white border-rose-500",
                inactiveColor:
                  "bg-rose-50/70 hover:bg-rose-50 text-rose-700 border-rose-100",
                isCaution: true,
              },
              {
                id: "soon",
                label: "Expiring Soon (30d)",
                count: soonCount,
                activeColor: "bg-amber-500 text-white border-amber-500",
                inactiveColor:
                  "bg-amber-50/70 hover:bg-amber-50/90 text-amber-700 border-amber-100",
                isWarning: true,
              },
              {
                id: "healthy",
                label: "Healthy / Non-Perishable",
                count: healthyCount,
                activeColor: "bg-emerald-600 text-white border-emerald-600",
                inactiveColor:
                  "bg-emerald-50/70 hover:bg-emerald-50 text-emerald-700 border-emerald-100",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setExpiryFilter(tab.id as any)}
                className={cn(
                  "px-4 h-9 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 shadow-sm",
                  expiryFilter === tab.id ? tab.activeColor : tab.inactiveColor,
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none",
                    expiryFilter === tab.id
                      ? "bg-white/25 text-white"
                      : "bg-slate-200/50 text-slate-700",
                    tab.id === "expired" &&
                      expiryFilter !== "expired" &&
                      "bg-rose-100 text-rose-700",
                    tab.id === "soon" &&
                      expiryFilter !== "soon" &&
                      "bg-amber-100 text-amber-700",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* View Switcher: Active Stock vs. Transfer & Movement Journal */}
      <div className="flex border-b border-slate-200 mb-6 bg-slate-50/50 p-1.5 rounded-xl border">
        <button
          onClick={() => setActiveInventoryTab("stock")}
          className={cn(
            "flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2",
            activeInventoryTab === "stock"
              ? "bg-white text-blue-600 shadow-sm border border-slate-100 font-extrabold"
              : "text-slate-400 hover:text-slate-600 font-bold"
          )}
        >
          📦 Active Inventory
        </button>
        <button
          onClick={() => setActiveInventoryTab("transfers")}
          className={cn(
            "flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2",
            activeInventoryTab === "transfers"
              ? "bg-white text-indigo-600 shadow-sm border border-slate-100 font-extrabold"
              : "text-slate-400 hover:text-slate-600 font-bold"
          )}
        >
          🔄 Transfers & Movements Log
        </button>
      </div>

      {activeInventoryTab === "stock" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="hidden lg:grid grid-cols-[1.2fr_100px_100px_80px_105px_80px_110px_100px_100px_80px] gap-4 px-8 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <div>Inventory Record</div>
          <div>SKU ID</div>
          <div>Category</div>
          <div className="text-right">Units</div>
          <div className="text-right">Valuation</div>
          <div className="text-center">STR</div>
          <div className="text-center">Expiry Date</div>
          <div className="text-center">Days left</div>
          <div className="text-center">Status</div>
          <div className="text-center">Disposal</div>
        </div>

        <div className="divide-y divide-slate-100">
          {displayProducts.map((product) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let diffDays: number | null = null;
            let expiryLabel = "Non-Perishable";
            let daysLeftLabel = "--";
            let statusLabel = "Fresh";
            let statusBadgeColor =
              "bg-emerald-50 text-emerald-600 border-emerald-100";

            if (product.expiryDate) {
              const exp = new Date(product.expiryDate);
              exp.setHours(0, 0, 0, 0);
              diffDays = Math.ceil(
                (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
              );
              expiryLabel = product.expiryDate;
              if (diffDays < 0) {
                daysLeftLabel = `${Math.abs(diffDays)}d ago`;
                statusLabel = "Expired";
                statusBadgeColor =
                  "bg-rose-50 text-rose-600 border-rose-100 font-extrabold animate-pulse";
              } else if (diffDays <= 14) {
                daysLeftLabel = `${diffDays}d left`;
                statusLabel = "Near Expiry";
                statusBadgeColor =
                  "bg-amber-50 text-amber-600 border-amber-100 font-bold";
              } else {
                daysLeftLabel = `${diffDays}d left`;
                statusLabel = "Fresh";
                statusBadgeColor =
                  "bg-emerald-50 text-emerald-600 border-emerald-100 font-medium";
              }
            }

            return (
              <React.Fragment key={product.id}>
                {/* Desktop Row */}
                <div 
                  onClick={() => setSelectedProductDetail(product)}
                  className="hidden lg:grid grid-cols-[1.2fr_100px_100px_80px_105px_80px_110px_100px_100px_80px] gap-4 px-8 py-5 items-center group cursor-pointer hover:bg-slate-50 transition-all text-left"
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-white transition-all border border-slate-100 group-hover:border-blue-200 group-hover:shadow-sm">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-all text-sm leading-tight truncate text-left">
                        {product.name}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight text-left flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                        <span>Last sold: {product.lastSold}</span>
                        {product.batchNumber && (
                          <span className="text-slate-500 bg-slate-100 px-1 rounded-sm">
                            Batch: {product.batchNumber}
                          </span>
                        )}
                        {product.manufactureDate && (
                          <span className="text-slate-500 bg-slate-100 px-1 rounded-sm">
                            Mfg: {product.manufactureDate}
                          </span>
                        )}
                        <span className="text-indigo-600 bg-indigo-50 px-1 rounded-sm text-[8px] font-black uppercase tracking-wider border border-indigo-100/30 leading-none">
                          📍 {BRANCHES.find(b => b.id === (product.warehouseId || "main-wh"))?.name || BRANCHES[0].name}
                        </span>
                        <span className="text-teal-600 bg-teal-50 px-1 rounded-sm text-[8px] font-black uppercase tracking-wider border border-teal-100/30 leading-none">
                          ⚖️ UoM: {product.uom || "Piece"}
                        </span>
                        <span className="text-pink-600 bg-pink-50 px-1 rounded-sm text-[8px] font-black uppercase tracking-wider border border-pink-100/30 leading-none">
                          📂 {product.materialGroup || "Finished Goods"}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="font-bold text-slate-400 text-[11px] font-mono tracking-tighter uppercase">
                    {product.sku}
                  </div>
                  <div className="font-semibold text-slate-500 text-[11px] italic truncate">
                    {product.category}
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        "text-sm font-bold",
                        product.quantity <= (product.reorderPoint ?? product.minStock ?? 10)
                          ? "text-rose-500 font-extrabold"
                          : "text-slate-900",
                      )}
                    >
                      {product.quantity.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right font-extrabold text-slate-900 text-xs">
                    {currency} {product.value.toLocaleString()}
                  </div>
                  <div className="text-center font-extrabold font-mono text-xs">
                    {(() => {
                      const str = getSellThroughRate(product);
                      return (
                        <span className={cn(
                          "px-2 py-0.5 rounded-full font-bold text-[10px]",
                          str >= 70 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : 
                          str >= 40 ? "bg-blue-50 text-blue-600 border border-blue-100" : 
                          "bg-amber-50 text-amber-600 border border-amber-100"
                        )}>
                          {str.toFixed(1)}%
                        </span>
                      );
                    })()}
                  </div>
                  <div className="text-center font-bold text-xs text-slate-700 font-mono">
                    {expiryLabel}
                  </div>
                  <div
                    className={cn(
                      "text-center font-bold text-xs font-mono",
                      diffDays !== null
                        ? diffDays < 0
                          ? "text-[#E63946]"
                          : diffDays <= 14
                            ? "text-[#E28743]"
                            : "text-[#2A9D8F]"
                        : "text-slate-400",
                    )}
                  >
                    {daysLeftLabel}
                  </div>
                  <div className="flex justify-center">
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm leading-none",
                        statusBadgeColor,
                      )}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProduct(product.id);
                      }}
                      title="Dispose expired item"
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Mobile Card */}
                <div className="lg:hidden p-5 flex flex-col gap-4 bg-white border-b border-slate-100 text-left">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 flex-shrink-0 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                      <Package className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <p className="font-bold text-slate-900 truncate leading-tight pr-2">
                          {product.name}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-widest border shrink-0",
                              movementStyles[product.movement],
                            )}
                          >
                            {product.movement}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest truncate">
                        {product.sku} • {product.category}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border border-indigo-100/30 shrink-0">
                          📍 {BRANCHES.find(b => b.id === (product.warehouseId || "main-wh"))?.name || BRANCHES[0].name}
                        </span>
                        <span className="text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border border-teal-100/30 shrink-0">
                          ⚖️ UoM: {product.uom || "Piece"}
                        </span>
                        <span className="text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border border-pink-100/30 shrink-0">
                          📂 {product.materialGroup || "Finished Goods"}
                        </span>
                      </div>

                      {product.expiryDate && (
                        <div className="mt-2 flex items-center gap-1.5 leading-none">
                          {(() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const exp = new Date(product.expiryDate);
                            exp.setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil(
                              (exp.getTime() - today.getTime()) /
                                (1000 * 60 * 60 * 24),
                            );
                            if (diffDays < 0) {
                              return (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 uppercase tracking-widest animate-pulse leading-none">
                                  ⚠️ Expired ({product.expiryDate})
                                </span>
                              );
                            } else if (diffDays <= 30) {
                              return (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 uppercase tracking-widest leading-none">
                                  ⏳ Expiring soon in {diffDays}d
                                </span>
                              );
                            } else {
                              return (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-tight leading-none">
                                  🛡️ Expires: {product.expiryDate}
                                </span>
                              );
                            }
                          })()}
                        </div>
                      )}

                      <div className="flex items-center gap-6 mt-4">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            In Stock
                          </span>
                          <span
                            className={cn(
                              "text-sm font-extrabold",
                              product.quantity <= (product.reorderPoint ?? product.minStock ?? 10)
                                ? "text-rose-500 font-black"
                                : "text-slate-900",
                            )}
                          >
                            {product.quantity.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-px h-6 bg-slate-100" />
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            Valuation
                          </span>
                          <span className="text-sm font-extrabold text-slate-900">
                            {formatCompactNumber(product.value, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] font-medium text-slate-400 italic">
                      Recorded: {product.lastSold}
                    </span>
                    <button
                      onClick={() => setSelectedProductDetail(product)}
                      className="text-[9px] font-bold text-blue-600 uppercase tracking-widest px-4 py-2 bg-blue-50 rounded-lg border border-blue-100 transition-colors active:bg-blue-100"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          {products.length === 0 && !loading && (
            <div className="p-20 text-center">
              <p className="text-slate-400 font-medium">
                No products available in the inventory. Click "New Product" to add.
              </p>
            </div>
          )}
        </div>
      </div>
      )}

      {activeInventoryTab === "transfers" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900">Transfers & Movements Log</h4>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Tracking stock dispatching and reception across branches</p>
            </div>
            <button
              onClick={() => setIsTransferringStock(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all"
            >
              <ArrowUpDown className="rotate-90 w-3.5 h-3.5" />
              New Transfer
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Product Details</th>
                  <th className="px-6 py-4">Transfer Action</th>
                  <th className="px-6 py-4">Routing Path</th>
                  <th className="px-6 py-4 text-right font-black">Quantity</th>
                  <th className="px-6 py-4">Authorized By</th>
                  <th className="px-6 py-4">Notes / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movementsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-xs text-slate-400 font-medium">
                      Loading movements log from database...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-xs text-slate-400 font-medium">
                      No stock transfers recorded yet. Click "New Transfer" to initiate a branch movement.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov: any) => {
                    const isTransferIn = mov.transferType === "in";
                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/50 transition-colors text-xs font-medium text-slate-600">
                        <td className="px-6 py-4 font-mono text-slate-400">
                          {mov.createdAt ? new Date(mov.createdAt).toLocaleString() : "--"}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">
                          <div>{mov.productName || "Unknown Product"}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {mov.sku}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
                            isTransferIn 
                              ? "bg-teal-50 text-teal-600 border-teal-100" 
                              : "bg-indigo-50 text-indigo-600 border-indigo-100"
                          )}>
                            {isTransferIn ? "📥 Transfer In" : "📤 Transfer Out"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                            <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {BRANCHES.find(b => b.id === mov.sourceWarehouseId)?.name || mov.sourceWarehouseId || "Current Branch"}
                            </span>
                            <span className="text-slate-300">➔</span>
                            <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              {BRANCHES.find(b => b.id === mov.destWarehouseId)?.name || mov.destWarehouseId || "Target Branch"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-extrabold text-slate-900 text-sm">
                          {mov.quantity?.toLocaleString() || 0} units
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-semibold truncate max-w-[120px]">
                          {mov.createdBy || "System"}
                        </td>
                        <td className="px-6 py-4 text-slate-400 italic max-w-[200px] truncate" title={mov.reason}>
                          <div className="flex items-center gap-2">
                            <span>{mov.reason || "Inter-branch balance adjustment"}</span>
                            {mov.verificationImage && (
                              <button
                                onClick={() => {
                                  const win = window.open();
                                  if (win) {
                                    win.document.write(`<img src="${mov.verificationImage}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
                                  } else {
                                    alert("Pop-up blocked. Image preview is attached directly in the record.");
                                  }
                                }}
                                className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 rounded text-[9px] font-bold uppercase tracking-wide transition-colors shrink-0"
                              >
                                View Photo
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        type={confirmConfig.type}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        onScanResult={handleScanResult}
        currency={currency}
      />
    </div>
  );
}
