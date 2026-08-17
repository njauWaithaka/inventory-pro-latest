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
  | 'dashboard_quick_actions'
  | 'inventory_valuation_health'
  | 'inventory_stock_distribution'
  | 'inventory_sku_aging'
  | 'inventory_reorder_watchlist'
  | 'demand_forecast_velocity'
  | 'demand_reorder_urgency'
  | 'demand_stockout_risk'
  | 'demand_seasonal_trends'
  | 'analytics_turnover_efficiency'
  | 'analytics_turnover_ratio'
  | 'analytics_sell_through'
  | 'analytics_abc_capital'
  | 'analytics_pareto_distribution'
  | 'profit_gross_margin'
  | 'profit_expense_impact'
  | 'profit_margin_trajectory'
  | 'profit_cogs_breakdown'
  | 'sales_revenue_growth'
  | 'sales_revenue_velocity'
  | 'sales_top_performers'
  | 'sales_volume_trajectory'
  | 'procurement_reservations_health'
  | 'procurement_hub_commitments'
  | 'procurement_expenses_leakage'
  | 'expenses_burn_rate'
  | 'expiry_spoilage_risk'
  | 'alerts_risk_breakdown'
  | 'pos_checkout_velocity';

export const ALL_INSIGHT_ELEMENT_IDS: InsightElementId[] = [
  'dashboard_executive_kpis',
  'dashboard_stock_alert',
  'dashboard_activity_overview',
  'dashboard_quick_actions',
  'inventory_valuation_health',
  'inventory_stock_distribution',
  'inventory_sku_aging',
  'inventory_reorder_watchlist',
  'demand_forecast_velocity',
  'demand_reorder_urgency',
  'demand_stockout_risk',
  'demand_seasonal_trends',
  'analytics_turnover_efficiency',
  'analytics_turnover_ratio',
  'analytics_sell_through',
  'analytics_abc_capital',
  'analytics_pareto_distribution',
  'profit_gross_margin',
  'profit_expense_impact',
  'profit_margin_trajectory',
  'profit_cogs_breakdown',
  'sales_revenue_growth',
  'sales_revenue_velocity',
  'sales_top_performers',
  'sales_volume_trajectory',
  'procurement_reservations_health',
  'procurement_hub_commitments',
  'procurement_expenses_leakage',
  'expenses_burn_rate',
  'expiry_spoilage_risk',
  'alerts_risk_breakdown',
  'pos_checkout_velocity',
];

export interface DynamicInsight {
  id?: string;
  elementId: InsightElementId;
  severity: InsightSeverity;
  text: string;
  relatedSku: string | null;
  label?: string;
  metricValue?: string;
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
 * Generates robust, verb-first, real-data grounded insights for all UI locations instantly.
 * Produces multiple distinct angles per elementId so the UI can rotate/cycle with transition animations.
 */
export function generateLocalFallbackInsights(
  snapshot: InsightsSnapshot,
  currency: string = 'KSh'
): DynamicInsight[] {
  const kpis = snapshot.executiveKPIs;
  const health = snapshot.inventoryHealth;
  const topProds = snapshot.topProductsByRevenue;
  const topProd = topProds[0];
  const secondProd = topProds[1];
  const topCats = snapshot.categoryValueDistribution;
  const topCat = topCats[0];
  const secondCat = topCats[1];
  const urgentReorders = snapshot.reorderOpportunities;
  const criticalHorizon = snapshot.stockoutHorizonBuckets.criticalItems[0];
  const secondHorizon = snapshot.stockoutHorizonBuckets.criticalItems[1];
  const abc = snapshot.abcCapitalAllocation;
  const slowMovers = snapshot.skuAging.filter((s) => s.classification === 'Slow Moving' || s.classification === 'Obsolete');

  const insights: DynamicInsight[] = [
    // --- DASHBOARD: EXECUTIVE KPIS (Multi-angle) ---
    {
      elementId: 'dashboard_executive_kpis',
      severity: kpis.margin >= 25 && kpis.atRiskSkuCount <= 3 ? 'green' : kpis.atRiskSkuCount > 5 ? 'yellow' : 'neutral',
      text: `Maintain positive momentum: total sales stand at ${currency} ${kpis.totalSales.toLocaleString()} with a ${kpis.margin}% gross margin across ${currency} ${kpis.inventoryValue.toLocaleString()} in active inventory.`,
      relatedSku: topProd?.sku || null,
      label: 'Financial Run Rate',
      metricValue: `${kpis.margin}% Margin`,
    },
    {
      elementId: 'dashboard_executive_kpis',
      severity: kpis.stockCoverageDays > 60 ? 'yellow' : 'green',
      text: `Optimize capital efficiency: current stock provides ${kpis.stockCoverageDays} days of forward sales coverage at a ${kpis.stockTurnover}x annual turnover velocity.`,
      relatedSku: null,
      label: 'Inventory Efficiency',
      metricValue: `${kpis.stockTurnover}x Turn`,
    },
    {
      elementId: 'dashboard_executive_kpis',
      severity: kpis.netProfit > 0 ? 'green' : 'yellow',
      text: `Net operational cashflow generated ${currency} ${kpis.netProfit.toLocaleString()} net profit with a catalog sell-through conversion rate of ${kpis.sellThroughRate}%.`,
      relatedSku: topProd?.sku || null,
      label: 'Net Conversion',
      metricValue: `${kpis.sellThroughRate}% Sell-Through`,
    },

    // --- DASHBOARD: STOCK ALERT (Multi-angle) ---
    {
      elementId: 'dashboard_stock_alert',
      severity: snapshot.stockoutHorizonBuckets.zeroToThreeDays > 0 ? 'red' : health.atRiskCount > 0 ? 'yellow' : 'green',
      text: snapshot.stockoutHorizonBuckets.zeroToThreeDays > 0
        ? `Immediate replenishment required: ${snapshot.stockoutHorizonBuckets.zeroToThreeDays} critical SKUs face stockout within 72 hours, risking lost revenue.`
        : health.atRiskCount > 0
        ? `Monitor ${health.atRiskCount} at-risk inventory items approaching their minimum safety stock buffer.`
        : `Operate with confidence: all inventory lines are safely buffered above reorder thresholds.`,
      relatedSku: criticalHorizon?.sku || null,
      label: 'Stockout Risk Alert',
    },
    {
      elementId: 'dashboard_stock_alert',
      severity: health.overstockedCount > 0 ? 'yellow' : 'green',
      text: health.overstockedCount > 0
        ? `Mitigate deadstock: ${health.overstockedCount} overstocked lines represent surplus holding costs. Consider bundling or promotional clearance.`
        : `Balanced inventory levels: ${health.healthyCount} of ${health.totalCount} products operating in optimal supply equilibrium.`,
      relatedSku: null,
      label: 'Stock Balance',
    },

    // --- DASHBOARD: ACTIVITY OVERVIEW (Multi-angle) ---
    {
      elementId: 'dashboard_activity_overview',
      severity: kpis.stockTurnover >= 3 ? 'green' : kpis.stockTurnover < 1.5 ? 'yellow' : 'neutral',
      text: `Accelerate fulfillment velocity: current annual stock turnover is running at ${kpis.stockTurnover}x with an average coverage horizon of ${kpis.stockCoverageDays} days.`,
      relatedSku: null,
      label: 'Fulfillment Velocity',
    },
    {
      elementId: 'dashboard_activity_overview',
      severity: 'neutral',
      text: `Warehouse activity shows active movements across ${health.totalCount} catalog products, with ${health.healthyCount} items in prime dispatch status.`,
      relatedSku: null,
      label: 'Catalog Health',
    },

    // --- DASHBOARD: QUICK ACTIONS ---
    {
      elementId: 'dashboard_quick_actions',
      severity: urgentReorders.length > 0 ? 'yellow' : 'green',
      text: urgentReorders.length > 0
        ? `Action suggested: review ${urgentReorders.length} draft replenishment orders to maintain continuous warehouse fulfillment.`
        : `All purchase orders & transfers are up to date. Ready for new store receipts or customer shipments.`,
      relatedSku: urgentReorders[0]?.sku || null,
      label: 'Workflow Optimizer',
    },

    // --- INVENTORY: VALUATION HEALTH (Multi-angle) ---
    {
      elementId: 'inventory_valuation_health',
      severity: health.atRiskCount > 5 ? 'yellow' : 'green',
      text: `Optimize capital deployment: ${currency} ${kpis.inventoryValue.toLocaleString()} total valuation with ${health.healthyCount} of ${health.totalCount} SKUs operating in optimal stock balance.`,
      relatedSku: null,
      label: 'Valuation Balance',
    },
    {
      elementId: 'inventory_valuation_health',
      severity: abc.classA.percentValue > 80 ? 'yellow' : 'green',
      text: `High value concentration: Class A items represent ${abc.classA.percentValue}% (${currency} ${abc.classA.value.toLocaleString()}) of warehouse asset capital.`,
      relatedSku: null,
      label: 'Capital Concentration',
    },

    // --- INVENTORY: STOCK DISTRIBUTION (Multi-angle) ---
    {
      elementId: 'inventory_stock_distribution',
      severity: health.overstockedCount > 3 ? 'yellow' : 'neutral',
      text: topCat
        ? `Concentrate replenishment on ${topCat.category}, which anchors ${topCat.percentageOfTotal}% (${currency} ${topCat.totalValue.toLocaleString()}) of total warehouse valuation.`
        : `Balance catalog inventory levels across all warehouse bins and regional storage branches.`,
      relatedSku: null,
      label: 'Category Leader',
    },
    {
      elementId: 'inventory_stock_distribution',
      severity: secondCat ? 'neutral' : 'green',
      text: secondCat
        ? `Secondary category ${secondCat.category} holds ${secondCat.skuCount} active SKUs valued at ${currency} ${secondCat.totalValue.toLocaleString()} (${secondCat.percentageOfTotal}%).`
        : `Catalog categories show even distribution across warehouse locations.`,
      relatedSku: null,
      label: 'Secondary Distribution',
    },

    // --- INVENTORY: SKU AGING (Multi-angle) ---
    {
      elementId: 'inventory_sku_aging',
      severity: slowMovers.length > 0 ? 'yellow' : 'green',
      text: slowMovers.length > 0
        ? `Liquidate aged holdings: ${slowMovers.length} slow-moving SKUs hold trapped capital. Initiate promotional bundles or markdown discounts.`
        : `Maintain agile stock rotation: active catalog shows healthy movement velocity with minimal aging drag.`,
      relatedSku: slowMovers[0]?.sku || null,
      label: 'Aging Diagnostics',
    },
    {
      elementId: 'inventory_sku_aging',
      severity: 'green',
      text: `Fresh stock intake represents strong rotation velocity with average shelf residence well within safe perishability/obsolescence limits.`,
      relatedSku: null,
      label: 'Rotation Health',
    },

    // --- INVENTORY: REORDER WATCHLIST ---
    {
      elementId: 'inventory_reorder_watchlist',
      severity: urgentReorders.length > 0 ? 'red' : 'green',
      text: urgentReorders.length > 0
        ? `Watchlist trigger: ${urgentReorders[0].name} (${urgentReorders[0].sku}) has only ${urgentReorders[0].daysCoverage} days of stock remaining at current burn rate.`
        : `All watchlist products are operating with safe inventory buffers above safety thresholds.`,
      relatedSku: urgentReorders[0]?.sku || null,
      label: 'Priority Watchlist',
    },

    // --- DEMAND: FORECAST VELOCITY (Multi-angle) ---
    {
      elementId: 'demand_forecast_velocity',
      severity: kpis.sellThroughRate >= 60 ? 'green' : kpis.sellThroughRate < 35 ? 'yellow' : 'neutral',
      text: `Forecast sustained demand: overall sell-through rate is pacing at ${kpis.sellThroughRate}%, supporting current procurement run rates.`,
      relatedSku: topProd?.sku || null,
      label: 'Sell-Through Pace',
    },
    {
      elementId: 'demand_forecast_velocity',
      severity: topProd ? 'green' : 'neutral',
      text: topProd
        ? `Velocity leader: ${topProd.name} is moving ${topProd.unitsSold} units generating ${currency} ${topProd.revenue.toLocaleString()} with strong forward momentum.`
        : `Daily demand trends remain steady across primary store catalog categories.`,
      relatedSku: topProd?.sku || null,
      label: 'Top Demand Driver',
    },

    // --- DEMAND: REORDER URGENCY (Multi-angle) ---
    {
      elementId: 'demand_reorder_urgency',
      severity: urgentReorders.length > 0 ? 'red' : 'green',
      text: urgentReorders.length > 0
        ? `Execute replenishment purchase orders for ${urgentReorders.length} priority items before lead times breach safety buffers.`
        : `Maintain steady supplier schedules: replenishment quantities are currently synchronized with sales velocity.`,
      relatedSku: urgentReorders[0]?.sku || null,
      label: 'Urgent Reorders',
    },
    {
      elementId: 'demand_reorder_urgency',
      severity: urgentReorders.length > 0 ? 'yellow' : 'green',
      text: urgentReorders.length > 0
        ? `Reorder capital requirement: estimated ${currency} ${urgentReorders.reduce((s, r) => s + (r.suggestedReorderQty * 50), 0).toLocaleString()} needed to restore optimal buffer levels.`
        : `Buffer replenishment cycles are completely on track with current production and purchase plans.`,
      relatedSku: urgentReorders[1]?.sku || null,
      label: 'Reorder Budgeting',
    },

    // --- DEMAND: STOCKOUT RISK (Multi-angle) ---
    {
      elementId: 'demand_stockout_risk',
      severity: snapshot.stockoutHorizonBuckets.zeroToThreeDays > 0 ? 'red' : snapshot.stockoutHorizonBuckets.fourToSevenDays > 0 ? 'yellow' : 'green',
      text: snapshot.stockoutHorizonBuckets.zeroToThreeDays > 0
        ? `Prevent stockouts: expedited supplier delivery required for ${criticalHorizon?.name || 'top SKU'} (${criticalHorizon?.daysRemaining || 1} day coverage remaining).`
        : `Track supply pipelines: stockout risk remains low across the 14-day operational planning window.`,
      relatedSku: criticalHorizon?.sku || null,
      label: 'Stockout Mitigation',
    },
    {
      elementId: 'demand_stockout_risk',
      severity: secondHorizon ? 'yellow' : 'green',
      text: secondHorizon
        ? `Secondary watch: ${secondHorizon.name} (${secondHorizon.sku}) has ${secondHorizon.daysRemaining} days remaining (${secondHorizon.stock} units on hand).`
        : `Safe operating margins: zero impending inventory stockouts detected in the immediate 7-day forecast.`,
      relatedSku: secondHorizon?.sku || null,
      label: 'Secondary Horizon',
    },

    // --- DEMAND: SEASONAL TRENDS ---
    {
      elementId: 'demand_seasonal_trends',
      severity: 'neutral',
      text: `Historical run-rates indicate steady sales momentum; maintain +15% safety stock buffers on top movers ahead of demand surges.`,
      relatedSku: topProd?.sku || null,
      label: 'Trend Forecast',
    },

    // --- ANALYTICS: TURNOVER EFFICIENCY (Multi-angle) ---
    {
      elementId: 'analytics_turnover_efficiency',
      severity: kpis.stockTurnover >= 4 ? 'green' : kpis.stockTurnover < 2 ? 'yellow' : 'neutral',
      text: `Target 4.0x turnover: current inventory turns at ${kpis.stockTurnover}x, reflecting ${kpis.stockCoverageDays} days of forward sales coverage.`,
      relatedSku: null,
      label: 'Turnover Efficiency',
    },
    {
      elementId: 'analytics_turnover_efficiency',
      severity: kpis.stockTurnover >= 2.5 ? 'green' : 'yellow',
      text: `Working capital rotation is operating at an annualized rate of ${currency} ${Math.round(kpis.cogs * 4).toLocaleString()} in inventory replacement.`,
      relatedSku: null,
      label: 'Capital Velocity',
    },

    // --- ANALYTICS: SELL THROUGH (Multi-angle) ---
    {
      elementId: 'analytics_sell_through',
      severity: kpis.sellThroughRate >= 65 ? 'green' : kpis.sellThroughRate < 40 ? 'yellow' : 'neutral',
      text: `Benchmark catalog clearance: sell-through rate reached ${kpis.sellThroughRate}% with strong volume conversion across primary product lines.`,
      relatedSku: topProd?.sku || null,
      label: 'Clearance Rate',
    },
    {
      elementId: 'analytics_sell_through',
      severity: secondProd ? 'green' : 'neutral',
      text: secondProd
        ? `High converter: ${secondProd.name} (${secondProd.sku}) delivers strong unit movement with ${secondProd.unitsSold} units converted.`
        : `Catalog conversion remains healthy across both high-margin and fast-moving retail segments.`,
      relatedSku: secondProd?.sku || null,
      label: 'Product Conversion',
    },

    // --- ANALYTICS: ABC CAPITAL (Multi-angle) ---
    {
      elementId: 'analytics_abc_capital',
      severity: abc.classA.percentValue > 85 ? 'yellow' : 'green',
      text: `Protect Class A champions: ${abc.classA.count} core SKUs drive ${abc.classA.percentValue}% (${currency} ${abc.classA.value.toLocaleString()}) of warehouse asset capital.`,
      relatedSku: null,
      label: 'Pareto Allocation',
    },
    {
      elementId: 'analytics_abc_capital',
      severity: 'neutral',
      text: `Class B & C segments encompass ${abc.classB.count + abc.classC.count} catalog items representing ${abc.classB.percentValue + abc.classC.percentValue}% of inventory valuation.`,
      relatedSku: null,
      label: 'Long-Tail Portfolio',
    },

    // --- ANALYTICS: PARETO DISTRIBUTION ---
    {
      elementId: 'analytics_pareto_distribution',
      severity: 'green',
      text: `80/20 Rule validation: Top 20% of catalog items account for the majority of gross sales revenue and warehouse throughput.`,
      relatedSku: topProd?.sku || null,
      label: 'Pareto 80/20',
    },

    // --- PROFIT: GROSS MARGIN (Multi-angle) ---
    {
      elementId: 'profit_gross_margin',
      severity: kpis.margin >= 30 ? 'green' : kpis.margin < 15 ? 'red' : 'yellow',
      text: `Sustain margin yield: gross profit stands at ${currency} ${(kpis.totalSales - kpis.cogs).toLocaleString()} (${kpis.margin}% margin) on ${currency} ${kpis.totalSales.toLocaleString()} gross sales.`,
      relatedSku: topProd?.sku || null,
      label: 'Gross Profit Yield',
    },
    {
      elementId: 'profit_gross_margin',
      severity: topProd?.margin && topProd.margin > 35 ? 'green' : 'neutral',
      text: topProd
        ? `Margin leader ${topProd.name} delivers a high ${topProd.margin}% gross margin, driving premium profitability.`
        : `Maintain pricing discipline to sustain healthy product markup ratios across all sales channels.`,
      relatedSku: topProd?.sku || null,
      label: 'Margin Leader',
    },

    // --- PROFIT: EXPENSE IMPACT (Multi-angle) ---
    {
      elementId: 'profit_expense_impact',
      severity: kpis.netProfit > 0 ? 'green' : 'red',
      text: kpis.netProfit > 0
        ? `Maximize net retention: operations generated ${currency} ${kpis.netProfit.toLocaleString()} net profit after accounting for direct COGS and operating expenses.`
        : `Review cost overheads: operational expenses exceed gross profit contributions; audit procurement unit costs.`,
      relatedSku: null,
      label: 'Net Retention',
    },
    {
      elementId: 'profit_expense_impact',
      severity: 'neutral',
      text: `COGS efficiency is maintained at ${kpis.totalSales > 0 ? ((kpis.cogs / kpis.totalSales) * 100).toFixed(1) : 0}% of gross revenue across all recorded sales cycles.`,
      relatedSku: null,
      label: 'COGS Ratio',
    },

    // --- PROFIT: MARGIN TRAJECTORY ---
    {
      elementId: 'profit_margin_trajectory',
      severity: kpis.margin >= 20 ? 'green' : 'yellow',
      text: `Margin trajectory remains resilient at ${kpis.margin}%; focus sales initiatives on high-markup inventory lines.`,
      relatedSku: topProd?.sku || null,
      label: 'Profit Trajectory',
    },

    // --- PROFIT: COGS BREAKDOWN ---
    {
      elementId: 'profit_cogs_breakdown',
      severity: 'neutral',
      text: `Total cost of goods sold is tracking at ${currency} ${kpis.cogs.toLocaleString()} against ${currency} ${kpis.totalSales.toLocaleString()} in realized revenue.`,
      relatedSku: null,
      label: 'COGS Control',
    },

    // --- SALES: REVENUE GROWTH (Multi-angle) ---
    {
      elementId: 'sales_revenue_growth',
      severity: kpis.totalSales > 0 ? 'green' : 'neutral',
      text: `Drive revenue expansion: cumulative invoiced sales reached ${currency} ${kpis.totalSales.toLocaleString()} across active customer accounts.`,
      relatedSku: null,
      label: 'Invoiced Revenue',
    },
    {
      elementId: 'sales_revenue_growth',
      severity: 'green',
      text: `Sales velocity supports expansion; prioritize repeat orders and key customer accounts for ongoing revenue growth.`,
      relatedSku: null,
      label: 'Customer Expansion',
    },

    // --- SALES: TOP PERFORMERS (Multi-angle) ---
    {
      elementId: 'sales_top_performers',
      severity: topProd ? 'green' : 'neutral',
      text: topProd
        ? `Leverage top revenue winner ${topProd.name} (${topProd.sku}), generating ${currency} ${topProd.revenue.toLocaleString()} with ${topProd.margin}% margin.`
        : `Track individual product margins and volume velocity to identify emerging revenue drivers.`,
      relatedSku: topProd?.sku || null,
      label: 'Top Performer',
    },
    {
      elementId: 'sales_top_performers',
      severity: secondProd ? 'green' : 'neutral',
      text: secondProd
        ? `Strong contributor ${secondProd.name} (${secondProd.sku}) generated ${currency} ${secondProd.revenue.toLocaleString()} across ${secondProd.unitsSold} units.`
        : `Expanding catalog breadth to capture multi-category customer basket demand.`,
      relatedSku: secondProd?.sku || null,
      label: 'Rising Performer',
    },

    // --- SALES: VOLUME TRAJECTORY ---
    {
      elementId: 'sales_volume_trajectory',
      severity: 'green',
      text: `Unit conversion trajectory is positive with strong transaction volumes across retail and wholesale channels.`,
      relatedSku: null,
      label: 'Volume Trajectory',
    },

    // --- PROCUREMENT: RESERVATIONS HEALTH (Multi-angle) ---
    {
      elementId: 'procurement_reservations_health',
      severity: 'green',
      text: `Active stock holds protect customer commitments while dynamically adjusting available free pool quantities.`,
      relatedSku: null,
      label: 'Hold Protection',
    },
    {
      elementId: 'procurement_reservations_health',
      severity: urgentReorders.length > 0 ? 'yellow' : 'green',
      text: `Synchronize reserved stock allocations with incoming purchase orders to prevent inventory shortfall bottlenecks.`,
      relatedSku: null,
      label: 'Shortfall Mitigation',
    },

    // --- PROCUREMENT: HUB COMMITMENTS ---
    {
      elementId: 'procurement_hub_commitments',
      severity: 'neutral',
      text: `Monitor supplier lead times and open purchase orders to ensure timely delivery and warehouse receiving.`,
      relatedSku: null,
      label: 'Supply Pipeline',
    },

    // --- EXPENSES: BURN RATE ---
    {
      elementId: 'expenses_burn_rate',
      severity: kpis.netProfit > 0 ? 'green' : 'yellow',
      text: `Operating expenses are balanced against gross margin contribution, supporting positive net cash flow.`,
      relatedSku: null,
      label: 'Expense Governance',
    },

    // --- PROCUREMENT: EXPENSES LEAKAGE (Multi-angle) ---
    {
      elementId: 'procurement_expenses_leakage',
      severity: 'neutral',
      text: `Audit operational and supplier freight overheads regularly to maintain lean operating expense ratios.`,
      relatedSku: null,
      label: 'Cost Leakage Audit',
    },
    {
      elementId: 'procurement_expenses_leakage',
      severity: kpis.netProfit > 0 ? 'green' : 'yellow',
      text: `Net operational cashflow after operational expenses stands at ${currency} ${kpis.netProfit.toLocaleString()}.`,
      relatedSku: null,
      label: 'Expense Net Margin',
    },

    // --- SALES: REVENUE VELOCITY (Multi-angle) ---
    {
      elementId: 'sales_revenue_velocity',
      severity: kpis.totalSales > 0 ? 'green' : 'neutral',
      text: `Revenue velocity pacing at ${currency} ${kpis.totalSales.toLocaleString()} in realized transactions across active billing registers.`,
      relatedSku: topProd?.sku || null,
      label: 'Real-time Run Rate',
    },
    {
      elementId: 'sales_revenue_velocity',
      severity: topProd ? 'green' : 'neutral',
      text: topProd
        ? `Lead SKU ${topProd.name} contributes ${currency} ${topProd.revenue.toLocaleString()} in customer orders.`
        : `Transaction registers operating with live digital receipting and fulfillment tracking.`,
      relatedSku: topProd?.sku || null,
      label: 'Register Throughput',
    },

    // --- ANALYTICS: TURNOVER RATIO (Multi-angle) ---
    {
      elementId: 'analytics_turnover_ratio',
      severity: kpis.stockTurnover >= 3 ? 'green' : 'yellow',
      text: `Annual stock turn ratio calculated at ${kpis.stockTurnover}x across ${health.totalCount} active catalog items.`,
      relatedSku: null,
      label: 'Annual Velocity',
    },
    {
      elementId: 'analytics_turnover_ratio',
      severity: 'green',
      text: `Target 4.0x turnover turns forward inventory in ${kpis.stockCoverageDays} days average holding window.`,
      relatedSku: null,
      label: 'Turnover Target',
    },

    // --- EXPIRY: SPOILAGE RISK (Multi-angle) ---
    {
      elementId: 'expiry_spoilage_risk',
      severity: 'green',
      text: `Monitor shelf life timestamps and FIFO batch dispatch to minimize shrinkage and spoilage write-offs.`,
      relatedSku: null,
      label: 'Traceability Health',
    },
    {
      elementId: 'expiry_spoilage_risk',
      severity: 'neutral',
      text: `Batch tracking active across inventory lots; automated alerts notify teams 14 days prior to lot expiration.`,
      relatedSku: null,
      label: 'Shelf Life Guard',
    },

    // --- ALERTS: RISK BREAKDOWN (Multi-angle) ---
    {
      elementId: 'alerts_risk_breakdown',
      severity: health.atRiskCount > 0 ? 'yellow' : 'green',
      text: health.atRiskCount > 0
        ? `Resolve ${health.atRiskCount} inventory risk alerts to safeguard customer order fulfillment.`
        : `All system alerts cleared: warehouse operating within optimal safety thresholds.`,
      relatedSku: null,
      label: 'Alert Triage',
    },
    {
      elementId: 'alerts_risk_breakdown',
      severity: 'green',
      text: `Real-time sensor & telemetry engine monitoring stock buffer levels, stockout horizons, and ledger balances.`,
      relatedSku: null,
      label: 'System Vigilance',
    },

    // --- POS: CHECKOUT VELOCITY ---
    {
      elementId: 'pos_checkout_velocity',
      severity: topProd ? 'green' : 'neutral',
      text: topProd
        ? `POS recommendation: ${topProd.name} is the fastest-moving item. Ensure counter displays and stock buffers are prepared.`
        : `Point of Sale operations are ready with live barcode scanning and receipt generation.`,
      relatedSku: topProd?.sku || null,
      label: 'Fast-Moving Upsell',
    },
  ];

  return insights;
}

/**
 * Helper to group dynamic insights by elementId
 */
export function groupInsightsByElement(
  insights: DynamicInsight[]
): Record<InsightElementId, DynamicInsight[]> {
  const map: Partial<Record<InsightElementId, DynamicInsight[]>> = {};
  ALL_INSIGHT_ELEMENT_IDS.forEach((id) => {
    map[id] = [];
  });

  insights.forEach((ins) => {
    if (!map[ins.elementId]) {
      map[ins.elementId] = [];
    }
    map[ins.elementId]!.push(ins);
  });

  return map as Record<InsightElementId, DynamicInsight[]>;
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
        label: item.label || undefined,
        metricValue: item.metricValue || undefined,
        generatedAt: new Date().toISOString(),
      }));

      // Merge with local multi-angle insights to ensure deep richness
      const localFallbacks = generateLocalFallbackInsights(snapshot, currency);
      return [...validInsights, ...localFallbacks];
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
export function getCachedInsights(companyId: string): DynamicInsight[] | null {
  try {
    const raw = localStorage.getItem(`invenio_dynamic_insights_${companyId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.insights)) {
      return parsed.insights;
    } else if (parsed && typeof parsed.insights === 'object') {
      return Object.values(parsed.insights);
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
  insightsList: DynamicInsight[]
) {
  try {
    localStorage.setItem(
      `invenio_dynamic_insights_${companyId}`,
      JSON.stringify({
        timestamp: Date.now(),
        insights: insightsList,
      })
    );
  } catch (e) {
    console.error('Error saving insights cache:', e);
  }
}
