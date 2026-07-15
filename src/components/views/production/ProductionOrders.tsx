import React, { useState, useEffect } from 'react';
import { Plus, Factory, BarChart3, Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { cn } from '../../../lib/utils';

export function ProductionOrders() {
  const { user } = useAuth();
  const { profile } = useSettings();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) return;
    const q = collection(db, `companies/${profile.companyId}/production_orders`);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'production_orders');
      setLoading(false);
    });
    return unsubscribe;
  }, [profile?.companyId]);

  const activeOrdersCount = orders.filter(o => o.status === 'IN_PROGRESS').length;
  const completedOrdersCount = orders.filter(o => o.status === 'COMPLETED').length;
  const totalUnits = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase">Production Orders</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage manufacturing runs and finished goods production</p>
        </div>
        <button className="flex items-center gap-2 bg-[#0f172a] text-white px-5 h-10 rounded-xl font-bold hover:bg-slate-800 transition-all text-xs">
          <Plus className="w-4 h-4" />
          New Order
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Orders', value: activeOrdersCount.toString(), color: 'text-blue-600' },
          { label: 'Completed Runs', value: completedOrdersCount.toString(), color: 'text-emerald-500' },
          { label: 'Units Produced', value: totalUnits.toLocaleString(), color: 'text-slate-900' },
          { label: 'Efficiency', value: '94%', color: 'text-slate-900' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <h4 className={cn("text-2xl font-black mt-2", stat.color)}>{stat.value}</h4>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-20 flex justify-center shadow-sm">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : orders.length > 0 ? (
            orders.map((order) => (
              <div key={order.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:border-blue-200 transition-all">
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                         <Factory className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                         <h4 className="font-black text-slate-900 uppercase tracking-tight leading-tight">{order.productName}</h4>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Order #{order.id.slice(0, 8)}</p>
                      </div>
                   </div>
                   <div className={cn(
                     "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                     order.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                   )}>
                      {order.status === 'COMPLETED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {order.status}
                   </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4 border-t border-slate-50">
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</p>
                      <p className="font-bold text-slate-900">{order.quantity} units</p>
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority</p>
                      <p className="font-bold text-slate-900">MEDIUM</p>
                   </div>
                   <div className="col-span-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Progress</p>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                         <div 
                           className={cn("h-full transition-all duration-1000", order.status === 'COMPLETED' ? "w-full bg-emerald-500" : "w-1/2 bg-blue-500")}
                         />
                      </div>
                   </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-20 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                <Factory className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-black text-slate-300 uppercase tracking-widest">
                No production orders found
              </p>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm h-fit space-y-6">
           <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Material Efficiency</h3>
           </div>
           
           <div className="space-y-4">
              {[
                { label: 'Raw Materials', val: 88, color: 'bg-blue-500' },
                { label: 'Packaging', val: 92, color: 'bg-emerald-500' },
                { label: 'Labor Hours', val: 75, color: 'bg-amber-500' },
              ].map((item, i) => (
                <div key={i} className="space-y-1.5">
                   <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                     <span className="text-slate-500">{item.label}</span>
                     <span className="text-slate-900">{item.val}%</span>
                   </div>
                   <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden">
                      <div className={cn("h-full", item.color)} style={{ width: `${item.val}%` }} />
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
