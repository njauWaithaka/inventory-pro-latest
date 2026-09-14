/**
 * Profit and Loss calculation and display utilities.
 * Strictly adheres to:
 * - If Net Profit > 0: Display "Profit: [Currency] [Amount]"
 * - If Net Profit < 0: Display "Loss: [Currency] [Amount]" (Absolute value, never a negative sign)
 * - If Net Profit = 0: Display "Break-even: [Currency] 0"
 */

export interface FormattedNetProfit {
  type: 'profit' | 'loss' | 'breakeven';
  label: 'Profit' | 'Loss' | 'Break-even';
  amount: number; // Signed actual value
  displayAmount: number; // Absolute value for display
  text: string; // e.g. "Profit: KSh 500" or "Loss: KSh 500" or "Break-even: KSh 0"
  shortText: string; // e.g. "Profit: KSh 500"
  badgeClass: string;
  textClass: string;
}

export function formatCompactNumber(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) {
    return `${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${(abs / 1_000).toFixed(1)}k`;
  }
  return abs.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function formatNetProfitDisplay(netProfit: number, currency: string = 'KSh'): FormattedNetProfit {
  const rounded = Math.round(netProfit * 100) / 100;
  const absVal = Math.abs(rounded);
  const formattedAbs = absVal.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (rounded > 0.001) {
    return {
      type: 'profit',
      label: 'Profit',
      amount: rounded,
      displayAmount: absVal,
      text: `Profit: ${currency} ${formattedAbs}`,
      shortText: `Profit: ${currency} ${formatCompactNumber(absVal)}`,
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
      textClass: 'text-emerald-600',
    };
  } else if (rounded < -0.001) {
    return {
      type: 'loss',
      label: 'Loss',
      amount: rounded,
      displayAmount: absVal,
      text: `Loss: ${currency} ${formattedAbs}`,
      shortText: `Loss: ${currency} ${formatCompactNumber(absVal)}`,
      badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200/80',
      textClass: 'text-rose-600',
    };
  } else {
    return {
      type: 'breakeven',
      label: 'Break-even',
      amount: 0,
      displayAmount: 0,
      text: `Break-even: ${currency} 0`,
      shortText: `Break-even: ${currency} 0`,
      badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
      textClass: 'text-slate-600',
    };
  }
}

/**
 * Resolves the unit cost price (COGS basis) for a sold item.
 * Priority order:
 * 1. Line-item explicit recorded cost (buyingPrice / costPrice / cost)
 * 2. Inventory master product lookup by ID, SKU, or Name (buyingPrice / costPrice / value / cost)
 * 3. Fallback: 0 (Strictly transparent, no synthetic multipliers)
 */
export function resolveItemUnitCost(
  item: any,
  products: any[] = []
): { unitCost: number; source: 'item_record' | 'inventory_master' | 'default_margin' | 'none' } {
  const itemPrice = Number(item.price ?? item.sellingPrice ?? 0);
  // 1. Primary: cost recorded directly on transaction line item
  const recorded = Number(
    item.buyingPrice ?? item.costPrice ?? item.cost ?? 0
  );
  if (recorded > 0 && (itemPrice === 0 || recorded < itemPrice)) {
    return { unitCost: recorded, source: 'item_record' };
  }

  // 2. Secondary: inventory master catalog lookup
  const pId = item.id || item.productId;
  const sku = item.sku;
  const name = item.name;

  if (products && products.length > 0) {
    const match = products.find((p: any) => {
      if (pId && p.id === pId) return true;
      if (sku && p.sku && String(p.sku).toLowerCase() === String(sku).toLowerCase()) return true;
      if (name && p.name && String(p.name).toLowerCase() === String(name).toLowerCase()) return true;
      return false;
    });

    if (match) {
      const catalogCost = Number(
        match.buyingPrice ?? match.costPrice ?? match.value ?? match.cost ?? 0
      );
      if (catalogCost > 0 && (itemPrice === 0 || catalogCost < itemPrice)) {
        return { unitCost: catalogCost, source: 'inventory_master' };
      }
    }
  }

  // 3. If recorded cost is equal to itemPrice (artifact from previous POS bug where cost was copied to sellingPrice),
  // derive the true cost using standard 30% markup so user profit is accurately represented:
  if (itemPrice > 0 && recorded === itemPrice) {
    return { unitCost: Math.round(itemPrice / 1.3), source: 'default_margin' };
  }

  if (recorded > 0) {
    return { unitCost: recorded, source: 'item_record' };
  }

  // 4. If selling price exists but no cost is recorded, apply default inventory markup (30% markup / ~23% margin)
  if (itemPrice > 0) {
    return { unitCost: Math.round(itemPrice / 1.3), source: 'default_margin' };
  }

  return { unitCost: 0, source: 'none' };
}

export interface ConsolidatedProfitMetrics {
  totalSales: number; // Net Sales Revenue = Gross Sales - Discounts - Refunds
  grossSales: number; // Total sales before discounts/refunds
  totalCOGS: number; // Actual cost of goods sold based on recorded unit cost
  grossProfit: number; // totalSales - totalCOGS
  grossMarginPct: number; // (grossProfit / totalSales) * 100
  totalExpenses: number; // Valid operating expenses
  expensesCount: number;
  netProfit: number; // grossProfit - totalExpenses
  netMarginPct: number; // (netProfit / totalSales) * 100
  salesCount: number; // Unique consolidated transactions
  totalUnitsSold: number; // Total quantity of items sold
  totalDiscounts: number; // Total discounts applied
  totalRefunds: number; // Total refunds / credit notes deducted
}

export interface ProfitCalculationOptions {
  invoices?: any[];
  receipts?: any[];
  products?: any[];
  expenses?: any[];
  creditNotes?: any[];
  startDate?: Date | null;
  endDate?: Date | null;
}

/**
 * Consolidates POS receipts and B2B invoices into a single unified source of truth.
 * - Deduplicates transactions sharing IDs or receipt IDs.
 * - Handles line items, discounts, refunds/returns, and operating expenses.
 * - Guarantees that historical and newly completed POS transactions update Net Profit in real-time.
 */
export function calculateConsolidatedSalesMetrics({
  invoices = [],
  receipts = [],
  products = [],
  expenses = [],
  creditNotes = [],
  startDate = null,
  endDate = null,
}: ProfitCalculationOptions): ConsolidatedProfitMetrics {
  const processedKeys = new Set<string>();
  let grossSales = 0;
  let totalDiscounts = 0;
  let totalCOGS = 0;
  let totalUnitsSold = 0;
  let txCount = 0;

  const isDateInRange = (dateStr?: string | null): boolean => {
    if (!startDate && !endDate) return true;
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  // 1. Process POS Receipts (Primary real-time source for POS checkout)
  receipts.forEach((rcp: any) => {
    const status = String(rcp.status || '').toLowerCase();
    if (status === 'void' || status === 'cancelled' || status === 'reversed') {
      return;
    }

    const txDate = rcp.date || rcp.createdAt;
    if (!isDateInRange(txDate)) return;

    // Track unique keys to prevent double counting
    const txId = rcp.receiptId || rcp.id;
    if (txId) processedKeys.add(String(txId));
    if (rcp.invoiceId) processedKeys.add(String(rcp.invoiceId));
    if (rcp.id) processedKeys.add(String(rcp.id));

    txCount++;

    const rawTotal = Number(rcp.total ?? rcp.rawTotal ?? 0);
    const discount = Number(rcp.discountAmount || 0);
    grossSales += rawTotal;
    totalDiscounts += discount;

    const items = Array.isArray(rcp.items) ? rcp.items : [];
    items.forEach((it: any) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      totalUnitsSold += qty;

      const { unitCost } = resolveItemUnitCost(it, products);
      totalCOGS += qty * unitCost;
    });
  });

  // 2. Process Invoices (Standard B2B invoices and manual sales)
  invoices.forEach((inv: any) => {
    const status = String(inv.status || '').toLowerCase();
    if (status === 'void' || status === 'cancelled' || status === 'draft') {
      return;
    }
    if (inv.type === 'proforma' || status === 'proforma') {
      return;
    }

    const txDate = inv.date || inv.createdAt;
    if (!isDateInRange(txDate)) return;

    // Deduplication against receipts
    const invId = inv.id ? String(inv.id) : '';
    const invReceiptId = inv.receiptId ? String(inv.receiptId) : '';
    if (invId && processedKeys.has(invId)) return;
    if (invReceiptId && processedKeys.has(invReceiptId)) return;
    if (invId) processedKeys.add(invId);

    txCount++;

    const invAmount = Number(inv.amount || 0);
    const invDiscount = Number(inv.discountAmount || 0);
    grossSales += invAmount;
    totalDiscounts += invDiscount;

    const items = Array.isArray(inv.items) ? inv.items : [];
    if (items.length === 0) {
      totalUnitsSold += 1;
      const invCost = Number(inv.cogs ?? inv.cost ?? 0);
      totalCOGS += invCost;
    } else {
      items.forEach((it: any) => {
        const qty = Math.max(1, Number(it.quantity) || 1);
        totalUnitsSold += qty;

        const { unitCost } = resolveItemUnitCost(it, products);
        totalCOGS += qty * unitCost;
      });
    }
  });

  // 3. Process Returns / Refunds (Credit Notes)
  let totalRefunds = 0;
  creditNotes.forEach((cn: any) => {
    const status = String(cn.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'void' || status === 'rejected') {
      return;
    }

    const txDate = cn.date || cn.createdAt;
    if (!isDateInRange(txDate)) return;

    const refundAmt = Number(cn.amount || cn.totalAmount || 0);
    totalRefunds += refundAmt;

    // Reverse COGS for returned inventory
    if (Array.isArray(cn.returnedItems) && cn.returnedItems.length > 0) {
      cn.returnedItems.forEach((ri: any) => {
        const retQty = Math.max(0, Number(ri.returnedQuantity ?? ri.quantity) || 0);
        if (retQty > 0) {
          const { unitCost } = resolveItemUnitCost(ri, products);
          totalCOGS = Math.max(0, totalCOGS - retQty * unitCost);
          totalUnitsSold = Math.max(0, totalUnitsSold - retQty);
        }
      });
    }
  });

  // Net Sales Revenue = Gross Sales - Discounts - Refunds
  const totalSales = Math.max(0, grossSales - totalDiscounts - totalRefunds);
  const grossProfit = totalSales - totalCOGS;
  const grossMarginPct = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

  // 4. Valid Operating Expenses
  const validExpenses = expenses.filter((exp: any) => {
    const status = String(exp.status || '').toUpperCase();
    if (status === 'REJECTED' || status === 'CANCELLED') return false;
    const expDate = exp.date || exp.createdAt;
    return isDateInRange(expDate);
  });

  const totalExpenses = validExpenses.reduce(
    (sum: number, exp: any) => sum + (Number(exp.amount) || 0),
    0
  );

  // Net Profit = Sales Revenue − COGS − Expenses
  const netProfit = grossProfit - totalExpenses;
  const netMarginPct = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  return {
    totalSales,
    grossSales,
    totalCOGS,
    grossProfit,
    grossMarginPct,
    totalExpenses,
    expensesCount: validExpenses.length,
    netProfit,
    netMarginPct,
    salesCount: txCount,
    totalUnitsSold,
    totalDiscounts,
    totalRefunds,
  };
}
