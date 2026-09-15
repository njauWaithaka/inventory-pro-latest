import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  writeBatch 
} from 'firebase/firestore';
import { db } from './firebase';

export interface DemoStatus {
  isInitialized: boolean;
  workspaceId: string;
}

/**
 * Checks if the demo workspace for the given anonymous UID has already been initialized.
 */
export async function isDemoWorkspaceInitialized(workspaceId: string): Promise<boolean> {
  if (!workspaceId) return false;
  try {
    const compDoc = await getDoc(doc(db, 'companies', workspaceId));
    if (compDoc.exists()) {
      const data = compDoc.data();
      return Boolean(data.demoInitialized);
    }
    return false;
  } catch (err) {
    console.warn("Could not check demo workspace initialization:", err);
    return false;
  }
}

/**
 * Seeds a full, realistic retail workspace for an anonymous visitor.
 * Only called once per anonymous UID unless reset.
 */
export async function seedDemoWorkspace(workspaceId: string, preferredCurrency: string = 'KSh'): Promise<void> {
  if (!workspaceId) throw new Error("Missing demo workspace ID");

  const now = new Date();
  const currency = preferredCurrency || 'KSh';

  // 1. Create Company / Workspace Root Document
  const companyRef = doc(db, 'companies', workspaceId);
  await setDoc(companyRef, {
    id: workspaceId,
    name: 'Apex Retail & Tech (Demo)',
    ownerId: workspaceId,
    plan: 'enterprise',
    currency,
    timezone: 'Nairobi',
    address: 'Westlands Commercial Centre, Block B',
    phone: '+254 712 345 678',
    kraPin: 'P051234567X',
    createdAt: new Date(now.getTime() - 45 * 86400000).toISOString(),
    isDemo: true,
    demoInitialized: true,
    accountType: 'demo'
  }, { merge: true });

  // 2. Create Membership Document
  await setDoc(doc(db, 'companies', workspaceId, 'members', workspaceId), {
    role: 'owner',
    joinedAt: now.toISOString(),
    isDemo: true
  }, { merge: true });

  // 3. Create or update user profile
  await setDoc(doc(db, 'users', workspaceId), {
    userId: workspaceId,
    name: 'Demo Store Manager',
    email: 'guest-demo@aquivo.app',
    role: 'Owner',
    companyId: workspaceId,
    hasConfigured: true,
    isDemo: true,
    accountType: 'demo',
    createdAt: now.toISOString(),
  }, { merge: true });

  // 4. Batch 1: Categories, Suppliers, Customers
  const batch1 = writeBatch(db);

  const categories = [
    { id: 'cat_audio', name: 'Audio & Acoustics', description: 'Studio monitors, wireless audio & sound gear' },
    { id: 'cat_peripherals', name: 'Computer Peripherals', description: 'Keyboards, mice, docks and ergonomic gear' },
    { id: 'cat_power', name: 'Power & Cables', description: 'Fast chargers, battery banks and heavy-duty cables' },
    { id: 'cat_wearables', name: 'Smart Wearables', description: 'Fitness trackers, sports watches and accessories' },
    { id: 'cat_storage', name: 'Storage & Drives', description: 'High-speed SSDs, SD cards and backup media' },
  ];

  for (const cat of categories) {
    const ref = doc(db, `companies/${workspaceId}/categories`, cat.id);
    batch1.set(ref, { ...cat, createdAt: now.toISOString() });
  }

  const suppliers = [
    {
      id: 'sup_omnidirect',
      name: 'OmniDirect Distribution EA',
      email: 'orders@omnidirect.co.ke',
      phone: '+254 20 690 1000',
      kraPin: 'P051239845X',
      contactPerson: 'Dennis Mutua',
      leadTimeDays: 7,
      paymentTerms: 'Net 30',
      address: 'Industrial Area Road A, Nairobi',
      rating: 4.8,
      status: 'Active',
      createdAt: new Date(now.getTime() - 60 * 86400000).toISOString()
    },
    {
      id: 'sup_apextech',
      name: 'Apex Hardware & Tech Imports',
      email: 'sales@apextech.co.ke',
      phone: '+254 20 780 2200',
      kraPin: 'P051987321Z',
      contactPerson: 'Linda Kamau',
      leadTimeDays: 12,
      paymentTerms: 'Net 15',
      address: 'Mombasa Road Gateway Park, Nairobi',
      rating: 4.5,
      status: 'Active',
      createdAt: new Date(now.getTime() - 60 * 86400000).toISOString()
    },
    {
      id: 'sup_soundwave',
      name: 'SoundWave International',
      email: 'b2b@soundwave.com',
      phone: '+254 705 400 300',
      kraPin: 'P052456789W',
      contactPerson: 'Marcus Vance',
      leadTimeDays: 14,
      paymentTerms: 'Advance 50%',
      address: 'Kilimani Tech Suites, Nairobi',
      rating: 4.7,
      status: 'Active',
      createdAt: new Date(now.getTime() - 60 * 86400000).toISOString()
    }
  ];

  for (const sup of suppliers) {
    const ref = doc(db, `companies/${workspaceId}/suppliers`, sup.id);
    batch1.set(ref, sup);
  }

  const customers = [
    {
      id: 'cust_sarah',
      name: 'Sarah Muthoni',
      email: 'sarah@techhub.africa',
      phone: '+254 722 112 233',
      company: 'TechHub Africa',
      address: 'Westlands, Nairobi',
      totalSpent: 185000,
      orderCount: 8,
      status: 'VIP',
      createdAt: new Date(now.getTime() - 40 * 86400000).toISOString()
    },
    {
      id: 'cust_david',
      name: 'David Ochieng',
      email: 'david.prod@gmail.com',
      phone: '+254 733 445 566',
      company: 'Self-Employed Audio Producer',
      address: 'Lavington, Nairobi',
      totalSpent: 92000,
      orderCount: 4,
      status: 'Regular',
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString()
    },
    {
      id: 'cust_apexcreative',
      name: 'Apex Creative Studio',
      email: 'procurement@apexcreative.co.ke',
      phone: '+254 711 778 899',
      company: 'Apex Creative Studio Ltd',
      address: 'Kilimani, Nairobi',
      totalSpent: 340000,
      orderCount: 12,
      status: 'VIP',
      createdAt: new Date(now.getTime() - 50 * 86400000).toISOString()
    },
    {
      id: 'cust_grace',
      name: 'Grace Wanjiku',
      email: 'grace.w@outlook.com',
      phone: '+254 700 998 877',
      company: 'Individual',
      address: 'Parklands, Nairobi',
      totalSpent: 41000,
      orderCount: 3,
      status: 'Regular',
      createdAt: new Date(now.getTime() - 20 * 86400000).toISOString()
    }
  ];

  for (const cust of customers) {
    const ref = doc(db, `companies/${workspaceId}/customers`, cust.id);
    batch1.set(ref, cust);
  }

  // Expense Categories & Sample Expenses
  const expCategories = [
    { id: 'exp_rent', name: 'Facility & Store Rent', budget: 50000 },
    { id: 'exp_utilities', name: 'Power & Internet', budget: 12000 },
    { id: 'exp_packaging', name: 'Packaging & Bags', budget: 8000 }
  ];

  for (const ec of expCategories) {
    const ref = doc(db, `companies/${workspaceId}/expense_categories`, ec.id);
    batch1.set(ref, ec);
  }

  await batch1.commit();

  // 5. Batch 2: Products (10 items with rich metrics for Reorder, POS, Inventory)
  const batch2 = writeBatch(db);

  const sampleProducts = [
    {
      id: 'prod_mx3s',
      name: 'Logitech MX Master 3S Wireless Mouse',
      sku: 'ACC-LOG-MX3S',
      barcode: '097855160125',
      category: 'Computer Peripherals',
      categoryId: 'cat_peripherals',
      quantity: 26,
      initialStock: 35,
      buyingPrice: 8500,
      costPrice: 8500,
      sellingPrice: 12500,
      value: 26 * 12500,
      movement: 'fast',
      status: 'In Stock',
      reorderPoint: 10,
      safetyStock: 5,
      minStock: 8,
      maxStock: 50,
      leadTimeDays: 7,
      unitsSold: 14,
      uom: 'Piece',
      supplierId: 'sup_omnidirect',
      supplierName: 'OmniDirect Distribution EA',
      lastSold: new Date(now.getTime() - 2 * 3600000).toISOString(),
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'prod_sony_xm5',
      name: 'Sony WH-1000XM5 Noise Canceling Headphones',
      sku: 'AUD-SNY-XM5',
      barcode: '027242923720',
      category: 'Audio & Acoustics',
      categoryId: 'cat_audio',
      quantity: 3, // Critical: stock is <= 3, below reorderPoint 8
      initialStock: 15,
      buyingPrice: 32000,
      costPrice: 32000,
      sellingPrice: 44000,
      value: 3 * 44000,
      movement: 'fast',
      status: 'Critical Stock',
      reorderPoint: 8,
      safetyStock: 4,
      minStock: 5,
      maxStock: 25,
      leadTimeDays: 14,
      unitsSold: 12,
      uom: 'Piece',
      supplierId: 'sup_soundwave',
      supplierName: 'SoundWave International',
      lastSold: new Date(now.getTime() - 5 * 3600000).toISOString(),
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'prod_anker_737',
      name: 'Anker 737 Power Bank (PowerCore 24K)',
      sku: 'PWR-ANK-737',
      barcode: '194644098904',
      category: 'Power & Cables',
      categoryId: 'cat_power',
      quantity: 6, // Reorder Soon: expected to reach reorder point soon
      initialStock: 20,
      buyingPrice: 11000,
      costPrice: 11000,
      sellingPrice: 16500,
      value: 6 * 16500,
      movement: 'moderate',
      status: 'Low Stock',
      reorderPoint: 8,
      safetyStock: 3,
      minStock: 6,
      maxStock: 30,
      leadTimeDays: 10,
      unitsSold: 14,
      uom: 'Piece',
      supplierId: 'sup_omnidirect',
      supplierName: 'OmniDirect Distribution EA',
      lastSold: new Date(now.getTime() - 14 * 3600000).toISOString(),
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'prod_apple_s9',
      name: 'Apple Watch Series 9 GPS 45mm',
      sku: 'WBL-APL-S9-45',
      barcode: '195949038221',
      category: 'Smart Wearables',
      categoryId: 'cat_wearables',
      quantity: 0, // Stockout
      initialStock: 8,
      buyingPrice: 48000,
      costPrice: 48000,
      sellingPrice: 62000,
      value: 0,
      movement: 'fast',
      status: 'Out of Stock',
      reorderPoint: 5,
      safetyStock: 2,
      minStock: 4,
      maxStock: 15,
      leadTimeDays: 12,
      unitsSold: 8,
      uom: 'Piece',
      supplierId: 'sup_apextech',
      supplierName: 'Apex Hardware & Tech Imports',
      lastSold: new Date(now.getTime() - 48 * 3600000).toISOString(),
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'prod_samsung_t7',
      name: 'Samsung T7 Shield 1TB Rugged SSD',
      sku: 'STR-SAM-T7S-1T',
      barcode: '887276634457',
      category: 'Storage & Drives',
      categoryId: 'cat_storage',
      quantity: 19, // Healthy
      initialStock: 25,
      buyingPrice: 12000,
      costPrice: 12000,
      sellingPrice: 17500,
      value: 19 * 17500,
      movement: 'fast',
      status: 'In Stock',
      reorderPoint: 7,
      safetyStock: 3,
      minStock: 5,
      maxStock: 35,
      leadTimeDays: 5,
      unitsSold: 11,
      uom: 'Piece',
      supplierId: 'sup_apextech',
      supplierName: 'Apex Hardware & Tech Imports',
      lastSold: new Date(now.getTime() - 24 * 3600000).toISOString(),
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'prod_keychron_k2',
      name: 'Keychron K2 Pro Mechanical Wireless Keyboard',
      sku: 'ACC-KCH-K2P',
      barcode: '765588392014',
      category: 'Computer Peripherals',
      categoryId: 'cat_peripherals',
      quantity: 9, // Reorder Soon
      initialStock: 16,
      buyingPrice: 9500,
      costPrice: 9500,
      sellingPrice: 14200,
      value: 9 * 14200,
      movement: 'moderate',
      status: 'In Stock',
      reorderPoint: 10,
      safetyStock: 4,
      minStock: 6,
      maxStock: 25,
      leadTimeDays: 14,
      unitsSold: 7,
      uom: 'Piece',
      supplierId: 'sup_omnidirect',
      supplierName: 'OmniDirect Distribution EA',
      lastSold: new Date(now.getTime() - 36 * 3600000).toISOString(),
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'prod_jbl_flip6',
      name: 'JBL Flip 6 Waterproof Bluetooth Speaker',
      sku: 'AUD-JBL-FLP6',
      barcode: '050036384210',
      category: 'Audio & Acoustics',
      categoryId: 'cat_audio',
      quantity: 14, // Healthy
      initialStock: 22,
      buyingPrice: 10500,
      costPrice: 10500,
      sellingPrice: 15000,
      value: 14 * 15000,
      movement: 'fast',
      status: 'In Stock',
      reorderPoint: 6,
      safetyStock: 2,
      minStock: 5,
      maxStock: 30,
      leadTimeDays: 7,
      unitsSold: 9,
      uom: 'Piece',
      supplierId: 'sup_soundwave',
      supplierName: 'SoundWave International',
      lastSold: new Date(now.getTime() - 10 * 3600000).toISOString(),
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'prod_baseus_65w',
      name: 'Baseus 65W GaN USB-C Fast Wall Charger',
      sku: 'PWR-BAS-65W',
      barcode: '693217260541',
      category: 'Power & Cables',
      categoryId: 'cat_power',
      quantity: 38, // Healthy
      initialStock: 50,
      buyingPrice: 2800,
      costPrice: 2800,
      sellingPrice: 4500,
      value: 38 * 4500,
      movement: 'fast',
      status: 'In Stock',
      reorderPoint: 12,
      safetyStock: 5,
      minStock: 10,
      maxStock: 60,
      leadTimeDays: 6,
      unitsSold: 22,
      uom: 'Piece',
      supplierId: 'sup_omnidirect',
      supplierName: 'OmniDirect Distribution EA',
      lastSold: new Date(now.getTime() - 4 * 3600000).toISOString(),
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'prod_sandisk_128',
      name: 'SanDisk Extreme PRO 128GB UHS-I SD Card',
      sku: 'STR-SND-128EP',
      barcode: '619659170325',
      category: 'Storage & Drives',
      categoryId: 'cat_storage',
      quantity: 4, // Critical: stock is 4, reorderPoint 15
      initialStock: 20,
      buyingPrice: 3200,
      costPrice: 3200,
      sellingPrice: 5200,
      value: 4 * 5200,
      movement: 'fast',
      status: 'Critical Stock',
      reorderPoint: 15,
      safetyStock: 5,
      minStock: 8,
      maxStock: 40,
      leadTimeDays: 7,
      unitsSold: 16,
      uom: 'Piece',
      supplierId: 'sup_apextech',
      supplierName: 'Apex Hardware & Tech Imports',
      lastSold: new Date(now.getTime() - 8 * 3600000).toISOString(),
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'prod_ugreen_10in1',
      name: 'Ugreen 10-in-1 USB-C Multiport Docking Station',
      sku: 'ACC-UGR-10IN1',
      barcode: '695730389241',
      category: 'Computer Peripherals',
      categoryId: 'cat_peripherals',
      quantity: 12, // Healthy
      initialStock: 18,
      buyingPrice: 6200,
      costPrice: 6200,
      sellingPrice: 9800,
      value: 12 * 9800,
      movement: 'moderate',
      status: 'In Stock',
      reorderPoint: 8,
      safetyStock: 3,
      minStock: 5,
      maxStock: 25,
      leadTimeDays: 8,
      unitsSold: 6,
      uom: 'Piece',
      supplierId: 'sup_omnidirect',
      supplierName: 'OmniDirect Distribution EA',
      lastSold: new Date(now.getTime() - 18 * 3600000).toISOString(),
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
      updatedAt: now.toISOString()
    }
  ];

  for (const prod of sampleProducts) {
    const ref = doc(db, `companies/${workspaceId}/products`, prod.id);
    batch2.set(ref, prod);
  }

  await batch2.commit();

  // 6. Batch 3: Purchase Orders
  const batch3 = writeBatch(db);

  const po1 = {
    id: 'PO-2026-001',
    poNumber: 'PO-2026-001',
    supplierId: 'sup_omnidirect',
    supplierName: 'OmniDirect Distribution EA',
    date: new Date(now.getTime() - 18 * 86400000).toISOString().split('T')[0],
    orderDate: new Date(now.getTime() - 18 * 86400000).toISOString().split('T')[0],
    deliveryDate: new Date(now.getTime() - 11 * 86400000).toISOString().split('T')[0],
    totalAmount: 166000,
    status: 'RECEIVED',
    items: [
      { productId: 'prod_anker_737', name: 'Anker 737 Power Bank (PowerCore 24K)', quantity: 10, unitPrice: 11000, receivedQuantity: 10 },
      { productId: 'prod_baseus_65w', name: 'Baseus 65W GaN USB-C Fast Wall Charger', quantity: 20, unitPrice: 2800, receivedQuantity: 20 }
    ],
    notes: 'Q1 Restock fulfillment. All delivered in pristine condition.',
    createdBy: workspaceId,
    createdByName: 'Demo Store Manager',
    createdAt: new Date(now.getTime() - 18 * 86400000).toISOString()
  };

  const po2 = {
    id: 'PO-2026-002',
    poNumber: 'PO-2026-002',
    supplierId: 'sup_apextech',
    supplierName: 'Apex Hardware & Tech Imports',
    date: new Date(now.getTime() - 3 * 86400000).toISOString().split('T')[0],
    orderDate: new Date(now.getTime() - 3 * 86400000).toISOString().split('T')[0],
    expectedDeliveryDate: new Date(now.getTime() + 4 * 86400000).toISOString().split('T')[0],
    totalAmount: 447500,
    status: 'APPROVED',
    items: [
      { productId: 'prod_sony_xm5', name: 'Sony WH-1000XM5 Noise Canceling Headphones', quantity: 10, unitPrice: 32000, receivedQuantity: 0 },
      { productId: 'prod_mx3s', name: 'Logitech MX Master 3S Wireless Mouse', quantity: 15, unitPrice: 8500, receivedQuantity: 0 }
    ],
    notes: 'Urgent restock to resolve critical inventory levels for XM5 & MX3S.',
    createdBy: workspaceId,
    createdByName: 'Demo Store Manager',
    createdAt: new Date(now.getTime() - 3 * 86400000).toISOString()
  };

  batch3.set(doc(db, `companies/${workspaceId}/purchaseOrders`, po1.id), po1);
  batch3.set(doc(db, `companies/${workspaceId}/purchaseOrders`, po2.id), po2);

  await batch3.commit();

  // 7. Batch 4: Sales History, Receipts, Invoices & Stock Movements
  const batch4 = writeBatch(db);

  const historicalSales = [
    {
      daysAgo: 0,
      hoursAgo: 2,
      customer: 'Sarah Muthoni',
      customerPhone: '+254 722 112 233',
      paymentMethod: 'mpesa',
      mpesaCode: 'QK89X4120',
      items: [
        { id: 'prod_mx3s', productId: 'prod_mx3s', name: 'Logitech MX Master 3S Wireless Mouse', quantity: 1, price: 12500, buyingPrice: 8500, cost: 8500, sku: 'ACC-LOG-MX3S' },
        { id: 'prod_baseus_65w', productId: 'prod_baseus_65w', name: 'Baseus 65W GaN USB-C Fast Wall Charger', quantity: 1, price: 4500, buyingPrice: 2800, cost: 2800, sku: 'PWR-BAS-65W' }
      ]
    },
    {
      daysAgo: 1,
      hoursAgo: 16,
      customer: 'David Ochieng',
      customerPhone: '+254 733 445 566',
      paymentMethod: 'cash',
      items: [
        { id: 'prod_samsung_t7', productId: 'prod_samsung_t7', name: 'Samsung T7 Shield 1TB Rugged SSD', quantity: 1, price: 17500, buyingPrice: 12000, cost: 12000, sku: 'STR-SAM-T7S-1T' },
        { id: 'prod_ugreen_10in1', productId: 'prod_ugreen_10in1', name: 'Ugreen 10-in-1 USB-C Multiport Docking Station', quantity: 1, price: 9800, buyingPrice: 6200, cost: 6200, sku: 'ACC-UGR-10IN1' }
      ]
    },
    {
      daysAgo: 2,
      hoursAgo: 20,
      customer: 'Walk-in Customer',
      customerPhone: '',
      paymentMethod: 'mpesa',
      mpesaCode: 'QJ72M9918',
      items: [
        { id: 'prod_baseus_65w', productId: 'prod_baseus_65w', name: 'Baseus 65W GaN USB-C Fast Wall Charger', quantity: 2, price: 4500, buyingPrice: 2800, cost: 2800, sku: 'PWR-BAS-65W' }
      ]
    },
    {
      daysAgo: 3,
      hoursAgo: 14,
      customer: 'Apex Creative Studio',
      customerPhone: '+254 711 778 899',
      paymentMethod: 'bank',
      items: [
        { id: 'prod_keychron_k2', productId: 'prod_keychron_k2', name: 'Keychron K2 Pro Mechanical Wireless Keyboard', quantity: 1, price: 14200, buyingPrice: 9500, cost: 9500, sku: 'ACC-KCH-K2P' }
      ]
    },
    {
      daysAgo: 4,
      hoursAgo: 18,
      customer: 'Grace Wanjiku',
      customerPhone: '+254 700 998 877',
      paymentMethod: 'mpesa',
      mpesaCode: 'QH44T1023',
      items: [
        { id: 'prod_sony_xm5', productId: 'prod_sony_xm5', name: 'Sony WH-1000XM5 Noise Canceling Headphones', quantity: 1, price: 44000, buyingPrice: 32000, cost: 32000, sku: 'AUD-SNY-XM5' }
      ]
    },
    {
      daysAgo: 5,
      hoursAgo: 10,
      customer: 'Walk-in Customer',
      customerPhone: '',
      paymentMethod: 'cash',
      items: [
        { id: 'prod_jbl_flip6', productId: 'prod_jbl_flip6', name: 'JBL Flip 6 Waterproof Bluetooth Speaker', quantity: 1, price: 15000, buyingPrice: 10500, cost: 10500, sku: 'AUD-JBL-FLP6' },
        { id: 'prod_sandisk_128', productId: 'prod_sandisk_128', name: 'SanDisk Extreme PRO 128GB UHS-I SD Card', quantity: 1, price: 5200, buyingPrice: 3200, cost: 3200, sku: 'STR-SND-128EP' }
      ]
    },
    {
      daysAgo: 7,
      hoursAgo: 15,
      customer: 'Sarah Muthoni',
      customerPhone: '+254 722 112 233',
      paymentMethod: 'mpesa',
      mpesaCode: 'QF11R7724',
      items: [
        { id: 'prod_mx3s', productId: 'prod_mx3s', name: 'Logitech MX Master 3S Wireless Mouse', quantity: 1, price: 12500, buyingPrice: 8500, cost: 8500, sku: 'ACC-LOG-MX3S' }
      ]
    },
    {
      daysAgo: 9,
      hoursAgo: 12,
      customer: 'David Ochieng',
      customerPhone: '+254 733 445 566',
      paymentMethod: 'mpesa',
      mpesaCode: 'QD99P4301',
      items: [
        { id: 'prod_apple_s9', productId: 'prod_apple_s9', name: 'Apple Watch Series 9 GPS 45mm', quantity: 1, price: 62000, buyingPrice: 48000, cost: 48000, sku: 'WBL-APL-S9-45' }
      ]
    }
  ];

  let saleCounter = 100;
  for (const sale of historicalSales) {
    saleCounter++;
    const saleTimestamp = new Date(now.getTime() - (sale.daysAgo * 86400000 + sale.hoursAgo * 3600000));
    const isoDate = saleTimestamp.toISOString();
    const dateStr = isoDate.split('T')[0];

    const subtotal = sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cogs = sale.items.reduce((sum, item) => sum + (item.buyingPrice * item.quantity), 0);
    const grossProfit = subtotal - cogs;
    const receiptId = `RCP-DEMO-${saleCounter}`;
    const invoiceId = `INV-DEMO-${saleCounter}`;

    // 1. Receipt
    const receiptData = {
      id: receiptId,
      receiptId,
      invoiceId,
      customerName: sale.customer,
      customerPhone: sale.customerPhone,
      items: sale.items.map(it => ({
        ...it,
        total: it.price * it.quantity,
        cogs: it.buyingPrice * it.quantity,
        grossProfit: (it.price - it.buyingPrice) * it.quantity
      })),
      subtotal,
      tax: 0,
      total: subtotal,
      cogs,
      grossProfit,
      netProfit: grossProfit,
      marginPct: subtotal > 0 ? (grossProfit / subtotal) * 100 : 0,
      paymentMethod: sale.paymentMethod,
      mpesaCode: sale.mpesaCode || '',
      cashier: 'Demo Store Manager',
      cashierId: workspaceId,
      status: 'PAID',
      date: dateStr,
      createdAt: isoDate,
      timestamp: isoDate
    };
    batch4.set(doc(db, `companies/${workspaceId}/receipts`, receiptId), receiptData);

    // 2. Invoice
    const invoiceData = {
      id: invoiceId,
      invoiceNumber: invoiceId,
      customer: sale.customer,
      customerName: sale.customer,
      customerPhone: sale.customerPhone,
      amount: subtotal,
      total: subtotal,
      subtotal,
      cogs,
      grossProfit,
      items: sale.items,
      status: 'PAID',
      paymentStatus: 'PAID',
      paymentMethod: sale.paymentMethod,
      dueDate: dateStr,
      date: dateStr,
      createdAt: isoDate
    };
    batch4.set(doc(db, `companies/${workspaceId}/invoices`, invoiceId), invoiceData);

    // 3. Sales records & Stock Movement records for each item
    for (const item of sale.items) {
      const saleRecId = `sale_${saleCounter}_${item.id}`;
      batch4.set(doc(db, `companies/${workspaceId}/sales`, saleRecId), {
        id: saleRecId,
        saleId: saleRecId,
        productId: item.id,
        productName: item.name,
        quantitySold: item.quantity,
        sellingPrice: item.price,
        unitCost: item.buyingPrice,
        costPrice: item.buyingPrice,
        grossSales: item.price * item.quantity,
        netSales: item.price * item.quantity,
        cogs: item.buyingPrice * item.quantity,
        profit: (item.price - item.buyingPrice) * item.quantity,
        netProfit: (item.price - item.buyingPrice) * item.quantity,
        totalAmount: item.price * item.quantity,
        saleDate: dateStr,
        customerName: sale.customer,
        paymentMethod: sale.paymentMethod,
        status: 'PAID',
        receiptId,
        invoiceId,
        createdAt: isoDate
      });

      const movementId = `mov_${saleCounter}_${item.id}`;
      batch4.set(doc(db, `companies/${workspaceId}/stockMovements`, movementId), {
        id: movementId,
        productId: item.id,
        productName: item.name,
        sku: item.sku,
        type: 'sale',
        quantity: item.quantity,
        beforeQty: 20,
        afterQty: 20 - item.quantity,
        reference: receiptId,
        referenceId: receiptId,
        transactionType: 'POS Sale',
        createdBy: 'Demo Store Manager',
        userId: workspaceId,
        createdAt: isoDate,
        timestamp: isoDate
      });
    }
  }

  // Sample Expenses
  const expenses = [
    {
      id: 'exp_01',
      title: 'Monthly Store Lease - Westlands',
      category: 'Facility & Store Rent',
      categoryId: 'exp_rent',
      amount: 45000,
      paymentMethod: 'bank',
      date: new Date(now.getTime() - 10 * 86400000).toISOString().split('T')[0],
      createdAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
      status: 'PAID'
    },
    {
      id: 'exp_02',
      title: 'Fiber Internet & POS Network',
      category: 'Power & Internet',
      categoryId: 'exp_utilities',
      amount: 6500,
      paymentMethod: 'mpesa',
      date: new Date(now.getTime() - 8 * 86400000).toISOString().split('T')[0],
      createdAt: new Date(now.getTime() - 8 * 86400000).toISOString(),
      status: 'PAID'
    }
  ];

  for (const exp of expenses) {
    batch4.set(doc(db, `companies/${workspaceId}/expenses`, exp.id), exp);
  }

  await batch4.commit();
}

/**
 * Resets an anonymous visitor's demo workspace by deleting subcollections
 * and re-seeding default demo business data.
 */
export async function resetDemoWorkspace(workspaceId: string, preferredCurrency: string = 'KSh'): Promise<void> {
  if (!workspaceId) throw new Error("Missing demo workspace ID");

  const subcollectionsToDelete = [
    'products',
    'sales',
    'receipts',
    'invoices',
    'stockMovements',
    'customers',
    'suppliers',
    'purchaseOrders',
    'categories',
    'expenses',
    'expense_categories',
    'quotations',
    'delivery_notes',
    'reservations'
  ];

  for (const subcol of subcollectionsToDelete) {
    try {
      const snap = await getDocs(collection(db, `companies/${workspaceId}/${subcol}`));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      console.warn(`Could not clear subcollection ${subcol}:`, err);
    }
  }

  // Re-seed original demo data
  await seedDemoWorkspace(workspaceId, preferredCurrency);
}
