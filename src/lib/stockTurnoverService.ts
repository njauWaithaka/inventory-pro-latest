export type TimePeriod = 'Today' | 'This Week' | 'This Month' | 'This Year' | 'Custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ProductTurnoverStats {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  buyingPrice: number;
  unitsSold: number;
  beginningStock: number;
  endingStock: number;
  averageStock: number;
  turnoverRatio: number;
  cogs: number;
  averageInventoryValue: number;
}

export interface OverallTurnoverStats {
  overallRatio: number;
  totalCOGS: number;
  totalAvgInventoryValue: number;
  totalUnitsSold: number;
  totalAvgInventoryQty: number;
  productsStats: ProductTurnoverStats[];
}

/**
 * Gets the start and end dates for standard time periods.
 */
export function getDateRangeForPeriod(period: TimePeriod, customRange?: { start: Date; end: Date }): DateRange {
  const now = new Date();
  const endDate = now;
  const startDate = new Date();

  switch (period) {
    case 'Today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'This Week': {
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Start on Monday
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case 'This Month':
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'This Year':
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'Custom':
      if (customRange) {
        return { startDate: customRange.start, endDate: customRange.end };
      }
      // Default to last 30 days
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      break;
  }

  return { startDate, endDate };
}

/**
 * Reconstructs the stock level of a product at a specific historical date.
 * Relies on stockMovements to walk backwards from current quantity.
 */
export function getStockAtTimestamp(product: any, movements: any[], targetDate: Date): number {
  // Filter and sort movements for this product chronologically
  const prodMovements = movements
    .filter(m => m.productId === product.id && m.createdAt)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const targetTime = targetDate.getTime();
  const firstMovAfter = prodMovements.find(m => new Date(m.createdAt).getTime() > targetTime);

  // If there is a movement after the target date, the stock right before that movement
  // is exactly the stock at the target date.
  if (firstMovAfter && typeof firstMovAfter.beforeQty === 'number') {
    return firstMovAfter.beforeQty;
  }

  // Fallback / Backtracing calculation if beforeQty is missing or no movement was after targetDate
  let qty = typeof product.quantity === 'number' ? product.quantity : 0;
  const movementsAfter = prodMovements.filter(m => new Date(m.createdAt).getTime() > targetTime);
  
  // Trace backwards in reverse chronological order
  movementsAfter.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const m of movementsAfter) {
    const q = Number(m.quantity) || 0;
    const isOutbound = m.type === 'sale' || m.transferType === 'out' || (m.type === 'adjustment' && m.quantity < 0);
    if (isOutbound) {
      qty += q;
    } else {
      qty -= q;
    }
  }

  return Math.max(0, qty);
}

/**
 * Computes turnover stats for all products and overall inventory over a specific DateRange.
 */
export function calculateStockTurnover(
  products: any[],
  movements: any[],
  dateRange: DateRange
): OverallTurnoverStats {
  const { startDate, endDate } = dateRange;
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  let grandTotalCOGS = 0;
  let grandTotalAvgInventoryValue = 0;
  let grandTotalUnitsSold = 0;
  let grandTotalAvgInventoryQty = 0;

  const productsStats: ProductTurnoverStats[] = products.map(product => {
    const buyingPrice = Number(product.buyingPrice || product.value || 0);

    // 1. Beginning and Ending Stock
    const beginningStock = getStockAtTimestamp(product, movements, startDate);
    const endingStock = getStockAtTimestamp(product, movements, endDate);
    const averageStock = (beginningStock + endingStock) / 2;

    // 2. Units Sold in Period
    const prodMovements = movements.filter(
      m => m.productId === product.id && m.createdAt
    );

    const unitsSold = prodMovements.reduce((sum, m) => {
      const mTime = new Date(m.createdAt).getTime();
      if (mTime >= startTime && mTime <= endTime && m.type === 'sale') {
        return sum + (Number(m.quantity) || 0);
      }
      return sum;
    }, 0);

    // 3. Turnover Ratio
    let turnoverRatio = 0;
    if (averageStock > 0) {
      turnoverRatio = unitsSold / averageStock;
    } else if (unitsSold > 0) {
      turnoverRatio = unitsSold / Math.max(1, product.quantity || 0);
    }

    const cogs = unitsSold * buyingPrice;
    const averageInventoryValue = averageStock * buyingPrice;

    grandTotalCOGS += cogs;
    grandTotalAvgInventoryValue += averageInventoryValue;
    grandTotalUnitsSold += unitsSold;
    grandTotalAvgInventoryQty += averageStock;

    return {
      productId: product.id,
      productName: product.name || 'Unknown Product',
      sku: product.sku || '',
      category: product.category || 'General',
      buyingPrice,
      unitsSold,
      beginningStock,
      endingStock,
      averageStock,
      turnoverRatio: parseFloat(turnoverRatio.toFixed(2)),
      cogs,
      averageInventoryValue,
    };
  });

  // Calculate Overall Turnover Ratio
  let overallRatio = 0;
  if (grandTotalAvgInventoryValue > 0) {
    overallRatio = grandTotalCOGS / grandTotalAvgInventoryValue;
  } else if (grandTotalAvgInventoryQty > 0) {
    overallRatio = grandTotalUnitsSold / grandTotalAvgInventoryQty;
  } else if (grandTotalUnitsSold > 0) {
    overallRatio = grandTotalUnitsSold / Math.max(1, products.reduce((sum, p) => sum + (p.quantity || 0), 0));
  }

  return {
    overallRatio: parseFloat(overallRatio.toFixed(2)),
    totalCOGS: grandTotalCOGS,
    totalAvgInventoryValue: grandTotalAvgInventoryValue,
    totalUnitsSold: grandTotalUnitsSold,
    totalAvgInventoryQty: grandTotalAvgInventoryQty,
    productsStats,
  };
}

/**
 * Generates dynamic monthly turnover trend data for the last 6 months.
 */
export function calculateMonthlyTurnoverTrend(products: any[], movements: any[]): { name: string; turnover: number }[] {
  const months = [];
  const now = new Date();

  // Generate last 6 months (chronological)
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString('default', { month: 'short' }),
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
    });
  }

  return months.map(m => {
    const startDate = new Date(m.year, m.monthIndex, 1, 0, 0, 0, 0);
    const endDate = new Date(m.year, m.monthIndex + 1, 0, 23, 59, 59, 999);

    const stats = calculateStockTurnover(products, movements, { startDate, endDate });
    
    return {
      name: m.label,
      turnover: parseFloat(stats.overallRatio.toFixed(2))
    };
  });
}
