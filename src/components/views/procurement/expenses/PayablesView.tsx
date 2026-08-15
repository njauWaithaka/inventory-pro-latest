import React, { useState, useMemo } from 'react';
import { 
  DollarSign, Clock, AlertCircle, CheckCircle2, 
  Calendar, Building2, CreditCard, ChevronRight, 
  ArrowUpRight, FileText, CheckCheck, Loader2, X 
} from 'lucide-react';
import { Expense, ExpenseCategory, ExpensePaymentMethod } from '../../../../types';
import { markExpenseAsPaid } from '../../../../lib/expenseService';
import { cn } from '../../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface PayablesViewProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  companyId: string;
  currency: string;
  onOpenRecordModal: () => void;
}

export function PayablesView({
  expenses,
  categories,
  companyId,
  currency,
  onOpenRecordModal
}: PayablesViewProps) {
  const [settlingExpense, setSettlingExpense] = useState<Expense | null>(null);
  const [settleMethod, setSettleMethod] = useState<ExpensePaymentMethod>('Bank Transfer');
  const [settleRef, setSettleRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterAging, setFilterAging] = useState<'ALL' | 'OVERDUE' | 'DUE_SOON' | 'CURRENT'>('ALL');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Filter only PAYABLE expenses
  const payablesList = useMemo(() => {
    return expenses.filter(e => e.status === 'PAYABLE' || e.status === 'APPROVED');
  }, [expenses]);

  // Aging Calculations
  const agingAnalysis = useMemo(() => {
    let overdueCount = 0;
    let overdueSum = 0;
    let dueSoonCount = 0;
    let dueSoonSum = 0;
    let currentSum = 0;
    let totalPayables = 0;

    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];

    payablesList.forEach(p => {
      totalPayables += p.amount;
      if (p.dueDate && p.dueDate < todayStr) {
        overdueCount++;
        overdueSum += p.amount;
      } else if (p.dueDate && p.dueDate <= sevenDaysFromNow) {
        dueSoonCount++;
        dueSoonSum += p.amount;
      } else {
        currentSum += p.amount;
      }
    });

    return {
      overdueCount,
      overdueSum,
      dueSoonCount,
      dueSoonSum,
      currentSum,
      totalPayables
    };
  }, [payablesList, todayStr]);

  const filteredPayables = useMemo(() => {
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];

    return payablesList.filter(p => {
      if (filterAging === 'OVERDUE') return p.dueDate && p.dueDate < todayStr;
      if (filterAging === 'DUE_SOON') return p.dueDate && p.dueDate >= todayStr && p.dueDate <= sevenDaysFromNow;
      if (filterAging === 'CURRENT') return !p.dueDate || p.dueDate > sevenDaysFromNow;
      return true;
    }).sort((a, b) => {
      // Show overdue first, then by earliest due date
      const dateA = a.dueDate || '9999-12-31';
      const dateB = b.dueDate || '9999-12-31';
      return dateA.localeCompare(dateB);
    });
  }, [payablesList, filterAging, todayStr]);

  const handleSettle = async () => {
    if (!companyId || !settlingExpense) return;
    setIsSubmitting(true);
    try {
      await markExpenseAsPaid(companyId, settlingExpense.id, settleMethod, settleRef.trim());
      setSettlingExpense(null);
      setSettleRef('');
    } catch (err) {
      console.error('Failed to settle payable:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
              Liabilities & Cash Planning
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Vendor Invoices Due
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Accounts Payable (AP)
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Monitor payment schedules, avoid late supplier fees, and manage working capital obligations
          </p>
        </div>

        <button
          onClick={onOpenRecordModal}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 self-start md:self-auto transition-all"
        >
          + Record Vendor Bill
        </button>
      </div>

      {/* Aging Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => setFilterAging('ALL')}
          className={cn(
            "p-5 rounded-3xl border shadow-xs cursor-pointer transition-all",
            filterAging === 'ALL' ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-900 border-slate-200 hover:border-slate-400"
          )}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider block opacity-70">
            Total AP Outstanding
          </span>
          <h4 className="text-2xl font-black mt-2 tracking-tight">
            {currency} {agingAnalysis.totalPayables.toLocaleString()}
          </h4>
          <p className="text-xs opacity-70 mt-1 font-medium">{payablesList.length} total bills</p>
        </div>

        <div 
          onClick={() => setFilterAging('OVERDUE')}
          className={cn(
            "p-5 rounded-3xl border shadow-xs cursor-pointer transition-all",
            filterAging === 'OVERDUE' ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-900 border-slate-200 hover:border-rose-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider block opacity-80">
              Overdue Bills
            </span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <h4 className="text-2xl font-black mt-2 tracking-tight text-rose-600 group-hover:text-rose-700">
            {currency} {agingAnalysis.overdueSum.toLocaleString()}
          </h4>
          <p className="text-xs opacity-70 mt-1 font-medium">{agingAnalysis.overdueCount} bills past due</p>
        </div>

        <div 
          onClick={() => setFilterAging('DUE_SOON')}
          className={cn(
            "p-5 rounded-3xl border shadow-xs cursor-pointer transition-all",
            filterAging === 'DUE_SOON' ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-900 border-slate-200 hover:border-amber-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider block opacity-80">
              Due Within 7 Days
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <h4 className="text-2xl font-black mt-2 tracking-tight text-amber-600">
            {currency} {agingAnalysis.dueSoonSum.toLocaleString()}
          </h4>
          <p className="text-xs opacity-70 mt-1 font-medium">{agingAnalysis.dueSoonCount} bills due soon</p>
        </div>

        <div 
          onClick={() => setFilterAging('CURRENT')}
          className={cn(
            "p-5 rounded-3xl border shadow-xs cursor-pointer transition-all",
            filterAging === 'CURRENT' ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-900 border-slate-200 hover:border-blue-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider block opacity-80">
              Current / Future Due
            </span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <h4 className="text-2xl font-black mt-2 tracking-tight text-blue-600">
            {currency} {agingAnalysis.currentSum.toLocaleString()}
          </h4>
          <p className="text-xs opacity-70 mt-1 font-medium">Standard terms</p>
        </div>
      </div>

      {/* Payables Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredPayables.length === 0 ? (
          <div className="py-20 text-center space-y-2 text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-800">No Payables Found in this Filter</h4>
            <p>All vendor invoices are settled or none meet the active aging filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold">Voucher #</th>
                  <th className="py-3.5 px-4 font-bold">Vendor / Payee</th>
                  <th className="py-3.5 px-4 font-bold">Bill Description</th>
                  <th className="py-3.5 px-4 font-bold">Category</th>
                  <th className="py-3.5 px-4 font-bold">Issue Date</th>
                  <th className="py-3.5 px-4 font-bold">Due Date / Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Amount Due</th>
                  <th className="py-3.5 px-4 font-bold text-center">Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayables.map((bill) => {
                  const isOverdue = bill.dueDate && bill.dueDate < todayStr;
                  const isDueSoon = bill.dueDate && bill.dueDate >= todayStr && bill.dueDate <= new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];

                  return (
                    <tr key={bill.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {bill.expenseNumber}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 max-w-[160px] truncate">
                        {bill.vendorName || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-[200px] truncate">
                        {bill.title}
                        {bill.reference && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            Inv #{bill.reference}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {bill.categoryName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {bill.date}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "font-bold text-[11px]",
                            isOverdue ? "text-rose-600" : isDueSoon ? "text-amber-600" : "text-slate-600"
                          )}>
                            {bill.dueDate || 'No Due Date'}
                          </span>
                          {isOverdue && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[9px] uppercase">
                              Overdue
                            </span>
                          )}
                          {isDueSoon && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold text-[9px] uppercase">
                              Due Soon
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900 whitespace-nowrap text-sm">
                        {currency} {bill.amount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSettlingExpense(bill);
                            setSettleMethod(bill.paymentMethod || 'Bank Transfer');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 mx-auto"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Pay Now
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settle Bill Modal */}
      <AnimatePresence>
        {settlingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Record Bill Settlement</h4>
                    <p className="text-xs text-slate-400">{settlingExpense.expenseNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettlingExpense(null)}
                  className="p-2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Payee / Vendor:</span>
                  <span className="font-bold text-slate-800">{settlingExpense.vendorName || 'Vendor'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Bill Title:</span>
                  <span className="font-bold text-slate-800">{settlingExpense.title}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-600 font-bold">Total Amount to Settle:</span>
                  <span className="text-sm font-black text-emerald-700">
                    {currency} {settlingExpense.amount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Method Disbursed
                </label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value as ExpensePaymentMethod)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Bank Transfer">Bank Transfer / Wire</option>
                  <option value="M-Pesa">M-Pesa Business Till / Paybill</option>
                  <option value="Cash">Cash</option>
                  <option value="Petty Cash">Petty Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Reference / Trans ID
                </label>
                <input
                  type="text"
                  placeholder="e.g., MPESA Ref, Check #, Wire Ref"
                  value={settleRef}
                  onChange={(e) => setSettleRef(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettlingExpense(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSettle}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                  Confirm Payment Settled
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
