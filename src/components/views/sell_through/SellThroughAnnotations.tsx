import React, { useState } from 'react';
import { 
  MessageSquare, CheckSquare, Plus, Trash2, 
  Printer, CheckCircle2, User, Calendar, 
  Send, AlertCircle, Sparkles
} from 'lucide-react';
import { ActionCollaborationItem } from '../../../lib/sellThroughService';
import { cn } from '../../../lib/utils';

export function SellThroughAnnotations() {
  const [buyerComment, setBuyerComment] = useState(
    'Q3 Sell-through in Outerwear accelerated +8% after seasonal promotional campaign. Stagnant footwear SKUs in South DC need a 15% markdown push before next delivery intake.'
  );
  const [savedMessage, setSavedMessage] = useState(false);

  const [actionItems, setActionItems] = useState<ActionCollaborationItem[]>([
    {
      id: 'act-1',
      title: 'Transfer 150 surplus units of Slow-Moving Footwear to Downtown Outlet',
      assignee: 'Logistics Lead',
      dueDate: 'This Friday',
      completed: false,
      priority: 'high',
      type: 'transfer'
    },
    {
      id: 'act-2',
      title: 'Issue 15% weekend flash discount for Bottom 10 Apparel SKUs',
      assignee: 'E-commerce Merchandiser',
      dueDate: 'Next Monday',
      completed: true,
      priority: 'medium',
      type: 'markdown'
    },
    {
      id: 'act-3',
      title: 'Expedite Purchase Order PO-1082 for top 3 fast-moving Electronics',
      assignee: 'Procurement Buyer',
      dueDate: 'Immediate',
      completed: false,
      priority: 'high',
      type: 'reorder'
    }
  ]);

  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('Merchandise Planner');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');

  const handleAddAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: ActionCollaborationItem = {
      id: `act-${Date.now()}`,
      title: newTitle.trim(),
      assignee: newAssignee,
      dueDate: 'In 3 Days',
      completed: false,
      priority: newPriority,
      type: 'markdown'
    };

    setActionItems([newItem, ...actionItems]);
    setNewTitle('');
  };

  const handleToggle = (id: string) => {
    setActionItems(actionItems.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const handleDelete = (id: string) => {
    setActionItems(actionItems.filter(item => item.id !== id));
  };

  const handleSaveNotes = () => {
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              The Annotation & Action Planning Layer
            </h3>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            Log qualitative merchandising context, assign cross-functional tasks, and export executive meeting notes
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-all"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print / Save PDF Report</span>
        </button>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Merchandise Buyer Notes & Qualitative Context */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Buyer Commentary & Outlier Explanations
            </label>
            <span className="text-[10px] text-slate-400 font-semibold">Saved to Period Record</span>
          </div>

          <textarea
            rows={5}
            value={buyerComment}
            onChange={(e) => setBuyerComment(e.target.value)}
            placeholder="Explain sales spikes, supplier delivery bottlenecks, unseasonal weather shifts, or markdown proposals..."
            className="w-full p-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed text-slate-800"
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {savedMessage ? <span className="text-emerald-600 font-bold">✓ Notes synced to audit log</span> : 'Audited by Merchandising Committee'}
            </span>
            <button
              type="button"
              onClick={handleSaveNotes}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Save Commentary
            </button>
          </div>
        </div>

        {/* Right Column: Interactive Action Items Checklist */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
              Collaborative Action Items ({actionItems.filter(i => !i.completed).length} pending)
            </span>
            <span className="text-[10px] font-bold text-slate-400">Owner & Due Date</span>
          </div>

          {/* Quick Add Form */}
          <form onSubmit={handleAddAction} className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Schedule markdown for slow coats..."
              className="flex-1 h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as any)}
              className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              type="submit"
              className="h-9 px-3 bg-[#0f172a] hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          {/* Action List */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {actionItems.map((item) => (
              <div 
                key={item.id}
                className={cn(
                  "p-3 rounded-xl border flex items-start justify-between gap-3 text-xs transition-all",
                  item.completed ? "bg-slate-50/60 border-slate-200/60 opacity-60" : "bg-white border-slate-200 shadow-2xs"
                )}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => handleToggle(item.id)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <p className={cn("font-bold text-slate-800", item.completed && "line-through text-slate-400")}>
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold mt-0.5">
                      <span>Assigned: {item.assignee}</span>
                      <span>•</span>
                      <span>Due: {item.dueDate}</span>
                      <span>•</span>
                      <span className={cn(
                        "font-black uppercase",
                        item.priority === 'high' ? "text-rose-600" : item.priority === 'medium' ? "text-amber-600" : "text-slate-400"
                      )}>
                        {item.priority} priority
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="text-slate-300 hover:text-rose-600 p-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
