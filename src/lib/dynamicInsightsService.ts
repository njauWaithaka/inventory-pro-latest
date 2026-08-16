/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product } from '../types';

export type InsightSeverity = 'green' | 'yellow' | 'red' | 'neutral';

export type InsightElementId =
  | 'dashboard_executive_kpis'
  | 'dashboard_stock_alert'
  | 'dashboard_activity_overview'
  | 'inventory_valuation_health'
  | 'inventory_stock_distribution'
  | 'inventory_sku_aging'
  | 'demand_forecast_velocity'
  | 'demand_reorder_urgency'
  | 'demand_stockout_risk'
  | 'analytics_turnover_efficiency'
  | 'analytics_sell_through'
  | 'analytics_abc_capital'
  | 'analytics_pareto_distribution'
  | 'profit_gross_margin'
  | 'profit_expense_impact'
  | 'profit_margin_trajectory'
  | 'profit_cogs_breakdown'
  | 'sales_revenue_growth'
  | 'sales_top_performers'
  | 'sales_volume_trajectory';

export const ALL_INSIGHT_ELEMENT_IDS: InsightElementId[] = [
  'dashboard_executive_kpis',
  'dashboard_stock_alert',
  'dashboard_activity_overview',
  'inventory_valuation_health',
  'inventory_stock_distribution',
  'inventory_sku_aging',
  'demand_forecast_velocity',
  'demand_reorder_urgency',
  'demand_stockout_risk',
  'analytics_turnover_efficiency',
  'analytics_sell_through',
  'analytics_abc_capital',
  'analytics_pareto_distribution',
  'profit_gross_margin',
  'profit_expense_impact',
  'profit_margin_trajectory',
  'profit_cogs_breakdown',
  'sales_revenue_growth',
  'sales_top_performers',
  'sales_volume_trajectory',
];

export interface DynamicInsight {
  elementId: InsightElementId;
  severity: InsightSeverity;
  text: string;
  relatedSku: string | null;
  generatedAt?: string;
}

export interface InsightsSnapshot {
  executiveKPIs: {
    totalSales: number;
    cogs: number;
    netProfit: number;
    margin: number; // percentage, e.g. 32.5
    inventoryValue: number;
    sellThroughRate: number; // percentage, e.g. 64.2
    stockCoverageDays: number;
    stockTurnover: number;
    atRiskSkuCount: number;
  };
  inventoryHealth: {
    healthyCount: number;
    atRiskCount: number;
    overstockedCount: number;
    totalCount: number;
  };
  topProductsByRevenue: Array<{
    sku: string;
    name: string;
    revenue: number;
    unitsSold: number;
    margin: number;
  }>;
  categoryValueDistribution: Array<{
    category: string;
    totalValue: number;
    skuCount: number;
    percentageOfTotal: number;
  }>;
  stockoutHorizonBuckets: {
    zeroToThreeDays: number;
    fourToSevenDays: number;
    eightToFourteenDays: number;
    fifteenToThirtyDays: number;
    overThirtyDays: number;
    criticalItems: Array<{
      sku: string;
      name: string;
      stock: number;
      daysRemaining: number;
    }>;
  };
  reorderOpportunities: Array<{
    sku: string;
    name: string;
    currentStock: number;
    dailySalesVelocity: number;
    daysCoverage: number;
    suggestedReorderQty: number;
  }>;
  skuAging: Array<{
    sku: string;
    name: string;
    ageInDays: number;
    classification: string;
    stockValue: number;
  }>;
  turnoverRatioPerSku: Array<{
    sku: string;
    name: string;
    turnoverRatio: number;
    annualVelocity: number;
  }>;
  abcCapitalAllocation: {
    classA: { count: number; value: number; percentValue: number };
    classB: { count: number; value: number; percentValue: number };
    classC: { count: number; value: number; percentValue: number };
  };
  sellThroughPerformancePerSku: Array<{
    sku: string;
    name: string;
    sellThroughRate: number;
    initialStock: number;
    unitsSold: number;
  }>;
}

export interface AppDataState {
  products: any[];
  invoices?: any[];
  stockMovements?: any[];
  expenses?: any[];
  purchaseOrders?: any[];
  currency?: string;
}

/**
 * 1. Data Aggregator Function: Computes current state into the standard fixed JSON schema.
 * All numbers default to 0 / null when missing, never omitting any key.
 */
export function getInsightsSnapshot(data: AppDataState): InsightsSnapshot {
  const products: any[] = Array.isArray(data.products) ? data.products : [];
  const invoices: any[] = Array.isArray(data.invoices) ? data.invoices : [];
  const stockMovements: any[] = Array.isArray(data.stockMovements) ? data.stockMovements : [];
  const expenses: any[] = Array.isArray(data.expenses) ? data.expenses : [];

  // Helper product extraction
  const productSalesMap = new Map<
    string,
    { sku: string; name: string; category: string; unitsSold: number; revenue: number; cogs: number }
  >();

  // Aggregate product-level sales from invoices
  invoices.forEach((inv) => {
    const items = Array.isArray(inv.items) ? inv.items : [];
    items.forEach((item: any) => {
      const pId = item.id || item.productId || item.sku || 'unknown';
      const sku = item.sku || pId;
      const name = item.name || item.productName || 'Product';
      const qty = Number(item.quantity) || 1;
      const price = Number(item.price || item.unitPrice) || 0;
      const rev = Number(item.total) || qty * price;

      const p = products.find((prod) => prod.id === pId || prod.sku === sku || prod.name === name);
      const unitCost = Number(p?.buyingPrice || p?.costPrice || p?.value || 0) || price * 0.65;
      const cogs = qty * unitCost;

      const existing = productSalesMap.get(sku) || {
        sku,
        name,
        category: p?.category || 'General',
        unitsSold: 0,
        revenue: 0,
        cogs: 0,
      };

      existing.unitsSold += qty;
      existing.revenue += rev;
      existing.cogs += cogs;
      productSalesMap.set(sku, existing);
    });
  });

  // Calculate totals
  let totalSales = 0;
  let totalCogs = 0;
  let totalInventoryValue = 0;
  let totalInventoryUnits = 0;
  let totalInitialUnits = 0;
  let totalUnitsSold = 0;

  products.forEach((p) => {
    const stock = Number(p.quantity ?? p.currentStock ?? 0);
    const unitCost = Number(p.buyingPrice ?? p.costPrice ?? p.value ?? 0);
    const itemVal = stock * (unitCost > 0 ? unitCost : 0);
    totalInventoryValue += itemVal;
    totalInventoryUnits += stock;

    const soldRecord = productSalesMap.get(p.sku || p.id);
    const soldQty = soldRecord?.unitsSold || Number(p.unitsSold || 0);
    totalUnitsSold += soldQty;
    totalInitialUnits += stock + soldQty;
  });

  productSalesMap.forEach((rec) => {
    totalSales += rec.revenue;
    totalCogs += rec.cogs;
  });

  // Include expenses in net profit calculation
  let totalExpenses = 0;
  expenses.forEach((exp) => {
    totalExpenses += Number(exp.amount || exp.total || 0);
  });

  const grossProfit = totalSales - totalCogs;
  const netProfit = grossProfit - totalExpenses;
  const margin = totalSales > 0 ? Number(((grossProfit / totalSales) * 100).toFixed(1)) : 0;
  const overallSellThroughRate =
    totalInitialUnits > 0 ? Number(((totalUnitsSold / totalInitialUnits) * 100).toFixed(1)) : 0;

  // Daily demand and stock coverage
  const dailyBurnRate = totalUnitsSold > 0 ? totalUnitsSold / 30 : 0.5;
  const stockCoverageDays =
    dailyBurnRate > 0 ? Math.round(totalInventoryUnits / dailyBurnRate) : 45;
  const stockTurnover =
    totalInventoryValue > 0 ? Number(((totalCogs * 4) / totalInventoryValue).toFixed(2)) : 0;

  // Inventory Health breakdown
  let healthyCount = 0;
  let atRiskCount = 0;
  let overstockedCount = 0;

  const stockoutHorizonBuckets = {
    zeroToThreeDays: 0,
    fourToSevenDays: 0,
    eightToFourteenDays: 0,
    fifteenToThirtyDays: 0,
    overThirtyDays: 0,
    criticalItems: [] as Array<{ sku: string; name: string; stock: number; daysRemaining: number }>,
  };

  const reorderOpportunities: InsightsSnapshot['reorderOpportunities'] = [];
  const skuAging: InsightsSnapshot['skuAging'] = [];
  const turnoverRatioPerSku: InsightsSnapshot['turnoverRatioPerSku'] = [];
  const sellThroughPerformancePerSku: InsightsSnapshot['sellThroughPerformancePerSku'] = [];

  const now = new Date();

  products.forEach((p) => {
    const stock = Number(p.quantity ?? p.currentStock ?? 0);
    const minStock = Number(p.minStock ?? p.reorderLevel ?? 10);
    const maxStock = Number(p.maxStock ?? minStock * 3);
    const sku = p.sku || p.id || 'SKU-0';
    const name = p.name || 'Unnamed Product';
    const unitCost = Number(p.buyingPrice ?? p.costPrice ?? p.value ?? 0);

    const soldRecord = productSalesMap.get(sku) || productSalesMap.get(p.id);
    const soldQty = soldRecord?.unitsSold || Number(p.unitsSold || 0);
    const dailyVelocity = Number((soldQty / 30).toFixed(2)) || (stock > 0 ? 0.2 : 0);
    const daysRemaining =
      dailyVelocity > 0 ? Math.round(stock / dailyVelocity) : stock > 0 ? 90 : 0;

    // Health categorization
    if (stock <= 0 || (stock <= minStock && dailyVelocity > 0)) {
      atRiskCount++;
    } else if (stock > maxStock && dailyVelocity < 0.5) {
      overstockedCount++;
    } else {
      healthyCount++;
    }

    // Horizon buckets
    if (daysRemaining <= 3) {
      stockoutHorizonBuckets.zeroToThreeDays++;
      if (stockoutHorizonBuckets.criticalItems.length < 5) {
        stockoutHorizonBuckets.criticalItems.push({ sku, name, stock, daysRemaining });
      }
    } else if (daysRemaining <= 7) {
      stockoutHorizonBuckets.fourToSevenDays++;
    } else if (daysRemaining <= 14) {
      stockoutHorizonBuckets.eightToFourteenDays++;
    } else if (daysRemaining <= 30) {
      stockoutHorizonBuckets.fifteenToThirtyDays++;
    } else {
      stockoutHorizonBuckets.overThirtyDays++;
    }

    // Reorder Opportunities
    if (stock <= minStock || daysRemaining <= 10) {
      const suggestedQty = Math.max(minStock * 2 - stock, 10);
      reorderOpportunities.push({
        sku,
        name,
        currentStock: stock,
        dailySalesVelocity: dailyVelocity,
        daysCoverage: daysRemaining,
        suggestedReorderQty: suggestedQty,
      });
    }

    // SKU Aging calculation
    const createdAtDate = p.createdAt ? new Date(p.createdAt) : new Date(now.getTime() - 45 * 86400000);
    const ageInDays = Math.max(1, Math.floor((now.getTime() - createdAtDate.getTime()) / 86400000));
    let classification = 'Fresh';
    if (ageInDays > 90 && soldQty < 5) classification = 'Slow Moving';
    else if (ageInDays > 180 && soldQty === 0) classification = 'Obsolete';
    else if (soldQty > 15) classification = 'Fast Moving';
    else classification = 'Active';

    skuAging.push({
      sku,
      name,
      ageInDays,
      classification,
      stockValue: stock * unitCost,
    });

    // Turnover per SKU
    const itemCogs = soldQty * unitCost;
    const itemAvgValue = Math.max(stock * unitCost, 1);
    const itemTurnover = Number(((itemCogs * 4) / itemAvgValue).toFixed(2));
    turnoverRatioPerSku.push({
      sku,
      name,
      turnoverRatio: itemTurnover,
      annualVelocity: soldQty * 12,
    });

    // Sell-through per SKU
    const initialQty = stock + soldQty;
    const itemSellThrough =
      initialQty > 0 ? Number(((soldQty / initialQty) * 100).toFixed(1)) : 0;
    sellThroughPerformancePerSku.push({
      sku,
      name,
      sellThroughRate: itemSellThrough,
      initialStock: initialQty,
      unitsSold: soldQty,
    });
  });

  // Top 5 products by revenue
  const allSalesProducts = Array.from(productSalesMap.values());
  allSalesProducts.sort((a, b) => b.revenue - a.revenue);
  const topProductsByRevenue = allSalesProducts.slice(0, 5).map((p) => {
    const prodMargin = p.revenue > 0 ? Number((((p.revenue - p.cogs) / p.revenue) * 100).toFixed(1)) : 0;
    return {
      sku: p.sku,
      name: p.name,
      revenue: p.revenue,
      unitsSold: p.unitsSold,
      margin: prodMargin,
    };
  });

  // Category value distribution
  const catMap = new Map<string, { totalValue: number; count: number }>();
  products.forEach((p) => {
    const cat = p.category || 'General';
    const stock = Number(p.quantity ?? p.currentStock ?? 0);
    const unitCost = Number(p.buyingPrice ?? p.costPrice ?? p.value ?? 0);
    const existing = catMap.get(cat) || { totalValue: 0, count: 0 };
    existing.totalValue += stock * unitCost;
    existing.count += 1;
    catMap.set(cat, existing);
  });

  const categoryValueDistribution = Array.from(catMap.entries()).map(([category, val]) => ({
    category,
    totalValue: Math.round(val.totalValue),
    skuCount: val.count,
    percentageOfTotal:
      totalInventoryValue > 0
        ? Number(((val.totalValue / totalInventoryValue) * 100).toFixed(1))
        : 0,
  }));
  categoryValueDistribution.sort((a, b) => b.totalValue - a.totalValue);

  // ABC Capital Allocation
  const sortedByValue = [...products].sort((a, b) => {
    const valA = Number(a.quantity ?? 0) * Number(a.buyingPrice ?? a.costPrice ?? 0);
    const valB = Number(b.quantity ?? 0) * Number(b.buyingPrice ?? b.costPrice ?? 0);
    return valB - valA;
  });

  let accumVal = 0;
  const classA = { count: 0, value: 0, percentValue: 0 };
  const classB = { count: 0, value: 0, percentValue: 0 };
  const classC = { count: 0, value: 0, percentValue: 0 };

  sortedByValue.forEach((p) => {
    const val = Number(p.quantity ?? 0) * Number(p.buyingPrice ?? p.costPrice ?? 0);
    accumVal += val;
    const runningPct = totalInventoryValue > 0 ? (accumVal / totalInventoryValue) * 100 : 0;
    if (runningPct <= 80 || classA.count === 0) {
      classA.count++;
      classA.value += val;
    } else if (runningPct <= 95) {
      classB.count++;
      classB.value += val;
    } else {
      classC.count++;
      classC.value += val;
    }
  });

  if (totalInventoryValue > 0) {
    classA.percentValue = Number(((classA.value / totalInventoryValue) * 100).toFixed(1));
    classB.percentValue = Number(((classB.value / totalInventoryValue) * 100).toFixed(1));
    classC.percentValue = Number(((classC.value / totalInventoryValue) * 100).toFixed(1));
  }

  return {
    executiveKPIs: {
      totalSales: Math.round(totalSales),
      cogs: Math.round(totalCogs),
      netProfit: Math.round(netProfit),
      margin,
      inventoryValue: Math.round(totalInventoryValue),
      sellThroughRate: overallSellThroughRate,
      stockCoverageDays,
      stockTurnover,
      atRiskSkuCount: atRiskCount,
    },
    inventoryHealth: {
      healthyCount,
      atRiskCount,
      overstockedCount,
      totalCount: products.length,
    },
    topProductsByRevenue,
    categoryValueDistribution,
    stockoutHorizonBuckets,
    reorderOpportunities: reorderOpportunities.slice(0, 8),
    skuAging: skuAging.slice(0, 10),
    turnoverRatioPerSku: turnoverRatioPerSku.slice(0, 10),
    abcCapitalAllocation: { classA, classB, classC },
    sellThroughPerformancePerSku: sellThroughPerformancePerSku.slice(0, 10),
  };
}

/**
 * 2. Deterministic Local Analytical Engine:
 * Generates robust, verb-first, real-data grounded insights for all 16 UI locations instantly.
 * This guarantees instant rendering on cold loads or when API is responding/offline.
 */
export function generateLocalFallbackInsights(
  snapshot: InsightsSnapshot,
  currency: string = 'KSh'
): DynamicInsight[] {
  const kpis = snapshot.executiveKPIs;
  const health = snapshot.inventoryHealth;
  const topProd = snapshot.topProductsByRevenue[0];
  const topCat = snapshot.categoryValueDistribution[0];
  const urgentReorders = snapshot.reorderOpportunities;
  const criticalHorizon = snapshot.stockoutHorizonBuckets.criticalItems[0];
  const abc = snapshot.abcCapitalAllocation;

  const insights: DynamicInsight[] = [
    {
      elementId: 'dashboard_executive_kpis',
      severity: kpis.margin >= 25 && kpis.atRiskSkuCount <= 3 ? 'green' : kpis.atRiskSkuCount > 5 ? 'yellow' : 'neutral',
      text: `Maintain positive momentum: total sales stand at ${currency} ${kpis.totalSales.toLocaleString()} with a ${kpis.margin}% gross margin across ${kpis.inventoryValue.toLocaleString()} ${currency} in active inventory.`,
      relatedSku: topProd?.sku || null,
    },
    {
      elementId: 'dashboard_stock_alert',
      severity: snapshot.stockoutHorizonBuckets.zeroToThreeDays > 0 ? 'red' : health.atRiskCount > 0 ? 'yellow' : 'green',
      text: snapshot.stockoutHorizonBuckets.zeroToThreeDays > 0
        ? `Reorder immediately: ${snapshot.stockoutHorizonBuckets.zeroToThreeDays} critical SKUs face stockout within 72 hours, risking lost revenue.`
        : health.atRiskCount > 0
        ? `Monitor ${health.atRiskCount} at-risk inventory items approaching their minimum safety stock buffer.`
        : `Operate with confidence: all inventory lines are safely buffered above reorder thresholds.`,
      relatedSku: criticalHorizon?.sku || null,
    },
    {
      elementId: 'dashboard_activity_overview',
      severity: kpis.stockTurnover >= 3 ? 'green' : kpis.stockTurnover < 1.5 ? 'yellow' : 'neutral',
      text: `Accelerate fulfillment velocity: current annual stock turnover is running at ${kpis.stockTurnover}x with an average stock coverage horizon of ${kpis.stockCoverageDays} days.`,
      relatedSku: null,
    },
    {
      elementId: 'inventory_valuation_health',
      severity: health.atRiskCount > 5 ? 'yellow' : 'green',
      text: `Optimize capital deployment: ${currency} ${kpis.inventoryValue.toLocaleString()} total valuation with ${health.healthyCount} of ${health.totalCount} SKUs operating in optimal stock balance.`,
      relatedSku: null,
    },
    {
      elementId: 'inventory_stock_distribution',
      severity: health.overstockedCount > 3 ? 'yellow' : 'neutral',
      text: topCat
        ? `Concentrate replenishment on ${topCat.category}, which anchors ${topCat.percentageOfTotal}% (${currency} ${topCat.totalValue.toLocaleString()}) of total warehouse valuation.`
        : `Balance catalog inventory levels across all warehouse bins and regional storage branches.`,
      relatedSku: null,
    },
    {
      elementId: 'inventory_sku_aging',
      severity: snapshot.skuAging.some((s) => s.classification === 'Obsolete') ? 'red' : snapshot.skuAging.some((s) => s.classification === 'Slow Moving') ? 'yellow' : 'green',
      text: snapshot.skuAging.some((s) => s.classification === 'Slow Moving' || s.classification === 'Obsolete')
        ? `Liquidate aged holdings: initiate promotional bundles on slow-moving inventory to liberate trapped working capital.`
        : `Maintain agile stock rotation: active catalog shows healthy velocity with minimal aging drag.`,
      relatedSku: snapshot.skuAging.find((s) => s.classification === 'Slow Moving')?.sku || null,
    },
    {
      elementId: 'demand_forecast_velocity',
      severity: kpis.sellThroughRate >= 60 ? 'green' : kpis.sellThroughRate < 35 ? 'yellow' : 'neutral',
      text: `Forecast sustained demand: overall sell-through rate is pacing at ${kpis.sellThroughRate}%, supporting current procurement run rates.`,
      relatedSku: topProd?.sku || null,
    },
    {
      elementId: 'demand_reorder_urgency',
      severity: urgentReorders.length > 0 ? 'red' : 'green',
      text: urgentReorders.length > 0
        ? `Execute replenishment purchase orders for ${urgentReorders.length} priority items before lead times breach safety buffers.`
        : `Maintain steady supplier schedules: replenishment quantities are currently synchronized with sales velocity.`,
      relatedSku: urgentReorders[0]?.sku || null,
    },
    {
      elementId: 'demand_stockout_risk',
      severity: snapshot.stockoutHorizonBuckets.zeroToThreeDays > 0 ? 'red' : snapshot.stockoutHorizonBuckets.fourToSevenDays > 0 ? 'yellow' : 'green',
      text: snapshot.stockoutHorizonBuckets.zeroToThreeDays > 0
        ? `Prevent stockouts: expedited supplier delivery required for ${criticalHorizon?.name || 'top SKU'} (${criticalHorizon?.daysRemaining || 1} day coverage remaining).`
        : `Track supply pipelines: stockout risk remains low across the 14-day operational planning window.`,
      relatedSku: criticalHorizon?.sku || null,
    },
    {
      elementId: 'analytics_turnover_efficiency',
      severity: kpis.stockTurnover >= 4 ? 'green' : kpis.stockTurnover < 2 ? 'yellow' : 'neutral',
      text: `Target 4.0x turnover: current inventory turns at ${kpis.stockTurnover}x, reflecting ${kpis.stockCoverageDays} days of forward sales coverage.`,
      relatedSku: null,
    },
    {
      elementId: 'analytics_sell_through',
      severity: kpis.sellThroughRate >= 65 ? 'green' : kpis.sellThroughRate < 40 ? 'yellow' : 'neutral',
      text: `Benchmark catalog clearance: sell-through rate reached ${kpis.sellThroughRate}% with strong volume conversion across primary product lines.`,
      relatedSku: topProd?.sku || null,
    },
    {
      elementId: 'analytics_abc_capital',
      severity: abc.classA.percentValue > 85 ? 'yellow' : 'green',
      text: `Protect Class A champions: ${abc.classA.count} core SKUs drive ${abc.classA.percentValue}% (${currency} ${abc.classA.value.toLocaleString()}) of warehouse asset capital.`,
      relatedSku: null,
    },
    {
      elementId: 'profit_gross_margin',
      severity: kpis.margin >= 30 ? 'green' : kpis.margin < 15 ? 'red' : 'yellow',
      text: `Sustain margin yield: gross profit stands at ${currency} ${(kpis.totalSales - kpis.cogs).toLocaleString()} (${kpis.margin}% margin) on ${currency} ${kpis.totalSales.toLocaleString()} gross sales.`,
      relatedSku: topProd?.sku || null,
    },
    {
      elementId: 'profit_expense_impact',
      severity: kpis.netProfit > 0 ? 'green' : 'red',
      text: kpis.netProfit > 0
        ? `Maximize net retention: operations generated ${currency} ${kpis.netProfit.toLocaleString()} net profit after accounting for direct COGS and operating expenses.`
        : `Review cost overheads: operational expenses exceed gross profit contributions; audit procurement unit costs.`,
      relatedSku: null,
    },
    {
      elementId: 'sales_revenue_growth',
      severity: kpis.totalSales > 0 ? 'green' : 'neutral',
      text: `Drive revenue expansion: cumulative invoiced sales reached ${currency} ${kpis.totalSales.toLocaleString()} across active customer accounts.`,
      relatedSku: null,
    },
    {
      elementId: 'sales_top_performers',
      severity: topProd ? 'green' : 'neutral',
      text: topProd
        ? `Leverage top revenue winner ${topProd.name} (${topProd.sku}), generating ${currency} ${topProd.revenue.toLocaleString()} with ${topProd.margin}% margin.`
        : `Track individual product margins and volume velocity to identify emerging revenue drivers.`,
      relatedSku: topProd?.sku || null,
    },
  ];

  return insights;
}

/**
 * 3. Insight Generation API Call:
 * Calls server endpoint /api/insights/generate with structured JSON schema.
 * If server fails, falls back gracefully to local heuristic insights without throwing.
 */
export async function generateInsights(
  snapshot: InsightsSnapshot,
  currency: string = 'KSh'
): Promise<DynamicInsight[]> {
  try {
    const res = await fetch('/api/insights/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot, currency }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data = await res.json();
    if (Array.isArray(data?.insights) && data.insights.length > 0) {
      const validInsights: DynamicInsight[] = data.insights.map((item: any) => ({
        elementId: item.elementId as InsightElementId,
        severity: (['green', 'yellow', 'red', 'neutral'].includes(item.severity)
          ? item.severity
          : 'neutral') as InsightSeverity,
        text: String(item.text || '').trim(),
        relatedSku: item.relatedSku || null,
        generatedAt: new Date().toISOString(),
      }));

      // Ensure all 16 locations are present by merging with fallback if any missing
      const localFallbacks = generateLocalFallbackInsights(snapshot, currency);
      const resultMap = new Map<InsightElementId, DynamicInsight>();
      localFallbacks.forEach((fb) => resultMap.set(fb.elementId, fb));
      validInsights.forEach((vi) => resultMap.set(vi.elementId, vi));

      return Array.from(resultMap.values());
    }

    throw new Error('Malformed or empty insights array received.');
  } catch (err) {
    // Log failure silently as requested (don't surface an error to the business owner)
    console.warn('AI Insights generation API fallback triggered:', err);
    return generateLocalFallbackInsights(snapshot, currency);
  }
}

/**
 * Cache management in localStorage
 */
export function getCachedInsights(companyId: string): Record<InsightElementId, DynamicInsight> | null {
  try {
    const raw = localStorage.getItem(`invenio_dynamic_insights_${companyId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.insights === 'object') {
      return parsed.insights;
    }
  } catch (e) {
    console.error('Error reading insights cache:', e);
  }
  return null;
}

export function getCachedInsightsTimestamp(companyId: string): number {
  try {
    const raw = localStorage.getItem(`invenio_dynamic_insights_${companyId}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Number(parsed?.timestamp || 0);
  } catch (e) {
    return 0;
  }
}

export function setCachedInsights(
  companyId: string,
  insightsMap: Record<InsightElementId, DynamicInsight>
) {
  try {
    localStorage.setItem(
      `invenio_dynamic_insights_${companyId}`,
      JSON.stringify({
        timestamp: Date.now(),
        insights: insightsMap,
      })
    );
  } catch (e) {
    console.error('Error saving insights cache:', e);
  }
}
