import React, { useState, useMemo } from 'react';
import { 
  FileText, Download, Printer, Filter, Calendar, 
  DollarSign, PieChart as PieIcon, Building2, TrendingDown,
  Receipt, ArrowUpRight, ArrowDownRight, Sparkles 
} from 'lucide-react';
import { Expense, ExpenseCategory } from '../../../../types';
import { cn } from '../../../../lib/utils';

interface ExpenseReportsViewProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  companyId: string;
  currency: string;
}

export function ExpenseReportsView({
  expenses,
  categories,
  companyId,
  currency
}: ExpenseReportsViewProps) {
  const [reportType, setReportType] = useState<'CATEGORY_SUMMARY' | 'TAX_DEDUCTIBLE' | 'VENDOR_STATEMENT' | 'DEPARTMENT_BREAKDOWN'>('CATEGORY_SUMMARY');
  const [timePeriod, setTimePeriod] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'ALL'>('THIS_MONTH');

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const currentYearStr = `${now.getFullYear()}`;

  // Filtered dataset for the report
  const periodExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (timePeriod === 'THIS_MONTH') return e.date?.startsWith(currentMonthStr);
      if (timePeriod === 'LAST_MONTH') return e.date?.startsWith(prevMonthStr);
      if (timePeriod === 'THIS_YEAR') return e.date?.startsWith(currentYearStr);
      return true;
    });
  }, [expenses, timePeriod, currentMonthStr, prevMonthStr, currentYearStr]);

  // Aggregate Category Data
  const categoryReportData = useMemo(() => {
    const map: Record<string, { name: string; code: string; count: number; total: number; tax: number; isDeductible: boolean }> = {};

    categories.forEach(c => {
      map[c.id] = {
        name: c.name,
        code: c.code,
        count: 0,
        total: 0,
        tax: 0,
        isDeductible: c.isTaxDeductible !== false
      };
    });

    periodExpenses.forEach(e => {
      if (map[e.categoryId]) {
        map[e.categoryId].count++;
        map[e.categoryId].total += e.amount;
        map[e.categoryId].tax += (e.taxAmount || 0);
      } else {
        map[e.categoryId] = {
          name: e.categoryName || 'Other',
          code: 'EXP-999',
          count: 1,
          total: e.amount,
          tax: e.taxAmount || 0,
          isDeductible: true
        };
      }
    });

    return Object.values(map)
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [periodExpenses, categories]);

  // Aggregate Vendor Data
  const vendorReportData = useMemo(() => {
    const map: Record<string, { vendor: string; count: number; total: number; lastDate: string }> = {};

    periodExpenses.forEach(e => {
      const vendor = e.vendorName?.trim() || 'Direct Expense / Petty';
      if (!map[vendor]) {
        map[vendor] = { vendor, count: 0, total: 0, lastDate: e.date };
      }
      map[vendor].count++;
      map[vendor].total += e.amount;
      if (e.date > map[vendor].lastDate) map[vendor].lastDate = e.date;
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [periodExpenses]);

  // Totals
  const totalSpend = useMemo(() => periodExpenses.reduce((s, e) => s + e.amount, 0), [periodExpenses]);
  const totalTax = useMemo(() => periodExpenses.reduce((s, e) => s + (e.taxAmount || 0), 0), [periodExpenses]);
  const taxDeductibleTotal = useMemo(() => {
    return periodExpenses.reduce((s, e) => {
      const cat = categories.find(c => c.id === e.categoryId);
      if (cat && cat.isTaxDeductible === false) return s;
      return s + e.amount;
    }, 0);
  }, [periodExpenses, categories]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (reportType === 'CATEGORY_SUMMARY' || reportType === 'TAX_DEDUCTIBLE') {
      headers = ['Category Name', 'GL Code', 'Vouchers Count', 'Total Spend', 'Tax / VAT', 'Tax Deductible'];
      rows = categoryReportData.map(c => [
        `"${c.name}"`,
        c.code,
        c.count,
        c.total,
        c.tax,
        c.isDeductible ? 'Yes' : 'No'
      ]);
    } else {
      headers = ['Vendor / Payee', 'Transactions Count', 'Total Paid', 'Last Payment Date'];
      rows = vendorReportData.map(v => [
        `"${v.vendor}"`,
        v.count,
        v.total,
        v.lastDate
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expense_Report_${reportType}_${timePeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
              Financial Statements & Tax
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Audit & Compliance
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Expense Reports & Statements
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Generate formal summaries for accounting books, VAT input claims, and vendor reconciliations
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-slate-500" /> Print Statement
          </button>
          <button
            onClick={handleExportCSV}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-blue-600/20"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Report Type Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setReportType('CATEGORY_SUMMARY')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
              reportType === 'CATEGORY_SUMMARY' ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            Category Summary
          </button>
          <button
            onClick={() => setReportType('TAX_DEDUCTIBLE')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
              reportType === 'TAX_DEDUCTIBLE' ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            Tax & VAT Schedule
          </button>
          <button
            onClick={() => setReportType('VENDOR_STATEMENT')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
              reportType === 'VENDOR_STATEMENT' ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            Vendor Outflows
          </button>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value as any)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white outline-none"
          >
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
            <option value="THIS_YEAR">This Year</option>
            <option value="ALL">All Time</option>
          </select>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Expenditure in Period
          </span>
          <h4 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
            {currency} {totalSpend.toLocaleString()}
          </h4>
          <p className="text-xs text-slate-500 mt-1">{periodExpenses.length} transactions processed</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Input Tax (VAT 16%)
          </span>
          <h4 className="text-2xl font-black text-blue-600 mt-1 tracking-tight">
            {currency} {totalTax.toLocaleString()}
          </h4>
          <p className="text-xs text-slate-500 mt-1">Claimable VAT on business expenses</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Tax Deductible Expenses
          </span>
          <h4 className="text-2xl font-black text-emerald-600 mt-1 tracking-tight">
            {currency} {taxDeductibleTotal.toLocaleString()}
          </h4>
          <p className="text-xs text-slate-500 mt-1">Allowable P&L operating deductions</p>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
              {reportType === 'CATEGORY_SUMMARY' && 'Operational Expenditure by Category'}
              {reportType === 'TAX_DEDUCTIBLE' && 'Tax Deductible Schedule & Input VAT Claims'}
              {reportType === 'VENDOR_STATEMENT' && 'Vendor & Supplier Disbursement Register'}
            </h4>
            <span className="text-xs text-slate-400 font-medium">
              Period: {timePeriod.replace('_', ' ')}
            </span>
          </div>
        </div>

        {reportType === 'VENDOR_STATEMENT' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold">Vendor / Payee Name</th>
                  <th className="py-3.5 px-4 font-bold text-center">Transactions</th>
                  <th className="py-3.5 px-4 font-bold">Last Payment</th>
                  <th className="py-3.5 px-4 font-bold text-right">Total Outflow</th>
                  <th className="py-3.5 px-4 font-bold text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendorReportData.map((v, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {v.vendor}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-600 font-medium">
                      {v.count}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {v.lastDate}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900">
                      {currency} {v.total.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-600">
                      {totalSpend > 0 ? Math.round((v.total / totalSpend) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold">GL Code</th>
                  <th className="py-3.5 px-4 font-bold">Category</th>
                  <th className="py-3.5 px-4 font-bold text-center">Vouchers</th>
                  <th className="py-3.5 px-4 font-bold text-right">Input VAT</th>
                  <th className="py-3.5 px-4 font-bold text-center">Tax Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Total Outflow</th>
                  <th className="py-3.5 px-4 font-bold text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoryReportData.map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                      {c.code}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {c.name}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-600 font-medium">
                      {c.count}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                      {currency} {c.tax.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold",
                        c.isDeductible ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      )}>
                        {c.isDeductible ? 'Deductible' : 'Non-Deductible'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900">
                      {currency} {c.total.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-600">
                      {totalSpend > 0 ? Math.round((c.total / totalSpend) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
