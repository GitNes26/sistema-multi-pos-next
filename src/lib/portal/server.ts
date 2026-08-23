import { prisma } from "@/lib/db";
import type { $Enums, Prisma } from "@prisma/client";
import { notifyOrderEvent } from "@/lib/notifications/events";
import { round2, round3 } from "@/lib/pos/money";

// FASE 13 — Servidor del portal de clientes: catálogo, pedidos, lealtad,
// favoritos, listas de compra, perfil y métodos de pago.

export class PortalError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PortalError";
    this.status = status;
  }
}

const toNum = (v: Prisma.Decimal | number | string | null): number =>
  v == null ? 0 : Number(v);

// ── Cliente (resolución de sesión) ───────────────────────────────────────────

export interface PortalCustomer {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  customerCode: string | null;
  points: number;
  imageUrl: string | null;
  address: string | null;
}

export async function getPortalCustomer(
  organizationId: string,
  userId: string
): Promise<PortalCustomer | null> {
  const c = await prisma.customer.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      customerCode: true,
      points: true,
      imageUrl: true,
      address: true,
    },
  });
  if (!c) return null;
  return { ...c, points: toNum(c.points) };
}

// ── Productos del portal (reutiliza la forma del POS + favoritos) ────────────

export interface PortalBulkInfo {
  unitId: string;
  unitName: string;
  unitAbbrev: string;
  price: number;
  minQty: number;
  step: number;
  maxQty: number;
  allowSplit: boolean;
  split: {
    unitId: string;
    unitName: string;
    unitAbbrev: string;
    price: number;
  } | null;
}

export interface PortalVariantOption {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stock: number;
  isFavorite: boolean;
}

export interface PortalProduct {
  id: string;
  productId: string;
  kind: "standard" | "bulk";
  name: string;
  taxRate: number;
  categoryId: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  trackInventory: boolean;
  /** Stock total (granel) o suma de variantes (estándar). */
  stock: number;
  /** Estándar: opciones de variante (13.4 selector de variantes). */
  variants: PortalVariantOption[];
  /** Granel: precio por unidad + badge + split. */
  bulk: PortalBulkInfo | null;
}

export interface PortalCategory {
  id: string;
  name: string;
  imageUrl: string | null;
  productCount: number;
}

export async function getStorefront(
  organizationId: string,
  customerId: string | null
): Promise<{ categories: PortalCategory[]; products: PortalProduct[] }> {
  const [variantsRaw, bulkRaw, categories, favorites] = await Promise.all([
    prisma.productVariant.findMany({
      where: { organizationId, isActive: true, product: { isActive: true } },
      include: { product: { include: { category: true } } },
    }),
    prisma.product.findMany({
      where: { organizationId, isActive: true, productType: "bulk" },
      include: { category: true, bulkUnit: true, splitUnit: true },
    }),
    prisma.category.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, imageUrl: true },
    }),
    customerId
      ? prisma.customerFavorite.findMany({
          where: { customerId },
          select: { variantId: true },
        })
      : Promise.resolve([]),
  ]);

  const favoriteIds = new Set(favorites.map((f) => f.variantId));

  // Stock total de la org (suma de todas las sucursales activas).
  const locationIds = (
    await prisma.location.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
    })
  ).map((l) => l.id);
  const inventoryRows = await prisma.inventory.findMany({
    where: { organizationId, locationId: { in: locationIds } },
    select: { variantId: true, productId: true, quantity: true },
  });
  const variantStock = new Map<string, number>();
  const productStock = new Map<string, number>();
  for (const inv of inventoryRows) {
    const q = toNum(inv.quantity);
    if (inv.variantId) variantStock.set(inv.variantId, (variantStock.get(inv.variantId) ?? 0) + q);
    if (inv.productId) productStock.set(inv.productId, (productStock.get(inv.productId) ?? 0) + q);
  }

  // Estándar: agrupa variantes por producto para el selector (13.4).
  const stdByProduct = new Map<string, PortalProduct>();
  for (const v of variantsRaw) {
    const p = v.product;
    const stock = variantStock.get(v.id) ?? 0;
    let entry = stdByProduct.get(p.id);
    if (!entry) {
      entry = {
        id: p.id,
        productId: p.id,
        kind: "standard",
        name: p.name,
        taxRate: toNum(p.taxRate),
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        imageUrl: v.imageUrl ?? p.imageUrl,
        trackInventory: p.trackInventory,
        stock: 0,
        variants: [],
        bulk: null,
      };
      stdByProduct.set(p.id, entry);
    }
    entry.variants.push({
      id: v.id,
      name: v.name === "Default" ? "Estándar" : v.name,
      price: toNum(v.price),
      imageUrl: v.imageUrl ?? p.imageUrl,
      stock,
      isFavorite: favoriteIds.has(v.id),
    });
  }

  const products: PortalProduct[] = [...stdByProduct.values()];

  for (const p of bulkRaw) {
    products.push({
      id: p.id,
      productId: p.id,
      kind: "bulk",
      name: p.name,
      taxRate: toNum(p.taxRate),
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      imageUrl: p.imageUrl,
      trackInventory: p.trackInventory,
      stock: productStock.get(p.id) ?? 0,
      variants: [],
      bulk: {
        unitId: p.bulkUnitId ?? "",
        unitName: p.bulkUnit?.name ?? "Kilogramo",
        unitAbbrev: p.bulkUnit?.abbreviation ?? "kg",
        price: toNum(p.bulkPricePerUnit),
        minQty: toNum(p.bulkMinQuantity),
        step: toNum(p.bulkStep),
        maxQty: toNum(p.bulkMaxQuantity) || 0,
        allowSplit: p.allowSplit,
        split:
          p.allowSplit && p.splitUnit
            ? {
                unitId: p.splitUnit.id,
                unitName: p.splitUnit.name,
                unitAbbrev: p.splitUnit.abbreviation,
                price: toNum(p.splitPricePerUnit),
              }
            : null,
      },
    });
  }

  products.sort(
    (a, b) =>
      (a.categoryName ?? "").localeCompare(b.categoryName ?? "") ||
      a.name.localeCompare(b.name)
  );

  const categoriesWithCount: PortalCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    productCount: products.filter((p) => p.categoryId === c.id).length,
  }));

  return { categories: categoriesWithCount, products };
}

// ── Home (13.2) ──────────────────────────────────────────────────────────────

export interface PortalOrderBanner {
  id: string;
  orderNumber: number;
  status: string;
  deliveryMethod: string;
  total: number;
  itemsCount: number;
  createdAt: string;
}

export interface PortalHomeData {
  points: number;
  promotions: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    benefit: string;
    value: number;
    endsAt: string | null;
  }[];
  activeOrders: PortalOrderBanner[];
  newProducts: {
    id: string;
    name: string;
    price: number;
    imageUrl: string | null;
    kind: string;
  }[];
  publications: {
    id: string;
    title: string;
    content: string | null;
    imageUrl: string | null;
    type: string;
    publishedAt: string | null;
  }[];
}

export async function getPortalHome(
  organizationId: string,
  customerId: string
): Promise<PortalHomeData> {
  const now = new Date();

  const [customer, promotions, activeOrders, newProducts, publications] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { points: true },
    }),
    prisma.promotion.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: { priority: "asc" },
      take: 12,
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        benefit: true,
        value: true,
        endsAt: true,
      },
    }),
    prisma.order.findMany({
      where: {
        organizationId,
        customerId,
        status: { in: ["pending", "confirmed", "preparing", "ready"] },
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
      take: 10,
    }),
    prisma.product.findMany({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        imageUrl: true,
        productType: true,
        bulkPricePerUnit: true,
        variants: { where: { isActive: true }, select: { price: true } },
      },
    }),
    prisma.publication.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { publishedAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    points: toNum(customer?.points ?? null),
    promotions: promotions.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      benefit: p.benefit,
      value: toNum(p.value),
      endsAt: p.endsAt?.toISOString() ?? null,
    })),
    activeOrders: activeOrders.map((o) => ({
      id: o.id,
      orderNumber: Number(o.orderNumber),
      status: o.status,
      deliveryMethod: o.deliveryMethod,
      total: toNum(o.total),
      itemsCount: o._count.items,
      createdAt: o.createdAt.toISOString(),
    })),
    newProducts: newProducts.map((p) => {
      const variantPrices = p.variants.map((v) => toNum(v.price));
      return {
        id: p.id,
        name: p.name,
        price:
          p.productType === "bulk"
            ? toNum(p.bulkPricePerUnit)
            : variantPrices.length
              ? Math.min(...variantPrices)
              : 0,
        imageUrl: p.imageUrl,
        kind: p.productType,
      };
    }),
    publications: publications.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      imageUrl: p.imageUrl,
      type: p.type,
      publishedAt: p.publishedAt?.toISOString() ?? null,
    })),
  };
}

// ── Sucursales (13.6) ────────────────────────────────────────────────────────

export interface PortalLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: string | null;
  allowsPickup: boolean;
  allowsDelivery: boolean;
}

export async function listPortalLocations(organizationId: string): Promise<PortalLocation[]> {
  const rows = await prisma.location.findMany({
    where: { organizationId, isActive: true },
    orderBy: { name: "asc" },
  });
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address,
    latitude: l.latitude ? toNum(l.latitude) : null,
    longitude: l.longitude ? toNum(l.longitude) : null,
    openingHours: l.openingHours,
    allowsPickup: l.allowsPickup,
    allowsDelivery: l.allowsDelivery,
  }));
}

// ── Pedidos (13.6-13.8, 13.11) ───────────────────────────────────────────────

export interface PortalOrderInput {
  items: {
    productId: string;
    variantId: string | null;
    productType: "standard" | "bulk";
    productName: string;
    variantName: string | null;
    quantity: number;
    unitId: string | null;
    unitPrice: number;
    lineTotal: number;
    bulkQuantityDisplay?: string | null;
    comment?: string | null;
  }[];
  deliveryMethod: "pickup" | "delivery";
  locationId?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  paymentMethod: string;
  paymentReference?: string | null;
  subtotal: number;
  discount: number;
  deliveryFee?: number;
  total: number;
  notes?: string | null;
}

const VALID_PAYMENT_METHODS = ["cash", "card", "wallet", "other", "points"];

export interface PortalOrderRow {
  id: string;
  orderNumber: number;
  status: string;
  deliveryMethod: string;
  total: number;
  itemsCount: number;
  createdAt: string;
}

export async function listPortalOrders(
  organizationId: string,
  customerId: string
): Promise<PortalOrderRow[]> {
  const orders = await prisma.order.findMany({
    where: { organizationId, customerId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return orders.map((o) => ({
    id: o.id,
    orderNumber: Number(o.orderNumber),
    status: o.status,
    deliveryMethod: o.deliveryMethod,
    total: toNum(o.total),
    itemsCount: o._count.items,
    createdAt: o.createdAt.toISOString(),
  }));
}

export interface PortalOrderDetail {
  id: string;
  orderNumber: number;
  status: string;
  deliveryMethod: string;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  address: string | null;
  locationName: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  createdAt: string;
  updatedAt: string;
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitName: string | null;
    unitPrice: number;
    lineTotal: number;
    bulkQuantityDisplay: string | null;
    comment: string | null;
  }[];
  history: {
    status: string;
    notes: string | null;
    createdAt: string;
  }[];
}

export async function getPortalOrder(
  organizationId: string,
  customerId: string,
  orderId: string
): Promise<PortalOrderDetail | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId, customerId },
    include: {
      location: { select: { name: true } },
      items: { include: { unit: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return null;

  return {
    id: order.id,
    orderNumber: Number(order.orderNumber),
    status: order.status,
    deliveryMethod: order.deliveryMethod,
    subtotal: toNum(order.subtotal),
    discount: toNum(order.discount),
    total: toNum(order.total),
    notes: order.notes,
    address: order.address,
    locationName: order.location?.name ?? null,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantName: i.variantName,
      quantity: toNum(i.quantity),
      unitName: i.unit?.name ?? null,
      unitPrice: toNum(i.unitPrice),
      lineTotal: toNum(i.lineTotal),
      bulkQuantityDisplay: i.bulkQuantityDisplay,
      comment: i.comment,
    })),
    history: order.statusHistory.map((h) => ({
      status: h.status,
      notes: h.notes,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

export async function createPortalOrder(
  organizationId: string,
  customerId: string,
  input: PortalOrderInput
): Promise<PortalOrderDetail> {
  if (!input.items.length) throw new PortalError("El carrito está vacío");
  if (input.deliveryMethod !== "pickup" && input.deliveryMethod !== "delivery") {
    throw new PortalError("Método de entrega inválido");
  }
  if (!VALID_PAYMENT_METHODS.includes(input.paymentMethod)) {
    throw new PortalError("Método de pago inválido");
  }
  if (input.deliveryMethod === "pickup" && !input.locationId) {
    throw new PortalError("Selecciona una sucursal para recoger");
  }
  if (input.deliveryMethod === "delivery" && !input.address?.trim()) {
    throw new PortalError("Ingresa una dirección de entrega");
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new PortalError("Cliente no encontrado", 404);

  // Validación de stock: suma disponible en la org.
  const locationIds = (
    await prisma.location.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
    })
  ).map((l) => l.id);
  const inventoryRows = await prisma.inventory.findMany({
    where: { organizationId, locationId: { in: locationIds } },
    select: { variantId: true, productId: true, quantity: true },
  });
  const available = new Map<string, number>();
  for (const inv of inventoryRows) {
    const key = inv.variantId ?? inv.productId ?? "";
    if (!key) continue;
    available.set(key, (available.get(key) ?? 0) + toNum(inv.quantity));
  }
  for (const item of input.items) {
    const key = item.variantId ?? item.productId;
    if (!available.has(key) && item.quantity > 0) continue;
    const stock = available.get(key) ?? 0;
    if (item.quantity > stock) {
      throw new PortalError(`Stock insuficiente para "${item.productName}"`);
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        organizationId,
        customerId,
        locationId: input.locationId ?? null,
        status: "pending",
        deliveryMethod: input.deliveryMethod,
        subtotal: round2(input.subtotal),
        discount: round2(input.discount),
        deliveryFee: round2(input.deliveryFee ?? 0),
        total: round2(input.total),
        notes: input.notes ?? null,
        address: input.address ?? null,
        latitude: input.latitude != null ? input.latitude : null,
        longitude: input.longitude != null ? input.longitude : null,
        paymentMethod: input.paymentMethod as $Enums.PaymentMethod,
        paymentReference: input.paymentReference ?? null,
      },
    });

    await tx.orderItem.createMany({
      data: input.items.map((i) => ({
        orderId: created.id,
        productId: i.productId,
        variantId: i.variantId,
        productName: i.productName,
        variantName: i.variantName,
        productType: i.productType,
        quantity: round3(i.quantity),
        unitId: i.unitId,
        unitPrice: round2(i.unitPrice),
        lineTotal: round2(i.lineTotal),
        bulkQuantityDisplay: i.bulkQuantityDisplay ?? null,
        comment: i.comment ?? null,
      })),
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: created.id,
        status: "pending",
        userId: customer.userId,
      },
    });

    return created;
  });

  const detail = await getPortalOrder(organizationId, customerId, order.id);
  await notifyOrderEvent(organizationId, order.locationId, { userId: customer.userId }, {
    orderNumber: Number(order.orderNumber),
    status: "pending",
    customerName: customer.fullName,
    total: toNum(order.total),
  });

  return detail!;
}

export async function cancelPortalOrder(
  organizationId: string,
  customerId: string,
  orderId: string
): Promise<PortalOrderDetail> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId, customerId },
  });
  if (!order) throw new PortalError("Pedido no encontrado", 404);
  if (order.status !== "pending" && order.status !== "confirmed") {
    throw new PortalError("Este pedido ya no se puede cancelar");
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
    await tx.orderStatusHistory.create({
      data: { orderId, status: "cancelled", userId: order.customerId ? (await tx.customer.findUnique({ where: { id: order.customerId } }))?.userId : null },
    });
  });

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  await notifyOrderEvent(organizationId, order.locationId, { userId: customer?.userId }, {
    orderNumber: Number(order.orderNumber),
    status: "cancelled",
    customerName: customer?.fullName,
    total: toNum(order.total),
  });

  return (await getPortalOrder(organizationId, customerId, orderId))!;
}

// ── Lealtad (13.12) ──────────────────────────────────────────────────────────

export async function getLoyalty(organizationId: string, customerId: string) {
  const [customer, transactions] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { points: true } }),
    prisma.loyaltyTransaction.findMany({
      where: { organizationId, customerId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  return {
    points: toNum(customer?.points ?? null),
    transactions: transactions.map((t) => ({
      id: t.id,
      kind: t.kind,
      points: toNum(t.points),
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

// ── Perfil (13.13) ───────────────────────────────────────────────────────────

export async function updatePortalProfile(
  organizationId: string,
  customerId: string,
  input: { fullName?: string; phone?: string; email?: string; address?: string | null; imageUrl?: string | null }
): Promise<PortalCustomer> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new PortalError("Cliente no encontrado", 404);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: customer.userId },
      data: {
        ...(input.fullName ? { fullName: input.fullName } : {}),
        ...(input.email ? { email: input.email } : {}),
      },
    }),
    prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(input.fullName ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      },
    }),
  ]);

  return (await getPortalCustomer(organizationId, customer.userId))!;
}

// ── Favoritos (13.9) ─────────────────────────────────────────────────────────

export async function listFavorites(organizationId: string, customerId: string): Promise<string[]> {
  const rows = await prisma.customerFavorite.findMany({
    where: { customerId },
    select: { variantId: true },
  });
  return rows.map((r) => r.variantId);
}

export async function addFavorite(organizationId: string, customerId: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, organizationId },
    select: { id: true },
  });
  if (!variant) throw new PortalError("Producto no encontrado", 404);
  await prisma.customerFavorite.upsert({
    where: { customerId_variantId: { customerId, variantId } },
    create: { organizationId, customerId, variantId },
    update: {},
  });
  return { ok: true };
}

export async function removeFavorite(organizationId: string, customerId: string, variantId: string) {
  await prisma.customerFavorite.deleteMany({ where: { customerId, variantId } });
  return { ok: true };
}

// ── Listas de compra (13.10) ─────────────────────────────────────────────────

export interface ShoppingListInput {
  name: string;
  notes?: string | null;
  items: { variantId: string; quantity: number }[];
}

export interface ShoppingListRow {
  id: string;
  name: string;
  notes: string | null;
  itemsCount: number;
  createdAt: string;
}

export interface ShoppingListView {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  items: {
    id: string;
    variantId: string;
    quantity: number;
    productName: string;
    variantName: string | null;
    price: number;
    imageUrl: string | null;
  }[];
}

export async function listShoppingLists(
  organizationId: string,
  customerId: string
): Promise<ShoppingListRow[]> {
  const lists = await prisma.shoppingList.findMany({
    where: { customerId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    notes: l.notes,
    itemsCount: l._count.items,
    createdAt: l.createdAt.toISOString(),
  }));
}

export async function getShoppingList(
  organizationId: string,
  customerId: string,
  listId: string
): Promise<ShoppingListView | null> {
  const list = await prisma.shoppingList.findFirst({
    where: { id: listId, customerId },
    include: {
      items: {
        include: { variant: { include: { product: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!list) return null;
  return {
    id: list.id,
    name: list.name,
    notes: list.notes,
    createdAt: list.createdAt.toISOString(),
    items: list.items.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      quantity: toNum(i.quantity),
      productName: i.variant.product.name,
      variantName: i.variant.name === "Default" ? null : i.variant.name,
      price: toNum(i.variant.price),
      imageUrl: i.variant.imageUrl ?? i.variant.product.imageUrl,
    })),
  };
}

export async function createShoppingList(
  organizationId: string,
  customerId: string,
  input: ShoppingListInput
): Promise<ShoppingListView> {
  if (!input.name.trim()) throw new PortalError("El nombre es obligatorio");
  const list = await prisma.shoppingList.create({
    data: {
      organizationId,
      customerId,
      name: input.name.trim(),
      notes: input.notes ?? null,
      items: {
        create: input.items.map((i) => ({
          variantId: i.variantId,
          quantity: round3(i.quantity),
        })),
      },
    },
  });
  return (await getShoppingList(organizationId, customerId, list.id))!;
}

export async function updateShoppingList(
  organizationId: string,
  customerId: string,
  listId: string,
  input: ShoppingListInput
): Promise<ShoppingListView> {
  const list = await prisma.shoppingList.findFirst({ where: { id: listId, customerId } });
  if (!list) throw new PortalError("Lista no encontrada", 404);
  if (!input.name.trim()) throw new PortalError("El nombre es obligatorio");

  await prisma.$transaction([
    prisma.shoppingListItem.deleteMany({ where: { listId } }),
    prisma.shoppingList.update({
      where: { id: listId },
      data: {
        name: input.name.trim(),
        notes: input.notes ?? null,
        items: {
          create: input.items.map((i) => ({
            variantId: i.variantId,
            quantity: round3(i.quantity),
          })),
        },
      },
    }),
  ]);

  return (await getShoppingList(organizationId, customerId, listId))!;
}

export async function deleteShoppingList(
  organizationId: string,
  customerId: string,
  listId: string
) {
  const list = await prisma.shoppingList.findFirst({ where: { id: listId, customerId } });
  if (!list) throw new PortalError("Lista no encontrada", 404);
  await prisma.shoppingList.delete({ where: { id: listId } });
  return { ok: true };
}

export async function duplicateShoppingList(
  organizationId: string,
  customerId: string,
  listId: string
): Promise<ShoppingListView> {
  const list = await prisma.shoppingList.findFirst({
    where: { id: listId, customerId },
    include: { items: true },
  });
  if (!list) throw new PortalError("Lista no encontrada", 404);

  const copy = await prisma.shoppingList.create({
    data: {
      organizationId,
      customerId,
      name: `${list.name} (copia)`,
      notes: list.notes,
      items: {
        create: list.items.map((i) => ({ variantId: i.variantId, quantity: toNum(i.quantity) })),
      },
    },
  });
  return (await getShoppingList(organizationId, customerId, copy.id))!;
}

// ── Métodos de pago (13.14, 13.15) ───────────────────────────────────────────

export interface PaymentMethodView {
  id: string;
  alias: string | null;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  color: string | null;
  createdAt: string;
}

export async function listPaymentMethods(
  organizationId: string,
  customerId: string
): Promise<PaymentMethodView[]> {
  const rows = await prisma.customerPaymentMethod.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((m) => ({
    id: m.id,
    alias: m.alias,
    brand: m.brand,
    last4: m.last4,
    expMonth: m.expMonth,
    expYear: m.expYear,
    isDefault: m.isDefault,
    color: m.color,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function addPaymentMethod(
  organizationId: string,
  customerId: string,
  input: { alias?: string; brand?: string; last4: string; expMonth: number; expYear: number; isDefault?: boolean; color?: string }
): Promise<PaymentMethodView[]> {
  if (!input.last4 || !/^\d{4}$/.test(input.last4)) {
    throw new PortalError("Los últimos 4 dígitos son inválidos");
  }
  if (!input.expMonth || input.expMonth < 1 || input.expMonth > 12) {
    throw new PortalError("Mes de expiración inválido");
  }
  if (!input.expYear || input.expYear < new Date().getFullYear()) {
    throw new PortalError("Año de expiración inválido");
  }

  const isDefault = input.isDefault ?? false;
  const alias = input.alias ? String(input.alias).trim().slice(0, 40) : null;
  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.customerPaymentMethod.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }
    await tx.customerPaymentMethod.create({
      data: {
        customerId,
        organizationId,
        alias,
        brand: input.brand ?? null,
        last4: input.last4,
        expMonth: input.expMonth,
        expYear: input.expYear,
        isDefault,
        color: input.color ?? null,
      },
    });
  });

  return listPaymentMethods(organizationId, customerId);
}

export async function removePaymentMethod(
  organizationId: string,
  customerId: string,
  methodId: string
) {
  const method = await prisma.customerPaymentMethod.findFirst({
    where: { id: methodId, customerId },
  });
  if (!method) throw new PortalError("Método de pago no encontrado", 404);
  await prisma.customerPaymentMethod.delete({ where: { id: methodId } });
  return { ok: true };
}

export async function setDefaultPaymentMethod(
  organizationId: string,
  customerId: string,
  methodId: string
): Promise<PaymentMethodView[]> {
  const method = await prisma.customerPaymentMethod.findFirst({
    where: { id: methodId, customerId },
  });
  if (!method) throw new PortalError("Método de pago no encontrado", 404);
  await prisma.$transaction([
    prisma.customerPaymentMethod.updateMany({
      where: { customerId },
      data: { isDefault: false },
    }),
    prisma.customerPaymentMethod.update({
      where: { id: methodId },
      data: { isDefault: true },
    }),
  ]);
  return listPaymentMethods(organizationId, customerId);
}

export interface ExpiringCardView {
  id: string;
  alias: string | null;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

/** Tarjetas que vencen en los próximos 2 meses (13.15). */
export async function listExpiringCards(
  organizationId: string,
  customerId: string
): Promise<ExpiringCardView[]> {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12

  const methods = await prisma.customerPaymentMethod.findMany({
    where: { customerId, expYear: { not: null }, expMonth: { not: null } },
    select: { id: true, alias: true, brand: true, last4: true, expMonth: true, expYear: true },
  });

  return methods
    .filter((card) => {
      const expYear = card.expYear!;
      const expMonth = card.expMonth!;
      const totalMonths = expYear * 12 + expMonth;
      const nowMonths = y * 12 + m;
      const diff = totalMonths - nowMonths;
      return diff >= 0 && diff <= 2;
    })
    .map((c) => ({
      id: c.id,
      alias: c.alias,
      brand: c.brand,
      last4: c.last4,
      expMonth: c.expMonth,
      expYear: c.expYear,
    }));
}
