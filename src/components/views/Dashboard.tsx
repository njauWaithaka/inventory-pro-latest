import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  Boxes,
  ShoppingCart,
  BarChart2,
  Clock,
  ChevronRight,
  ArrowRight,
  Share2,
  FileText,
  Zap,
  Grid,
  Bell,
  ClipboardList,
  Building,
  Box,
  ArrowUpRight,
  AlertCircle,
  Percent,
  Minus,
  Lock,
  Wrench,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn, formatCompactNumber, getProductMovementSpeed } from "../../lib/utils";
import { ABCAnalysisSection } from "./ABCAnalysisSection";
import {
  calculateStockTurnover,
  calculateMonthlyTurnoverTrend,
  getDateRangeForPeriod,
} from "../../lib/stockTurnoverService";
import {
  calculateDashboardInsight,
  calculateGoldenProducts,
  calculateProfitInsights,
} from "../../lib/businessInsightsService";
import { motion } from "motion/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  Legend,
} from "recharts";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { ViewType } from "../../types";

const COLORS = ["#2AB7A9", "#2F80ED", "#F59E0B", "#EF4444", "#06132B"];

export function Dashboard({
  onNavigate,
}: {
  onNavigate?: (view: ViewType) => void;
}) {
  const { user } = useAuth();
  const { profile, settings } = useSettings();
  const currency = settings?.currency || "KSh";
  const [products, setProducts] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.companyId) return;

    const productsQuery = collection(
      db,
      `companies/${profile.companyId}/products`,
    );
    const alertsQuery = collection(
      db,
      `companies/${profile.companyId}/inventory_alerts`,
    );
    const poQuery = collection(
      db,
      `companies/${profile.companyId}/purchaseOrders`,
    );
    const grnQuery = collection(
      db,
      `companies/${profile.companyId}/grns`,
    );
    const invoicesQuery = collection(
      db,
      `companies/${profile.companyId}/invoices`,
    );
    const creditNotesQuery = collection(
      db,
      `companies/${profile.companyId}/credit_notes`,
    );
    const movementsQuery = collection(
      db,
      `companies/${profile.companyId}/stockMovements`,
    );

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          movement: getProductMovementSpeed(data)
        };
      }));
      setLoading(false);
    });

    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      setAlerts(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
    });

    const unsubscribePOs = onSnapshot(poQuery, (snapshot) => {
      setPurchaseOrders(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeGrns = onSnapshot(grnQuery, (snapshot) => {
      setGrns(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeInvoices = onSnapshot(invoicesQuery, (snapshot) => {
      setInvoices(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeCreditNotes = onSnapshot(creditNotesQuery, (snapshot) => {
      setCreditNotes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeMovements = onSnapshot(movementsQuery, (snapshot) => {
      setStockMovements(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const triggerSync = async () => {
      try {
        const { AlertService } = await import('../../lib/alertService');
        await AlertService.runAlertSync(profile.companyId);
      } catch (err) {
        console.error("Dashboard alerts sync failed:", err);
      }
    };
    triggerSync();

    return () => {
      unsubscribeProducts();
      unsubscribeAlerts();
      unsubscribePOs();
      unsubscribeGrns();
      unsubscribeInvoices();
      unsubscribeCreditNotes();
      unsubscribeMovements();
    };
  }, [profile?.companyId]);

  // Derived KPIs
  const allProducts = [...products];

  const allAlerts = [...alerts];

  const salesMetrics = useMemo(() => {
    const salesInvoices = invoices.filter(
      (inv) => inv.type === "standard" || !inv.type
    );
    let totalSales = 0;
    let totalCOGS = 0;
    let totalUnitsSold = 0;

    salesInvoices.forEach((inv) => {
      const items = inv.items || [];
      if (items.length === 0) {
        const amt = Number(inv.amount) || 0;
        totalSales += amt;
        totalCOGS += amt * 0.65;
        totalUnitsSold += 1;
      } else {
        items.forEach((it: any) => {
          const qty = Number(it.quantity) || 1;
          const price = Number(it.price) || Number(it.unitPrice) || 0;
          const net = Number(it.total) || qty * price;
          totalSales += net;
          totalUnitsSold += qty;

          const prod = products.find(
            (p) => p.id === it.productId || p.sku === it.sku
          );
          let unitCost = Number(
            prod?.buyingPrice || prod?.value || it.buyingPrice || it.cost || 0
          );
          if (unitCost <= 0) {
            unitCost = price > 0 ? price * 0.65 : net * 0.65;
          }
          totalCOGS += qty * unitCost;
        });
      }
    });

    const grossProfit = totalSales - totalCOGS;
    const operatingExpenses = Math.round(totalSales * 0.12);
    const netProfit = grossProfit - operatingExpenses;
    const netMarginPct =
      totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

    const totalCurrentStock = products.reduce(
      (sum, p) => sum + (Number(p.quantity) || 0),
      0
    );
    const totalBeginningStock = totalUnitsSold + totalCurrentStock;
    const sellThroughRate =
      totalBeginningStock > 0
        ? (totalUnitsSold / totalBeginningStock) * 100
        : 0;

    return {
      totalSales,
      netProfit,
      netMarginPct,
      salesCount: salesInvoices.length,
      totalUnitsSold,
      sellThroughRate,
    };
  }, [invoices, products]);

  const turnoverDateRange = useMemo(() => {
    return getDateRangeForPeriod('This Month');
  }, []);

  const turnoverStats = useMemo(() => {
    return calculateStockTurnover(products, stockMovements, turnoverDateRange);
  }, [products, stockMovements, turnoverDateRange]);

  const turnoverRatioData = useMemo(() => {
    return calculateMonthlyTurnoverTrend(products, stockMovements);
  }, [products, stockMovements]);

  // Business Intelligence Observation
  const dashboardInsight = useMemo(() => {
    return calculateDashboardInsight(products, invoices, stockMovements, alerts);
  }, [products, invoices, stockMovements, alerts]);

  const totalCapital = allProducts.reduce(
    (sum, p) => sum + (p.value || 0) * (p.quantity || 0),
    0,
  );
  const totalSKUs = allProducts.length;
  const lowStockCount = allProducts.filter(
    (p) => p.quantity <= p.minStock,
  ).length;
  const activeAlertsCount = allAlerts.filter(
    (a) => a.status !== "resolved" && a.status !== "dismissed"
  ).length;

  const activeAlertsList = useMemo(() => {
    const severityWeights: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    };

    return allAlerts
      .filter((a) => a.status !== "resolved" && a.status !== "dismissed")
      .sort((a, b) => {
        const weightA = severityWeights[a.severity] || 0;
        const weightB = severityWeights[b.severity] || 0;
        if (weightA !== weightB) {
          return weightB - weightA;
        }
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      });
  }, [allAlerts]);

  // ABC Analysis Calculation
  const sortedProducts = [...allProducts].sort(
    (a, b) =>
      (b.value || 0) * (b.quantity || 0) - (a.value || 0) * (a.quantity || 0),
  );
  const abcDataSetup = {
    A: { count: 0, value: 0, description: "High-value items. Critical stock." },
    B: { count: 0, value: 0, description: "Medium-value items. Standard" },
    C: { count: 0, value: 0, description: "Low-value items. High volume" },
  };

  sortedProducts.forEach((p, index) => {
    const val = (p.value || 0) * (p.quantity || 0);
    const itemPct =
      allProducts.length > 0 ? (index + 1) / allProducts.length : 0;

    if (itemPct <= 0.1) {
      abcDataSetup.A.count++;
      abcDataSetup.A.value += val;
    } else if (itemPct <= 0.35) {
      abcDataSetup.B.count++;
      abcDataSetup.B.value += val;
    } else {
      abcDataSetup.C.count++;
      abcDataSetup.C.value += val;
    }
  });

  const abcDisplay = [
    { class: "A", name: "Class A", color: "#2AB7A9", ...abcDataSetup.A },
    { class: "B", name: "Class B", color: "#2F80ED", ...abcDataSetup.B },
    { class: "C", name: "Class C", color: "#06132B", ...abcDataSetup.C },
  ].map((item) => ({
    ...item,
    valuePercentage:
      totalCapital > 0 ? Math.round((item.value / totalCapital) * 100) : 0,
    itemPercentage:
      allProducts.length > 0
        ? Math.round((item.count / allProducts.length) * 100)
        : 0,
  }));

  // Pareto Chart Data Calculation sorted descending by SKU value
  const sortedForPareto = [...allProducts]
    .map((p) => ({
      name: p.name || "Unnamed SKU",
      value: (p.value || 0) * (p.quantity || 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalValueSum = sortedForPareto.reduce(
    (sum, item) => sum + item.value,
    0,
  );

  let runningSum = 0;
  const paretoData = sortedForPareto.slice(0, 10).map((item) => {
    runningSum += item.value;
    const cumulativePct =
      totalValueSum > 0 ? Math.round((runningSum / totalValueSum) * 100) : 0;
    return {
      name:
        item.name.length > 15 ? item.name.substring(0, 15) + "..." : item.name,
      Value: item.value,
      "Cumulative %": cumulativePct,
    };
  });

  // Movement Analysis
  const movementStats = {
    fast: {
      name: "Fast Moving",
      count: 0,
      value: 0,
      color: "bg-[#18B56B]",
      textColor: "text-[#18B56B]",
      desc: "High velocity",
    },
    moderate: {
      name: "Moderate",
      count: 0,
      value: 0,
      color: "bg-[#2F80ED]",
      textColor: "text-[#2F80ED]",
      desc: "Stable turnover",
    },
    slow: {
      name: "Slow Moving",
      count: 0,
      value: 0,
      color: "bg-[#F59E0B]",
      textColor: "text-[#F59E0B]",
      desc: "Inventory aging",
    },
    obsolete: {
      name: "Obsolete",
      count: 0,
      value: 0,
      color: "bg-[#EF4444]",
      textColor: "text-[#EF4444]",
      desc: "Liquidate stock",
    },
  };

  allProducts.forEach((p) => {
    const val = (p.value || 0) * (p.quantity || 0);
    const move = (p.movement || "slow").toLowerCase();
    const type = move as keyof typeof movementStats;
    if (movementStats[type]) {
      movementStats[type].count++;
      movementStats[type].value += val;
    }
  });

  const movementTotalValue = Object.values(movementStats).reduce(
    (sum, s) => sum + s.value,
    0,
  );

  // Category Value Analysis
  const categoryStats = allProducts
    .reduce((acc: any[], p) => {
      const catName = p.category || "Uncategorized";
      const existing = acc.find((c) => c.name === catName);
      const value = (p.value || 0) * (p.quantity || 0);
      if (existing) {
        existing.value += value;
      } else {
        acc.push({
          name: catName,
          value,
          color: COLORS[acc.length % COLORS.length],
        });
      }
      return acc;
    }, [])
    .sort((a, b) => b.value - a.value);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FB]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-[#F5F7FB] min-h-screen w-full pt-1 pb-8 font-sans scroll-smooth">
      <div className="w-full max-w-none space-y-3 min-w-0">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#06132B]">
              Inventory Intelligence
            </h1>
            <p className="text-sm text-[#526789] mt-1">
              Advanced analytical overview of your supply chain health
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-white border border-[#DDE5F0] rounded-xl text-xs font-bold text-[#06132B] shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2">
              <Share2 className="w-3.5 h-3.5" />
              Export
            </button>
            <button className="px-5 py-2.5 bg-[#06132B] text-white rounded-xl text-xs font-bold shadow-lg shadow-navy-100 hover:opacity-90 transition-all flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              Update
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 min-w-0">
          <SummaryCard
            title="Inventory Total"
            value={`${currency}${totalCapital.toLocaleString()}`}
            subtitle={`${formatCompactNumber(totalCapital, currency)} assets`}
            icon={DollarSign}
            gradient="from-[#172744] to-[#1D3158]"
          />
          <SummaryCard
            title="Total Sales"
            value={`${currency}${Math.round(salesMetrics.totalSales).toLocaleString()}`}
            subtitle={`${salesMetrics.salesCount} total invoices`}
            icon={ShoppingCart}
            gradient="from-[#2563EB] to-[#1D4ED8]"
            badgeText="REVENUE"
          />
          <SummaryCard
            title="Turnover Rate"
            value={`${turnoverStats.overallRatio.toFixed(2)}x`}
            subtitle={`COGS: ${currency}${formatCompactNumber(turnoverStats.totalCOGS, "")} • ${turnoverStats.totalUnitsSold.toLocaleString()} sold`}
            icon={Boxes}
            gradient="from-[#8B5CF6] to-[#6D28D9]"
            badgeText="VELOCITY"
          />
          <SummaryCard
            title="Net Profit"
            value={`${currency}${Math.round(salesMetrics.netProfit).toLocaleString()}`}
            subtitle={`${salesMetrics.netMarginPct.toFixed(1)}% net margin`}
            icon={TrendingUp}
            gradient="from-[#10B981] to-[#047857]"
            badgeText="NET MARGIN"
          />
        </div>

        {/* Business Intelligence Observation Area */}
        <div className="bg-gradient-to-r from-blue-900/90 via-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 border border-blue-800/60 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 text-blue-300">
              <Zap className="w-5 h-5 fill-blue-400/30 text-blue-300" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  AI Business Insight
                </span>
                <span className="text-xs font-bold text-slate-300">
                  {dashboardInsight.title}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
                {dashboardInsight.summary} {dashboardInsight.recommendation && (
                  <span className="text-blue-200 font-semibold">{dashboardInsight.recommendation}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <button
              onClick={() => onNavigate?.('analytics')}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>Explore Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 1. SMART ALERTS & 2. STOCK MOVEMENT (PRIORITY 1 & 2) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 min-w-0">
          {/* Priority 1: Smart Alerts */}
          <div className="bg-white border border-[#DDE5F0] rounded-xl shadow-sm p-6 flex flex-col min-h-[420px] text-left">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#06132B]">
                  Smart Alerts
                </h2>
                <p className="text-sm text-[#526789]">Priority action items</p>
              </div>
              <button
                onClick={() => onNavigate?.("alerts")}
                className="text-xs font-bold text-[#2F80ED] hover:underline"
              >
                View All →
              </button>
            </div>

            <div className="space-y-4 flex-1 flex flex-col justify-center">
              {activeAlertsList.length > 0 ? (
                <div className="space-y-4 w-full h-full">
                  {activeAlertsList.slice(0, 3).map((alert) => (
                    <AlertItem
                      key={alert.id}
                      type={alert.type}
                      title={alert.title}
                      message={alert.description}
                      time={timeAgo(alert.timestamp)}
                      onClick={() => {
                        if (alert.type === "expiry") {
                          onNavigate?.("expiry_tracking");
                        } else if (alert.type === "reorder") {
                          onNavigate?.("inventory");
                        } else {
                          onNavigate?.("alerts");
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed border-[#DDE5F0] rounded-xl bg-slate-50 text-center flex-1 h-full min-h-[250px] w-full">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">All systems clear</h4>
                  <p className="text-xs text-[#526789] mt-1 max-w-[240px]">
                    No high priority alerts. Your inventory levels are balanced.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Priority 2: Stock Movement Analysis */}
          <div className="bg-white border border-[#DDE5F0] rounded-xl shadow-sm p-6 flex flex-col min-h-[420px] text-left">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-[#06132B]">
                Stock Movement
              </h2>
              <p className="text-sm text-[#526789]">Velocity categorization</p>
            </div>

            <div className="h-3.5 w-full bg-slate-100 rounded-full flex overflow-hidden mb-6">
              <div
                className="h-full bg-[#18B56B]"
                style={{
                  width:
                    movementTotalValue > 0
                      ? `${(movementStats.fast.value / movementTotalValue) * 100}%`
                      : "25%",
                }}
              />
              <div
                className="h-full bg-[#2F80ED]"
                style={{
                  width:
                    movementTotalValue > 0
                      ? `${(movementStats.moderate.value / movementTotalValue) * 100}%`
                      : "25%",
                }}
              />
              <div
                className="h-full bg-[#F59E0B]"
                style={{
                  width:
                    movementTotalValue > 0
                      ? `${(movementStats.slow.value / movementTotalValue) * 100}%`
                      : "25%",
                }}
              />
              <div
                className="h-full bg-[#EF4444]"
                style={{
                  width:
                    movementTotalValue > 0
                      ? `${(movementStats.obsolete.value / movementTotalValue) * 100}%`
                      : "25%",
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 flex-1 overflow-y-auto no-scrollbar pb-2">
              {Object.entries(movementStats).map(([key, stat]) => (
                <div
                  key={key}
                  className="bg-white border border-[#DDE5F0] rounded-xl p-4 flex flex-col transition-all hover:border-slate-300"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-2 h-2 rounded-full", stat.color)} />
                    <span className="text-[11px] font-bold text-[#06132B] truncate">
                      {stat.name}
                    </span>
                  </div>
                  <div className="text-lg font-extrabold text-[#06132B]">
                    {currency}
                    {formatCompactNumber(stat.value, "")}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px] font-bold">
                    <span className="text-[#526789]">{stat.count} SKUs</span>
                    <span className={stat.textColor}>
                      {movementTotalValue > 0
                        ? Math.round((stat.value / movementTotalValue) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Priority 3: ABC / PARETO ANALYSIS SECTION */}
        <ABCAnalysisSection products={allProducts} currency={currency} />

        {/* Bottom Interactive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 min-w-0">
          {/* Cash Tied by Category */}
          <div className="bg-white border border-[#DDE5F0] rounded-xl shadow-sm p-5 md:p-6 flex flex-col min-w-0">
            <div className="mb-6 text-left">
              <h2 className="text-lg font-bold text-[#06132B]">
                Cash Tied by Category
              </h2>
              <p className="text-sm text-[#526789]">
                Distribution of inventory value
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 flex-1">
              <div className="w-[160px] h-[160px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={
                        categoryStats.length > 0
                          ? categoryStats
                          : [{ name: "None", value: 1 }]
                      }
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {categoryStats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(val: number) => [
                        `${currency}${val.toLocaleString()}`,
                        "Value",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="w-full min-w-0 space-y-3">
                {categoryStats.slice(0, 5).map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2"
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[11px] font-bold text-[#526789] truncate break-words text-left uppercase tracking-tight">
                      {item.name}
                    </span>
                    <span className="text-[11px] font-extrabold text-[#06132B] whitespace-nowrap ml-2 italic">
                      {formatCompactNumber(item.value, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stock Turnover Trend */}
          <div className="bg-white border border-[#DDE5F0] rounded-xl shadow-sm p-4 sm:p-5 md:p-6 flex flex-col justify-between min-w-0 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 text-left">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#06132B]">
                  Stock Turnover Trend
                </h2>
                <p className="text-xs sm:text-sm text-[#526789]">
                  Monthly inventory turnover ratio
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200/60 rounded-lg text-[#23AFA5] text-xs font-bold w-fit shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#23AFA5] animate-pulse" />
                {turnoverRatioData.length > 0 ? `${turnoverRatioData[turnoverRatioData.length - 1].turnover.toFixed(2)}x Current` : 'Active'}
              </div>
            </div>

            <div className="w-full h-[210px] sm:h-[230px] md:h-[240px] min-h-[190px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={190}>
                <AreaChart data={turnoverRatioData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient
                      id="colorTurnover"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#23AFA5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#23AFA5" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 700, fill: "#94a3b8" }}
                    dy={10}
                    interval={0}
                  />
                  <YAxis hide={true} domain={[0, 'auto']} />
                  <Tooltip
                    formatter={(val: any) => [`${Number(val).toFixed(2)}x`, "Turnover Rate"]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      fontWeight: 700,
                      fontSize: "12px"
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="turnover"
                    stroke="#23AFA5"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorTurnover)"
                    dot={{ r: 3, fill: '#23AFA5', strokeWidth: 1, stroke: '#fff' }}
                    activeDot={{ r: 5, fill: '#23AFA5', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-slate-100 text-center">
              <div className="text-left">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">6-Mo Avg</span>
                <span className="text-xs sm:text-sm font-extrabold text-[#06132B]">
                  {(turnoverRatioData.reduce((s, i) => s + i.turnover, 0) / Math.max(1, turnoverRatioData.length)).toFixed(2)}x
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Peak Month</span>
                <span className="text-xs sm:text-sm font-extrabold text-[#06132B]">
                  {Math.max(...turnoverRatioData.map(i => i.turnover), 0).toFixed(2)}x
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Velocity</span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-600">
                  Healthy
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  badgeText,
}: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={cn(
        "relative rounded-xl p-4 sm:p-6 min-h-[125px] overflow-hidden shadow-sm flex flex-col justify-between text-left min-w-0",
        "bg-gradient-to-br",
        gradient,
      )}
    >
      <div className="flex justify-between items-start gap-2 min-w-0">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] sm:text-[13px] font-semibold text-white/80 uppercase tracking-widest truncate">
            {title}
          </p>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">
              {value}
            </h3>
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10 shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="flex items-center justify-between mt-4 gap-2 min-w-0">
        <p className="text-[11px] sm:text-[13px] text-white/60 font-medium truncate">{subtitle}</p>
        {badgeText && (
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[9px] font-black text-white tracking-widest backdrop-blur-sm shrink-0">
            {badgeText}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function WhiteMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  change,
  variant,
  gradient,
}: any) {
  if (gradient) {
    return (
      <SummaryCard
        title={title}
        value={value}
        subtitle={subtitle}
        icon={Icon}
        gradient={gradient}
      />
    );
  }

  return (
    <div className="bg-white border border-[#DDE5F0] rounded-xl p-6 min-h-[125px] shadow-sm flex flex-col justify-between text-left transition-all hover:border-slate-300 group">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[13px] font-semibold text-[#526789] uppercase tracking-widest leading-none">
            {title}
          </p>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-extrabold text-[#06132B] tracking-tight">
              {value}
            </h3>
            {change && (
              <span className="text-[12px] font-bold text-[#10B981]">
                {change}
              </span>
            )}
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center border border-slate-100 group-hover:bg-slate-50 transition-colors">
          <Icon
            className={cn(
              "w-5 h-5",
              variant === "warning"
                ? "text-[#F59E0B]"
                : variant === "success"
                  ? "text-[#10B981]"
                  : "text-[#526789]",
            )}
          />
        </div>
      </div>
      <p className="text-[13px] text-[#526789] font-medium leading-none">
        {subtitle}
      </p>
    </div>
  );
}

function AlertItem({ type, title, message, time, onClick }: any) {
  const configs = {
    reorder: {
      bg: "bg-[#FEF2F2]",
      border: "border-[#FCA5A5]",
      iconBg: "bg-[#F04455]",
      textColor: "text-[#EF4444]",
      icon: AlertCircle,
    },
    expiry: {
      bg: "bg-[#FFF7ED]",
      border: "border-[#FDBA74]",
      iconBg: "bg-[#F97316]",
      textColor: "text-[#EA580C]",
      icon: Clock,
    },
    overstock: {
      bg: "bg-[#FFFBEB]",
      border: "border-[#FCD34D]",
      iconBg: "bg-[#F59E0B]",
      textColor: "text-[#D97706]",
      icon: TrendingUp,
    },
  };

  const config = configs[type as keyof typeof configs] || configs.reorder;
  const AlertIcon = config.icon;

  return (
    <div
      className={cn(
        "rounded-[10px] p-4 border flex gap-4 relative group",
        config.bg,
        config.border,
      )}
    >
      <span className="absolute top-4 right-4 text-[10px] font-bold text-[#526789]">
        {time}
      </span>
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105",
          config.iconBg,
        )}
      >
        <AlertIcon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <h4 className="text-[14px] font-bold text-[#06132B]">{title}</h4>
        <p className="text-[12px] text-[#526789] leading-tight pr-8 mt-0.5">
          {message}
        </p>
        <button
          onClick={onClick}
          className={cn(
            "text-[12px] font-bold flex items-center gap-1 mt-3 hover:underline",
            config.textColor,
          )}
        >
          Resolve Now →
        </button>
      </div>
    </div>
  );
}

function timeAgo(dateString?: string): string {
  if (!dateString) return 'Just now';
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  } catch {
    return 'Recently';
  }
}
