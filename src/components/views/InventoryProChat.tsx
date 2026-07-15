import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, Send, Sparkles, Check, AlertCircle, Loader2, ArrowRight, 
  RefreshCw, ClipboardList, Mail, BarChart3, ChevronRight, X
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useSettings } from "../../contexts/SettingsContext";
import { Product } from "../../types";
import { cn, getProductMovementSpeed } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: Date;
}

interface InventoryProChatProps {
  isFloating?: boolean;
  onClose?: () => void;
}

// Simple custom markdown renderer that covers list, table, header, and bold patterns with premium typography
function SmartMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];
  let tableRows: string[][] = [];
  let inTable = false;

  const renderTextWithStyles = (text: string) => {
    // Escape markdown links of type [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(text.slice(lastIndex, matchIndex));
      }
      const linkText = match[1];
      const linkUrl = match[2];
      parts.push(
        <a 
          key={matchIndex} 
          href={linkUrl} 
          target="_blank" 
          referrerPolicy="no-referrer"
          rel="noopener noreferrer" 
          className="text-[#38BDF8] hover:underline hover:text-sky-300 transition-colors font-medium"
        >
          {linkText}
        </a>
      );
      lastIndex = linkRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    const styledText = parts.length > 0 ? parts : [text];

    // Process bold (**word**)
    return styledText.map((part, index) => {
      if (typeof part !== 'string') return part;
      const boldParts = part.split(/\*\*([^*]+)\*\*/g);
      return boldParts.map((subPart, subIndex) => {
        if (subIndex % 2 === 1) {
          return <strong key={subIndex} className="font-bold text-white bg-white/5 px-1 py-0.5 rounded text-[12px]">{subPart}</strong>;
        }
        return subPart;
      });
    });
  };

  const flushList = (key: string | number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="list-disc pl-5 my-3.5 space-y-2 text-slate-200">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-[13px] leading-relaxed">
              {renderTextWithStyles(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  const flushTable = (key: string | number) => {
    if (tableRows.length > 0) {
      const validRows = tableRows.filter(row => !row.every(cell => cell.trim().startsWith('-') || cell.trim() === ''));
      if (validRows.length > 0) {
        elements.push(
          <div key={`table-${key}`} className="my-5 overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60 shadow-xl scrollbar-thin">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 font-semibold text-[#38BDF8]">
                  {validRows[0].map((cell, idx) => (
                    <th key={idx} className="px-3.5 py-2.5 font-medium tracking-wide">{cell.trim()}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {validRows.slice(1).map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-white/[0.02] transition-colors odd:bg-white/[0.01]">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-3.5 py-2.5 font-mono text-[11px] text-slate-200">{cell.trim()}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      tableRows = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const origLine = lines[i];
    const line = origLine.trim();

    // Table parsing
    if (line.startsWith("|")) {
      if (inList) flushList(i);
      inTable = true;
      const cells = line.split("|").slice(1, -1);
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable(i);
    }

    // Bullet list parsing
    if (line.startsWith("- ") || line.startsWith("* ")) {
      inList = true;
      listItems.push(line.substring(2));
      continue;
    } else if (inList) {
      flushList(i);
    }

    // Code blocks / dividers
    if (line.startsWith("```")) {
      let codeContent = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeContent.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={`code-${i}`} className="p-4 my-3 bg-black/50 border border-white/10 rounded-xl overflow-x-auto text-[11px] font-mono text-cyan-400 text-left shadow-inner">
          <code>{codeContent.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="text-sm font-bold text-white tracking-tight mt-5 mb-2.5 flex items-center gap-1.5 border-b border-white/5 pb-1">
          <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
          {renderTextWithStyles(line.substring(4))}
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="text-base font-bold text-sky-400 tracking-tight mt-5 mb-3 border-b border-white/10 pb-1.5">
          {renderTextWithStyles(line.substring(3))}
        </h3>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-white tracking-tight mt-6 mb-3.5">
          {renderTextWithStyles(line.substring(2))}
        </h2>
      );
      continue;
    }

    // Plain lines
    if (line === "") {
      elements.push(<div key={`space-${i}`} className="h-2.5" />);
    } else {
      elements.push(
        <p key={i} className="text-[13px] leading-relaxed text-slate-200 mb-2">
          {renderTextWithStyles(origLine)}
        </p>
      );
    }
  }

  if (inList) flushList("end");
  if (inTable) flushTable("end");

  return <div className="space-y-1.5">{elements}</div>;
}

const SUGGESTED_QUESTIONS = [
  {
    label: "Low Stock Analytics",
    text: "Analyze our current inventory and itemize any low stock warnings. Rank them by urgency.",
    icon: AlertCircle,
    color: "from-amber-500/15 to-amber-500/2 hover:from-amber-500/20"
  },
  {
    label: "Draft Supplier RFP Email",
    text: "Can you draft a highly polished restock RFP email template to send our top suppliers?",
    icon: Mail,
    color: "from-[#38BDF8]/15 to-[#38BDF8]/2 hover:from-sky-500/20"
  },
  {
    label: "Movement Speed Audit",
    text: "Analyze our current catalog and outline fast, moderate, and slow stock categories.",
    icon: BarChart3,
    color: "from-emerald-500/15 to-emerald-500/2 hover:from-emerald-500/20"
  },
  {
    label: "Optimize raw Material Reserves",
    text: "Suggest safety margins, reorder models, and buffers for our stock reserves.",
    icon: ClipboardList,
    color: "from-indigo-500/15 to-indigo-500/2 hover:from-indigo-500/20"
  }
];

export function InventoryProChat({ isFloating = false, onClose }: InventoryProChatProps) {
  const { profile, company } = useSettings();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "model",
      text: "Hello! I am **Inventory Pro**, your intelligent operations analyst for **Invenio**.\n\nI can assist you to:\n- Analyze low stock alarms and generate reorder limits.\n- Draft procurement RFPs and communications for active partners.\n- Examine item velocity speeds and propose optimizations.\n- Review raw materials, MRO consumables, and reserves.\n\nType your inquiry below or select an action blueprint in the panel!",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Real-time Database metrics
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliersCount, setSuppliersCount] = useState(0);
  const [customersCount, setCustomersCount] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);

  useEffect(() => {
    if (!profile?.companyId) return;

    const unsubProducts = onSnapshot(collection(db, `companies/${profile.companyId}/products`), (snap) => {
      const docs = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          ...data,
          id: d.id,
          movement: getProductMovementSpeed(data)
        };
      }) as Product[];
      setProducts(docs);
    });

    const unsubSuppliers = onSnapshot(collection(db, `companies/${profile.companyId}/suppliers`), (snap) => {
      setSuppliersCount(snap.size);
    });

    const unsubCustomers = onSnapshot(collection(db, `companies/${profile.companyId}/customers`), (snap) => {
      setCustomersCount(snap.size);
    });

    const unsubAlerts = onSnapshot(collection(db, `companies/${profile.companyId}/alerts`), (snap) => {
      setAlertsCount(snap.size);
    });

    return () => {
      unsubProducts();
      unsubSuppliers();
      unsubCustomers();
      unsubAlerts();
    };
  }, [profile?.companyId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setLoading(true);

    try {
      const lowStockItems = products
        .filter(p => (p.quantity ?? 0) <= (p.minStock ?? 5))
        .map(p => ({ sku: p.sku, name: p.name, qty: p.quantity, min: p.minStock, category: p.category }));

      const categoryDistribution = products.reduce((acc, p) => {
        acc[p.category] = (acc[p.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const movementSpeeds = products.reduce((acc, p) => {
        if (p.movement) acc[p.movement] = (acc[p.movement] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Compile first 35 catalog lines
      const detailedProductsSummary = products.slice(0, 35).map(p => {
        return `| ${p.sku} | ${p.name} | ${p.category} | Balance: ${p.quantity} | Velocity: ${p.movement || 'moderate'} | Value: ${p.value || 0} |`;
      }).join("\n");

      const dbContext = {
        company: company ? { name: company.name, currency: company.currency || "$" } : { name: "Invenio" },
        productsCount: products.length,
        suppliersCount,
        customersCount,
        lowStock: lowStockItems.slice(0, 15),
        alerts: { total: alertsCount },
        productionState: {
          categories: categoryDistribution,
          movements: movementSpeeds
        },
        detailedSummary: products.length > 0 
          ? `List of major assets:\n| SKU | Product Name | Category | Stock Balance | Movement Speed | Asset Value |\n|---|---|---|---|---|---|\n${detailedProductsSummary}`
          : "No assets seeded yet. Advise the user to seed sample data in Invenio Dashboard/Inventory view first."
      };

      const response = await fetch("/api/inventory-pro/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: messages.map(m => ({ role: m.role, text: m.text })),
          context: dbContext
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Communication error with Inventory Pro assistant.");
      }

      const botMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: "model",
        text: responseData.text,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);

    } catch (error: any) {
      console.error(error);
      const errorMessage: Message = {
        id: `msg-${Date.now() + 2}`,
        role: "model",
        text: `Error: ${error?.message || "I am currently unable to answer. Please verify Invenio's secrets are set correctly."}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage(inputValue);
    }
  };

  // Shared Central Chat Core Panel Component
  const chatCoreJSX = (
    <div className={cn(
      "flex flex-col bg-[#0B1120] text-slate-100 overflow-hidden relative min-h-[400px] h-full",
      !isFloating ? "flex-1 rounded-3xl border border-white/10 shadow-2xl h-full" : "h-full"
    )}>
      {/* Background soft ambient lights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 select-none">
        <div className="absolute top-10 right-20 w-96 h-96 rounded-full bg-blue-500/10 blur-[130px]" />
        <div className="absolute bottom-10 left-20 w-96 h-96 rounded-full bg-cyan-500/10 blur-[130px]" />
      </div>

      {/* Header Panel */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 bg-[#0F1626]/90 backdrop-blur-md border-b border-white/5 shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#38BDF8] to-[#1E3A8A] flex items-center justify-center shadow-lg shadow-blue-500/10 shrink-0">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight font-sans truncate">Inventory Pro AI</h2>
              <span className="px-2 py-0.5 text-[8.5px] bg-[#38BDF8]/15 text-[#38BDF8] font-bold rounded-full tracking-wider uppercase border border-[#38BDF8]/20 whitespace-nowrap">Assist Live</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">Autonomous context intelligence engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden xs:flex items-center gap-1.5 px-3 py-1 bg-white/[0.03] border border-white/5 rounded-lg text-[10px]">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-slate-400 font-mono">Catalog: {products.length} Items</span>
          </div>
          
          <button 
            onClick={() => setMessages([
              {
                id: "welcome",
                role: "model",
                text: "Hello! Message history has been cleared. What can I analyze for Invenio next?",
                timestamp: new Date()
              }
            ])}
            title="Clear Chat Room"
            className="p-2 bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer h-9 w-9 flex items-center justify-center border border-white/5 hover:border-white/10"
              title="Close Chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed Viewport */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <AnimatePresence initial={false}>
          {messages.map((m, idx) => (
            <React.Fragment key={m.id}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex gap-3 max-w-[88%] sm:max-w-[78%]",
                  m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 border text-[11px] font-bold select-none",
                  m.role === "user" 
                    ? "bg-[#102A5C] border-[#38BDF8]/30 text-[#38BDF8]" 
                    : "bg-[#1E293B] border-white/10 text-slate-300"
                )}>
                  {m.role === "user" ? "ME" : <Bot className="w-4 h-4 text-sky-450" />}
                </div>

                <div className={cn(
                  "py-3 px-4 sm:py-3.5 sm:px-5 rounded-2xl text-[13px] leading-relaxed shadow-lg select-text",
                  m.role === "user" 
                    ? "bg-[#1E293B] text-slate-100 border border-white/10 rounded-tr-none" 
                    : "bg-gradient-to-b from-[#131B2E] to-[#0F1422] text-slate-200 border border-white/5 rounded-tl-none"
                )}>
                  <SmartMarkdown content={m.text} />
                  <span className="block mt-2 text-[9px] text-slate-500 font-mono text-right select-none">
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>

              {/* If this is the welcome message and conversation hasn't expanded yet */}
              {idx === 0 && messages.length === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="w-full max-w-2xl mx-auto pt-2 pb-6 space-y-3.5"
                >
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2 px-1">Suggested Inquiries</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {SUGGESTED_QUESTIONS.map((q, qidx) => {
                      const IconComponent = q.icon;
                      return (
                        <button
                          key={qidx}
                          onClick={() => handleSendMessage(q.text)}
                          className={cn(
                            "group text-left p-4 rounded-2xl bg-gradient-to-b border border-white/5 hover:border-[#38BDF8]/40 transition-all cursor-pointer hover:shadow-xl active:scale-[0.99] flex flex-col justify-between min-h-[96px]",
                            q.color
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-white/5 text-[#38BDF8] shrink-0">
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="text-[13px] font-bold text-white group-hover:text-[#38BDF8] transition-colors">{q.label}</h4>
                              <p className="text-[11.5px] text-slate-350 leading-relaxed line-clamp-2 pr-1">{q.text}</p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </React.Fragment>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3"
            >
              <div className="w-8.5 h-8.5 rounded-xl bg-[#1E293B] border border-white/5 text-slate-400 flex items-center justify-center shrink-0 select-none">
                <Bot className="w-4 h-4 text-[#38BDF8] animate-pulse" />
              </div>
              <div className="px-4.5 py-3 bg-[#131B2E]/60 border border-white/5 rounded-2xl rounded-tl-none flex items-center gap-3 shadow-md">
                <Loader2 className="w-3.5 h-3.5 text-[#38BDF8] animate-spin" />
                <span className="text-[12px] text-slate-400 font-medium">Inventory Pro AI is evaluating database states...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Action / Input Tray */}
      <div className="relative z-10 px-4 sm:px-6 py-4.5 bg-[#0F1626]/95 border-t border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={loading ? "Analyzing database stats..." : "Ask Inventory Pro AI..."}
              disabled={loading}
              className="w-full h-12 pl-4 pr-12 bg-black/35 hover:bg-black/50 focus:bg-black/65 border border-white/10 hover:border-white/15 focus:border-[#38BDF8]/50 focus:outline-none rounded-2xl text-[13.5px] transition-all text-slate-100 shadow-inner placeholder:text-slate-500"
            />
          </div>
          <button
            onClick={() => handleSendMessage(inputValue)}
            disabled={!inputValue.trim() || loading}
            className="w-12 h-12 bg-gradient-to-tr from-[#38BDF8] to-[#1E3A8A] hover:from-[#4fcffd] hover:to-[#2248ab] disabled:opacity-30 disabled:cursor-not-allowed justify-center text-white transition-all rounded-2xl shadow-lg cursor-pointer flex items-center shrink-0 active:scale-95"
            title="Send query"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-500 mt-2.5 font-medium tracking-wide">
          Inventory Pro AI evaluates real-time catalogs, suppliers & alerts to draft accurate operational answers.
        </p>
      </div>
    </div>
  );

  // If floating is active, serve the compact frame
  if (isFloating) {
    return chatCoreJSX;
  }

  // Premium, Spacious Multi-pane Dashboard View
  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full lg:h-[calc(100vh-140px)] min-h-[640px] max-w-[1600px] mx-auto text-slate-100 font-sans">
      
      {/* 1. Primary Chat Console */}
      {chatCoreJSX}

      {/* 2. Intelligent Command Center Deck */}
      <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-5 h-full overflow-y-auto pr-1 no-scrollbar select-none">
        
        {/* Live Synergy Pulse Segment */}
        <div className="bg-[#111827]/80 backdrop-blur-md rounded-3xl p-5.5 border border-white/10 shadow-lg relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
          <h3 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Catalog Diagnostics
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/[0.02] p-3.5 rounded-2xl border border-white/5">
              <span className="text-[10px] text-slate-400 block font-medium">Active Assets</span>
              <span className="text-xl font-bold text-white font-mono mt-0.5 block">{products.length}</span>
            </div>
            <div className="bg-white/[0.02] p-3.5 rounded-2xl border border-white/5">
              <span className="text-[10px] text-slate-400 block font-medium">Locked Partners</span>
              <span className="text-xl font-bold text-sky-400 font-mono mt-0.5 block">{suppliersCount + customersCount}</span>
            </div>
          </div>

          {/* Speed ratios progression lists */}
          <div className="mt-4.5 pt-4 border-t border-white/5 space-y-3">
            <div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium mb-1.5">
                <span>Fast Velocity movement assets</span>
                <span className="text-emerald-400 font-bold">{products.filter(p => p.movement === 'fast').length} items</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${products.length ? (products.filter(p => p.movement === 'fast').length / products.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium mb-1.5">
                <span>Obsolete / Slow turn ratio</span>
                <span className="text-red-400 font-bold">{products.filter(p => p.movement === 'slow').length} items</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-red-500 to-amber-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${products.length ? (products.filter(p => p.movement === 'slow').length / products.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Low Stock Active Risk Center */}
        <div className="bg-[#111827]/80 backdrop-blur-md rounded-3xl p-5.5 border border-white/10 shadow-lg flex-1 min-h-[240px] flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Active Replenishment Warnings
            </h3>
            <span className="text-[10px] bg-red-500/10 text-red-400 font-extrabold px-2.5 py-0.5 rounded-full border border-red-500/20">
              {products.filter(p => (p.quantity ?? 0) <= (p.minStock ?? 5)).length} Critical
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto pr-1 flex-1 scrollbar-thin scrollbar-thumb-white/5 animate-none">
            {products.filter(p => (p.quantity ?? 0) <= (p.minStock ?? 5)).length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <Check className="w-9 h-9 text-emerald-400 mx-auto mb-3 opacity-60 bg-emerald-500/10 p-2 rounded-full" />
                No replenishment alerts currently identified. All levels secure!
              </div>
            ) : (
              products.filter(p => (p.quantity ?? 0) <= (p.minStock ?? 5)).slice(0, 5).map((p, idx) => (
                <div key={idx} className="bg-white/[0.02] p-3 rounded-2xl border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3 group">
                   <div className="min-w-0">
                     <span className="text-[12px] font-bold text-white block truncate">{p.name}</span>
                     <span className="text-[10px] text-slate-400 font-mono">Stock: <strong className="text-red-400 font-bold">{p.quantity}</strong> / Min req: {p.minStock}</span>
                   </div>
                   <button
                     onClick={() => handleSendMessage(`Let's draft a supplier order draft and restock RFP inquiry specifications for raw ingredient items matching sku: ${p.sku} (${p.name}). Please configure active values.`)}
                     className="text-[10px] font-bold text-[#38BDF8] hover:text-white bg-sky-500/10 hover:bg-sky-500/20 px-3 py-1.5 rounded-xl border border-sky-500/20 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                   >
                     <span>Draft order</span>
                     <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                   </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tactical blueprint libraries */}
        <div className="bg-[#111827]/80 backdrop-blur-md rounded-3xl p-5.5 border border-white/10 shadow-lg shrink-0">
          <h3 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3.5 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-sky-400" />
            Tactical Operations Blueprint
          </h3>
          
          <div className="space-y-2">
            <button 
              onClick={() => handleSendMessage("Run a complete catalog category balance analysis and propose restock models.")}
              className="w-full text-left text-[11px] p-3.5 rounded-2xl bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 text-slate-300 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
            >
              <span>Audit Category Balance Mix</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
            </button>
            <button 
              onClick={() => handleSendMessage("Suggest a detailed restock model and strategic safety margin proposal for " + (company?.name || "Invenio") + " products matches obsolecense speed ratios.")}
              className="w-full text-left text-[11px] p-3.5 rounded-2xl bg-white/[0.01] hover:bg-white/[0.04] border border-[#EEEEEE]/5 hover:border-[#EEEEEE]/10 text-slate-300 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
            >
              <span>Replenishment Strategic Margins</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Float Chat Trigger widget
export function InventoryProFloatingWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        // Backdrop overlay handles close click gracefully, click outside can also close
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {/* Backdrop Dimmer Overlay for Focus Control */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[190] cursor-pointer"
          />
        )}
      </AnimatePresence>

      <div ref={widgetRef} className="fixed bottom-22 sm:bottom-25 md:bottom-6 right-4 sm:right-6 z-[200] flex flex-col items-end">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="fixed sm:absolute bottom-0 sm:bottom-16 right-0 sm:right-0 left-0 sm:left-auto w-full sm:w-[500px] h-[86vh] sm:h-[660px] max-h-[88vh] sm:max-h-[82vh] bg-[#0B0F19] border-t sm:border border-white/10 shadow-2xl overflow-hidden flex flex-col rounded-t-[2rem] sm:rounded-3xl z-[200]"
            >
              <div className="flex-1 min-h-0 overflow-hidden">
                <InventoryProChat isFloating onClose={() => setIsOpen(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-12 h-12 sm:w-14 sm:h-14 rounded-full cursor-pointer bg-gradient-to-tr from-[#38BDF8] to-[#1E3A8A] hover:from-[#4fcffd] hover:to-[#2248ab] flex items-center justify-center text-white shadow-xl shadow-blue-500/25 hover:scale-105 active:scale-95 transition-all outline-none z-[201]",
            isOpen ? "rotate-95 bg-slate-900 border border-white/10 shadow-none scale-100" : "animate-bounce"
          )}
          style={{ animationDuration: '3s' }}
          title="Ask Inventory Pro AI"
        >
          <Sparkles className="w-5 sm:w-6 h-5 sm:h-6" />
        </button>
      </div>
    </>
  );
}

