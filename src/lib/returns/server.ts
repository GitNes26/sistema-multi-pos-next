import { prisma } from "@/lib/db";
import { CrudError } from "@/lib/crud/types";
import { registerMovement } from "@/lib/inventory/server";

// FASE — Sistema de devoluciones/cambios.

const num = (v: unknown) => (v == null ? 0 : Number(v));

function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "DEV-";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Crear devolución ────────────────────────────────────────────────────────

export interface CreateReturnInput {
  saleId: string;
  returnType: "exchange" | "refund" | "coupon" | "points";
  reason?: string;
  notes?: string;
  items: {
    saleItemId: string;
    quantity: number;
    reason?: string;
    restockable?: boolean;
  }[];
  // Para exchange: id del producto variante de reemplazo
  exchangeVariantId?: string;
}

export async function createReturn(
  organizationId: string,
  userId: string,
  input: CreateReturnInput
) {
  const sale = await prisma.sale.findFirst({
    where: { id: input.saleId, organizationId },
    include: {
      items: true,
      payments: true,
      customer: true,
      cashSession: true,
    },
  });
  if (!sale) throw new CrudError("Venta no encontrada", 404);
  if (sale.status === "voided") throw new CrudError("No se puede devolver una venta anulada", 400);

  // Validar que no tenga devoluciones pendientes/completadas que cubran los mismos items
  const existingReturns = await prisma.saleReturn.findMany({
    where: { saleId: input.saleId, status: { in: ["pending", "approved", "completed"] } },
    include: { items: true },
  });

  // Calcular totales
  let subtotal = 0;
  let tax = 0;
  const returnItems: {
    saleItemId: string;
    productId: string | null;
    variantId: string | null;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    reason?: string;
    restockable: boolean;
  }[] = [];

  for (const item of input.items) {
    const saleItem = sale.items.find((si) => si.id === item.saleItemId);
    if (!saleItem) throw new CrudError(`Item de venta no encontrado: ${item.saleItemId}`, 404);

    // Verificar que la cantidad no exceda la original
    const alreadyReturned = existingReturns.reduce((acc, ret) => {
      const ri = ret.items.find((i) => i.saleItemId === item.saleItemId);
      return acc + (ri ? num(ri.quantity) : 0);
    }, 0);
    const maxReturnable = num(saleItem.quantity) - alreadyReturned;
    if (item.quantity > maxReturnable) {
      throw new CrudError(
        `Cantidad excesiva para "${saleItem.productName}". Máximo retornable: ${maxReturnable}`,
        400
      );
    }

    const unitPrice = num(saleItem.unitPrice);
    const lineTotal = Math.round(item.quantity * unitPrice * 100) / 100;
    const itemTax = num(saleItem.taxRate) * lineTotal;

    subtotal += lineTotal;
    tax += itemTax;

    returnItems.push({
      saleItemId: saleItem.id,
      productId: saleItem.productId,
      variantId: saleItem.variantId,
      productName: saleItem.productName,
      variantName: saleItem.variantName,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
      reason: item.reason,
      restockable: item.restockable ?? true,
    });
  }

  const total = Math.round((subtotal + tax) * 100) / 100;

  // Crear la devolución
  const ret = await prisma.saleReturn.create({
    data: {
      organizationId,
      saleId: input.saleId,
      locationId: sale.locationId,
      cashSessionId: input.returnType === "refund" ? sale.cashSessionId : null,
      employeeId: sale.employeeId,
      userId,
      returnType: input.returnType,
      status: "pending",
      reason: input.reason,
      subtotal,
      tax,
      total,
      notes: input.notes,
      items: {
        create: returnItems,
      },
    },
    include: { items: true },
  });

  return ret;
}

// ── Aprobar devolución ──────────────────────────────────────────────────────

export async function approveReturn(
  organizationId: string,
  returnId: string
) {
  const ret = await prisma.saleReturn.findFirst({
    where: { id: returnId, organizationId },
    include: { items: true },
  });
  if (!ret) throw new CrudError("Devolución no encontrada", 404);
  if (ret.status !== "pending") throw new CrudError("Solo se pueden aprobar devoluciones pendientes", 400);

  return prisma.saleReturn.update({
    where: { id: returnId },
    data: { status: "approved" },
  });
}

// ── Procesar/devolver ───────────────────────────────────────────────────────

export async function completeReturn(
  organizationId: string,
  returnId: string,
  userId: string
) {
  const ret = await prisma.saleReturn.findFirst({
    where: { id: returnId, organizationId },
    include: {
      items: true,
      sale: {
        include: { payments: true, customer: true, loyaltyTransactions: true },
      },
    },
  });
  if (!ret) throw new CrudError("Devolución no encontrada", 404);
  if (ret.status !== "approved") throw new CrudError("Solo se pueden procesar devoluciones aprobadas", 400);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: any[] = [];

  // 1. Movimientos de inventario: devolver productos al stock
  for (const item of ret.items) {
    if (!item.restockable) continue; // Si no es re-estacionable, no devuelve al stock

    // Buscar inventario del producto en la ubicación de la venta
    const inv = await prisma.inventory.findFirst({
      where: {
        organizationId,
        variantId: item.variantId ?? undefined,
        productId: item.productId ?? undefined,
        locationId: ret.locationId,
      },
    });

    if (inv) {
      await registerMovement(
        organizationId,
        {
          inventoryId: inv.id,
          type: "return",
          quantity: Number(item.quantity),
          reason: `Devolución #${returnId.slice(-8)}: ${item.reason ?? ret.reason ?? "Sin motivo"}`,
        },
        userId
      );
    }
  }

  // 2. Según tipo de resolución
  switch (ret.returnType) {
    case "refund": {
      // Reversar puntos ganados en esta venta (proporcional)
      if (ret.sale.customer && num(ret.sale.pointsEarned) > 0) {
        const returnRatio = num(ret.total) / num(ret.sale.total);
        const pointsToReverse = Math.round(num(ret.sale.pointsEarned) * returnRatio);
        if (pointsToReverse > 0) {
          const customer = await prisma.customer.findUnique({
            where: { id: ret.sale.customerId! },
          });
          if (customer) {
            updates.push(
              prisma.customer.update({
                where: { id: ret.sale.customerId! },
                data: { points: Math.max(0, num(customer.points) - pointsToReverse) },
              }),
              prisma.loyaltyTransaction.create({
                data: {
                  organizationId,
                  customerId: ret.sale.customerId!,
                  saleId: ret.saleId,
                  kind: "adjust",
                  points: -pointsToReverse,
                  note: `Reversa por devolución #${returnId.slice(-8)}`,
                },
              })
            );
          }
        }
      }
      break;
    }
    case "coupon": {
      const code = generateCouponCode();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 3); // Vence en 3 meses
      updates.push(
        prisma.coupon.create({
          data: {
            organizationId,
            customerId: ret.sale.customerId,
            code,
            amount: ret.total,
            expiresAt,
          },
        }),
        prisma.saleReturn.update({
          where: { id: returnId },
          data: { couponCode: code, couponAmount: ret.total, couponExpiresAt: expiresAt },
        })
      );
      break;
    }
    case "points": {
      // Bonificar el monto como puntos
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { pointsPerCurrency: true, loyaltyEnabled: true },
      });
      if (org?.loyaltyEnabled && ret.sale.customerId) {
        const pointsToAward = Math.round(num(ret.total) * num(org.pointsPerCurrency));
        if (pointsToAward > 0) {
          const customer = await prisma.customer.findUnique({
            where: { id: ret.sale.customerId },
          });
          if (customer) {
            updates.push(
              prisma.customer.update({
                where: { id: ret.sale.customerId },
                data: { points: num(customer.points) + pointsToAward },
              }),
              prisma.loyaltyTransaction.create({
                data: {
                  organizationId,
                  customerId: ret.sale.customerId,
                  saleId: ret.saleId,
                  kind: "earn",
                  points: pointsToAward,
                  note: `Bonificación por devolución #${returnId.slice(-8)}`,
                },
              }),
              prisma.saleReturn.update({
                where: { id: returnId },
                data: { pointsAwarded: pointsToAward },
              })
            );
          }
        }
      }
      break;
    }
    case "exchange": {
      // Para exchange, el empleado crea una nueva venta aparte con el producto de reemplazo
      // La devolución solo registra el movimiento y marca como completada
      break;
    }
  }

  updates.push(
    prisma.saleReturn.update({
      where: { id: returnId },
      data: { status: "completed" },
    })
  );

  await prisma.$transaction(updates);

  return prisma.saleReturn.findUnique({
    where: { id: returnId },
    include: { items: true, sale: true },
  });
}

// ── Rechazar devolución ─────────────────────────────────────────────────────

export async function rejectReturn(
  organizationId: string,
  returnId: string
) {
  const ret = await prisma.saleReturn.findFirst({
    where: { id: returnId, organizationId },
  });
  if (!ret) throw new CrudError("Devolución no encontrada", 404);
  if (ret.status !== "pending") throw new CrudError("Solo se pueden rechazar devoluciones pendientes", 400);

  return prisma.saleReturn.update({
    where: { id: returnId },
    data: { status: "rejected" },
  });
}

// ── Consultas ───────────────────────────────────────────────────────────────

export async function getSaleReturns(organizationId: string, saleId: string) {
  return prisma.saleReturn.findMany({
    where: { saleId, organizationId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getReturnDetail(organizationId: string, returnId: string) {
  const ret = await prisma.saleReturn.findFirst({
    where: { id: returnId, organizationId },
    include: {
      items: true,
      sale: {
        include: { items: true, payments: true, customer: true },
      },
      employee: true,
      user: true,
    },
  });
  if (!ret) throw new CrudError("Devolución no encontrada", 404);
  return ret;
}

export async function listReturns(
  organizationId: string,
  filters: { from?: string; to?: string; status?: string; returnType?: string; locationId?: string; page?: number; pageSize?: number }
) {
  const where: Record<string, unknown> = { organizationId };
  if (filters.status) where.status = filters.status;
  if (filters.returnType) where.returnType = filters.returnType;
  if (filters.locationId) where.locationId = filters.locationId;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999`) } : {}),
    };
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, filters.pageSize ?? 20);

  const [rows, total] = await Promise.all([
    prisma.saleReturn.findMany({
      where,
      include: {
        items: true,
        sale: { select: { saleNumber: true, locationSaleNumber: true, total: true, customer: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.saleReturn.count({ where }),
  ]);

  return { rows, total, page, pageSize };
}
