import React, { useState, useMemo, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  Building,
  ShoppingBag,
  Calendar,
  ChevronDown,
  Download,
  Award,
  ShieldAlert,
  PieChart as PieChartIcon,
  BarChart3,
  LineChart as LineChartIcon,
  Table,
  Filter,
  ArrowUpRight,
  Percent,
  Info,
  Layers,
  Search,
  X,
  FileText,
  Plus,
  RefreshCw,
  Briefcase,
  Layers3,
  CheckCircle,
  HelpCircle,
  TrendingDown,
  ArrowDownRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
  AreaChart,
  Area,
} from "recharts";
import { useSettings } from "../../contexts/SettingsContext";
import { cn } from "../../lib/utils";
import { collection, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Loader2 } from "lucide-react";

// Define TypeScript structures for Spend Analysis
interface SpendItem {
  id: string;
  supplier: string;
  category: "IT" | "Raw Materials" | "Marketing" | "Facilities" | "Office Supplies";
  amount: number;
  date: string; // YYYY-MM-DD
  department: string;
  isManaged: boolean; // Managed by contract or Maverick
  description: string;
}

// Generate Date ranges relative to today.
const getRelativeDateString = (daysAgo: number) => {
  const today = new Date();
  today.setDate(today.getDate() - daysAgo);
  return today.toISOString().split("T")[0];
};

// Initial realistic dataset of 25 procurement transactions
const INITIAL_SPEND_DATA: SpendItem[] = [
  {
    id: "tx-sp-1",
    supplier: "Amazon Web Services (AWS)",
    category: "IT",
    amount: 145000,
    date: getRelativeDateString(12),
    department: "Engineering",
    isManaged: true,
    description: "Cloud Compute, VPC, and S3 Enterprise Storage Sinks",
  },
  {
    id: "tx-sp-2",
    supplier: "Global Minerals & Steel Corp",
    category: "Raw Materials",
    amount: 98000,
    date: getRelativeDateString(28),
    department: "Operations",
    isManaged: true,
    description: "High-grade Carbon Structural Steel Sheets & Tubes",
  },
  {
    id: "tx-sp-3",
    supplier: "Salesforce Systems",
    category: "IT",
    amount: 72000,
    date: getRelativeDateString(45),
    department: "Sales & Account Support",
    isManaged: true,
    description: "Enterprise CRM Annual License Seat Renewals",
  },
  {
    id: "tx-sp-4",
    supplier: "Deloitte Professional Services",
    category: "Professional Services" as any, // fallback to standard category
    amount: 58000,
    date: getRelativeDateString(72),
    department: "Finance",
    isManaged: true,
    description: "Tax audit and compliance consulting strategy roadmap",
  },
  {
    id: "tx-sp-5",
    supplier: "Oracle Database Core",
    category: "IT",
    amount: 52000,
    date: getRelativeDateString(90),
    department: "Engineering",
    isManaged: true,
    description: "High Availability Licensing and Support Fees",
  },
  {
    id: "tx-sp-6",
    supplier: "HubSpot Software",
    category: "Marketing",
    amount: 41000,
    date: getRelativeDateString(110),
    department: "Marketing",
    isManaged: true,
    description: "Inbound Marketing Engine & Multi-Channel Campaigns",
  },
  {
    id: "tx-sp-7",
    supplier: "Google Workspace Hub",
    category: "IT",
    amount: 32000,
    date: getRelativeDateString(140),
    department: "Finance & HR",
    isManaged: true,
    description: "Premium Productivity Mailbox & Collaborative Drives",
  },
  {
    id: "tx-sp-8",
    supplier: "Chevron Fleet Fuels",
    category: "Facilities",
    amount: 29000,
    date: getRelativeDateString(160),
    department: "Logistics",
    isManaged: true,
    description: "Direct Bulk Diesel & Unmanned Site Fuel Dispensations",
  },
  {
    id: "tx-sp-9",
    supplier: "Federal Express (FedEx)",
    category: "Facilities", // standard categories only
    amount: 24000,
    date: getRelativeDateString(15),
    department: "Logistics",
    isManaged: true,
    description: "Air express distribution of critical client samples",
  },
  {
    id: "tx-sp-10",
    supplier: "Cisco Enterprise Networking",
    category: "IT",
    amount: 21000,
    date: getRelativeDateString(185),
    department: "Engineering",
    isManaged: true,
    description: "Core routers and high-throughput switches",
  },
  {
    id: "tx-sp-11",
    supplier: "Cushman & Wakefield Rentals",
    category: "Facilities",
    amount: 19500,
    date: getRelativeDateString(82),
    department: "Operations",
    isManaged: true,
    description: "Spillover warehouse leasing - Zone H Facility",
  },
  {
    id: "tx-sp-12",
    supplier: "Waste Management Inc",
    category: "Facilities",
    amount: 17000,
    date: getRelativeDateString(210),
    department: "Facilities",
    isManaged: true,
    description: "Hazardous waste containment clearance and recycle",
  },
  {
    id: "tx-sp-13",
    supplier: "Adobe Enterprise Creative",
    category: "IT",
    amount: 14800,
    date: getRelativeDateString(240),
    department: "Marketing",
    isManaged: false, // MAVERICK SPEND
    description: "Photoshop and Acrobat Pro individual team licenses (Direct billing)",
  },
  {
    id: "tx-sp-14",
    supplier: "Zoom Video Channels",
    category: "IT",
    amount: 12500,
    date: getRelativeDateString(60),
    department: "HR & Internal Admins",
    isManaged: false, // MAVERICK
    description: "HQ webinar subscriptions and global call channels",
  },
  {
    id: "tx-sp-15",
    supplier: "Staples Business Center",
    category: "Office Supplies",
    amount: 9200,
    date: getRelativeDateString(310),
    department: "HR",
    isManaged: true,
    description: "Mesh executive chairs and acoustic partition panels",
  },
  {
    id: "tx-sp-16",
    supplier: "Slack Technologies LLC",
    category: "IT",
    amount: 8400,
    date: getRelativeDateString(270),
    department: "Engineering",
    isManaged: false, // MAVERICK SPEND
    description: "Ad-hoc corporate Slack chat workspaces for R&D testers",
  },
  {
    id: "tx-sp-17",
    supplier: "Aramark Catering Services",
    category: "Facilities",
    amount: 7800,
    date: getRelativeDateString(290),
    department: "HR",
    isManaged: true,
    description: "Annual stakeholder general meeting banquet service",
  },
  {
    id: "tx-sp-18",
    supplier: "Office Depot Core Supplies",
    category: "Office Supplies",
    amount: 4500,
    date: getRelativeDateString(25),
    department: "HR & Administration",
    isManaged: true,
    description: "Double-A copier paper and ink jet replacements",
  },
  {
    id: "tx-sp-19",
    supplier: "W.B. Mason Co.",
    category: "Office Supplies",
    amount: 3100,
    date: getRelativeDateString(325),
    department: "Administration",
    isManaged: false, // MAVERICK SPEND
    description: "Over-the-counter coffee beans and breakroom syrups",
  },
  {
    id: "tx-sp-20",
    supplier: "Grainger Industrial Fittings",
    category: "Raw Materials",
    amount: 2200,
    date: getRelativeDateString(150),
    department: "Operations",
    isManaged: true,
    description: "Stainless safety valves & pressure relief gauges",
  },
  {
    id: "tx-sp-21",
    supplier: "McMaster-Carr Components",
    category: "Raw Materials",
    amount: 1850,
    date: getRelativeDateString(190),
    department: "Operations",
    isManaged: false, // MAVERICK SPEND
    description: "Emergency threaded rods and coupling nuts",
  },
  {
    id: "tx-sp-22",
    supplier: "Local Office Furnishings",
    category: "Office Supplies",
    amount: 1400,
    date: getRelativeDateString(335),
    department: "Administration",
    isManaged: false, // MAVERICK SPEND
    description: "Whiteboard easel and marker packs for Annex room",
  },
  {
    id: "tx-sp-23",
    supplier: "DHL Global Shipping",
    category: "Facilities", // standard categories
    amount: 980,
    date: getRelativeDateString(4),
    department: "Operations",
    isManaged: true,
    description: "Document courier to legal partners overseas",
  },
  {
    id: "tx-sp-24",
    supplier: "Starbucks Coffee Retail",
    category: "Office Supplies",
    amount: 550,
    date: getRelativeDateString(8),
    department: "Marketing",
    isManaged: false, // MAVERICK SPEND
    description: "Marketing workshop coffee catering direct expense",
  },
  {
    id: "tx-sp-25",
    supplier: "Quick Print Solutions",
    category: "Marketing",
    amount: 430,
    date: getRelativeDateString(38),
    department: "Marketing",
    isManaged: false, // MAVERICK SPEND
    description: "Laminated promotional brochures for trade show",
  },
];

export function SpendAnalysis() {
  const { profile, currency } = useSettings();

  // Internal component states
  const [spendItems, setSpendItems] = useState<SpendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [abcFilter, setAbcFilter] = useState<"ALL" | "A" | "B" | "C">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<"3" | "6" | "12" | "ALL">("12");

  useEffect(() => {
    if (!profile?.companyId) {
      setLoading(false);
      return;
    }
    const path = `companies/${profile.companyId}/spend_data`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      setSpendItems(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error loading spend items:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, [profile?.companyId]);
  
  // Sorting parameters
  const [sortBy, setSortBy] = useState<"supplier" | "category" | "amount" | "abcClass" | "date">("amount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Form State for Adding an Item
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState("");
  const [newCategory, setNewCategory] = useState<"IT" | "Raw Materials" | "Marketing" | "Facilities" | "Office Supplies">("IT");
  const [newAmount, setNewAmount] = useState("");
  const [newDept, setNewDept] = useState("Engineering");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newIsManaged, setNewIsManaged] = useState(true);
  const [newDesc, setNewDesc] = useState("");

  // Filter items first by date range
  const dateFilteredItems = useMemo(() => {
    return spendItems.filter((item) => {
      if (dateFilter === "ALL") return true;
      const months = parseInt(dateFilter);
      const limitDate = new Date();
      limitDate.setMonth(limitDate.getMonth() - months);
      const itemDate = new Date(item.date);
      return itemDate >= limitDate;
    });
  }, [spendItems, dateFilter]);

  // Compute ABC categorization dynamically on currently date-filtered data
  // ABC categorization rules:
  // 1. Sort items by spend descending.
  // 2. Sum overall value.
  // 3. Keep running total and flag category: Group A is the top 75% of spend, Group B is next 15-20% (up to 95%), Group C is the rest.
  const dynamicAbcItems = useMemo(() => {
    const sorted = [...dateFilteredItems].sort((a, b) => b.amount - a.amount);
    const totalSelectedSpend = sorted.reduce((sum, item) => sum + item.amount, 0);
    
    let cumulativeSum = 0;
    return sorted.map((item) => {
      cumulativeSum += item.amount;
      const pctOfTotal = totalSelectedSpend > 0 ? (item.amount / totalSelectedSpend) * 100 : 0;
      const cumulativePct = totalSelectedSpend > 0 ? (cumulativeSum / totalSelectedSpend) * 100 : 0;

      let abcClass: "A" | "B" | "C" = "C";
      // standard boundary thresholds (A: top 75%, B: next 20%, C: remaining 5%)
      if (cumulativePct <= 75) {
        abcClass = "A";
      } else if (cumulativePct <= 95) {
        abcClass = "B";
      } else {
        abcClass = "C";
      }

      return {
        ...item,
        abcClass,
        percentageOfTotal: pctOfTotal,
        cumulativePct,
      };
    });
  }, [dateFilteredItems]);

  // Apply visual search and filter states to dynamic calculated set
  const finalFilteredItems = useMemo(() => {
    let list = [...dynamicAbcItems];

    // Search query match (Supplier or Department or Details)
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (i) =>
          i.supplier.toLowerCase().includes(q) ||
          i.department.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }

    // Interactive chart filter / Clickable ABC
    if (abcFilter !== "ALL") {
      list = list.filter((i) => i.abcClass === abcFilter);
    }

    // Category filter dropdown
    if (categoryFilter !== "ALL") {
      list = list.filter((i) => i.category === categoryFilter);
    }

    // Department filter dropdown
    if (departmentFilter !== "ALL") {
      list = list.filter((i) => i.department === departmentFilter);
    }

    // Sort matching user commands
    list.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === "amount") {
        valA = a.amount;
        valB = b.amount;
      } else if (sortBy === "supplier") {
        valA = a.supplier.toLowerCase();
        valB = b.supplier.toLowerCase();
      } else if (sortBy === "date") {
        valA = new Date(a.date).getTime();
        valB = new Date(b.date).getTime();
      } else if (sortBy === "abcClass") {
        valA = a.abcClass;
        valB = b.abcClass;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [dynamicAbcItems, searchTerm, abcFilter, categoryFilter, departmentFilter, sortBy, sortOrder]);

  // Derived Statistics (KPI computation)
  const metrics = useMemo(() => {
    const totalSpend = dateFilteredItems.reduce((currSum, i) => currSum + i.amount, 0);
    const managedSpend = dateFilteredItems.filter((i) => i.isManaged).reduce((currSum, i) => currSum + i.amount, 0);
    const maverickSpend = dateFilteredItems.filter((i) => !i.isManaged).reduce((currSum, i) => currSum + i.amount, 0);
    
    const spendUnderManagementPct = totalSpend > 0 ? (managedSpend / totalSpend) * 100 : 0;
    const maverickSpendPct = totalSpend > 0 ? (maverickSpend / totalSpend) * 100 : 0;

    // Supplier rankings (Rank cumulative spending)
    const supplierMap: { [name: string]: number } = {};
    dateFilteredItems.forEach((item) => {
      supplierMap[item.supplier] = (supplierMap[item.supplier] || 0) + item.amount;
    });

    const topSuppliers = Object.entries(supplierMap)
      .map(([name, sum]) => ({ name, sum }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 3);

    return {
      totalSpend,
      spendUnderManagementPct,
      maverickSpendPct,
      top3Suppliers: topSuppliers,
    };
  }, [dateFilteredItems]);

  // Dynamic ABC metrics aggregates
  const abcMetrics = useMemo(() => {
    let aTotal = 0;
    let bTotal = 0;
    let cTotal = 0;

    let aCount = 0;
    let bCount = 0;
    let cCount = 0;

    dynamicAbcItems.forEach((i) => {
      if (i.abcClass === "A") {
        aTotal += i.amount;
        aCount++;
      } else if (i.abcClass === "B") {
        bTotal += i.amount;
        bCount++;
      } else {
        cTotal += i.amount;
        cCount++;
      }
    });

    const overall = aTotal + bTotal + cTotal;

    return {
      A: { total: aTotal, count: aCount, pct: overall > 0 ? (aTotal / overall) * 100 : 0 },
      B: { total: bTotal, count: bCount, pct: overall > 0 ? (bTotal / overall) * 100 : 0 },
      C: { total: cTotal, count: cCount, pct: overall > 0 ? (cTotal / overall) * 100 : 0 },
    };
  }, [dynamicAbcItems]);

  // Format currencies nicely
  const formatCurrencyVal = (val: number) => {
    const symbol = currency || "$";
    if (val >= 1000000) {
      return `${symbol}${(val / 1000000).toFixed(2)}M`;
    }
    if (val >= 1000) {
      return `${symbol}${(val / 1000).toFixed(1)}K`;
    }
    return `${symbol}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  // Recharts Pie Dataset
  const pieChartData = useMemo(() => {
    return [
      { name: "A - High Spend", value: Math.round(abcMetrics.A.total), rawPct: abcMetrics.A.pct, count: abcMetrics.A.count, color: "#EF4444" },
      { name: "B - Medium Spend", value: Math.round(abcMetrics.B.total), rawPct: abcMetrics.B.pct, count: abcMetrics.B.count, color: "#F59E0B" },
      { name: "C - Low Spend", value: Math.round(abcMetrics.C.total), rawPct: abcMetrics.C.pct, count: abcMetrics.C.count, color: "#10B981" },
    ];
  }, [abcMetrics]);

  // Recharts Pareto cumulative bar/line data
  const paretoChartData = useMemo(() => {
    // Show top 12 transactions to keep it neat
    return dynamicAbcItems.slice(0, 12).map((item) => {
      return {
        supplierName: item.supplier.split(" (")[0].substring(0, 15),
        spendAmount: item.amount,
        cumulativePercentage: Math.round(item.cumulativePct),
      };
    });
  }, [dynamicAbcItems]);

  // Category Breakdown Dataset
  const categoryChartData = useMemo(() => {
    const categoriesMap: { [cat: string]: number } = {};
    dateFilteredItems.forEach((item) => {
      categoriesMap[item.category] = (categoriesMap[item.category] || 0) + item.amount;
    });

    return Object.entries(categoriesMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [dateFilteredItems]);

  // Time Series Dataset (last 12 months trends)
  const timeSeriesChartData = useMemo(() => {
    // Generate an array of 12 month strings backward from today
    const monthsArray: { label: string; yearMonth: string; total: number }[] = [];
    const today = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthsArray.push({ label, yearMonth, total: 0 });
    }

    // Group items into month buckets
    dateFilteredItems.forEach((item) => {
      const itemDate = new Date(item.date);
      const yearMonth = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, "0")}`;
      const bucket = monthsArray.find((m) => m.yearMonth === yearMonth);
      if (bucket) {
        bucket.total += item.amount;
      }
    });

    return monthsArray;
  }, [dateFilteredItems]);

  // Treemap data layout helpers: Render Top 8 Suppliers directly in a beautiful bento canvas tree
  const treemapSuppliers = useMemo(() => {
    const list = [...dynamicAbcItems];
    // Group spend by supplier name
    const supplierMap: { [name: string]: { amount: number; category: string; abc: "A" | "B" | "C" } } = {};
    list.forEach((item) => {
      if (!supplierMap[item.supplier]) {
        supplierMap[item.supplier] = { amount: 0, category: item.category, abc: item.abcClass };
      }
      supplierMap[item.supplier].amount += item.amount;
    });

    const sortedSupplierEntries = Object.entries(supplierMap)
      .map(([name, info]) => ({
        name,
        amount: info.amount,
        category: info.category,
        abc: info.abc,
      }))
      .sort((a, b) => b.amount - a.amount);

    const sumTopValue = sortedSupplierEntries.reduce((acc, curr) => acc + curr.amount, 0);

    return sortedSupplierEntries.map((supplier) => ({
      ...supplier,
      pctOfTotal: sumTopValue > 0 ? (supplier.amount / sumTopValue) * 100 : 0,
    }));
  }, [dynamicAbcItems]);

  // All available dropdown parameters for filtering
  const allCategories = useMemo(() => {
    const set = new Set(spendItems.map((i) => i.category));
    return Array.from(set);
  }, [spendItems]);

  const allDepartments = useMemo(() => {
    const set = new Set(spendItems.map((i) => i.department));
    return Array.from(set).sort();
  }, [spendItems]);

  // CSV Report Downloads
  const handleExportCSV = () => {
    if (finalFilteredItems.length === 0) return;
    const headers = ["ID", "Supplier", "Category", "Amount (USD)", "ABC Class", "Date", "Department", "% of Total", "Compliance Status", "Description"];
    const rows = finalFilteredItems.map((item) => [
      item.id,
      item.supplier,
      item.category,
      item.amount,
      item.abcClass,
      item.date,
      item.department,
      item.percentageOfTotal.toFixed(2) + "%",
      item.isManaged ? "Spend Under Management" : "Maverick Spend",
      item.description,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.map((val) => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `procurement_spend_abc_analysis_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit Handler for Adding a Spend Item
  const handleAddSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !newSupplier || !newAmount || parseFloat(newAmount) <= 0) return;

    try {
      const path = `companies/${profile.companyId}/spend_data`;
      await addDoc(collection(db, path), {
        supplier: newSupplier,
        category: newCategory,
        amount: parseFloat(newAmount),
        date: newDate,
        department: newDept,
        isManaged: newIsManaged,
        description: newDesc || `${newCategory} Procurement allocation`,
        createdAt: new Date().toISOString()
      });

      // reset forms
      setNewSupplier("");
      setNewAmount("");
      setNewDesc("");
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error adding spend transaction:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-left">
      
      {/* Primary Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Layers3 className="w-8 h-8 text-rose-500 shrink-0" />
            Spend Analysis Dashboard (ABC Rule)
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Perform ABC classification, isolate high value assets, and discover Maverick leakages.
          </p>
        </div>

        {/* Global Action Handlers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Date Range Filters */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
            {([
              { label: "3M", val: "3" },
              { label: "6M", val: "6" },
              { label: "12M", val: "12" },
              { label: "All Time", val: "ALL" },
            ] as const).map((opt) => (
              <button
                key={opt.val}
                onClick={() => setDateFilter(opt.val)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  dateFilter === opt.val
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="h-10 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            onClick={() => setIsFormOpen(true)}
            className="h-10 px-5 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Log Spend Entry
          </button>
        </div>
      </div>

      {/* Interactive Form Drawer Backdrop */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Add Procurement Transaction</h3>
                  <p className="text-slate-400 text-xs font-semibold">Log standard procurement expenditures directly</p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddSpend} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Amazon Web Services, Staples, DHL"
                    className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-slate-400 transition-all"
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                      Spend Category *
                    </label>
                    <select
                      className="w-full h-11 px-3 border border-slate-200 rounded-xl text-sm font-semibold bg-white cursor-pointer outline-none focus:border-slate-400"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                    >
                      <option value="IT">IT</option>
                      <option value="Raw Materials">Raw Materials</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Facilities">Facilities</option>
                      <option value="Office Supplies">Office Supplies</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                      Amount Spend (USD) *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="USD"
                        className="w-full h-11 pl-9 pr-4 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                      Allocated Department
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Engineering, Sales"
                      className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-slate-400 transition-all"
                      value={newDept}
                      onChange={(e) => setNewDept(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                      Transaction Date
                    </label>
                    <input
                      type="date"
                      required
                      className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-slate-400 transition-all"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Maverick compliance toggle key */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-900">Spend Under Management (SUM)</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Is this expenditure certified on catalog contract?</p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    checked={newIsManaged}
                    onChange={(e) => setNewIsManaged(e.target.checked)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                    Procurement Details / Item Notes
                  </label>
                  <textarea
                    placeholder="Enter short description or SKU allocation logs..."
                    rows={2}
                    className="w-full py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-slate-400 transition-all resize-none"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md"
                  >
                    Confirm Log
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* KPI Stats Block - Responsive Bento Grid layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Spend */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block">
              Total Spend
            </span>
            <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-slate-200 transition-colors">
              <DollarSign className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-950 font-sans tracking-tight">
              {formatCurrencyVal(metrics.totalSpend)}
            </h3>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] font-extrabold text-[#EF4444] bg-rose-50 px-2.5 py-1 rounded-lg">
                ABC Controlled
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{spendItems.length} Entries</span>
            </div>
          </div>
        </div>

        {/* Spend Under Management */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block">
              Spend Under Contract
            </span>
            <div className="p-2 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
              <Award className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-emerald-600 font-sans tracking-tight">
              {metrics.spendUnderManagementPct.toFixed(1)}%
            </h3>
            <div className="w-full bg-slate-100 h-1 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${metrics.spendUnderManagementPct}%` }}
              ></div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold mt-2.5">Compliant purchase transactions</p>
        </div>

        {/* Maverick Leakage Estimate */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block text-rose-500 font-bold">
              Maverick Leakage
            </span>
            <div className="p-2 bg-rose-50 rounded-xl group-hover:bg-rose-100 transition-colors animate-pulse">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-rose-500 font-sans tracking-tight">
              {metrics.maverickSpendPct.toFixed(1)}%
            </h3>
            <div className="w-full bg-slate-100 h-1 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${metrics.maverickSpendPct}%` }}
              ></div>
            </div>
          </div>
          <p className="text-[10px] text-[#009240] font-semibold mt-2.5">Off-contract direct billing purchases</p>
        </div>

        {/* Top Supplier Display */}
        <div className="bg-slate-900 bg-gradient-to-br from-slate-950 to-slate-900 p-5 rounded-3xl border border-slate-800 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block text-slate-400">
              Top Supplier Spend
            </span>
            <Building className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3.5 space-y-1">
            {metrics.top3Suppliers.length > 0 ? (
              metrics.top3Suppliers.map((sup, index) => (
                <div key={sup.name} className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-slate-200 truncate pr-2 max-w-[130px]">
                    {index + 1}. {sup.name.split(" (")[0]}
                  </span>
                  <span className="font-mono font-bold text-rose-300 shrink-0">
                    {formatCurrencyVal(sup.sum)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[10px] italic text-slate-400">No active suppliers</p>
            )}
          </div>
          <p className="text-[9px] text-slate-400 font-semibold mt-3">Reflecting selected dates</p>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Donut ABC Distribution */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col relative h-[380px]">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-base font-black text-slate-900 tracking-tight">
                ABC Class Distribution
              </h4>
              <Layers className="w-4.5 h-4.5 text-slate-400" />
            </div>
            <p className="text-xs text-slate-400 font-medium">Click on sections to filter the ledger list below</p>
          </div>

          <div className="flex-1 flex items-center justify-center relative min-h-0">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={92}
                  paddingAngle={4}
                  dataKey="value"
                  className="cursor-pointer"
                  onClick={(entry) => {
                    if (entry && entry.name) {
                      const letter = String(entry.name).charAt(0) as "A" | "B" | "C";
                      setAbcFilter(abcFilter === letter ? "ALL" : letter);
                    }
                  }}
                >
                  {pieChartData.map((entry, index) => {
                    const letter = String(entry.name).charAt(0);
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        stroke={abcFilter === letter ? "#0F172A" : "transparent"}
                        strokeWidth={3}
                        opacity={abcFilter === "ALL" || abcFilter === letter ? 1 : 0.4}
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [formatCurrencyVal(val), "Calculated Spend"]}
                  contentStyle={{ background: "#0F172A", border: "none", borderRadius: "12px", color: "#FFF", fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centered overall layout inside donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Overall Spend</span>
              <span className="text-2xl font-black text-slate-900 leading-tight">
                {formatCurrencyVal(metrics.totalSpend)}
              </span>
              <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">
                {abcFilter !== "ALL" ? `FILTERING CAT ${abcFilter}` : "ALL PIECES"}
              </span>
            </div>
          </div>

          {/* Indicators Legend block with interactive buttons */}
          <div className="flex items-center justify-around text-[10px] font-black bg-slate-50 py-2.5 rounded-2xl border border-slate-100">
            <button
              onClick={() => setAbcFilter(abcFilter === "A" ? "ALL" : "A")}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all",
                abcFilter === "A" ? "bg-rose-100 text-rose-700" : "text-rose-600"
              )}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]"></span>
              <span>A ({abcMetrics.A.pct.toFixed(0)}%)</span>
            </button>
            <button
              onClick={() => setAbcFilter(abcFilter === "B" ? "ALL" : "B")}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all",
                abcFilter === "B" ? "bg-amber-100 text-amber-700" : "text-amber-600"
              )}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
              <span>B ({abcMetrics.B.pct.toFixed(0)}%)</span>
            </button>
            <button
              onClick={() => setAbcFilter(abcFilter === "C" ? "ALL" : "C")}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all",
                abcFilter === "C" ? "bg-emerald-100 text-emerald-700" : "text-emerald-600"
              )}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
              <span>C ({abcMetrics.C.pct.toFixed(0)}%)</span>
            </button>
          </div>
        </div>

        {/* Chart 2: Pareto Chart cumulative bar line */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col h-[380px] lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-black text-slate-900 tracking-tight">
                ABC Pareto Cumulative Curve
              </h4>
              <p className="text-xs text-slate-400 font-medium">80/20 Rule: Spends sorted descending, mapped against total contribution curve</p>
            </div>
            <Award className="w-4.5 h-4.5 text-slate-400 shrink-0" />
          </div>

          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="95%">
              <ComposedChart data={paretoChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} />
                <XAxis dataKey="supplierName" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 9, fontWeight: "600" }} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 9 }} tickFormatter={(v) => formatCurrencyVal(v)} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: "#0F172A", border: "none", borderRadius: "12px", color: "#FFF", fontSize: 11 }}
                  formatter={(val: any, name: string) => [name === "cumulativePercentage" ? `${val}%` : formatCurrencyVal(val), name === "cumulativePercentage" ? "Cumulative Contribution" : "Direct Spend"]}
                />
                <Bar yAxisId="left" dataKey="spendAmount" fill="#FDA4AF" radius={[6, 6, 0, 0]} maxBarSize={35} name="Direct Spend" />
                <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" stroke="#334155" strokeWidth={3} dot={{ r: 4, fill: "#FFF", stroke: "#334155", strokeWidth: 2 }} name="cumulativePercentage" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Interactive Bento Box Supplier "Treemap" Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Treemap Panel */}
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-black text-slate-900 tracking-tight">
                  Supplier Spend Treemap Allocation
                </h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Visual space reflects proportional procurement spend with active color designations.
                </p>
              </div>
              <Briefcase className="w-4.5 h-4.5 text-slate-400 shrink-0" />
            </div>

            {/* Custom Interactive HTML Treemap Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 mt-4 h-64">
              {/* Col Span 3: Dominant Vendor (AWS) */}
              {treemapSuppliers.length > 0 && (
                <div 
                  className={cn(
                    "sm:col-span-3 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.01] hover:shadow-sm cursor-pointer relative overflow-hidden text-white",
                    treemapSuppliers[0].abc === "A" ? "bg-rose-500" : treemapSuppliers[0].abc === "B" ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  onClick={() => setSearchTerm(treemapSuppliers[0].name)}
                >
                  <div className="absolute right-[-10%] bottom-[-10%] opacity-15">
                    <Building className="w-24 h-24" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-widest bg-white/20 px-2 py-0.5 rounded-lg">
                      Category {treemapSuppliers[0].abc}
                    </span>
                    <h5 className="text-base xl:text-lg font-black tracking-tight mt-2 truncate line-clamp-1">
                      {treemapSuppliers[0].name}
                    </h5>
                    <p className="text-[10px] text-white/80 font-medium">{treemapSuppliers[0].category} Allocation</p>
                  </div>
                  <div className="flex justify-between items-baseline mt-4 z-10">
                    <span className="text-2xl font-black font-sans">{formatCurrencyVal(treemapSuppliers[0].amount)}</span>
                    <span className="text-[10px] font-bold text-white/90 bg-white/10 px-2 py-0.5 rounded-lg">{treemapSuppliers[0].pctOfTotal.toFixed(0)}% of Top</span>
                  </div>
                </div>
              )}

              {/* Col Span 2: Secondary Vendor (Global Minerals) */}
              <div className="sm:col-span-3 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3 h-full">
                  {treemapSuppliers.slice(1, 5).map((sup) => (
                    <div
                      key={sup.name}
                      onClick={() => setSearchTerm(sup.name)}
                      className={cn(
                        "rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.01] cursor-pointer text-left border relative overflow-hidden shadow-xs",
                        sup.abc === "A" 
                          ? "bg-rose-50/50 border-rose-200 text-rose-950" 
                          : sup.abc === "B"
                          ? "bg-amber-50/50 border-amber-200 text-amber-950"
                          : "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                      )}
                    >
                      <div className="truncate pr-1">
                        <span className={cn(
                          "text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                          sup.abc === "A" ? "bg-rose-100 text-rose-700" : sup.abc === "B" ? "bg-amber-100/50 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          Cat {sup.abc}
                        </span>
                        <h6 className="text-[11px] font-black tracking-tight mt-1.5 truncate leading-tight">
                          {sup.name.split(" (")[0]}
                        </h6>
                      </div>
                      <div className="mt-3">
                        <span className="text-sm font-black block font-sans">{formatCurrencyVal(sup.amount)}</span>
                        <span className="text-[8px] text-slate-400 font-semibold">{sup.pctOfTotal.toFixed(0)}% share</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown list & Mini bar chart */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between h-80 lg:h-auto">
          <div>
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-base font-black text-slate-900 tracking-tight">
                Spend Category Shares
              </h4>
              <BarChart3 className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-400 font-medium">Distribution by core procurement fields</p>

            <div className="space-y-3.5 mt-4">
              {categoryChartData.map((cat, index) => {
                const totalSpend = metrics.totalSpend;
                const pct = totalSpend > 0 ? (cat.value / totalSpend) * 100 : 0;
                
                // Color mapping
                let barColor = "bg-rose-400";
                if (index === 1) barColor = "bg-amber-400";
                else if (index === 2) barColor = "bg-emerald-400";
                else if (index > 2) barColor = "bg-slate-400";

                return (
                  <div key={cat.name} className="space-y-1 text-left">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{cat.name}</span>
                      <div className="space-x-1">
                        <span className="font-mono text-slate-900">{formatCurrencyVal(cat.value)}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                    
                    {/* Visual Segment Line bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-300", barColor)} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Time Series Monthly Spend Trend Card */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs text-left">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-base font-black text-slate-900 tracking-tight">
              Spend Trends Over Last 12 Months
            </h4>
            <p className="text-xs text-slate-400 font-medium">Continuous procurement expenditure flow chart matching filter boundaries</p>
          </div>
          <LineChartIcon className="w-4.5 h-4.5 text-slate-400" />
        </div>

        <div className="w-full h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeSeriesChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FDA4AF" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#FDA4AF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDF2F7" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 10, fontWeight: "600" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 10 }} tickFormatter={(val) => formatCurrencyVal(val)} />
              <Tooltip
                contentStyle={{ background: "#0F172A", border: "none", borderRadius: "12px", color: "#FFF", fontSize: 11 }}
                formatter={(val: any) => [formatCurrencyVal(val), "Monthly Cumulative"]}
              />
              <Area type="monotone" dataKey="total" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#spendGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters Segment & Search bar for Table Ledger */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Main Search input bar */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            <input
              type="text"
              placeholder="Search by Vendor, Department, descriptions..."
              className="w-full h-11 pl-11 pr-10 bg-slate-50 border border-slate-200/60 rounded-xl text-sm font-semibold outline-none focus:bg-white focus:border-slate-300 transition-all text-slate-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Table quick Filters block */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Category selection */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Category:</span>
              <select
                className="h-10 px-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none cursor-pointer focus:border-slate-300"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">ALL CATEGORIES</option>
                {allCategories.map((catName) => (
                  <option key={catName} value={catName}>
                    {catName.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Department selection */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Department:</span>
              <select
                className="h-10 px-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none cursor-pointer focus:border-slate-300"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="ALL">ALL DEPTS</option>
                {allDepartments.map((deptName) => (
                  <option key={deptName} value={deptName}>
                    {deptName.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear filters trigger */}
            {(abcFilter !== "ALL" || categoryFilter !== "ALL" || departmentFilter !== "ALL" || searchTerm !== "") && (
              <button
                onClick={() => {
                  setAbcFilter("ALL");
                  setCategoryFilter("ALL");
                  setDepartmentFilter("ALL");
                  setSearchTerm("");
                }}
                className="h-10 px-3 hover:bg-rose-50 border border-transparent hover:border-rose-100 text-rose-600 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
                title="Reset active list filters"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Interactive Filter Badges indicator */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 pt-1 border-t border-slate-100">
          <span>Active filter segments:</span>
          <span className="px-2.5 py-1 bg-slate-100 border border-slate-200/50 text-slate-700 text-[10px] rounded-lg tracking-wide">
            Date Range: {dateFilter === "ALL" ? "All History" : `Last ${dateFilter} Months`}
          </span>
          {abcFilter !== "ALL" && (
            <span className="px-2.5 py-1 bg-rose-50 border border-rose-200/30 text-rose-600 text-[10px] rounded-lg tracking-wide flex items-center gap-1">
              ABC Class: {abcFilter} Only
              <X className="w-3 h-3 cursor-pointer" onClick={() => setAbcFilter("ALL")} />
            </span>
          )}
          {categoryFilter !== "ALL" && (
            <span className="px-2.5 py-1 bg-amber-50 border border-amber-200/30 text-amber-700 text-[10px] rounded-lg tracking-wide flex items-center gap-1">
              Category: {categoryFilter}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setCategoryFilter("ALL")} />
            </span>
          )}
          {departmentFilter !== "ALL" && (
            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200/30 text-emerald-700 text-[10px] rounded-lg tracking-wide flex items-center gap-1">
              Department: {departmentFilter}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setDepartmentFilter("ALL")} />
            </span>
          )}
          <span className="text-slate-400 font-medium ml-auto text-[11px] font-mono">
            Showing {finalFilteredItems.length} of {dynamicAbcItems.length} transactions
          </span>
        </div>
      </div>

      {/* Sortable, Responsive Spend Data Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-base font-black text-slate-900 tracking-tight">
              Spend Classification Ledger
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Procurement transactions color-coded (Red: High, Yellow: Med, Green: Low)</p>
          </div>
          
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-[10px] font-bold uppercase tracking-wider pr-2">Class A</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-[10px] font-bold uppercase tracking-wider pr-2">Class B</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Class C</span>
          </div>
        </div>

        {/* Desktop Spend Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setSortBy("supplier"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  Supplier & Details {sortBy === "supplier" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setSortBy("category"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  Procurement Category {sortBy === "category" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => { setSortBy("amount"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  Spend Amount {sortBy === "amount" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors text-center" onClick={() => { setSortBy("abcClass"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  ABC Class {sortBy === "abcClass" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-6 py-4 text-right">Contribution %</th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setSortBy("date"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  Purchase Date {sortBy === "date" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-6 py-4">Department / Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {finalFilteredItems.map((item) => {
                
                // Color mapping logic according to user standard
                let badgeClass = "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
                let textStyle = "text-emerald-700";
                
                if (item.abcClass === "A") {
                  badgeClass = "bg-rose-500/10 text-rose-600 border border-rose-500/20";
                  textStyle = "text-rose-700";
                } else if (item.abcClass === "B") {
                  badgeClass = "bg-amber-500/10 text-amber-600 border border-amber-500/20";
                  textStyle = "text-amber-700";
                }

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                    {/* Supplier details block */}
                    <td className="px-6 py-4.5">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-[#0f172a] text-sm group-hover:text-blue-600 select-none">
                          {item.supplier}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium truncate max-w-sm mt-0.5">
                          {item.description}
                        </span>
                      </div>
                    </td>

                    {/* Category column */}
                    <td className="px-6 py-4.5">
                      <span className="text-xs font-bold text-slate-600 px-2 py-1 bg-slate-100/80 rounded-lg">
                        {item.category}
                      </span>
                    </td>

                    {/* Spend amount column */}
                    <td className="px-6 py-4.5 text-right font-mono font-black text-[#0f172a]">
                      {formatCurrencyVal(item.amount)}
                    </td>

                    {/* ABC classification column */}
                    <td className="px-6 py-4.5 text-center">
                      <span className={cn("px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider inline-block text-center min-w-[32px] sm:min-w-fit", badgeClass)}>
                        Class {item.abcClass}
                      </span>
                    </td>

                    {/* Contribution % column */}
                    <td className="px-6 py-4.5 text-right font-mono text-slate-500 font-bold">
                      {item.percentageOfTotal.toFixed(2)}%
                    </td>

                    {/* Purchase Date column */}
                    <td className="px-6 py-4.5 text-slate-500 font-bold font-mono text-xs">
                      {item.date}
                    </td>

                    {/* Department / compliance column */}
                    <td className="px-6 py-4.5">
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-extrabold text-slate-700">{item.department}</span>
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-wider mt-0.5 inline-block",
                          item.isManaged ? "text-emerald-500" : "text-rose-400 font-bold tracking-tight"
                        )}>
                          {item.isManaged ? "SUM Contracted" : "Maverick Spend"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {finalFilteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 italic">
                    No procurement ledger lines matched your search query or filter segments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Spend Table Alternative */}
        <div className="block lg:hidden divide-y divide-slate-100 p-4">
          {finalFilteredItems.map((item) => {
            let badgeClass = "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
            if (item.abcClass === "A") {
              badgeClass = "bg-rose-500/10 text-rose-600 border border-rose-500/20";
            } else if (item.abcClass === "B") {
              badgeClass = "bg-amber-500/10 text-amber-600 border border-amber-500/20";
            }

            return (
              <div key={item.id} className="py-4 space-y-2 text-left">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-extrabold text-slate-900 text-sm leading-snug pr-2">
                      {item.supplier}
                    </h5>
                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[220px] mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  <span className={cn("px-2.5 py-1 rounded-xl font-black text-[10px] uppercase tracking-wider", badgeClass)}>
                    Class {item.abcClass}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500 pt-1.5 border-t border-slate-50">
                  <div className="space-y-1">
                    <p>Category: <span className="text-slate-800">{item.category}</span></p>
                    <p>Dept: <span className="text-slate-800">{item.department}</span></p>
                    <p>Date: <span className="text-slate-700 font-mono font-semibold">{item.date}</span></p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p>Amount: <span className="text-[#0f172a] font-black text-xs font-sans block">{formatCurrencyVal(item.amount)}</span></p>
                    <p>Share: <span className="text-slate-800 font-mono">{item.percentageOfTotal.toFixed(2)}%</span></p>
                    <p className={cn("text-[9px] font-black uppercase mt-1", item.isManaged ? "text-emerald-500" : "text-rose-400")}>
                      {item.isManaged ? "Compliant SUM" : "Maverick Off-contract"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {finalFilteredItems.length === 0 && (
            <p className="text-center py-8 text-slate-400 italic text-sm">
              No procurement ledger lines matched your search query.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
