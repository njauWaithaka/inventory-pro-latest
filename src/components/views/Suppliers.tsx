import React, { useState, useEffect } from 'react';
import { 
  Truck, Mail, Phone, MapPin, Plus, 
  MoreVertical, ShieldCheck, HelpCircle, 
  AlertCircle, Loader2
} from 'lucide-react';
import { collection, onSnapshot, query, setDoc, doc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../lib/utils';

const SUPPLIERS_DATA = [
  {
    id: 'S-001',
    name: 'TechSource Distributors',
    email: 'sales@techsource.com',
    phone: '+1 555 7010',
    address: '500 Supply Rd',
    reliability: '91.3/100',
    payable: 14672.00,
    status: 'Excellent'
  },
  {
    id: 'S-002',
    name: 'Pacific Components',
    email: 'ap@pacificcomp.com',
    phone: '+1 555 7020',
    address: '12 Harbor Ave',
    reliability: '0/100',
    payable: 0.00,
    status: 'No data'
  },
  {
    id: 'S-003',
    name: 'BeanWorld Roasters',
    email: 'orders@beanworld.com',
    phone: '+1 555 7030',
    address: '5 Roastery Ln',
    reliability: '88/100',
    payable: 3650.00,
    status: 'Good'
  }
];

export function Suppliers() {
  const { user } = useAuth();
  const { profile, company, currency } = useSettings();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) return;
    const path = `companies/${profile.companyId}/suppliers`;
    const q = collection(db, path);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSuppliers(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile?.companyId]);

  const seedSuppliers = async () => {
    if (!user || !profile?.companyId) return;
    const path = `companies/${profile.companyId}/suppliers`;
    try {
      for (const supplier of SUPPLIERS_DATA) {
        await setDoc(doc(db, path, `${profile.companyId}_${supplier.id}`), {
          ...supplier,
          id: `${profile.companyId}_${supplier.id}`,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

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
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Suppliers</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage suppliers and track payables</p>
        </div>
        <div className="flex items-center gap-2">
          {suppliers.length === 0 && (
            <button 
              onClick={seedSuppliers}
              className="px-4 h-10 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700 transition-all"
            >
              Seed Suppliers
            </button>
          )}
          <button className="flex items-center gap-2 bg-[#0f172a] text-white px-5 h-10 rounded-lg font-bold hover:bg-slate-800 transition-all text-xs shrink-0">
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map((supplier) => (
          <div key={supplier.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col group hover:border-slate-300 transition-all text-left">
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 tracking-tight leading-tight">{supplier.name}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{supplier.id?.replace(`${profile?.companyId}_`, '') || supplier.id}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                   <span className={cn(
                     "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                     supplier.status === 'Excellent' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                     supplier.status === 'Good' ? "bg-slate-50 text-slate-500 border-slate-100" :
                     "bg-slate-50 text-slate-400 border-slate-100"
                   )}>
                     {supplier.status === 'Excellent' ? '☆ Excellent' : 
                      supplier.status === 'Good' ? '☆ Good' : '☆ No data'}
                   </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-slate-500 group/item">
                  <Mail className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-xs font-medium truncate">{supplier.email}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-500">
                  <Phone className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-xs font-medium">{supplier.phone}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-xs font-medium truncate">{supplier.address}</span>
                </div>
              </div>
            </div>

            <div className="mt-auto px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex flex-col">
                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Reliability</span>
                 <span className="text-xs font-black text-slate-900">{supplier.reliability}</span>
              </div>
              <div className="flex flex-col text-right">
                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Payable</span>
                 <span className={cn(
                   "text-sm font-black",
                   supplier.payable > 0 ? "text-amber-600" : "text-slate-400"
                 )}>
                   ${supplier.payable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                 </span>
              </div>
            </div>
          </div>
        ))}
        {suppliers.length === 0 && !loading && (
          <div className="col-span-full p-20 text-center bg-white border border-dashed border-slate-200 rounded-2xl">
            <p className="text-slate-400 font-medium">No suppliers found. Use the "Seed Suppliers" button to populate the database.</p>
          </div>
        )}
      </div>
    </div>
  );
}
