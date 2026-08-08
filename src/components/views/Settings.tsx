import React, { useState, useEffect } from 'react';
import { 
  User, Building2, Bell, Shield, Palette, 
  Link2, Save, ChevronDown, Globe, Mail, Phone,
  Database, CheckCircle2, Loader2, Plus, Sparkles, RefreshCcw, Check
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings, UserProfile, Company } from '../../contexts/SettingsContext';
import { seedDemoShopData } from '../../lib/seedDemoData';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'preferences', label: 'Preferences', icon: Database },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

export function Settings() {
  const { user } = useAuth();
  const { profile, company, updateProfile, updateCompany, loading, currency } = useSettings();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  // Local state for form fields
  const [profileData, setProfileData] = useState<Partial<UserProfile>>({});
  const [companyData, setCompanyData] = useState<Partial<Company>>({});

  const handleSeedDemo = async () => {
    if (!profile?.companyId) return;
    setIsSeeding(true);
    try {
      await seedDemoShopData(profile.companyId, user?.uid || 'staff');
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 4000);
    } catch (error) {
      console.error('Failed to seed demo data:', error);
      alert('Error seeding demo shop data. Please try again.');
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (profile) setProfileData(profile);
    if (company) {
      setCompanyData({
        currency: company.currency || currency,
        ...company
      });
    }
  }, [profile, company, currency]);

  const handleProfileSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile(profileData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompanySave = async () => {
    setIsSaving(true);
    try {
      await updateCompany(companyData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !profile) {
    return (
       <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
       </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Settings</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage your workspace and profile</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
        {/* Tabs Navigation */}
        <div className="border-b border-slate-100 px-6 bg-slate-50/50 overflow-x-auto no-scrollbar text-left">
          <div className="flex items-center gap-2 -mb-px whitespace-nowrap">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2",
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-8 text-left">
          {activeTab === 'profile' ? (
            <div className="max-w-5xl space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 col-span-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Display Name</label>
                  <input
                    type="text"
                    value={profileData.name || ''}
                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium text-slate-900 text-sm"
                  />
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input
                      disabled
                      type="email"
                      value={profileData.email || ''}
                      className="w-full h-12 pl-11 pr-4 bg-slate-50/50 border border-slate-200 rounded-xl font-medium text-slate-400 text-sm cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Workspace Role</label>
                  <div className="relative">
                    <select 
                      disabled
                      value={profileData.role || ''}
                      className="w-full h-12 px-4 bg-slate-50/50 border border-slate-200 rounded-xl font-medium text-slate-400 text-sm appearance-none cursor-not-allowed"
                    >
                      <option value="Owner">Owner</option>
                      <option value="Manager">Manager</option>
                      <option value="Staff">Staff</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex items-center gap-4">
                <button 
                  onClick={handleProfileSave}
                  disabled={isSaving}
                  className={cn(
                    "flex items-center gap-2 px-8 h-12 rounded-xl font-bold transition-all text-sm shadow-md active:scale-95",
                    saveSuccess 
                      ? "bg-emerald-600 text-white shadow-emerald-900/10" 
                      : "bg-[#0f172a] text-white shadow-slate-900/10 hover:bg-slate-800"
                  )}
                >
                  {isSaving ? (
                     <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saveSuccess ? (
                     <CheckCircle2 className="w-4 h-4" />
                  ) : (
                     <Save className="w-4 h-4" />
                  )}
                  {saveSuccess ? 'Profile Saved' : 'Save Profile'}
                </button>
              </div>
            </div>
          ) : activeTab === 'preferences' ? (
            <div className="max-w-5xl space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 p-6 bg-slate-50 border border-slate-200 rounded-[2rem] flex flex-col gap-4">
                     <div>
                        <h4 className="font-bold text-slate-900 text-sm mb-1 text-left">Company Detail</h4>
                        <p className="text-xs text-slate-500 font-medium text-left">Configure global workspace settings for {company?.name}.</p>
                     </div>
                     <div className="space-y-4">
                        <div className="text-left">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 mb-1 block">Legal Entity Name</label>
                          <input 
                            type="text"
                            value={companyData.name || ''}
                            onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full h-11 px-4 bg-white border border-slate-100 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                          />
                        </div>

                        <div className="text-left">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 mb-1 block">Physical Address / Head Office</label>
                          <input 
                            type="text"
                            value={companyData.address || ''}
                            onChange={(e) => setCompanyData(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="e.g. 5th Floor, Plaza, Nairobi, Kenya"
                            className="w-full h-11 px-4 bg-white border border-slate-100 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div className="text-left">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 mb-1 block">Business Phone Number</label>
                          <input 
                            type="text"
                            value={companyData.phone || ''}
                            onChange={(e) => setCompanyData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="e.g. +254 700 000000"
                            className="w-full h-11 px-4 bg-white border border-slate-100 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div className="text-left">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 mb-1 block">Operational Currency</label>
                          <select 
                            value={companyData.currency || '$'}
                            onChange={(e) => setCompanyData(prev => ({ ...prev, currency: e.target.value }))}
                            className="w-full h-11 px-4 bg-white border border-slate-100 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                          >
                             <option value="$">$ (USD)</option>
                             <option value="KSh">KSh (KES)</option>
                             <option value="€">€ (EUR)</option>
                             <option value="£">£ (GBP)</option>
                          </select>
                        </div>
                        <div className="text-left">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 mb-1 block">Local Timezone</label>
                          <select 
                            value={companyData.timezone || 'Nairobi'}
                            onChange={(e) => setCompanyData(prev => ({ ...prev, timezone: e.target.value }))}
                            className="w-full h-11 px-4 bg-white border border-slate-100 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                          >
                             <option value="Nairobi">Nairobi (EAT)</option>
                             <option value="Eastern">Eastern Time (EST)</option>
                             <option value="Pacific">Pacific Time (PST)</option>
                             <option value="UTC">Universal Time (UTC)</option>
                          </select>
                        </div>
                     </div>
                  </div>

                  {/* Demo Shop Dataset Seeding Card */}
                  <div className="space-y-4 p-6 bg-slate-50 border border-slate-200 rounded-[2rem] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm text-left">Demo Shop Dataset Seeding</h4>
                      </div>
                      <p className="text-xs text-slate-500 font-medium text-left leading-relaxed">
                        Populate a concise, mathematically balanced demo dataset (6 core inventory SKUs with cost/price margins, sample sales invoices, and suppliers).
                        This allows you to verify that calculations across Inventory, Demand Planning, MRP, and Sales Analytics are computing accurately.
                      </p>

                      {seedSuccess && (
                        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 text-left">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Demo Shop Dataset seeded successfully! Inventory, Sales, and Suppliers updated.</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={handleSeedDemo}
                        disabled={isSeeding}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
                      >
                        {isSeeding ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : seedSuccess ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Database className="w-4 h-4" />
                        )}
                        {isSeeding ? 'Seeding Dataset...' : seedSuccess ? 'Dataset Active' : 'Seed Demo Shop Data'}
                      </button>
                    </div>
                  </div>
               </div>
               
               <div className="pt-6 border-t border-slate-100">
                <button 
                  onClick={handleCompanySave}
                  disabled={isSaving}
                  className={cn(
                    "flex items-center gap-2 px-8 h-12 rounded-xl font-bold transition-all text-sm shadow-md active:scale-95",
                    saveSuccess 
                      ? "bg-emerald-600 text-white" 
                      : "bg-[#0f172a] text-white hover:bg-slate-800"
                  )}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saveSuccess ? 'Workspace Updated' : 'Update Workspace Settings'}
                </button>
              </div>
            </div>
          ) : activeTab === 'integrations' ? (
            <div className="max-w-5xl space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 text-left">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                          <Database className="w-5 h-5" />
                       </div>
                       <div>
                          <h4 className="font-bold text-slate-900 text-sm">Real-time Cloud Sync</h4>
                          <p className="text-xs text-slate-500 font-medium">All database operations are directly and securely saved to your Firebase cloud storage instance.</p>
                       </div>
                    </div>
                    <div className="pt-2 text-xs font-semibold text-slate-400">
                      Cloud DB Status: <span className="text-emerald-500 font-bold">CONNECTED</span>
                    </div>
                 </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                <Building2 className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Module Under Construction</h3>
              <p className="text-slate-500 max-w-xs mt-2 text-sm font-medium">This module is currently being optimized for tenant isolation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
