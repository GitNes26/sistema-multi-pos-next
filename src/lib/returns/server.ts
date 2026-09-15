import type { $Enums } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CrudError } from "@/lib/crud/types";
import { persistNotification } from "@/lib/notifications/helpers";

// FASE — Sistema de devoluciones/cambios.

const num = (v: unknown) => (v == null ? 0 : Number(v));
const round2 = (value: number) => Math.round(value * 100) / 100;

export interface RefundPaymentInput {
  method: $Enums.PaymentMethod;
  amount: number;
  reference?: string;
}

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
  if (!["exchange", "refund", "coupon", "points"].includes(input.returnType)) {
    throw new CrudError("Tipo de devolución inválido", 400, "returnType");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new CrudError("Selecciona al menos un producto para devolver", 400, "items");
  }
  const seenItems = new Set<string>();
  for (const item of input.items) {
    if (!item?.saleItemId || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new CrudError("La cantidad a devolver debe ser mayor que cero", 400, "items");
    }
    if (Math.round(item.quantity * 1000) !== item.quantity * 1000) {
      throw new CrudError("La cantidad admite como máximo tres decimales", 400, "items");
    }
    if (seenItems.has(item.saleItemId)) {
      throw new CrudError("No repitas el mismo producto en la devolución", 400, "items");
    }
    seenItems.add(item.saleItemId);
  }
  const result = await prisma.$transaction(async (tx) => {
  // Bloquea la venta para que dos solicitudes simultáneas no calculen ambas
  // sobre la misma cantidad todavía disponible.
  const locked = await tx.sale.updateMany({
    where: { id: input.saleId, organizationId, status: "completed" },
    data: { status: "completed" },
  });
  if (locked.count !== 1) {
    const exists = await tx.sale.findFirst({ where: { id: input.saleId, organizationId }, select: { id: true } });
    if (!exists) throw new CrudError("Venta no encontrada", 404);
    throw new CrudError("Solo se pueden devolver ventas completadas", 400);
  }

  const sale = await tx.sale.findFirst({
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
  const existingReturns = await tx.saleReturn.findMany({
    where: { saleId: input.saleId, organizationId, status: { in: ["pending", "approved", "completed"] } },
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
  const ret = await tx.saleReturn.create({
    data: {
      organizationId,
      saleId: input.saleId,
      locationId: sale.locationId,
      cashSessionId: null,
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

  return {
    ret,
    saleNum: String(sale.locationSaleNumber ?? sale.saleNumber),
    customerName: sale.customer?.fullName ?? null,
  };
  });

  const { ret, saleNum, customerName } = result;
  // Notificar a la organización sobre la nueva devolución
  const typeName = { refund: "Reembolso", coupon: "Cupón", points: "Puntos", exchange: "Cambio" }[input.returnType];
  persistNotification({
    organizationId,
    locationId: ret.locationId,
    kind: "info",
    title: `Nueva devolución — Venta #${saleNum}`,
    body: `${typeName} por ${num(ret.total).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}${customerName ? ` · ${customerName}` : ""}`,
    severity: "warning",
    metadata: { returnType: input.returnType, saleNumber: saleNum, total: num(ret.total) },
  }).catch((err) => console.error("[returns] notification failed:", err));

  return ret;
}

// ── Aprobar devolución ──────────────────────────────────────────────────────

export async function approveReturn(
  organizationId: string,
  returnId: string
) {
  const updated = await prisma.saleReturn.updateMany({
    where: { id: returnId, organizationId, status: "pending" },
    data: { status: "approved" },
  });
  if (updated.count !== 1) {
    const exists = await prisma.saleReturn.findFirst({ where: { id: returnId, organizationId }, select: { id: true } });
    if (!exists) throw new CrudError("Devolución no encontrada", 404);
    throw new CrudError("Solo se pueden aprobar devoluciones pendientes", 409);
  }
  return prisma.saleReturn.findFirstOrThrow({ where: { id: returnId, organizationId } });
}

// ── Procesar/devolver ───────────────────────────────────────────────────────

export async function completeReturn(
  organizationId: string,
  returnId: string,
  userId: string,
  input: { refundPayments?: RefundPaymentInput[]; cashSessionId?: string } = {}
) {
  const employee = await prisma.employee.findFirst({ where: { userId }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.saleReturn.updateMany({
      where: { id: returnId, organizationId, status: "approved" },
      data: { status: "completed" },
    });
    if (claimed.count !== 1) {
      const exists = await tx.saleReturn.findFirst({ where: { id: returnId, organizationId }, select: { id: true } });
      if (!exists) throw new CrudError("Devolución no encontrada", 404);
      throw new CrudError("Solo se pueden procesar devoluciones aprobadas", 409);
    }

    const ret = await tx.saleReturn.findFirst({
      where: { id: returnId, organizationId },
      include: {
        items: true,
        sale: { include: { customer: true, payments: true } },
      },
    });
    if (!ret) throw new CrudError("Devolución no encontrada", 404);

    if (ret.returnType === "refund") {
      const requested = input.refundPayments;
      if (!Array.isArray(requested) || requested.length === 0) {
        throw new CrudError("Registra cómo se entregó el reembolso", 400, "refundPayments");
      }
      const allowed = new Set<$Enums.PaymentMethod>(["cash", "card", "wallet", "other"]);
      const allocations = new Map<$Enums.PaymentMethod, { amount: number; reference: string | null }>();
      for (const payment of requested) {
        const amount = round2(Number(payment?.amount));
        const reference = payment?.reference?.trim() || null;
        if (!allowed.has(payment?.method) || !Number.isFinite(amount) || amount <= 0) {
          throw new CrudError("Medio o importe de reembolso inválido", 400, "refundPayments");
        }
        if (payment.method !== "cash" && !reference) {
          throw new CrudError("Agrega la referencia o comprobante del reembolso", 400, "refundPayments");
        }
        const previous = allocations.get(payment.method);
        allocations.set(payment.method, {
          amount: round2((previous?.amount ?? 0) + amount),
          reference: reference ?? previous?.reference ?? null,
        });
      }
      const allocatedTotal = round2([...allocations.values()].reduce((sum, payment) => sum + payment.amount, 0));
      if (Math.abs(allocatedTotal - num(ret.total)) > 0.009) {
        throw new CrudError("La suma de los reembolsos debe coincidir con el total de la devolución", 400, "refundPayments");
      }

      const available = new Map<$Enums.PaymentMethod, number>();
      for (const payment of ret.sale.payments) {
        const netAmount = payment.method === "cash"
          ? Math.max(0, num(payment.amount) - num(ret.sale.changeGiven))
          : num(payment.amount);
        available.set(payment.method, round2((available.get(payment.method) ?? 0) + netAmount));
      }
      const priorRefunds = await tx.saleReturnPayment.findMany({
        where: {
          returnId: { not: returnId },
          return: { organizationId, saleId: ret.saleId, status: "completed" },
        },
        select: { method: true, amount: true },
      });
      for (const payment of priorRefunds) {
        available.set(payment.method, round2((available.get(payment.method) ?? 0) - num(payment.amount)));
      }
      for (const [method, payment] of allocations) {
        if (payment.amount - (available.get(method) ?? 0) > 0.009) {
          throw new CrudError(`El reembolso por ${method} excede lo pagado con ese medio`, 400, "refundPayments");
        }
      }
      if ((allocations.get("cash")?.amount ?? 0) > 0) {
        if (!input.cashSessionId) {
          throw new CrudError("Selecciona la caja abierta que entregará el efectivo", 400, "cashSessionId");
        }
        const cashSession = await tx.cashSession.findFirst({
          where: {
            id: input.cashSessionId,
            organizationId,
            locationId: ret.locationId,
            status: "open",
          },
          select: { id: true },
        });
        if (!cashSession) {
          throw new CrudError("La caja seleccionada no está abierta en la sucursal de la venta", 409, "cashSessionId");
        }
        await tx.saleReturn.update({ where: { id: returnId }, data: { cashSessionId: cashSession.id } });
      }
      await tx.saleReturnPayment.createMany({
        data: [...allocations].map(([method, payment]) => ({
          returnId,
          method,
          amount: payment.amount,
          reference: payment.reference,
        })),
      });
    } else if (input.refundPayments?.length) {
      throw new CrudError("Esta resolución no utiliza movimientos de reembolso", 400, "refundPayments");
    }

    for (const item of ret.items) {
      if (!item.restockable) continue;
      const inv = await tx.inventory.findFirst({
        where: {
          organizationId,
          locationId: ret.locationId,
          locationType: "location",
          ...(item.variantId
            ? { variantId: item.variantId }
            : { productId: item.productId, variantId: null }),
        },
      });
      if (!inv) {
        throw new CrudError(`No existe inventario para "${item.productName}" en la sucursal de la venta`, 409);
      }
      await tx.inventory.update({
        where: { id: inv.id },
        data: { quantity: { increment: item.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          organizationId,
          productId: item.productId,
          variantId: item.variantId,
          locationId: ret.locationId,
          locationType: "location",
          type: "return",
          quantity: item.quantity,
          unitId: inv.unitId,
          reason: `Devolución #${returnId.slice(-8)}: ${item.reason ?? ret.reason ?? "Sin motivo"}`,
          referenceId: returnId,
          employeeId: employee?.id ?? null,
          userId,
        },
      });
    }

    switch (ret.returnType) {
    case "refund": {
      // Reversar puntos ganados en esta venta (proporcional)
      if (ret.sale.customer && num(ret.sale.pointsEarned) > 0) {
        const returnRatio = num(ret.total) / num(ret.sale.total);
        const pointsToReverse = Math.round(num(ret.sale.pointsEarned) * returnRatio);
        if (pointsToReverse > 0) {
          const customer = await tx.customer.findFirst({
            where: { id: ret.sale.customerId!, organizationId },
          });
          if (customer) {
            const reversed = Math.min(num(customer.points), pointsToReverse);
            await tx.customer.update({ where: { id: customer.id }, data: { points: { decrement: reversed } } });
            await tx.loyaltyTransaction.create({
              data: {
                organizationId,
                customerId: customer.id,
                saleId: ret.saleId,
                kind: "adjust",
                points: -reversed,
                note: `Reversa por devolución #${returnId.slice(-8)}`,
              },
            });
          }
        }
      }
      break;
    }
    case "coupon": {
      const code = generateCouponCode();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 3); // Vence en 3 meses
      await tx.coupon.create({
        data: { organizationId, customerId: ret.sale.customerId, code, amount: ret.total, expiresAt },
      });
      await tx.saleReturn.update({
        where: { id: returnId },
        data: { couponCode: code, couponAmount: ret.total, couponExpiresAt: expiresAt },
      });
      break;
    }
    case "points": {
      // Bonificar el monto como puntos
      const org = await tx.organization.findUnique({
        where: { id: ret.organizationId },
        select: { pointsPerCurrency: true, loyaltyEnabled: true },
      });
      if (org?.loyaltyEnabled && ret.sale.customerId) {
        const pointsToAward = Math.round(num(ret.total) * num(org.pointsPerCurrency));
        if (pointsToAward > 0) {
          const customer = await tx.customer.findFirst({
            where: { id: ret.sale.customerId, organizationId },
          });
          if (customer) {
            await tx.customer.update({ where: { id: customer.id }, data: { points: { increment: pointsToAward } } });
            await tx.loyaltyTransaction.create({
              data: {
                organizationId,
                customerId: customer.id,
                saleId: ret.saleId,
                kind: "earn",
                points: pointsToAward,
                note: `Bonificación por devolución #${returnId.slice(-8)}`,
              },
            });
            await tx.saleReturn.update({ where: { id: returnId }, data: { pointsAwarded: pointsToAward } });
          }
        }
      }
      break;
    }
    case "exchange": {
      // Producto devuelto al stock (ya se hizo arriba). El empleado crea una nueva venta aparte.
      break;
    }
    }
  });

  return prisma.saleReturn.findFirst({
    where: { id: returnId, organizationId },
    include: { items: true, refundPayments: true, sale: true },
  });
}

// ── Rechazar devolución ─────────────────────────────────────────────────────

export async function rejectReturn(
  organizationId: string,
  returnId: string
) {
  const updated = await prisma.saleReturn.updateMany({
    where: { id: returnId, organizationId, status: "pending" },
    data: { status: "rejected" },
  });
  if (updated.count !== 1) {
    const exists = await prisma.saleReturn.findFirst({ where: { id: returnId, organizationId }, select: { id: true } });
    if (!exists) throw new CrudError("Devolución no encontrada", 404);
    throw new CrudError("Solo se pueden rechazar devoluciones pendientes", 409);
  }
  return prisma.saleReturn.findFirstOrThrow({ where: { id: returnId, organizationId } });
}

// ── Consultas ───────────────────────────────────────────────────────────────

export async function getSaleReturns(organizationId: string, saleId: string) {
  return prisma.saleReturn.findMany({
    where: { saleId, organizationId },
    include: { items: true, refundPayments: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getReturnDetail(organizationId: string, returnId: string) {
  const ret = await prisma.saleReturn.findFirst({
    where: { id: returnId, organizationId },
    include: {
      items: true,
      refundPayments: true,
      sale: {
        include: {
          items: true,
          payments: true,
          customer: true,
          returns: {
            where: { status: "completed", returnType: "refund" },
            select: { refundPayments: { select: { method: true, amount: true } } },
          },
        },
      },
      employee: true,
      user: true,
    },
  });
  if (!ret) throw new CrudError("Devolución no encontrada", 404);
  const available = new Map<$Enums.PaymentMethod, number>();
  for (const payment of ret.sale.payments) {
    const amount = payment.method === "cash"
      ? Math.max(0, num(payment.amount) - num(ret.sale.changeGiven))
      : num(payment.amount);
    available.set(payment.method, round2((available.get(payment.method) ?? 0) + amount));
  }
  for (const previousReturn of ret.sale.returns) {
    for (const payment of previousReturn.refundPayments) {
      available.set(payment.method, round2((available.get(payment.method) ?? 0) - num(payment.amount)));
    }
  }
  return {
    ...ret,
    refundAvailability: [...available]
      .filter(([method, amount]) => ["cash", "card", "wallet", "other"].includes(method) && amount > 0)
      .map(([method, amount]) => ({ method, amount })),
    openCashSessions: await prisma.cashSession.findMany({
      where: { organizationId, locationId: ret.locationId, status: "open" },
      select: {
        id: true,
        cashRegister: { select: { name: true } },
        openedByUser: { select: { fullName: true } },
      },
      orderBy: { openedAt: "asc" },
    }).then((sessions) => sessions.map((session) => ({
      id: session.id,
      label: `${session.cashRegister.name}${session.openedByUser?.fullName ? ` · ${session.openedByUser.fullName}` : ""}`,
    }))),
  };
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
        refundPayments: true,
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
