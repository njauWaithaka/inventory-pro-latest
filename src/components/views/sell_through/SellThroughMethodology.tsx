import React, { useState } from 'react';
import { 
  Info, ChevronDown, ChevronUp, CheckCircle, 
  HelpCircle, BookOpen, Clock, ShieldCheck, Database
} from 'lucide-react';
import { cn } from '../../../lib/utils';

export function SellThroughMethodology() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900">
              Methodology, Formulas & Governance Standards
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Transparent mathematical formulas, exclusion rules, and data refresh cadence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-600 hidden sm:inline">
            {isOpen ? 'Collapse Details' : 'View Definitions'}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-5 pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 bg-slate-50/50">
          
          {/* Formula 1: Sell-Through Rate */}
          <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
              <span>Sell-Through Rate (STR) Formula</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg font-mono text-[11px] text-blue-700 border border-slate-200">
              STR (%) = (Units Sold ÷ (Beginning Stock + Units Received)) × 100
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Measures the speed at which incoming merchandise turns into realized customer revenue within the active selling period.
            </p>
          </div>

          {/* Formula 2: Fill Rate */}
          <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
              <span>Fill Rate SLA Formula</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg font-mono text-[11px] text-emerald-700 border border-slate-200">
              Fill Rate (%) = (Total Units Shipped ÷ Total Units Demanded) × 100
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Represents the exact percentage of customer orders fulfilled and shipped immediately from on-hand stock without backorders.
            </p>
          </div>

          {/* Governance & Exclusion Rules */}
          <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" />
              <span>Exclusion & Cadence Logic</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-500">
              <li>• <strong>In-Transit Stock:</strong> Excluded from Beginning Stock until GRN is stamped.</li>
              <li>• <strong>Returns & Cancellations:</strong> Deducted from Net Units Sold.</li>
              <li>• <strong>Refresh Cadence:</strong> Calculated continuously from real-time database feeds.</li>
            </ul>
          </div>

        </div>
      )}

    </div>
  );
}
