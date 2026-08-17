import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, XCircle, Clock, AlertCircle, 
  Eye, CheckCheck, Loader2, DollarSign, Filter,
  Building2, UserCheck, ShieldCheck
} from 'lucide-react';
import { Expense, ExpenseCategory } from '../../../../types';
import { approveExpense, rejectExpense } from '../../../../lib/expenseService';
import { useAuth } from '../../../../contexts/AuthContext';
import { useSettings } from '../../../../contexts/SettingsContext';
import { cn } from '../../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface PendingExpensesProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  companyId: string;
  currency: string;
  onViewExpense?: (expense: Expense) => void;
}

export function PendingExpenses({
  expenses,
  categories,
  companyId,
  currency,
  onViewExpense
}: PendingExpensesProps) {
  const { user } = useAuth();
  const { profile } = useSettings();
  const approverName = profile?.name || user?.displayName || 'Finance Manager';

  const [rejectingExpense, setRejectingExpense] = useState<Expense | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Filter only PENDING expenses
  const pendingList = useMemo(() => {
    return expenses
      .filter(e => e.status === 'PENDING')
      .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }, [expenses]);

  const totalPendingValue = useMemo(() => {
    return pendingList.reduce((acc, e) => acc + (e.amount || 0), 0);
  }, [pendingList]);

  // Handle Single Approve
  const handleApprove = async (expId: string, markPaid: boolean = false) => {
    if (!companyId) return;
    setProcessingId(expId);
    try {
      await approveExpense(companyId, expId, approverName, markPaid);
      setSelectedIds(prev => prev.filter(id => id !== expId));
    } catch (err) {
      console.error('Failed to approve expense:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Single Reject
  const handleConfirmReject = async () => {
    if (!companyId || !rejectingExpense) return;
    setProcessingId(rejectingExpense.id);
    try {
      await rejectExpense(companyId, rejectingExpense.id, rejectReason.trim());
      setRejectingExpense(null);
      setRejectReason('');
      setSelectedIds(prev => prev.filter(id => id !== rejectingExpense.id));
    } catch (err) {
      console.error('Failed to reject expense:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // Batch Approve All Selected
  const handleBatchApprove = async () => {
    if (!companyId || selectedIds.length === 0) return;
    setBatchProcessing(true);
    try {
      for (const id of selectedIds) {
        await approveExpense(companyId, id, approverName, false);
      }
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed batch approval:', err);
    } finally {
      setBatchProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === pendingList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingList.map(e => e.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Status Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
              Management Review
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Approval Queue
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Pending Expense Approvals
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Review and authorize staff reimbursements, supplier bills, and department claims
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Pending Volume
            </span>
            <span className="text-lg font-black text-slate-900">
              {currency} {totalPendingValue.toLocaleString()} ({pendingList.length} items)
            </span>
          </div>

          {selectedIds.length > 0 && (
            <button
              onClick={handleBatchApprove}
              disabled={batchProcessing}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {batchProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4" />
              )}
              Approve Selected ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Main Review Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {pendingList.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-base font-extrabold text-slate-900">All Clear! No Pending Expenses</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are currently no outstanding expense claims awaiting authorization. New submissions will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === pendingList.length && pendingList.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded text-purple-600 border-slate-300"
                    />
                  </th>
                  <th className="py-3.5 px-4 font-bold">Voucher #</th>
                  <th className="py-3.5 px-4 font-bold">Date</th>
                  <th className="py-3.5 px-4 font-bold">Title & Description</th>
                  <th className="py-3.5 px-4 font-bold">Department</th>
                  <th className="py-3.5 px-4 font-bold">Category</th>
                  <th className="py-3.5 px-4 font-bold text-right">Amount</th>
                  <th className="py-3.5 px-4 font-bold text-center">Review Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingList.map((exp) => (
                  <tr key={exp.id} className="hover:bg-purple-50/20 transition-colors">
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(exp.id)}
                        onChange={() => toggleSelectOne(exp.id)}
                        className="w-4 h-4 rounded text-purple-600 border-slate-300"
                      />
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {exp.expenseNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {exp.date}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 max-w-[240px]">
                      <div>{exp.title}</div>
                      {exp.vendorName && (
                        <span className="text-[10px] font-medium text-slate-400 block">
                          Payee: {exp.vendorName}
                        </span>
                      )}
                      {exp.notes && (
                        <span className="text-[10px] font-normal text-slate-500 block truncate">
                          Note: {exp.notes}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                      {exp.department}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {exp.categoryName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                      {currency} {exp.amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleApprove(exp.id, false)}
                          disabled={processingId === exp.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleApprove(exp.id, true)}
                          disabled={processingId === exp.id}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          Approve & Pay
                        </button>
                        <button
                          onClick={() => setRejectingExpense(exp)}
                          disabled={processingId === exp.id}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rejection Reason Modal */}
      <AnimatePresence>
        {rejectingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Reject Expense Claim</h4>
                  <p className="text-xs text-slate-400">{rejectingExpense.expenseNumber} — {rejectingExpense.title}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason for Rejection (Visible to submitter)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Missing receipt voucher, exceeds authorized departmental budget, duplicate entry..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingExpense(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Confirm Rejection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
