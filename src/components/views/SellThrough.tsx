import React, { useState, useEffect, useMemo } from 'react';
import { 
  Percent, TrendingUp, BarChart3, RefreshCw, 
  Download, Printer, Sparkles, AlertCircle, Layers,
  Sliders, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSettings } from '../../contexts/SettingsContext';
import { Product } from '../../types';
import { 
  computeSellThroughAnalysis, 
  DatePreset, 
  TimeGranularity 
} from '../../lib/sellThroughService';
import { SellThroughExecutiveSummary } from './sell_through/SellThroughExecutiveSummary';
import { SellThroughFilters } from './sell_through/SellThroughFilters';
import { SellThroughVisualAnalytics } from './sell_through/SellThroughVisualAnalytics';
import { SellThroughDataTable } from './sell_through/SellThroughDataTable';
import { SellThroughWhyLayer } from './sell_through/SellThroughWhyLayer';
import { SellThroughWhatIfModule } from './sell_through/SellThroughWhatIfModule';
import { SellThroughBenchmarks } from './sell_through/SellThroughBenchmarks';
import { SellThroughAnnotations } from './sell_through/SellThroughAnnotations';
import { SellThroughMethodology } from './sell_through/SellThroughMethodology';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export function SellThrough() {
  const { profile, currency } = useSettings();

  // Firestore live state
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Global Filter States
  const [datePreset, setDatePreset] = useState<DatePreset>('thisMonth');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [granularity, setGranularity] = useState<TimeGranularity>('daily');
  const [daysOnHandMax, setDaysOnHandMax] = useState<number>(180);
  const [department, setDepartment] = useState<string>('All');
  const [category, setCategory] = useState<string>('All');
  const [channel, setChannel] = useState<string>('All');
  const [region, setRegion] = useState<string>('All');
  const [attribute, setAttribute] = useState<string>('All');
  const [priceTier, setPriceTier] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [targetSTR, setTargetSTR] = useState<number>(60);
  const [targetFillRate, setTargetFillRate] = useState<number>(95);

  // Active section view mode (All in One vs Tabs)
  const [viewMode, setViewMode] = useState<'comprehensive' | 'kpis_charts' | 'data_table' | 'what_if'>('comprehensive');

  // Fetch Firestore data
  useEffect(() => {
    if (!profile?.companyId) return;
    setLoading(true);

    const basePath = `companies/${profile.companyId}`;
    const unsubProducts = onSnapshot(collection(db, `${basePath}/products`), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching products in SellThrough:", err);
      setLoading(false);
    });

    const unsubMovements = onSnapshot(collection(db, `${basePath}/stockMovements`), (snap) => {
      setStockMovements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Error fetching movements in SellThrough:", err);
    });

    const unsubInvoices = onSnapshot(collection(db, `${basePath}/invoices`), (snap) => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Error fetching invoices in SellThrough:", err);
    });

    return () => {
      unsubProducts();
      unsubMovements();
      unsubInvoices();
    };
  }, [profile?.companyId]);

  // Unique Categories List
  const categoriesList = useMemo(() => {
    return Array.from(new Set(products.map(p => p.category))).filter(Boolean) as string[];
  }, [products]);

  // Reset Filters handler
  const handleResetFilters = () => {
    setDatePreset('thisMonth');
    setCustomStartDate('');
    setCustomEndDate('');
    setGranularity('daily');
    setDaysOnHandMax(180);
    setDepartment('All');
    setCategory('All');
    setChannel('All');
    setRegion('All');
    setAttribute('All');
    setPriceTier('All');
    setSearchQuery('');
    setTargetSTR(60);
    setTargetFillRate(95);
  };

  // Run Sell-Through & Fill Rate Analysis Engine
  const analytics = useMemo(() => {
    return computeSellThroughAnalysis(products, invoices, stockMovements, {
      datePreset,
      customStartDate,
      customEndDate,
      granularity,
      daysOnHandMax,
      department,
      category,
      channel,
      region,
      attribute,
      priceTier,
      searchQuery,
      targetSTR,
      targetFillRate
    });
  }, [
    products, invoices, stockMovements, datePreset, 
    customStartDate, customEndDate, granularity, 
    daysOnHandMax, department, category, channel, 
    region, attribute, priceTier, searchQuery, 
    targetSTR, targetFillRate
  ]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 animate-pulse">
          <Percent className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm font-bold text-slate-600">Computing Sell-Through & Fill Rate Indices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Sell-Through Rate & Fill Rate Intelligence
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                  Insights Hub
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                Executive sell-through velocity (STR), on-hand fill rate SLA, days of inventory (DOI), and markdown simulations
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {[
            { id: 'comprehensive', label: 'Complete View' },
            { id: 'kpis_charts', label: 'Charts & Funnel' },
            { id: 'data_table', label: 'Data Table' },
            { id: 'what_if', label: 'What-If & Benchmarks' }
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setViewMode(mode.id as any)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                viewMode === mode.id
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: Executive Summary (The Headline KPIs) */}
      <SellThroughExecutiveSummary 
        summary={analytics.executiveSummary} 
        currency={currency} 
      />

      {/* SECTION 2: Global Filters & Controls (The Slice & Dice) */}
      <SellThroughFilters
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        granularity={granularity}
        setGranularity={setGranularity}
        daysOnHandMax={daysOnHandMax}
        setDaysOnHandMax={setDaysOnHandMax}
        department={department}
        setDepartment={setDepartment}
        category={category}
        setCategory={setCategory}
        channel={channel}
        setChannel={setChannel}
        region={region}
        setRegion={setRegion}
        attribute={attribute}
        setAttribute={setAttribute}
        priceTier={priceTier}
        setPriceTier={setPriceTier}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        targetSTR={targetSTR}
        setTargetSTR={setTargetSTR}
        targetFillRate={targetFillRate}
        setTargetFillRate={setTargetFillRate}
        categoriesList={categoriesList}
        totalFilteredCount={analytics.filterSummary.totalSKUs}
        totalAllCount={products.length}
        onResetFilters={handleResetFilters}
      />

      {/* SECTION 3: Visual Analytics (The Story of the Data) */}
      {(viewMode === 'comprehensive' || viewMode === 'kpis_charts') && (
        <SellThroughVisualAnalytics
          analytics={analytics}
          currency={currency}
          granularity={granularity}
        />
      )}

      {/* SECTION 4: The Granular Data Table (The Source of Truth) */}
      {(viewMode === 'comprehensive' || viewMode === 'data_table') && (
        <SellThroughDataTable
          rows={analytics.allRows}
          currency={currency}
        />
      )}

      {/* SECTION 5: The "Why" Layer (Context & Contributing Factors) */}
      {(viewMode === 'comprehensive' || viewMode === 'what_if') && (
        <SellThroughWhyLayer
          whyLayer={analytics.whyLayer}
          currency={currency}
        />
      )}

      {/* SECTION 6: Interactive "What-If" & Forecasting Module */}
      {(viewMode === 'comprehensive' || viewMode === 'what_if') && (
        <SellThroughWhatIfModule
          analytics={analytics}
          currency={currency}
        />
      )}

      {/* SECTION 7: The "Health & Benchmark" Ribbon */}
      {(viewMode === 'comprehensive' || viewMode === 'what_if') && (
        <SellThroughBenchmarks
          benchmarks={analytics.benchmarks}
          currentSTR={analytics.executiveSummary.currentSTR}
        />
      )}

      {/* SECTION 8: The "Annotation & Collaboration" Layer */}
      {viewMode === 'comprehensive' && (
        <SellThroughAnnotations />
      )}

      {/* SECTION 9: Footnotes: The "Methodology" Box */}
      <SellThroughMethodology />

    </div>
  );
}
