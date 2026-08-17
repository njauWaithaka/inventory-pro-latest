import React, { useState } from 'react';
import { 
  X, DollarSign, Calendar, Tag, Building2, 
  CreditCard, FileText, CheckCircle2, AlertCircle, 
  Upload, Receipt, Loader2, Sparkles 
} from 'lucide-react';
import { 
  Expense, ExpenseCategory, ExpensePaymentMethod, 
  ExpenseDepartment, ExpenseStatus 
} from '../../../../types';
import { addExpense, updateExpense } from '../../../../lib/expenseService';
import { cn } from '../../../../lib/utils';
import { useAuth } from '../../../../contexts/AuthContext';
import { useSettings } from '../../../../contexts/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
  companyId: string;
  currency: string;
  editExpense?: Expense | null;
  initialExpense?: Expense | null;
  onSaved?: (expenseId: string) => void;
}

const DEPARTMENTS: ExpenseDepartment[] = [
  'Operations',
  'Sales & Marketing',
  'Administration',
  'Logistics',
  'IT & Software',
  'Finance & Legal',
  'General'
];

const PAYMENT_METHODS: ExpensePaymentMethod[] = [
  'Cash',
  'Bank Transfer',
  'M-Pesa',
  'Credit Card',
  'Petty Cash',
  'Cheque'
];

export function RecordExpenseModal({
  isOpen,
  onClose,
  categories,
  companyId,
  currency,
  editExpense,
  initialExpense,
  onSaved
}: RecordExpenseModalProps) {
  const currentEditExpense = editExpense || initialExpense;
  const { user } = useAuth();
  const { profile } = useSettings();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState(currentEditExpense?.title || '');
  const [categoryId, setCategoryId] = useState(currentEditExpense?.categoryId || categories[0]?.id || '');
  const [amount, setAmount] = useState(currentEditExpense?.amount ? currentEditExpense.amount.toString() : '');
  const [taxDeductible, setTaxDeductible] = useState(currentEditExpense?.taxDeductible ?? true);
  const [taxAmount, setTaxAmount] = useState(currentEditExpense?.taxAmount ? currentEditExpense.taxAmount.toString() : '');
  const [vendorName, setVendorName] = useState(currentEditExpense?.vendorName || '');
  const [date, setDate] = useState(currentEditExpense?.date || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(currentEditExpense?.dueDate || '');
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>(currentEditExpense?.paymentMethod || 'M-Pesa');
  const [department, setDepartment] = useState<ExpenseDepartment>(currentEditExpense?.department || 'Operations');
  const [status, setStatus] = useState<ExpenseStatus>(currentEditExpense?.status || 'PAID');
  const [reference, setReference] = useState(currentEditExpense?.reference || '');
  const [notes, setNotes] = useState(editExpense?.notes || '');
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);

  React.useEffect(() => {
    if (editExpense) {
      setTitle(editExpense.title);
      setCategoryId(editExpense.categoryId);
      setAmount(editExpense.amount.toString());
      setTaxDeductible(editExpense.taxDeductible ?? true);
      setTaxAmount(editExpense.taxAmount ? editExpense.taxAmount.toString() : '');
      setVendorName(editExpense.vendorName || '');
      setDate(editExpense.date);
      setDueDate(editExpense.dueDate || '');
      setPaymentMethod(editExpense.paymentMethod);
      setDepartment(editExpense.department);
      setStatus(editExpense.status);
      setReference(editExpense.reference || '');
      setNotes(editExpense.notes || '');
    } else {
      setTitle('');
      setCategoryId(categories[0]?.id || '');
      setAmount('');
      setTaxDeductible(true);
      setTaxAmount('');
      setVendorName('');
      setDate(new Date().toISOString().split('T')[0]);
      setDueDate('');
      setPaymentMethod('M-Pesa');
      setDepartment('Operations');
      setStatus('PAID');
      setReference('');
      setNotes('');
      setReceiptFileName(null);
    }
  }, [editExpense, categories, isOpen]);

  // Auto compute standard 16% VAT estimation if toggled
  const handleAutoEstimateVAT = () => {
    const parsedAmount = parseFloat(amount);
    if (!isNaN(parsedAmount) && parsedAmount > 0) {
      const estimatedVat = Math.round((parsedAmount * 16) / 116);
      setTaxAmount(estimatedVat.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    setError(null);
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid expense amount greater than 0.');
      return;
    }

    if (!title.trim()) {
      setError('Please enter an expense title/description.');
      return;
    }

    const selectedCategory = categories.find(c => c.id === categoryId);
    const categoryName = selectedCategory ? selectedCategory.name : 'General Expense';

    setSubmitting(true);

    try {
      if (editExpense) {
        await updateExpense(companyId, editExpense.id, {
          title: title.trim(),
          categoryId,
          categoryName,
          amount: parsedAmount,
          taxAmount: taxAmount ? parseFloat(taxAmount) : 0,
          taxDeductible,
          vendorName: vendorName.trim() || undefined,
          date,
          dueDate: dueDate || undefined,
          paymentMethod,
          department,
          status,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined
        });
        if (onSaved) onSaved(editExpense.id);
      } else {
        const expenseNumber = `EXP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
        const newId = await addExpense(companyId, {
          expenseNumber,
          title: title.trim(),
          categoryId,
          categoryName,
          amount: parsedAmount,
          taxAmount: taxAmount ? parseFloat(taxAmount) : 0,
          taxDeductible,
          vendorName: vendorName.trim() || undefined,
          date,
          dueDate: dueDate || undefined,
          paymentMethod,
          department,
          status,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          createdByName: profile?.name || user?.displayName || 'User',
          createdBy: user?.uid,
          paidAt: status === 'PAID' ? new Date().toISOString() : undefined
        });
        if (onSaved) onSaved(newId);
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to save expense:', err);
      setError(err?.message || 'Failed to save expense record.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8"
        >
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  {editExpense ? 'Edit Expense Record' : 'Record Business Expense'}
                </h3>
                <p className="text-xs text-slate-300">
                  {editExpense ? editExpense.expenseNumber : 'Log operational spend, vendor bill, or petty cash disbursement'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Title & Amount Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Expense Title / Purpose <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Monthly Warehouse Rent, Generator Diesel Fuel, Meta Ads"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Amount ({currency}) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                    {currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Category & Department */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Expense Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as ExpenseDepartment)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Payment Method & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
                {paymentMethod === 'Petty Cash' && (
                  <p className="text-[11px] text-amber-600 font-medium mt-1">
                    ⚡ Will automatically record a disbursement in Petty Cash ledger upon payment.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Expense Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="PAID">Paid (Settled)</option>
                  <option value="PAYABLE">Payable (Unpaid Bill / Invoice)</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="APPROVED">Approved (Ready for Payment)</option>
                </select>
              </div>
            </div>

            {/* Vendor & Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Vendor / Supplier / Payee
                </label>
                <input
                  type="text"
                  placeholder="e.g., Safaricom, Landlord Ltd"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Expense Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Due Date (For Payables)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Reference & Tax */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Invoice / Receipt Reference #
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-9902 or MPESA Ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Tax / VAT Amount ({currency})
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoEstimateVAT}
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    Auto 16%
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2 cursor-pointer pt-3">
                  <input
                    type="checkbox"
                    checked={taxDeductible}
                    onChange={(e) => setTaxDeductible(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Tax Deductible Expense
                  </span>
                </label>
                <span className="text-[10px] text-slate-500 pl-6">
                  Included in official P&L allowable deductions
                </span>
              </div>
            </div>

            {/* Notes & Receipt Attachment Simulation */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Audit Notes & Description
              </label>
              <textarea
                rows={2}
                placeholder="Optional notes, breakdown of items, or approval rationale..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            {/* Receipt Upload Mock */}
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl text-center hover:border-blue-400 transition-colors">
              <label className="cursor-pointer flex flex-col items-center justify-center gap-1.5">
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-xs font-bold text-slate-700">
                  {receiptFileName ? `Attached: ${receiptFileName}` : 'Attach Scanned Receipt / Invoice Voucher'}
                </span>
                <span className="text-[10px] text-slate-400">
                  Supports PNG, JPG, PDF up to 10MB
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setReceiptFileName(file.name);
                  }}
                />
              </label>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {editExpense ? 'Update Expense' : 'Save & Post Expense'}
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
