import React, { useState, useEffect } from 'react';
import { Plus, ClipboardList, Loader2, Search } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';

export function BOM() {
  const { user } = useAuth();
  const { profile } = useSettings();
  const [boms, setBoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) return;
    const q = collection(db, `companies/${profile.companyId}/boms`);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBoms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'boms');
      setLoading(false);
    });
    return unsubscribe;
  }, [profile?.companyId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase">Bills of Materials</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Manufacturing recipes and material requirements</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-[#0f172a] text-white px-5 h-10 rounded-xl font-bold hover:bg-slate-800 transition-all text-xs">
            <Plus className="w-4 h-4" />
            New BOM
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : boms.length > 0 ? (
          boms.map((bom) => (
            <div key={bom.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                  <ClipboardList className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest">{bom.status || 'ACTIVE'}</span>
              </div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight mb-1">{bom.productName}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{bom.productId}</p>
              
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">View Components</button>
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white" />
                  ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white border border-slate-200 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
              <ClipboardList className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400 max-w-sm leading-relaxed uppercase tracking-widest">
              No BOMs defined yet. Click "New BOM" to set up your first recipe.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
