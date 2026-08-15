import React, { useState } from 'react';
import { 
  FolderPlus, Plus, Edit3, Trash2, Tag, 
  CheckCircle2, AlertCircle, ShieldCheck, X, Loader2 
} from 'lucide-react';
import { ExpenseCategory } from '../../../../types';
import { db } from '../../../../lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { cn } from '../../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ExpenseCategoriesViewProps {
  categories: ExpenseCategory[];
  companyId: string;
  currency: string;
}

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'
];

export function ExpenseCategoriesView({
  categories,
  companyId,
  currency
}: ExpenseCategoriesViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [isTaxDeductible, setIsTaxDeductible] = useState(true);
  const [monthlyBudgetLimit, setMonthlyBudgetLimit] = useState('');

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setName('');
    setCode(`EXP-${String(categories.length + 1).padStart(3, '0')}`);
    setDescription('');
    setColor(PRESET_COLORS[categories.length % PRESET_COLORS.length]);
    setIsTaxDeductible(true);
    setMonthlyBudgetLimit('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: ExpenseCategory) => {
    setEditingCategory(cat);
    setName(cat.name);
    setCode(cat.code);
    setDescription(cat.description || '');
    setColor(cat.color || '#3B82F6');
    setIsTaxDeductible(cat.isTaxDeductible !== false);
    setMonthlyBudgetLimit(cat.monthlyBudgetLimit ? cat.monthlyBudgetLimit.toString() : '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !name.trim()) return;

    setSaving(true);
    const parsedLimit = monthlyBudgetLimit ? parseFloat(monthlyBudgetLimit) : undefined;

    try {
      if (editingCategory) {
        const docRef = doc(db, `companies/${companyId}/expense_categories`, editingCategory.id);
        await updateDoc(docRef, {
          name: name.trim(),
          code: code.trim(),
          description: description.trim() || undefined,
          color,
          isTaxDeductible,
          monthlyBudgetLimit: parsedLimit
        });
      } else {
        const id = `cat_${Date.now()}`;
        const newCat: ExpenseCategory = {
          id,
          name: name.trim(),
          code: code.trim() || `EXP-${String(categories.length + 1).padStart(3, '0')}`,
          description: description.trim() || undefined,
          color,
          isTaxDeductible,
          monthlyBudgetLimit: parsedLimit,
          createdAt: new Date().toISOString()
        };
        const docRef = doc(db, `companies/${companyId}/expense_categories`, id);
        await setDoc(docRef, newCat);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save category:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!companyId) return;
    if (confirm(`Are you sure you want to remove the category "${catName}"?`)) {
      try {
        const docRef = doc(db, `companies/${companyId}/expense_categories`, id);
        await deleteDoc(docRef);
      } catch (err) {
        console.error('Failed to delete category:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
              General Ledger & Tax Mapping
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Classification System
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Expense Categories & Chart of Accounts
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Organize operational overhead into structured GL codes and establish tax deductibility rules
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 self-start md:self-auto flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-200 transition-all group"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-4 h-4 rounded-full shadow-2xs"
                    style={{ backgroundColor: cat.color || '#3B82F6' }}
                  />
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {cat.code}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenEditModal(cat)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id, cat.name)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h4 className="text-base font-bold text-slate-900 mt-2 tracking-tight">
                {cat.name}
              </h4>
              {cat.description && (
                <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                  {cat.description}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                cat.isTaxDeductible !== false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
              )}>
                {cat.isTaxDeductible !== false ? 'Tax Deductible' : 'Non-Deductible'}
              </span>

              {cat.monthlyBudgetLimit ? (
                <span className="text-[11px] font-bold text-slate-700">
                  Cap: {currency} {cat.monthlyBudgetLimit.toLocaleString()}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">No Limit Set</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Category Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-900">
                  {editingCategory ? 'Edit Category' : 'Create Expense Category'}
                </h4>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Office Rent, Fuel & Transport, Marketing & Ads"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      GL Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. EXP-001"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Monthly Cap ({currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Optional limit"
                      value={monthlyBudgetLimit}
                      onChange={(e) => setMonthlyBudgetLimit(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={cn(
                          "w-7 h-7 rounded-full transition-transform",
                          color === c ? "scale-125 ring-2 ring-blue-500 ring-offset-2" : "hover:scale-110"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Brief guidance for staff recording expenses"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <input
                    type="checkbox"
                    id="isTaxDeductible"
                    checked={isTaxDeductible}
                    onChange={(e) => setIsTaxDeductible(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300"
                  />
                  <label htmlFor="isTaxDeductible" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Tax Deductible (Allowable business P&L deduction)
                  </label>
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
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Category'}
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
