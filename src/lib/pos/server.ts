import { prisma } from "@/lib/db";
import type { Prisma, $Enums } from "@prisma/client";
import type {
  PosCashRegister,
  PosCashSession,
  PosCatalog,
  PosOrder,
  PosProduct,
  PosSalePayload,
} from "@/types/pos";
import { round2 } from "./money";
import { maybeNotifyLowStock } from "@/lib/inventory/server";
import { notifySaleCompleted } from "@/lib/notifications/events";

export class PosError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PosError";
    this.status = status;
  }
}

const toNum = (v: Prisma.Decimal | number | string | null): number =>
  v == null ? 0 : Number(v);

function firstActiveLocation<T extends { isActive: boolean }>(locations: T[]): T | undefined {
  return locations.find((l) => l.isActive) ?? locations[0];
}

/**
 * Catálogo completo del POS para una organización/sucursal. Se serializan los
 * Decimal a number para poder pasar los datos a componentes client sin romper
 * RSC (igual que en FASE 5 con los iconos: nada no-serializable en props).
 */
export async function getPosCatalog(
  organizationId: string,
  userId: string
): Promise<PosCatalog> {
  const [locations, productsRaw, bulkRaw, categories, customers, promotions, registers, employee, userData, cashSession] =
    await Promise.all([
      prisma.location.findMany({
        where: { organizationId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, code: true, isActive: true },
      }),
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
      prisma.customer.findMany({
        where: { organizationId, isActive: true },
        orderBy: { fullName: "asc" },
        take: 1000,
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
      }),
      prisma.promotion.findMany({
        where: { organizationId, isActive: true },
        include: { targets: true },
      }),
      prisma.cashRegister.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, folioPrefix: true },
      }),
      prisma.employee.findFirst({
        where: { organizationId, userId: { equals: userId } },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      }),
      prisma.cashSession.findFirst({
        where: { organizationId, status: "open" },
        include: { cashRegister: { select: { id: true, name: true } } },
        orderBy: { openedAt: "desc" },
      }),
    ]);

  const location = firstActiveLocation(locations);
  if (!location) {
    throw new PosError("No se encontró una sucursal activa para la organización", 400);
  }

  const inventoryRows = await prisma.inventory.findMany({
    where: {
      organizationId,
      locationId: location.id,
      locationType: "location",
    },
    select: { variantId: true, productId: true, quantity: true },
  });
  const variantStock = new Map<string, number>();
  const productStock = new Map<string, number>();
  for (const inv of inventoryRows) {
    const q = toNum(inv.quantity);
    if (inv.variantId) variantStock.set(inv.variantId, q);
    if (inv.productId) productStock.set(inv.productId, q);
  }

  const products: PosProduct[] = [];

  for (const v of productsRaw) {
    const p = v.product;
    const name =
      v.name === "Default" ? p.name : `${p.name} ${v.name}`;
    products.push({
      id: v.id,
      productId: p.id,
      variantId: v.id,
      kind: "standard",
      name,
      sku: v.sku,
      barcode: v.barcode,
      price: toNum(v.price),
      taxRate: toNum(p.taxRate),
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      imageUrl: v.imageUrl ?? p.imageUrl,
      trackInventory: p.trackInventory,
      stock: variantStock.get(v.id) ?? 0,
      bulk: null,
    });
  }

  for (const p of bulkRaw) {
    products.push({
      id: p.id,
      productId: p.id,
      variantId: null,
      kind: "bulk",
      name: p.name,
      sku: null,
      barcode: null,
      price: toNum(p.bulkPricePerUnit),
      taxRate: toNum(p.taxRate),
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      imageUrl: p.imageUrl,
      trackInventory: p.trackInventory,
      stock: productStock.get(p.id) ?? 0,
      bulk: {
        unitId: p.bulkUnitId ?? "",
        unitName: p.bulkUnit?.name ?? "Kilogramo",
        unitAbbrev: p.bulkUnit?.abbreviation ?? "kg",
        minQty: toNum(p.bulkMinQuantity),
        step: toNum(p.bulkStep),
        maxQty: toNum(p.bulkMaxQuantity) || 0,
        allowSplit: p.allowSplit,
        split: p.allowSplit && p.splitUnit
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

  const categoriesWithCount = categories.map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    productCount: products.filter((p) => p.categoryId === c.id).length,
  }));

  const registersMapped: PosCashRegister[] = registers.map((r) => ({
    id: r.id,
    name: r.name,
    folioPrefix: r.folioPrefix,
  }));

  const session: PosCashSession | null = cashSession
    ? {
        id: cashSession.id,
        status: cashSession.status,
        openingCash: toNum(cashSession.openingCash),
        openedAt: cashSession.openedAt.toISOString(),
        closingCash: cashSession.closingCash == null ? null : toNum(cashSession.closingCash),
        closedAt: cashSession.closedAt?.toISOString() ?? null,
        registerId: cashSession.cashRegister.id,
        registerName: cashSession.cashRegister.name,
      }
    : null;

  return {
    location: {
      id: location.id,
      name: location.name,
      code: location.code,
    },
    products,
    categories: categoriesWithCount,
    customers: customers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      phone: c.phone,
      email: c.email,
      customerCode: c.customerCode,
      points: toNum(c.points),
      imageUrl: c.imageUrl,
      address: c.address,
    })),
    promotions: promotions.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      benefit: p.benefit,
      scope: p.scope,
      value: toNum(p.value),
      buyQuantity: p.buyQuantity,
      getQuantity: p.getQuantity,
      minAmount: toNum(p.minAmount),
      minQuantity: toNum(p.minQuantity),
      couponCode: p.couponCode,
      requiresCustomer: p.requiresCustomer,
      priority: p.priority,
      exclusive: p.exclusive,
      maxUses: p.maxUses,
      maxUsesPerCustomer: p.maxUsesPerCustomer,
      usesCount: p.usesCount,
      startsAt: p.startsAt?.toISOString() ?? null,
      endsAt: p.endsAt?.toISOString() ?? null,
      weekdays: p.weekdays,
      startTime: p.startTime,
      endTime: p.endTime,
      targets: p.targets.map((t) => ({ kind: t.kind, targetId: t.targetId })),
    })),
registers: registersMapped,
    session,
    cashier: {
      userId,
      employeeId: employee?.id ?? null,
      name: userData?.fullName ?? "",
    },
  };
}

const ORDER_STATUSES: $Enums.OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
];

export async function getRecentOrders(
  organizationId: string,
  locationId: string
): Promise<PosOrder[]> {
  const orders = await prisma.order.findMany({
    where: { organizationId, locationId },
    include: {
      customer: { select: { fullName: true } },
      items: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return orders
    .map((o) => ({
      id: o.id,
      orderNumber: `#${Number(o.orderNumber)}`,
      status: o.status,
      deliveryMethod: o.deliveryMethod,
      customerName: o.customer?.fullName ?? null,
      itemsCount: o.items.length,
      total: toNum(o.total),
      createdAt: o.createdAt.toISOString(),
    }))
    .sort(
      (a, b) =>
        ORDER_STATUSES.indexOf(a.status) - ORDER_STATUSES.indexOf(b.status) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

export async function getSalesStats(organizationId: string, locationId: string) {
  const [todayStart, session] = await Promise.all([
    prisma.sale.findMany({
      where: { organizationId, locationId, status: "completed", createdAt: { gte: startOfDay() } },
      select: { total: true },
    }),
    prisma.cashSession.findFirst({
      where: { organizationId, cashRegister: { locationId }, status: "open" },
      include: { sales: { where: { status: "completed" }, select: { total: true, payments: true, changeGiven: true } } },
    }),
  ]);

  const sessionCashData = session
    ? {
        sales: session.sales.length,
        cashPayments: round2(
          session.sales.reduce(
            (acc, s) => acc + s.payments.filter((p) => p.method === "cash").reduce((x, p) => x + toNum(p.amount), 0),
            0
          )
        ),
        changeGiven: round2(session.sales.reduce((acc, s) => acc + toNum(s.changeGiven), 0)),
      }
    : null;

  return {
    todaySales: todayStart.reduce((acc, s) => acc + toNum(s.total), 0),
    todayCount: todayStart.length,
    session: sessionCashData,
  };
}

function startOfDay(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export async function validateCoupon(
  organizationId: string,
  code: string,
  customerId?: string
): Promise<
  | { ok: true; label: string; percent?: number; amount: number; couponId?: string; promotionId?: string }
  | { ok: false; error: string }
> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: "Ingresa un código de cupón" };

  const coupon = await prisma.coupon.findFirst({ where: { organizationId, code: trimmed } });
  if (coupon) {
    if (coupon.redeemedAt) return { ok: false, error: "Este cupón ya fue utilizado" };
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return { ok: false, error: "Este cupón está vencido" };
    if (coupon.customerId && (!customerId || coupon.customerId !== customerId))
      return { ok: false, error: "Este cupón pertenece a otro cliente" };
    return {
      ok: true,
      label: `Cupón ${trimmed}`,
      amount: toNum(coupon.amount),
      percent: toNum(coupon.percent) > 0 ? toNum(coupon.percent) : undefined,
      couponId: coupon.id,
      promotionId: coupon.promotionId ?? undefined,
    };
  }

  const promo = await prisma.promotion.findFirst({
    where: { organizationId, couponCode: trimmed, isActive: true },
  });
  if (promo) {
    if (promo.endsAt && promo.endsAt < new Date()) return { ok: false, error: "Este cupón está vencido" };
    if (promo.maxUses != null && promo.usesCount >= promo.maxUses)
      return { ok: false, error: "Este cupón alcanzó su límite de usos" };
    const percent = promo.benefit === "percent_off" ? toNum(promo.value) : 0;
    const amount = promo.benefit === "amount_off" ? toNum(promo.value) : 0;
    if (!percent && !amount) return { ok: false, error: "Este cupón no aplica como descuento" };
    return {
      ok: true,
      label: promo.name,
      percent: percent > 0 ? percent : undefined,
      amount,
      promotionId: promo.id,
    };
  }

  return { ok: false, error: "Cupón no válido" };
}

function nextPurchaseCoupons(payload: PosSalePayload) {
  return payload.nextPurchaseCoupon
    ? [{ promotionId: payload.nextPurchaseCoupon.promotionId, amount: payload.nextPurchaseCoupon.amount }]
    : [];
}

export async function createSale(
  organizationId: string,
  locationId: string,
  payload: PosSalePayload,
  ctx: { userId: string; employeeId: string | null }
): Promise<{ id: string; saleNumber: string; locationName: string }> {
  if (!payload.items.length) throw new PosError("El ticket está vacío", 400);

  const payable = round2(payload.total - payload.pointsRedeemedValue);
  const paid = round2(payload.payments.reduce((acc, p) => acc + p.amount, 0));
  if (round2(paid - payable) < -0.01) {
    throw new PosError("Los pagos no cubren el total", 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const loc = await tx.location.findFirst({ where: { id: locationId, organizationId } });
    if (!loc) throw new PosError("Sucursal no encontrada", 400);

    // Reservar secuencia de ticket por sucursal (6.12 – folio).
    await tx.location.update({
      where: { id: locationId },
      data: { saleSeq: { increment: 1 } },
    });
    const updated = await tx.location.findUniqueOrThrow({ where: { id: locationId } });
    const locationSaleNumber = updated.saleSeq;

    // Validar y descontar inventario (6.12 – ticket correcto/posible error de stock).
    for (const item of payload.items) {
      if (!item.trackInventory) continue;
      const where: Prisma.InventoryWhereUniqueInput = item.variantId
        ? { variantId_locationId_locationType: { variantId: item.variantId, locationId, locationType: "location" } }
        : { productId_locationId_locationType: { productId: item.productId, locationId, locationType: "location" } };
      const inv = await tx.inventory.findUnique({ where });
      if (!inv) throw new PosError(`Sin inventario registrado para ${item.productName}`, 400);
      const current = toNum(inv.quantity);
      if (current < item.quantity) {
        throw new PosError(`Stock insuficiente para ${item.productName} (disponible ${current})`, 409);
      }
    }

    const sale = await tx.sale.create({
      data: {
        organizationId,
        locationId,
        cashSessionId: payload.cashSessionId,
        cashRegisterId: payload.cashRegisterId,
        cashierId: ctx.userId,
        employeeId: ctx.employeeId,
        customerId: payload.customerId,
        locationSaleNumber,
        subtotal: payload.subtotal,
        discount: payload.discount,
        tax: payload.tax,
        total: payload.total,
        pointsEarned: payload.pointsEarned,
        pointsRedeemed: payload.pointsRedeemed,
        changeGiven: payload.changeGiven,
        status: "completed",
        notes: payload.notes,
      },
    });

    if (payload.items.length) {
      await tx.saleItem.createMany({
        data: payload.items.map((i) => ({
          saleId: sale.id,
          productId: i.productId,
          variantId: i.variantId,
          productName: i.productName,
          variantName: i.variantName,
          productType: i.productType,
          quantity: i.quantity,
          unitId: i.unitId,
          unitPrice: i.unitPrice,
          unitCost: null,
          totalPrice: i.totalPrice,
          discount: i.discount,
          taxRate: i.taxRate,
          lineTotal: i.lineTotal,
          bulkQuantityDisplay: i.bulkQuantityDisplay,
        })),
      });
    }

    if (payload.payments.length) {
      await tx.salePayment.createMany({
        data: payload.payments.map((p) => ({
          saleId: sale.id,
          method: p.method,
          amount: p.amount,
          reference: p.reference,
        })),
      });
    }

    if (payload.discounts.length) {
      await tx.saleDiscount.createMany({
        data: payload.discounts.map((d) => ({
          saleId: sale.id,
          promotionId: d.promotionId,
          label: d.label,
          amount: d.amount,
        })),
      });
    }
    for (const d of payload.discounts) {
      if (d.promotionId) {
        await tx.promotion.update({
          where: { id: d.promotionId },
          data: { usesCount: { increment: 1 } },
        });
      }
    }

    // Descontar inventario y registrar movimientos.
    const touchedInventoryIds: string[] = [];
    for (const item of payload.items) {
      if (!item.trackInventory) continue;
      const where: Prisma.InventoryWhereUniqueInput = item.variantId
        ? { variantId_locationId_locationType: { variantId: item.variantId, locationId, locationType: "location" } }
        : { productId_locationId_locationType: { productId: item.productId, locationId, locationType: "location" } };
      const inv = await tx.inventory.update({
        where,
        data: { quantity: { decrement: item.quantity }, updatedAt: new Date() },
      });
      touchedInventoryIds.push(inv.id);
      await tx.inventoryMovement.create({
        data: {
          organizationId,
          productId: item.variantId ? null : item.productId,
          variantId: item.variantId ?? null,
          locationId,
          locationType: "location",
          type: "sale",
          quantity: item.quantity,
          unitId: item.unitId,
          reason: "Venta POS",
          referenceId: sale.id,
          userId: ctx.userId,
          employeeId: ctx.employeeId,
        },
      });
    }

    // Redimir cupón si aplica (6.8).
    if (payload.couponCode) {
      await redeemCouponTx(tx, organizationId, payload.couponCode, sale.id);
    }

    // Generar cupón de próxima compra cuando una promoción lo otorga (6.8).
    for (const np of nextPurchaseCoupons(payload)) {
      const code = await nextCouponCode(tx, organizationId);
      await tx.coupon.create({
        data: {
          organizationId,
          promotionId: np.promotionId,
          code,
          amount: np.amount,
          customerId: payload.customerId ?? null,
          expiresAt: addDays(new Date(), 30),
        },
      });
      await tx.promotion.update({
        where: { id: np.promotionId },
        data: { usesCount: { increment: 1 } },
      });
    }

    // Loyalty: ganar y/o canjear puntos (6.7 / 6.10).
    if (payload.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: payload.customerId, organizationId },
        select: { id: true },
      });
      if (customer) {
        if (payload.pointsEarned > 0) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { points: { increment: payload.pointsEarned } },
          });
          await tx.loyaltyTransaction.create({
            data: {
              organizationId,
              customerId: customer.id,
              saleId: sale.id,
              kind: "earn",
              points: payload.pointsEarned,
              note: "Venta POS",
            },
          });
        }
        if (payload.pointsRedeemed > 0) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { points: { decrement: payload.pointsRedeemed } },
          });
          await tx.loyaltyTransaction.create({
            data: {
              organizationId,
              customerId: customer.id,
              saleId: sale.id,
              kind: "redeem",
              points: payload.pointsRedeemed,
              note: "Canje en POS",
            },
          });
        }
      }
    }

    return { sale, locationName: loc.name, touchedInventoryIds };
  });

  await Promise.all(
    (result.touchedInventoryIds ?? []).map((id) =>
      maybeNotifyLowStock(organizationId, id, {
        userId: ctx.userId,
        employeeId: ctx.employeeId,
      })
    )
  );

  // Notificar venta completada por SSE (11.6) — fuera de la transacción.
  await notifySaleCompleted(organizationId, result.sale.locationId, ctx, {
    locationSaleNumber: result.sale.locationSaleNumber == null ? null : Number(result.sale.locationSaleNumber),
    saleNumber: String(result.sale.saleNumber),
    total: toNum(result.sale.total),
    locationName: result.locationName,
  });

  return {
    id: result.sale.id,
    saleNumber: `#${Number(result.sale.locationSaleNumber)}`,
    locationName: result.locationName,
  };
}

async function redeemCouponTx(
  tx: Prisma.TransactionClient,
  organizationId: string,
  code: string,
  saleId: string
) {
  const trimmed = code.trim().toUpperCase();
  const coupon = await tx.coupon.findFirst({ where: { organizationId, code: trimmed } });
  if (coupon && !coupon.redeemedAt) {
    await tx.coupon.update({
      where: { id: coupon.id },
      data: { redeemedAt: new Date(), redeemedSaleId: saleId },
    });
  }
  return coupon?.promotionId ?? null;
}

async function nextCouponCode(tx: Prisma.TransactionClient, organizationId: string): Promise<string> {
  const count = await tx.coupon.count({ where: { organizationId } });
  const candidate = `NEXT-${1000 + count + 1}`;
  const existing = await tx.coupon.findFirst({ where: { organizationId, code: candidate } });
  return existing ? `NEXT-${Date.now()}` : candidate;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export async function getCurrentCashSession(organizationId: string, locationId: string) {
  const s = await prisma.cashSession.findFirst({
    where: { organizationId, cashRegister: { locationId }, status: "open" },
    include: { cashRegister: { select: { id: true, name: true } } },
    orderBy: { openedAt: "desc" },
  });
  return s
    ? {
        id: s.id,
        status: s.status,
        openingCash: toNum(s.openingCash),
        openedAt: s.openedAt.toISOString(),
        closingCash: s.closingCash == null ? null : toNum(s.closingCash),
        closedAt: s.closedAt?.toISOString() ?? null,
        registerId: s.cashRegister.id,
        registerName: s.cashRegister.name,
      }
    : null;
}

export async function openCashSession(
  organizationId: string,
  locationId: string,
  registerId: string,
  openingCash: number,
  userId: string
) {
  const existing = await prisma.cashSession.findFirst({
    where: { organizationId, cashRegister: { locationId }, status: "open" },
  });
  if (existing) return { created: false, session: await getCurrentCashSession(organizationId, locationId) };

  const reg = await prisma.cashRegister.findFirst({
    where: { id: registerId, organizationId, locationId },
  });
  if (!reg) throw new PosError("Caja no encontrada en la sucursal", 400);

  const session = await prisma.cashSession.create({
    data: {
      organizationId,
      locationId,
      cashRegisterId: registerId,
      openingCash: round2(openingCash),
      userId,
      openedBy: userId,
      status: "open",
    },
  });
  return {
    created: true,
    session: {
      id: session.id,
      status: session.status as $Enums.CashSessionStatus,
      openingCash: toNum(session.openingCash),
      openedAt: session.openedAt.toISOString(),
      closingCash: null,
      closedAt: null,
      registerId,
      registerName: reg.name,
    },
  };
}

export async function closeCashSession(
  organizationId: string,
  sessionId: string,
  closingCash: number,
  notes?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.cashSession.findFirst({
      where: { id: sessionId, organizationId, status: "open" },
    });
    if (!session) throw new PosError("La caja no está abierta", 400);

    const sales = await tx.sale.findMany({
      where: { cashSessionId: session.id, status: "completed" },
      include: { payments: true },
      orderBy: { createdAt: "asc" },
    });

    const cashPayments = round2(
      sales.reduce(
        (acc, s) => acc + s.payments.filter((p) => p.method === "cash").reduce((x, p) => x + toNum(p.amount), 0),
        0
      )
    );
    const changeGiven = round2(sales.reduce((acc, s) => acc + toNum(s.changeGiven), 0));
    const totalSales = round2(sales.reduce((acc, s) => acc + toNum(s.total), 0));
    const expectedCash = round2(toNum(session.openingCash) + cashPayments - changeGiven);

    const updated = await tx.cashSession.update({
      where: { id: session.id },
      data: { closingCash: round2(closingCash), notes, closedAt: new Date(), status: "closed" },
    });

    return {
      id: updated.id,
      salesCount: sales.length,
      totalSales,
      cashPayments,
      changeGiven,
      openingCash: toNum(session.openingCash),
      expectedCash,
      closingCash: round2(closingCash),
      difference: round2(closingCash - expectedCash),
      closedAt: updated.closedAt?.toISOString() ?? null,
    };
  });
  return result;
}