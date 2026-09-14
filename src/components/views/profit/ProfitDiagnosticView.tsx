import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Download, 
  Filter, Search, Layers, Coins, DollarSign, TrendingUp, TrendingDown,
  Info, ArrowUpDown, RefreshCw, ShoppingCart, Receipt, Package, HelpCircle,
  ShieldAlert, Sparkles
} from 'lucide-react';
import { formatNetProfitDisplay } from './profitUtils';

export interface ProfitDiagnosticViewProps {
  invoices: any[];
  receipts: any[];
  products: any[];
  expenses: any[];
  currency: string;
}

interface DiagnosticLineItem {
  name: string;
  sku: string;
  productId: string;
  quantity: number;
  sellingPrice: number;
  lineRevenue: number;
  buyingPrice: number;
  costSource: 'item_record' | 'inventory_master' | 'missing';
  lineCOGS: number;
  lineGrossProfit: number;
  lineMargin: number; // percentage
  lineNetProfit: number;
  isMissingCost: boolean;
  isLoss: boolean;
}

interface DiagnosticTransaction {
  id: string;
  receiptId?: string;
  invoiceId?: string;
  source: 'POS' | 'Invoice';
  customer: string;
  customerPhone?: string;
  cashier?: string;
  dateStr: string;
  formattedDate: string;
  paymentMethod?: string;
  revenue: number;
  discountAmount: number;
  taxAmount: number;
  cogs: number;
  grossProfit: number;
  profitMargin: number; // percentage
  netProfit: number;
  items: DiagnosticLineItem[];
  hasMissingCost: boolean;
  hasLossItem: boolean;
  isTransactionLoss: boolean;
  diagnosis: 'missing_cost' | 'loss' | 'low_margin' | 'healthy';
}

export function ProfitDiagnosticView({
  invoices,
  receipts,
  products,
  expenses,
  currency,
}: ProfitDiagnosticViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'pos' | 'invoice'>('all');
  const [diagnosisFilter, setDiagnosisFilter] = useState<'all' | 'issues' | 'loss' | 'healthy'>('all');
  const [expandedTxIds, setExpandedTxIds] = useState<Set<string>>(new Set());

  // Consolidate POS Receipts and Invoices into unified diagnostic transactions
  const transactions = useMemo<DiagnosticTransaction[]>(() => {
    const list: DiagnosticTransaction[] = [];
    const processedKeys = new Set<string>();

    // Helper to find product cost from master catalog
    const resolveProductCost = (
      pId?: string,
      sku?: string,
      name?: string
    ): { cost: number; source: 'inventory_master' | 'missing' } => {
      if (!products || products.length === 0) {
        return { cost: 0, source: 'missing' };
      }

      const match = products.find((p) => {
        if (pId && p.id === pId) return true;
        if (sku && p.sku && p.sku.toLowerCase() === sku.toLowerCase()) return true;
        if (name && p.name && p.name.toLowerCase() === name.toLowerCase()) return true;
        return false;
      });

      if (match) {
        const costVal = Number(match.buyingPrice ?? match.costPrice ?? match.value ?? match.cost ?? 0);
        if (costVal > 0) {
          return { cost: costVal, source: 'inventory_master' };
        }
      }

      return { cost: 0, source: 'missing' };
    };

    // 1. Process POS Receipts
    (receipts || []).forEach((rcp) => {
      const txId = rcp.receiptId || rcp.id || `rcp-${Math.random()}`;
      processedKeys.add(txId);
      if (rcp.invoiceId) processedKeys.add(rcp.invoiceId);

      const itemsRaw = Array.isArray(rcp.items) ? rcp.items : [];
      let totalTxCOGS = 0;
      let hasMissing = false;
      let hasLoss = false;

      const items: DiagnosticLineItem[] = itemsRaw.map((it: any) => {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const sellPrice = Number(it.price || it.sellingPrice || it.unitPrice || 0);
        const lineRev = Number(it.total) || qty * sellPrice;

        // Check if cost was stored directly on the item
        let unitCost = Number(it.buyingPrice ?? it.cost ?? it.costPrice ?? 0);
        let costSource: 'item_record' | 'inventory_master' | 'missing' = 'item_record';

        if (unitCost <= 0) {
          const resolved = resolveProductCost(it.id || it.productId, it.sku, it.name);
          unitCost = resolved.cost;
          costSource = resolved.source;
        }

        const lineCOGS = qty * unitCost;
        totalTxCOGS += lineCOGS;

        const isMissingCost = unitCost <= 0;
        const isLoss = unitCost > sellPrice && sellPrice > 0;
        if (isMissingCost) hasMissing = true;
        if (isLoss) hasLoss = true;

        const lineGrossProfit = lineRev - lineCOGS;
        const lineMargin = lineRev > 0 ? (lineGrossProfit / lineRev) * 100 : 0;
        const lineNetProfit = lineGrossProfit;

        return {
          name: it.name || 'Unnamed Product',
          sku: it.sku || it.barcode || '',
          productId: it.id || it.productId || '',
          quantity: qty,
          sellingPrice: sellPrice,
          lineRevenue: lineRev,
          buyingPrice: unitCost,
          costSource,
          lineCOGS,
          lineGrossProfit,
          lineMargin,
          lineNetProfit,
          isMissingCost,
          isLoss,
        };
      });

      const revenue = Number(rcp.total ?? rcp.rawTotal ?? 0);
      const discountAmount = Number(rcp.discountAmount || 0);
      const taxAmount = Number(rcp.tax || 0);
      const grossProfit = revenue - totalTxCOGS;
      const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
      const netProfit = grossProfit - discountAmount;
      const isTransactionLoss = netProfit < 0;

      let diagnosis: 'missing_cost' | 'loss' | 'low_margin' | 'healthy' = 'healthy';
      if (hasMissing) {
        diagnosis = 'missing_cost';
      } else if (isTransactionLoss || hasLoss) {
        diagnosis = 'loss';
      } else if (profitMargin < 15) {
        diagnosis = 'low_margin';
      }

      const dateStr = rcp.date || (rcp.createdAt ? String(rcp.createdAt).split('T')[0] : '');
      const formattedDate = rcp.createdAt
        ? new Date(rcp.createdAt).toLocaleString()
        : dateStr || 'N/A';

      list.push({
        id: txId,
        receiptId: rcp.receiptId || rcp.id,
        invoiceId: rcp.invoiceId,
        source: 'POS',
        customer: rcp.customerName || 'Walk-in Customer',
        customerPhone: rcp.customerPhone || '',
        cashier: rcp.cashier || 'POS Terminal',
        dateStr,
        formattedDate,
        paymentMethod: rcp.paymentMethod || 'Cash',
        revenue,
        discountAmount,
        taxAmount,
        cogs: totalTxCOGS,
        grossProfit,
        profitMargin,
        netProfit,
        items,
        hasMissingCost: hasMissing,
        hasLossItem: hasLoss,
        isTransactionLoss,
        diagnosis,
      });
    });

    // 2. Process Invoices that were not already consolidated via receipts
    (invoices || []).forEach((inv) => {
      const invId = inv.id;
      if (invId && processedKeys.has(invId)) return;
      if (inv.receiptId && processedKeys.has(inv.receiptId)) return;

      const itemsRaw = Array.isArray(inv.items) ? inv.items : [];
      let totalTxCOGS = 0;
      let hasMissing = false;
      let hasLoss = false;

      const items: DiagnosticLineItem[] = itemsRaw.map((it: any) => {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const sellPrice = Number(it.price || it.unitPrice || 0);
        const lineRev = Number(it.total) || qty * sellPrice;

        let unitCost = Number(it.buyingPrice ?? it.cost ?? it.costPrice ?? 0);
        let costSource: 'item_record' | 'inventory_master' | 'missing' = 'item_record';

        if (unitCost <= 0) {
          const resolved = resolveProductCost(it.productId || it.id, it.sku, it.name);
          unitCost = resolved.cost;
          costSource = resolved.source;
        }

        const lineCOGS = qty * unitCost;
        totalTxCOGS += lineCOGS;

        const isMissingCost = unitCost <= 0;
        const isLoss = unitCost > sellPrice && sellPrice > 0;
        if (isMissingCost) hasMissing = true;
        if (isLoss) hasLoss = true;

        const lineGrossProfit = lineRev - lineCOGS;
        const lineMargin = lineRev > 0 ? (lineGrossProfit / lineRev) * 100 : 0;
        const lineNetProfit = lineGrossProfit;

        return {
          name: it.name || 'Unnamed Product',
          sku: it.sku || '',
          productId: it.productId || it.id || '',
          quantity: qty,
          sellingPrice: sellPrice,
          lineRevenue: lineRev,
          buyingPrice: unitCost,
          costSource,
          lineCOGS,
          lineGrossProfit,
          lineMargin,
          lineNetProfit,
          isMissingCost,
          isLoss,
        };
      });

      const revenue = Number(inv.amount || 0);
      const grossProfit = revenue - totalTxCOGS;
      const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
      const netProfit = grossProfit;
      const isTransactionLoss = netProfit < 0;

      let diagnosis: 'missing_cost' | 'loss' | 'low_margin' | 'healthy' = 'healthy';
      if (hasMissing) {
        diagnosis = 'missing_cost';
      } else if (isTransactionLoss || hasLoss) {
        diagnosis = 'loss';
      } else if (profitMargin < 15) {
        diagnosis = 'low_margin';
      }

      const isPOS = inv.source === 'POS' || (inv.id && inv.id.startsWith('INV-POS'));
      const dateStr = inv.date || (inv.createdAt ? String(inv.createdAt).split('T')[0] : '');
      const formattedDate = inv.createdAt
        ? new Date(inv.createdAt).toLocaleString()
        : dateStr || 'N/A';

      list.push({
        id: invId || `inv-${Math.random()}`,
        receiptId: inv.receiptId,
        invoiceId: invId,
        source: isPOS ? 'POS' : 'Invoice',
        customer: inv.customer || 'Customer',
        cashier: inv.createdBy || (isPOS ? 'POS Terminal' : 'System'),
        dateStr,
        formattedDate,
        revenue,
        discountAmount: 0,
        taxAmount: 0,
        cogs: totalTxCOGS,
        grossProfit,
        profitMargin,
        netProfit,
        items,
        hasMissingCost: hasMissing,
        hasLossItem: hasLoss,
        isTransactionLoss,
        diagnosis,
      });
    });

    // Sort descending by date/creation
    return list.sort((a, b) => (b.dateStr || '').localeCompare(a.dateStr || ''));
  }, [invoices, receipts, products]);

  // Aggregate Metrics for the Diagnostic View
  const aggregates = useMemo(() => {
    let totalRevenue = 0;
    let totalCOGS = 0;
    let countMissingCost = 0;
    let countLossTx = 0;
    let totalLineItems = 0;
    let missingCostLineItems = 0;

    transactions.forEach((tx) => {
      totalRevenue += tx.revenue;
      totalCOGS += tx.cogs;
      if (tx.hasMissingCost) countMissingCost++;
      if (tx.isTransactionLoss) countLossTx++;

      tx.items.forEach((it) => {
        totalLineItems++;
        if (it.isMissingCost) missingCostLineItems++;
      });
    });

    const totalGrossProfit = totalRevenue - totalCOGS;
    const overallMarginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const totalNetProfit = totalGrossProfit; // Transaction level net profit

    return {
      totalRevenue,
      totalCOGS,
      totalGrossProfit,
      overallMarginPct,
      totalNetProfit,
      countMissingCost,
      countLossTx,
      totalLineItems,
      missingCostLineItems,
      totalTx: transactions.length,
    };
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (sourceFilter === 'pos' && tx.source !== 'POS') return false;
      if (sourceFilter === 'invoice' && tx.source !== 'Invoice') return false;

      if (diagnosisFilter === 'issues' && !tx.hasMissingCost) return false;
      if (diagnosisFilter === 'loss' && !tx.isTransactionLoss && !tx.hasLossItem) return false;
      if (diagnosisFilter === 'healthy' && tx.diagnosis !== 'healthy') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = tx.id.toLowerCase().includes(q) || (tx.receiptId && tx.receiptId.toLowerCase().includes(q)) || (tx.invoiceId && tx.invoiceId.toLowerCase().includes(q));
        const matchesCust = tx.customer.toLowerCase().includes(q);
        const matchesItem = tx.items.some((it) => it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q));
        if (!matchesId && !matchesCust && !matchesItem) return false;
      }

      return true;
    });
  }, [transactions, sourceFilter, diagnosisFilter, searchQuery]);

  // Expand / Collapse Handlers
  const toggleExpand = (id: string) => {
    setExpandedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedTxIds(new Set(filteredTransactions.map((tx) => tx.id)));
  };

  const handleCollapseAll = () => {
    setExpandedTxIds(new Set());
  };

  // Export Diagnostic Audit CSV
  const handleExportCSV = () => {
    const rows = [
      ['PROFIT & COGS TRANSACTION DIAGNOSTIC AUDIT'],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Currency: ${currency}`],
      [],
      [
        'Tx ID',
        'Type/Source',
        'Date & Time',
        'Customer',
        'Item Name',
        'SKU',
        'Qty Sold',
        'Unit Selling Price',
        'Line Revenue',
        'Unit Buying/Cost Price',
        'Cost Source',
        'Line COGS',
        'Line Gross Profit',
        'Line Margin %',
        'Net Profit Label',
        'Net Profit Value',
        'Diagnostic Note',
      ],
    ];

    filteredTransactions.forEach((tx) => {
      tx.items.forEach((it) => {
        const profitStatus = formatNetProfitDisplay(it.lineNetProfit, currency);
        rows.push([
          `"${tx.id}"`,
          `"${tx.source}"`,
          `"${tx.formattedDate}"`,
          `"${tx.customer.replace(/"/g, '""')}"`,
          `"${it.name.replace(/"/g, '""')}"`,
          `"${it.sku}"`,
          it.quantity.toString(),
          it.sellingPrice.toFixed(2),
          it.lineRevenue.toFixed(2),
          it.buyingPrice.toFixed(2),
          `"${it.costSource}"`,
          it.lineCOGS.toFixed(2),
          it.lineGrossProfit.toFixed(2),
          `${it.lineMargin.toFixed(1)}%`,
          `"${profitStatus.label}"`,
          profitStatus.displayAmount.toFixed(2),
          it.isMissingCost
            ? '"Missing buying price in inventory (COGS calculated as 0)"'
            : it.isLoss
            ? '"Sold below cost (Loss)"'
            : '"OK"',
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `COGS_Revenue_Diagnostic_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const netProfitAggregate = formatNetProfitDisplay(aggregates.totalNetProfit, currency);

  return (
    <div id="cogs-revenue-diagnostic-view" className="flex flex-col gap-6 text-left">
      {/* 1. Root Cause Troubleshooting Banner */}
      {aggregates.missingCostLineItems > 0 && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-950">
                Discrepancy Detected: {aggregates.missingCostLineItems} item sale(s) have KSh 0 recorded Buying Price
              </h4>
              <p className="text-xs text-amber-800/90 font-medium mt-0.5">
                When a product in your inventory lacks a recorded buying/cost price (<span className="font-mono font-semibold">buyingPrice = 0</span>), its Cost of Goods Sold (COGS) calculates as <span className="font-mono font-semibold">0</span>. This makes the profit margin appear as 100% or prevents profit from adjusting realistically when sales are rung up at POS.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDiagnosisFilter('issues')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-sm transition-all cursor-pointer active:scale-95"
          >
            Filter {aggregates.countMissingCost} Flagged Sale(s)
          </button>
        </div>
      )}

      {/* 2. Top Diagnostic Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Collected Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sales Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {currency} {aggregates.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-[11px] text-slate-400 font-medium mt-1">From {aggregates.totalTx} transactions</p>
          </div>
        </div>

        {/* Metric 2: Actual Recorded COGS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Recorded COGS</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {currency} {aggregates.totalCOGS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Direct product inventory cost</p>
          </div>
        </div>

        {/* Metric 3: Gross Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Profit (Rev − COGS)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {currency} {aggregates.totalGrossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Overall Margin: <span className="font-bold text-slate-700">{aggregates.overallMarginPct.toFixed(1)}%</span>
            </p>
          </div>
        </div>

        {/* Metric 4: Net Profit (Strict Display Logic) */}
        <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between transition-all ${
          netProfitAggregate.type === 'loss'
            ? 'bg-rose-50/70 border-rose-200'
            : netProfitAggregate.type === 'profit'
            ? 'bg-emerald-50/20 border-emerald-200'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              netProfitAggregate.type === 'loss' ? 'text-rose-700' : 'text-slate-500'
            }`}>
              Net Operating Profit
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              netProfitAggregate.type === 'loss'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className={`text-2xl font-black font-mono block ${netProfitAggregate.textClass}`}>
              {netProfitAggregate.text}
            </span>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Status: <span className="font-bold text-slate-700">{netProfitAggregate.label}</span>
            </p>
          </div>
        </div>

        {/* Metric 5: Diagnostic Integrity Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Health & Audit</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black font-mono ${aggregates.countMissingCost > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {aggregates.countMissingCost > 0 ? `${aggregates.countMissingCost} Alerts` : 'Verified'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              {aggregates.countMissingCost > 0
                ? `${aggregates.countMissingCost} sales lack buying price`
                : 'All transactions have COGS'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar & Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Tx #, Receipt #, Customer, or Product..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Source filter */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 text-xs font-bold">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                sourceFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Sources ({transactions.length})
            </button>
            <button
              onClick={() => setSourceFilter('pos')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                sourceFilter === 'pos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              POS Only ({transactions.filter((t) => t.source === 'POS').length})
            </button>
            <button
              onClick={() => setSourceFilter('invoice')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                sourceFilter === 'invoice' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Invoices ({transactions.filter((t) => t.source === 'Invoice').length})
            </button>
          </div>

          {/* Diagnosis Filter */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 text-xs font-bold">
            <button
              onClick={() => setDiagnosisFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                diagnosisFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Diagnoses
            </button>
            <button
              onClick={() => setDiagnosisFilter('issues')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                diagnosisFilter === 'issues' ? 'bg-white text-amber-700 shadow-sm' : 'text-amber-600 hover:text-amber-800'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Missing Cost ({aggregates.countMissingCost})
            </button>
            <button
              onClick={() => setDiagnosisFilter('loss')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                diagnosisFilter === 'loss' ? 'bg-white text-rose-700 shadow-sm' : 'text-rose-600 hover:text-rose-800'
              }`}
            >
              <TrendingDown className="w-3 h-3" />
              Loss Sales ({aggregates.countLossTx})
            </button>
          </div>

          {/* Action buttons */}
          <button
            onClick={handleExpandAll}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            Collapse All
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit</span>
          </button>
        </div>
      </div>

      {/* 4. Transactions List with Expandable Line Items */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Transaction COGS & Profit Diagnostic Log
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Click any transaction row to expand its full line-item cost and margin breakdown
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Receipt className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">No transactions match your current filters</h4>
            <p className="text-xs text-slate-400 max-w-sm">
              Try resetting your search query or switching source/diagnosis filters to view other transactions.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTransactions.map((tx) => {
              const isExpanded = expandedTxIds.has(tx.id);
              const netProfitDisplay = formatNetProfitDisplay(tx.netProfit, currency);

              return (
                <div key={tx.id} className="transition-colors hover:bg-slate-50/40">
                  {/* Transaction Header Row */}
                  <div
                    onClick={() => toggleExpand(tx.id)}
                    className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer"
                  >
                    {/* Left: Metadata */}
                    <div className="flex items-start gap-3.5 min-w-[260px]">
                      <button
                        type="button"
                        className="mt-1 w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-transform"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-slate-900 font-mono">{tx.id}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              tx.source === 'POS'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                : 'bg-purple-50 text-purple-700 border border-purple-200/60'
                            }`}
                          >
                            {tx.source}
                          </span>

                          {tx.hasMissingCost && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Missing Cost
                            </span>
                          )}

                          {tx.isTransactionLoss && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                              Loss Sale
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 font-medium mt-1">
                          {tx.formattedDate} • <span className="font-semibold text-slate-700">{tx.customer}</span>
                          {tx.cashier && ` • Cashier: ${tx.cashier}`}
                        </p>
                      </div>
                    </div>

                    {/* Right: Revenue, COGS, Gross Profit, Margin, Net Profit */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 items-center text-right pl-9 lg:pl-0">
                      {/* Revenue */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Revenue</span>
                        <span className="text-sm font-black text-slate-900 font-mono">
                          {currency} {tx.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* COGS */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">COGS</span>
                        <span className={`text-sm font-bold font-mono ${tx.hasMissingCost ? 'text-amber-600' : 'text-slate-700'}`}>
                          {currency} {tx.cogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {tx.hasMissingCost && (
                          <span className="text-[9px] text-amber-600 block font-medium">⚠️ Cost missing</span>
                        )}
                      </div>

                      {/* Gross Profit */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gross Profit</span>
                        <span className="text-sm font-bold text-slate-800 font-mono">
                          {currency} {tx.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Margin % */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Margin %</span>
                        <span
                          className={`text-sm font-black font-mono ${
                            tx.profitMargin >= 30
                              ? 'text-emerald-600'
                              : tx.profitMargin >= 15
                              ? 'text-blue-600'
                              : tx.profitMargin > 0
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {tx.profitMargin.toFixed(1)}%
                        </span>
                      </div>

                      {/* Net Profit Display (Exact User Logic) */}
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Profit</span>
                        <span className={`text-sm font-black font-mono ${netProfitDisplay.textClass}`}>
                          {netProfitDisplay.text}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Line-Item Detail Table */}
                  {isExpanded && (
                    <div className="bg-slate-50/70 p-4 sm:p-6 border-t border-slate-100 overflow-x-auto">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-slate-500" />
                          Line Item Breakdown ({tx.items.length} {tx.items.length === 1 ? 'item' : 'items'})
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          {tx.items.filter((i) => i.isMissingCost).length > 0 && (
                            <span className="text-amber-600 font-semibold">
                              ⚠️ {tx.items.filter((i) => i.isMissingCost).length} item(s) have 0 buying price in inventory
                            </span>
                          )}
                        </p>
                      </div>

                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider text-left">
                            <th className="py-2.5 px-3">Product Name & SKU</th>
                            <th className="py-2.5 px-3 text-center">Qty</th>
                            <th className="py-2.5 px-3 text-right">Selling Price</th>
                            <th className="py-2.5 px-3 text-right">Line Revenue</th>
                            <th className="py-2.5 px-3 text-right">Buying / Cost Price</th>
                            <th className="py-2.5 px-3 text-right">Line COGS</th>
                            <th className="py-2.5 px-3 text-right">Gross Profit</th>
                            <th className="py-2.5 px-3 text-center">Margin %</th>
                            <th className="py-2.5 px-3 text-right">Net Profit</th>
                            <th className="py-2.5 px-3 text-left">Diagnostic Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 bg-white">
                          {tx.items.map((it, idx) => {
                            const lineProfitDisplay = formatNetProfitDisplay(it.lineNetProfit, currency);

                            return (
                              <tr key={`${it.name}-${idx}`} className="hover:bg-slate-50/80">
                                <td className="py-3 px-3">
                                  <span className="font-bold text-slate-900 block">{it.name}</span>
                                  {it.sku && <span className="text-[10px] text-slate-400 font-mono block">{it.sku}</span>}
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                                  {it.quantity}
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-slate-700">
                                  {currency} {it.sellingPrice.toFixed(2)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                  {currency} {it.lineRevenue.toFixed(2)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono">
                                  {it.isMissingCost ? (
                                    <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                      {currency} 0.00
                                    </span>
                                  ) : (
                                    <span className="text-slate-700 font-bold">
                                      {currency} {it.buyingPrice.toFixed(2)}
                                    </span>
                                  )}
                                  <span className="text-[9px] text-slate-400 block mt-0.5">
                                    {it.costSource === 'item_record'
                                      ? 'From sale record'
                                      : it.costSource === 'inventory_master'
                                      ? 'From inventory catalog'
                                      : 'Not set in inventory'}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                                  {currency} {it.lineCOGS.toFixed(2)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                                  {currency} {it.lineGrossProfit.toFixed(2)}
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-bold">
                                  <span
                                    className={`px-2 py-0.5 rounded ${
                                      it.lineMargin >= 30
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : it.lineMargin >= 15
                                        ? 'bg-blue-50 text-blue-700'
                                        : it.lineMargin > 0
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-rose-50 text-rose-700'
                                    }`}
                                  >
                                    {it.lineMargin.toFixed(1)}%
                                  </span>
                                </td>
                                <td className={`py-3 px-3 text-right font-mono font-black ${lineProfitDisplay.textClass}`}>
                                  {lineProfitDisplay.text}
                                </td>
                                <td className="py-3 px-3 text-left">
                                  {it.isMissingCost ? (
                                    <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded text-[11px] font-medium border border-amber-200/80 inline-flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                      Missing buyingPrice in inventory
                                    </span>
                                  ) : it.isLoss ? (
                                    <span className="text-rose-700 bg-rose-50 px-2 py-1 rounded text-[11px] font-medium border border-rose-200/80 inline-flex items-center gap-1">
                                      <TrendingDown className="w-3 h-3 text-rose-600" />
                                      Sold below buying price
                                    </span>
                                  ) : (
                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-[11px] font-medium border border-emerald-200/80 inline-flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      COGS matched to inventory
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
