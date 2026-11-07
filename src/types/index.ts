export type UserRole = 'pemilik' | 'karyawan';

export interface OwnerAccount {
  id: string;
  email: string;
  name: string;
  role: 'pemilik';
  passwordHash: string;
  failedAttempts: number;
  lockedUntil: string | null; // ISO string if locked for 15 minutes
  lastActiveAt: string; // ISO string for 12 hours inactivity check
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  pin: string;
  role: 'karyawan';
  isActive: boolean;
  createdAt: string;
}

export type IngredientCategory = 
  | 'base_tea' 
  | 'base_flavor' 
  | 'blend_flavor' 
  | 'cream' 
  | 'packaging' 
  | 'other';

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: string; // 'pack', 'pcs', 'roll'
  buyPrice: number; // in Rupiah (HIDDEN FROM KARYAWAN)
  portionsPerUnit: number; // portions yield per unit (HIDDEN FROM KARYAWAN)
  costPerPortion: number; // buyPrice / portionsPerUnit (HIDDEN FROM KARYAWAN)
  minOrder: string;
  minStock: number; // in portions or units
  currentStock: number; // VISIBLE TO KARYAWAN (physical quantity)
  isVerified: boolean;
  verificationNote?: string; // e.g. 'BELUM DIVERIFIKASI', 'ASUMSI'
}

export interface IngredientPriceHistory {
  id: string;
  ingredientId: string;
  ingredientName: string;
  oldPrice: number;
  newPrice: number;
  changePct: number;
  changedAt: string; // ISO string
  changedBy: string;
  isAlertOver5Pct: boolean;
}

export interface RecipeItem {
  ingredientId: string;
  amount: number; // portions used per 1 cup
}

export type ProductCategory = 'milk_tea' | 'pure_tea' | 'fruity_tea' | 'special_blend';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  sellPrice: number; // Rupiah
  maxDiscountPct: number; // Max discount % allowed for cashier (default e.g. 15%)
  recipe: RecipeItem[];
  isVerified: boolean;
  verificationNote?: string;
  active: boolean;
  imageUrl?: string; // URL atau Base64 data URL foto produk
  description?: string;
}

export interface PackagingCosts {
  cupPrice: number; // Rp749
  lidRollPrice: number; // Rp249.000
  lidCupsPerRoll: number; // 1.200
  otherCostsPerCup: number; // Rp1.000 (es, gula, sedotan, plastik) - ASUMSI
  isOtherCostsAssumed: boolean;
}

export interface ProductFinancials {
  productId: string;
  productName: string;
  sellPrice: number;
  hpp: number;
  margin: number;
  marginPct: number;
  minPriceDirect: number; // commission = 0%
  minPriceOnline: number; // commission = 20%
  onlineMargin: number; // at 20% commission
}

export type SalesChannel = 'direct' | 'gofood' | 'grabfood' | 'shopeefood';
export type PaymentMethod = 'cash' | 'qris';
export type SyncStatus = 'lokal' | 'terkirim' | 'gagal';

export interface SalesItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  subtotal: number;
  hppPerUnit: number; // snapshot at sale
}

export interface SalesTransaction {
  id: string;
  invoiceNumber: string;
  timestamp: string; // ISO format
  cashierName: string;
  cashierId: string;
  channel: SalesChannel;
  paymentMethod: PaymentMethod;
  items: SalesItem[];
  totalGross: number;
  totalDiscount: number;
  totalNet: number;
  totalHpp: number; // for owner analytics
  cashReceived?: number;
  cashChange?: number;
  syncStatus: SyncStatus;
  isVoided: boolean;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
}

export interface RestockItem {
  ingredientId: string;
  quantity: number; // in units (pack/pcs/roll)
  buyPrice: number;
}

export interface RestockRecord {
  id: string;
  date: string;
  supplier?: string;
  items: RestockItem[];
  shippingFee: number;
  totalCost: number;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface WasteRecord {
  id: string;
  date: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  reason: string;
  recordedBy: string;
}

export interface StockOpnameRecord {
  id: string;
  date: string;
  ingredientId: string;
  ingredientName: string;
  initialStock: number;
  restockQty: number;
  recipeUsage: number;
  wasteQty: number;
  theoreticalStock: number;
  physicalStock: number;
  variance: number; // physical - theoretical
  notes?: string;
  recordedBy: string;
}

export type ExpenseCategory = 'Biaya Tetap' | 'Biaya Variabel' | 'Gaji & Upah' | 'Lain-lain' | 'fixed' | 'variable';

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  recordedBy?: string;
  createdAt?: string;
}

export type PromoType = 'discount_pct' | 'discount_nom' | 'b1g1' | 'bundle';

export interface PromoRule {
  id: string;
  name: string;
  type: PromoType;
  targetProductIds: string[];
  discountValue: number; // % or nominal Rp
  buyQty?: number; // for B1G1
  freeQty?: number;
  bundleProductIds?: string[];
  bundlePrice?: number;
  startDate?: string;
  endDate?: string;
  validDays?: number[]; // 0=Sunday, 1=Monday...
  onlineAllowed: boolean; // default false
  isActive: boolean;
  notes?: string;
}

export interface ShiftClosing {
  id: string;
  date: string;
  cashierId: string;
  cashierName: string;
  openingCash: number;
  cashSales: number;
  qrisSales: number;
  cashDeposit: number;
  actualCashInDrawer: number;
  cashVariance: number; // actual - (opening + cashSales)
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  page?: string; // 'Produk & HPP', 'Bahan & Restock', 'Keuangan', 'Pengaturan', 'Promo', 'Auth'
  action: string;
  changesBefore?: string;
  changesAfter?: string;
  details: string;
  ipAddress?: string;
}

export interface BusinessParameters {
  rentMonthly: number; // Rp1.500.000
  otherFixedMonthly: number; // Rp3.000.000
  operationalDaysPerMonth: number; // 30
  initialPackageCapital: number; // Rp38.000.000
  initialDpPaid: number; // Rp19.000.000
  initialShippingCost: number; // Rp2.000.000
  ojolCommissionPct: number; // 20%
}
