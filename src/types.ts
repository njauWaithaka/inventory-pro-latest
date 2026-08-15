export type MovementSpeed = 'fast' | 'moderate' | 'slow' | 'obsolete';

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  category?: string; // Legacy/Display
  brand?: string;
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

  // Master Data & Financial Fields
  productId?: string;
  productName?: string;
  buyingPrice?: number;
  costPrice?: number;
  sellingPrice?: number;
  unitPrice?: number;
  currentStock?: number;
  initialStock?: number;
  openingStock?: number;
  reservedStock?: number;
  availableStock?: number;
  stockAddedDate?: string;
  taxRate?: number;

  // Supplier & Replenishment Parameters
  supplierId?: string;
  supplierName?: string;
  leadTimeDays?: number;
  supplierLeadTime?: number;
  supplierMoq?: number;
  orderMultiple?: number;
  minStock?: number;
  maxStock?: number;
  reorderPoint?: number;
  reorderLevel?: number;
  reorderPointOverride?: number | null;
  safetyStock?: number;
  safetyStockOverride?: number | null;
}

export interface StockMovement {
  id: string;
  productId: string;
  sku?: string;
  productName?: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'transfer' | 'inbound' | 'outbound' | 'return' | 'damage' | 'expired' | 'opening';
  quantity: number;
  beforeQty: number;
  afterQty: number;
  createdAt: string;
  createdBy: string;
  unitCost?: number;
  unitPrice?: number;

  // Audit and Analytical Fields
  reference?: string;
  referenceId?: string;
  transactionId?: string;
  transactionType?: string;
  previousStock?: number;
  newStock?: number;
  reason?: string;
  userId?: string;
  timestamp?: any;
  verificationImage?: string;
}

export interface SaleRecord {
  id: string;
  saleId: string;
  productId: string;
  sku?: string;
  productName: string;
  quantitySold: number;
  sellingPrice: number;
  unitCost?: number; // Historical unit cost at the time of sale
  costPrice?: number; // Alias for unit cost
  grossSales?: number;
  netSales?: number;
  profit?: number;
  netProfit?: number;
  discount?: number;
  tax?: number;
  totalAmount: number;
  saleDate: string;
  customerId?: string;
  customerName?: string;
  customerSegment?: string;
  paymentMethod?: string;
  branch?: string;
  returnStatus?: 'none' | 'partial' | 'full';
  returnedQuantity?: number;
  status?: string;
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
  unitCost?: number;
  totalCost?: number;
  receivedQuantity: number;
  productName?: string;
  name?: string;
  sku?: string;
}

export type POStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED' | 'PARTIAL' | 'PARTIALLY RECEIVED' | 'FULLY RECEIVED' | 'CLOSED' | 'DELIVERED';

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  date: string;
  orderDate?: string;
  totalAmount: number;
  status: POStatus;
  items: POItem[];
  notes?: string;
  leadTimeDays?: number;
  actualLeadTimeDays?: number;
  expectedDeliveryDate?: string;
  expectedDate?: string;
  deliveryDate?: string;
  deliveryStatus?: string;
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
  unitPrice?: number;
  name?: string;
}

export interface GoodReceiptNote {
  id: string;
  grnNumber: string;
  poId: string;
  poNumber?: string;
  receivedDate: string;
  receivedBy: string;
  supplierId: string;
  supplierName?: string;
  status?: string;
  totalValue?: number;
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

export type ReservationStatus = 'ACTIVE' | 'FULFILLED' | 'RELEASED' | 'EXPIRED';

export interface StockReservation {
  id: string;
  reservationNumber: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  reservedFor: string;
  customerId?: string;
  contactInfo?: string;
  reason?: string;
  status: ReservationStatus;
  reservedDate: string;
  expiryDate?: string;
  unitPrice?: number;
  totalValue?: number;
  notes?: string;
  location?: string;
  createdBy: string;
  createdByName?: string;
  userEmail?: string;
  createdAt: string;
  updatedAt: string;
  fulfilledAt?: string;
  releasedAt?: string;
}

// -------------------------------------------------------------
// CENTRAL CALCULATION ENGINE INTERFACES
// -------------------------------------------------------------

export interface CalculationMetadata {
  calculationName: string;
  calculatedAt: string;
  periodDays: number;
  dataPointsCount: number;
  isSufficientData: boolean;
  notes?: string;
}

export interface ProductDemandMetrics {
  productId: string;
  totalDemand: number;
  activeSellingDays: number;
  stockoutDays: number;
  averageDailyDemand: number;
  averageWeeklyDemand: number;
  averageMonthlyDemand: number;
  demandVariability: 'Stable' | 'Moderate' | 'Erratic';
  standardDeviation: number;
  coefficientOfVariation: number;
  recentTrendPct: number; // percentage comparison vs previous window
  forecastDemandNextPeriod: number;
  metadata: CalculationMetadata;
}

export interface ProductVelocityMetrics {
  productId: string;
  unitsSold: number;
  salesFrequencyCount: number;
  averageDailySales: number;
  lastSaleDate: string | null;
  daysSinceLastSale: number | null;
  inventoryAgeDays: number;
  movementClass: 'fast' | 'moderate' | 'slow' | 'obsolete' | 'out_of_stock';
  movementLabel: string;
  colorBadge: {
    bg: string;
    text: string;
    border: string;
    dot: string;
    icon: string;
  };
  metadata: CalculationMetadata;
}

export interface ProductProfitMetrics {
  productId: string;
  unitsSold: number;
  grossSales: number;
  totalCostOfGoods: number; // Sum using historical cost at time of sale
  grossProfit: number;
  grossMarginPct: number;
  unitSellingPrice: number;
  unitCostPrice: number;
  unitProfit: number;
  metadata: CalculationMetadata;
}

export interface ProductReorderMetrics {
  productId: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  effectiveLeadTimeDays: number;
  leadTimeSource: 'product' | 'supplier' | 'historical_avg' | 'default';
  safetyStock: number;
  isSafetyStockOverridden: boolean;
  reorderPoint: number;
  isReorderPointOverridden: boolean;
  daysOfStockRemaining: number | null; // null if 0 demand
  daysOfStockLabel: string;
  supplierMoq: number;
  orderMultiple: number;
  suggestedOrderQuantity: number;
  orderUrgency: 'CRITICAL' | 'REORDER_NOW' | 'LOW_STOCK' | 'ADEQUATE' | 'OVERSTOCKED';
  metadata: CalculationMetadata;
}

export interface ProductABCClassification {
  productId: string;
  sku: string;
  productName: string;
  category: string;
  rank: number;
  consumptionValue: number; // Consumption-based ABC: Quantity Sold * Unit Cost
  capitalValue: number; // Capital-based ABC: Available Stock * Unit Cost
  pctOfTotal: number;
  cumulativePct: number;
  abcClass: 'A' | 'B' | 'C';
  controlPolicy: string;
}

export interface ProductIntelligence {
  product: Product;
  demand: ProductDemandMetrics;
  velocity: ProductVelocityMetrics;
  profit: ProductProfitMetrics;
  reorder: ProductReorderMetrics;
  abc: ProductABCClassification;
}

export interface CompanyInventoryIntelligence {
  totalSKUs: number;
  activeStockedSKUs: number;
  outOfStockSKUs: number;
  totalInventoryValue: number;
  totalInventoryUnits: number;
  totalSalesValue: number;
  totalCOGS: number;
  totalGrossProfit: number;
  overallGrossMarginPct: number;
  annualizedTurnoverRatio: number;
  daysSalesOfInventory: number;
  abcSummary: {
    A: { count: number; value: number; skuPct: number; capitalPct: number };
    B: { count: number; value: number; skuPct: number; capitalPct: number };
    C: { count: number; value: number; skuPct: number; capitalPct: number };
  };
  velocitySummary: {
    fast: { count: number; percentage: number; value: number };
    moderate: { count: number; percentage: number; value: number };
    slow: { count: number; percentage: number; value: number };
    obsolete: { count: number; percentage: number; value: number };
    outOfStock: { count: number; percentage: number; value: number };
  };
  reorderAlertsCount: number;
  criticalStockoutsCount: number;
  productsIntelligence: ProductIntelligence[];
}

// -------------------------------------------------------------
// EXPENSES & FINANCIAL MANAGEMENT INTERFACES
// -------------------------------------------------------------

export type ExpensePaymentMethod = 'Cash' | 'Bank Transfer' | 'M-Pesa' | 'Credit Card' | 'Petty Cash' | 'Cheque';
export type ExpenseDepartment = 'Operations' | 'Sales & Marketing' | 'Administration' | 'Logistics' | 'IT & Software' | 'Finance & Legal' | 'General';
export type ExpenseStatus = 'PAID' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAYABLE' | 'CANCELLED';

export interface Expense {
  id: string;
  expenseNumber: string;
  title: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  taxAmount?: number;
  taxDeductible?: boolean;
  vendorId?: string;
  vendorName?: string;
  date: string;
  dueDate?: string;
  paymentMethod: ExpensePaymentMethod;
  department: ExpenseDepartment;
  status: ExpenseStatus;
  reference?: string;
  notes?: string;
  receiptUrl?: string;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  paidAmount?: number;
  isRecurring?: boolean;
  recurringScheduleId?: string;
  pettyCashVoucherId?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  color: string;
  icon?: string;
  isTaxDeductible: boolean;
  monthlyBudgetLimit?: number;
  createdAt: string;
}

export interface ExpenseBudget {
  id: string;
  categoryId: string;
  categoryName: string;
  period: string; // e.g. "Monthly" or "2026-03"
  allocatedAmount: number;
  alertThresholdPct: number;
  notes?: string;
  createdAt?: string;
}

export interface RecurringExpense {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  vendorName?: string;
  frequency: 'Weekly' | 'Bi-Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  startDate: string;
  nextDueDate: string;
  lastLoggedDate?: string;
  autoLog: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  paymentMethod: ExpensePaymentMethod;
  department: ExpenseDepartment;
  notes?: string;
  createdAt: string;
}

export interface PettyCashTransaction {
  id: string;
  voucherNumber: string;
  type: 'DISBURSEMENT' | 'TOP_UP' | 'RECONCILIATION';
  amount: number;
  balanceAfter: number;
  recipient?: string;
  purpose: string;
  categoryId?: string;
  categoryName?: string;
  receiptNumber?: string;
  authorizedBy: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface PettyCashFloat {
  currentBalance: number;
  targetFloat: number;
  minimumThreshold: number;
  lastReplenished: string;
}

export type ViewType = 
  | 'pos' | 'dashboard' | 'inventory' | 'demand' | 'categories' | 'analytics' | 'sell_through' | 'settings' 
  | 'invoices' | 'receipts' | 'delivery_notes' | 'credit_notes' | 'quotations' | 'proforma'
  | 'warehouses' | 'supplier' | 'reports' | 'warranties' | 'alerts' | 'expiry_tracking' | 'profit_tracking'
  | 'purchase_orders' | 'grn' | 'mro_issues' | 'procurement_hub'
  | 'expenses' | 'expense_dashboard' | 'record_expense' | 'expense_transactions' | 'pending_expenses' | 'payables' | 'expense_payables' | 'recurring_expenses' | 'petty_cash' | 'expense_budgets' | 'expense_reports' | 'expense_analytics' | 'expense_categories'
  | 'bom' | 'production_orders' | 'production_planning' | 'mrp' | 'material_requisitions' | 'material_issue' | 'wip' | 'production_output' | 'quality_control' | 'cost_analysis' | 'production_analytics'
  | 'customers' | 'suppliers'
  | 'help' | 'inventory_pro_chat';

