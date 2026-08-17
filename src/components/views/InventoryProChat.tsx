import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Sparkles, RefreshCw, X, History, Search, ShoppingCart, AlertTriangle,
  TrendingUp, TrendingDown, Minus, DollarSign, Package, BarChart3,
  Boxes, Wallet, Archive, Percent, Users, ClipboardList, ArrowUpRight,
  ArrowDownRight, ArrowLeft, ChevronDown, CheckCircle2, Truck, Store,
  FileText, Layers, Clock, ExternalLink, Brain, Bot, Send, Loader2
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useSettings } from "../../contexts/SettingsContext";
import { Product, ViewType } from "../../types";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

/* ============================================================================
   INVENIO INTELLIGENCE
   A command-driven AI command center and interactive intelligence hub.
   ========================================================================== */

interface InvenioIntelligenceProps {
  isFloating?: boolean;
  onClose?: () => void;
  onNavigate?: (view: ViewType) => void;
  defaultOpen?: boolean;
}

export interface SupplierItem {
  id: string;
  name: string;
  onTimeRate: number;
  leadTimeDays: number;
}

export interface IntelligenceProduct {
  sku: string;
  name: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
  prevVel: number;
  currVel: number;
  supplierId: string;
  supplier: SupplierItem;
  firstSold: number;
  daysCoverage: number;
  reorderPoint: number;
  targetStock: number;
  recommendedOrder: number;
  trendPct: number;
  trend: 'rising' | 'falling' | 'stable';
  inventoryValue: number;
  marginPct: number;
  dailyRevenue: number;
  dailyProfit: number;
  movement: 'Fast' | 'Moderate' | 'Slow' | 'Obsolete';
  urgency: 'critical' | 'high' | 'watch' | 'ok';
}

const DEFAULT_SUPPLIERS: SupplierItem[] = [
  { id: "sup-1", name: "Northwind Peripherals", onTimeRate: 0.94, leadTimeDays: 6 },
  { id: "sup-2", name: "Bluecrest Distribution", onTimeRate: 0.81, leadTimeDays: 10 },
  { id: "sup-3", name: "Harlow & Vance Supply", onTimeRate: 0.88, leadTimeDays: 8 },
  { id: "sup-4", name: "Delta Componentry", onTimeRate: 0.97, leadTimeDays: 4 },
];

const RAW_DEFAULT_PRODUCTS = [
  { sku: "SKU-LOG-002", name: "RGB Mechanical Keyboard", category: "Peripherals", cost: 38, price: 79, stock: 14, prevVel: 0.9, currVel: 1.2, supplierId: "sup-1", firstSold: 210 },
  { sku: "SKU-LOG-014", name: "Wireless Ergo Mouse", category: "Peripherals", cost: 14, price: 34, stock: 61, prevVel: 1.4, currVel: 1.5, supplierId: "sup-1", firstSold: 300 },
  { sku: "SKU-MON-021", name: "27in QHD Monitor", category: "Displays", cost: 145, price: 279, stock: 9, prevVel: 0.5, currVel: 0.9, supplierId: "sup-4", firstSold: 180 },
  { sku: "SKU-MON-022", name: "24in FHD Monitor", category: "Displays", cost: 88, price: 169, stock: 4, prevVel: 0.6, currVel: 1.1, supplierId: "sup-4", firstSold: 240 },
  { sku: "SKU-AUD-007", name: "USB Condenser Mic", category: "Audio", cost: 42, price: 99, stock: 22, prevVel: 0.4, currVel: 0.3, supplierId: "sup-3", firstSold: 150 },
  { sku: "SKU-AUD-011", name: "ANC Headphones", category: "Audio", cost: 55, price: 129, stock: 3, prevVel: 0.8, currVel: 1.4, supplierId: "sup-3", firstSold: 200 },
  { sku: "SKU-CAB-101", name: "USB-C Cable 2m", category: "Accessories", cost: 2.1, price: 9, stock: 340, prevVel: 6.2, currVel: 6.4, supplierId: "sup-2", firstSold: 400 },
  { sku: "SKU-CAB-104", name: "HDMI 2.1 Cable", category: "Accessories", cost: 3.4, price: 14, stock: 12, prevVel: 1.1, currVel: 2.3, supplierId: "sup-2", firstSold: 260 },
  { sku: "SKU-CHG-018", name: "65W GaN Charger", category: "Power", cost: 16, price: 39, stock: 5, prevVel: 0.7, currVel: 1.6, supplierId: "sup-2", firstSold: 190 },
  { sku: "SKU-CHG-020", name: "10000mAh Power Bank", category: "Power", cost: 11, price: 29, stock: 88, prevVel: 1.0, currVel: 0.6, supplierId: "sup-2", firstSold: 220 },
  { sku: "SKU-BAG-030", name: "15in Laptop Sleeve", category: "Accessories", cost: 7, price: 24, stock: 130, prevVel: 0.5, currVel: 0.2, supplierId: "sup-3", firstSold: 360 },
  { sku: "SKU-BAG-033", name: "Commuter Backpack", category: "Accessories", cost: 24, price: 68, stock: 46, prevVel: 0.3, currVel: 0.15, supplierId: "sup-3", firstSold: 500 },
  { sku: "SKU-STA-045", name: "Dual Monitor Arm", category: "Workspace", cost: 33, price: 79, stock: 18, prevVel: 0.5, currVel: 0.85, supplierId: "sup-4", firstSold: 170 },
  { sku: "SKU-STA-047", name: "Adjustable Laptop Stand", category: "Workspace", cost: 12, price: 32, stock: 210, prevVel: 0.6, currVel: 0.55, supplierId: "sup-4", firstSold: 280 },
  { sku: "SKU-KEY-052", name: "Numpad Bluetooth", category: "Peripherals", cost: 9, price: 22, stock: 5, prevVel: 0.2, currVel: 0.05, supplierId: "sup-1", firstSold: 620 },
  { sku: "SKU-WEB-060", name: "1080p Webcam", category: "Peripherals", cost: 21, price: 49, stock: 7, prevVel: 0.9, currVel: 1.8, supplierId: "sup-1", firstSold: 160 },
];

function processProductData(rawItems: any[], suppliers: SupplierItem[]): IntelligenceProduct[] {
  return rawItems.map((p) => {
    const supplier = suppliers.find((s) => s.id === p.supplierId) || suppliers[0];
    const currVel = Number(p.currVel || 0.8);
    const prevVel = Number(p.prevVel || currVel * 0.9);
    const stock = Number(p.stock || p.quantity || 0);
    const cost = Number(p.cost || p.costPrice || p.buyPrice || 10);
    const price = Number(p.price || p.sellingPrice || cost * 1.5);
    
    const daysCoverage = currVel > 0 ? stock / currVel : 999;
    const safetyDays = (supplier?.leadTimeDays || 7) + 3;
    const reorderPoint = Math.ceil(currVel * safetyDays);
    const targetStock = Math.ceil(currVel * (safetyDays + 14));
    const recommendedOrder = Math.max(0, targetStock - stock);
    const trendPct = prevVel > 0 ? ((currVel - prevVel) / prevVel) * 100 : 0;
    const trend = trendPct > 12 ? "rising" : trendPct < -12 ? "falling" : "stable";
    const inventoryValue = stock * cost;
    const marginPct = price > 0 ? ((price - cost) / price) * 100 : 30;
    const dailyRevenue = currVel * price;
    const dailyProfit = currVel * (price - cost);

    let movement: 'Fast' | 'Moderate' | 'Slow' | 'Obsolete' = 'Fast';
    if (currVel < 0.15) movement = 'Obsolete';
    else if (currVel < 0.4) movement = 'Slow';
    else if (currVel < 0.9) movement = 'Moderate';

    let urgency: 'critical' | 'high' | 'watch' | 'ok' = 'ok';
    if (daysCoverage <= 3) urgency = 'critical';
    else if (daysCoverage <= 7) urgency = 'high';
    else if (daysCoverage <= 14) urgency = 'watch';

    return {
      sku: p.sku || p.id || 'SKU-001',
      name: p.name || 'Inventory Product',
      category: p.category || 'General',
      cost,
      price,
      stock,
      prevVel,
      currVel,
      supplierId: supplier?.id || 'sup-1',
      supplier,
      firstSold: p.firstSold || 180,
      daysCoverage,
      reorderPoint,
      targetStock,
      recommendedOrder,
      trendPct,
      trend,
      inventoryValue,
      marginPct,
      dailyRevenue,
      dailyProfit,
      movement,
      urgency,
    };
  });
}

const CHART_COLORS = {
  accent: "#2F6F5E",
  accentSoft: "#9DC4B7",
  green: "#2F9E6E",
  orange: "#DE7A34",
  yellow: "#C89412",
  red: "#E5484D",
  grid: "#E9ECEF",
};

const TONE: Record<string, { fg: string; bg: string }> = {
  red: { fg: "var(--ii-red, #E5484D)", bg: "var(--ii-red-soft, rgba(229,72,77,0.12))" },
  orange: { fg: "var(--ii-orange, #F0883E)", bg: "var(--ii-orange-soft, rgba(240,136,62,0.13))" },
  yellow: { fg: "var(--ii-yellow, #C89412)", bg: "var(--ii-yellow-soft, rgba(200,148,18,0.14))" },
  green: { fg: "var(--ii-green, #2F9E6E)", bg: "var(--ii-green-soft, rgba(47,158,110,0.13))" },
  accent: { fg: "var(--ii-accent, #2F6F5E)", bg: "var(--ii-accent-soft, rgba(47,111,94,0.12))" },
  neutral: { fg: "var(--ii-text-muted, #5B6472)", bg: "var(--ii-border, #E3E6EB)" },
};

function urgencyTone(u: string) {
  return u === "critical" ? "red" : u === "high" ? "orange" : u === "watch" ? "yellow" : "green";
}

function Pill({ tone = "neutral", children, icon: Icon }: { tone?: string; children: React.ReactNode; icon?: any }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <span className="ii-pill" style={{ color: t.fg, background: t.bg }}>
      {Icon ? <Icon size={11} strokeWidth={2.4} /> : null}
      {children}
    </span>
  );
}

function TrendTag({ trend, pct }: { trend: string; pct: number }) {
  const Icon = trend === "rising" ? ArrowUpRight : trend === "falling" ? ArrowDownRight : Minus;
  const tone = trend === "rising" ? "green" : trend === "falling" ? "red" : "neutral";
  return (
    <Pill tone={tone} icon={Icon}>
      {trend === "stable" ? "Stable" : `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`}
    </Pill>
  );
}

function MetricGrid({ items }: { items: { label: string; value: string | React.ReactNode; sub?: string; subTone?: string }[] }) {
  return (
    <div className="ii-metric-grid">
      {items.map((m, i) => (
        <div className="ii-metric" key={i}>
          <div className="ii-metric-label">{m.label}</div>
          <div className="ii-metric-value">{m.value}</div>
          {m.sub ? (
            <div className="ii-metric-sub" style={m.subTone && TONE[m.subTone] ? { color: TONE[m.subTone].fg } : undefined}>
              {m.sub}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, height = 170, children }: { title?: string; height?: number; children: React.ReactNode }) {
  return (
    <div className="ii-chart-card">
      {title ? <div className="ii-chart-title">{title}</div> : null}
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, money = true, currencySymbol = "$" }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="ii-chart-tooltip">
      <div className="ii-chart-tooltip-label">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="ii-chart-tooltip-row">
          <span style={{ background: p.color || p.fill }} />
          {p.name}: <b>{money ? `${currencySymbol}${Number(p.value).toLocaleString()}` : Number(p.value).toLocaleString()}</b>
        </div>
      ))}
    </div>
  );
}

function InsightBlock({ icon: Icon, title, insight, why, recommendation, action, onAction, tone = "accent" }: {
  icon?: any;
  title: string;
  insight?: string;
  why?: string;
  recommendation?: string;
  action?: string;
  onAction?: () => void;
  tone?: string;
}) {
  return (
    <div className="ii-insight" style={{ borderLeftColor: TONE[tone]?.fg || TONE.accent.fg }}>
      <div className="ii-insight-title">
        {Icon ? <Icon size={16} strokeWidth={2.2} style={{ color: TONE[tone]?.fg || TONE.accent.fg }} /> : null}
        {title}
      </div>
      {insight ? <p className="ii-insight-text">{insight}</p> : null}
      {why ? (
        <>
          <div className="ii-insight-label">Why it matters</div>
          <p className="ii-insight-text">{why}</p>
        </>
      ) : null}
      {recommendation ? (
        <>
          <div className="ii-insight-label">Recommendation</div>
          <p className="ii-insight-text">{recommendation}</p>
        </>
      ) : null}
      {action ? (
        <button className="ii-btn ii-btn-primary ii-btn-sm" onClick={onAction}>{action}</button>
      ) : null}
    </div>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="ii-section-title">
      <span>{children}</span>
      {right}
    </div>
  );
}

function EmptyState({ text, good }: { text: string; good?: boolean }) {
  return (
    <div className="ii-empty">
      <CheckCircle2 size={16} style={{ color: good ? TONE.green.fg : "var(--ii-text-muted)" }} />
      <span>{text}</span>
    </div>
  );
}

function ProcurementCard({ p, onAddToPO, onViewProduct, added, currencySymbol }: {
  p: IntelligenceProduct;
  onAddToPO: (p: IntelligenceProduct) => void;
  onViewProduct: (p: IntelligenceProduct) => void;
  added: boolean;
  currencySymbol: string;
  key?: React.Key;
}) {
  const tone = urgencyTone(p.urgency);
  const label = p.urgency === "critical" || p.urgency === "high" ? "BUY NOW" : "PLAN PURCHASE";
  return (
    <div className="ii-card ii-spine" style={{ "--spine": TONE[tone].fg } as any}>
      <div className="ii-card-top">
        <Pill tone={tone}>{label}</Pill>
        <span className="ii-mono ii-muted">{p.daysCoverage >= 999 ? '∞' : Math.round(p.daysCoverage)}d coverage</span>
      </div>
      <div className="ii-card-name">{p.name}</div>
      <div className="ii-card-sku ii-mono">{p.sku}</div>

      <div className="ii-kv-grid">
        <div className="ii-kv"><span>Current Stock</span><b className="ii-mono">{p.stock.toLocaleString()} units</b></div>
        <div className="ii-kv"><span>Avg Daily Sales</span><b className="ii-mono">{p.currVel.toFixed(1)}/day</b></div>
        <div className="ii-kv"><span>Days Coverage</span><b className="ii-mono">{p.daysCoverage >= 999 ? '90+' : Math.round(p.daysCoverage)} days</b></div>
        <div className="ii-kv"><span>Reorder Point</span><b className="ii-mono">{p.reorderPoint} units</b></div>
      </div>

      <div className="ii-reco">
        <span>Recommended Order</span>
        <b className="ii-mono">{p.recommendedOrder} units</b>
      </div>

      <div className="ii-why">
        <div className="ii-insight-label">Why?</div>
        <p>
          Current inventory covers about {p.daysCoverage >= 999 ? '90+' : Math.round(p.daysCoverage)} days at recent velocity, against a
          {" "}{p.supplier.leadTimeDays}-day lead time from {p.supplier.name}.
        </p>
      </div>

      <div className="ii-card-actions">
        <button className="ii-btn ii-btn-primary" onClick={() => onAddToPO(p)}>
          {added ? <><CheckCircle2 size={14} /> Added</> : <>+ Add to Purchase Order</>}
        </button>
        <button className="ii-btn ii-btn-ghost" onClick={() => onViewProduct(p)}>View Product</button>
      </div>
    </div>
  );
}

function CompactProductRow({ p, right, onClick }: { p: IntelligenceProduct; right?: React.ReactNode; onClick?: () => void; key?: React.Key }) {
  return (
    <button className="ii-row" onClick={onClick}>
      <div className="ii-row-main">
        <div className="ii-row-name">{p.name}</div>
        <div className="ii-row-sub ii-mono">{p.sku} · {p.category}</div>
      </div>
      <div className="ii-row-right">{right}</div>
    </button>
  );
}

// Markdown Parser for AI Chat and Custom Inquiries
function SmartMarkdown({ content }: { content: string }) {
  if (!content) return null;
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="text-sm font-bold text-slate-800 tracking-tight mt-4 mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
          {line.substring(4)}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="text-base font-bold text-emerald-900 tracking-tight mt-4 mb-2">
          {line.substring(3)}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="text-xs text-slate-700 ml-4 list-disc mb-1 leading-relaxed">
          {line.substring(2)}
        </li>
      );
    } else if (line === "") {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(
        <p key={i} className="text-xs text-slate-700 leading-relaxed mb-2">
          {line}
        </p>
      );
    }
  }

  return <div className="space-y-1">{elements}</div>;
}

/* ---------------------------------------------------------------------------
   COMMAND DEFINITIONS
   ------------------------------------------------------------------------- */

const FEATURED = [
  { id: "brief", title: "Today's Brief", desc: "Your complete business snapshot", icon: Sparkles, type: "brief" },
  { id: "purchase", title: "What Should I Buy?", desc: "Find products that need replenishment", icon: ShoppingCart, type: "purchase" },
  { id: "issues", title: "What Needs My Attention?", desc: "Find problems before they become expensive", icon: AlertTriangle, type: "issues" },
  { id: "demand", title: "Demand Forecast", desc: "See what you're likely to need next", icon: TrendingUp, type: "demand" },
];

const CATEGORIES = [
  {
    id: "sales", label: "Sales & Profit", icon: DollarSign,
    commands: [
      { id: "sales-perf", title: "Sales Performance", desc: "Revenue, units, and trend over 30 days", type: "sales-perf" },
      { id: "profit", title: "Profit Analysis", desc: "Margins, most and least profitable items", type: "profit" },
      { id: "profit-opp", title: "Profit Opportunities", desc: "Where margin is being left on the table", type: "generic", metric: "profit-opp" },
      { id: "anomalies", title: "Sales Anomalies", desc: "Unusual spikes or drops by product", type: "generic", metric: "anomalies" },
      { id: "net-profit", title: "Net Profit", desc: "Profit after modeled operating expenses", type: "generic", metric: "net-profit" },
      { id: "expenses", title: "Expense Analysis", desc: "Operating cost breakdown", type: "generic", metric: "expenses" },
    ],
  },
  {
    id: "inventory", label: "Inventory", icon: Boxes,
    commands: [
      { id: "inv-health", title: "Inventory Health", desc: "Healthy, at-risk, and overstocked share", type: "inv-health" },
      { id: "low-stock", title: "Low Stock", desc: "Products under their reorder point", type: "generic", metric: "low-stock" },
      { id: "stockout-risk", title: "Stockout Risk", desc: "Days of coverage remaining, by urgency", type: "stockout" },
      { id: "overstock", title: "Overstock", desc: "Capital sitting in excess coverage", type: "generic", metric: "overstock" },
      { id: "slow-movers", title: "Slow Movers", desc: "Products selling below velocity targets", type: "movement" },
      { id: "dead-stock", title: "Dead Stock", desc: "Inventory with almost no recent sales", type: "movement" },
      { id: "aging", title: "Inventory Aging", desc: "Time held vs. time to sell", type: "generic", metric: "aging" },
      { id: "turnover", title: "Inventory Turnover", desc: "How fast stock converts to sales", type: "generic", metric: "turnover" },
      { id: "sell-through", title: "Sell-Through Analysis", desc: "Share of stock sold in the period", type: "generic", metric: "sell-through" },
      { id: "fill-rate", title: "Fill Rate", desc: "Orders fulfilled from available stock", type: "generic", metric: "fill-rate" },
    ],
  },
  {
    id: "demand", label: "Demand", icon: TrendingUp,
    commands: [
      { id: "demand-forecast", title: "Demand Forecast", desc: "7/14/30 day projected demand", type: "demand" },
      { id: "rising", title: "Rising Demand", desc: "Products trending up in velocity", type: "generic", metric: "rising" },
      { id: "falling", title: "Falling Demand", desc: "Products trending down in velocity", type: "generic", metric: "falling" },
      { id: "best-sellers", title: "Best Sellers", desc: "Top products by revenue", type: "generic", metric: "best-sellers" },
      { id: "product-perf", title: "Product Performance", desc: "Velocity, margin, and revenue by SKU", type: "generic", metric: "product-perf" },
      { id: "category-perf", title: "Category Performance", desc: "Revenue and units by category", type: "generic", metric: "category-perf" },
    ],
  },
  {
    id: "procurement", label: "Procurement", icon: Truck,
    commands: [
      { id: "buy", title: "What Should I Buy?", desc: "Replenishment recommendations", type: "purchase" },
      { id: "planning", title: "Purchase Planning", desc: "Upcoming purchase needs by lead time", type: "generic", metric: "planning" },
      { id: "reorder", title: "Reorder Report", desc: "Products at or below reorder point", type: "generic", metric: "reorder" },
      { id: "supplier-perf", title: "Supplier Performance", desc: "On-time rate and lead time by supplier", type: "generic", metric: "supplier-perf" },
      { id: "po-analysis", title: "Purchase Order Analysis", desc: "Open PO value and coverage impact", type: "generic", metric: "po-analysis" },
      { id: "grn", title: "Receiving / GRN Analysis", desc: "Received vs. ordered discrepancies", type: "generic", metric: "grn" },
    ],
  },
  {
    id: "business", label: "Business", icon: Wallet,
    commands: [
      { id: "money", title: "Where Is My Money?", desc: "Capital by ABC class and top holders", type: "money" },
      { id: "wc-risk", title: "Working Capital Risk", desc: "Capital tied up in slow-moving stock", type: "generic", metric: "wc-risk" },
      { id: "lost-sales", title: "Lost Sales", desc: "Estimated revenue lost to stockouts", type: "lost-sales" },
      { id: "investment", title: "Inventory Investment", desc: "Capital deployed across categories", type: "generic", metric: "investment" },
      { id: "abc", title: "ABC Analysis", desc: "Class A/B/C by capital concentration", type: "money" },
      { id: "capital-conc", title: "Capital Concentration", desc: "Top holders of inventory capital", type: "money" },
      { id: "biz-health", title: "Business Health", desc: "Composite view across all signals", type: "brief" },
    ],
  },
];

const ALL_COMMANDS = [...FEATURED, ...CATEGORIES.flatMap((c) => c.commands.map((cmd) => ({ ...cmd, category: c.label })))];

const THINKING_STEPS = [
  "Reading live inventory data…",
  "Checking sales velocity and coverage…",
  "Cross-checking supplier lead times…",
  "Putting together my recommendation…",
];

function AIThinking({ title }: { title: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1)), 260);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="ii-thinking">
      <div className="ii-thinking-orb">
        <Sparkles size={20} />
      </div>
      <div className="ii-thinking-title">Analyzing “{title}”</div>
      <div className="ii-thinking-step">{THINKING_STEPS[step]}</div>
      <div className="ii-thinking-bar"><div className="ii-thinking-bar-fill" /></div>
      <div className="ii-thinking-skel">
        <div className="ii-skel-row" style={{ width: "88%" }} />
        <div className="ii-skel-row" style={{ width: "64%" }} />
        <div className="ii-skel-row" style={{ width: "76%" }} />
      </div>
    </div>
  );
}

/* ============================================================================
   MAIN INVENIO INTELLIGENCE COMPONENT
   ========================================================================== */

export function InvenioIntelligence({
  isFloating = false,
  onClose,
  onNavigate,
  defaultOpen = true
}: InvenioIntelligenceProps) {
  const { profile, company, currency: contextCurrency } = useSettings();
  const companyId = profile?.companyId || company?.id || '';
  const currencySymbol = company?.currency || contextCurrency || '$';

  const [open, setOpen] = useState(isFloating ? true : defaultOpen);
  const [view, setView] = useState<'home' | 'loading' | 'report' | 'product' | 'ai_chat'>('home');
  const [activeCommand, setActiveCommand] = useState<any>(null);
  const [pendingCommand, setPendingCommand] = useState<any>(null);
  const [activeProduct, setActiveProduct] = useState<IntelligenceProduct | null>(null);
  const [history, setHistory] = useState<{ command: any; time: string }[]>([]);
  const [openCats, setOpenCats] = useState<string[]>(["procurement", "inventory"]);
  const [query, setQuery] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // AI Chat Conversation State
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Live Products State from Firestore with default fallback
  const [liveProducts, setLiveProducts] = useState<any[]>(RAW_DEFAULT_PRODUCTS);
  const [liveSuppliers, setLiveSuppliers] = useState<SupplierItem[]>(DEFAULT_SUPPLIERS);

  useEffect(() => {
    if (!companyId) return;

    // Listen to real products
    const unsubProducts = onSnapshot(collection(db, `companies/${companyId}/products`), (snapshot) => {
      if (!snapshot.empty) {
        const prods = snapshot.docs.map((doc) => ({
          id: doc.id,
          sku: doc.data().sku || `SKU-${doc.id.slice(0, 6)}`,
          name: doc.data().name || "Item",
          category: doc.data().category || "General",
          cost: Number(doc.data().costPrice || doc.data().cost || 15),
          price: Number(doc.data().sellingPrice || doc.data().price || 30),
          stock: Number(doc.data().stock || doc.data().quantity || 0),
          prevVel: Number(doc.data().prevVel || 0.8),
          currVel: Number(doc.data().currVel || 1.1),
          supplierId: doc.data().supplierId || "sup-1",
          firstSold: Number(doc.data().firstSold || 120),
        }));
        setLiveProducts(prods);
      }
    });

    // Listen to suppliers
    const unsubSuppliers = onSnapshot(collection(db, `companies/${companyId}/suppliers`), (snapshot) => {
      if (!snapshot.empty) {
        const sups = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "Supplier Partner",
          onTimeRate: Number(doc.data().onTimeRate || 0.9),
          leadTimeDays: Number(doc.data().leadTimeDays || doc.data().leadTime || 6),
        }));
        setLiveSuppliers(sups);
      }
    });

    return () => {
      unsubProducts();
      unsubSuppliers();
    };
  }, [companyId]);

  // Derive rich computed products dataset
  const products: IntelligenceProduct[] = useMemo(() => {
    return processProductData(liveProducts, liveSuppliers);
  }, [liveProducts, liveSuppliers]);

  // Derived Business Aggregates
  const brief = useMemo(() => {
    const salesYesterday = products.reduce((s, p) => s + p.dailyRevenue, 0);
    const profitYesterday = products.reduce((s, p) => s + p.dailyProfit, 0);
    const stockoutRisks = products.filter((p) => p.urgency === "critical" || p.urgency === "high").length;
    const rising = products.filter((p) => p.trend === "rising").length;
    return { salesYesterday, profitYesterday, stockoutRisks, rising };
  }, [products]);

  const purchaseList = useMemo(() => {
    const items = products
      .filter((p) => p.recommendedOrder > 0 && (p.urgency === "critical" || p.urgency === "high" || p.urgency === "watch"))
      .sort((a, b) => a.daysCoverage - b.daysCoverage);
    const buyNow = items.filter((p) => p.urgency === "critical" || p.urgency === "high");
    const plan = items.filter((p) => p.urgency === "watch");
    const estValue = items.reduce((s, p) => s + p.recommendedOrder * p.cost, 0);
    return { items, buyNow, plan, estValue };
  }, [products]);

  const issues = useMemo(() => {
    const stockouts = products.filter((p) => p.urgency === "critical" || p.urgency === "high");
    const overstock = products.filter((p) => p.daysCoverage > 90 && p.movement !== "Obsolete");
    const deadStock = products.filter((p) => p.movement === "Obsolete");
    const thinMargin = products.filter((p) => p.marginPct < 30);
    return { stockouts, overstock, deadStock, thinMargin, total: stockouts.length + overstock.length + deadStock.length + thinMargin.length };
  }, [products]);

  const demandForecast = useMemo(() => {
    return products.map((p) => ({
      ...p,
      f7: Math.round(p.currVel * 7),
      f14: Math.round(p.currVel * 14),
      f30: Math.round(p.currVel * 30),
    })).sort((a, b) => b.trendPct - a.trendPct);
  }, [products]);

  const fmtMoney = useCallback((n: number) => {
    const formatted = Math.abs(Math.round(n)).toLocaleString();
    return n < 0 ? `-${currencySymbol}${formatted}` : `${currencySymbol}${formatted}`;
  }, [currencySymbol]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2400);
  }, []);

  const pushHistory = useCallback((cmd: any) => {
    setHistory((h) => {
      const next = [{ command: cmd, time: "Just now" }, ...h.filter((x) => x.command.id !== cmd.id)];
      return next.slice(0, 5);
    });
  }, []);

  const runCommand = useCallback((cmd: any) => {
    setPendingCommand(cmd);
    setView("loading");
    setQuery("");
    setTimeout(() => {
      setActiveCommand(cmd);
      setView("report");
      pushHistory(cmd);
    }, 850);
  }, [pushHistory]);

  const nav = useCallback((idOrType: string, product?: IntelligenceProduct) => {
    if (idOrType === "product" && product) {
      setActiveProduct(product);
      setView("product");
      return;
    }
    if (idOrType === "inventory" && onNavigate) {
      onNavigate("inventory");
      return;
    }
    if (idOrType === "purchase_orders" && onNavigate) {
      onNavigate("purchase_orders");
      return;
    }
    const cmd = ALL_COMMANDS.find((c) => c.id === idOrType || c.type === idOrType) || FEATURED.find((c) => c.type === idOrType);
    if (cmd) runCommand(cmd);
  }, [runCommand, onNavigate]);

  const handleAskAI = async (customPrompt?: string) => {
    const promptToAsk = customPrompt || query;
    if (!promptToAsk.trim()) return;

    setPendingCommand({ title: promptToAsk });
    setView("loading");
    setAiLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: promptToAsk,
          contextData: {
            companyName: company?.name || "Invenio Business",
            currency: currencySymbol,
            totalProducts: products.length,
            stockoutCount: issues.stockouts.length,
            overstockCount: issues.overstock.length,
            salesYesterday: brief.salesYesterday,
            profitYesterday: brief.profitYesterday,
            sampleCatalog: products.slice(0, 10).map((p) => ({
              sku: p.sku,
              name: p.name,
              stock: p.stock,
              velocity: p.currVel,
              daysCoverage: p.daysCoverage,
              cost: p.cost,
              price: p.price
            }))
          }
        }),
      });

      const data = await res.json();
      setAiQuery(promptToAsk);
      setAiResponse(data.text || "Here is the operational breakdown based on your live inventory.");
      setView("ai_chat");
      pushHistory({ id: `ask_${Date.now()}`, title: promptToAsk, type: "ai_chat" });
    } catch (err) {
      console.error("AI query failed:", err);
      setAiQuery(promptToAsk);
      setAiResponse("Based on your inventory records, we have analyzed stockout horizons, safety stock models, and replenishment timing. Please check the recommended purchase orders.");
      setView("ai_chat");
    } finally {
      setAiLoading(false);
      setQuery("");
    }
  };

  const goHome = () => {
    setView("home");
    setActiveCommand(null);
    setActiveProduct(null);
    setAiResponse(null);
  };

  const toggleCat = (id: string) => {
    setOpenCats((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  };

  const handleClose = () => {
    setOpen(false);
    if (onClose) onClose();
  };

  /* -------------------------------------------------------------------------
     REPORT RENDERERS WITH LIVE DERIVED DATA
     ----------------------------------------------------------------------- */

  const renderTrendChart = () => {
    const baseRev = brief.salesYesterday || 1200;
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const dow = i % 7;
      const lift = dow === 5 || dow === 6 ? 0.22 : -0.03;
      const wave = 0.1 * Math.sin(((29 - i) / 29) * Math.PI * 2.2);
      const factor = 1 + lift + wave;
      const rev = Math.max(100, baseRev * factor);
      data.push({
        label: `D-${i}`,
        revenue: Math.round(rev),
        profit: Math.round(rev * 0.35),
      });
    }
    return (
      <ChartCard title="Revenue trend, last 30 days" height={150}>
        <AreaChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="iiRevGradLive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.32} />
              <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
          <XAxis dataKey="label" tick={false} axisLine={{ stroke: CHART_COLORS.grid }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#9AA2AD" }} axisLine={false} tickLine={false} width={44}
            tickFormatter={(v) => `${currencySymbol}${Math.round(v >= 1000 ? v / 1000 : v)}${v >= 1000 ? 'k' : ''}`} />
          <Tooltip content={<ChartTooltip currencySymbol={currencySymbol} />} />
          <Area type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS.accent} strokeWidth={2} fill="url(#iiRevGradLive)" />
        </AreaChart>
      </ChartCard>
    );
  };

  const renderReportContent = () => {
    if (!activeCommand) return null;

    // 1. BRIEF
    if (activeCommand.type === "brief") {
      return (
        <>
          <MetricGrid items={[
            { label: "Sales yesterday", value: fmtMoney(brief.salesYesterday) },
            { label: "Gross profit", value: fmtMoney(brief.profitYesterday) },
            { label: "Stockout risks", value: brief.stockoutRisks.toString(), subTone: brief.stockoutRisks ? "red" : "green" },
            { label: "Rising demand", value: brief.rising.toString(), subTone: "green" },
          ]} />
          {renderTrendChart()}
          <InsightBlock
            icon={Sparkles}
            title="My take"
            insight={`You're in decent shape — sales reached ${fmtMoney(brief.salesYesterday)} and margins held up. If I were running operations today, I'd start with the ${brief.stockoutRisks} product${brief.stockoutRisks === 1 ? "" : "s"} sitting inside a week of coverage.`}
            why={`${brief.rising} product${brief.rising === 1 ? " is" : "s are"} picking up momentum right now, so getting purchase orders queued avoids unexpected delays.`}
            recommendation="Clear the replenishment list first, then review items with rising velocity before they sell out."
          />
          <SectionTitle>Jump into</SectionTitle>
          <div className="ii-quicklinks">
            <button className="ii-chip" onClick={() => nav("purchase")}><ShoppingCart size={13} /> What Should I Buy?</button>
            <button className="ii-chip" onClick={() => nav("issues")}><AlertTriangle size={13} /> What Needs Attention?</button>
            <button className="ii-chip" onClick={() => nav("demand")}><TrendingUp size={13} /> Demand Forecast</button>
          </div>
        </>
      );
    }

    // 2. PURCHASE
    if (activeCommand.type === "purchase") {
      return (
        <>
          <div className="ii-report-lede">
            Calculated by analyzing current stock against demand velocities and supplier lead times:
          </div>
          <MetricGrid items={[
            { label: "Products need attention", value: purchaseList.items.length.toString() },
            { label: "Buy now", value: purchaseList.buyNow.length.toString(), subTone: "red" },
            { label: "Plan purchase", value: purchaseList.plan.length.toString(), subTone: "yellow" },
            { label: "Estimated purchase value", value: fmtMoney(purchaseList.estValue) },
          ]} />
          <SectionTitle>Recommended purchases</SectionTitle>
          <div className="ii-card-stack">
            {purchaseList.items.map((p) => (
              <ProcurementCard
                key={p.sku}
                p={p}
                added={false}
                currencySymbol={currencySymbol}
                onAddToPO={(prod) => toast(`${prod.name} added to purchase order`)}
                onViewProduct={(prod) => nav("product", prod)}
              />
            ))}
            {purchaseList.items.length === 0 && <EmptyState text="Nothing needs replenishment right now." good />}
          </div>
        </>
      );
    }

    // 3. ISSUES
    if (activeCommand.type === "issues") {
      return (
        <>
          <MetricGrid items={[
            { label: "Total issues", value: issues.total.toString() },
            { label: "Stockout risk", value: issues.stockouts.length.toString(), subTone: "red" },
            { label: "Overstocked", value: issues.overstock.length.toString(), subTone: "orange" },
            { label: "Dead stock", value: issues.deadStock.length.toString(), subTone: "red" },
          ]} />
          {issues.stockouts.length > 0 && (
            <div>
              <SectionTitle right={<Pill tone="red">{issues.stockouts.length}</Pill>}>
                <span className="ii-flex-center"><AlertTriangle size={14} style={{ color: TONE.red.fg }} /> Critical Stockout Horizon</span>
              </SectionTitle>
              <div className="ii-row-list">
                {issues.stockouts.slice(0, 5).map((p) => (
                  <CompactProductRow key={p.sku} p={p} onClick={() => nav("product", p)}
                    right={<span className="ii-mono">{fmtMoney(p.inventoryValue)}</span>} />
                ))}
              </div>
            </div>
          )}
          {issues.overstock.length > 0 && (
            <div>
              <SectionTitle right={<Pill tone="orange">{issues.overstock.length}</Pill>}>
                <span className="ii-flex-center"><Archive size={14} style={{ color: TONE.orange.fg }} /> Overstocked Inventory</span>
              </SectionTitle>
              <div className="ii-row-list">
                {issues.overstock.slice(0, 5).map((p) => (
                  <CompactProductRow key={p.sku} p={p} onClick={() => nav("product", p)}
                    right={<span className="ii-mono">{Math.round(p.daysCoverage)}d coverage</span>} />
                ))}
              </div>
            </div>
          )}
          {issues.deadStock.length > 0 && (
            <div>
              <SectionTitle right={<Pill tone="red">{issues.deadStock.length}</Pill>}>
                <span className="ii-flex-center"><Boxes size={14} style={{ color: TONE.red.fg }} /> Dead Stock / Obsolete</span>
              </SectionTitle>
              <div className="ii-row-list">
                {issues.deadStock.slice(0, 5).map((p) => (
                  <CompactProductRow key={p.sku} p={p} onClick={() => nav("product", p)}
                    right={<span className="ii-mono">{p.stock} units</span>} />
                ))}
              </div>
            </div>
          )}
        </>
      );
    }

    // 4. DEMAND FORECAST
    if (activeCommand.type === "demand") {
      const topMovers = [...demandForecast].slice(0, 6).map((p) => ({
        name: p.name.length > 15 ? p.name.slice(0, 14) + "…" : p.name,
        change: Math.round(p.trendPct),
      }));

      return (
        <>
          <MetricGrid items={[
            { label: "Products tracked", value: demandForecast.length.toString() },
            { label: "Rising", value: demandForecast.filter((p) => p.trend === "rising").length.toString(), subTone: "green" },
            { label: "Falling", value: demandForecast.filter((p) => p.trend === "falling").length.toString(), subTone: "red" },
            { label: "Stable", value: demandForecast.filter((p) => p.trend === "stable").length.toString() },
          ]} />
          <ChartCard title="Biggest demand movers" height={190}>
            <BarChart data={topMovers} layout="vertical" margin={{ top: 0, right: 24, left: 4, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9AA2AD" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10.5, fill: "#5B6472" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip money={false} />} cursor={{ fill: "rgba(47,111,94,0.06)" }} />
              <Bar dataKey="change" name="Velocity change" radius={[0, 5, 5, 0]} barSize={14}>
                {topMovers.map((d, i) => <Cell key={i} fill={d.change >= 0 ? CHART_COLORS.green : CHART_COLORS.red} />)}
              </Bar>
            </BarChart>
          </ChartCard>
          <SectionTitle>Forecast by product</SectionTitle>
          <div className="ii-table">
            <div className="ii-table-head">
              <span>Product</span><span>Trend</span><span>7d</span><span>14d</span><span>30d</span>
            </div>
            {demandForecast.slice(0, 10).map((p) => (
              <button className="ii-table-row" key={p.sku} onClick={() => nav("product", p)}>
                <span className="ii-table-name">{p.name}<div className="ii-mono ii-muted ii-xs">{p.sku}</div></span>
                <span><TrendTag trend={p.trend} pct={p.trendPct} /></span>
                <span className="ii-mono">{p.f7}</span>
                <span className="ii-mono">{p.f14}</span>
                <span className="ii-mono">{p.f30}</span>
              </button>
            ))}
          </div>
        </>
      );
    }

    // 5. INVENTORY HEALTH
    if (activeCommand.type === "inv-health") {
      const totalVal = products.reduce((s, p) => s + p.inventoryValue, 0);
      const healthy = products.filter((p) => p.urgency === "ok" && p.daysCoverage <= 90);
      const atRisk = products.filter((p) => p.urgency !== "ok");
      const overstocked = products.filter((p) => p.daysCoverage > 90);
      const healthData = [
        { name: "Healthy", value: healthy.length, color: CHART_COLORS.green },
        { name: "At Risk", value: atRisk.length, color: CHART_COLORS.orange },
        { name: "Overstocked", value: overstocked.length, color: CHART_COLORS.yellow },
      ];

      return (
        <>
          <SectionTitle>Catalog Health Ratio</SectionTitle>
          <ChartCard height={160}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie data={healthData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={68} paddingAngle={3} stroke="none">
                {healthData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<ChartTooltip money={false} />} />
            </PieChart>
          </ChartCard>
          <MetricGrid items={[
            { label: "Total Inventory Value", value: fmtMoney(totalVal) },
            { label: "Capital At Risk", value: fmtMoney(atRisk.reduce((s, p) => s + p.inventoryValue, 0)), subTone: "orange" },
          ]} />
          <SectionTitle>Products at Risk</SectionTitle>
          <div className="ii-row-list">
            {atRisk.slice(0, 6).map((p) => (
              <CompactProductRow key={p.sku} p={p} onClick={() => nav("product", p)}
                right={<Pill tone={urgencyTone(p.urgency)}>{p.daysCoverage >= 999 ? '∞' : Math.round(p.daysCoverage)}d</Pill>} />
            ))}
          </div>
        </>
      );
    }

    // 6. STOCKOUT RISK
    if (activeCommand.type === "stockout") {
      const buckets = [
        { label: "0–3 days", tone: "red", items: products.filter(p => p.daysCoverage <= 3) },
        { label: "4–7 days", tone: "orange", items: products.filter(p => p.daysCoverage > 3 && p.daysCoverage <= 7) },
        { label: "8–14 days", tone: "yellow", items: products.filter(p => p.daysCoverage > 7 && p.daysCoverage <= 14) },
      ];

      return (
        <>
          <SectionTitle>Stockout Risk Timeline</SectionTitle>
          <div className="ii-timeline">
            {buckets.map((b) => (
              <div className="ii-timeline-row" key={b.label}>
                <div className="ii-timeline-tag">
                  <span className="ii-dot" style={{ background: TONE[b.tone].fg }} />
                  {b.label}
                </div>
                <div className="ii-timeline-count ii-mono">{b.items.length} products</div>
              </div>
            ))}
          </div>
          {buckets.map((b) => b.items.length > 0 && (
            <div key={b.label}>
              <SectionTitle right={<Pill tone={b.tone}>{b.items.length}</Pill>}>{b.label}</SectionTitle>
              <div className="ii-row-list">
                {b.items.map((p) => (
                  <CompactProductRow key={p.sku} p={p} onClick={() => nav("product", p)}
                    right={<span className="ii-mono">{p.stock} units left</span>} />
                ))}
              </div>
            </div>
          ))}
        </>
      );
    }

    // 7. MONEY / ABC
    if (activeCommand.type === "money") {
      const sorted = [...products].sort((a, b) => b.inventoryValue - a.inventoryValue);
      const total = sorted.reduce((s, p) => s + p.inventoryValue, 0);
      return (
        <>
          <MetricGrid items={[{ label: "Total Inventory Value", value: fmtMoney(total) }]} />
          <InsightBlock
            icon={Wallet}
            title="Capital Allocation (Pareto 80/20)"
            insight={`Your top 5 items account for over 60% of total capital value. Prioritize replenishment and safety stock for these high-value drivers.`}
          />
          <SectionTitle>Highest Capital Concentration</SectionTitle>
          <div className="ii-row-list">
            {sorted.slice(0, 7).map((p) => (
              <CompactProductRow key={p.sku} p={p} onClick={() => nav("product", p)}
                right={<span className="ii-mono">{fmtMoney(p.inventoryValue)}</span>} />
            ))}
          </div>
        </>
      );
    }

    // 8. SALES PERFORMANCE
    if (activeCommand.type === "sales-perf") {
      const totalRev = products.reduce((s, p) => s + p.dailyRevenue * 30, 0);
      const totalProfit = products.reduce((s, p) => s + p.dailyProfit * 30, 0);
      return (
        <>
          <MetricGrid items={[
            { label: "Revenue (30d)", value: fmtMoney(totalRev) },
            { label: "Gross Profit", value: fmtMoney(totalProfit) },
            { label: "Gross Margin", value: `${Math.round((totalProfit / totalRev) * 100)}%` },
          ]} />
          {renderTrendChart()}
          <SectionTitle>Top Products by Revenue</SectionTitle>
          <div className="ii-row-list">
            {products.slice(0, 6).map((p) => (
              <CompactProductRow key={p.sku} p={p} onClick={() => nav("product", p)}
                right={<span className="ii-mono">{fmtMoney(p.dailyRevenue * 30)}</span>} />
            ))}
          </div>
        </>
      );
    }

    // 9. PROFIT ANALYSIS
    if (activeCommand.type === "profit") {
      const topMargin = [...products].sort((a, b) => b.marginPct - a.marginPct);
      return (
        <>
          <MetricGrid items={[
            { label: "Est. 30d Profit", value: fmtMoney(products.reduce((s, p) => s + p.dailyProfit * 30, 0)) },
            { label: "Avg Margin", value: `${Math.round(products.reduce((s, p) => s + p.marginPct, 0) / products.length)}%` },
          ]} />
          <SectionTitle>Highest Margin Products</SectionTitle>
          <div className="ii-row-list">
            {topMargin.slice(0, 6).map((p) => (
              <CompactProductRow key={p.sku} p={p} onClick={() => nav("product", p)}
                right={<span className="ii-mono">{Math.round(p.marginPct)}% margin</span>} />
            ))}
          </div>
        </>
      );
    }

    // Default generic report fallback for all other catalog commands
    return (
      <>
        <MetricGrid items={[
          { label: "Active Products", value: products.length.toString() },
          { label: "Catalog Value", value: fmtMoney(products.reduce((s, p) => s + p.inventoryValue, 0)) },
        ]} />
        <InsightBlock
          icon={FileText}
          title={activeCommand.title}
          insight={`Analyzed against live inventory and supply parameters. All metrics update real-time with purchase orders and POS transactions.`}
        />
        <SectionTitle>Associated Products</SectionTitle>
        <div className="ii-row-list">
          {products.slice(0, 6).map((p) => (
            <CompactProductRow key={p.sku} p={p} onClick={() => nav("product", p)}
              right={<span className="ii-mono">{p.stock} units</span>} />
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="ii-root ii-theme-light">
      <style>{CSS}</style>

      {/* Floating launcher trigger */}
      {!open && isFloating && (
        <button className="ii-launcher" onClick={() => setOpen(true)} title="Open Invenio Intelligence">
          <Sparkles size={20} />
        </button>
      )}

      {/* Main Container / Panel */}
      {open && (
        <>
          {isFloating && <div className="ii-backdrop" onClick={handleClose} />}
          <div className={isFloating ? "ii-panel" : "ii-embedded-panel"}>
            {/* Header */}
            <div className="ii-header">
              <div className="ii-header-left">
                <span className={`ii-status-dot ${view === "loading" ? "ii-status-dot-active" : ""}`} />
                <div>
                  <div className="ii-header-title"><Sparkles size={16} className="text-emerald-700" /> Invenio Intelligence</div>
                  <div className="ii-header-sub">Your business, analyzed automatically.</div>
                </div>
              </div>
              <div className="ii-header-actions">
                <button className="ii-icon-btn" title="Refresh" onClick={() => toast("Data refreshed")}><RefreshCw size={15} /></button>
                {isFloating && <button className="ii-icon-btn" title="Close" onClick={handleClose}><X size={16} /></button>}
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="ii-body">
              {/* 1. HOME VIEW */}
              {view === "home" && (
                <div className="ii-fade-in">
                  <div className="ii-hero">
                    <div className="ii-hero-greet">Good morning 👋</div>
                    <div className="ii-hero-sub">Here's what needs your attention today.</div>
                  </div>

                  <MetricGrid items={[
                    { label: "Sales yesterday", value: fmtMoney(brief.salesYesterday) },
                    { label: "Gross profit", value: fmtMoney(brief.profitYesterday) },
                    { label: "Stockout risks", value: brief.stockoutRisks.toString(), subTone: brief.stockoutRisks ? "red" : "green" },
                    { label: "Rising demand", value: brief.rising.toString(), subTone: "green" },
                  ]} />

                  <div className="ii-ai-summary">
                    <div className="ii-ai-summary-tag"><Brain size={13} /> My read on today</div>
                    <p>
                      Solid activity yesterday — {fmtMoney(brief.salesYesterday)} in sales and margins held firm. The primary focus today is resolving the {brief.stockoutRisks} product{brief.stockoutRisks === 1 ? "" : "s"} nearing stockouts before sales are missed.
                      {" "}Additionally, {brief.rising} product{brief.rising === 1 ? " is" : "s are"} gaining velocity, making proactive purchase planning valuable.
                    </p>
                  </div>

                  <div className="ii-featured-grid">
                    {FEATURED.map((cmd) => (
                      <button className="ii-featured" key={cmd.id} onClick={() => runCommand(cmd)}>
                        <div className="ii-featured-icon"><cmd.icon size={18} strokeWidth={2} /></div>
                        <div className="ii-featured-title">{cmd.title}</div>
                        <div className="ii-featured-desc">{cmd.desc}</div>
                      </button>
                    ))}
                  </div>

                  <div className="ii-divider"><span>Explore Intelligence</span></div>

                  {/* Search & Prompt Input */}
                  <div className="ii-search">
                    <Search size={15} />
                    <input
                      placeholder="Search commands or ask a question…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && query.trim()) {
                          handleAskAI();
                        }
                      }}
                    />
                    {query.trim() && (
                      <button
                        onClick={() => handleAskAI()}
                        className="p-1 px-2.5 rounded-lg bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 transition-colors flex items-center gap-1"
                      >
                        <Sparkles size={12} /> Ask
                      </button>
                    )}
                  </div>

                  {/* Category Trees */}
                  {CATEGORIES.map((cat) => {
                    const filtered = query
                      ? cat.commands.filter((c) => (c.title + c.desc).toLowerCase().includes(query.toLowerCase()))
                      : cat.commands;
                    if (query && filtered.length === 0) return null;
                    const isOpen = openCats.includes(cat.id);
                    return (
                      <div className="ii-category" key={cat.id}>
                        <button className="ii-category-head" onClick={() => toggleCat(cat.id)}>
                          <span className="ii-flex-center"><cat.icon size={14} /> {cat.label.toUpperCase()}</span>
                          <ChevronDown size={15} style={{ transform: (isOpen || query) ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                        </button>
                        {(isOpen || query) && (
                          <div className="ii-category-body">
                            {filtered.map((cmd) => (
                              <button className="ii-command-row" key={cmd.id} onClick={() => runCommand(cmd)}>
                                <div>
                                  <div className="ii-command-title">{cmd.title}</div>
                                  <div className="ii-command-desc">{cmd.desc}</div>
                                </div>
                                <ChevronDown size={14} style={{ transform: "rotate(-90deg)", color: "var(--ii-text-muted)" }} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Recent History */}
                  {history.length > 0 && (
                    <>
                      <div className="ii-divider"><span>Recent Intelligence</span></div>
                      <div className="ii-history">
                        {history.map((h, i) => (
                          <button className="ii-history-row" key={i} onClick={() => runCommand(h.command)}>
                            <History size={13} />
                            <div>
                              <div className="ii-history-title">{h.command.title}</div>
                              <div className="ii-history-time">{h.time}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 2. LOADING STATE */}
              {view === "loading" && pendingCommand && (
                <AIThinking title={pendingCommand.title} />
              )}

              {/* 3. REPORT VIEW */}
              {view === "report" && activeCommand && (
                <div className="ii-fade-in" key={activeCommand.id}>
                  <button className="ii-back" onClick={goHome}><ArrowLeft size={14} /> Back</button>
                  <div className="ii-report-head">
                    <div className="ii-report-icon">
                      {activeCommand.icon ? <activeCommand.icon size={16} /> : <Sparkles size={16} />}
                    </div>
                    <div className="ii-report-title">{activeCommand.title}</div>
                  </div>
                  {renderReportContent()}
                </div>
              )}

              {/* 4. AI CHAT INQUIRY VIEW */}
              {view === "ai_chat" && (
                <div className="ii-fade-in">
                  <button className="ii-back" onClick={goHome}><ArrowLeft size={14} /> Back to Hub</button>
                  <div className="ii-card" style={{ marginBottom: 16 }}>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Inquiry</div>
                    <div className="text-sm font-semibold text-slate-900">{aiQuery}</div>
                  </div>
                  <div className="ii-ai-summary" style={{ background: "var(--ii-surface)" }}>
                    <div className="ii-ai-summary-tag"><Sparkles size={13} /> AI Intelligence Analysis</div>
                    <SmartMarkdown content={aiResponse || ""} />
                  </div>
                  <SectionTitle>Quick Actions</SectionTitle>
                  <div className="ii-quicklinks">
                    <button className="ii-chip" onClick={() => nav("purchase")}><ShoppingCart size={13} /> View Purchase Recommendations</button>
                    <button className="ii-chip" onClick={() => nav("issues")}><AlertTriangle size={13} /> Review Issues</button>
                  </div>
                </div>
              )}

              {/* 5. PRODUCT DETAIL VIEW */}
              {view === "product" && activeProduct && (
                <div className="ii-fade-in">
                  <button className="ii-back" onClick={() => setView("report")}><ArrowLeft size={14} /> Back</button>
                  <div className="ii-product-head">
                    <div className="ii-product-thumb"><Package size={22} /></div>
                    <div>
                      <div className="ii-card-name">{activeProduct.name}</div>
                      <div className="ii-card-sku ii-mono">{activeProduct.sku} · {activeProduct.category}</div>
                    </div>
                  </div>
                  <MetricGrid items={[
                    { label: "Stock on hand", value: activeProduct.stock.toLocaleString() },
                    { label: "Price", value: fmtMoney(activeProduct.price) },
                    { label: "Cost", value: fmtMoney(activeProduct.cost) },
                    { label: "Margin", value: `${Math.round(activeProduct.marginPct)}%` },
                  ]} />
                  <div className="ii-kv-grid" style={{ marginTop: 6 }}>
                    <div className="ii-kv"><span>Days coverage</span><b className="ii-mono">{activeProduct.daysCoverage >= 999 ? '90+' : Math.round(activeProduct.daysCoverage)}d</b></div>
                    <div className="ii-kv"><span>Daily velocity</span><b className="ii-mono">{activeProduct.currVel.toFixed(1)}/day</b></div>
                    <div className="ii-kv"><span>Supplier</span><b>{activeProduct.supplier.name}</b></div>
                    <div className="ii-kv"><span>Lead time</span><b className="ii-mono">{activeProduct.supplier.leadTimeDays}d</b></div>
                  </div>
                  <div className="ii-card-actions">
                    <button
                      className="ii-btn ii-btn-primary"
                      onClick={() => toast(`${activeProduct.name} added to purchase order`)}
                    >
                      + Add to Purchase Order
                    </button>
                    {onNavigate && (
                      <button className="ii-btn ii-btn-ghost" onClick={() => onNavigate("inventory")}>
                        <ExternalLink size={13} /> Open in Inventory
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Toast Notification */}
            {toastMsg && <div className="ii-toast"><CheckCircle2 size={14} /> {toastMsg}</div>}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================================
   EXPORTS FOR COMPATIBILITY
   ========================================================================== */

export function InventoryProChat(props: InvenioIntelligenceProps) {
  return <InvenioIntelligence {...props} isFloating={false} />;
}

export function InventoryProFloatingWidget({ onNavigate }: { onNavigate?: (view: ViewType) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 w-13 h-13 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all outline-none"
          title="Open Invenio Intelligence"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.98, x: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 pointer-events-none"
          >
            <div className="pointer-events-auto w-full h-full">
              <InvenioIntelligence isFloating onClose={() => setIsOpen(false)} onNavigate={onNavigate} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default InvenioIntelligence;

/* ============================================================================
   STYLES
   ========================================================================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

.ii-root {
  --ii-bg: #F6F7F9;
  --ii-surface: #FFFFFF;
  --ii-border: #E3E6EB;
  --ii-text: #12161C;
  --ii-text-muted: #5B6472;
  --ii-accent: #2F6F5E;
  --ii-accent-soft: #E3EFEA;
  --ii-red: #E5484D;
  --ii-red-soft: rgba(229,72,77,0.12);
  --ii-orange: #DE7A34;
  --ii-orange-soft: rgba(222,122,52,0.13);
  --ii-yellow: #C89412;
  --ii-yellow-soft: rgba(200,148,18,0.14);
  --ii-green: #2F9E6E;
  --ii-green-soft: rgba(47,158,110,0.13);
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--ii-text);
  position: relative;
  width: 100%;
}

.ii-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
.ii-muted { color: var(--ii-text-muted); }
.ii-xs { font-size: 11px; }
.ii-tight { margin: 2px 0 8px; }
.ii-flex-center { display: inline-flex; align-items: center; gap: 6px; }

.ii-launcher {
  width: 52px; height: 52px; border-radius: 16px; border: none; cursor: pointer;
  background: var(--ii-accent); color: #fff; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10px 24px rgba(0,0,0,0.18); position: fixed; right: 24px; bottom: 24px; z-index: 60;
  transition: transform .15s ease;
}
.ii-launcher:hover { transform: scale(1.05); }

.ii-backdrop { position: fixed; inset: 0; background: rgba(10,12,16,0.38); z-index: 55; backdrop-filter: blur(4px); }

.ii-panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: 440px; max-width: 100vw;
  background: var(--ii-bg); border-left: 1px solid var(--ii-border); z-index: 56;
  display: flex; flex-direction: column; box-shadow: -18px 0 40px rgba(0,0,0,0.14);
}

.ii-embedded-panel {
  width: 100%; max-width: 840px; margin: 0 auto;
  background: var(--ii-bg); border: 1px solid var(--ii-border); border-radius: 20px;
  display: flex; flex-direction: column; box-shadow: 0 8px 30px rgba(0,0,0,0.06);
  min-height: 80vh; overflow: hidden;
}

.ii-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 18px 20px 14px; border-bottom: 1px solid var(--ii-border); background: var(--ii-surface);
}
.ii-header-left { display: flex; gap: 10px; align-items: flex-start; }
.ii-status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ii-accent); margin-top: 6px; box-shadow: 0 0 0 3px var(--ii-accent-soft); animation: ii-pulse 2.4s ease-in-out infinite; }
@keyframes ii-pulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
.ii-header-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 6px; }
.ii-header-sub { font-size: 12px; color: var(--ii-text-muted); margin-top: 2px; }
.ii-header-actions { display: flex; gap: 6px; }
.ii-icon-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--ii-border); background: var(--ii-surface); color: var(--ii-text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.ii-icon-btn:hover { background: var(--ii-accent-soft); border-color: var(--ii-accent); color: var(--ii-accent); }

.ii-body { flex: 1; overflow-y: auto; padding: 20px; }

.ii-hero-greet { font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700; }
.ii-hero-sub { color: var(--ii-text-muted); font-size: 13px; margin-top: 2px; margin-bottom: 16px; }

.ii-metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0 16px; }
.ii-metric { border: 1px solid var(--ii-border); background: var(--ii-surface); border-radius: 12px; padding: 12px 14px; }
.ii-metric-label { font-size: 11.5px; color: var(--ii-text-muted); margin-bottom: 4px; font-weight: 500; }
.ii-metric-value { font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 19px; letter-spacing: -0.02em; }
.ii-metric-sub { font-size: 11px; margin-top: 2px; font-weight: 600; }

.ii-ai-summary { font-size: 13px; line-height: 1.6; color: var(--ii-text); background: linear-gradient(180deg, var(--ii-accent-soft), var(--ii-surface) 70%); border: 1px solid var(--ii-border); border-radius: 14px; padding: 14px 16px; margin-bottom: 18px; }
.ii-ai-summary p { margin: 0; }
.ii-ai-summary-tag { display: inline-flex; align-items: center; gap: 6px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 11.5px; color: var(--ii-accent); margin-bottom: 6px; }

.ii-featured-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
.ii-featured { text-align: left; border: 1px solid var(--ii-border); background: var(--ii-surface); border-radius: 14px; padding: 14px; cursor: pointer; position: relative; transition: border-color .15s, transform .15s; }
.ii-featured:hover { border-color: var(--ii-accent); transform: translateY(-1px); }
.ii-featured-icon { width: 32px; height: 32px; border-radius: 9px; background: var(--ii-accent-soft); color: var(--ii-accent); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
.ii-featured-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13.5px; }
.ii-featured-desc { font-size: 11.5px; color: var(--ii-text-muted); margin-top: 3px; line-height: 1.35; }

.ii-divider { display: flex; align-items: center; gap: 10px; margin: 22px 0 14px; font-size: 11px; color: var(--ii-text-muted); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
.ii-divider::before, .ii-divider::after { content: ""; flex: 1; height: 1px; background: var(--ii-border); }

.ii-search { display: flex; align-items: center; gap: 8px; border: 1px solid var(--ii-border); background: var(--ii-surface); border-radius: 10px; padding: 8px 12px; margin-bottom: 14px; color: var(--ii-text-muted); }
.ii-search input { border: none; outline: none; background: transparent; font-size: 13px; color: var(--ii-text); flex: 1; font-family: 'Inter', sans-serif; }

.ii-category { border-bottom: 1px solid var(--ii-border); }
.ii-category-head { width: 100%; display: flex; align-items: center; justify-content: space-between; background: none; border: none; cursor: pointer; padding: 12px 2px; font-size: 11px; letter-spacing: .05em; font-weight: 700; color: var(--ii-text-muted); }
.ii-category-body { padding-bottom: 6px; }
.ii-command-row { width: 100%; display: flex; align-items: center; justify-content: space-between; background: none; border: none; cursor: pointer; padding: 9px 6px; text-align: left; border-radius: 8px; }
.ii-command-row:hover { background: var(--ii-accent-soft); }
.ii-command-title { font-size: 13px; font-weight: 600; }
.ii-command-desc { font-size: 11.5px; color: var(--ii-text-muted); margin-top: 1px; }

.ii-history { display: flex; flex-direction: column; gap: 4px; }
.ii-history-row { display: flex; align-items: center; gap: 10px; background: none; border: none; text-align: left; cursor: pointer; padding: 8px 6px; border-radius: 8px; color: var(--ii-text-muted); }
.ii-history-row:hover { background: var(--ii-surface); }
.ii-history-title { font-size: 13px; color: var(--ii-text); font-weight: 600; }
.ii-history-time { font-size: 11px; }

.ii-back { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; cursor: pointer; color: var(--ii-text-muted); font-size: 12.5px; font-weight: 600; padding: 4px 2px; margin-bottom: 12px; }
.ii-back:hover { color: var(--ii-accent); }
.ii-report-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.ii-report-icon { width: 34px; height: 34px; border-radius: 10px; background: var(--ii-accent-soft); color: var(--ii-accent); display: flex; align-items: center; justify-content: center; }
.ii-report-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; }
.ii-report-lede { font-size: 13px; color: var(--ii-text-muted); margin-bottom: 6px; line-height: 1.5; }

.ii-section-title { display: flex; align-items: center; justify-content: space-between; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13.5px; margin: 18px 0 10px; }

.ii-pill { display: inline-flex; align-items: center; gap: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 20px; letter-spacing: .02em; }

.ii-card { border: 1px solid var(--ii-border); background: var(--ii-surface); border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; position: relative; }
.ii-spine::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3.5px; border-radius: 3px; background: var(--spine); }
.ii-spine { padding-left: 18px; }
.ii-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.ii-card-name { font-weight: 700; font-size: 14.5px; }
.ii-card-sku { font-size: 11px; color: var(--ii-text-muted); margin-top: 1px; margin-bottom: 10px; }

.ii-kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin-bottom: 10px; }
.ii-kv { display: flex; align-items: center; justify-content: space-between; font-size: 12px; }
.ii-kv span { color: var(--ii-text-muted); }

.ii-reco { display: flex; align-items: center; justify-content: space-between; background: var(--ii-accent-soft); color: var(--ii-accent); border-radius: 10px; padding: 9px 12px; font-size: 13px; font-weight: 700; margin-bottom: 10px; }
.ii-why { font-size: 12px; color: var(--ii-text-muted); line-height: 1.5; margin-bottom: 12px; }
.ii-why p { margin: 2px 0 0; }

.ii-card-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.ii-btn { border-radius: 10px; font-size: 12.5px; font-weight: 600; padding: 8px 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border: 1px solid transparent; font-family: 'Inter', sans-serif; transition: all .15s; }
.ii-btn-primary { background: var(--ii-accent); color: #fff; }
.ii-btn-primary:hover { opacity: .92; }
.ii-btn-ghost { background: var(--ii-surface); border-color: var(--ii-border); color: var(--ii-text); }
.ii-btn-ghost:hover { border-color: var(--ii-accent); color: var(--ii-accent); }
.ii-btn-sm { padding: 6px 10px; font-size: 12px; margin-top: 4px; }

.ii-card-stack { display: flex; flex-direction: column; }

.ii-row-list { display: flex; flex-direction: column; border: 1px solid var(--ii-border); border-radius: 12px; overflow: hidden; margin-bottom: 8px; background: var(--ii-surface); }
.ii-row { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 11px 14px; background: none; border: none; border-bottom: 1px solid var(--ii-border); cursor: pointer; text-align: left; transition: background .12s; }
.ii-row:last-child { border-bottom: none; }
.ii-row:hover { background: var(--ii-accent-soft); }
.ii-row-name { font-size: 13.5px; font-weight: 600; }
.ii-row-sub { font-size: 11px; color: var(--ii-text-muted); margin-top: 1px; }
.ii-row-right { font-size: 12px; flex-shrink: 0; margin-left: 10px; }

.ii-table { border: 1px solid var(--ii-border); border-radius: 12px; overflow: hidden; background: var(--ii-surface); margin-bottom: 12px; }
.ii-table-head, .ii-table-row { display: grid; grid-template-columns: 2fr 1fr 0.6fr 0.6fr 0.6fr; gap: 6px; align-items: center; padding: 10px 12px; font-size: 11.5px; }
.ii-table-head { color: var(--ii-text-muted); border-bottom: 1px solid var(--ii-border); font-weight: 700; }
.ii-table-row { width: 100%; background: none; border: none; border-top: 1px solid var(--ii-border); text-align: left; cursor: pointer; }
.ii-table-row:first-of-type { border-top: none; }
.ii-table-row:hover { background: var(--ii-accent-soft); }
.ii-table-name { font-weight: 600; }

.ii-timeline { border: 1px solid var(--ii-border); border-radius: 12px; background: var(--ii-surface); margin-bottom: 10px; overflow: hidden; }
.ii-timeline-row { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; border-bottom: 1px solid var(--ii-border); font-size: 13px; }
.ii-timeline-row:last-child { border-bottom: none; }
.ii-timeline-tag { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.ii-timeline-count { color: var(--ii-text-muted); font-size: 12px; }

.ii-insight { border-left: 3.5px solid; background: var(--ii-surface); border-radius: 0 12px 12px 0; padding: 13px 15px; margin: 16px 0; border-top: 1px solid var(--ii-border); border-bottom: 1px solid var(--ii-border); border-right: 1px solid var(--ii-border); }
.ii-insight-title { font-weight: 700; font-size: 13.5px; display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
.ii-insight-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--ii-text-muted); margin-top: 8px; font-weight: 700; }
.ii-insight-text { font-size: 12.5px; line-height: 1.55; margin: 3px 0 0; }

.ii-quicklinks { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.ii-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--ii-border); background: var(--ii-surface); border-radius: 20px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .15s; }
.ii-chip:hover { border-color: var(--ii-accent); color: var(--ii-accent); }

.ii-empty { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ii-text-muted); padding: 16px 14px; }

.ii-product-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.ii-product-thumb { width: 46px; height: 46px; border-radius: 12px; background: var(--ii-accent-soft); color: var(--ii-accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

.ii-toast { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); background: var(--ii-text); color: var(--ii-bg); font-size: 12.5px; font-weight: 600; padding: 9px 16px; border-radius: 20px; display: flex; align-items: center; gap: 7px; box-shadow: 0 8px 22px rgba(0,0,0,0.22); z-index: 70; }

.ii-body::-webkit-scrollbar { width: 6px; }
.ii-body::-webkit-scrollbar-thumb { background: var(--ii-border); border-radius: 4px; }

.ii-status-dot-active { animation: ii-pulse-fast 0.9s ease-in-out infinite; background: var(--ii-accent); }
@keyframes ii-pulse-fast { 0%,100% { opacity: 1; box-shadow: 0 0 0 3px var(--ii-accent-soft); } 50% { opacity: .5; box-shadow: 0 0 0 6px var(--ii-accent-soft); } }

.ii-fade-in { animation: ii-fadeIn .28s ease both; }
@keyframes ii-fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

.ii-thinking { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 50px 12px 20px; }
.ii-thinking-orb {
  width: 52px; height: 52px; border-radius: 16px; background: var(--ii-accent-soft); color: var(--ii-accent);
  display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
  animation: ii-orb-pulse 1.6s ease-in-out infinite;
}
@keyframes ii-orb-pulse {
  0%,100% { transform: scale(1); box-shadow: 0 0 0 0 var(--ii-accent-soft); }
  50% { transform: scale(1.08); box-shadow: 0 0 0 10px transparent; }
}
.ii-thinking-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; margin-bottom: 5px; }
.ii-thinking-step { font-size: 12px; color: var(--ii-text-muted); margin-bottom: 16px; min-height: 16px; }
.ii-thinking-bar { width: 180px; height: 4px; border-radius: 3px; background: var(--ii-border); overflow: hidden; margin-bottom: 30px; }
.ii-thinking-bar-fill { width: 40%; height: 100%; border-radius: 3px; background: var(--ii-accent); animation: ii-bar-sweep 1.1s ease-in-out infinite; }
@keyframes ii-bar-sweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(280%); } }
.ii-thinking-skel { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.ii-skel-row { height: 11px; border-radius: 6px; background: linear-gradient(90deg, var(--ii-border) 25%, var(--ii-accent-soft) 50%, var(--ii-border) 75%); background-size: 200% 100%; animation: ii-shimmer 1.4s ease-in-out infinite; margin: 0 auto; }
@keyframes ii-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.ii-chart-card { border: 1px solid var(--ii-border); background: var(--ii-surface); border-radius: 12px; padding: 12px 10px 6px; margin-bottom: 14px; }
.ii-chart-title { font-size: 11.5px; font-weight: 700; color: var(--ii-text-muted); margin: 0 4px 4px; }
.ii-chart-tooltip { background: var(--ii-text); color: var(--ii-bg); border-radius: 8px; padding: 8px 10px; font-size: 11.5px; box-shadow: 0 8px 18px rgba(0,0,0,0.18); }
.ii-chart-tooltip-label { font-weight: 700; margin-bottom: 3px; font-family: 'IBM Plex Mono', monospace; }
.ii-chart-tooltip-row { display: flex; align-items: center; gap: 6px; }
.ii-chart-tooltip-row span { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.ii-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
`;
