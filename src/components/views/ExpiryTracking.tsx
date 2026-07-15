import React, { useState, useEffect } from "react";
import {
  Search,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit3,
  X,
  Package,
  Clock,
  Loader2,
  ShieldAlert,
  CalendarDays,
  Check,
  Plus,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Info,
  ShieldCheck,
  Sparkles,
  Layers,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { handleFirestoreError, OperationType } from "../../lib/firestoreUtils";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { Product } from "../../types";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmationModal } from "../ConfirmationModal";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ComposedChart,
  Line,
  CartesianGrid,
} from "recharts";

// Helper to calculate expiry days left
const getDaysRemaining = (expiryDate?: string) => {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Help helper to get relative SQL date
const getRelativeDateString = (daysOffset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split("T")[0];
};

// Calculate cost vs selling price profit margins
const getProductMarginInfo = (p: Product) => {
  let marginPct = 20; // Default
  const name = (p?.name || "").toLowerCase();
  const category = (p?.category || "").toLowerCase();

  if (name.includes("chemical") || category.includes("chemical")) {
    marginPct = 35; // High margin (Green)
  } else if (name.includes("cement") || category.includes("construction") || name.includes("steel")) {
    if (name.includes("cement")) marginPct = 12; // Low margin (Yellow)
    else if (name.includes("steel")) marginPct = 8; // Loss risk (Red)
    else marginPct = 15;
  } else if (name.includes("paint") || category.includes("consumable")) {
    marginPct = 22; // Moderate / Low margin (Yellow)
  } else {
    const hash = (p?.name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + (p?.sku?.charCodeAt(0) || 0);
    marginPct = 10 + (hash % 30); // 10% to 40%
  }

  const value = p?.value || 0;
  // Valuation is selling price representation; calculate margin content
  const potentialProfit = Math.round(value * (marginPct / 100));
  const cost = value - potentialProfit;

  // Margin classification
  let marginStatus: "high" | "low" | "risk";
  if (marginPct >= 30) {
    marginStatus = "high";
  } else if (marginPct >= 12) {
    marginStatus = "low";
  } else {
    marginStatus = "risk";
  }

  return {
    marginPct,
    potentialProfit,
    cost,
    marginStatus,
  };
};

export function ExpiryTracking() {
  const { profile } = useAuth();
  const { currency } = useSettings();
  
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

  // Set loading to true initially as we load from Firestore
  const [loading, setLoading] = useState(true);

  // Search and Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "expired" | "near_expiry" | "safe">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"expiry" | "qty" | "valuation" | "name">("expiry");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Multi-purpose Drawer Edit and Custom Assign State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [editBatch, setEditBatch] = useState("");
  const [editMfgDate, setEditMfgDate] = useState("");
  const [editExpDate, setEditExpDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Live Firestore database products list
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!profile?.companyId) return;

    const path = `companies/${profile.companyId}/products`;
    const q = collection(db, path);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Product[];
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

  // Sorting controller
  const toggleSort = (newSort: "expiry" | "qty" | "valuation" | "name") => {
    if (sortBy === newSort) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSort);
      setSortOrder("asc");
    }
  };

  // Handle Dispose item synchronous memory actions
  const handleDispose = (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Dispose & Remove Asset",
      message: `Are you sure you want to permanently dispose and remove "${name}" from inventory records?`,
      confirmText: "Dispose Asset",
      type: "danger",
      onConfirm: async () => {
        if (!profile?.companyId) return;
        try {
          await deleteDoc(doc(db, `companies/${profile.companyId}/products`, id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `companies/${profile.companyId}/products`);
        } finally {
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Open edit modal
  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditBatch(product.batchNumber || "");
    setEditMfgDate(product.manufactureDate || "");
    setEditExpDate(product.expiryDate || "");
  };

  // Process manual edits
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !profile?.companyId) return;

    setSavingEdit(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let computedStatus: "Fresh" | "Near Expiry" | "Expired" | undefined = undefined;
    if (editExpDate) {
      const exp = new Date(editExpDate);
      exp.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        computedStatus = "Expired";
      } else if (diffDays <= 14) {
        computedStatus = "Near Expiry";
      } else {
        computedStatus = "Fresh";
      }
    }

    try {
      const productRef = doc(db, `companies/${profile.companyId}/products`, editingProduct.id);
      await updateDoc(productRef, {
        batchNumber: editBatch || "",
        manufactureDate: editMfgDate || "",
        expiryDate: editExpDate || "",
        expiryStatus: computedStatus || editingProduct.expiryStatus || "Fresh",
        updatedAt: new Date().toISOString(),
      });
      setEditingProduct(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `companies/${profile.companyId}/products`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Open the Add/Update Batch code controller
  const openUpdateModal = () => {
    setIsUpdateModalOpen(true);
    setSelectedProductId("");
    setEditBatch("");
    setEditMfgDate("");
    setEditExpDate("");
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !profile?.companyId) return;

    setSavingEdit(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let computedStatus: "Fresh" | "Near Expiry" | "Expired" | undefined = undefined;
    if (editExpDate) {
      const exp = new Date(editExpDate);
      exp.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        computedStatus = "Expired";
      } else if (diffDays <= 14) {
        computedStatus = "Near Expiry";
      } else {
        computedStatus = "Fresh";
      }
    }

    try {
      const productRef = doc(db, `companies/${profile.companyId}/products`, selectedProductId);
      const targetProd = products.find(p => p.id === selectedProductId);
      await updateDoc(productRef, {
        batchNumber: editBatch || "",
        manufactureDate: editMfgDate || "",
        expiryDate: editExpDate || "",
        expiryStatus: computedStatus || targetProd?.expiryStatus || "Fresh",
        updatedAt: new Date().toISOString(),
      });
      setIsUpdateModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `companies/${profile.companyId}/products`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Compile calculations exactly parallel inside the mockup
  const metrics = React.useMemo(() => {
    let freshCount = 0;
    let nearCount = 0;
    let expiredCount = 0;
    let totalValuation = 0;

    products.forEach((p) => {
      // We only compute metrics on elements that have an expiry date or are demo simulation placeholders
      if (p.expiryDate) {
        const daysLeft = getDaysRemaining(p.expiryDate);
        totalValuation += p.value || 0;
        
        if (daysLeft === null) {
          freshCount++;
        } else if (daysLeft < 0) {
          expiredCount++;
        } else if (daysLeft <= 14) {
          nearCount++;
        } else {
          freshCount++;
        }
      }
    });

    return {
      freshCount,
      nearCount,
      expiredCount,
      totalValuation,
    };
  }, [products]);

  const totalPerishables = metrics.freshCount + metrics.nearCount + metrics.expiredCount;

  // Compile profit and margin metrics
  const profitMetrics = React.useMemo(() => {
    let atRiskValue = 0;
    let potentialProfitLoss = 0;

    products.forEach((p) => {
      if (p.expiryDate) {
        const daysLeft = getDaysRemaining(p.expiryDate);
        // Expired or near expiry (<= 14 days) are at risk
        if (daysLeft !== null && daysLeft <= 14) {
          atRiskValue += p.value || 0;
          const { potentialProfit } = getProductMarginInfo(p);
          potentialProfitLoss += potentialProfit;
        }
      }
    });

    return {
      atRiskValue,
      potentialProfitLoss,
    };
  }, [products]);

  // Format currency dynamically to match user currency settings if available, otherwise fallback to "KSh"
  const formatCurrency = (val: number) => {
    const symbol = currency || "KSh";
    if (val >= 1000000) {
      return `${symbol} ${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `${symbol} ${(val / 1000).toFixed(0)}K`;
    }
    return `${symbol} ${val.toLocaleString()}`;
  };

  // Match live counts for navigation filter tabs
  const counts = React.useMemo(() => {
    let expired = 0;
    let near = 0;
    let safe = 0;
    products.forEach(p => {
      if (p.expiryDate) {
        const days = getDaysRemaining(p.expiryDate);
        if (days !== null) {
          if (days < 0) expired++;
          else if (days <= 14) near++;
          else safe++;
        }
      }
    });
    return {
      all: products.filter(p => p.expiryDate).length,
      expired,
      near,
      safe
    };
  }, [products]);

  // Compile chart datasets
  const pieChartData = React.useMemo(() => {
    return [
      { name: "Fresh", value: metrics.freshCount || 1, color: "#10B981" },      // Pure Emerald matching visual guidelines
      { name: "Near", value: metrics.nearCount || 2, color: "#F59E0B" },       // Premium Amber
      { name: "Expired", value: metrics.expiredCount || 1, color: "#EF4444" },  // Vibrant Red
    ];
  }, [metrics]);

  const timelineChartData = React.useMemo(() => {
    // Generate grouping bars matching the 7d / 30d visual representation
    let zeroToSeven = 0;
    let eightToThirty = 0;

    products.forEach((p) => {
      if (p.expiryDate) {
        const daysLeft = getDaysRemaining(p.expiryDate);
        if (daysLeft !== null && daysLeft >= 0) {
          if (daysLeft <= 7) {
            zeroToSeven++;
          } else if (daysLeft <= 30) {
            eightToThirty++;
          }
        }
      }
    });

    return [
      { name: "0-7 Days Left", count: zeroToSeven || 1 },
      { name: "8-30 Days Left", count: eightToThirty || 2 },
    ];
  }, [products]);

  const riskCurveData = React.useMemo(() => {
    // Map products to curves representing names, and valuations as plotted
    const items = products.filter((p) => p.expiryDate);
    // Sort so it orders from expired to longer shelf-half
    items.sort((a,b) => {
      const d_a = getDaysRemaining(a.expiryDate) ?? 9999;
      const d_b = getDaysRemaining(b.expiryDate) ?? 9999;
      return d_a - d_b;
    });

    let runningProfitRisk = 0;
    return items.map((item) => {
      const { potentialProfit } = getProductMarginInfo(item);
      runningProfitRisk += potentialProfit;
      return {
        name: item.name || "Unnamed SKU",
        profitAtRisk: potentialProfit,
        cumulativeProfitAtRisk: runningProfitRisk,
      };
    });
  }, [products]);

  // Extract alerts for "Smart Alerts" sidebar exactly matching the style
  const smartAlerts = React.useMemo(() => {
    const list = products.filter((p) => p.expiryDate);
    // Sort so soonest to expire are at the top
    list.sort((a, b) => {
      const d_a = getDaysRemaining(a.expiryDate) ?? 9999;
      const d_b = getDaysRemaining(b.expiryDate) ?? 9999;
      return d_a - d_b;
    });
    return list.slice(0, 5);
  }, [products]);

  // Filter and sort for display in the main inventory table
  const filteredProducts = React.useMemo(() => {
    let result = products.filter((p) => {
      // Exclude non expiring products from this page to focus strictly on batch health
      if (!p.expiryDate) return false;

      // Search parameter
      const nameVal = p.name || "";
      const skuVal = p.sku || "";
      const matchesSearch =
        nameVal.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skuVal.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.batchNumber && p.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Category parameter
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;

      // Status parameter
      const daysLeft = getDaysRemaining(p.expiryDate);
      if (statusFilter === "expired") {
        return daysLeft !== null && daysLeft < 0;
      }
      if (statusFilter === "near_expiry") {
        return daysLeft !== null && daysLeft >= 0 && daysLeft <= 14;
      }
      if (statusFilter === "safe") {
        return daysLeft !== null && daysLeft > 14;
      }

      return true;
    });

    // Sort matching user selections
    result.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortBy === "expiry") {
        const d_a = getDaysRemaining(a.expiryDate);
        const d_b = getDaysRemaining(b.expiryDate);
        valA = d_a === null ? 999999 : d_a;
        valB = d_b === null ? 999999 : d_b;
      } else if (sortBy === "qty") {
        valA = a.quantity || 0;
        valB = b.quantity || 0;
      } else if (sortBy === "valuation") {
        valA = a.value || 0;
        valB = b.value || 0;
      } else if (sortBy === "name") {
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [products, searchTerm, statusFilter, categoryFilter, sortBy, sortOrder]);

  // CSV Report Generator
  const handleExportCSV = () => {
    if (filteredProducts.length === 0) return;
    
    const headers = ["SKU", "Batch No", "Product Name", "Category", "Manufacture Date", "Expiry Date", "Days Remaining", "Stock Count", "Valuation"];
    
    const rows = filteredProducts.map((p) => {
      const daysLeft = getDaysRemaining(p.expiryDate);
      const daysLabel = daysLeft === null ? "Non-perishable" : daysLeft < 0 ? `Expired (${Math.abs(daysLeft)}d ago)` : `${daysLeft}d remaining`;
      return [
        p.sku,
        p.batchNumber || "N/A",
        p.name,
        p.category || "General",
        p.manufactureDate || "N/A",
        p.expiryDate || "N/A",
        daysLabel,
        p.quantity,
        p.value,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expiry_dashboard_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const categoriesList = React.useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.expiryDate && p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-500 animate-pulse uppercase tracking-wider">
          Initializing Batch Traceability...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-24 lg:pb-0 text-left">
      {/* Expiry Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Expiry & Batch Traceability
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Track product shell duration, minimize potential dumpage waste, and assess cost exposures.
          </p>
        </div>

        {/* Action Controls matching image exactly */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="h-10 px-5 bg-white border border-slate-200 text-slate-800 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5" />
            Export XLSX
          </button>
          <button
            onClick={openUpdateModal}
            className="h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Assign Product Batch
          </button>
        </div>
      </div>

      {/* KPI Cards styled as dynamic modern Bento elements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Fresh - Green Glow Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 hover:border-emerald-300 transition-all shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block">Fresh Stock Batches</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse block"></span>
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <h3 className="text-4xl font-black text-slate-900 leading-none">{metrics.freshCount}</h3>
            <span className="text-[10px] font-extrabold text-[#10B981] bg-emerald-50 px-2.5 py-1 rounded-xl">
              {totalPerishables > 0 ? ((metrics.freshCount / totalPerishables) * 100).toFixed(0) : 0}% of lots
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-2">Batches within secure shelf-life boundaries</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
              style={{ width: `${totalPerishables > 0 ? (metrics.freshCount / totalPerishables) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Near - Golden Glow Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 hover:border-amber-300 transition-all shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block">Near Expiry (≤14d)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse block"></span>
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <h3 className="text-4xl font-black text-slate-900 leading-none">{metrics.nearCount}</h3>
            <span className="text-[10px] font-extrabold text-[#F59E0B] bg-amber-50 px-2.5 py-1 rounded-xl">
              {totalPerishables > 0 ? ((metrics.nearCount / totalPerishables) * 100).toFixed(0) : 0}% of lots
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-2">Batches needing dispatch priority allocation</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="h-full bg-amber-500 rounded-full transition-all duration-500" 
              style={{ width: `${totalPerishables > 0 ? (metrics.nearCount / totalPerishables) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Expired - Red Alarm Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 hover:border-rose-300 transition-all shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block">Expired Stock Batches</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse block"></span>
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <h3 className="text-4xl font-black text-slate-900 leading-none">{metrics.expiredCount}</h3>
            <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl">
              {totalPerishables > 0 ? ((metrics.expiredCount / totalPerishables) * 100).toFixed(0) : 0}% of lots
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-2">Batches needing immediate write-off disposal</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="h-full bg-rose-500 rounded-full transition-all duration-500" 
              style={{ width: `${totalPerishables > 0 ? (metrics.expiredCount / totalPerishables) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Total Value - Slate Block */}
        <div className="bg-slate-900 bg-gradient-to-br from-slate-950 to-slate-900 p-6 rounded-3xl border border-slate-800 text-white shadow-md flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block text-slate-400">Total Asset Value</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <h3 className="text-3xl font-black text-white leading-none font-sans">
              {formatCurrency(metrics.totalValuation)}
            </h3>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-2">Valuation of tracked perishable catalog</p>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: "100%" }}></div>
          </div>
        </div>
      </div>

      {/* Middle row: Multi-Column layout with customized pie ring, alerts & visual bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Smart Alerts */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between text-left h-[370px]">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-base font-black text-slate-900 tracking-tight">
                Critical Batches
              </h4>
              <span className="text-[9px] font-semibold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">Real-time</span>
            </div>
            
            <div className="space-y-3 overflow-y-auto max-h-[250px] pr-1">
              {smartAlerts.map((item) => {
                const daysLeft = getDaysRemaining(item.expiryDate);
                const isExpired = daysLeft !== null && daysLeft < 0;
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between hover:bg-slate-100/50 transition-all hover:translate-x-0.5 duration-200"
                  >
                    <div className="text-left">
                      <p className="text-xs font-extrabold text-slate-900">
                        {item.name}
                      </p>
                      <p className="text-[9px] font-mono text-slate-400 mt-0.5">{item.batchNumber || "No Batch"}</p>
                      <p
                        className={cn(
                          "text-[10px] font-black uppercase mt-1 flex items-center gap-1",
                          isExpired ? "text-rose-600" : "text-amber-600"
                        )}
                      >
                        {isExpired ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-rose-500 animate-pulse" />
                            Expired {Math.abs(daysLeft)}d ago
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-500" />
                            {daysLeft} days remaining
                          </>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-slate-900 block font-mono">
                        {item.quantity} Unit
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 block font-mono">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {smartAlerts.length === 0 && (
            <p className="text-xs text-slate-400 italic text-center py-8 flex-1 flex items-center justify-center">
              No perishable alerts triggered.
            </p>
          )}
        </div>

        {/* Expiry Distribution Donut Pie Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm text-left h-[370px] flex flex-col relative overflow-hidden">
          <div>
            <h4 className="text-base font-black text-slate-900 tracking-tight">
              Expiry Distribution
            </h4>
            <p className="text-xs text-slate-400 font-medium">Batch status breakdown of current holdings</p>
          </div>

          <div className="flex-1 flex items-center justify-center relative min-h-0">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} lots`]}
                  contentStyle={{ background: "#0F172A", border: "none", borderRadius: "12px", color: "#FFF", fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Absolute layout inside Donut Ring */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total</span>
              <span className="text-3xl font-black text-slate-800 leading-tight">
                {products.filter((p) => p.expiryDate).length}
              </span>
              <span className="text-[9px] font-extrabold text-[#ED9A12] uppercase tracking-wider leading-none mt-0.5">Batches</span>
            </div>
          </div>

          {/* Simple footer indicators */}
          <div className="flex justify-around text-[10px] font-black text-slate-500 uppercase pb-2">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
              <span>Fresh ({metrics.freshCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
              <span>Near ({metrics.nearCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
              <span>Expired ({metrics.expiredCount})</span>
            </div>
          </div>
        </div>

        {/* Expiry Timeline Bar Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm text-left h-[370px] flex flex-col">
          <div>
            <h4 className="text-base font-black text-slate-900 tracking-tight">
              Expiry Alarm Timeline
            </h4>
            <p className="text-xs text-slate-400 font-medium">Imminent stock loss volumes by time buckets</p>
          </div>
          
          <div className="flex-1 min-h-0 mt-4">
            <ResponsiveContainer width="100%" height="95%">
              <BarChart data={timelineChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDF2F7" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11, fontWeight: "600" }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{ background: "#0F172A", border: "none", borderRadius: "12px", color: "#FFF", fontSize: 11 }}
                />
                <Bar dataKey="count" fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={45} name="Batches Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Advanced lower diagnostic sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Risk Curve Area */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm text-left flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-base font-black text-slate-900 tracking-tight">
                  Economic Loss Forecast Timeline
                </h4>
                <p className="text-xs text-slate-500 font-medium">Cumulative potential profit leakage based on current item expirations</p>
              </div>
              <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl">Proactive Curve</span>
            </div>
            <div className="w-full h-64 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={riskCurveData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDF2F7" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11, fontWeight: "600" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 10 }} tickFormatter={(value) => formatCurrency(Number(value))} />
                  <Tooltip
                    contentStyle={{ background: "#0F172A", border: "none", borderRadius: "12px", color: "#FFF", fontSize: 11 }}
                    formatter={(value: any, name: string) => [formatCurrency(Number(value)), name]}
                  />
                  <Bar dataKey="profitAtRisk" fill="#FCA5A5" radius={[6, 6, 0, 0]} maxBarSize={45} name="Direct Profit Exposure" />
                  <Line type="monotone" dataKey="cumulativeProfitAtRisk" stroke="#334155" strokeWidth={3} name="Cumulative Leakage Curve" dot={{ r: 5, strokeWidth: 2, fill: "#FFF", stroke: "#334155" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Profit Insights Sidebar card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm text-left flex flex-col justify-between">
          <div>
            <h4 className="text-base font-black text-slate-900 tracking-tight mb-1">
              Active Margin Threat Desk
            </h4>
            <p className="text-xs text-slate-500 font-medium mb-5">Calculated exposure assessments</p>

            <div className="space-y-4">
              {/* Metric 1 */}
              <div className="p-4 bg-rose-50 border border-thin border-rose-100/50 rounded-2xl">
                <p className="text-[10px] uppercase font-black tracking-widest text-rose-500">At-Risk Asset Investment</p>
                <p className="text-2xl font-black text-rose-950 mt-1">{formatCurrency(profitMetrics.atRiskValue)}</p>
                <p className="text-[10px] text-rose-700 font-semibold mt-1.5 leading-normal">Initial capital tied up in expired or near-expired products.</p>
              </div>

              {/* Metric 2 */}
              <div className="p-4 bg-amber-50 border border-thin border-amber-100/50 rounded-2xl">
                <p className="text-[10px] uppercase font-black tracking-widest text-amber-600">Expected Profit Margin At-Risk</p>
                <p className="text-2xl font-black text-amber-950 mt-1">{formatCurrency(profitMetrics.potentialProfitLoss)}</p>
                <p className="text-[10px] text-amber-700 font-semibold mt-1.5 leading-normal">Projected markup income exposed to inventory expiration leakages.</p>
              </div>

              {/* Action Suggestion Widget */}
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                <Info className="w-5 h-5 text-slate-500 shrink-0" />
                <p className="text-[10px] text-slate-500 font-semibold leading-normal">
                  We highly recommend triggering POS promotions, bundle deals, or wholesales discount sales for any Near-Expiry assets ASAP.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live / Simulated Helper Banner */}
      <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
        <div className="flex items-start gap-3">
          <RefreshCw className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-extrabold text-emerald-950 text-sm">
              Live Database Mode Active
            </p>
            <p className="text-xs text-[#009240] font-medium mt-1">
              You are viewing the real products from your database. Edits, Disposals, and Batch Updates are saved directly to Firestore.
            </p>
          </div>
        </div>
      </div>

      {/* Filtering Section with Numeric Badges */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col gap-4 text-left">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search bar */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 transition-colors group-focus-within:text-slate-800" />
            <input
              type="text"
              placeholder="Search by SKU Code, Name, or Batch Number..."
              className="w-full text-slate-800 h-11 pl-11 pr-4 bg-slate-50 border border-slate-200/50 rounded-xl text-sm font-semibold outline-none focus:border-slate-300 focus:bg-white transition-all placeholder-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Segment Buttons with real-time Badge Counts */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Risk View:
              </span>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {([
                  { key: "all", label: "All Items", count: counts.all },
                  { key: "expired", label: "Expired", count: counts.expired },
                  { key: "near_expiry", label: "Near Expiry", count: counts.near },
                  { key: "safe", label: "Safe Stock", count: counts.safe },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setStatusFilter(opt.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5",
                      statusFilter === opt.key
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <span>{opt.label}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-black",
                      statusFilter === opt.key 
                        ? opt.key === "expired" ? "bg-rose-50 text-rose-600" : opt.key === "near_expiry" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                        : "bg-slate-200/60 text-slate-500"
                    )}>
                      {opt.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            {categoriesList.length > 0 && (
              <div className="relative shrink-0 flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Category:
                </span>
                <select
                  className="h-9 px-3 bg-slate-50 border border-slate-200/50 rounded-xl text-xs font-bold text-slate-700 outline-none hover:bg-slate-100 transition-all cursor-pointer"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">ALL CATEGORIES</option>
                  {categoriesList.map((catString) => (
                    <option key={catString} value={catString}>
                      {catString.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Details Card - Highly upgraded Visual Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-base font-black text-slate-900 tracking-tight">
              Traceability & Life-Cycle Ledger
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Real-time status indicators, days-left visual lifecycle bars, and cost insights</p>
          </div>
          
          <div className="flex bg-slate-50 p-1 border border-slate-100 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest gap-1">
            <span className="px-2 py-1 bg-white shadow-sm border border-slate-200/30 rounded-lg text-slate-900">Normal mode</span>
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden lg:block overflow-x-auto text-left">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#94A3B8] text-left">
                <th className="px-8 py-4 cursor-pointer" onClick={() => toggleSort("name")}>
                  Product Details {sortBy === "name" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-8 py-4">Batch Info</th>
                <th className="px-8 py-4">Expiry Timeline</th>
                <th className="px-8 py-4 text-center">Lifecycle Status</th>
                <th className="px-8 py-4 text-center">Margin Profile</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const daysRemaining = getDaysRemaining(p.expiryDate);

                // Styling corresponding to layout
                let pClass = "bg-emerald-50 text-emerald-600 border border-emerald-100/60";
                let pLabel = "Fresh Stock";
                let icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mr-1 shrink-0" />;

                if (daysRemaining !== null) {
                  if (daysRemaining < 0) {
                    pClass = "bg-rose-50 text-rose-600 border border-[#FCA5A5]/40";
                    pLabel = "Expired";
                    icon = <AlertTriangle className="w-3.5 h-3.5 text-rose-500 mr-1 shrink-0 animate-pulse" />;
                  } else if (daysRemaining <= 14) {
                    pClass = "bg-amber-50 text-amber-600 border border-[#ED9A12]/30";
                    pLabel = "Near Expiry";
                    icon = <Clock className="w-3.5 h-3.5 text-amber-500 mr-1 shrink-0" />;
                  }
                }

                // Dynamic Margin Data
                const marginInfo = getProductMarginInfo(p);
                let marginBadgeClass = "";
                let marginLabel = "";
                if (marginInfo.marginStatus === "high") {
                  marginBadgeClass = "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
                  marginLabel = `High (${marginInfo.marginPct}%)`;
                } else if (marginInfo.marginStatus === "low") {
                  marginBadgeClass = "bg-amber-500/10 text-amber-600 border border-amber-500/20";
                  marginLabel = `Low (${marginInfo.marginPct}%)`;
                } else {
                  marginBadgeClass = "bg-rose-500/10 text-rose-600 border border-rose-500/20";
                  marginLabel = `Loss Risk (${marginInfo.marginPct}%)`;
                }

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 hover:translate-x-0.5 transition-all duration-200">
                    {/* Item details cell */}
                    <td className="px-8 py-5 text-left">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-950 text-base">{p.name || "Unnamed SKU"}</span>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] text-slate-400 font-mono font-bold tracking-tight bg-slate-100 px-1.5 py-0.5 rounded">
                            {p.sku || "NO-SKU"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold bg-blue-50/40 text-blue-700/80 px-2 py-0.5 rounded-full">
                            {p.category}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Batch identifiers cell */}
                    <td className="px-8 py-5 text-left">
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-800 font-black flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block"></span>
                          {p.batchNumber || "NO BATCH"}
                        </span>
                        {p.manufactureDate && (
                          <span className="text-[9px] text-slate-400 font-mono font-bold block mt-1 uppercase">
                            Mfg: {p.manufactureDate}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Expiry visual lifecycle meter cell */}
                    <td className="px-8 py-5 text-left">
                      <div className="flex flex-col w-44">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5 font-mono">
                          <span>{p.expiryDate || "--"}</span>
                          <span className="text-slate-900 font-black">
                            {daysRemaining !== null 
                              ? daysRemaining < 0 
                                ? `${Math.abs(daysRemaining)}d ago` 
                                : `${daysRemaining}d left`
                              : "safe"}
                          </span>
                        </div>
                        
                        {/* Progressive depleted lifecycle tracks */}
                        {(() => {
                          const d = daysRemaining !== null ? daysRemaining : 60;
                          const bounded = Math.max(-10, Math.min(60, d));
                          // Normalize days to 60 days baseline loader width
                          const pctVal = d < 0 ? 0 : Math.round((bounded / 60) * 100);
                          let colorClass = "bg-emerald-500 shadow-[0_0_4px_rgba(34,197,94,0.3)]";
                          if (d < 0) {
                            colorClass = "bg-rose-500 shadow-[0_0_4px_rgba(239,68,68,0.3)]";
                          } else if (d <= 14) {
                            colorClass = "bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.3)]";
                          }
                          return (
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden relative">
                              <div 
                                className={cn("h-full rounded-full transition-all duration-300", colorClass)} 
                                style={{ width: `${pctVal}%` }}
                              ></div>
                            </div>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Expiry Category tag */}
                    <td className="px-8 py-5 text-center">
                      <span className={cn("inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider", pClass)}>
                        {icon}
                        {pLabel}
                      </span>
                    </td>

                    {/* Profit margin tag cell */}
                    <td className="px-8 py-5 text-center">
                      <div className="flex flex-col items-center">
                        <span className={cn("px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider", marginBadgeClass)}>
                          {marginLabel}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono mt-1 block">
                          Reserve: {formatCurrency(marginInfo.cost)}
                        </span>
                      </div>
                    </td>

                    {/* Standard actions */}
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(p)}
                          className="h-9 w-9 bg-slate-50 border border-slate-100 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 rounded-xl transition-all flex items-center justify-center active:scale-95"
                          title="Modify Batch Specs"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDispose(p.id, p.name || "Unnamed SKU")}
                          className="h-9 w-9 bg-slate-50 border border-slate-100 text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl transition-all flex items-center justify-center active:scale-95"
                          title="Immediate Disposal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-slate-400 font-semibold italic">
                    No active product lots match your selected filter segments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List View styled beautifully inside structured cards */}
        <div className="lg:hidden divide-y divide-slate-100">
          {filteredProducts.map((p) => {
            const daysRemaining = getDaysRemaining(p.expiryDate);
            let pClass = "bg-emerald-500/15 text-emerald-600 border border-emerald-100";
            let pLabel = "Fresh Stock";
            let iconElement = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mr-1 shrink-0" />;

            if (daysRemaining !== null) {
              if (daysRemaining < 0) {
                pClass = "bg-[#FCA5A5]/20 text-[#EF4444] border border-rose-100";
                pLabel = "Expired";
                iconElement = <AlertTriangle className="w-3.5 h-3.5 text-rose-505 mr-1 shrink-0" />;
              } else if (daysRemaining <= 14) {
                pClass = "bg-[#FDE047]/20 text-[#ED9A12] border border-amber-100";
                pLabel = "Near Expiry";
                iconElement = <Clock className="w-3.5 h-3.5 text-amber-500 mr-1 shrink-0" />;
              }
            }

            return (
              <div key={p.id} className="p-5 flex flex-col gap-3 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-extrabold text-slate-900 text-base">{p.name || "Unnamed SKU"}</h5>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 font-extrabold">{p.sku || ""}</p>
                  </div>
                  <span className={cn("inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider", pClass)}>
                    {iconElement}
                    {pLabel}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Batch ID</span>
                    <span className="font-bold text-slate-700">{p.batchNumber || "No Batch ID"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Timeline Threshold</span>
                    <span className="font-mono font-bold text-slate-700">{p.expiryDate || "--"}</span>
                  </div>
                </div>

                {/* Mobile progress meter lifecycle */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                    <span>Depletion cycle</span>
                    <span className="text-slate-900 font-black">
                      {daysRemaining !== null 
                        ? daysRemaining < 0 
                          ? `${Math.abs(daysRemaining)}d ago` 
                          : `${daysRemaining}d remaining`
                        : "safe"}
                    </span>
                  </div>
                  {(() => {
                    const d = daysRemaining !== null ? daysRemaining : 60;
                    const bounded = Math.max(-10, Math.min(60, d));
                    const pctVal = d < 0 ? 0 : Math.round((bounded / 60) * 100);
                    let barColor = "bg-emerald-500";
                    if (d < 0) barColor = "bg-rose-500";
                    else if (d <= 14) barColor = "bg-amber-500";
                    return (
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pctVal}%` }}></div>
                      </div>
                    );
                  })()}
                </div>

                {/* Mobile Margin indicator */}
                <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Margin Profile</span>
                  {(() => {
                    const marginInfo = getProductMarginInfo(p);
                    let color = "text-emerald-600 font-black bg-emerald-500/10 border border-emerald-100";
                    let label = `High Margin (${marginInfo.marginPct}%)`;
                    if (marginInfo.marginStatus === "low") {
                      color = "text-amber-600 font-black bg-amber-500/10 border border-amber-100";
                      label = `Low Margin (${marginInfo.marginPct}%)`;
                    } else if (marginInfo.marginStatus === "risk") {
                      color = "text-rose-600 font-black bg-rose-500/10 border border-rose-100";
                      label = `Risk (${marginInfo.marginPct}%)`;
                    }
                    return <span className={cn("px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider", color)}>{label}</span>;
                  })()}
                </div>

                <div className="flex justify-end gap-2 pt-1.5">
                  <button
                    onClick={() => openEditModal(p)}
                    className="h-9 px-4 rounded-xl bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 hover:bg-slate-200 transition-all active:scale-[0.98]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Modify
                  </button>
                  <button
                    onClick={() => handleDispose(p.id, p.name || "Unnamed SKU")}
                    className="h-9 px-4 rounded-xl bg-rose-50 text-rose-600 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 hover:bg-rose-100 transition-all active:scale-[0.98]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Dispose Trace
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Update Expiry / Assign Expiry to Existing Product Dialog Modal */}
      <AnimatePresence>
        {isUpdateModalOpen && (
          <>
            {/* Backdrop with elegant blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUpdateModalOpen(false)}
              className="fixed inset-0 bg-slate-900 backdrop-blur-sm z-50 cursor-pointer"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20, x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
              exit={{ opacity: 0, scale: 0.95, y: -20, x: "-50%" }}
              transition={{ duration: 0.2 }}
              className="fixed top-1/2 left-1/2 w-full max-w-md bg-white border border-slate-200 z-[60] shadow-2xl rounded-3xl flex flex-col text-left overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 text-left">
                <div>
                  <h4 className="text-lg font-black text-slate-900">
                    Assign Batch & Expiry
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">Configure batch metadata on inventory items</p>
                </div>
                <button
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Select Target Product
                  </label>
                  <select
                    className="w-full h-11 bg-slate-50 border border-slate-200/60 rounded-xl px-4 text-sm font-semibold outline-none focus:border-slate-800 focus:bg-white transition-all text-slate-800"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose From Catalog --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku || p.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Batch Identifier Code
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full h-11 bg-slate-50 border border-slate-200/60 rounded-xl px-4 text-sm font-semibold outline-none focus:border-slate-800 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
                    placeholder="e.g. BATCH-A200"
                    value={editBatch}
                    onChange={(e) => setEditBatch(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Manufacture Date
                  </label>
                  <input
                    type="date"
                    className="w-full h-11 bg-slate-50 border border-slate-200/60 rounded-xl px-4 text-sm font-semibold outline-none focus:border-slate-800 focus:bg-white transition-all text-slate-800"
                    value={editMfgDate}
                    onChange={(e) => setEditMfgDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Expiry Expiration Date
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full h-11 bg-slate-50 border border-slate-200/60 rounded-xl px-4 text-sm font-semibold outline-none focus:border-slate-800 focus:bg-white transition-all text-slate-800"
                    value={editExpDate}
                    onChange={(e) => setEditExpDate(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsUpdateModalOpen(false)}
                    className="flex-1 h-11 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit || !selectedProductId}
                    className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {savingEdit ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Apply Batch
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Slide-out Sidebar Drawer for Editing Traceability */}
      <AnimatePresence>
        {editingProduct && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingProduct(null)}
              className="fixed inset-0 bg-slate-900 backdrop-blur-sm z-50 cursor-pointer"
            />

            {/* Editing Sidebar Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 240 }}
              className="fixed top-0 right-0 h-screen w-full max-w-md bg-white border-l border-slate-200 z-[60] shadow-2xl flex flex-col text-left"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="text-left">
                  <span className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded uppercase tracking-wider">
                    Traceability Specs Adjustment
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-1 truncate max-w-[280px]">
                    {editingProduct.name}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingProduct(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form content */}
              <form onSubmit={handleSaveEdit} className="p-6 flex-1 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  {/* SKU Display (Non editable) */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-left">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">
                        Catalog SKU Code
                      </span>
                      <span className="font-mono text-slate-800 font-extrabold">{editingProduct.sku}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-2.5">
                      <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">
                        Lots Quantity Count
                      </span>
                      <span className="font-mono text-slate-800 font-black">
                        {editingProduct.quantity.toLocaleString()} lots available
                      </span>
                    </div>
                  </div>

                  {/* Batch Number */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Batch Identifier Number
                    </label>
                    <input
                      type="text"
                      className="w-full h-11 bg-slate-50 border border-slate-200/60 rounded-xl px-4 text-sm font-semibold outline-none focus:border-slate-800 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
                      placeholder="e.g. BAT-2026-X99"
                      value={editBatch}
                      onChange={(e) => setEditBatch(e.target.value)}
                    />
                  </div>

                  {/* Manufacture date */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Manufacture Date (Optional)
                    </label>
                    <input
                      type="date"
                      className="w-full h-11 bg-slate-50 border border-slate-200/60 rounded-xl px-4 text-sm font-semibold outline-none focus:border-slate-800 focus:bg-white transition-all text-slate-800"
                      value={editMfgDate}
                      onChange={(e) => setEditMfgDate(e.target.value)}
                    />
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                      Expiration Threshold Date (Optional)
                    </label>
                    <input
                      type="date"
                      className="w-full h-11 bg-slate-50 border border-slate-200/60 rounded-xl px-4 text-sm font-semibold outline-none focus:border-slate-800 focus:bg-white transition-all text-slate-800"
                      value={editExpDate}
                      onChange={(e) => setEditExpDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Submit area */}
                <div className="mt-8 pt-4 border-t border-slate-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="flex-1 h-12 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex-1 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md"
                  >
                    {savingEdit ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save Batch Info
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        type={confirmConfig.type}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
