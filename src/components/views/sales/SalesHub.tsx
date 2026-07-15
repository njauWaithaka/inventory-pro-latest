import React, { useState, useEffect } from 'react';
import { 
  FileText, Receipt, Clock, BarChart3, 
  ChevronRight, ArrowRightLeft, TrendingUp,
  Percent, DollarSign, MousePointerClick
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ViewType } from '../../../types';
import { Quotations } from './Quotations';
import { Invoices } from './Invoices';
import { SalesAnalytics } from './SalesAnalytics';

type SalesTab = 'quotations' | 'invoices' | 'analytics';

export function SalesHub({ defaultView }: { defaultView?: ViewType }) {
  const [activeTab, setActiveTab] = useState<SalesTab>(
    defaultView === 'invoices' ? 'invoices' : 
    'quotations'
  );

  useEffect(() => {
    if (defaultView === 'invoices') setActiveTab('invoices');
    else if (defaultView === 'quotations') setActiveTab('quotations');
  }, [defaultView]);

  const tabs: { id: SalesTab; label: string; icon: any }[] = [
    { id: 'quotations', label: 'Quotations', icon: FileText },
    { id: 'invoices', label: 'Sales Invoices', icon: Receipt },
    { id: 'analytics', label: 'Sales Analytics', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm inline-flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === tab.id 
                ? "bg-[#0f172a] text-white shadow-lg shadow-slate-200" 
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            )}
          >
            <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-blue-400" : "")} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {activeTab === 'quotations' && <Quotations />}
        {activeTab === 'invoices' && <Invoices filterType="standard" />}
        {activeTab === 'analytics' && <SalesAnalytics />}
      </div>
    </div>
  );
}
