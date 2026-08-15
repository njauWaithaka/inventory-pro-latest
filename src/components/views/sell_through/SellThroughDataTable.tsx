import React, { useState, useMemo } from 'react';
import { 
  ArrowUpDown, ArrowUp, ArrowDown, Download, Search, 
  Filter, CheckCircle2, AlertTriangle, AlertCircle, 
  TrendingUp, TrendingDown, Percent, Layers, Tag, Eye
} from 'lucide-react';
import { ProductSellThroughRow, ProductStatusTag } from '../../../lib/sellThroughService';
import { cn } from '../../../lib/utils';

interface SellThroughDataTableProps {
  rows: ProductSellThroughRow[];
  currency: string;
}

type SortField = 
  | 'name' 
  | 'sku' 
  | 'category' 
  | 'currentStock' 
  | 'unitsSold' 
  | 'netSalesRevenue' 
  | 'sellThroughRate' 
  | 'remainingSTR' 
  | 'daysOfInventory' 
  | 'turnover' 
  | 'fillRate' 
  | 'strVsCategoryAvg';

export function SellThroughDataTable({ rows, currency }: SellThroughDataTableProps) {
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('sellThroughRate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const categories = useMemo(() => {
    return Array.from(new Set(rows.map(r => r.category))).filter(Boolean);
  }, [rows]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedRows = useMemo(() => {
    return rows
      .filter(row => {
        if (search) {
          const q = search.toLowerCase();
          const matches = row.name.toLowerCase().includes(q) || 
                          row.sku.toLowerCase().includes(q) || 
                          row.category.toLowerCase().includes(q);
          if (!matches) return false;
        }
        if (selectedTag !== 'All' && row.statusTag !== selectedTag) return false;
        if (selectedCategory !== 'All' && row.category !== selectedCategory) return false;
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') valA = (valA as string).toLowerCase();
        if (typeof valB === 'string') valB = (valB as string).toLowerCase();

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [rows, search, selectedTag, selectedCategory, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedRows.length / pageSize) || 1;
  const paginatedRows = filteredAndSortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // CSV Export
  const exportToCSV = () => {
    const headers = [
      'Product Name', 'SKU', 'Category', 'Department', 'Channel', 'Attribute',
      'Price', 'Beginning Stock', 'Units Received', 'Units Demanded', 'Units Shipped (Sold)',
      'Current On-Hand', 'Stock Value', 'Net Revenue', 'STR (%)', 'Target STR (%)',
      'Remaining STR (%)', 'Days of Inventory (DOI)', 'Weeks of Supply', 'Turnover Ratio',
      'Fill Rate (%)', 'STR vs Cat Avg (%)', 'STR vs Company Avg (%)', 'Action Status', 'Lifecycle'
    ];

    const csvRows = filteredAndSortedRows.map(r => [
      `"${r.name.replace(/"/g, '""')}"`,
      r.sku,
      r.category,
      r.department,
      r.channel,
      r.attribute,
      r.price,
      r.beginningInventory,
      r.unitsReceived,
      r.unitsDemanded,
      r.unitsSold,
      r.currentStock,
      r.stockValue,
      r.netSalesRevenue,
      r.sellThroughRate,
      r.targetSTR,
      r.remainingSTR,
      r.daysOfInventory,
      r.stockCoverWeeks,
      r.turnover,
      r.fillRate,
      r.strVsCategoryAvg,
      r.strVsCompanyAvg,
      `"${r.statusTag}"`,
      r.lifecycleStage
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SellThrough_FillRate_SourceOfTruth_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (tag: ProductStatusTag) => {
    switch (tag) {
      case 'Reorder Alert':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Markdown Recommended':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Overstocked':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Stockout Risk':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Healthy Velocity':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      
      {/* Table Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              The Granular Data Table (Source of Truth)
            </h3>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            SKU-level sell-through ratios, days of inventory (DOI), fill rates, and suggested actions
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search table..."
              className="h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none w-44"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedTag}
            onChange={(e) => { setSelectedTag(e.target.value); setCurrentPage(1); }}
            className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Healthy Velocity">Healthy Velocity</option>
            <option value="Reorder Alert">Reorder Alert</option>
            <option value="Markdown Recommended">Markdown Recommended</option>
            <option value="Overstocked">Overstocked</option>
            <option value="Stockout Risk">Stockout Risk</option>
          </select>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#0f172a] hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Responsive Table Area */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4">
                <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-900">
                  Product / SKU
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button onClick={() => handleSort('category')} className="flex items-center gap-1 hover:text-slate-900">
                  Category
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3 text-right">Inbound / On-Hand</th>
              <th className="py-3 px-3 text-right">
                <button onClick={() => handleSort('unitsSold')} className="flex items-center gap-1 justify-end w-full hover:text-slate-900">
                  Sold / Demanded
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3 text-right">
                <button onClick={() => handleSort('netSalesRevenue')} className="flex items-center gap-1 justify-end w-full hover:text-slate-900">
                  Net Revenue
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3 text-right">
                <button onClick={() => handleSort('sellThroughRate')} className="flex items-center gap-1 justify-end w-full text-blue-600 hover:text-blue-800 font-extrabold">
                  STR (%)
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3 text-right">Req. Daily STR</th>
              <th className="py-3 px-3 text-right">
                <button onClick={() => handleSort('daysOfInventory')} className="flex items-center gap-1 justify-end w-full hover:text-slate-900">
                  DOI (Days)
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3 text-right">
                <button onClick={() => handleSort('fillRate')} className="flex items-center gap-1 justify-end w-full text-emerald-600 hover:text-emerald-800 font-extrabold">
                  Fill Rate
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3 text-right">vs. Cat Avg</th>
              <th className="py-3 px-4 text-center">Action Trigger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRows.map((row) => (
              <tr key={row.productId} className="hover:bg-slate-50/70 transition-colors">
                
                {/* Product Name & SKU */}
                <td className="py-3 px-4">
                  <div className="font-bold text-slate-900 max-w-[200px] truncate" title={row.name}>
                    {row.name}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                    <span>{row.sku}</span>
                    <span>•</span>
                    <span className="text-indigo-600 font-sans font-semibold">{row.attribute}</span>
                  </div>
                </td>

                {/* Category */}
                <td className="py-3 px-3">
                  <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[11px]">
                    {row.category}
                  </span>
                </td>

                {/* Inbound & Current On-Hand */}
                <td className="py-3 px-3 text-right">
                  <div className="font-bold text-slate-800">{row.currentStock.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400">+{row.unitsReceived} rec'd</div>
                </td>

                {/* Units Sold & Demanded */}
                <td className="py-3 px-3 text-right">
                  <div className="font-bold text-emerald-600">{row.unitsSold.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400">of {row.unitsDemanded.toLocaleString()} dem.</div>
                </td>

                {/* Net Sales Revenue */}
                <td className="py-3 px-3 text-right font-bold text-slate-900">
                  {currency}{Math.round(row.netSalesRevenue).toLocaleString()}
                </td>

                {/* Sell-Through Rate (STR) */}
                <td className="py-3 px-3 text-right">
                  <span className={cn(
                    "inline-block px-2 py-0.5 rounded-lg font-black text-xs",
                    row.sellThroughRate >= 65 ? "bg-emerald-100 text-emerald-800" :
                    row.sellThroughRate >= 45 ? "bg-blue-100 text-blue-800" :
                    row.sellThroughRate >= 30 ? "bg-amber-100 text-amber-800" :
                    "bg-rose-100 text-rose-800"
                  )}>
                    {row.sellThroughRate}%
                  </span>
                </td>

                {/* Remaining STR needed to hit target */}
                <td className="py-3 px-3 text-right text-slate-600 font-medium">
                  {row.remainingSTR > 0 ? `${row.remainingSTR}%` : 'Goal Hit'}
                </td>

                {/* Days of Inventory (DOI) */}
                <td className="py-3 px-3 text-right">
                  <div className={cn("font-bold", row.daysOfInventory > 90 ? "text-amber-600" : row.daysOfInventory <= 14 ? "text-rose-600" : "text-slate-700")}>
                    {row.daysOfInventory} d
                  </div>
                  <div className="text-[10px] text-slate-400">{row.stockCoverWeeks} wks</div>
                </td>

                {/* Fill Rate */}
                <td className="py-3 px-3 text-right">
                  <span className={cn(
                    "font-bold text-xs",
                    row.fillRate >= 95 ? "text-emerald-600" : row.fillRate >= 85 ? "text-blue-600" : "text-amber-600"
                  )}>
                    {row.fillRate}%
                  </span>
                </td>

                {/* Variance vs Category Average */}
                <td className="py-3 px-3 text-right">
                  <span className={cn(
                    "text-[11px] font-bold",
                    row.strVsCategoryAvg >= 0 ? "text-emerald-600" : "text-rose-500"
                  )}>
                    {row.strVsCategoryAvg >= 0 ? `+${row.strVsCategoryAvg}%` : `${row.strVsCategoryAvg}%`}
                  </span>
                </td>

                {/* Action Trigger Tag */}
                <td className="py-3 px-4 text-center">
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                    getStatusBadge(row.statusTag)
                  )}>
                    {row.statusTag}
                  </span>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{Math.min(filteredAndSortedRows.length, (currentPage - 1) * pageSize + 1)}</span> to{' '}
          <span className="font-bold text-slate-800">{Math.min(filteredAndSortedRows.length, currentPage * pageSize)}</span> of{' '}
          <span className="font-bold text-slate-800">{filteredAndSortedRows.length}</span> entries
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all"
          >
            Previous
          </button>
          
          <span className="px-3 py-1.5 text-xs font-black text-slate-700">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all"
          >
            Next
          </button>
        </div>
      </div>

    </div>
  );
}
