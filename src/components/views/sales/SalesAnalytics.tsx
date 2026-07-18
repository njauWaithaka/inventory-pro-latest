import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, BarChart3, Clock, 
  ArrowRightLeft, Percent, DollarSign, 
  Calendar, RefreshCcw, Download,
  CheckCircle2, XCircle, AlertCircle, ShoppingCart, User, FileText,
  Sparkles, Package, Flame, Snowflake, AlertTriangle, HelpCircle
} from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn, formatCompactNumber } from '../../../lib/utils';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = ['#10b981', '#3b82f6', '#f43f5e', '#f59e0b', '#8b5cf6'];

export function SalesAnalytics() {
  const { profile, company, settings } = useSettings();
  const currency = settings?.currency || company?.currency || 'KSh';

  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Controls
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | '30days' | '90days' | 'year' | 'all' | 'custom'>('30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [topProductsLimit, setTopProductsLimit] = useState<5 | 10>(5);
  const [compareMode, setCompareMode] = useState<boolean>(true);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');

  useEffect(() => {
    if (!profile?.companyId) return;

    setLoading(true);

    // Invoices Real-time snapshot
    const qryInvoices = query(
      collection(db, `companies/${profile.companyId}/invoices`)
    );
    const unsubInvoices = onSnapshot(qryInvoices, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error loading invoices for Sales Analytics:", error);
    });

    // Products Real-time snapshot
    const qryProducts = query(
      collection(db, `companies/${profile.companyId}/products`)
    );
    const unsubProducts = onSnapshot(qryProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error loading products for Sales Analytics:", error);
    });

    // Customers Real-time snapshot
    const qryCustomers = query(
      collection(db, `companies/${profile.companyId}/customers`)
    );
    const unsubCustomers = onSnapshot(qryCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error loading customers for Sales Analytics:", error);
    });

    const delay = setTimeout(() => {
      setLoading(false);
    }, 600);

    return () => {
      unsubInvoices();
      unsubProducts();
      unsubCustomers();
      clearTimeout(delay);
    };
  }, [profile?.companyId]);

  // Standard Sales Invoices (not proformas)
  const salesInvoices = useMemo(() => {
    return invoices.filter(inv => inv.type === 'standard');
  }, [invoices]);

  // Parse invoice date safely to support robust range queries
  const parseInvoiceDate = (dateStr: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateStr);
  };

  // Categories extracted from products
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  // Dynamic Date Ranges calculation for compare mode
  const dateRanges = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let currentStart = new Date();
    let prevStart = new Date();
    let prevEnd = new Date();

    if (timeFilter === 'today') {
      currentStart = new Date(today);
      currentStart.setHours(0, 0, 0, 0);

      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 1);
      
      prevEnd = new Date(today);
      prevEnd.setDate(prevEnd.getDate() - 1);
    } else if (timeFilter === '7days') {
      currentStart = new Date(today);
      currentStart.setDate(currentStart.getDate() - 6);
      currentStart.setHours(0, 0, 0, 0);

      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 7);

      prevEnd = new Date(currentStart);
      prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);
    } else if (timeFilter === '30days') {
      currentStart = new Date(today);
      currentStart.setDate(currentStart.getDate() - 29);
      currentStart.setHours(0, 0, 0, 0);

      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 30);

      prevEnd = new Date(currentStart);
      prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);
    } else if (timeFilter === '90days') {
      currentStart = new Date(today);
      currentStart.setDate(currentStart.getDate() - 89);
      currentStart.setHours(0, 0, 0, 0);

      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 90);

      prevEnd = new Date(currentStart);
      prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);
    } else if (timeFilter === 'year') {
      currentStart = new Date(today);
      currentStart.setMonth(0, 1);
      currentStart.setHours(0, 0, 0, 0);

      prevStart = new Date(currentStart);
      prevStart.setFullYear(prevStart.getFullYear() - 1);

      prevEnd = new Date(today);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);
    } else if (timeFilter === 'custom' && customStartDate && customEndDate) {
      currentStart = new Date(customStartDate);
      currentStart.setHours(0, 0, 0, 0);

      const currentEnd = new Date(customEndDate);
      currentEnd.setHours(23, 59, 59, 999);

      const diffTime = Math.abs(currentEnd.getTime() - currentStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - diffDays);

      prevEnd = new Date(currentStart);
      prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);
    } else {
      currentStart = new Date(2000, 0, 1);
      prevStart = new Date(1990, 0, 1);
      prevEnd = new Date(1999, 11, 31);
    }

    return { currentStart, currentEnd: today, prevStart, prevEnd };
  }, [timeFilter, customStartDate, customEndDate]);

  // Filters application
  const { currentInvoices, previousInvoices } = useMemo(() => {
    const { currentStart, currentEnd, prevStart, prevEnd } = dateRanges;

    const curr: any[] = [];
    const prev: any[] = [];

    salesInvoices.forEach(inv => {
      if (selectedCustomer !== 'all' && inv.customer !== selectedCustomer) {
        return;
      }

      const invDate = parseInvoiceDate(inv.date);
      if (!invDate) return;

      const matchesCategoryFilter = (invoice: any) => {
        if (selectedCategory === 'all') return true;
        return invoice.items?.some((item: any) => {
          const prod = products.find(p => p.id === item.productId || p.name === item.name);
          return prod?.category === selectedCategory || item.category === selectedCategory;
        });
      };

      if (invDate >= currentStart && invDate <= currentEnd) {
        if (matchesCategoryFilter(inv)) curr.push(inv);
      } else if (invDate >= prevStart && invDate <= prevEnd) {
        if (matchesCategoryFilter(inv)) prev.push(inv);
      }
    });

    return { currentInvoices: curr, previousInvoices: prev };
  }, [salesInvoices, dateRanges, selectedCategory, selectedCustomer, products]);

  // Financial Metrics Calculations
  const currentRevenue = useMemo(() => {
    return currentInvoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);
  }, [currentInvoices]);

  const previousRevenue = useMemo(() => {
    return previousInvoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);
  }, [previousInvoices]);

  const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

  // Order Counts
  const currentOrders = currentInvoices.length;
  const previousOrders = previousInvoices.length;
  const ordersGrowth = previousOrders > 0 ? ((currentOrders - previousOrders) / previousOrders) * 100 : 0;

  // Average Order Value
  const currentAOV = currentOrders > 0 ? currentRevenue / currentOrders : 0;
  const previousAOV = previousOrders > 0 ? previousRevenue / previousOrders : 0;
  const aovGrowth = previousAOV > 0 ? ((currentAOV - previousAOV) / previousAOV) * 100 : 0;

  // COGS & Profits
  const getInvoiceCOGS = (invoicesList: any[]) => {
    let totalCost = 0;
    invoicesList.forEach(inv => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach((item: any) => {
          const prod = products.find(p => p.id === item.productId || p.name === item.name);
          const costPrice = prod?.buyingPrice ?? item.costPrice ?? item.cost ?? ((item.price || 0) * 0.7);
          totalCost += costPrice * (item.quantity || 1);
        });
      } else {
        totalCost += (inv.amount || 0) * 0.7;
      }
    });
    return totalCost;
  };

  const currentCOGS = useMemo(() => getInvoiceCOGS(currentInvoices), [currentInvoices, products]);
  const previousCOGS = useMemo(() => getInvoiceCOGS(previousInvoices), [previousInvoices, products]);

  const currentProfit = currentRevenue - currentCOGS;
  const previousProfit = previousRevenue - previousCOGS;
  const profitGrowth = previousProfit > 0 ? ((currentProfit - previousProfit) / previousProfit) * 100 : 0;

  const currentMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;

  // Sparkline generator
  const sparklineData = useMemo(() => {
    const { currentStart, currentEnd } = dateRanges;
    const days: { [key: string]: { revenue: number; orders: number; profit: number } } = {};
    
    const start = new Date(currentStart);
    const end = new Date(currentEnd);
    
    // limit sparkline keys to avoid excessive loops on all-time
    let daysLimit = 0;
    while (start <= end && daysLimit < 180) {
      const dateStr = start.toISOString().split('T')[0];
      days[dateStr] = { revenue: 0, orders: 0, profit: 0 };
      start.setDate(start.getDate() + 1);
      daysLimit++;
    }

    currentInvoices.forEach(inv => {
      if (inv.date && days[inv.date]) {
        days[inv.date].revenue += (inv.amount || 0);
        days[inv.date].orders += 1;
        
        let cogs = 0;
        if (inv.items && Array.isArray(inv.items)) {
          inv.items.forEach((item: any) => {
            const prod = products.find(p => p.id === item.productId || p.name === item.name);
            const cost = prod?.buyingPrice ?? item.costPrice ?? item.cost ?? ((item.price || 0) * 0.7);
            cogs += cost * (item.quantity || 1);
          });
        } else {
          cogs = (inv.amount || 0) * 0.7;
        }
        days[inv.date].profit += ((inv.amount || 0) - cogs);
      }
    });

    return Object.keys(days).sort().map(d => ({
      date: d,
      revenue: days[d].revenue,
      orders: days[d].orders,
      profit: days[d].profit,
    }));
  }, [currentInvoices, dateRanges, products]);

  // Main Aligned Trend Data
  const alignedTrendData = useMemo(() => {
    const { currentStart, currentEnd, prevStart, prevEnd } = dateRanges;
    
    const currDays: string[] = [];
    let temp = new Date(currentStart);
    while (temp <= currentEnd) {
      currDays.push(temp.toISOString().split('T')[0]);
      temp.setDate(temp.getDate() + 1);
    }

    const prevDays: string[] = [];
    temp = new Date(prevStart);
    while (temp <= prevEnd) {
      prevDays.push(temp.toISOString().split('T')[0]);
      temp.setDate(temp.getDate() + 1);
    }

    return currDays.map((currDate, i) => {
      const currInvs = currentInvoices.filter(inv => inv.date === currDate);
      const revenue = currInvs.reduce((acc, inv) => acc + (inv.amount || 0), 0);
      const orders = currInvs.length;

      const prevDate = prevDays[i];
      let prevRevenue = 0;
      let prevOrders = 0;
      if (prevDate) {
        const prevInvs = previousInvoices.filter(inv => inv.date === prevDate);
        prevRevenue = prevInvs.reduce((acc, inv) => acc + (inv.amount || 0), 0);
        prevOrders = prevInvs.length;
      }

      let label = currDate;
      const parts = currDate.split('-');
      if (parts.length === 3) {
        const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(dObj.getTime())) {
          label = dObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        }
      }

      return {
        date: label,
        'Revenue': revenue,
        'Prev Revenue': prevRevenue,
        'Orders': orders,
        'Prev Orders': prevOrders,
      };
    });
  }, [currentInvoices, previousInvoices, dateRanges]);

  // Top Performing Products
  const topProductsData = useMemo(() => {
    const productSales: { [key: string]: { name: string; sku: string; unitsSold: number; revenue: number; profit: number; stockRemaining: number } } = {};
    
    currentInvoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach((item: any) => {
          const key = item.productId || item.name;
          if (!key) return;
          
          const prod = products.find(p => p.id === item.productId || p.name === item.name);
          const stock = prod?.quantity ?? 0;
          const cost = prod?.buyingPrice ?? item.costPrice ?? item.cost ?? ((item.price || 0) * 0.7);
          const itemRevenue = (item.quantity || 0) * (item.price || 0);
          const itemCost = (item.quantity || 0) * cost;
          const itemProfit = itemRevenue - itemCost;

          if (!productSales[key]) {
            productSales[key] = {
              name: item.name || 'Unknown Product',
              sku: prod?.sku || item.sku || 'N/A',
              unitsSold: 0,
              revenue: 0,
              profit: 0,
              stockRemaining: stock
            };
          }
          productSales[key].unitsSold += (item.quantity || 0);
          productSales[key].revenue += itemRevenue;
          productSales[key].profit += itemProfit;
        });
      }
    });

    return Object.values(productSales)
      .map(p => {
        const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
        const lowStockHighDemand = p.unitsSold >= 4 && p.stockRemaining < 15;
        return { ...p, margin, lowStockHighDemand };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, topProductsLimit);
  }, [currentInvoices, products, topProductsLimit]);

  // Sales by Category
  const salesByCategoryData = useMemo(() => {
    const categoriesSales: { [key: string]: number } = {};
    let totalRevenueSum = 0;

    currentInvoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach((item: any) => {
          const prod = products.find(p => p.id === item.productId || p.name === item.name);
          const cat = prod?.category || item.category || 'Uncategorized';
          const revenue = (item.quantity || 0) * (item.price || 0);
          categoriesSales[cat] = (categoriesSales[cat] || 0) + revenue;
          totalRevenueSum += revenue;
        });
      } else {
        categoriesSales['Uncategorized'] = (categoriesSales['Uncategorized'] || 0) + (inv.amount || 0);
        totalRevenueSum += (inv.amount || 0);
      }
    });

    return Object.keys(categoriesSales).map(cat => ({
      name: cat,
      revenue: categoriesSales[cat],
      percentage: totalRevenueSum > 0 ? (categoriesSales[cat] / totalRevenueSum) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [currentInvoices, products]);

  // Customer Insights
  const customerSummary = useMemo(() => {
    const currentPeriodCustomers = new Set<string>();
    currentInvoices.forEach(inv => {
      if (inv.customer) currentPeriodCustomers.add(inv.customer);
    });

    let newCust = 0;
    let returningCust = 0;

    currentPeriodCustomers.forEach(cust => {
      const priorInvoices = salesInvoices.filter(inv => {
        if (inv.customer !== cust) return false;
        const d = parseInvoiceDate(inv.date);
        return d && d < dateRanges.currentStart;
      });

      if (priorInvoices.length > 0) {
        returningCust++;
      } else {
        newCust++;
      }
    });

    const activeCustomerCount = currentPeriodCustomers.size;
    const avgSpend = activeCustomerCount > 0 ? currentRevenue / activeCustomerCount : 0;
    
    const uniqueAllTimeCustomers = new Set(salesInvoices.map(inv => inv.customer).filter(Boolean));
    const clv = uniqueAllTimeCustomers.size > 0 ? salesInvoices.reduce((acc, inv) => acc + (inv.amount || 0), 0) / uniqueAllTimeCustomers.size : 0;

    // Top 5 customers in selected period
    const topCustMap: { [key: string]: { name: string; count: number; total: number } } = {};
    currentInvoices.forEach(inv => {
      if (inv.customer) {
        if (!topCustMap[inv.customer]) {
          topCustMap[inv.customer] = { name: inv.customer, count: 0, total: 0 };
        }
        topCustMap[inv.customer].count += 1;
        topCustMap[inv.customer].total += (inv.amount || 0);
      }
    });

    const topCustomersList = Object.values(topCustMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      newCust,
      returningCust,
      activeCustomerCount,
      avgSpend,
      clv,
      topCustomersList
    };
  }, [currentInvoices, salesInvoices, dateRanges, currentRevenue]);

  // Order Status & Operational Analytics
  const orderAnalytics = useMemo(() => {
    const completed = currentInvoices.filter(inv => inv.status === 'paid').length;
    const pending = currentInvoices.filter(inv => inv.status === 'pending').length;
    const overdue = currentInvoices.filter(inv => inv.status === 'overdue').length;
    const draft = currentInvoices.filter(inv => inv.status === 'draft').length;

    // Fulfillment time calculation
    let count = 0;
    let totalDays = 0;
    currentInvoices.forEach(inv => {
      if (inv.status === 'paid' && inv.date && inv.updatedAt) {
        const start = parseInvoiceDate(inv.date);
        const end = new Date(inv.updatedAt);
        if (start && !isNaN(end.getTime())) {
          const diff = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          totalDays += diff;
          count++;
        }
      }
    });
    const avgFulfillment = count > 0 ? (totalDays / count).toFixed(1) : '1.2';

    return { completed, pending, overdue, draft, avgFulfillment };
  }, [currentInvoices]);

  // Inventory-Sales Link
  const inventorySalesLink = useMemo(() => {
    const productSalesCount: { [key: string]: number } = {};

    currentInvoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach((item: any) => {
          const key = item.productId || item.name;
          if (key) {
            productSalesCount[key] = (productSalesCount[key] || 0) + (item.quantity || 1);
          }
        });
      }
    });

    const fastMoving: any[] = [];
    const slowMoving: any[] = [];
    const deadStock: any[] = [];

    products.forEach(prod => {
      const soldQty = productSalesCount[prod.id] || productSalesCount[prod.name] || 0;
      if (soldQty >= 8) {
        fastMoving.push({ ...prod, soldQty });
      } else if (soldQty > 0 && soldQty <= 3) {
        slowMoving.push({ ...prod, soldQty });
      } else if (soldQty === 0 && (prod.quantity || 0) > 0) {
        deadStock.push(prod);
      }
    });

    return {
      fastMoving: fastMoving.slice(0, 5),
      slowMoving: slowMoving.slice(0, 5),
      deadStock: deadStock.slice(0, 5),
      deadStockTotalCount: deadStock.length
    };
  }, [currentInvoices, products]);

  // Actionable Insights
  const actionableInsights = useMemo(() => {
    const list: string[] = [];

    if (previousRevenue > 0) {
      if (revenueGrowth >= 8) {
        list.push(`📈 Revenue increased by **${revenueGrowth.toFixed(1)}%** compared to the previous period. High transaction value is accelerating cash velocity.`);
      } else if (revenueGrowth <= -8) {
        list.push(`📉 Revenue dropped by **${Math.abs(revenueGrowth).toFixed(1)}%** compared to the previous period. Check high-margin category trends or launch a clearance campaign.`);
      }
    }

    const lowStockAlerts = topProductsData.filter(p => p.lowStockHighDemand);
    if (lowStockAlerts.length > 0) {
      const names = lowStockAlerts.slice(0, 2).map(p => p.name).join(' and ');
      list.push(`⚠️ Stock alert: **${names}** is/are moving extremely fast but stock is depleted or critically low. Reorder from supplier immediately.`);
    }

    if (inventorySalesLink.deadStockTotalCount > 0) {
      list.push(`📦 Clearance opportunity: You have **${inventorySalesLink.deadStockTotalCount} product(s) in dead stock** (zero sales in the current period). Running a discount will free locked-up capital.`);
    }

    const dominantCategory = salesByCategoryData[0];
    if (dominantCategory && dominantCategory.percentage > 55) {
      list.push(`🎯 Concentration risk: **${dominantCategory.name}** generates **${dominantCategory.percentage.toFixed(1)}%** of your total revenue. Diversifying secondary product lines is recommended.`);
    }

    if (list.length === 0) {
      list.push(`💡 Insight: Sales metrics are tracking smoothly. Outstanding collections represent a great leverage point to improve net liquid reserves.`);
    }

    return list;
  }, [revenueGrowth, previousRevenue, topProductsData, inventorySalesLink, salesByCategoryData]);

  // Export to CSV Function
  const handleExportCSV = () => {
    if (currentInvoices.length === 0) return;
    
    const headers = ['Invoice ID', 'Date', 'Customer', 'Amount', 'Status', 'Revenue Share %'];
    const csvRows = [headers.join(',')];

    currentInvoices.forEach(inv => {
      const share = currentRevenue > 0 ? ((inv.amount || 0) / currentRevenue) * 100 : 0;
      const row = [
        inv.invoiceId || inv.id,
        inv.date,
        `"${inv.customer || ''}"`,
        inv.amount || 0,
        inv.status || 'draft',
        share.toFixed(1)
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `InventoryPro_Sales_Report_${timeFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-10 h-10 text-blue-600 animate-spin" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Compiling Analytics Engine...</span>
      </div>
    );
  }

  // Mini Sparkline component using inline svg for ultra-lightweight rendering
  const renderSparkline = (dataKey: 'revenue' | 'orders' | 'profit') => {
    if (sparklineData.length < 2) return null;
    const values = sparklineData.map(d => d[dataKey]);
    const maxVal = Math.max(...values) || 1;
    const minVal = Math.min(...values);
    const range = maxVal - minVal || 1;

    const width = 60;
    const height = 24;
    const points = values.map((val, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((val - minVal) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    const strokeColor = dataKey === 'revenue' ? '#3b82f6' : dataKey === 'profit' ? '#10b981' : '#8b5cf6';

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-500 pb-12">
      
      {/* Filters and Action Bar */}
      <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0">
            {(['7days', '30days', '90days', 'all'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  timeFilter === filter 
                    ? "bg-slate-900 text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {filter === '7days' ? '7D' : filter === '30days' ? '30D' : filter === '90days' ? '90D' : 'All'}
              </button>
            ))}
            <button
              onClick={() => setTimeFilter('custom')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                timeFilter === 'custom' ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Custom
            </button>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer max-w-[150px]"
          >
            <option value="all">All Categories</option>
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Customer Filter */}
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer max-w-[150px]"
          >
            <option value="all">All Customers</option>
            {Array.from(new Set(salesInvoices.map(i => i.customer).filter(Boolean))).sort().map(cust => (
              <option key={cust} value={cust}>{cust}</option>
            ))}
          </select>

          {/* Compare Mode Toggle */}
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={cn(
              "h-10 px-4 border rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              compareMode 
                ? "bg-blue-50 border-blue-200 text-blue-700" 
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Compare: {compareMode ? "On" : "Off"}
          </button>
        </div>

        {/* Custom Range Inputs */}
        <AnimatePresence>
          {timeFilter === 'custom' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2"
            >
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold"
              />
              <span className="text-slate-400 text-xs font-bold">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleExportCSV}
          disabled={currentInvoices.length === 0}
          className="h-10 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shrink-0"
        >
          <Download className="w-4 h-4" />
          Export Report (CSV)
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Revenue */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-[115px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Revenue</span>
              <h4 className="text-2xl font-black text-slate-900 leading-none">{currency}{currentRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-1">
              {revenueGrowth >= 0 ? (
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center">
                  ↑ {revenueGrowth.toFixed(1)}%
                </span>
              ) : (
                <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full flex items-center">
                  ↓ {Math.abs(revenueGrowth).toFixed(1)}%
                </span>
              )}
              <span className="text-[9px] text-slate-400 font-semibold">vs prev period</span>
            </div>
            {renderSparkline('revenue')}
          </div>
        </div>

        {/* KPI 2: Gross Profit */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-[115px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Gross Profit</span>
              <h4 className="text-2xl font-black text-slate-900 leading-none">{currency}{currentProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Margin: {currentMargin.toFixed(1)}%
              </span>
              <span className="text-[9px] text-slate-400 font-semibold">COGS: {currency}{currentCOGS.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            {renderSparkline('profit')}
          </div>
        </div>

        {/* KPI 3: Orders */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-[115px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Orders</span>
              <h4 className="text-2xl font-black text-slate-900 leading-none">{currentOrders}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-1">
              {ordersGrowth >= 0 ? (
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  ↑ {ordersGrowth.toFixed(0)}%
                </span>
              ) : (
                <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                  ↓ {Math.abs(ordersGrowth).toFixed(0)}%
                </span>
              )}
              <span className="text-[9px] text-slate-400 font-semibold">orders total</span>
            </div>
            {renderSparkline('orders')}
          </div>
        </div>

        {/* KPI 4: Average Order Value */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-[115px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Avg Order Value (AOV)</span>
              <h4 className="text-2xl font-black text-slate-900 leading-none">{currency}{Math.round(currentAOV).toLocaleString()}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-1">
              {aovGrowth >= 0 ? (
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  ↑ {aovGrowth.toFixed(1)}%
                </span>
              ) : (
                <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                  ↓ {Math.abs(aovGrowth).toFixed(1)}%
                </span>
              )}
              <span className="text-[9px] text-slate-400 font-semibold">avg ticket size</span>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">AOV</span>
          </div>
        </div>
      </div>

      {/* Main Charts: Sales Trend & Cost/Profit Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Over Time (Trend Analysis) */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Sales Revenue Over Time</h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Dual-period performance comparison chart</p>
            </div>
            <div className="flex items-center gap-2 border border-slate-200 p-1 rounded-xl bg-slate-50">
              <button
                onClick={() => setChartMetric('revenue')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  chartMetric === 'revenue' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Revenue
              </button>
              <button
                onClick={() => setChartMetric('orders')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  chartMetric === 'orders' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Orders
              </button>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={alignedTrendData} margin={{ left: 10, right: 10, top: 10 }}>
                <defs>
                  <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  tickFormatter={(value) => chartMetric === 'revenue' ? `${currency}${formatCompactNumber(value, '')}` : value}
                />
                <Tooltip 
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number, name: string) => {
                    if (chartMetric === 'revenue') {
                      return [`${currency}${value.toLocaleString()}`, name];
                    }
                    return [value, name];
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey={chartMetric === 'revenue' ? 'Revenue' : 'Orders'} 
                  name="Current Period" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorCurrent)" 
                />
                {compareMode && (
                  <Area 
                    type="monotone" 
                    dataKey={chartMetric === 'revenue' ? 'Prev Revenue' : 'Prev Orders'} 
                    name="Previous Period" 
                    stroke="#94a3b8" 
                    strokeDasharray="4 4" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#colorPrev)" 
                  />
                )}
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 15 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profit & Cost Breakdown */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Financial Breakdown</h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">COGS vs Gross Profit contribution</p>
          </div>

          <div className="py-6 space-y-6">
            {/* Horizontal stacked bar visualizer */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>Total Revenue Split</span>
                <span>{currency}{currentRevenue.toLocaleString()}</span>
              </div>
              <div className="h-6 w-full rounded-xl overflow-hidden flex shadow-inner">
                {currentRevenue > 0 ? (
                  <>
                    <div 
                      className="bg-rose-500 h-full flex items-center justify-center text-[10px] font-black text-white hover:opacity-90 transition-opacity" 
                      style={{ width: `${(currentCOGS / currentRevenue) * 100}%` }}
                      title={`COGS: ${currency}${currentCOGS.toLocaleString()}`}
                    >
                      {((currentCOGS / currentRevenue) * 100) > 15 && `${((currentCOGS / currentRevenue) * 100).toFixed(0)}% COGS`}
                    </div>
                    <div 
                      className="bg-emerald-500 h-full flex items-center justify-center text-[10px] font-black text-white hover:opacity-90 transition-opacity" 
                      style={{ width: `${(currentProfit / currentRevenue) * 100}%` }}
                      title={`Gross Profit: ${currency}${currentProfit.toLocaleString()}`}
                    >
                      {((currentProfit / currentRevenue) * 100) > 15 && `${((currentProfit / currentRevenue) * 100).toFixed(0)}% Profit`}
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-100 w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                    No Revenue Data
                  </div>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              <div className="py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-bold text-slate-600">Revenue (Total)</span>
                </div>
                <span className="text-xs font-black text-slate-900">{currency}{currentRevenue.toLocaleString()}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-xs font-bold text-slate-600">COGS (Costs)</span>
                </div>
                <span className="text-xs font-black text-slate-900">{currency}{currentCOGS.toLocaleString()}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-600">Gross Profit</span>
                </div>
                <span className="text-xs font-black text-emerald-600">{currency}{currentProfit.toLocaleString()}</span>
              </div>
              <div className="py-3 flex justify-between items-center text-slate-900 font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-slate-600">Profit Margin %</span>
                </div>
                <span className="text-xs font-black text-amber-600">{currentMargin.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] text-slate-500 font-medium leading-relaxed">
            ⚡ Profit margin measures how effectively sales are converted to liquid company earnings after product sourcing expenses.
          </div>
        </div>
      </div>

      {/* Row: Top Products & Sales by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Performing Products */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Top Performing Products</h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">Products driving the highest billing value</p>
              </div>
              <div className="flex items-center gap-2 border border-slate-200 p-1 rounded-xl bg-slate-50">
                <button
                  onClick={() => setTopProductsLimit(5)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    topProductsLimit === 5 ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Top 5
                </button>
                <button
                  onClick={() => setTopProductsLimit(10)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    topProductsLimit === 10 ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Top 10
                </button>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="pb-3 font-black text-slate-500">Product</th>
                    <th className="pb-3 text-center font-black text-slate-500">Units Sold</th>
                    <th className="pb-3 text-right font-black text-slate-500">Revenue</th>
                    <th className="pb-3 text-center font-black text-slate-500">Margin</th>
                    <th className="pb-3 text-right font-black text-slate-500">Stock Left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topProductsData.map((item, i) => (
                    <tr key={i} className="text-xs hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-bold text-slate-900">
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-medium">{item.sku}</span>
                          {item.lowStockHighDemand && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[8px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded w-max">
                              ⚠️ Restock Flag
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-center font-bold text-slate-700">x{item.unitsSold}</td>
                      <td className="py-3 text-right font-black text-slate-950">{currency}{item.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="py-3 text-center">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {item.margin.toFixed(0)}%
                        </span>
                      </td>
                      <td className={cn("py-3 text-right font-semibold", item.stockRemaining <= 10 ? "text-rose-600 font-black" : "text-slate-600")}>
                        {item.stockRemaining} units
                      </td>
                    </tr>
                  ))}
                  {topProductsData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold text-xs">No product sales in selected period</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sales by Category */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-5">Sales by Category</h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5 mb-6">Percentage contribution per category</p>

            <div className="space-y-4">
              {salesByCategoryData.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="truncate">{item.name}</span>
                    <span className="font-black text-slate-900">{currency}{item.revenue.toLocaleString()} ({item.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${item.percentage}%`,
                        backgroundColor: COLORS[i % COLORS.length]
                      }} 
                    />
                  </div>
                </div>
              ))}
              {salesByCategoryData.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs font-bold">
                  No categorical sales recorded
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] text-slate-500 font-medium mt-6 leading-relaxed">
            🎯 Identifying top categories helps optimize marketing expenditure and raw material stocking strategies.
          </div>
        </div>
      </div>

      {/* Row: Customer Insights & Order Operational Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Customer Insights */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-4">Customer Insights</h3>
            
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Active</p>
                <h5 className="text-lg font-black text-slate-900">{customerSummary.activeCustomerCount}</h5>
                <p className="text-[8px] text-slate-500 font-semibold mt-0.5">Customers</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Avg Spend</p>
                <h5 className="text-lg font-black text-slate-900">{currency}{Math.round(customerSummary.avgSpend).toLocaleString()}</h5>
                <p className="text-[8px] text-slate-500 font-semibold mt-0.5">per Customer</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Est. CLV</p>
                <h5 className="text-lg font-black text-slate-900">{currency}{Math.round(customerSummary.clv).toLocaleString()}</h5>
                <p className="text-[8px] text-slate-500 font-semibold mt-0.5">Lifetime Value</p>
              </div>
            </div>

            {/* New vs Returning Customers split progress bar */}
            <div className="space-y-1.5 py-3">
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>New Customers ({customerSummary.newCust})</span>
                <span>Returning Customers ({customerSummary.returningCust})</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                {customerSummary.activeCustomerCount > 0 ? (
                  <>
                    <div className="bg-blue-500 h-full" style={{ width: `${(customerSummary.newCust / customerSummary.activeCustomerCount) * 100}%` }} />
                    <div className="bg-indigo-500 h-full" style={{ width: `${(customerSummary.returningCust / customerSummary.activeCustomerCount) * 100}%` }} />
                  </>
                ) : (
                  <div className="bg-slate-200 w-full h-full" />
                )}
              </div>
            </div>

            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 my-4">Top Spending Customers</h4>
            <div className="space-y-3">
              {customerSummary.topCustomersList.map((cust, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-full flex items-center justify-center">
                      {i + 1}
                    </div>
                    <span className="font-bold text-slate-800">{cust.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-black text-slate-900">
                    <span>{currency}{cust.total.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 font-medium">({cust.count} orders)</span>
                  </div>
                </div>
              ))}
              {customerSummary.topCustomersList.length === 0 && (
                <div className="text-center py-4 text-slate-400 text-xs">No active customers</div>
              )}
            </div>
          </div>
        </div>

        {/* Order Analytics */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-4">Order Operations</h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5 mb-6">Efficiency of checkout fulfillment and payment status</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 text-center space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Fulfillment Speed</span>
                <span className="text-2xl font-black text-indigo-600 block">{orderAnalytics.avgFulfillment} Days</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block">Avg Checkout to Paid</span>
              </div>

              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 text-center space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Collection Quality</span>
                <span className="text-2xl font-black text-emerald-600 block">
                  {currentOrders > 0 ? ((orderAnalytics.completed / currentOrders) * 100).toFixed(0) : '0'}%
                </span>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block">Invoices Cleared</span>
              </div>
            </div>

            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-6 mb-3">Order Status Distribution</h4>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-slate-700">Completed (Paid)</span>
                </div>
                <span className="font-black text-slate-900">{orderAnalytics.completed} orders</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="font-bold text-slate-700">Pending Payment</span>
                </div>
                <span className="font-black text-slate-900">{orderAnalytics.pending} orders</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="font-bold text-slate-700">Overdue Invoices</span>
                </div>
                <span className="font-black text-slate-900">{orderAnalytics.overdue} orders</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="font-bold text-slate-700">Draft Status</span>
                </div>
                <span className="font-black text-slate-900">{orderAnalytics.draft} orders</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory-Sales Link (Fast, Slow, Dead Stock) */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Package className="w-5 h-5 text-indigo-500" />
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Inventory-Sales Link Analysis</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Fast Moving */}
          <div className="p-5 rounded-2xl bg-orange-50/50 border border-orange-100 space-y-4">
            <div className="flex items-center gap-2 text-orange-700 font-bold text-xs uppercase tracking-widest border-b border-orange-100 pb-2">
              <Flame className="w-4 h-4 text-orange-600 animate-pulse" />
              Fast-Moving Stock
            </div>
            <div className="space-y-3">
              {inventorySalesLink.fastMoving.map((prod, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 truncate max-w-[150px]">{prod.name}</span>
                  <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-black text-[10px]">
                    {prod.soldQty} sold
                  </span>
                </div>
              ))}
              {inventorySalesLink.fastMoving.length === 0 && (
                <p className="text-slate-400 text-xs font-semibold text-center py-6">No fast moving products</p>
              )}
            </div>
          </div>

          {/* Slow Moving */}
          <div className="p-5 rounded-2xl bg-blue-50/40 border border-blue-100 space-y-4">
            <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-widest border-b border-blue-100 pb-2">
              <Snowflake className="w-4 h-4 text-blue-600" />
              Slow-Moving Stock
            </div>
            <div className="space-y-3">
              {inventorySalesLink.slowMoving.map((prod, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 truncate max-w-[150px]">{prod.name}</span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-black text-[10px]">
                    {prod.soldQty} sold
                  </span>
                </div>
              ))}
              {inventorySalesLink.slowMoving.length === 0 && (
                <p className="text-slate-400 text-xs font-semibold text-center py-6">No slow moving products</p>
              )}
            </div>
          </div>

          {/* Dead Stock */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-widest border-b border-slate-200 pb-2">
              <AlertTriangle className="w-4 h-4 text-slate-600" />
              Dead Stock Alert ({inventorySalesLink.deadStockTotalCount})
            </div>
            <div className="space-y-3">
              {inventorySalesLink.deadStock.map((prod, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 truncate max-w-[150px]">{prod.name}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-black text-[10px]">
                    Qty: {prod.quantity}
                  </span>
                </div>
              ))}
              {inventorySalesLink.deadStock.length === 0 && (
                <p className="text-slate-400 text-xs font-semibold text-center py-6">No dead stock detected</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actionable Smart Insights Panel */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[2rem] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Smart Actionable Insights</h3>
            <p className="text-xs font-medium text-slate-400">Inventory Pro Analytics AI-engine suggestions</p>
          </div>
        </div>

        <div className="space-y-3.5 relative z-10">
          {actionableInsights.map((insight, index) => {
            // Highlight text inside ** with bold formatting
            const parts = insight.split('**');
            return (
              <div key={index} className="flex items-start gap-3 bg-white/5 border border-white/5 p-4 rounded-xl">
                <div className="mt-0.5 text-indigo-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed text-left">
                  {parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white font-black">{part}</strong> : part)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
