import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  Clock, 
  AlertTriangle, 
  Wrench,
  Edit2,
  Trash2,
  Plus,
  Grid,
  Box,
  Cpu,
  Shield,
  Layers,
  Search,
  X,
  Package,
  FolderPlus,
  Loader2,
  ChevronRight,
  Settings,
  Smartphone,
  Eye,
  DollarSign
} from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { useSettings } from '../../contexts/SettingsContext';
import { cn, getProductMovementSpeed } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface CategoryCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  items: number;
  value: string;
  percentage: number;
  onClick: () => void;
  key?: string | number;
}

const CategoryCard = ({ title, description, icon: Icon, color, items, value, percentage, onClick }: CategoryCardProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="bg-white border border-slate-250 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-slate-350 transition-all group cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm", color)}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{description}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-center">
            <p className="text-sm sm:text-base font-bold text-slate-900">{items.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Units</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-center col-span-2">
            <p className="text-sm sm:text-base font-black text-slate-900 truncate">{value}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Valuation ({percentage}%)</p>
          </div>
        </div>
      </div>

      <button 
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="w-full mt-4 h-9 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-wider flex items-center justify-center gap-1.5"
      >
        <Eye className="w-3.5 h-3.5" />
        View Products
      </button>
    </motion.div>
  );
};

export function Categories() {
  const { profile, currency } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'product_categories' | 'movement_speed'>('product_categories');
  
  // Detail Drawer state
  const [selectedCategory, setSelectedCategory] = useState<{
    type: 'category' | 'movement';
    name: string;
    icon: React.ElementType;
    color: string;
  } | null>(null);
  const [drawerSearch, setDrawerSearch] = useState('');

  // Add Category Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Box');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification Toast state
  const [toast, setToast] = useState({ show: false, message: '' });

  // Load Real Products from DB
  useEffect(() => {
    if (!profile?.companyId) return;

    const path = `companies/${profile.companyId}/products`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      setProducts(snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          movement: getProductMovementSpeed(data)
        };
      }));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile?.companyId]);

  // Load Custom Categories from DB
  useEffect(() => {
    if (!profile?.companyId) return;

    const path = `companies/${profile.companyId}/categories`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      setCustomCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error loading categories collection:", error);
    });

    return unsubscribe;
  }, [profile?.companyId]);

  // Helper Maps for category styling
  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('elect') || name.includes('cpu') || name.includes('tech')) return Cpu;
    if (name.includes('hard') || name.includes('tool') || name.includes('equip') || name.includes('const')) return Wrench;
    if (name.includes('raw') || name.includes('material') || name.includes('wood') || name.includes('metal')) return Layers;
    if (name.includes('safe') || name.includes('gear') || name.includes('protect')) return Shield;
    if (name.includes('comp') || name.includes('part') || name.includes('setting')) return Settings;
    if (name.includes('phone') || name.includes('mobile')) return Smartphone;
    return Box;
  };

  const getCategoryColor = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('elect') || name.includes('cpu') || name.includes('tech')) return 'bg-indigo-600';
    if (name.includes('hard') || name.includes('tool') || name.includes('equip') || name.includes('const')) return 'bg-amber-500';
    if (name.includes('raw') || name.includes('material') || name.includes('wood') || name.includes('metal')) return 'bg-teal-500';
    if (name.includes('safe') || name.includes('gear') || name.includes('protect')) return 'bg-rose-500';
    if (name.includes('comp') || name.includes('part') || name.includes('setting')) return 'bg-sky-500';
    if (name.includes('phone') || name.includes('mobile')) return 'bg-purple-600';
    return 'bg-slate-500';
  };

  const iconOptions = [
    { name: 'Box', icon: Box },
    { name: 'Cpu', icon: Cpu },
    { name: 'Wrench', icon: Wrench },
    { name: 'Shield', icon: Shield },
    { name: 'Layers', icon: Layers },
    { name: 'Settings', icon: Settings },
    { name: 'Smartphone', icon: Smartphone }
  ];

  // Calculations for real data
  const totalValue = products.reduce((sum, p) => sum + ((p.value || 0) * (p.quantity || 0)), 0);
  const totalItems = products.reduce((sum, p) => sum + (p.quantity || 0), 0);

  // Dynamic Product Categories
  const productCategoryNames = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const customCategoryNames = customCategories.map(c => c.name);
  const uniqueCategoryNames = Array.from(new Set([...productCategoryNames, ...customCategoryNames]));

  // Default seeded categories if database is completely empty
  const defaultCategoryNames = ["Electronics", "Hardware", "Raw Materials", "Safety Gear", "Components"];
  const displayCategoryNames = uniqueCategoryNames.length > 0 ? uniqueCategoryNames : defaultCategoryNames;

  const productCategoriesData = displayCategoryNames.map(catName => {
    const catProducts = products.filter(p => (p.category || '').toLowerCase() === catName.toLowerCase());
    const items = catProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const value = catProducts.reduce((sum, p) => sum + ((p.value || 0) * (p.quantity || 0)), 0);
    const pct = totalValue > 0 ? Math.round((value / totalValue) * 100) : 0;
    
    // Find description if in custom categories, else default
    const customDesc = customCategories.find(c => c.name.toLowerCase() === catName.toLowerCase())?.description;
    const description = customDesc || `Stock and performance tracking for ${catName} products`;

    // Icon & color selection
    const customIconName = customCategories.find(c => c.name.toLowerCase() === catName.toLowerCase())?.icon;
    const iconObj = iconOptions.find(i => i.name === customIconName)?.icon || getCategoryIcon(catName);

    return {
      title: catName,
      description,
      icon: iconObj,
      color: getCategoryColor(catName),
      items,
      value: `${currency}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      percentage: pct
    };
  });

  // Movement categories
  const movementTypes = [
    { key: 'fast', title: 'Fast Moving', desc: 'High demand items selling quickly', icon: TrendingUp, color: 'bg-emerald-500' },
    { key: 'moderate', title: 'Moderate', desc: 'Steady, predictable sales performance', icon: BarChart3, color: 'bg-blue-500' },
    { key: 'slow', title: 'Slow Moving', desc: 'Low turnover items, monitor shelf space', icon: Clock, color: 'bg-amber-500' },
    { key: 'obsolete', title: 'Obsolete', desc: 'No recent movement, recommend clearance', icon: AlertTriangle, color: 'bg-rose-500' },
    { key: 'mro', title: 'MRO', desc: 'Maintenance, repair & operations consumables', icon: Wrench, color: 'bg-teal-500' }
  ];

  const movementCategoriesData = movementTypes.map(m => {
    const mProducts = products.filter(p => (p.movement || 'moderate').toLowerCase() === m.key);
    const items = mProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const value = mProducts.reduce((sum, p) => sum + ((p.value || 0) * (p.quantity || 0)), 0);
    const pct = totalValue > 0 ? Math.round((value / totalValue) * 100) : 0;

    return {
      title: m.title,
      description: m.desc,
      icon: m.icon,
      color: m.color,
      items,
      value: `${currency}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      percentage: pct
    };
  });

  // Add Category Handler
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId || !newCatName.trim()) return;

    setIsSubmitting(true);
    try {
      const catPath = `companies/${profile.companyId}/categories`;
      await addDoc(collection(db, catPath), {
        name: newCatName.trim(),
        description: newCatDesc.trim(),
        icon: newCatIcon,
        createdAt: serverTimestamp()
      });

      setNewCatName('');
      setNewCatDesc('');
      setNewCatIcon('Box');
      setShowAddModal(false);

      setToast({ show: true, message: `Successfully created category "${newCatName.trim()}"` });
      setTimeout(() => setToast({ show: false, message: '' }), 4000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get products filtered for the drill down drawer
  const drawerProducts = products.filter(p => {
    if (!selectedCategory) return false;
    
    // Category match
    const matchesCategory = selectedCategory.type === 'category' 
      ? (p.category || '').toLowerCase() === selectedCategory.name.toLowerCase()
      : (p.movement || 'moderate').toLowerCase() === selectedCategory.name.toLowerCase().replace(' moving', '');

    // Search match within drawer
    const matchesSearch = p.name?.toLowerCase().includes(drawerSearch.toLowerCase()) || 
                          p.sku?.toLowerCase().includes(drawerSearch.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 px-4 sm:px-6 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 font-bold text-sm"
          >
            <Package className="w-5 h-5 animate-pulse" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Categories</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Analyze and organize your inventory segments with live warehouse metrics</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 bg-[#0F172A] text-white px-5 h-11 rounded-xl font-bold text-xs hover:bg-slate-850 active:scale-95 transition-all shadow-md shrink-0 sm:w-auto w-full"
        >
          <FolderPlus className="w-4.5 h-4.5" />
          Add Category
        </button>
      </div>

      {/* Real-time stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Grid className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dynamic Segments</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{(displayCategoryNames.length + 5).toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Valuation</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{currency} {totalValue.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Stock Units</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{totalItems.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Tabs segment */}
      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          <button 
            onClick={() => setActiveTab('product_categories')}
            className={cn(
              "pb-4 text-xs font-black uppercase tracking-wider transition-all relative border-b-2",
              activeTab === 'product_categories' 
                ? "border-emerald-600 text-slate-900" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            Product Categories ({displayCategoryNames.length})
            {activeTab === 'product_categories' && (
              <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('movement_speed')}
            className={cn(
              "pb-4 text-xs font-black uppercase tracking-wider transition-all relative border-b-2",
              activeTab === 'movement_speed' 
                ? "border-emerald-600 text-slate-900" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            Inventory Movement Speed ({movementTypes.length})
            {activeTab === 'movement_speed' && (
              <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
            )}
          </button>
        </div>
      </div>

      {/* Responsive Grid View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-10">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse flex flex-col justify-between h-[180px]">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                </div>
              </div>
              <div className="h-9 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {activeTab === 'product_categories' ? (
            productCategoriesData.map((category, index) => (
              <CategoryCard 
                key={category.title + index}
                title={category.title}
                description={category.description}
                icon={category.icon}
                color={category.color}
                items={category.items}
                value={category.value}
                percentage={category.percentage}
                onClick={() => setSelectedCategory({
                  type: 'category',
                  name: category.title,
                  icon: category.icon,
                  color: category.color
                })}
              />
            ))
          ) : (
            movementCategoriesData.map((category, index) => (
              <CategoryCard 
                key={category.title + index}
                title={category.title}
                description={category.description}
                icon={category.icon}
                color={category.color}
                items={category.items}
                value={category.value}
                percentage={category.percentage}
                onClick={() => setSelectedCategory({
                  type: 'movement',
                  name: category.title,
                  icon: category.icon,
                  color: category.color
                })}
              />
            ))
          )}

          {/* Add Category Card (Mobile placeholder) */}
          <button 
            onClick={() => setShowAddModal(true)}
            className="w-full h-[185px] border-2 border-dashed border-slate-250 hover:border-emerald-500/50 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/10 transition-all p-5"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
              <Plus className="w-5 h-5 text-slate-400" />
            </div>
            <span className="font-bold text-sm mt-1">Create Custom Segment</span>
            <span className="text-[10px] text-slate-400 text-center max-w-[250px]">Add a custom category to expand your item catalog classifications</span>
          </button>
        </div>
      )}

      {/* Drill Down Detail Slide-over Drawer */}
      <AnimatePresence>
        {selectedCategory && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedCategory(null);
                setDrawerSearch('');
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <div className="absolute inset-y-0 right-0 max-w-full flex">
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-screen max-w-md bg-white shadow-2xl flex flex-col"
              >
                {/* Drawer Header */}
                <div className="p-6 border-b border-slate-150 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm", selectedCategory.color)}>
                      <selectedCategory.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">{selectedCategory.name}</h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {selectedCategory.type === 'category' ? 'Catalog Category' : 'Stock Movement Classification'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedCategory(null);
                      setDrawerSearch('');
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search box inside Drawer */}
                <div className="p-4 border-b border-slate-100 bg-white">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Search items by name or SKU..."
                      value={drawerSearch}
                      onChange={(e) => setDrawerSearch(e.target.value)}
                      className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Products List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 no-scrollbar">
                  {drawerProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <Box className="w-6 h-6 text-slate-350" />
                      </div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-wider">No Products Found</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {drawerSearch ? 'Try a different search query' : 'There are currently no items matching this segment in inventory'}
                      </p>
                    </div>
                  ) : (
                    drawerProducts.map(product => {
                      const isLowStock = (product.quantity || 0) <= (product.reorderPoint ?? product.minStock ?? 10);
                      const isOutOfStock = (product.quantity || 0) <= 0;
                      return (
                        <div 
                          key={product.id}
                          className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2 shadow-sm relative overflow-hidden"
                        >
                          <div className="flex items-start justify-between">
                            <div className="max-w-[70%]">
                              <h4 className="text-xs font-black text-slate-900 uppercase truncate">{product.name}</h4>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">SKU: {product.sku}</p>
                            </div>
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border",
                              isOutOfStock 
                                ? "bg-rose-50 text-rose-600 border-rose-100" 
                                : isLowStock 
                                  ? "bg-amber-50 text-amber-600 border-amber-100" 
                                  : "bg-emerald-50 text-emerald-600 border-emerald-100"
                            )}>
                              {isOutOfStock ? 'OUT OF STOCK' : `${product.quantity} units`}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-1">
                            <div>
                              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Unit Value</p>
                              <p className="text-xs font-black text-slate-800">{currency}{product.value?.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Stock Valuation</p>
                              <p className="text-xs font-black text-emerald-600">
                                {currency}{((product.value || 0) * (product.quantity || 0)).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Drawer Footer */}
                <div className="p-6 border-t border-slate-150 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Segment Stock Value:</span>
                    <span className="text-sm font-black text-emerald-600">
                      {currency}{drawerProducts.reduce((sum, p) => sum + ((p.value || 0) * (p.quantity || 0)), 0).toLocaleString()}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedCategory(null);
                      setDrawerSearch('');
                    }}
                    className="w-full h-11 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 active:scale-95 transition-all uppercase tracking-wider flex items-center justify-center"
                  >
                    Close segment
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Custom Category Dialog */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <FolderPlus className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 leading-tight">Create Custom Segment</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Define a custom product category for inventory management</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCategory} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Category Name
                  </label>
                  <input 
                    required
                    type="text"
                    placeholder="e.g. Chemical Solvents"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Short Description
                  </label>
                  <textarea 
                    placeholder="Describe the type of products in this custom segment..."
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Category Icon
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {iconOptions.map(option => {
                      const IconComp = option.icon;
                      return (
                        <button
                          key={option.name}
                          type="button"
                          onClick={() => setNewCatIcon(option.name)}
                          className={cn(
                            "w-10 h-10 border rounded-lg flex items-center justify-center transition-all",
                            newCatIcon === option.name 
                              ? "bg-emerald-50 border-emerald-500 text-emerald-600 scale-105" 
                              : "border-slate-150 hover:bg-slate-50 text-slate-400"
                          )}
                          title={option.name}
                        >
                          <IconComp className="w-4.5 h-4.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 h-11 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-98 transition-all uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newCatName.trim()}
                    className="flex-1 h-11 bg-[#0F172A] text-white rounded-xl font-bold text-xs hover:bg-slate-800 active:scale-98 transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Save Category'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
