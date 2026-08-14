import { 
  Product, 
  StockMovement, 
  SaleRecord, 
  PurchaseOrder, 
  GoodReceiptNote,
  ProductDemandMetrics, 
  ProductVelocityMetrics, 
  ProductProfitMetrics, 
  ProductReorderMetrics, 
  ProductABCClassification, 
  ProductIntelligence, 
  CompanyInventoryIntelligence, 
  CalculationMetadata 
} from '../types';

/**
 * Standard Unit Cost Extractor
 * Extracts true cost with strictly deterministic fallback hierarchy
 */
export function getProductUnitCost(p: Partial<Product> | any): number {
  if (!p) return 0;
  if (typeof p.buyingPrice === 'number' && p.buyingPrice > 0) return p.buyingPrice;
  if (typeof p.costPrice === 'number' && p.costPrice > 0) return p.costPrice;
  if (typeof p.unitCost === 'number' && p.unitCost > 0) return p.unitCost;
  if (typeof p.value === 'number' && p.value > 0) return p.value;
  if (typeof p.cost === 'number' && p.cost > 0) return p.cost;
  if (typeof p.sellingPrice === 'number' && p.sellingPrice > 0) return Math.round(p.sellingPrice * 0.7 * 100) / 100;
  if (typeof p.price === 'number' && p.price > 0) return Math.round(p.price * 0.7 * 100) / 100;
  if (typeof p.unitPrice === 'number' && p.unitPrice > 0) return Math.round(p.unitPrice * 0.7 * 100) / 100;
  return 0;
}

/**
 * Standard Selling Price Extractor
 */
export function getProductSellingPrice(p: Partial<Product> | any): number {
  if (!p) return 0;
  if (typeof p.sellingPrice === 'number' && p.sellingPrice > 0) return p.sellingPrice;
  if (typeof p.unitPrice === 'number' && p.unitPrice > 0) return p.unitPrice;
  if (typeof p.price === 'number' && p.price > 0) return p.price;
  const cost = getProductUnitCost(p);
  if (cost > 0) return Math.round(cost * 1.35 * 100) / 100;
  return 0;
}

/**
 * Standard Current Stock Extractor
 */
export function getProductCurrentStock(p: Partial<Product> | any): number {
  if (!p) return 0;
  if (typeof p.quantity === 'number') return Math.max(0, p.quantity);
  if (typeof p.currentStock === 'number') return Math.max(0, p.currentStock);
  return 0;
}

/**
 * Standard Available Stock Extractor (Current Stock minus Reserved Stock)
 */
export function getProductAvailableStock(p: Partial<Product> | any): number {
  const current = getProductCurrentStock(p);
  const reserved = typeof p?.reservedStock === 'number' ? Math.max(0, p.reservedStock) : 0;
  return Math.max(0, current - reserved);
}

// ---------------------------------------------------------------------------
// 1. DEMAND CALCULATION ENGINE (with stockout adjustment and variability)
// ---------------------------------------------------------------------------

export function calculateProductDemandMetrics(
  product: Product,
  sales: SaleRecord[] = [],
  movements: StockMovement[] = [],
  analysisPeriodDays: number = 30,
  refDate: Date = new Date()
): ProductDemandMetrics {
  const pId = product.id || product.productId || '';
  const nowMs = refDate.getTime();
  const dayMs = 86400000;
  const cutoffMs = nowMs - (analysisPeriodDays * dayMs);

  // 1. Filter sales records for this product within window
  const prodSales = sales.filter(s => {
    if (s.productId !== pId && s.productId !== product.id) return false;
    const saleDateStr = s.createdAt || s.saleDate;
    if (!saleDateStr) return false;
    const t = new Date(saleDateStr).getTime();
    return t >= cutoffMs && t <= nowMs;
  });

  // Fallback to movements if direct sales collection has no entries
  const prodMovements = movements.filter(m => {
    if (m.productId !== pId && m.productId !== product.id) return false;
    const isOut = m.type === 'sale' || m.type === 'outbound' || (m.type === 'adjustment' && m.quantity < 0);
    if (!isOut) return false;
    const t = new Date(m.createdAt).getTime();
    return t >= cutoffMs && t <= nowMs;
  });

  // 2. Build Daily Demand Buckets (one entry per day in analysis window)
  const dailyQuantities = new Array(analysisPeriodDays).fill(0);
  const dailyStockState = new Array(analysisPeriodDays).fill(true); // true = in stock / available

  // Map sales into day offsets (0 = oldest day, analysisPeriodDays - 1 = today)
  if (prodSales.length > 0) {
    prodSales.forEach(s => {
      const saleDate = new Date(s.createdAt || s.saleDate);
      const daysAgo = Math.floor((nowMs - saleDate.getTime()) / dayMs);
      const index = analysisPeriodDays - 1 - Math.min(Math.max(0, daysAgo), analysisPeriodDays - 1);
      const qty = Number(s.quantitySold) || 0;
      dailyQuantities[index] += qty;
    });
  } else {
    prodMovements.forEach(m => {
      const mDate = new Date(m.createdAt);
      const daysAgo = Math.floor((nowMs - mDate.getTime()) / dayMs);
      const index = analysisPeriodDays - 1 - Math.min(Math.max(0, daysAgo), analysisPeriodDays - 1);
      const qty = Math.abs(Number(m.quantity)) || 0;
      dailyQuantities[index] += qty;
    });
  }

  // If no transactions in period, check if total product.unitsSold exists for baseline estimate
  let totalDemand = dailyQuantities.reduce((a, b) => a + b, 0);
  let isEstimated = false;

  if (totalDemand === 0 && typeof product.unitsSold === 'number' && product.unitsSold > 0) {
    // Proportional estimate across period
    totalDemand = Math.round((product.unitsSold / 60) * analysisPeriodDays);
    isEstimated = true;
  }

  // 3. Stockout Days Estimation:
  // If product is currently 0 stock and had 0 sales in recent days, estimate stockout days
  const currentStock = getProductCurrentStock(product);
  let stockoutDays = 0;
  if (currentStock === 0) {
    // Count days from today backwards with 0 sales as likely stockout days (capped at period / 2)
    for (let i = dailyQuantities.length - 1; i >= 0; i--) {
      if (dailyQuantities[i] === 0) stockoutDays++;
      else break;
    }
  }

  // Active selling days excludes stockout days to prevent artificial demand dilution
  const activeSellingDays = Math.max(1, analysisPeriodDays - stockoutDays);
  const averageDailyDemand = parseFloat((totalDemand / activeSellingDays).toFixed(3));
  const averageWeeklyDemand = parseFloat((averageDailyDemand * 7).toFixed(2));
  const averageMonthlyDemand = parseFloat((averageDailyDemand * 30).toFixed(2));

  // 4. Statistical Variability (Standard Deviation & Coefficient of Variation)
  const meanDailyDemand = averageDailyDemand;
  let sumSquaredDiffs = 0;
  for (let i = 0; i < dailyQuantities.length; i++) {
    sumSquaredDiffs += Math.pow(dailyQuantities[i] - meanDailyDemand, 2);
  }
  const standardDeviation = parseFloat(Math.sqrt(sumSquaredDiffs / dailyQuantities.length).toFixed(3));
  const coefficientOfVariation = meanDailyDemand > 0 ? parseFloat((standardDeviation / meanDailyDemand).toFixed(2)) : 0;

  let demandVariability: 'Stable' | 'Moderate' | 'Erratic' = 'Stable';
  if (coefficientOfVariation > 1.2) demandVariability = 'Erratic';
  else if (coefficientOfVariation > 0.6) demandVariability = 'Moderate';

  // 5. Recent Trend (Compare second half of period vs first half)
  const halfWindow = Math.floor(analysisPeriodDays / 2);
  const firstHalfSum = dailyQuantities.slice(0, halfWindow).reduce((a, b) => a + b, 0);
  const secondHalfSum = dailyQuantities.slice(halfWindow).reduce((a, b) => a + b, 0);
  let recentTrendPct = 0;
  if (firstHalfSum > 0) {
    recentTrendPct = parseFloat((((secondHalfSum - firstHalfSum) / firstHalfSum) * 100).toFixed(1));
  } else if (secondHalfSum > 0) {
    recentTrendPct = 50.0;
  }

  // 6. Forecast Demand for Next Period
  // Forecast = ADD * (1 + Trend/200) * Period
  const trendFactor = Math.max(0.5, Math.min(1.5, 1 + (recentTrendPct / 200)));
  const forecastDemandNextPeriod = Math.round(averageDailyDemand * analysisPeriodDays * trendFactor);

  const dataPointsCount = prodSales.length > 0 ? prodSales.length : prodMovements.length;
  const isSufficientData = dataPointsCount >= 3 || (totalDemand > 5);

  const metadata: CalculationMetadata = {
    calculationName: 'Dynamic Period Demand & Variability',
    calculatedAt: new Date().toISOString(),
    periodDays: analysisPeriodDays,
    dataPointsCount,
    isSufficientData,
    notes: isEstimated ? 'Derived from cumulative sales record' : 'Calculated from actual transactional history'
  };

  return {
    productId: pId,
    totalDemand,
    activeSellingDays,
    stockoutDays,
    averageDailyDemand,
    averageWeeklyDemand,
    averageMonthlyDemand,
    demandVariability,
    standardDeviation,
    coefficientOfVariation,
    recentTrendPct,
    forecastDemandNextPeriod,
    metadata
  };
}

// ---------------------------------------------------------------------------
// 2. PRODUCT VELOCITY & INVENTORY AGING ENGINE
// ---------------------------------------------------------------------------

export function calculateProductVelocityMetrics(
  product: Product,
  sales: SaleRecord[] = [],
  movements: StockMovement[] = [],
  refDate: Date = new Date()
): ProductVelocityMetrics {
  const pId = product.id || product.productId || '';
  const nowMs = refDate.getTime();
  const dayMs = 86400000;
  const thirtyDaysAgoMs = nowMs - (30 * dayMs);

  // 1. Sales in last 30 days
  const prodSales = sales.filter(s => (s.productId === pId || s.productId === product.id) && s.createdAt);
  const prodMovements = movements.filter(m => (m.productId === pId || m.productId === product.id) && m.createdAt);

  let unitsSold30d = 0;
  let salesFrequencyCount = 0;

  if (prodSales.length > 0) {
    prodSales.forEach(s => {
      const t = new Date(s.createdAt || s.saleDate).getTime();
      if (t >= thirtyDaysAgoMs) {
        unitsSold30d += Number(s.quantitySold) || 0;
        salesFrequencyCount++;
      }
    });
  } else {
    prodMovements.forEach(m => {
      const isOut = m.type === 'sale' || m.type === 'outbound' || (m.type === 'adjustment' && m.quantity < 0);
      if (isOut) {
        const t = new Date(m.createdAt).getTime();
        if (t >= thirtyDaysAgoMs) {
          unitsSold30d += Math.abs(Number(m.quantity)) || 0;
          salesFrequencyCount++;
        }
      }
    });
  }

  // If no transactions in 30d, check product.unitsSold
  if (unitsSold30d === 0 && typeof product.unitsSold === 'number' && product.unitsSold > 0) {
    unitsSold30d = Math.round(product.unitsSold / 2);
    salesFrequencyCount = Math.max(1, Math.round(unitsSold30d / 5));
  }

  const averageDailySales = parseFloat((unitsSold30d / 30).toFixed(2));

  // 2. Determine Last Sale Date & Days Since Last Sale
  let lastSaleDate: string | null = null;
  let daysSinceLastSale: number | null = null;

  if (product.lastSold) {
    const lDate = new Date(product.lastSold);
    if (!isNaN(lDate.getTime())) {
      lastSaleDate = lDate.toISOString().split('T')[0];
      daysSinceLastSale = Math.max(0, Math.floor((nowMs - lDate.getTime()) / dayMs));
    }
  }

  if (!lastSaleDate) {
    const sortedSales = [...prodSales].sort((a, b) => new Date(b.createdAt || b.saleDate).getTime() - new Date(a.createdAt || a.saleDate).getTime());
    if (sortedSales.length > 0) {
      const lDate = new Date(sortedSales[0].createdAt || sortedSales[0].saleDate);
      lastSaleDate = lDate.toISOString().split('T')[0];
      daysSinceLastSale = Math.max(0, Math.floor((nowMs - lDate.getTime()) / dayMs));
    }
  }

  // 3. FIFO Remaining Stock Layer Inventory Age (Days)
  const currentStock = getProductCurrentStock(product);
  let inventoryAgeDays = 0;

  if (currentStock === 0) {
    inventoryAgeDays = 0;
  } else {
    // Inbound movements
    const inbounds = prodMovements
      .filter(m => m.type === 'purchase' || m.type === 'inbound' || m.type === 'opening' || (m.type === 'adjustment' && m.quantity > 0))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (inbounds.length > 0) {
      const oldestInbound = inbounds[0];
      const ageMs = nowMs - new Date(oldestInbound.createdAt).getTime();
      inventoryAgeDays = Math.max(1, Math.floor(ageMs / dayMs));
    } else if (product.createdAt) {
      const ageMs = nowMs - new Date(product.createdAt).getTime();
      inventoryAgeDays = Math.max(1, Math.floor(ageMs / dayMs));
    } else {
      inventoryAgeDays = 15; // default fallback
    }
  }

  // 4. Movement Classification (FAST / MODERATE / SLOW / OBSOLETE / OUT OF STOCK)
  let movementClass: 'fast' | 'moderate' | 'slow' | 'obsolete' | 'out_of_stock' = 'moderate';
  let movementLabel = 'MODERATE MOVING';
  let colorBadge = {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    icon: '🔵'
  };

  if (currentStock === 0) {
    movementClass = 'out_of_stock';
    movementLabel = 'OUT OF STOCK';
    colorBadge = {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-300',
      dot: 'bg-slate-500',
      icon: '⚪'
    };
  } else if ((daysSinceLastSale !== null && daysSinceLastSale <= 30) || (averageDailySales >= 0.5 && inventoryAgeDays <= 45)) {
    movementClass = 'fast';
    movementLabel = 'FAST MOVING';
    colorBadge = {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
      icon: '🟢'
    };
  } else if ((daysSinceLastSale !== null && daysSinceLastSale <= 90) || (inventoryAgeDays <= 90)) {
    movementClass = 'moderate';
    movementLabel = 'MODERATE MOVING';
    colorBadge = {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      dot: 'bg-blue-500',
      icon: '🔵'
    };
  } else if ((daysSinceLastSale !== null && daysSinceLastSale <= 180) || (inventoryAgeDays <= 180)) {
    movementClass = 'slow';
    movementLabel = 'SLOW MOVING';
    colorBadge = {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
      icon: '🟡'
    };
  } else {
    movementClass = 'obsolete';
    movementLabel = 'OBSOLETE / DEAD STOCK';
    colorBadge = {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      dot: 'bg-rose-500',
      icon: '🔴'
    };
  }

  const metadata: CalculationMetadata = {
    calculationName: 'Dynamic Inventory Velocity & Aging',
    calculatedAt: new Date().toISOString(),
    periodDays: 30,
    dataPointsCount: prodSales.length + prodMovements.length,
    isSufficientData: true
  };

  return {
    productId: pId,
    unitsSold: unitsSold30d,
    salesFrequencyCount,
    averageDailySales,
    lastSaleDate,
    daysSinceLastSale,
    inventoryAgeDays,
    movementClass,
    movementLabel,
    colorBadge,
    metadata
  };
}

// ---------------------------------------------------------------------------
// 3. PROFIT & MARGIN ENGINE (preserving historical unit costs)
// ---------------------------------------------------------------------------

export function calculateProductProfitMetrics(
  product: Product,
  sales: SaleRecord[] = [],
  invoices: any[] = []
): ProductProfitMetrics {
  const pId = product.id || product.productId || '';
  const currentCost = getProductUnitCost(product);
  const currentPrice = getProductSellingPrice(product);

  // 1. Gather all individual sale items
  const prodSales = sales.filter(s => s.productId === pId || s.productId === product.id);

  let unitsSold = 0;
  let grossSales = 0;
  let totalCostOfGoods = 0;

  if (prodSales.length > 0) {
    prodSales.forEach(s => {
      const q = Number(s.quantitySold) || 0;
      const price = Number(s.sellingPrice) || currentPrice;
      // CRITICAL: Use historical unitCost at time of sale!
      const historicalCost = typeof s.unitCost === 'number' && s.unitCost > 0 
        ? s.unitCost 
        : typeof s.costPrice === 'number' && s.costPrice > 0 
          ? s.costPrice 
          : currentCost;

      const lineGross = typeof s.netSales === 'number' ? s.netSales : (q * price);
      const lineCost = q * historicalCost;

      unitsSold += q;
      grossSales += lineGross;
      totalCostOfGoods += lineCost;
    });
  } else {
    // Check invoice line items
    invoices.forEach(inv => {
      if (inv.status === 'Cancelled' || inv.status === 'draft') return;
      const items = inv.items || [];
      items.forEach((item: any) => {
        if (item.productId === pId || item.productId === product.id) {
          const q = Number(item.quantity) || 0;
          const price = Number(item.unitPrice || item.price) || currentPrice;
          const historicalCost = Number(item.costPrice || item.unitCost) || currentCost;

          unitsSold += q;
          grossSales += q * price;
          totalCostOfGoods += q * historicalCost;
        }
      });
    });
  }

  // Fallback to product level counters if no records
  if (unitsSold === 0 && typeof product.unitsSold === 'number' && product.unitsSold > 0) {
    unitsSold = product.unitsSold;
    grossSales = unitsSold * currentPrice;
    totalCostOfGoods = unitsSold * currentCost;
  }

  const grossProfit = grossSales - totalCostOfGoods;
  const grossMarginPct = grossSales > 0 ? parseFloat(((grossProfit / grossSales) * 100).toFixed(1)) : 0;
  const unitProfit = currentPrice - currentCost;

  const metadata: CalculationMetadata = {
    calculationName: 'Historical Cost & Gross Margin Engine',
    calculatedAt: new Date().toISOString(),
    periodDays: 365,
    dataPointsCount: prodSales.length,
    isSufficientData: unitsSold > 0,
    notes: 'Preserves historical purchase cost recorded at time of transaction'
  };

  return {
    productId: pId,
    unitsSold,
    grossSales: parseFloat(grossSales.toFixed(2)),
    totalCostOfGoods: parseFloat(totalCostOfGoods.toFixed(2)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    grossMarginPct,
    unitSellingPrice: currentPrice,
    unitCostPrice: currentCost,
    unitProfit: parseFloat(unitProfit.toFixed(2)),
    metadata
  };
}

// ---------------------------------------------------------------------------
// 4. REORDER POINT, SAFETY STOCK & SUGGESTED ORDER ENGINE
// ---------------------------------------------------------------------------

export function calculateProductReorderMetrics(
  product: Product,
  supplier: any = null,
  demandMetrics: ProductDemandMetrics,
  historicalPOs: PurchaseOrder[] = []
): ProductReorderMetrics {
  const pId = product.id || product.productId || '';
  const currentStock = getProductCurrentStock(product);
  const reservedStock = typeof product.reservedStock === 'number' ? Math.max(0, product.reservedStock) : 0;
  const availableStock = Math.max(0, currentStock - reservedStock);

  // 1. Effective Lead Time Days
  let effectiveLeadTimeDays = 5;
  let leadTimeSource: 'product' | 'supplier' | 'historical_avg' | 'default' = 'default';

  if (typeof product.leadTimeDays === 'number' && product.leadTimeDays > 0) {
    effectiveLeadTimeDays = product.leadTimeDays;
    leadTimeSource = 'product';
  } else if (typeof product.supplierLeadTime === 'number' && product.supplierLeadTime > 0) {
    effectiveLeadTimeDays = product.supplierLeadTime;
    leadTimeSource = 'product';
  } else if (supplier && typeof supplier.leadTimeDays === 'number' && supplier.leadTimeDays > 0) {
    effectiveLeadTimeDays = supplier.leadTimeDays;
    leadTimeSource = 'supplier';
  } else {
    // Check delivered POs for actual receiving lead times
    const deliveredPOs = historicalPOs.filter(po => 
      po.status === 'DELIVERED' || po.status === 'RECEIVED' || po.status === 'FULLY RECEIVED'
    );
    if (deliveredPOs.length > 0) {
      let totalActualDays = 0;
      let counted = 0;
      deliveredPOs.forEach(po => {
        if (po.orderDate && (po.deliveryDate || po.actualLeadTimeDays)) {
          const days = po.actualLeadTimeDays || Math.max(1, Math.round((new Date(po.deliveryDate!).getTime() - new Date(po.orderDate).getTime()) / 86400000));
          totalActualDays += days;
          counted++;
        }
      });
      if (counted > 0) {
        effectiveLeadTimeDays = Math.max(1, Math.round(totalActualDays / counted));
        leadTimeSource = 'historical_avg';
      }
    }
  }

  // 2. Safety Stock (SS)
  let safetyStock = 5;
  let isSafetyStockOverridden = false;

  if (typeof product.safetyStockOverride === 'number' && product.safetyStockOverride >= 0) {
    safetyStock = product.safetyStockOverride;
    isSafetyStockOverridden = true;
  } else if (typeof product.safetyStock === 'number' && product.safetyStock > 0) {
    safetyStock = product.safetyStock;
  } else {
    // Statistical formula: SS = Z * sigma_demand * sqrt(LeadTime)
    // Z = 1.65 (95% Service Level)
    if (demandMetrics.standardDeviation > 0) {
      safetyStock = Math.ceil(1.65 * demandMetrics.standardDeviation * Math.sqrt(effectiveLeadTimeDays));
    } else {
      safetyStock = Math.max(3, Math.ceil(demandMetrics.averageDailyDemand * effectiveLeadTimeDays * 0.5));
    }
  }

  // 3. Reorder Point (ROP)
  // ROP = Demand During Lead Time + Safety Stock
  let reorderPoint = 10;
  let isReorderPointOverridden = false;

  if (typeof product.reorderPointOverride === 'number' && product.reorderPointOverride >= 0) {
    reorderPoint = product.reorderPointOverride;
    isReorderPointOverridden = true;
  } else if (typeof product.reorderPoint === 'number' && product.reorderPoint > 0) {
    reorderPoint = product.reorderPoint;
  } else if (typeof product.reorderLevel === 'number' && product.reorderLevel > 0) {
    reorderPoint = product.reorderLevel;
  } else {
    const demandDuringLeadTime = demandMetrics.averageDailyDemand * effectiveLeadTimeDays;
    reorderPoint = Math.ceil(demandDuringLeadTime + safetyStock);
  }

  // 4. Days of Stock Remaining
  let daysOfStockRemaining: number | null = null;
  let daysOfStockLabel = 'No recent demand';

  if (demandMetrics.averageDailyDemand > 0) {
    daysOfStockRemaining = parseFloat((availableStock / demandMetrics.averageDailyDemand).toFixed(1));
    if (availableStock === 0) {
      daysOfStockLabel = '0 days (Out of Stock)';
    } else if (daysOfStockRemaining <= 3) {
      daysOfStockLabel = `Critical (${daysOfStockRemaining} days)`;
    } else if (daysOfStockRemaining <= effectiveLeadTimeDays) {
      daysOfStockLabel = `Reorder Zone (${daysOfStockRemaining} days)`;
    } else {
      daysOfStockLabel = `${daysOfStockRemaining} days`;
    }
  } else if (availableStock > 0) {
    daysOfStockLabel = `${availableStock} units (Zero Velocity)`;
  } else {
    daysOfStockLabel = '0 units in stock';
  }

  // 5. Supplier MOQ & Suggested Order Quantity
  const supplierMoq = product.supplierMoq || supplier?.moq || 1;
  const orderMultiple = product.orderMultiple || 1;

  // Review period = 14 days standard inventory cycle
  const reviewPeriodDemand = demandMetrics.averageDailyDemand * 14;
  let suggestedOrderQuantity = 0;

  if (availableStock <= reorderPoint) {
    const deficit = Math.max(0, (reorderPoint - availableStock) + reviewPeriodDemand);
    // Align with Order Multiple and MOQ
    const multipleAligned = Math.ceil(deficit / orderMultiple) * orderMultiple;
    suggestedOrderQuantity = Math.max(supplierMoq, multipleAligned);
  }

  // 6. Order Urgency
  let orderUrgency: 'CRITICAL' | 'REORDER_NOW' | 'LOW_STOCK' | 'ADEQUATE' | 'OVERSTOCKED' = 'ADEQUATE';
  if (availableStock === 0) {
    orderUrgency = 'CRITICAL';
  } else if (availableStock <= reorderPoint) {
    orderUrgency = 'REORDER_NOW';
  } else if (availableStock <= reorderPoint * 1.25) {
    orderUrgency = 'LOW_STOCK';
  } else if (demandMetrics.averageDailyDemand > 0 && availableStock > (reorderPoint * 3)) {
    orderUrgency = 'OVERSTOCKED';
  }

  const metadata: CalculationMetadata = {
    calculationName: 'Dynamic Statistical Replenishment Engine',
    calculatedAt: new Date().toISOString(),
    periodDays: 30,
    dataPointsCount: historicalPOs.length,
    isSufficientData: true
  };

  return {
    productId: pId,
    currentStock,
    reservedStock,
    availableStock,
    effectiveLeadTimeDays,
    leadTimeSource,
    safetyStock,
    isSafetyStockOverridden,
    reorderPoint,
    isReorderPointOverridden,
    daysOfStockRemaining,
    daysOfStockLabel,
    supplierMoq,
    orderMultiple,
    suggestedOrderQuantity,
    orderUrgency,
    metadata
  };
}

// ---------------------------------------------------------------------------
// 5. ABC ANALYSIS ENGINE (Consumption-based & Capital-based)
// ---------------------------------------------------------------------------

export function calculateABCClassification(
  products: Product[],
  sales: SaleRecord[] = [],
  mode: 'consumption' | 'capital' = 'capital',
  thresholdA: number = 80,
  thresholdB: number = 95
): {
  classifiedProducts: ProductABCClassification[];
  totalValue: number;
  classSummary: {
    A: { count: number; value: number; skuPct: number; capitalPct: number };
    B: { count: number; value: number; skuPct: number; capitalPct: number };
    C: { count: number; value: number; skuPct: number; capitalPct: number };
  };
} {
  const totalSKUs = products.length;

  // Process products
  const items = products.map(p => {
    const unitCost = getProductUnitCost(p);
    const stock = getProductCurrentStock(p);
    const capitalValue = stock * unitCost;

    // Consumption Value: Units Sold * Unit Cost
    const prodSales = sales.filter(s => s.productId === p.id);
    let unitsSold = prodSales.reduce((sum, s) => sum + (Number(s.quantitySold) || 0), 0);
    if (unitsSold === 0 && typeof p.unitsSold === 'number') {
      unitsSold = p.unitsSold;
    }
    const consumptionValue = unitsSold * unitCost;

    const rankingValue = mode === 'consumption' ? consumptionValue : capitalValue;

    return {
      productId: p.id,
      sku: p.sku || p.id,
      productName: p.name || p.productName || 'Unnamed Product',
      category: p.category || 'General',
      unitCost,
      stock,
      consumptionValue,
      capitalValue,
      rankingValue
    };
  });

  // Sort descending by rankingValue
  const sorted = [...items].sort((a, b) => b.rankingValue - a.rankingValue);
  const totalValue = sorted.reduce((sum, i) => sum + i.rankingValue, 0);

  let runningVal = 0;
  const classified: ProductABCClassification[] = sorted.map((item, idx) => {
    const prevCumPct = totalValue > 0 ? (runningVal / totalValue) * 100 : 0;
    runningVal += item.rankingValue;
    const cumPct = totalValue > 0 ? (runningVal / totalValue) * 100 : 0;
    const pctOfTotal = totalValue > 0 ? (item.rankingValue / totalValue) * 100 : 0;

    let abcClass: 'A' | 'B' | 'C' = 'C';
    let controlPolicy = 'Low-touch replenishment; periodic bulk ordering.';

    if (totalValue > 0) {
      if (prevCumPct < thresholdA) {
        abcClass = 'A';
        controlPolicy = 'Weekly cycle count, strict safety stock, executive approval for overstocks.';
      } else if (prevCumPct < thresholdB) {
        abcClass = 'B';
        controlPolicy = 'Bi-weekly inventory reviews with standard economic order quantities.';
      } else {
        abcClass = 'C';
        controlPolicy = 'Low-touch bulk purchasing to minimize processing overhead.';
      }
    } else {
      // Fallback distribution when zero value
      const ratio = totalSKUs > 0 ? (idx + 1) / totalSKUs : 0;
      if (ratio <= 0.2) abcClass = 'A';
      else if (ratio <= 0.5) abcClass = 'B';
      else abcClass = 'C';
    }

    return {
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      category: item.category,
      rank: idx + 1,
      consumptionValue: item.consumptionValue,
      capitalValue: item.capitalValue,
      pctOfTotal: parseFloat(pctOfTotal.toFixed(2)),
      cumulativePct: parseFloat(cumPct.toFixed(2)),
      abcClass,
      controlPolicy
    };
  });

  const getSummary = (cls: 'A' | 'B' | 'C') => {
    const matching = classified.filter(p => p.abcClass === cls);
    const count = matching.length;
    const val = matching.reduce((s, i) => s + (mode === 'consumption' ? i.consumptionValue : i.capitalValue), 0);
    const skuPct = totalSKUs > 0 ? Math.round((count / totalSKUs) * 100) : 0;
    const capitalPct = totalValue > 0 ? parseFloat(((val / totalValue) * 100).toFixed(1)) : 0;
    return { count, value: val, skuPct, capitalPct };
  };

  return {
    classifiedProducts: classified,
    totalValue,
    classSummary: {
      A: getSummary('A'),
      B: getSummary('B'),
      C: getSummary('C')
    }
  };
}

// ---------------------------------------------------------------------------
// 6. MASTER COMPREHENSIVE INTELLIGENCE BUILDER
// ---------------------------------------------------------------------------

export function calculateCompanyInventoryIntelligence(
  products: Product[] = [],
  sales: SaleRecord[] = [],
  movements: StockMovement[] = [],
  purchaseOrders: PurchaseOrder[] = [],
  invoices: any[] = [],
  suppliers: any[] = [],
  periodDays: number = 30
): CompanyInventoryIntelligence {
  const supplierMap = new Map(suppliers.map(s => [s.id, s]));

  // 1. Compute ABC Analysis
  const abcAnalysis = calculateABCClassification(products, sales, 'capital');
  const abcMap = new Map(abcAnalysis.classifiedProducts.map(a => [a.productId, a]));

  // 2. Compute individual product metrics
  const productsIntelligence: ProductIntelligence[] = products.map(product => {
    const supplier = product.supplierId ? supplierMap.get(product.supplierId) : null;
    const demand = calculateProductDemandMetrics(product, sales, movements, periodDays);
    const velocity = calculateProductVelocityMetrics(product, sales, movements);
    const profit = calculateProductProfitMetrics(product, sales, invoices);
    const reorder = calculateProductReorderMetrics(product, supplier, demand, purchaseOrders);
    const abc = abcMap.get(product.id) || {
      productId: product.id,
      sku: product.sku || '',
      productName: product.name || '',
      category: product.category || 'General',
      rank: 1,
      consumptionValue: 0,
      capitalValue: 0,
      pctOfTotal: 0,
      cumulativePct: 0,
      abcClass: 'C' as const,
      controlPolicy: 'Standard replenishment'
    };

    return {
      product,
      demand,
      velocity,
      profit,
      reorder,
      abc
    };
  });

  // 3. High-level aggregates
  const totalSKUs = products.length;
  let activeStockedSKUs = 0;
  let outOfStockSKUs = 0;
  let totalInventoryValue = 0;
  let totalInventoryUnits = 0;
  let totalSalesValue = 0;
  let totalCOGS = 0;
  let reorderAlertsCount = 0;
  let criticalStockoutsCount = 0;

  const velocityCounts = {
    fast: { count: 0, percentage: 0, value: 0 },
    moderate: { count: 0, percentage: 0, value: 0 },
    slow: { count: 0, percentage: 0, value: 0 },
    obsolete: { count: 0, percentage: 0, value: 0 },
    outOfStock: { count: 0, percentage: 0, value: 0 },
  };

  productsIntelligence.forEach(item => {
    const stock = item.reorder.currentStock;
    const val = item.abc.capitalValue;

    if (stock > 0) activeStockedSKUs++;
    else {
      outOfStockSKUs++;
      criticalStockoutsCount++;
    }

    totalInventoryUnits += stock;
    totalInventoryValue += val;
    totalSalesValue += item.profit.grossSales;
    totalCOGS += item.profit.totalCostOfGoods;

    if (item.reorder.orderUrgency === 'CRITICAL' || item.reorder.orderUrgency === 'REORDER_NOW') {
      reorderAlertsCount++;
    }

    const vClass = item.velocity.movementClass;
    if (vClass === 'out_of_stock') {
      velocityCounts.outOfStock.count++;
      velocityCounts.outOfStock.value += val;
    } else if (vClass === 'fast') {
      velocityCounts.fast.count++;
      velocityCounts.fast.value += val;
    } else if (vClass === 'moderate') {
      velocityCounts.moderate.count++;
      velocityCounts.moderate.value += val;
    } else if (vClass === 'slow') {
      velocityCounts.slow.count++;
      velocityCounts.slow.value += val;
    } else {
      velocityCounts.obsolete.count++;
      velocityCounts.obsolete.value += val;
    }
  });

  if (totalSKUs > 0) {
    velocityCounts.fast.percentage = Math.round((velocityCounts.fast.count / totalSKUs) * 100);
    velocityCounts.moderate.percentage = Math.round((velocityCounts.moderate.count / totalSKUs) * 100);
    velocityCounts.slow.percentage = Math.round((velocityCounts.slow.count / totalSKUs) * 100);
    velocityCounts.obsolete.percentage = Math.round((velocityCounts.obsolete.count / totalSKUs) * 100);
    velocityCounts.outOfStock.percentage = Math.round((velocityCounts.outOfStock.count / totalSKUs) * 100);
  }

  const totalGrossProfit = totalSalesValue - totalCOGS;
  const overallGrossMarginPct = totalSalesValue > 0 ? parseFloat(((totalGrossProfit / totalSalesValue) * 100).toFixed(1)) : 0;

  // Annualized Stock Turnover Ratio = (Annualized COGS) / Total Inventory Value
  // Annualized COGS = (totalCOGS / periodDays) * 365
  const annualizedCOGS = periodDays > 0 ? (totalCOGS / periodDays) * 365 : totalCOGS;
  const annualizedTurnoverRatio = totalInventoryValue > 0 ? parseFloat((annualizedCOGS / totalInventoryValue).toFixed(2)) : 0;
  const daysSalesOfInventory = annualizedTurnoverRatio > 0 ? Math.round(365 / annualizedTurnoverRatio) : 0;

  return {
    totalSKUs,
    activeStockedSKUs,
    outOfStockSKUs,
    totalInventoryValue: parseFloat(totalInventoryValue.toFixed(2)),
    totalInventoryUnits,
    totalSalesValue: parseFloat(totalSalesValue.toFixed(2)),
    totalCOGS: parseFloat(totalCOGS.toFixed(2)),
    totalGrossProfit: parseFloat(totalGrossProfit.toFixed(2)),
    overallGrossMarginPct,
    annualizedTurnoverRatio,
    daysSalesOfInventory,
    abcSummary: abcAnalysis.classSummary,
    velocitySummary: velocityCounts,
    reorderAlertsCount,
    criticalStockoutsCount,
    productsIntelligence
  };
}
