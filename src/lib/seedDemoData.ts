import { db } from './firebase';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';

export async function seedDemoShopData(companyId: string, userId: string) {
  if (!companyId) throw new Error('Company ID is required to seed demo data.');

  const now = Date.now();
  const dayMs = 86400000;

  // We will split into batches to respect Firestore batch limits (max 500 ops per batch)
  const batch1 = writeBatch(db);

  // 1. Seed Categories
  const categories = [
    { id: 'cat_01', name: 'Electronics & Accessories', description: 'Peripherals, cables, and computer hardware' },
    { id: 'cat_02', name: 'Displays & Hardware', description: 'Monitors, screens, arms, and mounts' },
    { id: 'cat_03', name: 'Audio Gear', description: 'Headsets, noise-canceling headphones, and mics' },
    { id: 'cat_04', name: 'Office Furniture & Ergonomics', description: 'Ergonomic stands, chairs, desks, and mounts' },
    { id: 'cat_05', name: 'Storage & Cables', description: 'SSD drives, USB hubs, and Thunderbolt cables' }
  ];

  for (const c of categories) {
    const cRef = doc(db, `companies/${companyId}/categories`, c.id);
    batch1.set(cRef, c, { merge: true });
  }

  // 2. Seed Customers
  const customers = [
    { id: 'cust_01', name: 'Acme Technology Corp', email: 'procurement@acme.com', phone: '+254 712 345678', category: 'Corporate', segment: 'Corporate', address: 'Westlands, Nairobi' },
    { id: 'cust_02', name: 'Downtown Walk-in Client', email: 'walkin@retail.com', phone: '+254 700 000000', category: 'Retail', segment: 'Retail', address: 'CBD, Nairobi' },
    { id: 'cust_03', name: 'Global Solutions VIP', email: 'info@globalsolutions.co.ke', phone: '+254 733 999888', category: 'VIP', segment: 'VIP', address: 'Kilimani, Nairobi' },
    { id: 'cust_04', name: 'Safari Logistics Ltd', email: 'fleet@safarilogistics.com', phone: '+254 720 111222', category: 'Wholesale', segment: 'Wholesale', address: 'Mombasa Road, Nairobi' },
    { id: 'cust_05', name: 'Horizon Creative Agency', email: 'studio@horizon.co.ke', phone: '+254 715 444333', category: 'Corporate', segment: 'Corporate', address: 'Lavington, Nairobi' }
  ];

  for (const cust of customers) {
    const custRef = doc(db, `companies/${companyId}/customers`, cust.id);
    batch1.set(custRef, cust, { merge: true });
  }

  // 3. Seed Suppliers
  const suppliers = [
    { id: 'sup_demo_01', name: 'TechDistributors East Africa', email: 'orders@techdistributors.co.ke', phone: '+254 711 000111', rating: 'A+', leadTimeDays: 3, moq: 10, orderMultiple: 5, address: 'Industrial Area, Nairobi' },
    { id: 'sup_demo_02', name: 'Global Display Logistics', email: 'sales@globaldisplay.com', phone: '+254 722 000222', rating: 'A', leadTimeDays: 5, moq: 2, orderMultiple: 1, address: 'Mombasa Port Rd' },
    { id: 'sup_demo_03', name: 'Silicon Core Imports', email: 'supply@siliconcore.io', phone: '+254 735 333444', rating: 'B+', leadTimeDays: 7, moq: 5, orderMultiple: 2, address: 'Eldoret Logistics Hub' }
  ];

  for (const s of suppliers) {
    const supRef = doc(db, `companies/${companyId}/suppliers`, s.id);
    batch1.set(supRef, s, { merge: true });
  }

  // 4. Seed Products (Rich cost/price structure for Profit, ABC/XYZ, Reorder, and Turnover calculations)
  const products = [
    {
      id: 'prod_demo_01',
      productId: 'prod_demo_01',
      name: 'Wireless Ergonomic Vertical Mouse',
      productName: 'Wireless Ergonomic Vertical Mouse',
      sku: 'SKU-LOG-001',
      barcode: '6001234567891',
      category: 'Electronics & Accessories',
      brand: 'Logitech',
      materialGroup: 'Finished Goods',
      uom: 'Piece',
      quantity: 45,
      currentStock: 45,
      initialStock: 100,
      openingStock: 100,
      unitsSold: 55,
      unitsReceived: 100,
      minStock: 15,
      maxStock: 120,
      reorderPoint: 20,
      reorderLevel: 20,
      safetyStock: 8,
      leadTimeDays: 3,
      supplierLeadTime: 3,
      supplierId: 'sup_demo_01',
      supplierName: 'TechDistributors East Africa',
      supplierMoq: 10,
      orderMultiple: 5,
      taxRate: 16,
      value: 20.00,
      buyingPrice: 20.00,
      costPrice: 20.00,
      unitCost: 20.00,
      sellingPrice: 35.00,
      unitPrice: 35.00,
      movement: 'fast',
      status: 'Active',
      lastSold: new Date(now - 1 * dayMs).toISOString(),
      createdAt: new Date(now - 60 * dayMs).toISOString(),
      updatedAt: new Date().toISOString(),
      expiryDate: new Date(now + 365 * dayMs).toISOString(),
      batchNumber: 'BAT-2026-001'
    },
    {
      id: 'prod_demo_02',
      productId: 'prod_demo_02',
      name: 'RGB Mechanical Gaming Keyboard',
      productName: 'RGB Mechanical Gaming Keyboard',
      sku: 'SKU-LOG-002',
      barcode: '6001234567892',
      category: 'Electronics & Accessories',
      brand: 'Corsair',
      materialGroup: 'Finished Goods',
      uom: 'Piece',
      quantity: 18,
      currentStock: 18,
      initialStock: 50,
      openingStock: 50,
      unitsSold: 32,
      unitsReceived: 50,
      minStock: 10,
      maxStock: 60,
      reorderPoint: 15,
      reorderLevel: 15,
      safetyStock: 6,
      leadTimeDays: 3,
      supplierLeadTime: 3,
      supplierId: 'sup_demo_01',
      supplierName: 'TechDistributors East Africa',
      supplierMoq: 5,
      orderMultiple: 1,
      taxRate: 16,
      value: 50.00,
      buyingPrice: 50.00,
      costPrice: 50.00,
      unitCost: 50.00,
      sellingPrice: 85.00,
      unitPrice: 85.00,
      movement: 'fast',
      status: 'Active',
      lastSold: new Date(now - 1 * dayMs).toISOString(),
      createdAt: new Date(now - 60 * dayMs).toISOString(),
      updatedAt: new Date().toISOString(),
      expiryDate: new Date(now + 400 * dayMs).toISOString(),
      batchNumber: 'BAT-2026-002'
    },
    {
      id: 'prod_demo_03',
      productId: 'prod_demo_03',
      name: 'UltraHD 4K 27" IPS Monitor',
      productName: 'UltraHD 4K 27" IPS Monitor',
      sku: 'SKU-LOG-003',
      barcode: '6001234567893',
      category: 'Displays & Hardware',
      brand: 'Dell',
      materialGroup: 'Finished Goods',
      uom: 'Piece',
      quantity: 8,
      currentStock: 8,
      initialStock: 20,
      openingStock: 20,
      unitsSold: 12,
      unitsReceived: 20,
      minStock: 5,
      maxStock: 25,
      reorderPoint: 8,
      reorderLevel: 8,
      safetyStock: 3,
      leadTimeDays: 5,
      supplierLeadTime: 5,
      supplierId: 'sup_demo_02',
      supplierName: 'Global Display Logistics',
      supplierMoq: 2,
      orderMultiple: 1,
      taxRate: 16,
      value: 220.00,
      buyingPrice: 220.00,
      costPrice: 220.00,
      unitCost: 220.00,
      sellingPrice: 320.00,
      unitPrice: 320.00,
      movement: 'fast',
      status: 'Active',
      lastSold: new Date(now - 2 * dayMs).toISOString(),
      createdAt: new Date(now - 60 * dayMs).toISOString(),
      updatedAt: new Date().toISOString(),
      expiryDate: new Date(now + 500 * dayMs).toISOString(),
      batchNumber: 'BAT-2026-003'
    },
    {
      id: 'prod_demo_04',
      productId: 'prod_demo_04',
      name: 'Aluminum Dual Monitor Desk Mount',
      productName: 'Aluminum Dual Monitor Desk Mount',
      sku: 'SKU-LOG-004',
      barcode: '6001234567894',
      category: 'Office Furniture & Ergonomics',
      brand: 'Ergotron',
      materialGroup: 'Finished Goods',
      uom: 'Piece',
      quantity: 12,
      currentStock: 12,
      initialStock: 25,
      openingStock: 25,
      unitsSold: 13,
      unitsReceived: 25,
      minStock: 5,
      maxStock: 30,
      reorderPoint: 8,
      reorderLevel: 8,
      safetyStock: 4,
      leadTimeDays: 5,
      supplierLeadTime: 5,
      supplierId: 'sup_demo_02',
      supplierName: 'Global Display Logistics',
      supplierMoq: 2,
      orderMultiple: 1,
      taxRate: 16,
      value: 35.00,
      buyingPrice: 35.00,
      costPrice: 35.00,
      unitCost: 35.00,
      sellingPrice: 65.00,
      unitPrice: 65.00,
      movement: 'moderate',
      status: 'Active',
      lastSold: new Date(now - 3 * dayMs).toISOString(),
      createdAt: new Date(now - 60 * dayMs).toISOString(),
      updatedAt: new Date().toISOString(),
      expiryDate: new Date(now + 600 * dayMs).toISOString(),
      batchNumber: 'BAT-2026-004'
    },
    {
      id: 'prod_demo_05',
      productId: 'prod_demo_05',
      name: 'USB-C 10-in-1 Multiport Hub',
      productName: 'USB-C 10-in-1 Multiport Hub',
      sku: 'SKU-LOG-005',
      barcode: '6001234567895',
      category: 'Storage & Cables',
      brand: 'Anker',
      materialGroup: 'Finished Goods',
      uom: 'Piece',
      quantity: 30,
      currentStock: 30,
      initialStock: 60,
      openingStock: 60,
      unitsSold: 30,
      unitsReceived: 60,
      minStock: 10,
      maxStock: 80,
      reorderPoint: 15,
      reorderLevel: 15,
      safetyStock: 6,
      leadTimeDays: 3,
      supplierLeadTime: 3,
      supplierId: 'sup_demo_01',
      supplierName: 'TechDistributors East Africa',
      supplierMoq: 5,
      orderMultiple: 1,
      taxRate: 16,
      value: 25.00,
      buyingPrice: 25.00,
      costPrice: 25.00,
      unitCost: 25.00,
      sellingPrice: 45.00,
      unitPrice: 45.00,
      movement: 'fast',
      status: 'Active',
      lastSold: new Date(now - 1 * dayMs).toISOString(),
      createdAt: new Date(now - 60 * dayMs).toISOString(),
      updatedAt: new Date().toISOString(),
      expiryDate: new Date(now + 365 * dayMs).toISOString(),
      batchNumber: 'BAT-2026-005'
    },
    {
      id: 'prod_demo_06',
      productId: 'prod_demo_06',
      name: 'Noise-Canceling Wireless Headset',
      productName: 'Noise-Canceling Wireless Headset',
      sku: 'SKU-LOG-006',
      barcode: '6001234567896',
      category: 'Audio Gear',
      brand: 'Sony',
      materialGroup: 'Finished Goods',
      uom: 'Piece',
      quantity: 4,
      currentStock: 4,
      initialStock: 15,
      openingStock: 15,
      unitsSold: 11,
      unitsReceived: 15,
      minStock: 5,
      maxStock: 20,
      reorderPoint: 6,
      reorderLevel: 6,
      safetyStock: 2,
      leadTimeDays: 3,
      supplierLeadTime: 3,
      supplierId: 'sup_demo_01',
      supplierName: 'TechDistributors East Africa',
      supplierMoq: 4,
      orderMultiple: 2,
      taxRate: 16,
      value: 75.00,
      buyingPrice: 75.00,
      costPrice: 75.00,
      unitCost: 75.00,
      sellingPrice: 120.00,
      unitPrice: 120.00,
      movement: 'slow',
      status: 'Low Stock',
      lastSold: new Date(now - 2 * dayMs).toISOString(),
      createdAt: new Date(now - 60 * dayMs).toISOString(),
      updatedAt: new Date().toISOString(),
      expiryDate: new Date(now + 300 * dayMs).toISOString(),
      batchNumber: 'BAT-2026-006'
    },
    {
      id: 'prod_demo_07',
      productId: 'prod_demo_07',
      name: 'High-Speed 2TB NVMe M.2 SSD',
      productName: 'High-Speed 2TB NVMe M.2 SSD',
      sku: 'SKU-LOG-007',
      barcode: '6001234567897',
      category: 'Storage & Cables',
      brand: 'Samsung',
      materialGroup: 'Finished Goods',
      uom: 'Piece',
      quantity: 22,
      currentStock: 22,
      initialStock: 40,
      openingStock: 40,
      unitsSold: 18,
      unitsReceived: 40,
      minStock: 8,
      maxStock: 50,
      reorderPoint: 12,
      reorderLevel: 12,
      safetyStock: 4,
      leadTimeDays: 7,
      supplierLeadTime: 7,
      supplierId: 'sup_demo_03',
      supplierName: 'Silicon Core Imports',
      supplierMoq: 5,
      orderMultiple: 2,
      taxRate: 16,
      value: 105.00,
      buyingPrice: 105.00,
      costPrice: 105.00,
      unitCost: 105.00,
      sellingPrice: 160.00,
      unitPrice: 160.00,
      movement: 'fast',
      status: 'Active',
      lastSold: new Date(now - 1 * dayMs).toISOString(),
      createdAt: new Date(now - 60 * dayMs).toISOString(),
      updatedAt: new Date().toISOString(),
      expiryDate: new Date(now + 700 * dayMs).toISOString(),
      batchNumber: 'BAT-2026-007'
    },
    {
      id: 'prod_demo_08',
      productId: 'prod_demo_08',
      name: 'Ergonomic Breathable Mesh Chair',
      productName: 'Ergonomic Breathable Mesh Chair',
      sku: 'SKU-LOG-008',
      barcode: '6001234567898',
      category: 'Office Furniture & Ergonomics',
      brand: 'Herman Miller',
      materialGroup: 'Finished Goods',
      uom: 'Piece',
      quantity: 6,
      currentStock: 6,
      initialStock: 12,
      openingStock: 12,
      unitsSold: 6,
      unitsReceived: 12,
      minStock: 3,
      maxStock: 15,
      reorderPoint: 5,
      reorderLevel: 5,
      safetyStock: 2,
      leadTimeDays: 7,
      supplierLeadTime: 7,
      supplierId: 'sup_demo_03',
      supplierName: 'Silicon Core Imports',
      supplierMoq: 2,
      orderMultiple: 1,
      taxRate: 16,
      value: 150.00,
      buyingPrice: 150.00,
      costPrice: 150.00,
      unitCost: 150.00,
      sellingPrice: 240.00,
      unitPrice: 240.00,
      movement: 'moderate',
      status: 'Active',
      lastSold: new Date(now - 4 * dayMs).toISOString(),
      createdAt: new Date(now - 60 * dayMs).toISOString(),
      updatedAt: new Date().toISOString(),
      expiryDate: new Date(now + 1000 * dayMs).toISOString(),
      batchNumber: 'BAT-2026-008'
    }
  ];

  for (const p of products) {
    const pRef = doc(db, `companies/${companyId}/products`, p.id);
    batch1.set(pRef, p, { merge: true });
  }

  await batch1.commit();

  // BATCH 2: Invoices, Sales, POS Receipts, Delivery Notes
  const batch2 = writeBatch(db);

  const invoices = [
    {
      id: 'inv_demo_101',
      invoiceNumber: 'INV-2026-101',
      customerName: 'Acme Technology Corp',
      customerSegment: 'Corporate',
      date: new Date(now - 1 * dayMs).toISOString().split('T')[0],
      createdAt: new Date(now - 1 * dayMs).toISOString(),
      status: 'Paid',
      paymentMethod: 'Bank Transfer',
      branch: 'Main Warehouse',
      subtotal: 1240.00,
      costOfGoods: 800.00,
      tax: 198.40,
      totalAmount: 1438.40,
      items: [
        { productId: 'prod_demo_03', productName: 'UltraHD 4K 27" IPS Monitor', quantity: 3, unitPrice: 320.00, total: 960.00, costPrice: 220.00 },
        { productId: 'prod_demo_02', productName: 'RGB Mechanical Gaming Keyboard', quantity: 2, unitPrice: 85.00, total: 170.00, costPrice: 50.00 },
        { productId: 'prod_demo_01', productName: 'Wireless Ergonomic Vertical Mouse', quantity: 2, unitPrice: 35.00, total: 70.00, costPrice: 20.00 },
      ]
    },
    {
      id: 'inv_demo_102',
      invoiceNumber: 'INV-2026-102',
      customerName: 'Downtown Walk-in Client',
      customerSegment: 'Retail',
      date: new Date(now - 2 * dayMs).toISOString().split('T')[0],
      createdAt: new Date(now - 2 * dayMs).toISOString(),
      status: 'Paid',
      paymentMethod: 'M-Pesa',
      branch: 'Downtown Retail Store',
      subtotal: 125.00,
      costOfGoods: 70.00,
      tax: 20.00,
      totalAmount: 145.00,
      items: [
        { productId: 'prod_demo_01', productName: 'Wireless Ergonomic Vertical Mouse', quantity: 1, unitPrice: 35.00, total: 35.00, costPrice: 20.00 },
        { productId: 'prod_demo_05', productName: 'USB-C 10-in-1 Multiport Hub', quantity: 2, unitPrice: 45.00, total: 90.00, costPrice: 25.00 },
      ]
    },
    {
      id: 'inv_demo_103',
      invoiceNumber: 'INV-2026-103',
      customerName: 'Global Solutions VIP',
      customerSegment: 'VIP',
      date: new Date(now - 4 * dayMs).toISOString().split('T')[0],
      createdAt: new Date(now - 4 * dayMs).toISOString(),
      status: 'Paid',
      paymentMethod: 'Credit Card',
      branch: 'Northside Distribution',
      subtotal: 525.00,
      costOfGoods: 315.00,
      tax: 84.00,
      totalAmount: 609.00,
      items: [
        { productId: 'prod_demo_06', productName: 'Noise-Canceling Wireless Headset', quantity: 3, unitPrice: 120.00, total: 360.00, costPrice: 75.00 },
        { productId: 'prod_demo_04', productName: 'Aluminum Dual Monitor Desk Mount', quantity: 2, unitPrice: 65.00, total: 130.00, costPrice: 35.00 },
        { productId: 'prod_demo_01', productName: 'Wireless Ergonomic Vertical Mouse', quantity: 1, unitPrice: 35.00, total: 35.00, costPrice: 20.00 },
      ]
    },
    {
      id: 'inv_demo_104',
      invoiceNumber: 'INV-2026-104',
      customerName: 'Safari Logistics Ltd',
      customerSegment: 'Wholesale',
      date: new Date(now - 7 * dayMs).toISOString().split('T')[0],
      createdAt: new Date(now - 7 * dayMs).toISOString(),
      status: 'Paid',
      paymentMethod: 'Bank Transfer',
      branch: 'Main Warehouse',
      subtotal: 2050.00,
      costOfGoods: 1300.00,
      tax: 328.00,
      totalAmount: 2378.00,
      items: [
        { productId: 'prod_demo_07', productName: 'High-Speed 2TB NVMe M.2 SSD', quantity: 8, unitPrice: 160.00, total: 1280.00, costPrice: 105.00 },
        { productId: 'prod_demo_05', productName: 'USB-C 10-in-1 Multiport Hub', quantity: 10, unitPrice: 45.00, total: 450.00, costPrice: 25.00 },
        { productId: 'prod_demo_02', productName: 'RGB Mechanical Gaming Keyboard', quantity: 4, unitPrice: 85.00, total: 340.00, costPrice: 50.00 },
      ]
    },
    {
      id: 'inv_demo_105',
      invoiceNumber: 'INV-2026-105',
      customerName: 'Horizon Creative Agency',
      customerSegment: 'Corporate',
      date: new Date(now - 12 * dayMs).toISOString().split('T')[0],
      createdAt: new Date(now - 12 * dayMs).toISOString(),
      status: 'Paid',
      paymentMethod: 'Credit Card',
      branch: 'Downtown Retail Store',
      subtotal: 1120.00,
      costOfGoods: 740.00,
      tax: 179.20,
      totalAmount: 1299.20,
      items: [
        { productId: 'prod_demo_03', productName: 'UltraHD 4K 27" IPS Monitor', quantity: 2, unitPrice: 320.00, total: 640.00, costPrice: 220.00 },
        { productId: 'prod_demo_08', productName: 'Ergonomic Breathable Mesh Chair', quantity: 2, unitPrice: 240.00, total: 480.00, costPrice: 150.00 }
      ]
    },
    {
      id: 'inv_demo_106',
      invoiceNumber: 'INV-2026-106',
      customerName: 'Acme Technology Corp',
      customerSegment: 'Corporate',
      date: new Date(now - 18 * dayMs).toISOString().split('T')[0],
      createdAt: new Date(now - 18 * dayMs).toISOString(),
      status: 'Paid',
      paymentMethod: 'Bank Transfer',
      branch: 'Main Warehouse',
      subtotal: 1450.00,
      costOfGoods: 920.00,
      tax: 232.00,
      totalAmount: 1682.00,
      items: [
        { productId: 'prod_demo_07', productName: 'High-Speed 2TB NVMe M.2 SSD', quantity: 5, unitPrice: 160.00, total: 800.00, costPrice: 105.00 },
        { productId: 'prod_demo_02', productName: 'RGB Mechanical Gaming Keyboard', quantity: 5, unitPrice: 85.00, total: 425.00, costPrice: 50.00 },
        { productId: 'prod_demo_01', productName: 'Wireless Ergonomic Vertical Mouse', quantity: 6, unitPrice: 35.00, total: 225.00, costPrice: 20.00 }
      ]
    }
  ];

  for (const inv of invoices) {
    const invRef = doc(db, `companies/${companyId}/invoices`, inv.id);
    batch2.set(invRef, inv, { merge: true });

    // Seed Receipts for POS
    const receiptRef = doc(db, `companies/${companyId}/receipts`, `rcpt_${inv.id}`);
    batch2.set(receiptRef, {
      id: `rcpt_${inv.id}`,
      receiptNumber: `RCPT-${inv.invoiceNumber}`,
      invoiceId: inv.id,
      customerName: inv.customerName,
      totalAmount: inv.totalAmount,
      paymentMethod: inv.paymentMethod,
      date: inv.date,
      createdAt: inv.createdAt,
      items: inv.items
    }, { merge: true });

    // Seed Sales transactions for analytics aggregation
    for (const item of inv.items) {
      const saleId = `sale_${inv.id}_${item.productId}`;
      const saleRef = doc(db, `companies/${companyId}/sales`, saleId);
      batch2.set(saleRef, {
        id: saleId,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        createdAt: inv.createdAt,
        branch: inv.branch,
        customer: inv.customerName,
        customerSegment: inv.customerSegment,
        paymentMethod: inv.paymentMethod,
        productId: item.productId,
        productName: item.productName,
        quantitySold: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.costPrice,
        grossSales: item.total,
        netSales: item.total,
        totalCost: item.costPrice * item.quantity,
        netProfit: item.total - (item.costPrice * item.quantity),
      }, { merge: true });
    }
  }

  await batch2.commit();

  // BATCH 3: Purchase Orders, GRNs, Stock Movements, Alerts, Warranties
  const batch3 = writeBatch(db);

  // Purchase Orders
  const purchaseOrders = [
    {
      id: 'po_demo_01',
      poNumber: 'PO-2026-001',
      supplierId: 'sup_demo_01',
      supplierName: 'TechDistributors East Africa',
      status: 'DELIVERED',
      deliveryStatus: 'Full Delivery',
      leadTimeDays: 3,
      actualLeadTimeDays: 3,
      orderDate: new Date(now - 25 * dayMs).toISOString().split('T')[0],
      expectedDate: new Date(now - 22 * dayMs).toISOString().split('T')[0],
      deliveryDate: new Date(now - 22 * dayMs).toISOString().split('T')[0],
      totalAmount: 1850.00,
      items: [
        { productId: 'prod_demo_01', sku: 'SKU-LOG-001', name: 'Wireless Ergonomic Vertical Mouse', productName: 'Wireless Ergonomic Vertical Mouse', quantity: 50, receivedQuantity: 50, unitCost: 20.00, unitPrice: 20.00, totalCost: 1000.00 },
        { productId: 'prod_demo_05', sku: 'SKU-LOG-005', name: 'USB-C 10-in-1 Multiport Hub', productName: 'USB-C 10-in-1 Multiport Hub', quantity: 34, receivedQuantity: 34, unitCost: 25.00, unitPrice: 25.00, totalCost: 850.00 }
      ]
    },
    {
      id: 'po_demo_02',
      poNumber: 'PO-2026-002',
      supplierId: 'sup_demo_02',
      supplierName: 'Global Display Logistics',
      status: 'DELIVERED',
      deliveryStatus: 'Full Delivery',
      leadTimeDays: 5,
      actualLeadTimeDays: 5,
      orderDate: new Date(now - 15 * dayMs).toISOString().split('T')[0],
      expectedDate: new Date(now - 10 * dayMs).toISOString().split('T')[0],
      deliveryDate: new Date(now - 10 * dayMs).toISOString().split('T')[0],
      totalAmount: 3300.00,
      items: [
        { productId: 'prod_demo_03', sku: 'SKU-LOG-003', name: 'UltraHD 4K 27" IPS Monitor', productName: 'UltraHD 4K 27" IPS Monitor', quantity: 15, receivedQuantity: 15, unitCost: 220.00, unitPrice: 220.00, totalCost: 3300.00 }
      ]
    },
    {
      id: 'po_demo_03',
      poNumber: 'PO-2026-003',
      supplierId: 'sup_demo_03',
      supplierName: 'Silicon Core Imports',
      status: 'APPROVED',
      deliveryStatus: 'In Transit',
      leadTimeDays: 7,
      orderDate: new Date(now - 2 * dayMs).toISOString().split('T')[0],
      expectedDate: new Date(now + 4 * dayMs).toISOString().split('T')[0],
      totalAmount: 2100.00,
      items: [
        { productId: 'prod_demo_07', sku: 'SKU-LOG-007', name: 'High-Speed 2TB NVMe M.2 SSD', productName: 'High-Speed 2TB NVMe M.2 SSD', quantity: 20, receivedQuantity: 0, unitCost: 105.00, unitPrice: 105.00, totalCost: 2100.00 }
      ]
    }
  ];

  for (const po of purchaseOrders) {
    const poRef = doc(db, `companies/${companyId}/purchaseOrders`, po.id);
    batch3.set(poRef, po, { merge: true });

    // Seed GRN (Goods Received Note) for completed POs
    if (po.status === 'DELIVERED') {
      const grnId = `grn_${po.id}`;
      const grnRef = doc(db, `companies/${companyId}/grns`, grnId);
      batch3.set(grnRef, {
        id: grnId,
        grnNumber: `GRN-${po.poNumber}`,
        poId: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        receivedDate: po.deliveryDate,
        status: 'RECEIVED',
        totalValue: po.totalAmount,
        items: po.items.map(item => ({
          productId: item.productId,
          orderedQuantity: item.quantity,
          receivedQuantity: item.receivedQuantity || item.quantity,
          unitPrice: item.unitCost,
          name: item.name
        }))
      }, { merge: true });
    }
  }

  // Stock Movements across 30 days for rich velocity, turnover, and history graphs
  const stockMovements = [
    {
      id: 'mov_demo_01',
      productId: 'prod_demo_01',
      sku: 'SKU-LOG-001',
      productName: 'Wireless Ergonomic Vertical Mouse',
      type: 'inbound',
      quantity: 50,
      beforeQty: 0,
      afterQty: 50,
      previousStock: 0,
      newStock: 50,
      unitCost: 20.00,
      transactionId: 'mov_demo_01',
      transactionType: 'Purchase Receipt',
      reason: 'PO Receipt PO-2026-001',
      createdAt: new Date(now - 25 * dayMs).toISOString(),
    },
    {
      id: 'mov_demo_02',
      productId: 'prod_demo_01',
      sku: 'SKU-LOG-001',
      productName: 'Wireless Ergonomic Vertical Mouse',
      type: 'outbound',
      quantity: 2,
      beforeQty: 50,
      afterQty: 48,
      previousStock: 50,
      newStock: 48,
      unitCost: 20.00,
      unitPrice: 35.00,
      transactionId: 'mov_demo_02',
      transactionType: 'POS Sale',
      reason: 'Fulfillment INV-2026-101',
      createdAt: new Date(now - 1 * dayMs).toISOString(),
    },
    {
      id: 'mov_demo_03',
      productId: 'prod_demo_03',
      sku: 'SKU-LOG-003',
      productName: 'UltraHD 4K 27" IPS Monitor',
      type: 'inbound',
      quantity: 15,
      beforeQty: 0,
      afterQty: 15,
      previousStock: 0,
      newStock: 15,
      unitCost: 220.00,
      transactionId: 'mov_demo_03',
      transactionType: 'Purchase Receipt',
      reason: 'PO Receipt PO-2026-002',
      createdAt: new Date(now - 10 * dayMs).toISOString(),
    },
    {
      id: 'mov_demo_04',
      productId: 'prod_demo_03',
      sku: 'SKU-LOG-003',
      productName: 'UltraHD 4K 27" IPS Monitor',
      type: 'outbound',
      quantity: 3,
      beforeQty: 15,
      afterQty: 12,
      previousStock: 15,
      newStock: 12,
      unitCost: 220.00,
      unitPrice: 320.00,
      transactionId: 'mov_demo_04',
      transactionType: 'POS Sale',
      reason: 'Fulfillment INV-2026-101',
      createdAt: new Date(now - 1 * dayMs).toISOString(),
    },
    {
      id: 'mov_demo_05',
      productId: 'prod_demo_07',
      sku: 'SKU-LOG-007',
      productName: 'High-Speed 2TB NVMe M.2 SSD',
      type: 'outbound',
      quantity: 8,
      beforeQty: 30,
      afterQty: 22,
      previousStock: 30,
      newStock: 22,
      unitCost: 105.00,
      unitPrice: 160.00,
      transactionId: 'mov_demo_05',
      transactionType: 'Wholesale Invoice',
      reason: 'Fulfillment INV-2026-104',
      createdAt: new Date(now - 7 * dayMs).toISOString(),
    },
    {
      id: 'mov_demo_06',
      productId: 'prod_demo_06',
      sku: 'SKU-LOG-006',
      productName: 'Noise-Canceling Wireless Headset',
      type: 'outbound',
      quantity: 3,
      beforeQty: 7,
      afterQty: 4,
      previousStock: 7,
      newStock: 4,
      unitCost: 75.00,
      unitPrice: 120.00,
      transactionId: 'mov_demo_06',
      transactionType: 'Store Sale',
      reason: 'Fulfillment INV-2026-103',
      createdAt: new Date(now - 4 * dayMs).toISOString(),
    }
  ];

  for (const m of stockMovements) {
    const mRef = doc(db, `companies/${companyId}/stockMovements`, m.id);
    batch3.set(mRef, m, { merge: true });
  }

  // Active Alerts
  const alerts = [
    {
      id: 'alert_demo_01',
      productId: 'prod_demo_06',
      productName: 'Noise-Canceling Wireless Headset',
      type: 'Low Stock',
      severity: 'high',
      title: 'Stock Below Reorder Level',
      message: 'Noise-Canceling Wireless Headset is at 4 units (Reorder Point: 6 units). Suggested PO creation.',
      createdAt: new Date(now - 2 * dayMs).toISOString(),
      status: 'Active'
    },
    {
      id: 'alert_demo_02',
      productId: 'prod_demo_03',
      productName: 'UltraHD 4K 27" IPS Monitor',
      type: 'Fast Turnover',
      severity: 'info',
      title: 'High Sales Velocity Recorded',
      message: 'UltraHD 4K 27" IPS Monitor velocity increased by 42% over the last 14 days.',
      createdAt: new Date(now - 1 * dayMs).toISOString(),
      status: 'Active'
    }
  ];

  for (const a of alerts) {
    const aRef = doc(db, `companies/${companyId}/inventory_alerts`, a.id);
    batch3.set(aRef, a, { merge: true });
  }

  // Warranties
  const warranties = [
    {
      id: 'war_demo_01',
      serialNumber: 'SN-MON-99120',
      productName: 'UltraHD 4K 27" IPS Monitor',
      customerName: 'Acme Technology Corp',
      purchaseDate: new Date(now - 18 * dayMs).toISOString().split('T')[0],
      expiryDate: new Date(now + 347 * dayMs).toISOString().split('T')[0],
      status: 'Active',
      coverageType: 'Full Manufacturer Replacement'
    },
    {
      id: 'war_demo_02',
      serialNumber: 'SN-SSD-44109',
      productName: 'High-Speed 2TB NVMe M.2 SSD',
      customerName: 'Safari Logistics Ltd',
      purchaseDate: new Date(now - 7 * dayMs).toISOString().split('T')[0],
      expiryDate: new Date(now + 723 * dayMs).toISOString().split('T')[0],
      status: 'Active',
      coverageType: '3-Year Express Warranty'
    }
  ];

  for (const w of warranties) {
    const wRef = doc(db, `companies/${companyId}/warranties`, w.id);
    batch3.set(wRef, w, { merge: true });
  }

  await batch3.commit();
}
