import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, ShoppingCart, Clock, Truck, 
  CheckCircle2, DollarSign, Package, MoreVertical, 
  Eye, Edit3, ClipboardList, Loader2
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { PurchaseOrder } from '../../../types';

export function ProcurementHub() {
  const { profile, settings } = useSettings();
  const currency = settings?.currency || 'KSh';
  const [activeTab, setActiveTab] = useState('All Orders');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) return;
    
    const poPath = `companies/${profile.companyId}/purchaseOrders`;
    const unsubscribePOs = onSnapshot(collection(db, poPath), (snapshot) => {
      setPurchaseOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder)));
      setLoading(false);
    });

    const suppliersPath = `companies/${profile.companyId}/suppliers`;
    const unsubscribeSuppliers = onSnapshot(collection(db, suppliersPath), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribePOs();
      unsubscribeSuppliers();
    };
  }, [profile?.companyId]);

  const filteredOrders = purchaseOrders.filter(po => {
    if (activeTab === 'All Orders') return true;
    return po.status === activeTab.toUpperCase();
  });

  const stats = [
    { label: 'Total Orders', value: purchaseOrders.length.toString(), icon: ClipboardList, color: 'text-slate-900', bg: 'bg-slate-50' },
    { label: 'Pending Approval', value: `${currency}${purchaseOrders.filter(p => p.status === 'PENDING').reduce((s, p) => s + p.totalAmount, 0).toLocaleString()}`, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Approved Value', value: `${currency}${purchaseOrders.filter(p => p.status === 'APPROVED').reduce((s, p) => s + p.totalAmount, 0).toLocaleString()}`, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Total Value', value: `${currency}${purchaseOrders.reduce((s, p) => s + p.totalAmount, 0).toLocaleString()}`, icon: DollarSign, color: 'text-blue-500', bg: 'bg-blue-50' },
  ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Procurement Hub</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Global view of purchase cycles and commitments</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", stat.bg, stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-black text-slate-900 leading-tight">{stat.value}</p>
              <p className="text-[10px] font-bold text-slate-400 tracking-tight uppercase leading-none mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs and Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
        <div className="px-6 py-2 border-b border-slate-100 flex items-center gap-6 overflow-x-auto no-scrollbar">
          {['All Orders', 'Draft', 'Pending', 'Approved', 'Shipped', 'Received'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative py-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap",
                activeTab === tab ? "text-blue-600 border-blue-600" : "text-slate-400 border-transparent hover:text-slate-600"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">PO Number</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Supplier</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Items</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredOrders.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((po, i) => {
                const supplier = suppliers.find(s => s.id === po.supplierId);
                return (
                  <tr key={po.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-900">{po.poNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-600">{supplier?.name || 'Unknown'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-900">{po.items?.length || 0}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-black text-slate-900">{currency}{(po.totalAmount || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                        po.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        po.status === 'PENDING' ? "bg-amber-50 text-amber-600 border-amber-100" :
                        po.status === 'SHIPPED' ? "bg-cyan-50 text-cyan-600 border-cyan-100" :
                        po.status === 'RECEIVED' ? "bg-slate-100 text-slate-600 border-slate-200" :
                        "bg-slate-50 text-slate-400 border-slate-100"
                      )}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                         <Clock className="w-3.5 h-3.5 text-slate-300" />
                         <span className="text-[10px] font-bold text-slate-400">{new Date(po.date).toLocaleDateString()}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <ShoppingCart className="w-12 h-12 mx-auto text-slate-200 mb-4" />
                    <p className="text-xs font-black text-slate-300 uppercase tracking-widest">No matching orders found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
