import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, ChevronDown, Clock, BarChart3, 
  Filter, MoreHorizontal, LayoutDashboard,
  BarChart, PieChart, TrendingUp, Info, ArrowUpRight,
  User, Calendar, Download, Eye, List, X, CheckCircle2,
  Printer, Sparkles, SlidersHorizontal, Share2, Layers
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { InsightBadge } from '../common/InsightBadge';

type ReportCategory = 
  | 'Acquisition' | 'Behavior' | 'Sales' 
  | 'Inventory' | 'Quotations' | 'Invoicing' 
  | 'Customers' | 'Suppliers' | 'Profitability' | 'Custom';

interface Report {
  id: string;
  name: string;
  category: ReportCategory;
  lastViewed: string;
  createdBy: string;
  description: string;
}

const REPORTS_DATA: Report[] = [
  { id: '1', name: 'Sessions by location', category: 'Acquisition', lastViewed: '—', createdBy: 'System', description: 'Monitor where your traffic originates across regional hubs' },
  { id: '2', name: 'Sessions over time', category: 'Acquisition', lastViewed: '2 mins ago', createdBy: 'System', description: 'Web traffic trends and peaks by day and hour' },
  { id: '3', name: 'Visitors right now', category: 'Behavior', lastViewed: '1 hr ago', createdBy: 'System', description: 'Real-time user engagement and active terminal sessions' },
  { id: '4', name: 'Bounce rate over time', category: 'Behavior', lastViewed: '—', createdBy: 'System', description: 'Percentage of single-page sessions on digital catalogues' },
  { id: '5', name: 'Checkout conversion rate', category: 'Behavior', lastViewed: 'Yesterday', createdBy: 'System', description: 'Cart to completed POS order conversion funnel' },
  { id: '6', name: 'Sales over time', category: 'Sales', lastViewed: '4 hrs ago', createdBy: 'Admin', description: 'Historical revenue performance and daily revenue totals' },
  { id: '7', name: 'Inventory value report', category: 'Inventory', lastViewed: '3 days ago', createdBy: 'System', description: 'Current asset valuation of all items using WAC costing' },
  { id: '8', name: 'Stock movement report', category: 'Inventory', lastViewed: '—', createdBy: 'Admin', description: 'Inbound receipts, POS dispatches, and warehouse transfers' },
  { id: '9', name: 'Low stock alerts summary', category: 'Inventory', lastViewed: 'Just now', createdBy: 'System', description: 'Items below minimum reorder point requiring PO dispatch' },
  { id: '10', name: 'Quotations issued', category: 'Quotations', lastViewed: '2 days ago', createdBy: 'Sales Team', description: 'Total volume and valuation of outward sales quotations' },
  { id: '11', name: 'Quote-to-Invoice conversion', category: 'Quotations', lastViewed: '—', createdBy: 'Admin', description: 'Efficiency of quotation pipeline and contract closures' },
  { id: '12', name: 'Proforma conversion rate', category: 'Invoicing', lastViewed: '—', createdBy: 'Finance', description: 'Proforma invoices converted into settled tax receipts' },
  { id: '13', name: 'Deadstock analysis', category: 'Inventory', lastViewed: 'Weekly', createdBy: 'System', description: 'Slow-moving SKUs with zero sales in over 90 days' },
  { id: '14', name: 'Supplier performance', category: 'Suppliers', lastViewed: '—', createdBy: 'Procurement', description: 'Vendor fulfillment lead times and quality scores' },
  { id: '15', name: 'Customer lifetime value', category: 'Customers', lastViewed: 'Monthly', createdBy: 'Marketing', description: 'Total cumulative revenue per registered customer profile' },
  { id: '16', name: 'Gross profit margin by product', category: 'Profitability', lastViewed: '4 hours ago', createdBy: 'Finance', description: 'SKU-level selling price minus COGS net margin telemetry' },
];

const CATEGORY_STYLES: Record<string, string> = {
  Acquisition: 'bg-blue-50 text-blue-600',
  Behavior: 'bg-indigo-50 text-indigo-600',
  Sales: 'bg-emerald-50 text-emerald-600',
  Inventory: 'bg-amber-50 text-amber-600',
  Quotations: 'bg-purple-50 text-purple-600',
  Invoicing: 'bg-cyan-50 text-cyan-600',
  Customers: 'bg-rose-50 text-rose-600',
  Suppliers: 'bg-slate-100 text-slate-600',
  Profitability: 'bg-teal-50 text-teal-600',
  Custom: 'bg-slate-50 text-slate-500',
};

export function Reports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [createdByFilter, setCreatedByFilter] = useState<string>('All');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('All Time');
  const [sortBy, setSortBy] = useState<keyof Report>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Modals state
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isCustomReportModalOpen, setIsCustomReportModalOpen] = useState(false);
  const [customReportForm, setCustomReportForm] = useState({
    title: '',
    category: 'Sales',
    dateRange: 'Last 30 Days',
    includeValuation: true,
    includeBreakdowns: true,
  });
  const [customGeneratedNotice, setCustomGeneratedNotice] = useState(false);
  const [exportAllNotice, setExportAllNotice] = useState(false);

  const creators = useMemo(() => {
    const set = new Set(REPORTS_DATA.map(r => r.createdBy));
    return ['All', ...Array.from(set)];
  }, []);

  const filteredReports = useMemo(() => {
    return REPORTS_DATA.filter(report => {
      const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            report.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'All' || report.category === activeCategory;
      const matchesCreator = createdByFilter === 'All' || report.createdBy === createdByFilter;
      return matchesSearch && matchesCategory && matchesCreator;
    }).sort((a, b) => {
      const valA = a[sortBy] || '';
      const valB = b[sortBy] || '';
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [searchTerm, activeCategory, createdByFilter, sortBy, sortOrder]);

  const toggleSort = (field: keyof Report) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleExportAll = () => {
    const rows = [
      ["Report ID", "Report Name", "Category", "Last Viewed", "Created By", "Description"],
      ...filteredReports.map(r => [
        r.id,
        `"${r.name.replace(/"/g, '""')}"`,
        r.category,
        r.lastViewed,
        r.createdBy,
        `"${r.description.replace(/"/g, '""')}"`
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `All_Business_Reports_Catalog_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportAllNotice(true);
    setTimeout(() => setExportAllNotice(false), 2500);
  };

  const handleDownloadSingleReport = (report: Report, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const rows = [
      [`Report: ${report.name}`, `Category: ${report.category}`],
      [`Generated By: ${report.createdBy}`, `Date: ${new Date().toLocaleDateString()}`],
      [`Summary: ${report.description}`],
      [],
      ["Sample Metric / Key Dimension", "Period Volume", "Calculated Value", "Variance %", "Status"],
      ["Primary Metric Summary", "1,248 Units", "KSh 485,200.00", "+14.2%", "Healthy"],
      ["Secondary Breakdown", "834 Units", "KSh 210,400.00", "+8.7%", "Normal"],
      ["Tertiary Outliers", "414 Units", "KSh 124,800.00", "-2.1%", "Review"]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateCustomReport = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomGeneratedNotice(true);
    setTimeout(() => {
      setCustomGeneratedNotice(false);
      setIsCustomReportModalOpen(false);
      // Download newly customized report
      const rows = [
        [`Custom Analytical Report: ${customReportForm.title || 'Custom Analytics'}`, `Category: ${customReportForm.category}`],
        [`Period: ${customReportForm.dateRange}`, `Generated At: ${new Date().toLocaleString()}`],
        [],
        ["Dimension", "Metric", "Target", "Achievement"],
        ["Gross Revenue", "KSh 850,000", "KSh 800,000", "106%"],
        ["Inventory Valuation", "KSh 2,450,000", "KSh 2,500,000", "98%"],
        ["Stock Turnover", "4.8x", "4.5x", "107%"]
      ];
      const csvContent = "data:text/csv;charset=utf-8," + rows.map(item => item.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Custom_Report_${(customReportForm.title || 'Report').replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] -m-4 md:-m-8 p-4 md:p-8 animate-in fade-in duration-500 text-left">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200">
              <BarChart3 className="w-6 h-6 text-slate-700" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Reports & Business Intelligence</h1>
              <p className="text-sm font-medium text-[#64748B]">View, analyze, and export operational performance reports</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportAll}
              className="flex-1 md:flex-none h-10 px-4 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {exportAllNotice ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Download className="w-4 h-4" />}
              {exportAllNotice ? "Exported!" : "Export All"}
            </button>
            <button 
              onClick={() => setIsCustomReportModalOpen(true)}
              className="flex-1 md:flex-none h-10 px-5 bg-[#0F172A] text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <BarChart className="w-4 h-4" /> Custom Report
            </button>
          </div>
        </div>

        {/* Dynamic Intelligence Telemetry */}
        <InsightBadge
          elementId="analytics_turnover_ratio"
          variant="banner"
          className="w-full"
        />

        {/* Large Search bar */}
        <div className="relative group shadow-sm bg-white rounded-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
          <input 
            type="text"
            placeholder="Search reports by title, topic, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-14 pl-12 pr-4 bg-transparent border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all font-medium text-slate-900"
          />
        </div>

        {/* Filter Pill Row */}
        <div className="flex flex-wrap items-center gap-2 py-1">
          <button 
            onClick={() => setActiveCategory('All')}
            className={cn(
              "px-4 h-9 rounded-full text-xs font-bold transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer",
              activeCategory === 'All' ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-[#F8FAFC]"
            )}
          >
            All Categories ({REPORTS_DATA.length})
          </button>
          {Object.keys(CATEGORY_STYLES).filter(c => c !== 'Custom').map((cat) => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-3.5 h-9 rounded-full text-xs font-bold transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer",
                activeCategory === cat ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-[#F8FAFC]"
              )}
            >
              {cat}
            </button>
          ))}
          
          <div className="flex items-center gap-2 ml-auto">
            {/* Created By Selector */}
            <div className="relative">
              <select 
                value={createdByFilter}
                onChange={e => setCreatedByFilter(e.target.value)}
                className="px-3 pr-8 h-9 bg-white border border-slate-200 text-slate-700 rounded-full text-xs font-bold hover:bg-[#F8FAFC] shadow-sm appearance-none cursor-pointer focus:outline-none"
              >
                <option value="All">Created by: All</option>
                {creators.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>Created by: {c}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Date Range Selector */}
            <div className="relative">
              <select 
                value={dateRangeFilter}
                onChange={e => setDateRangeFilter(e.target.value)}
                className="px-3 pr-8 h-9 bg-white border border-slate-200 text-slate-700 rounded-full text-xs font-bold hover:bg-[#F8FAFC] shadow-sm appearance-none cursor-pointer focus:outline-none"
              >
                <option value="All Time">Date: All Time</option>
                <option value="Last 7 Days">Date: Last 7 Days</option>
                <option value="Last 30 Days">Date: Last 30 Days</option>
                <option value="This Quarter">Date: This Quarter</option>
                <option value="This Year">Date: This Year</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Reports Table / Grid Container */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[1fr_180px_160px_140px_140px] gap-4 px-6 py-4 bg-[#F8FAFC] border-b border-slate-200 text-[11px] font-black uppercase tracking-[0.1em] text-[#64748B]">
                <div onClick={() => toggleSort('name')} className="cursor-pointer hover:text-slate-900 transition-colors flex items-center gap-1">
                  Report Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </div>
                <div onClick={() => toggleSort('category')} className="cursor-pointer hover:text-slate-900 transition-colors flex items-center gap-1">
                  Category {sortBy === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
                </div>
                <div onClick={() => toggleSort('lastViewed')} className="cursor-pointer hover:text-slate-900 transition-colors flex items-center gap-1">
                  Last Viewed {sortBy === 'lastViewed' && (sortOrder === 'asc' ? '↑' : '↓')}
                </div>
                <div onClick={() => toggleSort('createdBy')} className="cursor-pointer hover:text-slate-900 transition-colors flex items-center gap-1">
                  Created By {sortBy === 'createdBy' && (sortOrder === 'asc' ? '↑' : '↓')}
                </div>
                <div className="text-right">Actions</div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {filteredReports.map((report) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={report.id} 
                    onClick={() => setSelectedReport(report)}
                    className="grid grid-cols-[1fr_180px_160px_140px_140px] gap-4 px-6 py-4 items-center hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[#2C6ECB] group-hover:underline transition-all truncate">
                        {report.name}
                      </p>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">{report.description}</p>
                    </div>
                    <div>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight",
                        CATEGORY_STYLES[report.category] || 'bg-slate-100 text-slate-600'
                      )}>
                        {report.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                      <Clock className="w-3.5 h-3.5 opacity-30" />
                      {report.lastViewed}
                    </div>
                    <div className="text-[12px] font-medium text-slate-500">
                      {report.createdBy}
                    </div>
                    <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => setSelectedReport(report)}
                        title="View Report"
                        className="p-2 h-8 w-8 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center text-slate-600 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleDownloadSingleReport(report, e)}
                        title="Download CSV"
                        className="p-2 h-8 w-8 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center text-slate-600 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filteredReports.map((report) => (
              <div key={report.id} className="p-5 space-y-4 hover:bg-[#F8FAFC] transition-colors">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 
                      onClick={() => setSelectedReport(report)}
                      className="text-sm font-bold text-[#2C6ECB] leading-tight pr-8 cursor-pointer hover:underline"
                    >
                      {report.name}
                    </h3>
                    <p className="text-[11px] text-slate-500">{report.description}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                        CATEGORY_STYLES[report.category] || 'bg-slate-100 text-slate-600'
                      )}>
                        {report.category}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {report.lastViewed}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => setSelectedReport(report)}
                     className="flex-1 h-9 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center justify-center gap-2 hover:bg-slate-50 cursor-pointer"
                   >
                     <Eye className="w-4 h-4" /> View Analysis
                   </button>
                   <button 
                     onClick={(e) => handleDownloadSingleReport(report, e)}
                     className="h-9 px-4 bg-white border border-slate-200 rounded-lg text-slate-700 flex items-center justify-center gap-1 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                   >
                     <Download className="w-4 h-4" /> CSV
                   </button>
                </div>
              </div>
            ))}
          </div>

          {filteredReports.length === 0 && (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No reports found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">We couldn't find any reports matching "{searchTerm}" in the current filter selection.</p>
              <button 
                onClick={() => { setSearchTerm(''); setActiveCategory('All'); setCreatedByFilter('All'); }}
                className="mt-6 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Table Footer */}
          <div className="px-6 py-4 bg-[#F8FAFC] border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">
              Showing {filteredReports.length} of {REPORTS_DATA.length} reports
            </span>
            <div className="text-[11px] font-bold text-slate-400">
              Generated in real-time from active company records
            </div>
          </div>
        </div>
      </div>

      {/* Report Viewer / Analysis Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-left"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider">
                      {selectedReport.category}
                    </span>
                    <span className="text-xs text-slate-400">Created by {selectedReport.createdBy}</span>
                  </div>
                  <h3 className="font-extrabold text-lg mt-1 text-white">{selectedReport.name}</h3>
                  <p className="text-xs text-slate-300 mt-0.5">{selectedReport.description}</p>
                </div>
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="text-slate-400 hover:text-white p-2 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto font-sans">
                {/* Metric Summary Scorecard */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Aggregate Volume</p>
                    <h4 className="text-xl font-black text-slate-900 mt-1">1,248 Units</h4>
                    <p className="text-[10px] text-emerald-600 font-bold mt-0.5">↑ 12.4% vs last period</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Calculated Value</p>
                    <h4 className="text-xl font-black text-slate-900 mt-1">KSh 485,200</h4>
                    <p className="text-[10px] text-emerald-600 font-bold mt-0.5">↑ 8.7% margin growth</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Health Index</p>
                    <h4 className="text-xl font-black text-emerald-600 mt-1">96.4%</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Within SLA targets</p>
                  </div>
                </div>

                {/* Analytical breakdown table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400 grid grid-cols-4">
                    <div>Segment / Attribute</div>
                    <div className="text-right">Volume</div>
                    <div className="text-right">Valuation</div>
                    <div className="text-right">Variance</div>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    <div className="px-4 py-3 grid grid-cols-4 items-center">
                      <span className="font-bold text-slate-900">Primary Core Segment</span>
                      <span className="text-right">720 Units</span>
                      <span className="text-right font-bold text-slate-900">KSh 320,000</span>
                      <span className="text-right text-emerald-600 font-bold">+15.2%</span>
                    </div>
                    <div className="px-4 py-3 grid grid-cols-4 items-center">
                      <span className="font-bold text-slate-900">Secondary Channel</span>
                      <span className="text-right">380 Units</span>
                      <span className="text-right font-bold text-slate-900">KSh 115,200</span>
                      <span className="text-right text-emerald-600 font-bold">+4.1%</span>
                    </div>
                    <div className="px-4 py-3 grid grid-cols-4 items-center">
                      <span className="font-bold text-slate-900">Miscellaneous Outliers</span>
                      <span className="text-right">148 Units</span>
                      <span className="text-right font-bold text-slate-900">KSh 50,000</span>
                      <span className="text-right text-rose-500 font-bold">-1.8%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button 
                  onClick={() => window.print()}
                  className="px-4 h-10 border border-slate-200 bg-white text-slate-700 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-100 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print Report
                </button>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDownloadSingleReport(selectedReport)}
                    className="px-4 h-10 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-800 cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Download CSV
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Report Generator Modal */}
      <AnimatePresence>
        {isCustomReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-left"
            >
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="font-black text-sm">Generate Custom Report</h3>
                </div>
                <button 
                  onClick={() => setIsCustomReportModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {customGeneratedNotice ? (
                <div className="p-8 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                  <h3 className="text-lg font-bold text-slate-900">Custom Report Compiled!</h3>
                  <p className="text-xs text-slate-500">Your custom business telemetry file is downloading now.</p>
                </div>
              ) : (
                <form onSubmit={handleCreateCustomReport} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Report Title</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Q3 Regional Stock & Revenue Velocity"
                      value={customReportForm.title}
                      onChange={e => setCustomReportForm({ ...customReportForm, title: e.target.value })}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Category</label>
                      <select 
                        value={customReportForm.category}
                        onChange={e => setCustomReportForm({ ...customReportForm, category: e.target.value })}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-slate-400"
                      >
                        <option value="Sales">Sales & Revenue</option>
                        <option value="Inventory">Inventory & Valuation</option>
                        <option value="Profitability">Profitability & Margins</option>
                        <option value="Quotations">Quotations & Deals</option>
                        <option value="Suppliers">Suppliers & Procurement</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Date Period</label>
                      <select 
                        value={customReportForm.dateRange}
                        onChange={e => setCustomReportForm({ ...customReportForm, dateRange: e.target.value })}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-slate-400"
                      >
                        <option value="Last 7 Days">Last 7 Days</option>
                        <option value="Last 30 Days">Last 30 Days</option>
                        <option value="Last Quarter">Last Quarter</option>
                        <option value="Year to Date">Year to Date (YTD)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                      <input 
                        type="checkbox"
                        checked={customReportForm.includeValuation}
                        onChange={e => setCustomReportForm({ ...customReportForm, includeValuation: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      Include Weighted Average Costing (WAC) breakdown
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                      <input 
                        type="checkbox"
                        checked={customReportForm.includeBreakdowns}
                        onChange={e => setCustomReportForm({ ...customReportForm, includeBreakdowns: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      Include channel-level Pareto & ABC distribution metrics
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setIsCustomReportModalOpen(false)}
                      className="px-4 h-10 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-5 h-10 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Build & Export
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
