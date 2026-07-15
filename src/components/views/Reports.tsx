import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, ChevronDown, Clock, BarChart3, 
  Filter, MoreHorizontal, LayoutDashboard,
  BarChart, PieChart, TrendingUp, Info, ArrowUpRight,
  User, Calendar, Download, Eye, List
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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
  { id: '1', name: 'Sessions by location', category: 'Acquisition', lastViewed: '—', createdBy: 'System', description: 'Monitor where your traffic originates' },
  { id: '2', name: 'Sessions over time', category: 'Acquisition', lastViewed: '2 mins ago', createdBy: 'System', description: 'Web traffic trends and peaks' },
  { id: '3', name: 'Visitors right now', category: 'Behavior', lastViewed: '1 hr ago', createdBy: 'System', description: 'Real-time user engagement' },
  { id: '4', name: 'Bounce rate over time', category: 'Behavior', lastViewed: '—', createdBy: 'System', description: 'Percentage of single-page sessions' },
  { id: '5', name: 'Checkout conversion rate', category: 'Behavior', lastViewed: 'Yesterday', createdBy: 'System', description: 'Cart to order conversion funnel' },
  { id: '6', name: 'Sales over time', category: 'Sales', lastViewed: '4 hrs ago', createdBy: 'Admin', description: 'Historical revenue performance' },
  { id: '7', name: 'Inventory value report', category: 'Inventory', lastViewed: '3 days ago', createdBy: 'System', description: 'Current asset valuation of all items' },
  { id: '8', name: 'Stock movement report', category: 'Inventory', lastViewed: '—', createdBy: 'Admin', description: 'Inbound and outbound ledger' },
  { id: '9', name: 'Low stock alerts summary', category: 'Inventory', lastViewed: 'Just now', createdBy: 'System', description: 'Items below reorder point' },
  { id: '10', name: 'Quotations issued', category: 'Quotations', lastViewed: '2 days ago', createdBy: 'Sales Team', description: 'Total value of outward quotes' },
  { id: '11', name: 'Quote-to-Invoice conversion', category: 'Quotations', lastViewed: '—', createdBy: 'Admin', description: 'Efficiency of sales pipeline' },
  { id: '12', name: 'Proforma conversion rate', category: 'Invoicing', lastViewed: '—', createdBy: 'Finance', description: 'Proforma to tax invoice throughput' },
  { id: '13', name: 'Deadstock analysis', category: 'Inventory', lastViewed: 'Weekly', createdBy: 'System', description: 'Items not sold in over 90 days' },
  { id: '14', name: 'Supplier performance', category: 'Suppliers', lastViewed: '—', createdBy: 'Procurement', description: 'Lead time and quality metrics by vendor' },
  { id: '15', name: 'Customer lifetime value', category: 'Customers', lastViewed: 'Monthly', createdBy: 'Marketing', description: 'Total predicted revenue per customer' },
  { id: '16', name: 'Gross profit margin by product', category: 'Profitability', lastViewed: '4 hours ago', createdBy: 'Finance', description: 'Revenue minus COGS breakdown' },
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
  const [sortBy, setSortBy] = useState<keyof Report>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredReports = useMemo(() => {
    return REPORTS_DATA.filter(report => {
      const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'All' || report.category === activeCategory;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => {
      const valA = a[sortBy] || '';
      const valB = b[sortBy] || '';
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [searchTerm, activeCategory, sortBy, sortOrder]);

  const toggleSort = (field: keyof Report) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
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
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Reports</h1>
              <p className="text-sm font-medium text-[#64748B]">View and analyze business performance reports</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex-1 md:flex-none h-10 px-4 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Export All
            </button>
            <button className="flex-1 md:flex-none h-10 px-5 bg-[#0F172A] text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center gap-2">
              <BarChart className="w-4 h-4" /> Custom Report
            </button>
          </div>
        </div>

        {/* Large Search bar */}
        <div className="relative group shadow-sm bg-white rounded-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
          <input 
            type="text"
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-14 pl-12 pr-4 bg-transparent border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all font-medium text-slate-900"
          />
        </div>

        {/* Filter Pill Row */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button 
            onClick={() => setActiveCategory('All')}
            className={cn(
              "px-4 h-9 rounded-full text-xs font-bold transition-all shadow-sm shrink-0 whitespace-nowrap",
              activeCategory === 'All' ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-[#F8FAFC]"
            )}
          >
            All Reports
          </button>
          {Object.keys(CATEGORY_STYLES).map((cat) => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-4 h-9 rounded-full text-xs font-bold transition-all shadow-sm shrink-0 whitespace-nowrap",
                activeCategory === cat ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-[#F8FAFC]"
              )}
            >
              {cat}
            </button>
          ))}
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <button className="px-4 h-9 bg-white border border-slate-200 text-slate-600 rounded-full text-xs font-bold hover:bg-[#F8FAFC] shadow-sm flex items-center gap-2 shrink-0">
            <User className="w-3.5 h-3.5 opacity-50" /> Created by <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
          <button className="px-4 h-9 bg-white border border-slate-200 text-slate-600 rounded-full text-xs font-bold hover:bg-[#F8FAFC] shadow-sm flex items-center gap-2 shrink-0">
            <Calendar className="w-3.5 h-3.5 opacity-50" /> Date range <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
        </div>

        {/* Reports Table / Grid Container */}
        <div className="bg-white rounded-xl border border-[#E2E88F0] shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[1fr_180px_180px_150px_120px] gap-4 px-6 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-black uppercase tracking-[0.1em] text-[#64748B]">
                <div onClick={() => toggleSort('name')} className="cursor-pointer hover:text-slate-900 transition-colors flex items-center gap-1">
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </div>
                <div onClick={() => toggleSort('category')} className="cursor-pointer hover:text-slate-900 transition-colors flex items-center gap-1">
                  Category {sortBy === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
                </div>
                <div onClick={() => toggleSort('lastViewed')} className="cursor-pointer hover:text-slate-900 transition-colors flex items-center gap-1">
                  Last viewed {sortBy === 'lastViewed' && (sortOrder === 'asc' ? '↑' : '↓')}
                </div>
                <div onClick={() => toggleSort('createdBy')} className="cursor-pointer hover:text-slate-900 transition-colors flex items-center gap-1">
                  Created By {sortBy === 'createdBy' && (sortOrder === 'asc' ? '↑' : '↓')}
                </div>
                <div className="text-right">Actions</div>
              </div>
              
              <div className="divide-y divide-[#E2E8F0]">
                {filteredReports.map((report) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={report.id} 
                    className="grid grid-cols-[1fr_180px_180px_150px_120px] gap-4 px-6 py-4 items-center hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
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
                        CATEGORY_STYLES[report.category]
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
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-2 h-8 w-8 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center text-slate-600 opacity-0 group-hover:opacity-100">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 h-8 w-8 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center text-slate-600 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-[#E2E8F0]">
            {filteredReports.map((report) => (
              <div key={report.id} className="p-5 space-y-4 hover:bg-[#F8FAFC] transition-colors">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-[#2C6ECB] leading-tight pr-8">{report.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                        CATEGORY_STYLES[report.category]
                      )}>
                        {report.category}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {report.lastViewed}
                      </span>
                    </div>
                  </div>
                  <button className="p-2 -mr-2 text-slate-400">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex gap-2">
                   <button className="flex-1 h-9 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center justify-center gap-2">
                     <Eye className="w-4 h-4" /> View
                   </button>
                   <button className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-700 flex items-center justify-center">
                     <Download className="w-4 h-4" />
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
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">We couldn't find any reports matching "{searchTerm}" in the {activeCategory} category.</p>
              <button 
                onClick={() => { setSearchTerm(''); setActiveCategory('All'); }}
                className="mt-6 text-xs font-bold text-blue-600 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Table Footer */}
          <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">
              Showing {filteredReports.length} of {REPORTS_DATA.length} reports
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-slate-400 mr-2">1 - {Math.min(50, filteredReports.length)}</span>
              <button className="p-1 h-7 rounded border border-slate-200 bg-white text-slate-400 disabled:opacity-30 flex items-center justify-center" disabled>
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
              <button className="p-1 h-7 rounded border border-slate-200 bg-white text-slate-400 disabled:opacity-30 flex items-center justify-center" disabled>
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4">
          <div className="shrink-0 pt-0.5">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-blue-900">Custom Reports & Analytics</h4>
            <p className="text-xs text-blue-800/80 leading-relaxed">
              Explore your data deeper by creating custom filtered reports. You can group by supplier, filter by warehouse, or track specific sales channels. Saved custom reports will appear in your "Custom" tab above.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
