import type { $Enums } from "@prisma/client";

export type PosProductKind = "standard" | "bulk";

export interface PosBulkInfo {
  unitId: string;
  unitName: string;
  unitAbbrev: string;
  minQty: number;
  step: number;
  maxQty: number;
  allowSplit: boolean;
  split: { unitId: string; unitName: string; unitAbbrev: string; price: number } | null;
}

export interface PosVariant {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stock: number;
  isActive: boolean;
}

export interface PosProduct {
  id: string;
  productId: string;
  variantId: string | null;
  kind: PosProductKind;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  taxRate: number;
  categoryId: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  trackInventory: boolean;
  stock: number;
  bulk: PosBulkInfo | null;
  variantCount: number;
  variants: PosVariant[];
}

export interface PosCategory {
  id: string;
  name: string;
  imageUrl: string | null;
  productCount: number;
}

export interface PosCustomer {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  customerCode: string | null;
  points: number;
  imageUrl: string | null;
  address: string | null;
}

export interface PosPromotionTarget {
  kind: $Enums.PromotionTargetKind;
  targetId: string;
}

export interface PosPromotion {
  id: string;
  name: string;
  description: string | null;
  benefit: $Enums.PromoBenefit;
  scope: $Enums.PromoScope;
  value: number;
  buyQuantity: number;
  getQuantity: number;
  minAmount: number;
  minQuantity: number;
  couponCode: string | null;
  requiresCustomer: boolean;
  priority: number;
  exclusive: boolean;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  usesCount: number;
  startsAt: string | null;
  endsAt: string | null;
  weekdays: string | null;
  startTime: string | null;
  endTime: string | null;
  targets: PosPromotionTarget[];
}

export interface PosCashRegister {
  id: string;
  name: string;
  folioPrefix: string | null;
}

export interface PosLocation {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
}

export interface PosCashSession {
  id: string;
  status: $Enums.CashSessionStatus;
  openingCash: number;
  openedAt: string;
  closingCash: number | null;
  closedAt: string | null;
  registerId: string;
  registerName: string;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  status: $Enums.OrderStatus;
  deliveryMethod: $Enums.DeliveryMethod;
  customerName: string | null;
  itemsCount: number;
  total: number;
  createdAt: string;
}

export interface PosLoyaltyConfig {
  pointValue: number;
  pointsPerCurrency: number;
  enabled: boolean;
}

export interface PosCatalog {
  location: PosLocation;
  company: { name: string | null; logoUrl: string | null; address: string | null; city: string | null; phone: string | null; ticketFooter: string | null };
  products: PosProduct[];
  categories: PosCategory[];
  customers: PosCustomer[];
  promotions: PosPromotion[];
  registers: PosCashRegister[];
  session: PosCashSession | null;
  cashier: { userId: string; employeeId: string | null; name: string };
  loyalty: PosLoyaltyConfig;
}

export interface PosLineItem {
  key: string;
  productId: string;
  variantId: string | null;
  kind: PosProductKind;
  name: string;
  imageUrl?: string | null;
  categoryId: string | null;
  unitPrice: number;
  unitAbbrev: string;
  qty: number;
  taxRate: number;
  unitId: string | null;
  trackInventory: boolean;
  stock: number;
  bulkQuantityDisplay?: string;
}

export interface PosSalePayload {
  items: {
    productId: string;
    variantId: string | null;
    productType: $Enums.ProductType;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitId: string | null;
    unitPrice: number;
    totalPrice: number;
    discount: number;
    taxRate: number;
    lineTotal: number;
    bulkQuantityDisplay?: string;
    trackInventory: boolean;
  }[];
  customerId?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  changeGiven: number;
  pointsEarned: number;
  pointsRedeemed: number;
  pointsRedeemedValue: number;
  payments: { method: $Enums.PaymentMethod; amount: number; reference?: string }[];
  discounts: { label: string; amount: number; promotionId?: string }[];
  cashSessionId?: string;
  cashRegisterId?: string;
  couponCode?: string;
  nextPurchaseCoupon?: { promotionId: string; amount: number };
  notes?: string;
}
