import React, { useState, useMemo } from 'react';
import { 
  Search, Book, PlayCircle, MessageCircle, FileText, 
  ChevronRight, HelpCircle, ArrowRight, Play, ChevronDown,
  Mail, MessageSquare, X, CheckCircle2, ExternalLink, Sparkles,
  Phone, Send, Clock
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const HELP_CARDS = [
  { id: 'docs', title: 'Documentation', description: 'Comprehensive guide to inventory management, POS, and sales workflows.', icon: Book, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'video', title: 'Video Tutorials', description: 'Step-by-step masterclasses on stock audits and analytics.', icon: PlayCircle, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'chat', title: 'Live AI Assistant', description: 'Ask questions directly to InventoryPro AI in real time.', icon: MessageCircle, color: 'text-cyan-500', bg: 'bg-cyan-50' },
  { id: 'release', title: 'Release Notes', description: 'What’s new in version 2.4: enhanced valuation and multi-currency support.', icon: FileText, color: 'text-teal-500', bg: 'bg-teal-50' },
];

const VIDEOS = [
  { 
    id: 'v1',
    title: 'Getting Started with InventoryPro', 
    duration: '5 min',
    category: 'Basics',
    summary: 'Learn how to navigate your main dashboard, configure currency preferences, and review stock telemetry in under 5 minutes.',
    steps: ['1. Profile & Company setup in Settings', '2. Adding initial product catalog via CSV or Manual Entry', '3. Configuring reorder thresholds']
  },
  { 
    id: 'v2',
    title: 'Understanding ABC Analysis & Stock Velocity', 
    duration: '8 min',
    category: 'Analytics',
    summary: 'A deep dive into Pareto distribution (80/20 rule), classifying high-revenue Category A assets versus slow-moving Category C stock.',
    steps: ['1. Calculating cumulative valuation', '2. Identifying golden high-margin SKUs', '3. Mitigating capital lockup in slow inventory']
  },
  { 
    id: 'v3',
    title: 'Setting Up Intelligent Reorder Points', 
    duration: '6 min',
    category: 'Procurement',
    summary: 'Automate stock replenishment using dynamic lead-time buffers and daily consumption velocity metrics.',
    steps: ['1. Lead time calculation from past Purchase Orders', '2. Safety stock multiplier configuration', '3. One-click Purchase Order generation']
  },
  { 
    id: 'v4',
    title: 'Creating Purchase Orders & GRN Receiving', 
    duration: '4 min',
    category: 'Operations',
    summary: 'End-to-end walkthrough of supplier PO dispatch, delivery inspection, and automated stock count updates.',
    steps: ['1. Drafting PO with supplier quotation lines', '2. Recording Goods Received Note (GRN)', '3. Handling partial dispatches and damaged units']
  },
];

const FAQS = [
  { 
    id: 'f1',
    q: 'How do I add new inventory items?', 
    a: 'Navigate to the Inventory module from the sidebar and click the "Add Product" button at the top right. You can fill in the SKU, name, buying price, selling price, reorder level, and shelf-life batch details, or use the "Import CSV" tool for bulk additions.' 
  },
  { 
    id: 'f2',
    q: 'What is ABC Analysis and how does it help my business?', 
    a: 'ABC analysis categorizes your items by total annual value: Class A represents the top 70-80% of value with tightest control; Class B represents moderate value (~15%); Class C accounts for low value (~5%). This ensures you never run out of your most profitable items.' 
  },
  { 
    id: 'f3',
    q: 'How are reorder points and safety stock calculated?', 
    a: 'Reorder Point (ROP) = (Average Daily Sales × Supplier Lead Time in Days) + Safety Stock. The system dynamically evaluates your sales velocity over the last 30 to 90 days to recommend precise replenishment quantities.' 
  },
  { 
    id: 'f4',
    q: 'Can I export reports and financial statements?', 
    a: 'Yes! Navigate to Insights → Reports or Analytics to export clean CSV, JSON, or printable PDF summaries for stock turnover, valuation, profit margins, and sales tax.' 
  },
  { 
    id: 'f5',
    q: 'How do Stock Holds and Reservations work?', 
    a: 'When an order or quotation is pending confirmation, stock can be reserved to prevent double-selling across multiple branches or POS registers without prematurely deducting physical inventory.' 
  },
];

interface HelpProps {
  onNavigate?: (view: string) => void;
}

export function Help({ onNavigate }: HelpProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<typeof VIDEOS[0] | null>(null);
  const [selectedDocModal, setSelectedDocModal] = useState<string | null>(null);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState({ name: '', email: '', message: '', topic: 'General' });
  const [supportSent, setSupportSent] = useState(false);

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQS;
    const q = searchQuery.toLowerCase();
    return FAQS.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [searchQuery]);

  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return VIDEOS;
    const q = searchQuery.toLowerCase();
    return VIDEOS.filter(v => v.title.toLowerCase().includes(q) || v.summary.toLowerCase().includes(q));
  }, [searchQuery]);

  const handleCardClick = (id: string) => {
    if (id === 'chat') {
      if (onNavigate) {
        onNavigate('inventory_pro_chat');
      } else {
        setSelectedDocModal('chat');
      }
    } else {
      setSelectedDocModal(id);
    }
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSupportSent(true);
    setTimeout(() => {
      setSupportSent(false);
      setIsSupportOpen(false);
      setSupportMessage({ name: '', email: '', message: '', topic: 'General' });
    }, 2000);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      {/* Search Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto py-8">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">How can we help?</h1>
        <p className="text-slate-500 font-medium tracking-wide">Search our knowledge base, tutorials, and operational guides below</p>
        <div className="relative mt-8 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search topics, questions, or guides..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-14 pl-14 pr-10 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-900 font-medium"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Top Quick-Access Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {HELP_CARDS.map((card) => (
          <button 
            key={card.id} 
            onClick={() => handleCardClick(card.id)}
            className="group p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left cursor-pointer active:scale-98"
          >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", card.bg, card.color)}>
              <card.icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{card.title}</h3>
            <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-2">{card.description}</p>
          </button>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Video Tutorials */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Video Tutorials</h2>
              <p className="text-xs text-slate-400 font-medium">Interactive training modules</p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
              {filteredVideos.length} Available
            </span>
          </div>
          <div className="divide-y divide-slate-50 p-2">
            {filteredVideos.map((video) => (
              <button 
                key={video.id} 
                onClick={() => setSelectedVideo(video)}
                className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 rounded-xl transition-all group text-left cursor-pointer"
              >
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500 shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-emerald-700 transition-colors">{video.title}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{video.category}</span>
                    <span className="text-xs font-medium text-slate-400">• {video.duration}</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all shrink-0" />
              </button>
            ))}
            {filteredVideos.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">
                No video tutorials matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>

        {/* FAQs Accordion */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Frequently Asked Questions</h2>
              <p className="text-xs text-slate-400 font-medium">Quick answers to common queries</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
              {filteredFaqs.length} Q&As
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredFaqs.map((faq) => {
              const isExpanded = expandedFaq === faq.id;
              return (
                <div key={faq.id} className="transition-colors">
                  <button 
                    onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                    className="w-full p-5 flex items-center gap-4 hover:bg-slate-50 transition-all text-left cursor-pointer"
                  >
                    <div className="w-6 h-6 flex items-center justify-center text-emerald-500 shrink-0">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <span className="flex-1 font-bold text-slate-900 text-sm leading-snug">{faq.q}</span>
                    <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0", isExpanded && "rotate-180 text-emerald-600")} />
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-5 pb-5 pl-14 text-xs font-medium text-slate-600 leading-relaxed overflow-hidden"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {filteredFaqs.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">
                No questions found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Still Need Help Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 text-center shadow-sm max-w-4xl mx-auto">
        <h2 className="text-2xl font-black text-slate-900">Still have questions?</h2>
        <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto text-sm">Our technical and inventory consulting desk is ready to assist your operations.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
          <button 
            onClick={() => setIsSupportOpen(true)}
            className="w-full sm:w-auto px-8 h-12 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-3 hover:bg-slate-800 transition-all cursor-pointer shadow-md"
          >
            <MessageSquare className="w-4 h-4" />
            Submit Support Request
          </button>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('inventory_pro_chat')}
              className="w-full sm:w-auto px-6 h-12 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-blue-100 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              Chat with AI Assistant
            </button>
          )}
        </div>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-left"
            >
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500 rounded-lg text-white">
                    <Play className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{selectedVideo.title}</h3>
                    <p className="text-[10px] text-slate-400">{selectedVideo.category} • Duration: {selectedVideo.duration}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedVideo(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Simulated Video Player Stage */}
              <div className="bg-slate-950 aspect-video flex flex-col items-center justify-center relative group p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform cursor-pointer">
                  <Play className="w-6 h-6 fill-current translate-x-0.5" />
                </div>
                <p className="text-white/80 text-xs font-semibold mt-4">Interactive Tutorial Simulation</p>
                <p className="text-white/50 text-[11px] max-w-md mt-1">{selectedVideo.summary}</p>
              </div>

              <div className="p-6 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Key Takeaways & Workflow Steps</h4>
                <div className="space-y-2">
                  {selectedVideo.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button 
                    onClick={() => setSelectedVideo(null)}
                    className="px-5 h-10 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Done Watching
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Docs / Release Notes Modal */}
      <AnimatePresence>
        {selectedDocModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-left"
            >
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Book className="w-5 h-5 text-slate-700" />
                  <h3 className="font-black text-slate-900 text-base">
                    {selectedDocModal === 'docs' ? 'InventoryPro Documentation' : selectedDocModal === 'release' ? 'Release Notes v2.4' : 'Support Desk'}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedDocModal(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 text-xs font-medium text-slate-600 max-h-[60vh] overflow-y-auto">
                {selectedDocModal === 'docs' ? (
                  <>
                    <h4 className="font-bold text-slate-900 text-sm">System Overview</h4>
                    <p>InventoryPro integrates Point of Sale (POS), Procurement Purchase Orders, Goods Received Notes (GRN), and Warehouse Stock Controls into a unified real-time ledger.</p>
                    <h4 className="font-bold text-slate-900 text-sm pt-2">Data Persistence</h4>
                    <p>All transactions are committed with multi-role security directly to Google Cloud Firestore with real-time replication.</p>
                    <h4 className="font-bold text-slate-900 text-sm pt-2">Stock Valuation Engine</h4>
                    <p>Valuation uses Weighted Average Costing (WAC) and provides instantaneous margin telemetry against FIFO batch receipts.</p>
                  </>
                ) : (
                  <>
                    <h4 className="font-bold text-slate-900 text-sm">What's New in v2.4</h4>
                    <ul className="list-disc pl-5 space-y-1.5">
                      <li>Enhanced Multi-Model Gemini Failover routing on server API endpoints.</li>
                      <li>Streamlined Demand Intelligence view removing redundant branch parameters.</li>
                      <li>Interactive Stock Holds & Reservation ledger across branches.</li>
                      <li>Full bulk export capabilities in CSV and printable PDF formats.</li>
                    </ul>
                  </>
                )}
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button 
                  onClick={() => setSelectedDocModal(null)}
                  className="px-5 h-10 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Support Request Dialog */}
      <AnimatePresence>
        {isSupportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-left"
            >
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm">Contact Support & Engineering</h3>
                </div>
                <button 
                  onClick={() => setIsSupportOpen(false)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {supportSent ? (
                <div className="p-8 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                  <h3 className="text-lg font-bold text-slate-900">Message Received!</h3>
                  <p className="text-xs text-slate-500">Our support desk will respond to your inquiry shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleSupportSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Your Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. John Doe"
                      value={supportMessage.name}
                      onChange={e => setSupportMessage({ ...supportMessage, name: e.target.value })}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Work Email</label>
                    <input 
                      type="email" 
                      required
                      placeholder="john@company.com"
                      value={supportMessage.email}
                      onChange={e => setSupportMessage({ ...supportMessage, email: e.target.value })}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Inquiry Topic</label>
                    <select 
                      value={supportMessage.topic}
                      onChange={e => setSupportMessage({ ...supportMessage, topic: e.target.value })}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-slate-400"
                    >
                      <option value="General">General Inquiry</option>
                      <option value="Billing">Billing & Plan</option>
                      <option value="Technical">Technical & Integration</option>
                      <option value="Data">Data & Stock Audit Issue</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Message</label>
                    <textarea 
                      required
                      rows={4}
                      placeholder="Describe how we can assist you..."
                      value={supportMessage.message}
                      onChange={e => setSupportMessage({ ...supportMessage, message: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsSupportOpen(false)}
                      className="px-4 h-10 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-5 h-10 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Message
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
