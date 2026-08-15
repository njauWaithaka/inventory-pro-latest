import React, { useState } from 'react';
import { 
  Filter, Calendar, Search, Sliders, Layers, 
  MapPin, ShoppingBag, Tag, DollarSign, RotateCcw, 
  ChevronDown, ChevronUp, Sparkles, Check, Target
} from 'lucide-react';
import { 
  DatePreset, TimeGranularity, DepartmentType, 
  ChannelType, RegionType, ProductAttributeType, PriceTierType 
} from '../../../lib/sellThroughService';
import { cn } from '../../../lib/utils';

interface SellThroughFiltersProps {
  datePreset: DatePreset;
  setDatePreset: (p: DatePreset) => void;
  customStartDate: string;
  setCustomStartDate: (d: string) => void;
  customEndDate: string;
  setCustomEndDate: (d: string) => void;
  granularity: TimeGranularity;
  setGranularity: (g: TimeGranularity) => void;
  daysOnHandMax: number;
  setDaysOnHandMax: (d: number) => void;
  department: string;
  setDepartment: (dept: string) => void;
  category: string;
  setCategory: (cat: string) => void;
  channel: string;
  setChannel: (c: string) => void;
  region: string;
  setRegion: (r: string) => void;
  attribute: string;
  setAttribute: (a: string) => void;
  priceTier: string;
  setPriceTier: (p: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  targetSTR: number;
  setTargetSTR: (t: number) => void;
  targetFillRate: number;
  setTargetFillRate: (t: number) => void;
  categoriesList: string[];
  totalFilteredCount: number;
  totalAllCount: number;
  onResetFilters: () => void;
}

export function SellThroughFilters({
  datePreset,
  setDatePreset,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  granularity,
  setGranularity,
  daysOnHandMax,
  setDaysOnHandMax,
  department,
  setDepartment,
  category,
  setCategory,
  channel,
  setChannel,
  region,
  setRegion,
  attribute,
  setAttribute,
  priceTier,
  setPriceTier,
  searchQuery,
  setSearchQuery,
  targetSTR,
  setTargetSTR,
  targetFillRate,
  setTargetFillRate,
  categoriesList,
  totalFilteredCount,
  totalAllCount,
  onResetFilters
}: SellThroughFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const departments: DepartmentType[] = ['All', 'Apparel', 'Footwear', 'Accessories', 'Electronics', 'Home & Living', 'Consumables'];
  const channels: ChannelType[] = ['All', 'E-commerce', 'Brick-and-Mortar', 'Marketplace (Amazon/Shopify)', 'Wholesale B2B'];
  const regions: RegionType[] = ['All', 'North Warehouse', 'South Hub', 'East Distribution', 'West Coast DC', 'Downtown Flagship'];
  const attributes: ProductAttributeType[] = ['All', 'New Arrivals', 'Core / Basics', 'Spring / Summer', 'Fall / Winter', 'Promotional / Sale'];
  const priceTiers: PriceTierType[] = ['All', 'Economy (<$30)', 'Mid-Range ($30-$100)', 'Premium ($100+)'];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Primary Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        
        {/* Left: Search & Date Presets */}
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by SKU, product name, tag..."
              className="w-full h-10 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Date Presets Pill Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {[
              { id: 'last7days', label: '7D' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'thisQuarter', label: 'This Quarter' },
              { id: 'thisYear', label: 'YTD' },
              { id: 'custom', label: 'Custom' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDatePreset(item.id as DatePreset)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                  datePreset === item.id 
                    ? "bg-white text-slate-900 shadow-xs" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Granularity Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {(['daily', 'weekly', 'monthly'] as TimeGranularity[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setGranularity(tab)}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-bold rounded-lg capitalize transition-all",
                  granularity === tab 
                    ? "bg-blue-600 text-white shadow-xs" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Controls & Expand Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all",
              isExpanded 
                ? "bg-blue-50 text-blue-700 border-blue-200 shadow-xs" 
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Attributes & Target Sliders</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
          </button>

          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

      </div>

      {/* Custom Date Pickers (if Custom Preset) */}
      {datePreset === 'custom' && (
        <div className="p-3 bg-blue-50/50 border-b border-blue-100 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700">
          <span className="font-bold text-blue-900 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            Custom Date Interval:
          </span>
          <div className="flex items-center gap-2">
            <label className="text-slate-500">From:</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-500">To:</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Expanded Multi-Dimensional Slice & Dice Panel */}
      {isExpanded && (
        <div className="p-5 bg-slate-50/60 border-b border-slate-200 space-y-4 text-xs">
          
          {/* Row 1: Hierarchies & Channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Department */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-400" />
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" />
                Product Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="All">All Categories ({categoriesList.length})</option>
                {categoriesList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Channel */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <ShoppingBag className="w-3 h-3 text-slate-400" />
                Sales Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {channels.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Region / Warehouse */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                Location / Hub
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {regions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Row 2: Product Attributes & Price Tiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-200/60">
            
            {/* Seasonality / Attributes */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Product Attribute / Season
              </label>
              <select
                value={attribute}
                onChange={(e) => setAttribute(e.target.value)}
                className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {attributes.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Price Tier */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-slate-400" />
                Price Tier
              </label>
              <select
                value={priceTier}
                onChange={(e) => setPriceTier(e.target.value)}
                className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {priceTiers.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Days on Hand (DOI) Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Max Days on Hand:
                </label>
                <span className="font-bold text-blue-600">{daysOnHandMax >= 180 ? 'No limit' : `≤ ${daysOnHandMax} days`}</span>
              </div>
              <input
                type="range"
                min="15"
                max="180"
                step="5"
                value={daysOnHandMax}
                onChange={(e) => setDaysOnHandMax(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
              />
            </div>

            {/* Target STR Calibration Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Target className="w-3 h-3 text-indigo-600" />
                  Target STR Goal:
                </label>
                <span className="font-black text-indigo-600">{targetSTR}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="90"
                step="5"
                value={targetSTR}
                onChange={(e) => setTargetSTR(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
              />
            </div>

          </div>

        </div>
      )}

      {/* Footer Pill Status: Result Count */}
      <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-500">
        <div className="flex items-center gap-2">
          <span>Active Filter Yield:</span>
          <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
            {totalFilteredCount} of {totalAllCount} SKUs
          </span>
          {department !== 'All' && <span className="text-blue-600 font-bold">• Dept: {department}</span>}
          {category !== 'All' && <span className="text-purple-600 font-bold">• Cat: {category}</span>}
          {channel !== 'All' && <span className="text-emerald-600 font-bold">• Channel: {channel}</span>}
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-slate-400">Target Fill Rate SLA: <strong className="text-emerald-700">{targetFillRate}%</strong></span>
        </div>
      </div>
    </div>
  );
}
