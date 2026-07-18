export type MovementSpeed = 'fast' | 'moderate' | 'slow' | 'obsolete';

export interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId?: string;
  category?: string; // Legacy/Display
  warehouseId?: string;
  quantity: number;
  value: number;
  movement: MovementSpeed;
  status?: string;
  lastSold: string;
  image?: string;
  expiryDate?: string; // Expiration Tracking Date
  manufactureDate?: string;
  batchNumber?: string;
  expiryStatus?: 'Fresh' | 'Near Expiry' | 'Expired';
  uom?: string; // Base Unit of Measure (UoM), e.g. Piece, kg, Liter
  materialGroup?: string; // Material Group, e.g. Raw Materials, Finished Goods, Packaging
  unitsSold?: number;
  unitsReceived?: number;
  createdAt: string;
  updatedAt: string;

  // Audit and Analytical Fields (Target Schema Alignment)
  productId?: string;
  productName?: string;
  buyingPrice?: number;
  sellingPrice?: number;
  currentStock?: number;
  initialStock?: number;
  stockAddedDate?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'transfer';
  quantity: number;
  beforeQty: number;
  afterQty: number;
  createdAt: string;
  createdBy: string;

  // Audit and Analytical Fields (Target Schema Alignment)
  transactionId?: string;
  transactionType?: string;
  previousStock?: number;
  newStock?: number;
  reason?: string;
  userId?: string;
  timestamp?: any;
}

export interface SaleRecord {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantitySold: number;
  sellingPrice: number;
  totalAmount: number;
  saleDate: string;
  customerId?: string;
  createdAt: string;
  timestamp?: any;
}

export interface InventoryAlert {
  id: string;
  type: 'reorder' | 'expiry' | 'slow' | 'overstock';
  title: string;
  description: string;
  timestamp: string;
  actionLabel: string;
  severity: 'high' | 'medium' | 'low';
}

export interface CategoryStats {
  id: string;
  name: string;
  items: number;
  value: number;
  percentage: number;
  color: string;
}

export interface POItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
  productName?: string;
  sku?: string;
}

export type POStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED' | 'PARTIAL' | 'PARTIALLY RECEIVED' | 'FULLY RECEIVED' | 'CLOSED';

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  date: string;
  totalAmount: number;
  status: POStatus;
  items: POItem[];
  notes?: string;
  expectedDeliveryDate?: string;
  createdBy?: string;
  createdByName?: string;
  userEmail?: string;
  supplierName?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  supplierKraPin?: string;
}

export interface GRNItem {
  productId: string;
  orderedQuantity: number;
  receivedQuantity: number;
}

export interface GoodReceiptNote {
  id: string;
  grnNumber: string;
  poId: string;
  receivedDate: string;
  receivedBy: string;
  supplierId: string;
  items: GRNItem[];
  notes?: string;
  createdBy?: string;
  userEmail?: string;
}

export interface MROIssue {
  id: string;
  issueNumber: string;
  productId: string;
  quantity: number;
  issuedTo: string;
  department?: string;
  date: string;
  notes?: string;
}

export type ViewType = 
  | 'pos' | 'dashboard' | 'inventory' | 'demand' | 'categories' | 'analytics' | 'settings' 
  | 'invoices' | 'receipts' | 'delivery_notes' | 'credit_notes' | 'quotations' | 'proforma'
  | 'warehouses' | 'supplier' | 'reports' | 'warranties' | 'alerts' | 'expiry_tracking' | 'profit_tracking' | 'spend_analysis'
  | 'purchase_orders' | 'grn' | 'mro_issues' | 'procurement_hub'
  | 'bom' | 'production_orders'
  | 'customers' | 'suppliers'
  | 'help' | 'inventory_pro_chat';
