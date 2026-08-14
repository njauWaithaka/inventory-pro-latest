import React, { useState, useMemo } from 'react';
import { ArrowRight, Info, Layers, Package } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ProcessedProduct {
  id: string;
  processedName: string;
  processedSku: string;
  processedCategory: string;
  unitCost: number;
  stock: number;
  inventoryValue: number;
  abcClass: 'A' | 'B' | 'C';
  [key: string]: any;
}

interface InventoryCapitalConcentrationChartProps {
  classifiedProducts: ProcessedProduct[];
  totalInventoryValue: number;
  currency?: string;
}

export function InventoryCapitalConcentrationChart({
  classifiedProducts = [],
  totalInventoryValue = 0,
  currency = 'KSh',
}: InventoryCapitalConcentrationChartProps) {
  const [metric, setMetric] = useState<'value' | 'units'>('value');
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  // Filter and sort products based on selected metric
  const sortedAndFilteredProducts = useMemo(() => {
    if (classifiedProducts.length === 0) return [];

    if (metric === 'value') {
      const sorted = [...classifiedProducts].sort((a, b) => b.inventoryValue - a.inventoryValue);
      const nonZero = sorted.filter(p => p.inventoryValue > 0);
      return nonZero.length >= 5 ? nonZero : sorted;
    } else {
      const sorted = [...classifiedProducts].sort((a, b) => b.stock - a.stock);
      const nonZero = sorted.filter(p => p.stock > 0);
      return nonZero.length >= 5 ? nonZero : sorted;
    }
  }, [classifiedProducts, metric]);

  const displayedProducts = useMemo(() => {
    return isExpanded ? sortedAndFilteredProducts : sortedAndFilteredProducts.slice(0, 5);
  }, [sortedAndFilteredProducts, isExpanded]);

  // Max value for bar width calculation
  const maxValue = useMemo(() => {
    if (displayedProducts.length === 0) return 1;
    const topItem = displayedProducts[0];
    return metric === 'value' ? topItem.inventoryValue : topItem.stock;
  }, [displayedProducts, metric]);

  // Dynamic Contextual Footer Insight
  const footerInsight = useMemo(() => {
    if (classifiedProducts.length === 0) {
      return "No active inventory items found in database.";
    }

    if (metric === 'value') {
      if (totalInventoryValue <= 0) {
        return "Total inventory capital valuation is currently KSh 0.";
      }
      const top1 = sortedAndFilteredProducts[0];
      if (top1 && top1.inventoryValue > 0) {
        const top1Pct = Math.round((top1.inventoryValue / totalInventoryValue) * 100);
        if (top1Pct >= 20) {
          return `1 SKU (${top1.processedName}) accounts for ${top1Pct}% of total inventory value.`;
        }
      }

      const top5Value = sortedAndFilteredProducts.slice(0, 5).reduce((sum, p) => sum + p.inventoryValue, 0);
      const top5Pct = Math.round((top5Value / totalInventoryValue) * 100);
      if (top5Pct > 0) {
        return `Top 5 SKUs account for ${top5Pct}% of total working capital.`;
      }

      return "Inventory value is concentrated in top-ranking SKUs.";
    } else {
      const totalUnits = classifiedProducts.reduce((sum, p) => sum + p.stock, 0);
      if (totalUnits <= 0) {
        return "Total stock quantity across all SKUs is 0 units.";
      }
      const top1ByStock = sortedAndFilteredProducts[0];
      if (top1ByStock && top1ByStock.stock > 0) {
        const top1StockPct = Math.round((top1ByStock.stock / totalUnits) * 100);
        if (top1StockPct >= 20) {
          return `1 SKU (${top1ByStock.processedName}) holds ${top1StockPct}% of total unit stock.`;
        }
      }

      const top5Stock = sortedAndFilteredProducts.slice(0, 5).reduce((sum, p) => sum + p.stock, 0);
      const top5StockPct = Math.round((top5Stock / totalUnits) * 100);
      return `Top 5 SKUs represent ${top5StockPct}% of total physical stock count.`;
    }
  }, [classifiedProducts, sortedAndFilteredProducts, metric, totalInventoryValue]);

  return (
    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-w-0 h-full relative">
      
      {/* Header & Control Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Inventory Capital Concentration</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium truncate">
            Where your working capital is currently tied up
          </p>
        </div>

        {/* Value / Units Toggle Control */}
        <div className="inline-flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300/60 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setMetric('value')}
            className={cn(
              "px-3 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wider transition-all",
              metric === 'value'
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Value
          </button>
          <button
            type="button"
            onClick={() => setMetric('units')}
            className={cn(
              "px-3 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wider transition-all",
              metric === 'units'
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Units
          </button>
        </div>
      </div>

      {/* Horizontal Bar Chart Body */}
      <div className="space-y-3.5 my-4 min-w-0">
        {displayedProducts.map((item, idx) => {
          const itemVal = metric === 'value' ? item.inventoryValue : item.stock;
          const barWidthPct = maxValue > 0 ? (itemVal / maxValue) * 100 : 0;
          const isClassA = item.abcClass === 'A';
          const isClassB = item.abcClass === 'B';
          const isTooltipActive = activeTooltipId === item.id;

          return (
            <div 
              key={item.id || idx} 
              className="group relative space-y-1.5 min-w-0"
              onMouseEnter={() => setActiveTooltipId(item.id)}
              onMouseLeave={() => setActiveTooltipId(null)}
              onClick={() => setActiveTooltipId(prev => prev === item.id ? null : item.id)}
            >
              {/* Top Row: Rank, Name, ABC Badge, Metric Value */}
              <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0 w-4 text-right">
                    #{idx + 1}
                  </span>
                  
                  {/* Truncated Product Name */}
                  <span 
                    className="font-bold text-slate-900 truncate max-w-[150px] sm:max-w-[220px] md:max-w-[280px]"
                    title={item.processedName}
                  >
                    {item.processedName}
                  </span>

                  {/* ABC Class Indicator Badge */}
                  <span className={cn(
                    "text-[9px] font-black px-1.5 py-0.2 rounded shrink-0 uppercase border font-mono",
                    isClassA 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : isClassB 
                        ? "bg-blue-50 text-blue-700 border-blue-200" 
                        : "bg-slate-100 text-slate-600 border-slate-200"
                  )}>
                    {item.abcClass}
                  </span>
                </div>

                {/* Value / Units Label */}
                <span className="font-mono font-black text-slate-900 shrink-0 text-right">
                  {metric === 'value' 
                    ? `${currency} ${item.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : `${item.stock.toLocaleString()} units`
                  }
                </span>
              </div>

              {/* Horizontal Bar Visual */}
              <div className="w-full h-3 bg-slate-200/80 rounded-full overflow-hidden relative cursor-pointer group-hover:bg-slate-300/60 transition-colors">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    isClassA ? "bg-emerald-500" : isClassB ? "bg-blue-500" : "bg-slate-500"
                  )}
                  style={{ width: `${Math.max(barWidthPct, 2.5)}%` }}
                />
              </div>

              {/* Hover / Touch Tooltip */}
              {isTooltipActive && (
                <div className="absolute left-0 sm:left-6 -top-14 z-20 bg-slate-900 text-white text-xs rounded-xl p-2.5 shadow-xl border border-slate-700 pointer-events-none animate-in fade-in zoom-in-95 duration-150 min-w-[200px]">
                  <p className="font-black text-slate-100 border-b border-slate-800 pb-1 mb-1.5 truncate">
                    {item.processedName}
                  </p>
                  <div className="space-y-0.5 text-[11px] font-medium text-slate-300">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400">Inventory Value:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {currency} {item.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400">Units in Stock:</span>
                      <span className="font-mono font-bold text-white">
                        {item.stock.toLocaleString()} units
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400">ABC Class:</span>
                      <span className={cn(
                        "font-bold font-mono px-1 rounded text-[10px]",
                        isClassA ? "text-emerald-400 bg-emerald-950" : isClassB ? "text-blue-400 bg-blue-950" : "text-slate-300 bg-slate-800"
                      )}>
                        Class {item.abcClass}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {displayedProducts.length === 0 && (
          <div className="py-12 text-center text-xs font-bold text-slate-400 space-y-2">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p>No inventory items available to display.</p>
          </div>
        )}
      </div>

      {/* Footer & View All Control */}
      <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2 text-xs font-medium min-w-0">
        <p className="text-[11px] text-slate-600 truncate flex items-center gap-1.5 min-w-0">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{footerInsight}</span>
        </p>

        {sortedAndFilteredProducts.length > 5 && (
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="text-[11px] font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-1 shrink-0 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors border border-emerald-200/80"
          >
            <span>{isExpanded ? 'Show Top 5' : 'View all'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

    </div>
  );
}
