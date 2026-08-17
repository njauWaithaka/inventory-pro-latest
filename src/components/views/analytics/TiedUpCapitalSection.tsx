import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Package,
  Search,
  Filter,
  ArrowUpDown,
  Sparkles,
  Info,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { Product } from '../../../types';
import { cn } from '../../../lib/utils';

interface TiedUpCapitalSectionProps {
  products: Product[];
  currency?: string;
  onNavigateToProduct?: (sku: string) => void;
}

export interface TiedUpProductItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  price: number;
  totalValue: number;
  movement: 'fast' | 'moderate' | 'slow' | 'obsolete';
  actionStatus: 'review' | 'fast_mover' | 'healthy' | 'liquidate';
  actionLabel: string;
  riskReason: string;
}

export function TiedUpCapitalSection({
  products = [],
  currency = 'KSh',
  onNavigateToProduct
}: TiedUpCapitalSectionProps) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'review' | 'fast' | 'healthy'>('all');
  const [sortField, setSortField] = useState<'totalValue' | 'quantity' | 'price' | 'name'>('totalValue');
  const [sortAsc, setSortAsc] = useState(false);

  // Process and classify catalog items
  const processedItems = useMemo<TiedUpProductItem[]>(() => {
    if (!products || products.length === 0) return [];

    return products.map(p => {
      const quantity = Math.max(0, Number(p.quantity || p.currentStock || 0));
      const price = Math.max(0, Number(p.value || p.buyingPrice || p.costPrice || p.unitPrice || 0));
      const totalValue = quantity * price;
      const movement = (p.movement || 'slow').toLowerCase() as 'fast' | 'moderate' | 'slow' | 'obsolete';
      
      let actionStatus: 'review' | 'fast_mover' | 'healthy' | 'liquidate' = 'healthy';
      let actionLabel = '✓ Healthy';
      let riskReason = 'Balanced stock level with steady demand';

      if (movement === 'obsolete') {
        actionStatus = 'liquidate';
        actionLabel = '⚡ Liquidate';
        riskReason = 'Dead stock tying up capital with zero recent turnover';
      } else if (movement === 'slow' || (quantity >= 20 && price >= 100)) {
        actionStatus = 'review';
        actionLabel = '⚠ Review';
        riskReason = 'High value sitting in slow-moving inventory';
      } else if (movement === 'fast') {
        actionStatus = 'fast_mover';
        actionLabel = '✓ Fast mover';
        riskReason = 'High velocity demand with quick capital turnover';
      }

      return {
        id: p.id || p.sku || p.name,
        name: p.name || p.productName || 'Unnamed Product',
        sku: p.sku || p.id || 'N/A',
        category: p.category || 'General',
        quantity,
        price,
        totalValue,
        movement,
        actionStatus,
        actionLabel,
        riskReason
      };
    });
  }, [products]);

  // Aggregate KPI Calculations
  const stats = useMemo(() => {
    const totalValue = processedItems.reduce((sum, item) => sum + item.totalValue, 0);
    const needAttentionItems = processedItems.filter(
      item => item.actionStatus === 'review' || item.actionStatus === 'liquidate'
    );
    const slowMovingTiedCapital = needAttentionItems.reduce((sum, item) => sum + item.totalValue, 0);

    // Calculate median/average values for chart axis quadrant demarcation
    const validPrices = processedItems.map(i => i.price).filter(p => p > 0);
    const validQuantities = processedItems.map(i => i.quantity).filter(q => q > 0);

    const avgPrice = validPrices.length > 0 
      ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length) 
      : 50;
    const avgQuantity = validQuantities.length > 0 
      ? Math.round(validQuantities.reduce((a, b) => a + b, 0) / validQuantities.length) 
      : 15;

    const maxPrice = Math.max(...validPrices, 100);
    const maxQuantity = Math.max(...validQuantities, 50);

    return {
      totalValue,
      needAttentionCount: needAttentionItems.length,
      slowMovingTiedCapital,
      avgPrice,
      avgQuantity,
      maxPrice,
      maxQuantity
    };
  }, [processedItems]);

  // Scatter plot data items (limit to top 80 to keep rendering ultra smooth)
  const scatterItems = useMemo(() => {
    return [...processedItems]
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 80);
  }, [processedItems]);

  // Filtered & Sorted Table Items
  const filteredTableItems = useMemo(() => {
    return processedItems
      .filter(item => {
        const matchesSearch = 
          item.name.toLowerCase().includes(tableSearch.toLowerCase()) ||
          item.sku.toLowerCase().includes(tableSearch.toLowerCase()) ||
          item.category.toLowerCase().includes(tableSearch.toLowerCase());

        if (!matchesSearch) return false;

        if (activeFilter === 'review') {
          return item.actionStatus === 'review' || item.actionStatus === 'liquidate';
        }
        if (activeFilter === 'fast') {
          return item.actionStatus === 'fast_mover';
        }
        if (activeFilter === 'healthy') {
          return item.actionStatus === 'healthy';
        }
        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];
        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [processedItems, tableSearch, activeFilter, sortField, sortAsc]);

  const handleSort = (field: 'totalValue' | 'quantity' | 'price' | 'name') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const activeSelectedProduct = useMemo(() => {
    const targetId = hoveredProductId || selectedProductId;
    if (!targetId) return null;
    return processedItems.find(p => p.id === targetId) || null;
  }, [hoveredProductId, selectedProductId, processedItems]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm text-left overflow-hidden">
      
      {/* 1. Header & Context */}
      <div className="p-6 md:p-8 border-b border-slate-100 bg-gradient-to-b from-slate-50/70 to-white">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold mb-2.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Capital Allocation & Working Cash Diagnostic</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Which products are tying up your money?
            </h3>
            <p className="text-sm font-medium text-slate-600 mt-1 max-w-3xl">
              Products with more stock and higher prices hold more of your cash. See where your stock money is sitting.
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block shadow-xs"></span>
              <span>Needs Attention</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-xs"></span>
              <span>Fast Mover</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block shadow-xs"></span>
              <span>Healthy</span>
            </div>
          </div>
        </div>

        {/* 2. SUMMARY METRIC CARDS DIRECTLY ABOVE CHART */}
        <div className="mt-6 pt-6 border-t border-slate-200/80">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-slate-400" />
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Stock value at a glance
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Total value represented */}
            <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Total Capital Represented</span>
                <DollarSign className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2">
                <p className="text-2xl sm:text-3xl font-black text-slate-900 font-sans tracking-tight">
                  {currency} {stats.totalValue.toLocaleString()}
                </p>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Total value across {processedItems.length} active inventory items
                </p>
              </div>
            </div>

            {/* Card 2: Need attention */}
            <div className="p-4 sm:p-5 rounded-xl bg-rose-50/50 border border-rose-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-rose-800 text-xs font-bold">
                <span>Items Requiring Action</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="mt-2">
                <p className="text-2xl sm:text-3xl font-black text-rose-700 font-sans tracking-tight">
                  {stats.needAttentionCount} {stats.needAttentionCount === 1 ? 'product' : 'products'}
                </p>
                <p className="text-xs font-bold text-rose-600 mt-1">
                  Need attention & stock review
                </p>
              </div>
            </div>

            {/* Card 3: Capital tied up in slow-moving stock */}
            <div className="p-4 sm:p-5 rounded-xl bg-amber-50/50 border border-amber-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-amber-800 text-xs font-bold">
                <span>Capital At Risk</span>
                <Info className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2">
                <p className="text-2xl sm:text-3xl font-black text-amber-700 font-sans tracking-tight">
                  {currency} {stats.slowMovingTiedCapital.toLocaleString()}
                </p>
                <p className="text-xs font-bold text-amber-700 mt-1">
                  Capital tied up in slow-moving stock
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. VISUAL MATRIX & SCATTER PLOT */}
      <div className="p-6 md:p-8 space-y-6">
        
        {/* Visual Map Quadrant Labels Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-900">
            <span className="font-bold block text-[11px] uppercase tracking-wider text-amber-700">Top-Left Quadrant</span>
            <p className="font-semibold text-xs mt-0.5">High Price · Low Stock</p>
            <span className="text-[10px] text-amber-600">Controlled high-value units</span>
          </div>

          <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 text-rose-900">
            <span className="font-bold block text-[11px] uppercase tracking-wider text-rose-700">Top-Right Quadrant</span>
            <p className="font-semibold text-xs mt-0.5">High Price · High Stock</p>
            <span className="text-[10px] text-rose-600 font-bold">⚠ Highest capital tied up</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
            <span className="font-bold block text-[11px] uppercase tracking-wider text-slate-500">Bottom-Left Quadrant</span>
            <p className="font-semibold text-xs mt-0.5">Low Price · Low Stock</p>
            <span className="text-[10px] text-slate-500">Minimal capital impact</span>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900">
            <span className="font-bold block text-[11px] uppercase tracking-wider text-emerald-700">Bottom-Right Quadrant</span>
            <p className="font-semibold text-xs mt-0.5">Low Price · High Stock</p>
            <span className="text-[10px] text-emerald-600">Volume buffer / Fast turns</span>
          </div>
        </div>

        {/* Selected Product Floating Inspector Bar */}
        {activeSelectedProduct && (
          <div className="p-3.5 bg-slate-900 text-white rounded-xl shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-3 h-3 rounded-full shrink-0",
                activeSelectedProduct.actionStatus === 'review' || activeSelectedProduct.actionStatus === 'liquidate'
                  ? "bg-rose-400"
                  : activeSelectedProduct.actionStatus === 'fast_mover'
                  ? "bg-emerald-400"
                  : "bg-blue-400"
              )} />
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="font-black text-sm text-white">{activeSelectedProduct.name}</h5>
                  <span className="text-[10px] text-slate-400 font-mono">({activeSelectedProduct.sku})</span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  {currency} {activeSelectedProduct.price.toLocaleString()} × {activeSelectedProduct.quantity} units = <strong className="text-amber-300">{currency} {activeSelectedProduct.totalValue.toLocaleString()}</strong> tied up
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs px-2.5 py-0.5 rounded-full font-bold border",
                activeSelectedProduct.actionStatus === 'review' || activeSelectedProduct.actionStatus === 'liquidate'
                  ? "bg-rose-950/80 text-rose-300 border-rose-700"
                  : activeSelectedProduct.actionStatus === 'fast_mover'
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                  : "bg-blue-950/80 text-blue-300 border-blue-700"
              )}>
                {activeSelectedProduct.actionLabel}
              </span>
              {onNavigateToProduct && (
                <button
                  type="button"
                  onClick={() => onNavigateToProduct(activeSelectedProduct.sku)}
                  className="px-2.5 py-1 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 rounded-lg flex items-center gap-1 transition-all"
                >
                  <span>Inspect</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* The Scatter Chart Container */}
        <div className="h-[380px] sm:h-[420px] w-full bg-slate-50/40 rounded-xl border border-slate-200/90 p-3 pt-6 relative">
          
          {/* Visual Axis Directional Callouts */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 bg-white/90 px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs pointer-events-none z-10">
            ▲ High Unit Price
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 bg-white/90 px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs pointer-events-none z-10">
            ▼ Low Unit Price
          </div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 bg-white/90 px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs pointer-events-none z-10">
            ◄ Low Stock
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 bg-white/90 px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs pointer-events-none z-10">
            High Stock ►
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 25, right: 35, bottom: 25, left: 35 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              
              <XAxis 
                type="number" 
                dataKey="quantity" 
                name="Stock Quantity" 
                axisLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }} 
                tickLine={false}
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                label={{ 
                  value: 'STOCK QUANTITY (Units on Hand)', 
                  position: 'insideBottom', 
                  offset: -12, 
                  fontSize: 11, 
                  fontWeight: 800,
                  fill: '#475569'
                }}
              />
              
              <YAxis 
                type="number" 
                dataKey="price" 
                name="Unit Price" 
                axisLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }} 
                tickLine={false}
                tickFormatter={(val) => `${currency}${val.toLocaleString()}`}
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                label={{ 
                  value: `UNIT PRICE (${currency})`, 
                  angle: -90, 
                  position: 'insideLeft', 
                  fontSize: 11, 
                  fontWeight: 800,
                  fill: '#475569',
                  offset: 0
                }}
              />

              <ZAxis 
                type="number" 
                dataKey="totalValue" 
                range={[70, 420]} 
                name="Capital Tied Up" 
              />

              {/* Reference threshold lines */}
              <ReferenceLine 
                x={stats.avgQuantity} 
                stroke="#cbd5e1" 
                strokeDasharray="4 4" 
                strokeWidth={1.5}
              />
              <ReferenceLine 
                y={stats.avgPrice} 
                stroke="#cbd5e1" 
                strokeDasharray="4 4" 
                strokeWidth={1.5}
              />

              <Tooltip 
                cursor={{ strokeDasharray: '3 3', stroke: '#3b82f6', strokeWidth: 1.5 }} 
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const data: TiedUpProductItem = payload[0].payload;
                  return (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xl text-left max-w-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                        <div>
                          <p className="text-xs font-extrabold text-slate-900 line-clamp-1">{data.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{data.sku} · {data.category}</p>
                        </div>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0",
                          data.actionStatus === 'review' || data.actionStatus === 'liquidate'
                            ? "bg-rose-100 text-rose-800"
                            : data.actionStatus === 'fast_mover'
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        )}>
                          {data.actionLabel}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1 font-mono text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Unit Price:</span>
                          <span className="font-bold text-slate-900">{currency} {data.price.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Stock on Hand:</span>
                          <span className="font-bold text-slate-900">{data.quantity} units</span>
                        </div>
                        <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1 mt-1 text-[13px]">
                          <span>Tied Up Capital:</span>
                          <span className="text-blue-700">{currency} {data.totalValue.toLocaleString()}</span>
                        </div>
                      </div>

                      <p className="text-[10px] font-medium text-slate-500 leading-tight">
                        {data.riskReason}
                      </p>
                    </div>
                  );
                }}
              />

              <Scatter 
                name="Products" 
                data={scatterItems}
                onClick={(node) => {
                  if (node && node.id) {
                    setSelectedProductId(node.id === selectedProductId ? null : node.id);
                  }
                }}
                onMouseEnter={(node) => {
                  if (node && node.id) setHoveredProductId(node.id);
                }}
                onMouseLeave={() => setHoveredProductId(null)}
              >
                {scatterItems.map((entry) => {
                  const isSelected = selectedProductId === entry.id || hoveredProductId === entry.id;
                  let fill = '#3b82f6'; // Healthy Blue

                  if (entry.actionStatus === 'review' || entry.actionStatus === 'liquidate') {
                    fill = '#ef4444'; // Red for Review
                  } else if (entry.actionStatus === 'fast_mover') {
                    fill = '#10b981'; // Green for Fast mover
                  }

                  return (
                    <Cell 
                      key={`cell-${entry.id}`} 
                      fill={fill} 
                      fillOpacity={isSelected ? 1 : 0.75}
                      stroke={isSelected ? '#0f172a' : '#ffffff'}
                      strokeWidth={isSelected ? 3 : 1.5}
                      className="cursor-pointer transition-all duration-150"
                    />
                  );
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* 4. "WHERE IS YOUR MONEY SITTING?" DATA TABLE */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-black text-slate-900 tracking-tight">
                Where is your money sitting?
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Detailed capital breakdown and recommended inventory management action per product
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  activeFilter === 'all'
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                All ({processedItems.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('review')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5",
                  activeFilter === 'review'
                    ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                    : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                )}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>⚠ Needs Attention ({stats.needAttentionCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('fast')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5",
                  activeFilter === 'fast'
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                    : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                )}
              >
                <TrendingUp className="w-3 h-3" />
                <span>✓ Fast Movers</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('healthy')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  activeFilter === 'healthy'
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                    : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                )}
              >
                ✓ Healthy
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search products by title, SKU, or category to see tied-up capital..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            />
          </div>

          {/* Responsive Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Product</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 text-center cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('quantity')}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Stock</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Price</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('totalValue')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Stock Value</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTableItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                      No products found matching your search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTableItems.slice(0, 30).map((item) => {
                    const isSelected = selectedProductId === item.id || hoveredProductId === item.id;
                    return (
                      <tr
                        key={item.id}
                        onMouseEnter={() => setHoveredProductId(item.id)}
                        onMouseLeave={() => setHoveredProductId(null)}
                        onClick={() => setSelectedProductId(item.id === selectedProductId ? null : item.id)}
                        className={cn(
                          "cursor-pointer transition-colors group",
                          isSelected ? "bg-blue-50/80" : "hover:bg-slate-50/70"
                        )}
                      >
                        {/* Product Column */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              "w-2.5 h-2.5 rounded-full shrink-0",
                              item.actionStatus === 'review' || item.actionStatus === 'liquidate'
                                ? "bg-rose-500"
                                : item.actionStatus === 'fast_mover'
                                ? "bg-emerald-500"
                                : "bg-blue-500"
                            )} />
                            <div>
                              <p className="font-bold text-slate-900 text-xs group-hover:text-blue-600 transition-colors">
                                {item.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {item.sku} · {item.category}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Stock Column */}
                        <td className="py-3 px-4 text-center font-semibold text-slate-700 font-mono">
                          {item.quantity}
                        </td>

                        {/* Price Column */}
                        <td className="py-3 px-4 text-right font-semibold text-slate-700 font-mono">
                          {currency} {item.price.toLocaleString()}
                        </td>

                        {/* Stock Value Column */}
                        <td className="py-3 px-4 text-right font-black text-slate-900 font-mono">
                          {currency} {item.totalValue.toLocaleString()}
                        </td>

                        {/* Action Column */}
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border",
                            item.actionStatus === 'review' || item.actionStatus === 'liquidate'
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : item.actionStatus === 'fast_mover'
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          )}>
                            {item.actionLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredTableItems.length > 30 && (
            <p className="text-[11px] text-slate-400 text-center font-medium">
              Showing top 30 of {filteredTableItems.length} products. Use search to find specific SKUs.
            </p>
          )}

        </div>

      </div>

    </div>
  );
}
