import React, { useState, useEffect } from 'react';
import { 
  Users, Mail, Phone, MapPin, Plus, 
  MoreVertical, Search, Filter, Loader2
} from 'lucide-react';
import { collection, onSnapshot, query, where, setDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../lib/utils';

const CUSTOMERS_SEED = [
  {
    id: 'C-001',
    name: 'Acme Corp',
    email: 'ap@acme.com',
    phone: '+1 555 1010',
    address: '100 Market St',
    invoices: 1,
    balance: 12551.48
  },
  {
    id: 'C-002',
    name: 'Globex Ltd',
    email: 'orders@globex.com',
    phone: '+1 555 2020',
    address: '22 Industrial Park',
    invoices: 0,
    balance: 0.00
  },
  {
    id: 'C-003',
    name: 'Initech',
    email: 'finance@initech.com',
    phone: '+1 555 3030',
    address: '88 Office Plaza',
    invoices: 0,
    balance: 4280.00
  },
  {
    id: 'C-004',
    name: 'Umbrella Inc',
    email: 'po@umbrella.com',
    phone: '+1 555 4040',
    address: '7 Research Way',
    invoices: 0,
    balance: 0.00
  }
];

export function Customers() {
  const { user } = useAuth();
  const { profile, currency } = useSettings();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) return;
    const path = `companies/${profile.companyId}/customers`;
    const q = collection(db, path);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile?.companyId]);

  const seedCustomers = async () => {
    if (!user || !profile?.companyId) return;
    const path = `companies/${profile.companyId}/customers`;
    try {
      for (const customer of CUSTOMERS_SEED) {
        await setDoc(doc(db, path, `${profile.companyId}_${customer.id}`), {
          ...customer,
          id: `${profile.companyId}_${customer.id}`,
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
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Customers</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage customer accounts and balances</p>
        </div>
        <div className="flex items-center gap-2">
          {customers.length === 0 && (
            <button 
              onClick={seedCustomers}
              className="px-4 h-10 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700 transition-all"
            >
              Seed Sample Customers
            </button>
          )}
          <button className="flex items-center gap-2 bg-[#0f172a] text-white px-5 h-10 rounded-lg font-bold hover:bg-slate-800 transition-all text-xs shrink-0">
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((customer) => (
          <div key={customer.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col group hover:border-slate-300 transition-all text-left group">
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#0f172a] rounded-xl flex items-center justify-center text-white shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 tracking-tight leading-tight group-hover:text-blue-600 transition-colors uppercase">{customer.name}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{customer.id?.replace(`${profile?.companyId}_`, '') || customer.id}</p>
                  </div>
                </div>
                <button className="p-1.5 text-slate-300 hover:text-slate-600 transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-slate-500 group/item">
                  <Mail className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-xs font-medium truncate">{customer.email}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-500">
                  <Phone className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-xs font-medium">{customer.phone}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-xs font-medium truncate">{customer.address}</span>
                </div>
              </div>
            </div>

            <div className="mt-auto px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400">{customer.invoices} invoices</span>
              <span className={cn(
                "font-black text-sm",
                customer.balance > 0 ? "text-amber-600" : "text-emerald-600"
              )}>
                {currency}{(customer.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ))}
        {customers.length === 0 && (
          <div className="col-span-full p-20 text-center flex flex-col items-center justify-center opacity-40">
             <Users className="w-16 h-16 mb-4" />
             <p className="text-sm font-bold uppercase tracking-widest">No customers found</p>
          </div>
        )}
      </div>
    </div>
  );
}

