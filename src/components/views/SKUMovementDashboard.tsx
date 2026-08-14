import React, { useState, useMemo } from 'react';
import { 
  Package, Clock, TrendingUp, AlertTriangle, Flame, ShieldAlert, 
  Search, ArrowUpDown, Filter, ChevronRight, BarChart2, CheckCircle2,
  Calendar, Layers, DollarSign, Activity, Boxes, AlertCircle
} from 'lucide-react';
import { cn, formatCompactNumber } from '../../lib/utils';
import { 
  calculateInventoryAgingAnalysis, 
  SKUAgingDetails, 
  MovementClass 
} from '../../lib/inventoryAgingService';

interface SKUMovementDashboardProps {
  products: any[];
  movements?: any[];
  sales?: any[];
  currency?: string;
  title?: string;
  subtitle?: string;
}

type SortField = 'productName' | 'currentStock' | 'inventoryAgeDays' | 'movementClass' | 'averageDailySales' | 'stockValue' | 'lastSaleDate' | 'oldestRemainingStockDate';

export function SKUMovementDashboard({
  products = [],
  movements = [],
  sales = [],
  currency = 'KSh',
  title = 'SKU Movement & Inventory Aging Analytics',
  subtitle = 'Automatic FIFO inventory aging and movement classification'
}: SKUMovementDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<MovementClass | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('inventoryAgeDays');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Compute full dynamic inventory aging analysis
  const agingAnalysis = useMemo(() => {
    return calculateInventoryAgingAnalysis(products, movements, sales);
  }, [products, movements, sales]);

  const { dashboardCounts, agingBuckets, allSKUDetails, totalSKUs, totalInventoryValue } = agingAnalysis;

  // Filter and sort SKUs for table
  const filteredSKUs = useMemo(() => {
    return allSKUDetails.filter(item => {
      const matchesSearch = 
        item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesClass = selectedClass === 'all' || item.movementClass === selectedClass;

      return matchesSearch && matchesClass;
    });
  }, [allSKUDetails, searchQuery, selectedClass]);

  const sortedSKUs = useMemo(() => {
    return [...filteredSKUs].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'productName') {
        valA = a.productName.toLowerCase();
        valB = b.productName.toLowerCase();
      }

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSKUs, sortField, sortDirection]);

  // Reset page on filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedClass]);

  // Pagination
  const totalPages = Math.ceil(sortedSKUs.length / pageSize) || 1;
  const paginatedSKUs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedSKUs.slice(start, start + pageSize);
  }, [sortedSKUs, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 lg:p-8 space-y-8 text-left min-w-0">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-50 text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">
            Dynamic Inventory Control
          </div>
          <h2 className="text-xl font-black text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 shrink-0">
          <Boxes className="w-4 h-4 text-emerald-600" />
          <span>{totalSKUs} Total SKUs</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-900 font-black">{currency} {formatCompactNumber(totalInventoryValue)} Value</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. SKU MOVEMENT DASHBOARD CARDS (Requirement 3)             */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        
        {/* Fast Moving */}
        <div 
          onClick={() => setSelectedClass(selectedClass === 'fast' ? 'all' : 'fast')}
          className={cn(
            "cursor-pointer transition-all duration-200 p-4 rounded-xl border space-y-2 text-left relative overflow-hidden",
            selectedClass === 'fast' 
              ? "bg-emerald-50 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20" 
              : "bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-50/70"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
              <span>🟢</span>
              <span>Fast Moving</span>
            </span>
            <span className="text-[10px] font-bold text-emerald-700 font-mono">0–30 Days</span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-950 leading-none">
                {dashboardCounts.fast.count}
              </span>
              <span className="text-xs font-extrabold text-emerald-700">
                SKUs ({dashboardCounts.fast.percentage}%)
              </span>
            </div>
            <p className="text-[10px] font-bold text-emerald-800 mt-1">
              {currency} {formatCompactNumber(dashboardCounts.fast.value)} Tied Capital
            </p>
          </div>
        </div>

        {/* Moderate Moving */}
        <div 
          onClick={() => setSelectedClass(selectedClass === 'moderate' ? 'all' : 'moderate')}
          className={cn(
            "cursor-pointer transition-all duration-200 p-4 rounded-xl border space-y-2 text-left relative overflow-hidden",
            selectedClass === 'moderate' 
              ? "bg-blue-50 border-blue-500 shadow-xs ring-2 ring-blue-500/20" 
              : "bg-blue-50/40 border-blue-200/80 hover:border-blue-400 hover:bg-blue-50/70"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md flex items-center gap-1">
              <span>🟡</span>
              <span>Moderate</span>
            </span>
            <span className="text-[10px] font-bold text-blue-700 font-mono">31–90 Days</span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-blue-950 leading-none">
                {dashboardCounts.moderate.count}
              </span>
              <span className="text-xs font-extrabold text-blue-700">
                SKUs ({dashboardCounts.moderate.percentage}%)
              </span>
            </div>
            <p className="text-[10px] font-bold text-blue-800 mt-1">
              {currency} {formatCompactNumber(dashboardCounts.moderate.value)} Tied Capital
            </p>
          </div>
        </div>

        {/* Slow Moving */}
        <div 
          onClick={() => setSelectedClass(selectedClass === 'slow' ? 'all' : 'slow')}
          className={cn(
            "cursor-pointer transition-all duration-200 p-4 rounded-xl border space-y-2 text-left relative overflow-hidden",
            selectedClass === 'slow' 
              ? "bg-amber-50 border-amber-500 shadow-xs ring-2 ring-amber-500/20" 
              : "bg-amber-50/40 border-amber-200/80 hover:border-amber-400 hover:bg-amber-50/70"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
              <span>🟠</span>
              <span>Slow Moving</span>
            </span>
            <span className="text-[10px] font-bold text-amber-700 font-mono">91–180 Days</span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-950 leading-none">
                {dashboardCounts.slow.count}
              </span>
              <span className="text-xs font-extrabold text-amber-700">
                SKUs ({dashboardCounts.slow.percentage}%)
              </span>
            </div>
            <p className="text-[10px] font-bold text-amber-800 mt-1">
              {currency} {formatCompactNumber(dashboardCounts.slow.value)} Tied Capital
            </p>
          </div>
        </div>

        {/* Obsolete */}
        <div 
          onClick={() => setSelectedClass(selectedClass === 'obsolete' ? 'all' : 'obsolete')}
          className={cn(
            "cursor-pointer transition-all duration-200 p-4 rounded-xl border space-y-2 text-left relative overflow-hidden",
            selectedClass === 'obsolete' 
              ? "bg-rose-50 border-rose-500 shadow-xs ring-2 ring-rose-500/20" 
              : "bg-rose-50/40 border-rose-200/80 hover:border-rose-400 hover:bg-rose-50/70"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md flex items-center gap-1">
              <span>🔴</span>
              <span>Obsolete</span>
            </span>
            <span className="text-[10px] font-bold text-rose-700 font-mono">180+ Days</span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-rose-950 leading-none">
                {dashboardCounts.obsolete.count}
              </span>
              <span className="text-xs font-extrabold text-rose-700">
                SKUs ({dashboardCounts.obsolete.percentage}%)
              </span>
            </div>
            <p className="text-[10px] font-bold text-rose-800 mt-1">
              {currency} {formatCompactNumber(dashboardCounts.obsolete.value)} Tied Capital
            </p>
          </div>
        </div>

        {/* Out of Stock (Separated as per Rule 9) */}
        <div 
          onClick={() => setSelectedClass(selectedClass === 'out_of_stock' ? 'all' : 'out_of_stock')}
          className={cn(
            "col-span-2 lg:col-span-1 cursor-pointer transition-all duration-200 p-4 rounded-xl border space-y-2 text-left relative overflow-hidden",
            selectedClass === 'out_of_stock' 
              ? "bg-slate-100 border-slate-500 shadow-xs ring-2 ring-slate-500/20" 
              : "bg-slate-50 border-slate-200 hover:border-slate-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 bg-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
              <span>⚪</span>
              <span>Out of Stock</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500 font-mono">0 Units</span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">
                {dashboardCounts.outOfStock.count}
              </span>
              <span className="text-xs font-extrabold text-slate-600">
                SKUs ({dashboardCounts.outOfStock.percentage}%)
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-500 mt-1">
              Depleted Stock Items
            </p>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 2. INVENTORY AGING ANALYSIS BUCKET SECTION (Requirement 5) */}
      {/* ========================================================= */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Inventory Aging Buckets Analysis</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Capital tied up across inventory age ranges calculated from remaining unsold FIFO stock
            </p>
          </div>

          <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-lg">
            Formula: Inventory Age = Current Date − Oldest Unsold Stock Date
          </span>
        </div>

        {/* Buckets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {agingBuckets.map((bucket) => {
            const isFast = bucket.movementClass === 'fast';
            const isMod = bucket.movementClass === 'moderate';
            const isSlow = bucket.movementClass === 'slow';

            return (
              <div 
                key={bucket.bucketName}
                className={cn(
                  "bg-white border rounded-xl p-4 space-y-3 shadow-2xs text-left",
                  isFast ? "border-emerald-200" : isMod ? "border-blue-200" : isSlow ? "border-amber-200" : "border-rose-200"
                )}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{isFast ? '🟢' : isMod ? '🟡' : isSlow ? '🟠' : '🔴'}</span>
                    <span className="font-black text-slate-900 text-sm">{bucket.movementLabel}</span>
                  </div>
                  <span className="text-xs font-mono font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    {bucket.ageRange}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">SKU Count:</span>
                    <span className="font-bold text-slate-900">{bucket.skuCount} ({bucket.skuPercentage}%)</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Total Quantity:</span>
                    <span className="font-bold text-slate-900">{bucket.totalUnits.toLocaleString()} units</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Capital Value:</span>
                    <span className="font-black text-slate-900 font-mono">
                      {currency} {bucket.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-100 font-bold">
                    <span className="text-slate-600">% of Total Value:</span>
                    <span className={cn(isFast ? "text-emerald-700" : isMod ? "text-blue-700" : isSlow ? "text-amber-700" : "text-rose-700")}>
                      {bucket.valuePercentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isFast ? "bg-emerald-500" : isMod ? "bg-blue-500" : isSlow ? "bg-amber-500" : "bg-rose-500"
                    )}
                    style={{ width: `${Math.max(bucket.valuePercentage, 2)}%` }}
                  />
                </div>

                <p className="text-[10px] text-slate-500 font-medium italic pt-1 border-t border-slate-100 leading-tight">
                  {bucket.actionRecommendation}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. SKU-LEVEL DETAILED TABLE (Requirement 4)                */}
      {/* ========================================================= */}
      <div className="space-y-4">
        
        {/* Table Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>SKU Inventory Aging Details</span>
              <span className="text-xs font-bold bg-slate-100 px-2.5 py-0.5 rounded-full text-slate-600">
                {sortedSKUs.length} SKUs
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Live calculated inventory age, classification, average daily sales, and stock value
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:w-64 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search SKU or Product Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>

            {/* Classification Filter */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              {[
                { id: 'all', label: 'All' },
                { id: 'fast', label: '🟢 Fast' },
                { id: 'moderate', label: '🟡 Mod' },
                { id: 'slow', label: '🟠 Slow' },
                { id: 'obsolete', label: '🔴 Obsolete' },
                { id: 'out_of_stock', label: '⚪ OOS' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedClass(item.id as any)}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider",
                    selectedClass === item.id 
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-3.5">
                  <button onClick={() => handleSort('productName')} className="flex items-center gap-1 hover:text-slate-900">
                    Product Name & SKU <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button onClick={() => handleSort('currentStock')} className="flex items-center gap-1 justify-end hover:text-slate-900 ml-auto">
                    Stock Qty <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button onClick={() => handleSort('averageDailySales')} className="flex items-center gap-1 justify-end hover:text-slate-900 ml-auto">
                    Avg Daily Sales <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button onClick={() => handleSort('inventoryAgeDays')} className="flex items-center gap-1 justify-end hover:text-slate-900 ml-auto">
                    Inventory Age <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-center">
                  <button onClick={() => handleSort('movementClass')} className="flex items-center gap-1 justify-center hover:text-slate-900 mx-auto">
                    Classification <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button onClick={() => handleSort('stockValue')} className="flex items-center gap-1 justify-end hover:text-slate-900 ml-auto">
                    Stock Value <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button onClick={() => handleSort('oldestRemainingStockDate')} className="flex items-center gap-1 justify-end hover:text-slate-900 ml-auto">
                    Oldest Stock Date <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button onClick={() => handleSort('lastSaleDate')} className="flex items-center gap-1 justify-end hover:text-slate-900 ml-auto">
                    Last Sale Date <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {paginatedSKUs.map((sku) => {
                return (
                  <tr key={sku.productId || sku.sku} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Name & SKU */}
                    <td className="py-3 px-3.5">
                      <div>
                        <p className="font-bold text-slate-900 line-clamp-1">{sku.productName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-bold">
                            {sku.sku}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{sku.category}</span>
                        </div>
                      </div>
                    </td>

                    {/* Stock Qty */}
                    <td className="py-3 px-3 text-right">
                      <span className={cn("font-bold font-mono text-sm", sku.currentStock === 0 ? "text-rose-600" : "text-slate-900")}>
                        {sku.currentStock.toLocaleString()}
                      </span>
                      {sku.currentStock === 0 && (
                        <span className="block text-[8px] font-black text-rose-600 uppercase">OUT OF STOCK</span>
                      )}
                    </td>

                    {/* Average Daily Sales */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                      {sku.averageDailySales} / day
                    </td>

                    {/* Inventory Age in Days */}
                    <td className="py-3 px-3 text-right">
                      <span className="font-mono font-black text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded">
                        {sku.inventoryAgeDays} days
                      </span>
                    </td>

                    {/* Movement Classification Badge */}
                    <td className="py-3 px-3 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                        sku.colorBadge.bg,
                        sku.colorBadge.text,
                        sku.colorBadge.border
                      )}>
                        <span>{sku.colorBadge.icon}</span>
                        <span>{sku.movementLabel}</span>
                      </span>
                    </td>

                    {/* Stock Value */}
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900">
                      {currency} {sku.stockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>

                    {/* Oldest Remaining Stock Date */}
                    <td className="py-3 px-3 text-right font-mono text-slate-600 text-[11px]">
                      {sku.oldestRemainingStockDate}
                    </td>

                    {/* Last Sale Date */}
                    <td className="py-3 px-3 text-right font-mono text-slate-600 text-[11px]">
                      {sku.lastSaleDate || <span className="text-slate-400 italic">No sales yet</span>}
                    </td>

                  </tr>
                );
              })}

              {paginatedSKUs.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-600">No SKU items found</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Try clearing your search query or class filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 pt-1">
            <span>
              Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, sortedSKUs.length)} of {sortedSKUs.length} SKUs
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg font-bold text-[11px] transition-colors"
              >
                Previous
              </button>
              <span className="px-2 text-[11px] font-mono">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg font-bold text-[11px] transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
