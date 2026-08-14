import React, { useMemo } from 'react';
import { 
  Boxes, DollarSign
} from 'lucide-react';
import { cn, formatCompactNumber } from '../../lib/utils';
import { InventoryCapitalConcentrationChart } from './InventoryCapitalConcentrationChart';
import { 
  getProductUnitCost as serviceGetProductUnitCost, 
  getProductCurrentStock as serviceGetProductCurrentStock,
  calculateABCClassification
} from '../../lib/inventoryIntelligenceService';

interface Product {
  id: string;
  name?: string;
  productName?: string;
  sku?: string;
  category?: string;
  buyingPrice?: number;
  costPrice?: number;
  value?: number;
  cost?: number;
  sellingPrice?: number;
  price?: number;
  unitPrice?: number;
  quantity?: number;
  currentStock?: number;
  minStock?: number;
  [key: string]: any;
}

interface ABCAnalysisSectionProps {
  products: Product[];
  currency?: string;
  title?: string;
  subtitle?: string;
}

export function getProductUnitCost(p: Product): number {
  return serviceGetProductUnitCost(p);
}

export function getProductStock(p: Product): number {
  return serviceGetProductCurrentStock(p);
}

export function ABCAnalysisSection({
  products = [],
  currency = 'KSh',
  title = 'ABC Inventory & Capital Valuation',
  subtitle = 'Identify capital concentration and top value-holding products'
}: ABCAnalysisSectionProps) {

  // 1. Calculate Unit Cost, Stock, Value and sort descending
  const { classifiedProducts, totalInventoryValue, totalSKUs, classSummary } = useMemo(() => {
    const totalSKUs = products.length;

    // Process each product
    const processed = products.map(p => {
      const unitCost = serviceGetProductUnitCost(p);
      const stock = serviceGetProductCurrentStock(p);
      const inventoryValue = unitCost * stock;
      const name = p.name || p.productName || p.sku || 'Unnamed Product';
      const sku = p.sku || p.id || 'N/A';
      const category = p.category || 'General';

      return {
        ...p,
        processedName: name,
        processedSku: sku,
        processedCategory: category,
        unitCost,
        stock,
        inventoryValue,
      };
    });

    // Sort descending by inventory value
    const sorted = [...processed].sort((a, b) => b.inventoryValue - a.inventoryValue);

    const totalInventoryValue = sorted.reduce((sum, item) => sum + item.inventoryValue, 0);

    // Compute Cumulative Percentages and ABC Classification
    let runningVal = 0;
    const classified = sorted.map((item, idx) => {
      const prevCumPct = totalInventoryValue > 0 ? (runningVal / totalInventoryValue) * 100 : 0;
      runningVal += item.inventoryValue;
      const cumPct = totalInventoryValue > 0 ? (runningVal / totalInventoryValue) * 100 : 0;
      const pctOfTotal = totalInventoryValue > 0 ? (item.inventoryValue / totalInventoryValue) * 100 : 0;

      let abcClass: 'A' | 'B' | 'C' = 'C';
      if (totalInventoryValue > 0) {
        if (prevCumPct < 80) abcClass = 'A';
        else if (prevCumPct < 95) abcClass = 'B';
        else abcClass = 'C';
      } else {
        // Fallback ratio if zero total value
        const itemRatio = totalSKUs > 0 ? (idx + 1) / totalSKUs : 0;
        if (itemRatio <= 0.2) abcClass = 'A';
        else if (itemRatio <= 0.5) abcClass = 'B';
        else abcClass = 'C';
      }

      return {
        ...item,
        rank: idx + 1,
        pctOfTotal,
        cumPct,
        abcClass,
      };
    });

    // Aggregate metrics per Class
    const classAItems = classified.filter(p => p.abcClass === 'A');
    const classBItems = classified.filter(p => p.abcClass === 'B');
    const classCItems = classified.filter(p => p.abcClass === 'C');

    const getSummary = (items: typeof classified, label: string) => {
      const count = items.length;
      const val = items.reduce((s, i) => s + i.inventoryValue, 0);
      const skuPct = totalSKUs > 0 ? Math.round((count / totalSKUs) * 100) : 0;
      const capitalPct = totalInventoryValue > 0 ? (val / totalInventoryValue) * 100 : 0;
      return {
        label,
        count,
        skuPct,
        value: val,
        capitalPct,
        items
      };
    };

    return {
      classifiedProducts: classified,
      totalInventoryValue,
      totalSKUs,
      classSummary: {
        A: getSummary(classAItems, 'Class A'),
        B: getSummary(classBItems, 'Class B'),
        C: getSummary(classCItems, 'Class C')
      }
    };
  }, [products]);

  // Top 10 Products by Inventory Value
  const top10Products = useMemo(() => {
    return classifiedProducts.slice(0, 10);
  }, [classifiedProducts]);

  const maxTopValue = useMemo(() => {
    return top10Products.length > 0 ? top10Products[0].inventoryValue : 1;
  }, [top10Products]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 lg:p-8 space-y-6 text-left min-w-0">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-50 text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">
            Capital Analysis
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. TOP SUMMARY KPI CARDS                                   */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        
        {/* Total SKUs */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Total SKUs</span>
            <Boxes className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900 leading-none">{totalSKUs}</p>
          <p className="text-[10px] font-bold text-slate-400">Active Stocked Items</p>
        </div>

        {/* Total Inventory Value */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Inventory Value</span>
            <DollarSign className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900 leading-none">
            {currency} {totalInventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] font-bold text-slate-400">Working Capital Tied Up</p>
        </div>

        {/* Class A KPI Card */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 px-1.5 py-0.5 rounded">
              Class A (High Value)
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          </div>
          {classSummary.A.count > 0 ? (
            <>
              <p className="text-lg sm:text-xl font-black text-emerald-950 leading-none">
                {currency} {classSummary.A.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] font-extrabold text-emerald-800">
                {classSummary.A.count} SKUs ({classSummary.A.skuPct}%) • {classSummary.A.capitalPct.toFixed(1)}% Capital
              </p>
            </>
          ) : (
            <div className="pt-1">
              <p className="text-[11px] font-bold text-emerald-700 italic">No products currently classified</p>
            </div>
          )}
        </div>

        {/* Class B KPI Card */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-blue-800">
            <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 px-1.5 py-0.5 rounded">
              Class B (Moderate)
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          </div>
          {classSummary.B.count > 0 ? (
            <>
              <p className="text-lg sm:text-xl font-black text-blue-950 leading-none">
                {currency} {classSummary.B.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] font-extrabold text-blue-800">
                {classSummary.B.count} SKUs ({classSummary.B.skuPct}%) • {classSummary.B.capitalPct.toFixed(1)}% Capital
              </p>
            </>
          ) : (
            <div className="pt-1">
              <p className="text-[11px] font-bold text-blue-700 italic">No products currently classified</p>
            </div>
          )}
        </div>

        {/* Class C KPI Card */}
        <div className="col-span-2 lg:col-span-1 bg-slate-100/80 border border-slate-200 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-[10px] font-black uppercase tracking-wider bg-slate-200 px-1.5 py-0.5 rounded">
              Class C (Low Value)
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
          </div>
          {classSummary.C.count > 0 ? (
            <>
              <p className="text-lg sm:text-xl font-black text-slate-900 leading-none">
                {currency} {classSummary.C.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] font-extrabold text-slate-600">
                {classSummary.C.count} SKUs ({classSummary.C.skuPct}%) • {classSummary.C.capitalPct.toFixed(1)}% Capital
              </p>
            </>
          ) : (
            <div className="pt-1">
              <p className="text-[11px] font-bold text-slate-500 italic">No products currently classified</p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. MAIN DASHBOARD SECTION: TOP VALUE + CAPITAL ALLOCATION  */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Side: Inventory Capital Concentration Horizontal Bar Chart (7 Cols) */}
        <div className="lg:col-span-7 min-w-0">
          <InventoryCapitalConcentrationChart
            classifiedProducts={classifiedProducts}
            totalInventoryValue={totalInventoryValue}
            currency={currency}
          />
        </div>

        {/* Right Side: ABC Capital Allocation Visual Card + Action Table (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 min-w-0">
          
          {/* ABC Inventory Allocation Banner Visual */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">
                  ABC Inventory Allocation
                </span>
                <p className="text-[11px] text-slate-400 font-medium">
                  Where is your inventory money tied up?
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-300">
                {currency} {formatCompactNumber(totalInventoryValue)}
              </span>
            </div>

            {/* Visual Box Cards */}
            <div className="grid grid-cols-3 gap-2">
              
              {/* Class A Box */}
              <div className="bg-slate-800/90 border border-emerald-500/30 rounded-xl p-2.5 text-center flex flex-col justify-between space-y-1">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                  {classSummary.A.capitalPct.toFixed(0)}% Capital
                </div>
                <div className="py-1 bg-emerald-950/60 rounded-lg border border-emerald-500/20">
                  <span className="text-xs font-black text-emerald-300 block">Class A</span>
                  <span className="text-[11px] font-bold text-white font-mono block">
                    {currency} {formatCompactNumber(classSummary.A.value)}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  {classSummary.A.count} SKUs
                </span>
              </div>

              {/* Class B Box */}
              <div className="bg-slate-800/90 border border-blue-500/30 rounded-xl p-2.5 text-center flex flex-col justify-between space-y-1">
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
                  {classSummary.B.capitalPct.toFixed(0)}% Capital
                </div>
                <div className="py-1 bg-blue-950/60 rounded-lg border border-blue-500/20">
                  <span className="text-xs font-black text-blue-300 block">Class B</span>
                  <span className="text-[11px] font-bold text-white font-mono block">
                    {currency} {formatCompactNumber(classSummary.B.value)}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  {classSummary.B.count} SKUs
                </span>
              </div>

              {/* Class C Box */}
              <div className="bg-slate-800/90 border border-slate-600/30 rounded-xl p-2.5 text-center flex flex-col justify-between space-y-1">
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-wider">
                  {classSummary.C.capitalPct.toFixed(0)}% Capital
                </div>
                <div className="py-1 bg-slate-700/60 rounded-lg border border-slate-600/20">
                  <span className="text-xs font-black text-slate-200 block">Class C</span>
                  <span className="text-[11px] font-bold text-white font-mono block">
                    {currency} {formatCompactNumber(classSummary.C.value)}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  {classSummary.C.count} SKUs
                </span>
              </div>

            </div>

            {/* Actionable Table with View Products Buttons */}
            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block border-b border-slate-800/80 pb-1">
                Actionable Inventory Control
              </span>

              <div className="divide-y divide-slate-800/60 text-xs">
                
                {/* Class A Row */}
                <div className="py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <span className="font-extrabold text-white">Class A</span>
                      <span className="text-[10px] text-slate-400 block">{classSummary.A.count} SKUs • {currency}{formatCompactNumber(classSummary.A.value)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/50">
                    Tight Control
                  </span>
                </div>

                {/* Class B Row */}
                <div className="py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    <div>
                      <span className="font-extrabold text-white">Class B</span>
                      <span className="text-[10px] text-slate-400 block">{classSummary.B.count} SKUs • {currency}{formatCompactNumber(classSummary.B.value)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800/50">
                    Monitor
                  </span>
                </div>

                {/* Class C Row */}
                <div className="py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                    <div>
                      <span className="font-extrabold text-white">Class C</span>
                      <span className="text-[10px] text-slate-400 block">{classSummary.C.count} SKUs • {currency}{formatCompactNumber(classSummary.C.value)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    Optimize
                  </span>
                </div>

              </div>
            </div>

          </div>

          {/* Strategic Action Guide Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5 flex-1 flex flex-col justify-center">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
              Strategic Control Policy
            </span>

            <div className="space-y-2 text-xs text-slate-600 font-medium">
              <p className="leading-snug">
                <strong className="text-slate-900">Class A Policy:</strong> Weekly cycle counting and strict safety thresholds. Requires executive clearance for overstocking.
              </p>
              <p className="leading-snug">
                <strong className="text-slate-900">Class B Policy:</strong> Bi-weekly automated inventory reviews with standard economic order quantities.
              </p>
              <p className="leading-snug">
                <strong className="text-slate-900">Class C Policy:</strong> Low-touch bulk purchasing to minimize supplier invoice & processing overhead.
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
