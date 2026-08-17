import React, { useState, useEffect } from 'react';
import { 
  Bell, AlertCircle, AlertTriangle, Info, Clock, 
  X, CheckCircle2, ChevronRight, Settings, 
  ShoppingCart, Percent, ArrowRightLeft, TrendingUp, Loader2
} from 'lucide-react';
import { collection, onSnapshot, query, where, setDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../lib/utils';
import { InsightBadge } from '../common/InsightBadge';

export function Alerts() {
  const { user } = useAuth();
  const { profile } = useSettings();
  const [filter, setFilter] = useState('all');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!profile?.companyId) return;
    const q = collection(db, `companies/${profile.companyId}/inventory_alerts`);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const triggerSync = async () => {
      try {
        const { AlertService } = await import('../../lib/alertService');
        await AlertService.runAlertSync(profile.companyId);
      } catch (err) {
        console.error("Alerts sync failed:", err);
      }
    };
    triggerSync();

    return unsubscribe;
  }, [profile?.companyId]);

  const activeAlerts = alerts.filter(a => a.status !== 'resolved' && a.status !== 'dismissed');

  const updateAlertStatus = async (alertId: string, status: 'read' | 'resolved' | 'dismissed') => {
    if (!profile?.companyId) return;
    try {
      const alertRef = doc(db, `companies/${profile.companyId}/inventory_alerts`, alertId);
      await setDoc(alertRef, { status }, { merge: true });
    } catch (err) {
      console.error("Failed to update alert status:", err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!profile?.companyId) return;
    try {
      const batch = writeBatch(db);
      activeAlerts.forEach(alert => {
        if (alert.status !== 'read') {
          const alertRef = doc(db, `companies/${profile.companyId}/inventory_alerts`, alert.id);
          batch.update(alertRef, { status: 'read' });
        }
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const handleRecalculate = async () => {
    if (!profile?.companyId) return;
    setSyncing(true);
    try {
      const { AlertService } = await import('../../lib/alertService');
      await AlertService.runAlertSync(profile.companyId);
    } catch (err) {
      console.error("Manual alert sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const filteredAlerts = activeAlerts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'critical') return a.severity === 'high' || a.severity === 'critical';
    if (filter === 'warning') return a.severity === 'medium';
    if (filter === 'info') return a.severity === 'low';
    return true;
  });

  const stats = [
    { label: 'Total Active', value: activeAlerts.length, icon: Bell, color: 'text-slate-900' },
    { label: 'Critical', value: activeAlerts.filter(a => a.severity === 'high' || a.severity === 'critical').length, icon: AlertCircle, color: 'text-rose-500' },
    { label: 'Warnings', value: activeAlerts.filter(a => a.severity === 'medium').length, icon: AlertTriangle, color: 'text-amber-500' },
    { label: 'Informational', value: activeAlerts.filter(a => a.severity === 'low').length, icon: Info, color: 'text-blue-500' },
  ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Alerts</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Smart notifications and actionable recommendations</p>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={handleMarkAllRead}
             className="flex items-center gap-2 px-4 h-10 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-xs"
           >
             <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mark All Read
           </button>
           <button 
             onClick={handleRecalculate}
             disabled={syncing}
             className="flex items-center gap-2 px-4 h-10 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-xs disabled:opacity-50"
           >
             <Loader2 className={cn("w-4 h-4 text-blue-500", syncing && "animate-spin")} />
             {syncing ? "Calculating..." : "Recalculate"}
           </button>
        </div>
      </div>

      {/* Alert Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className={cn("p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 bg-white text-left")}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", i === 0 ? "bg-slate-900 text-white" : "bg-slate-50", stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                 <p className="text-xl font-black text-slate-900">{stat.value}</p>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic Intelligence Telemetry */}
      <InsightBadge
        elementId="alerts_risk_breakdown"
        variant="banner"
        className="w-full"
      />

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
        <div className="px-4 sm:px-6 py-1 border-b border-slate-100 flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All', count: activeAlerts.length },
            { id: 'critical', label: 'Critical', count: activeAlerts.filter(a => a.severity === 'high' || a.severity === 'critical').length },
            { id: 'warning', label: 'Warning', count: activeAlerts.filter(a => a.severity === 'medium').length },
            { id: 'info', label: 'Info', count: activeAlerts.filter(a => a.severity === 'low').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                "relative py-3 sm:py-4 text-[10px] sm:text-xs font-bold transition-all flex items-center gap-2 shrink-0 border-b-2",
                filter === tab.id ? "text-slate-900 border-blue-500" : "text-slate-400 border-transparent hover:text-slate-600"
              )}
            >
              {tab.label}
              <span className={cn(
                 "px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] scale-90 sm:scale-100",
                 filter === tab.id ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-50">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => (
              <div 
                key={alert.id} 
                onClick={() => {
                  if (alert.status === 'unread') {
                    updateAlertStatus(alert.id, 'read');
                  }
                }}
                className={cn(
                  "p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 hover:bg-slate-50/50 transition-all group cursor-pointer border-l-4",
                  alert.severity === 'critical' ? 'bg-rose-50/25 border-rose-500' :
                  alert.severity === 'high' ? 'bg-orange-50/20 border-orange-500' : 
                  alert.severity === 'medium' ? 'bg-amber-50/20 border-amber-400' : 
                  'bg-blue-50/20 border-blue-400'
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-white shadow-sm",
                  alert.severity === 'critical' || alert.severity === 'high' ? 'bg-rose-100 text-rose-600' : 
                  alert.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 
                  'bg-blue-100 text-blue-600'
                )}>
                  {alert.type === 'reorder' ? <ShoppingCart className="w-5 h-5" /> : 
                   alert.type === 'slow' ? <Percent className="w-5 h-5" /> :
                   alert.type === 'overstock' ? <ArrowRightLeft className="w-5 h-5" /> :
                   alert.type === 'expiry' ? <Clock className="w-5 h-5" /> :
                   <AlertTriangle className="w-5 h-5" />}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                    {alert.status === 'unread' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse shrink-0 self-center md:self-auto" title="Unread" />
                    )}
                    <h4 className={cn("text-sm tracking-tight", alert.status === 'unread' ? "font-extrabold text-slate-900" : "font-semibold text-slate-700")}>
                      {alert.title}
                    </h4>
                    <span className={cn(
                      "inline-block px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest self-center md:self-auto",
                      alert.severity === 'critical' || alert.severity === 'high' ? 'bg-rose-100 text-rose-600' : 
                      alert.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 
                      'bg-blue-100 text-blue-600'
                    )}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500 mb-1">{alert.description}</p>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                     <Clock className="w-3 h-3 text-slate-300" />
                     <span className="text-[10px] font-bold text-slate-400">{alert.timestamp}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button className="h-10 px-6 rounded-xl bg-[#0f172a] text-white text-xs font-black shadow-sm hover:bg-slate-800 transition-all">
                    {alert.actionLabel || 'Take Action'}
                  </button>
                  <button 
                    onClick={() => updateAlertStatus(alert.id, 'resolved')}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-500 transition-all border border-transparent hover:border-slate-200"
                    title="Mark Resolved"
                  >
                    <CheckCircle2 className="w-4.5 h-4.5" />
                  </button>
                  <button 
                    onClick={() => updateAlertStatus(alert.id, 'dismissed')}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-500 transition-all border border-transparent hover:border-slate-200"
                    title="Dismiss Alert"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-slate-400">
              <Bell className="w-12 h-12 mx-auto opacity-10 mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest text-slate-300">No active alerts found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
