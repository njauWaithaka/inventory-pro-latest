import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCcw,
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
} from "lucide-react";
import { cn, formatCompactNumber, getProductMovementSpeed } from "../../lib/utils";
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

    return () => {
      unsubscribeProducts();
      unsubscribeAlerts();
    };
  }, [profile?.companyId]);

  // Derived KPIs
  const allProducts = [...products];

  const allAlerts = [...alerts];

  const turnoverRatioData = useMemo(() => {
    let totalSold = 0;
    let totalStock = 0;
    products.forEach(p => {
      totalSold += parseFloat(p.unitsSold || 0);
      totalStock += parseFloat(p.quantity || 0);
    });
    const ratio = totalStock > 0 ? (totalSold / totalStock) * 3 : 3.5;
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m, idx) => {
      const variation = Math.sin(idx) * 0.4;
      return {
        name: m,
        turnover: Math.max(0.5, parseFloat((ratio + variation).toFixed(1)))
      };
    });
  }, [products]);

  const totalCapital = allProducts.reduce(
    (sum, p) => sum + (p.value || 0) * (p.quantity || 0),
    0,
  );
  const totalSKUs = allProducts.length;
  const lowStockCount = allProducts.filter(
    (p) => p.quantity <= p.minStock,
  ).length;
  const activeAlertsCount = allAlerts.length;

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 min-w-0">
          <SummaryCard
            title="Inventory Total"
            value={`${currency}${totalCapital.toLocaleString()}`}
            subtitle={`${formatCompactNumber(totalCapital, currency)} assets`}
            icon={DollarSign}
            gradient="from-[#172744] to-[#1D3158]"
          />
          <SummaryCard
            title="Stock Turnover"
            value="4.2x"
            subtitle="+8.3% this quarter"
            icon={RefreshCcw}
            gradient="from-[#23AFA5] to-[#31C5B5]"
            badgeText="HEALTHY"
          />
        </div>

        {/* ABC ANALYTICS PANEL */}
        <div className="bg-white border border-[#DDE5F0] rounded-xl shadow-sm p-6 lg:p-8 space-y-6 text-left shrink-0 min-w-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-50 text-[10px] font-black text-[#2AB7A9] uppercase tracking-widest mb-1.5">
                Pareto optimization
              </div>
              <h2 className="text-xl font-bold text-[#06132B]">
                ABC Analytics Panel
              </h2>
              <p className="text-sm text-[#526789]">
                Strategic inventory valuation and optimal class categorization
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {abcDisplay.map((item) => (
                <div
                  key={item.class}
                  className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-1.5 rounded-xl"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-bold text-[#06132B] text-xs uppercase tracking-tight">
                    {item.name}: {item.valuePercentage}% Value
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-w-0 w-full">
            {/* Pareto Chart: Centerpiece (7 cols) */}
            <div className="lg:col-span-7 bg-[#F8FAFC] border border-slate-100 rounded-xl p-5 md:p-6 flex flex-col justify-between min-w-0">
              <div className="mb-4">
                <span className="text-[10px] font-black text-[#526789] uppercase tracking-widest block mb-1">
                  Pareto Distribution (Top SKUs)
                </span>
                <p className="text-xs text-[#526789]">
                  The 80/20 Rule: Trace the vital few items contributing to the
                  majority of your total capital investment.
                </p>
              </div>
              <div className="h-[280px] w-full mt-2">
                {paretoData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={paretoData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#E2E8F0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fontWeight: 700, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) =>
                          `${currency}${formatCompactNumber(val, "")}`
                        }
                        tick={{
                          fontSize: 10,
                          fontWeight: 700,
                          fill: "#64748b",
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => `${val}%`}
                        tick={{
                          fontSize: 10,
                          fontWeight: 700,
                          fill: "#64748b",
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                        formatter={(value: any, name: any) => {
                          if (name === "Value")
                            return [
                              `${currency}${Number(value).toLocaleString()}`,
                              "Value",
                            ];
                          return [`${value}%`, "Cumulative %"];
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: "11px", fontWeight: 700 }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="Value"
                        fill="#2AB7A9"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={30}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="Cumulative %"
                        stroke="#EF4444"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 1 }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No active stock values.
                  </div>
                )}
              </div>
            </div>

            {/* Distribution Charts Side Panel (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4 min-w-0">
              <div className="grid grid-cols-2 gap-4 flex-1">
                {/* Value Bar Chart */}
                <div className="bg-[#F8FAFC] border border-slate-100 rounded-xl p-4 flex flex-col justify-between min-w-0">
                  <div>
                    <span className="text-[10px] font-black text-[#526789] uppercase tracking-widest block mb-2">
                      Absolute Value
                    </span>
                    <div className="h-[120px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={abcDisplay}
                          margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#E2E8F0"
                          />
                          <XAxis
                            dataKey="class"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 700 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 9 }}
                            tickFormatter={(v) => formatCompactNumber(v, "")}
                          />
                          <Tooltip
                            formatter={(value: number) => [
                              `${currency}${value.toLocaleString()}`,
                              "Value",
                            ]}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {abcDisplay.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="text-center pt-2">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      Asset Value by Class
                    </span>
                  </div>
                </div>

                {/* Value Allocation Pie Chart */}
                <div className="bg-[#F8FAFC] border border-slate-100 rounded-xl p-4 flex flex-col justify-between min-w-0">
                  <div>
                    <span className="text-[10px] font-black text-[#526789] uppercase tracking-widest block mb-2">
                      Revenue Share %
                    </span>
                    <div className="h-[120px] w-full relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={abcDisplay}
                            dataKey="value"
                            innerRadius={30}
                            outerRadius={45}
                            paddingAngle={3}
                            stroke="none"
                          >
                            {abcDisplay.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [
                              `${totalCapital > 0 ? Math.round((value / totalCapital) * 100) : 0}%`,
                              "Share",
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                          Cap
                        </span>
                        <span className="text-[11px] font-black text-slate-800 leading-none mt-0.5">
                          {formatCompactNumber(totalCapital, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-center pt-2">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      Capital weight allocation
                    </span>
                  </div>
                </div>
              </div>

              {/* Strategic Interpretations */}
              <div className="bg-[#06132B] text-white rounded-xl p-5 space-y-3.5 flex-1 flex flex-col justify-center">
                <span className="text-[10px] font-black text-[#2AB7A9] uppercase tracking-widest block mb-1">
                  Strategic Action Guide
                </span>
                <div className="space-y-3">
                  <div className="text-left">
                    <div className="flex items-center gap-1.5 leading-none">
                      <span className="w-2 h-2 rounded-full bg-[#2AB7A9]"></span>
                      <span className="text-xs font-bold text-[#2AB7A9]">
                        Class A ({abcDisplay[0]?.itemPercentage}% SKUs →{" "}
                        {abcDisplay[0]?.valuePercentage}% Capital)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 ml-3.5 mt-0.5 font-medium leading-relaxed font-sans">
                      Tight control • Frequent monitoring • Low tolerance for
                      stockouts
                    </p>
                  </div>

                  <div className="text-left">
                    <div className="flex items-center gap-1.5 leading-none">
                      <span className="w-2 h-2 rounded-full bg-[#2F80ED]"></span>
                      <span className="text-xs font-bold text-[#2F80ED]">
                        Class B ({abcDisplay[1]?.itemPercentage}% SKUs →{" "}
                        {abcDisplay[1]?.valuePercentage}% Capital)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 ml-3.5 mt-0.5 font-medium leading-relaxed font-sans">
                      Your biggest value driver • Optimize ordering cycles •
                      Upgrade select products to Class A
                    </p>
                  </div>

                  <div className="text-left">
                    <div className="flex items-center gap-1.5 leading-none">
                      <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                      <span className="text-xs font-bold text-slate-300">
                        Class C ({abcDisplay[2]?.itemPercentage}% SKUs →{" "}
                        {abcDisplay[2]?.valuePercentage}% Capital)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 ml-3.5 mt-0.5 font-medium leading-relaxed font-sans">
                      Automate • Bulk ordering • Minimize administrative and
                      storage overhead
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 min-w-0">
          {/* Section: Smart Alerts */}
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

            <div className="space-y-4 flex-1">
              <AlertItem
                type="reorder"
                title="Reorder Required"
                message="15 units of Industrial Cables below minimum."
                time="1h ago"
                onClick={() => onNavigate?.("inventory")}
              />
              <AlertItem
                type="expiry"
                title="Expiry Risk"
                message="Batch #492 expiring in 14 days."
                time="3h ago"
                onClick={() => onNavigate?.("expiry_tracking")}
              />
              <AlertItem
                type="overstock"
                title="Overstock Risk"
                message="Storage B nearing capacity limit."
                time="6h ago"
                onClick={() => onNavigate?.("alerts")}
              />
            </div>
          </div>

          {/* Section: Stock Movement Analysis */}
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
          <div className="bg-white border border-[#DDE5F0] rounded-xl shadow-sm p-5 md:p-6 flex flex-col min-w-0">
            <div className="mb-6 text-left">
              <h2 className="text-lg font-bold text-[#06132B]">
                Stock Turnover Trend
              </h2>
              <p className="text-sm text-[#526789]">
                Monthly inventory turnover ratio
              </p>
            </div>

            <div className="flex-1 w-full h-[220px] md:h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={turnoverRatioData}>
                  <defs>
                    <linearGradient
                      id="colorTurnover"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#23AFA5" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#23AFA5" stopOpacity={0} />
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
                    tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                    dy={10}
                  />
                  <YAxis hide={true} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="turnover"
                    stroke="#23AFA5"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorTurnover)"
                  />
                </AreaChart>
              </ResponsiveContainer>
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
        "relative rounded-xl p-6 min-h-[125px] overflow-hidden shadow-sm flex flex-col justify-between text-left",
        "bg-gradient-to-br",
        gradient,
      )}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[13px] font-semibold text-white/80 uppercase tracking-widest">
            {title}
          </p>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-extrabold text-white tracking-tight">
              {value}
            </h3>
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10 shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="flex items-center justify-between mt-4">
        <p className="text-[13px] text-white/60 font-medium">{subtitle}</p>
        {badgeText && (
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[9px] font-black text-white tracking-widest backdrop-blur-sm">
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
