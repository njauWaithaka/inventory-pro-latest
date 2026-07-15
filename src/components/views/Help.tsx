import React from 'react';
import { 
  Search, Book, PlayCircle, MessageCircle, FileText, 
  ChevronRight, HelpCircle, ArrowRight, Play, ChevronDown,
  Mail, MessageSquare
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

const HELP_CARDS = [
  { id: 'docs', title: 'Documentation', description: 'Detailed guides', icon: Book, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'video', title: 'Video Tutorials', description: 'Step-by-step videos', icon: PlayCircle, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'chat', title: 'Live Chat', description: '24/7 support', icon: MessageCircle, color: 'text-cyan-500', bg: 'bg-cyan-50' },
  { id: 'release', title: 'Release Notes', description: 'Latest updates', icon: FileText, color: 'text-teal-500', bg: 'bg-teal-50' },
];

const VIDEOS = [
  { title: 'Getting Started with InventoryPro', duration: '5 min' },
  { title: 'Understanding ABC Analysis', duration: '8 min' },
  { title: 'Setting Up Reorder Points', duration: '6 min' },
  { title: 'Creating Purchase Orders', duration: '4 min' },
];

const FAQS = [
  { q: 'How do I add new inventory items?', a: 'To add new items, navigate to the Inventory view and click the "Add Item" button at the top right.' },
  { q: 'What is ABC Analysis?', a: 'ABC analysis is an inventory categorization technique that divides items into three categories (A, B, and C) based on their importance to the business.' },
  { q: 'How are reorder points calculated?', a: 'Reorder points are calculated based on your lead time, average daily usage, and safety stock levels.' },
  { q: 'Can I integrate with my existing ERP?', a: 'Yes, InventoryPro supports a wide range of ERP integrations via our robust API and pre-built connectors.' },
  { q: 'How do I generate reports?', a: 'Navigate to the Insights -> Reports section to generate custom operational reports in PDF or CSV formats.' },
];

export function Help() {
  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      {/* Search Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto py-8">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">How can we help?</h1>
        <p className="text-slate-500 font-medium tracking-wide">Search our knowledge base or browse topics below</p>
        <div className="relative mt-8 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search for help..." 
            className="w-full h-16 pl-14 pr-6 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-slate-900 font-medium"
          />
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {HELP_CARDS.map((card) => (
          <button 
            key={card.id} 
            className="group p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left"
          >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", card.bg, card.color)}>
              <card.icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">{card.description}</p>
          </button>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Video Tutorials */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Video Tutorials</h2>
            <button className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1.5 uppercase tracking-widest">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-50 p-2">
            {VIDEOS.map((video, i) => (
              <button key={i} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 rounded-xl transition-all group text-left">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500 shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 text-sm truncate">{video.title}</h4>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">{video.duration}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
              </button>
            ))}
          </div>
        </div>

        {/* FAQs */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Frequently Asked Questions</h2>
            <button className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1.5 uppercase tracking-widest">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {FAQS.map((faq, i) => (
              <div key={i} className="group">
                <button className="w-full p-6 flex items-center gap-4 hover:bg-slate-50 transition-all text-left">
                  <div className="w-6 h-6 flex items-center justify-center text-emerald-500 shrink-0">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <span className="flex-1 font-bold text-slate-900 text-sm leading-tight">{faq.q}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-hover:text-slate-600" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Still Need Help */}
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm max-w-5xl mx-auto">
        <h2 className="text-2xl font-extrabold text-slate-900">Still need help?</h2>
        <p className="text-slate-500 font-medium mt-2">Our support team is available 24/7 to assist you</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <button className="w-full sm:w-auto px-8 h-12 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-slate-800 transition-all">
            <MessageSquare className="w-4 h-4" />
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
