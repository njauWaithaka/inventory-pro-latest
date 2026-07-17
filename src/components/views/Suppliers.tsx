import React, { useState, useEffect } from 'react';
import { 
  Truck, Mail, Phone, MapPin, Plus, 
  MoreVertical, ShieldCheck, HelpCircle, 
  AlertCircle, Loader2, X, Edit2, Trash2, Search, Percent
} from 'lucide-react';
import { collection, onSnapshot, query, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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
  const { profile, currency } = useSettings();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal and CRUD states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Custom delete confirmation modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [reliability, setReliability] = useState('100/100');
  const [status, setStatus] = useState('Excellent');
  const [payable, setPayable] = useState('');

  useEffect(() => {
    if (!profile?.companyId) {
      setLoading(false);
      return;
    }
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

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setReliability('100/100');
    setStatus('Excellent');
    setPayable('');
    setShowModal(true);
  };

  const handleOpenEditModal = (supplier: any) => {
    setIsEditing(true);
    setCurrentId(supplier.id);
    setName(supplier.name || '');
    setEmail(supplier.email || '');
    setPhone(supplier.phone || '');
    setAddress(supplier.address || '');
    setReliability(supplier.reliability || '100/100');
    setStatus(supplier.status || 'Excellent');
    setPayable(supplier.payable !== undefined ? supplier.payable.toString() : '0');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !name) return;
    setIsSubmitting(true);

    const path = `companies/${profile.companyId}/suppliers`;
    try {
      const data = {
        name,
        email,
        phone,
        address,
        reliability,
        status,
        payable: parseFloat(payable) || 0,
        updatedAt: new Date().toISOString(),
      };

      if (isEditing && currentId) {
        await updateDoc(doc(db, path, currentId), data);
      } else {
        const id = `SUPP-${Date.now().toString().slice(-6)}`;
        await setDoc(doc(db, path, `${profile.companyId}_${id}`), {
          ...data,
          id: `${profile.companyId}_${id}`,
          createdAt: new Date().toISOString()
        });
      }
      setShowModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrigger = (id: string, name: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmName(name);
  };

  const handleConfirmDelete = async () => {
    if (!profile?.companyId || !deleteConfirmId) return;
    const path = `companies/${profile.companyId}/suppliers`;
    try {
      await deleteDoc(doc(db, path, deleteConfirmId));
      setDeleteConfirmId(null);
      setDeleteConfirmName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Suppliers</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage supplier profiles, contact details, and outstanding payables</p>
        </div>
        <div className="flex items-center gap-2">
          {suppliers.length === 0 && (
            <button 
              onClick={seedSuppliers}
              className="px-4 h-11 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700 transition-all shrink-0"
            >
              Seed Suppliers
            </button>
          )}
          <button 
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 bg-[#0f172a] text-white px-5 h-11 rounded-lg font-bold hover:bg-slate-800 transition-all text-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search suppliers by name, email, address, or ID..."
            className="w-full pl-11 pr-4 h-12 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-slate-300 focus:bg-white transition-all font-medium text-slate-900 text-sm placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid of cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.map((supplier) => (
          <div key={supplier.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col group hover:border-slate-300 transition-all text-left">
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 tracking-tight leading-tight uppercase text-base">{supplier.name}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{supplier.id?.replace(`${profile?.companyId}_`, '') || supplier.id}</p>
                  </div>
                </div>
                
                {/* Edit & Delete trigger buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => handleOpenEditModal(supplier)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    title="Edit Supplier"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleDeleteTrigger(supplier.id, supplier.name)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                    title="Delete Supplier"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Badges row */}
              <div className="flex flex-wrap gap-2">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                  supplier.status === 'Excellent' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                  supplier.status === 'Good' ? "bg-blue-50 text-blue-600 border-blue-100" :
                  supplier.status === 'Fair' ? "bg-amber-50 text-amber-600 border-amber-100" :
                  supplier.status === 'Poor' ? "bg-rose-50 text-rose-600 border-rose-100" :
                  "bg-slate-50 text-slate-400 border-slate-200"
                )}>
                  ☆ {supplier.status || 'No data'}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-slate-500">
                  <Mail className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-xs font-semibold truncate" title={supplier.email}>{supplier.email || 'No email registered'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-500">
                  <Phone className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-xs font-semibold">{supplier.phone || 'No phone registered'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-xs font-semibold truncate" title={supplier.address}>{supplier.address || 'No address registered'}</span>
                </div>
              </div>
            </div>

            <div className="mt-auto px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex flex-col">
                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Reliability</span>
                 <span className="text-xs font-black text-slate-900">{supplier.reliability || 'No data'}</span>
              </div>
              <div className="flex flex-col text-right">
                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Payable</span>
                 <span className={cn(
                   "text-sm font-black",
                   supplier.payable > 0 ? "text-amber-600" : "text-slate-400"
                 )}>
                   {currency || '$'}{(supplier.payable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                 </span>
              </div>
            </div>
          </div>
        ))}

        {filteredSuppliers.length === 0 && (
          <div className="col-span-full py-16 text-center flex flex-col items-center justify-center bg-white border border-dashed border-slate-200 rounded-3xl">
             <Truck className="w-12 h-12 text-slate-300 mb-3" />
             <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">No suppliers found</p>
             <p className="text-xs text-slate-400 mt-1">Add a supplier or seed sample profiles to start managing suppliers</p>
          </div>
        )}
      </div>

      {/* CRUD Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden text-left flex flex-col animate-in fade-in zoom-in duration-200"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">{isEditing ? 'Edit Supplier Profile' : 'Add New Supplier'}</h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Supplier / Company Name *
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Pacific Distributors"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Email Address
                    </label>
                    <input 
                      type="email" 
                      placeholder="e.g. sales@pacific.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Phone Number
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. +1 555 7010"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Physical Address
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. 500 Supply Rd, Nairobi"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Reliability Score
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. 95/100"
                      value={reliability}
                      onChange={(e) => setReliability(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Performance Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm bg-white"
                    >
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                      <option value="No data">No data</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Payable Balance ({currency || '$'})
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="e.g. 0.00"
                    value={payable}
                    onChange={(e) => setPayable(e.target.value)}
                    className="w-full px-4 h-11 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-colors font-medium text-slate-900 text-sm"
                  />
                </div>

                <div className="pt-4 flex gap-2 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 h-11 border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 h-11 bg-[#0f172a] hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? 'Save Changes' : 'Create Profile')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Deletion Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden text-center p-6 space-y-4"
            >
              <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Supplier?</h3>
                <p className="text-slate-500 text-xs mt-1.5">
                  Are you sure you want to delete the supplier profile for <strong className="text-slate-800 font-extrabold">{deleteConfirmName}</strong>? This action is irreversible.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setDeleteConfirmId(null);
                    setDeleteConfirmName('');
                  }}
                  className="flex-1 h-11 border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

