import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, Download, Plus, MoreVertical, 
  Trash2, Edit3, CheckCircle2, AlertCircle, Eye, 
  X, Calendar, ArrowUpDown, ChevronDown, DollarSign,
  FileSpreadsheet, Receipt, Building2, Tag, CreditCard
} from 'lucide-react';
import { 
  Expense, ExpenseCategory, ExpensePaymentMethod, 
  ExpenseDepartment, ExpenseStatus 
} from '../../../../types';
import { deleteExpense, markExpenseAsPaid } from '../../../../lib/expenseService';
import { cn } from '../../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ExpenseTransactionsProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  companyId: string;
  currency: string;
  onOpenRecordModal: () => void;
  onEditExpense: (expense: Expense) => void;
}

export function ExpenseTransactions({
  expenses,
  categories,
  companyId,
  currency,
  onOpenRecordModal,
  onEditExpense
}: ExpenseTransactionsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR'>('ALL');
  
  // Selected Expense for Detailed Drawer / Modal
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);

  // Filtered List
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const currentYear = `${now.getFullYear()}`;

    return expenses.filter(exp => {
      // Search
      const matchSearch = searchTerm === '' || 
        exp.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.expenseNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.categoryName?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      // Category
      if (selectedCategory !== 'ALL' && exp.categoryId !== selectedCategory) return false;

      // Status
      if (selectedStatus !== 'ALL' && exp.status !== selectedStatus) return false;

      // Payment Method
      if (selectedPaymentMethod !== 'ALL' && exp.paymentMethod !== selectedPaymentMethod) return false;

      // Department
      if (selectedDepartment !== 'ALL' && exp.department !== selectedDepartment) return false;

      // Date Range
      if (dateRange === 'THIS_MONTH' && !exp.date?.startsWith(currentMonth)) return false;
      if (dateRange === 'LAST_MONTH' && !exp.date?.startsWith(prevMonth)) return false;
      if (dateRange === 'THIS_YEAR' && !exp.date?.startsWith(currentYear)) return false;

      return true;
    }).sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }, [expenses, searchTerm, selectedCategory, selectedStatus, selectedPaymentMethod, selectedDepartment, dateRange]);

  // Aggregate Totals
  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredExpenses]);

  const totalTax = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.taxAmount || 0), 0);
  }, [filteredExpenses]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Voucher Number',
      'Date',
      'Title',
      'Category',
      'Department',
      'Vendor/Payee',
      'Amount',
      'Tax Amount',
      'Payment Method',
      'Status',
      'Reference',
      'Notes'
    ];

    const rows = filteredExpenses.map(e => [
      e.expenseNumber,
      e.date,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${e.categoryName}"`,
      e.department,
      `"${(e.vendorName || '').replace(/"/g, '""')}"`,
      e.amount,
      e.taxAmount || 0,
      e.paymentMethod,
      e.status,
      `"${(e.reference || '').replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expense_Transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!companyId) return;
    if (confirm(`Are you sure you want to delete expense record "${title}"?`)) {
      try {
        await deleteExpense(companyId, id);
        if (viewingExpense?.id === id) setViewingExpense(null);
      } catch (err) {
        console.error('Failed to delete expense:', err);
      }
    }
  };

  const handleMarkAsPaid = async (exp: Expense) => {
    if (!companyId) return;
    try {
      await markExpenseAsPaid(companyId, exp.id);
      if (viewingExpense?.id === exp.id) {
        setViewingExpense({ ...viewingExpense, status: 'PAID', paidAt: new Date().toISOString() });
      }
    } catch (err) {
      console.error('Failed to mark expense as paid:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Expense Transactions Register
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Comprehensive audit trail of all company disbursements, purchases, and vendor invoices
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export CSV
            </button>
            <button
              onClick={onOpenRecordModal}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              Record Expense
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, voucher, payee, ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PAYABLE">Payable (Unpaid)</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="M-Pesa">M-Pesa</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="Petty Cash">Petty Cash</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All Time</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="THIS_YEAR">This Year</option>
            </select>
          </div>
        </div>

        {/* Ticker Summary Bar */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-6">
            <span>Showing <strong className="text-slate-900">{filteredExpenses.length}</strong> records</span>
            <span>Total Value: <strong className="text-blue-600 font-bold">{currency} {totalAmount.toLocaleString()}</strong></span>
            {totalTax > 0 && (
              <span>VAT Included: <strong className="text-slate-700 font-bold">{currency} {totalTax.toLocaleString()}</strong></span>
            )}
          </div>

          {(searchTerm || selectedCategory !== 'ALL' || selectedStatus !== 'ALL' || selectedPaymentMethod !== 'ALL' || dateRange !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('ALL');
                setSelectedStatus('ALL');
                setSelectedPaymentMethod('ALL');
                setSelectedDepartment('ALL');
                setDateRange('ALL');
              }}
              className="text-xs text-rose-600 font-bold hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 font-bold">Voucher #</th>
                <th className="py-3.5 px-4 font-bold">Date</th>
                <th className="py-3.5 px-4 font-bold">Expense Title</th>
                <th className="py-3.5 px-4 font-bold">Category</th>
                <th className="py-3.5 px-4 font-bold">Payee / Vendor</th>
                <th className="py-3.5 px-4 font-bold">Method</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Amount</th>
                <th className="py-3.5 px-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    No expense records matched your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr 
                    key={exp.id} 
                    className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                    onClick={() => setViewingExpense(exp)}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {exp.expenseNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {exp.date}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 max-w-[220px] truncate">
                      {exp.title}
                      {exp.reference && (
                        <span className="block text-[10px] font-normal text-slate-400">
                          Ref: {exp.reference}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {exp.categoryName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium max-w-[150px] truncate">
                      {exp.vendorName || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                      {exp.paymentMethod}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide",
                        exp.status === 'PAID' && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                        exp.status === 'PAYABLE' && "bg-amber-50 text-amber-700 border border-amber-200",
                        exp.status === 'PENDING' && "bg-purple-50 text-purple-700 border border-purple-200",
                        exp.status === 'APPROVED' && "bg-blue-50 text-blue-700 border border-blue-200",
                        exp.status === 'REJECTED' && "bg-rose-50 text-rose-700 border border-rose-200"
                      )}>
                        {exp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                      {currency} {exp.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title="View Details"
                          onClick={() => setViewingExpense(exp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          title="Edit"
                          onClick={() => onEditExpense(exp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          title="Delete"
                          onClick={() => handleDelete(exp.id, exp.title)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Detail Modal / Drawer */}
      <AnimatePresence>
        {viewingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-400">
                      {viewingExpense.expenseNumber}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                      viewingExpense.status === 'PAID' ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    )}>
                      {viewingExpense.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">
                    {viewingExpense.title}
                  </h3>
                </div>
                <button
                  onClick={() => setViewingExpense(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Expense Amount</span>
                    <h4 className="text-2xl font-black text-blue-900 mt-0.5">
                      {currency} {viewingExpense.amount.toLocaleString()}
                    </h4>
                  </div>
                  {viewingExpense.taxAmount ? (
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tax (VAT)</span>
                      <p className="text-sm font-bold text-slate-700 mt-0.5">
                        {currency} {viewingExpense.taxAmount.toLocaleString()}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</span>
                    <p className="text-xs font-bold text-slate-900 mt-1">{viewingExpense.categoryName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</span>
                    <p className="text-xs font-bold text-slate-900 mt-1">{viewingExpense.department}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Method</span>
                    <p className="text-xs font-bold text-slate-900 mt-1">{viewingExpense.paymentMethod}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expense Date</span>
                    <p className="text-xs font-bold text-slate-900 mt-1">{viewingExpense.date}</p>
                  </div>
                  {viewingExpense.vendorName && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendor / Payee</span>
                      <p className="text-xs font-bold text-slate-900 mt-1">{viewingExpense.vendorName}</p>
                    </div>
                  )}
                  {viewingExpense.reference && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reference / Receipt #</span>
                      <p className="text-xs font-bold text-slate-900 mt-1">{viewingExpense.reference}</p>
                    </div>
                  )}
                </div>

                {viewingExpense.notes && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notes & Audit Trail</span>
                    <p className="text-xs text-slate-700 mt-1">{viewingExpense.notes}</p>
                  </div>
                )}

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  {viewingExpense.status === 'PAYABLE' && (
                    <button
                      onClick={() => handleMarkAsPaid(viewingExpense)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Settle & Mark Paid
                    </button>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() => {
                        const target = viewingExpense;
                        setViewingExpense(null);
                        onEditExpense(target);
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setViewingExpense(null)}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
