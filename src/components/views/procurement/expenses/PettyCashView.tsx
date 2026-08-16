import React, { useState, useMemo } from 'react';
import { 
  Wallet, Plus, ArrowDownRight, ArrowUpRight, 
  Receipt, Calendar, User, CheckCircle2, AlertCircle, 
  Download, Loader2, X, RefreshCw 
} from 'lucide-react';
import { 
  PettyCashTransaction, PettyCashFloat, ExpenseCategory 
} from '../../../../types';
import { topUpPettyCash, disbursePettyCash } from '../../../../lib/expenseService';
import { useAuth } from '../../../../contexts/AuthContext';
import { cn } from '../../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface PettyCashViewProps {
  transactions: PettyCashTransaction[];
  floatMeta: PettyCashFloat;
  categories: ExpenseCategory[];
  companyId: string;
  currency: string;
}

export function PettyCashView({
  transactions,
  floatMeta,
  categories,
  companyId,
  currency
}: PettyCashViewProps) {
  const { user, profile } = useAuth();
  const authorizerName = profile?.name || user?.displayName || 'Finance Officer';

  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Top up state
  const [topUpAmount, setTopUpAmount] = useState('10000');
  const [topUpSource, setTopUpSource] = useState('Bank Cash Withdrawal');
  const [topUpVoucher, setTopUpVoucher] = useState('');
  const [topUpNotes, setTopUpNotes] = useState('');

  // Disburse state
  const [disburseAmount, setDisburseAmount] = useState('');
  const [disbursePurpose, setDisbursePurpose] = useState('');
  const [recipient, setRecipient] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const currentBalance = floatMeta?.currentBalance || 0;
  const targetFloat = floatMeta?.targetFloat || 10000;
  const minThreshold = floatMeta?.minimumThreshold || 3000;
  const floatHealthPct = Math.min(100, Math.round((currentBalance / targetFloat) * 100));

  // Ledger calculation
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }, [transactions]);

  const quickAmounts = [1000, 2500, 5000, 10000, 20000, 50000];
  const numTopUpAmount = parseFloat(topUpAmount) || 0;
  const projectedBalance = currentBalance + numTopUpAmount;

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const amt = parseFloat(topUpAmount);
    if (isNaN(amt) || amt <= 0) return;

    setSubmitting(true);
    try {
      await topUpPettyCash(companyId, amt, authorizerName, topUpNotes.trim(), {
        source: topUpSource,
        voucherNumber: topUpVoucher.trim() || undefined
      });
      setIsTopUpOpen(false);
      setTopUpAmount('');
      setTopUpNotes('');
      setTopUpVoucher('');
    } catch (err) {
      console.error('Failed to top up petty cash:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const amt = parseFloat(disburseAmount);
    if (isNaN(amt) || amt <= 0) return;
    if (!disbursePurpose.trim()) return;

    const catObj = categories.find(c => c.id === categoryId);

    setSubmitting(true);
    try {
      await disbursePettyCash(companyId, {
        amount: amt,
        purpose: disbursePurpose.trim(),
        recipient: recipient.trim() || undefined,
        categoryId,
        categoryName: catObj ? catObj.name : 'General Expense',
        receiptNumber: receiptNumber.trim() || undefined,
        authorizedBy: authorizerName,
        date,
        notes: notes.trim() || undefined
      });
      setIsDisburseOpen(false);
      setDisburseAmount('');
      setDisbursePurpose('');
      setRecipient('');
      setReceiptNumber('');
      setNotes('');
    } catch (err) {
      console.error('Failed to disburse petty cash:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
              Cash Drawer Control
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Vouchers & Disbursals
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Petty Cash Management
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Log small on-the-spot shop purchases, office supplies, courier cash, and float replenishments
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsTopUpOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 text-xs font-bold transition-all flex items-center gap-2 shadow-2xs"
          >
            <Wallet className="w-4 h-4 text-emerald-700" /> Load Petty Cash
          </button>
          <button
            onClick={() => setIsDisburseOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" /> Issue Cash Voucher
          </button>
        </div>
      </div>

      {/* Float Health & Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Float Balance */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Cash Float In Drawer
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h4 className="text-3xl font-black text-slate-900 tracking-tight">
              {currency} {currentBalance.toLocaleString()}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    currentBalance < minThreshold ? "bg-rose-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${floatHealthPct}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-500 shrink-0">
                {floatHealthPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Target Float & Threshold */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Float Target & Safety Threshold
          </span>
          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Target Maximum Float:</span>
              <span className="font-bold text-slate-900">{currency} {targetFloat.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Low Float Threshold:</span>
              <span className="font-bold text-amber-600">{currency} {minThreshold.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-100">
              <span className="text-slate-400">Status:</span>
              <span className={cn(
                "font-bold",
                currentBalance < minThreshold ? "text-rose-600" : "text-emerald-600"
              )}>
                {currentBalance < minThreshold ? '⚠️ Low Reserve — Top-up Advised' : '✅ Well Capitalized'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Reconciliation Stats */}
        <div className="bg-slate-900 text-white p-5 rounded-3xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Activity Ledger
            </span>
            <Receipt className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 space-y-1 text-xs">
            <p className="text-xl font-bold text-white">
              {transactions.length} <span className="text-xs font-normal text-slate-400">Total Vouchers Logged</span>
            </p>
            <p className="text-[11px] text-slate-300">
              All disbursements automatically generate sequential PCV audit vouchers.
            </p>
          </div>
        </div>
      </div>

      {/* Petty Cash Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
            Petty Cash Ledger & Vouchers
          </h4>
          <span className="text-xs text-slate-400 font-medium">
            Running cash drawer balance
          </span>
        </div>

        {sortedTransactions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No petty cash vouchers recorded yet. Click "Top-up Cash Float" or "Issue Cash Voucher" to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold">Voucher #</th>
                  <th className="py-3.5 px-4 font-bold">Date</th>
                  <th className="py-3.5 px-4 font-bold">Type</th>
                  <th className="py-3.5 px-4 font-bold">Purpose / Payee</th>
                  <th className="py-3.5 px-4 font-bold">Category</th>
                  <th className="py-3.5 px-4 font-bold">Authorized By</th>
                  <th className="py-3.5 px-4 font-bold text-right">Debit / Credit</th>
                  <th className="py-3.5 px-4 font-bold text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {tx.voucherNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold",
                        tx.type === 'TOP_UP' ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      )}>
                        {tx.type === 'TOP_UP' ? 'Deposit / Top-up' : 'Disbursement'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-[220px]">
                      <div>{tx.purpose}</div>
                      {tx.recipient && (
                        <span className="text-[10px] font-normal text-slate-400 block">
                          Recipient: {tx.recipient}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                      {tx.categoryName || 'Float Top-up'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {tx.authorizedBy}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black whitespace-nowrap">
                      {tx.type === 'TOP_UP' ? (
                        <span className="text-emerald-600">+{currency} {tx.amount.toLocaleString()}</span>
                      ) : (
                        <span className="text-rose-600">-{currency} {tx.amount.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                      {currency} {(tx.balanceAfter || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Load Petty Cash Top Up Modal */}
      <AnimatePresence>
        {isTopUpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Load Petty Cash Float</h4>
                    <p className="text-xs text-slate-500">Deposit funds into cash drawer float</p>
                  </div>
                </div>
                <button onClick={() => setIsTopUpOpen(false)} className="p-2 text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTopUpSubmit} className="space-y-4">
                {/* Quick Preset Buttons */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Quick Preset Amount ({currency})
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {quickAmounts.map((qAmt) => (
                      <button
                        key={qAmt}
                        type="button"
                        onClick={() => setTopUpAmount(qAmt.toString())}
                        className={cn(
                          "py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center",
                          numTopUpAmount === qAmt
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                        )}
                      >
                        +{qAmt >= 1000 ? `${(qAmt / 1000)}k` : qAmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Deposit Amount to Load ({currency}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 5000"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Funding Source
                    </label>
                    <select
                      value={topUpSource}
                      onChange={(e) => setTopUpSource(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                    >
                      <option value="Bank Cash Withdrawal">Bank Cash Withdrawal</option>
                      <option value="Main Cash Register / Till">Main Cash Register / Till</option>
                      <option value="Director / Owner Injection">Director / Owner Injection</option>
                      <option value="M-Pesa Business Float Transfer">M-Pesa Business Float</option>
                      <option value="Sales Revenue Cash Drawer">Sales Revenue Cash Drawer</option>
                      <option value="Other Cash Source">Other Cash Source</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Voucher / Slip Ref #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Bank slip #, PCV-001"
                      value={topUpVoucher}
                      onChange={(e) => setTopUpVoucher(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Notes / Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Weekly float replenishment from branch bank account"
                    value={topUpNotes}
                    onChange={(e) => setTopUpNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                {/* Calculation preview */}
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span>Current Drawer Balance:</span>
                    <span>{currency} {currentBalance.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700 font-semibold">
                    <span>+ Deposit to Load:</span>
                    <span>+{currency} {numTopUpAmount.toLocaleString()}</span>
                  </div>
                  <div className="pt-1.5 border-t border-emerald-200/80 flex items-center justify-between font-bold text-slate-900 text-sm">
                    <span>New Float Balance:</span>
                    <span className="text-emerald-800">{currency} {projectedBalance.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsTopUpOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || numTopUpAmount <= 0}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                    Confirm & Load Float
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Disburse Voucher Modal */}
      <AnimatePresence>
        {isDisburseOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Issue Petty Cash Voucher</h4>
                    <p className="text-xs text-slate-400">Float Available: {currency} {currentBalance.toLocaleString()}</p>
                  </div>
                </div>
                <button onClick={() => setIsDisburseOpen(false)} className="p-2 text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleDisburseSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Purpose / Description <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Staff Tea & Milk, Courier Transport, Office Lightbulb"
                    value={disbursePurpose}
                    onChange={(e) => setDisbursePurpose(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Amount ({currency}) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="0.00"
                      value={disburseAmount}
                      onChange={(e) => setDisburseAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Recipient / Paid To
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John (Rider)"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Category
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Receipt / Ticket Ref #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Supermarket slip #, Fuel receipt #"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsDisburseOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-600/20"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Disburse Cash
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
