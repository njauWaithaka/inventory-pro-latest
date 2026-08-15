import React, { useState, useMemo } from 'react';
import { 
  Repeat, Plus, Play, Pause, Trash2, Edit3, 
  Calendar, CheckCircle2, DollarSign, Clock, 
  AlertCircle, Sparkles, Loader2, X 
} from 'lucide-react';
import { 
  RecurringExpense, ExpenseCategory, ExpensePaymentMethod, 
  ExpenseDepartment 
} from '../../../../types';
import { triggerRecurringExpense } from '../../../../lib/expenseService';
import { db } from '../../../../lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { cn } from '../../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface RecurringExpensesViewProps {
  recurringExpenses: RecurringExpense[];
  categories: ExpenseCategory[];
  companyId: string;
  currency: string;
}

export function RecurringExpensesView({
  recurringExpenses,
  categories,
  companyId,
  currency
}: RecurringExpensesViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringExpense | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [frequency, setFrequency] = useState<'Weekly' | 'Bi-Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'>('Monthly');
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('Bank Transfer');
  const [department, setDepartment] = useState<ExpenseDepartment>('Operations');
  const [autoLog, setAutoLog] = useState(true);
  const [notes, setNotes] = useState('');

  // Total Monthly Commitment Calculation
  const monthlyCommitment = useMemo(() => {
    return recurringExpenses.reduce((sum, item) => {
      if (item.status !== 'ACTIVE') return sum;
      let monthlyVal = item.amount;
      if (item.frequency === 'Weekly') monthlyVal = item.amount * 4.33;
      else if (item.frequency === 'Bi-Weekly') monthlyVal = item.amount * 2.16;
      else if (item.frequency === 'Quarterly') monthlyVal = item.amount / 3;
      else if (item.frequency === 'Yearly') monthlyVal = item.amount / 12;
      return sum + monthlyVal;
    }, 0);
  }, [recurringExpenses]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setTitle('');
    setCategoryId(categories[0]?.id || '');
    setAmount('');
    setVendorName('');
    setFrequency('Monthly');
    setNextDueDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('Bank Transfer');
    setDepartment('Operations');
    setAutoLog(true);
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: RecurringExpense) => {
    setEditingItem(item);
    setTitle(item.title);
    setCategoryId(item.categoryId);
    setAmount(item.amount.toString());
    setVendorName(item.vendorName || '');
    setFrequency(item.frequency);
    setNextDueDate(item.nextDueDate);
    setPaymentMethod(item.paymentMethod);
    setDepartment(item.department);
    setAutoLog(item.autoLog);
    setNotes(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const catObj = categories.find(c => c.id === categoryId);
    const categoryName = catObj ? catObj.name : 'General';

    try {
      if (editingItem) {
        const docRef = doc(db, `companies/${companyId}/recurring_expenses`, editingItem.id);
        await updateDoc(docRef, {
          title: title.trim(),
          categoryId,
          categoryName,
          amount: parsedAmount,
          vendorName: vendorName.trim() || undefined,
          frequency,
          nextDueDate,
          paymentMethod,
          department,
          autoLog,
          notes: notes.trim() || undefined
        });
      } else {
        const id = `rec_${Date.now()}`;
        const newRec: RecurringExpense = {
          id,
          title: title.trim(),
          categoryId,
          categoryName,
          amount: parsedAmount,
          vendorName: vendorName.trim() || undefined,
          frequency,
          startDate: new Date().toISOString().split('T')[0],
          nextDueDate,
          autoLog,
          status: 'ACTIVE',
          paymentMethod,
          department,
          notes: notes.trim() || undefined,
          createdAt: new Date().toISOString()
        };
        const docRef = doc(db, `companies/${companyId}/recurring_expenses`, id);
        await setDoc(docRef, newRec);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save recurring expense:', err);
    }
  };

  const handleToggleStatus = async (item: RecurringExpense) => {
    if (!companyId) return;
    const newStatus = item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const docRef = doc(db, `companies/${companyId}/recurring_expenses`, item.id);
      await updateDoc(docRef, { status: newStatus });
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!companyId) return;
    if (confirm('Delete this recurring expense schedule?')) {
      try {
        const docRef = doc(db, `companies/${companyId}/recurring_expenses`, id);
        await deleteDoc(docRef);
      } catch (err) {
        console.error('Failed to delete recurring expense:', err);
      }
    }
  };

  const handleTriggerNow = async (item: RecurringExpense) => {
    if (!companyId) return;
    setTriggeringId(item.id);
    try {
      const expId = await triggerRecurringExpense(companyId, item);
      setSuccessMsg(`Logged new expense voucher for "${item.title}" successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to trigger recurring expense:', err);
    } finally {
      setTriggeringId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
              Subscriptions & Fixed Overhead
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Recurring Schedules
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Recurring Expenses
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Automate periodic commitments like rent, internet, SaaS licenses, salaries, and security retainers
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 self-start md:self-auto flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Recurring Schedule
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Monthly Commitment Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
            <Repeat className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
              Estimated Monthly Recurring Burn Rate
            </span>
            <h4 className="text-2xl font-black tracking-tight text-white mt-0.5">
              {currency} {Math.round(monthlyCommitment).toLocaleString()} <span className="text-xs font-normal text-slate-400">/ month</span>
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-300">
          <div>
            <span className="text-slate-400 block">Active Schedules</span>
            <strong className="text-white text-base">
              {recurringExpenses.filter(r => r.status === 'ACTIVE').length}
            </strong>
          </div>
          <div>
            <span className="text-slate-400 block">Paused</span>
            <strong className="text-white text-base">
              {recurringExpenses.filter(r => r.status === 'PAUSED').length}
            </strong>
          </div>
        </div>
      </div>

      {/* Recurring Schedules List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recurringExpenses.length === 0 ? (
          <div className="col-span-full py-16 bg-white rounded-3xl border border-slate-200 text-center text-slate-400 text-xs">
            No recurring expense schedules configured yet. Click "+ Add Recurring Schedule" to set up rent, utility, or subscription trackers.
          </div>
        ) : (
          recurringExpenses.map((item) => (
            <div
              key={item.id}
              className={cn(
                "bg-white p-5 rounded-3xl border transition-all flex flex-col justify-between shadow-xs",
                item.status === 'ACTIVE' ? "border-slate-200/90 hover:border-blue-300" : "border-slate-200/60 opacity-60 bg-slate-50/50"
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                    {item.frequency}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                    item.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"
                  )}>
                    {item.status}
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-900 tracking-tight line-clamp-1">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-400 font-medium">
                  {item.categoryName} • {item.department}
                </p>

                <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount:</span>
                    <span className="font-black text-slate-900">{currency} {item.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Next Due Date:</span>
                    <span className="font-bold text-blue-600">{item.nextDueDate}</span>
                  </div>
                  {item.vendorName && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Payee:</span>
                      <span className="font-medium text-slate-700 truncate max-w-[130px]">{item.vendorName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleTriggerNow(item)}
                  disabled={triggeringId === item.id || item.status !== 'ACTIVE'}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  title="Generate expense voucher now for this cycle"
                >
                  {triggeringId === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Log Cycle Now
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleStatus(item)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title={item.status === 'ACTIVE' ? 'Pause schedule' : 'Resume schedule'}
                  >
                    {item.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-600" />}
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="p-2 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    title="Edit schedule"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete schedule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-900">
                  {editingItem ? 'Edit Recurring Schedule' : 'New Recurring Expense Schedule'}
                </h4>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Schedule Name / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Warehouse Rent, Fiber Internet, Security Guard"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                      min="0"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Frequency
                    </label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                    >
                      <option value="Weekly">Weekly</option>
                      <option value="Bi-Weekly">Bi-Weekly (Fortnightly)</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
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
                      Next Due Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={nextDueDate}
                      onChange={(e) => setNextDueDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Payee / Vendor
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Landlord Ltd"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="M-Pesa">M-Pesa</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                  >
                    {editingItem ? 'Save Changes' : 'Create Schedule'}
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
