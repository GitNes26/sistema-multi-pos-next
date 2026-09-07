import { NextResponse } from "next/server";
import { $Enums } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  assertPermission,
  PermissionDeniedError,
} from "@/lib/auth/server-permissions";
import { effectiveOrgId } from "@/lib/auth/org-context";
import {
  sendTicketToKitchen,
  cancelKitchenOrder,
  KitchenError,
} from "@/lib/pos/kitchen";
import type { KitchenLineInput } from "@/lib/pos/kitchen";
import { requirePosSession, resolveLocationId, getCashierContext } from "../helpers";

export const dynamic = "force-dynamic";

/** Estados de una orden de cocina abierta (espejo de lib/pos/kitchen). */
const OPEN_KITCHEN_STATUSES: $Enums.OrderStatus[] = ["pending", "confirmed", "preparing"];

/**
 * GET /api/pos/kitchen?tableId=xxx — Orden de cocina abierta de la mesa
 * (número, estado y artículos) para la sección "Cocina" del ticket del POS:
 * el mesero consulta en qué punto está su envío sin abrir el KDS. Solo
 * lectura: no exige orders.manage (cualquier operador del POS la consulta).
 */
export async function GET(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  const organizationId = effectiveOrgId(guard.session)!;

  const tableId = new URL(req.url).searchParams.get("tableId");
  if (!tableId) {
    return NextResponse.json({ ok: false, error: "Falta tableId" }, { status: 400 });
  }

  try {
    const order = await prisma.order.findFirst({
      where: {
        organizationId,
        tableId,
        deliveryMethod: "pickup",
        status: { in: OPEN_KITCHEN_STATUSES },
        saleId: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        items: {
          select: { id: true, productName: true, variantName: true, quantity: true, itemStatus: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!order) return NextResponse.json({ ok: true, order: null });
    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        orderNumber: Number(order.orderNumber),
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((i) => ({
          id: i.id,
          productName: i.productName,
          variantName: i.variantName,
          quantity: Number(i.quantity),
          itemStatus: i.itemStatus,
        })),
      },
    });
  } catch (err) {
    console.error("[pos/kitchen] GET", err);
    return NextResponse.json({ ok: false, error: "Error al consultar la orden" }, { status: 500 });
  }
}

/**
 * DELETE /api/pos/kitchen?orderId=xxx — Cancela la orden de cocina abierta de
 * una mesa sin cobrarla (pull-back del KDS cuando la mesa quedó libre sin
 * pasar por caja). Exige orders.manage, igual que el envío a cocina.
 */
export async function DELETE(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const organizationId = effectiveOrgId(session)!;

  try {
    assertPermission(session, "orders.manage");
    const orderId = new URL(req.url).searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "Falta orderId" }, { status: 400 });
    }
    const { employeeId } = await getCashierContext(session.user.id, organizationId);
    const result = await cancelKitchenOrder(organizationId, orderId, {
      userId: session.user.id,
      employeeId,
    });
    if (!result) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof KitchenError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    if (err instanceof PermissionDeniedError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    console.error("[pos/kitchen] DELETE", err);
    return NextResponse.json({ ok: false, error: "Error al cancelar la orden" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const organizationId = effectiveOrgId(session)!;

  // Operar pedidos (enviar a cocina) exige orders.manage: meseros, cajeros,
  // gerentes y owners lo tienen; roles sin él (cocina, repartidor) no.
  try {
    assertPermission(session, "orders.manage");
    const body = (await req.json()) as {
      tableId?: string;
      locationId?: string;
      customerId?: string | null;
      items?: KitchenLineInput[];
    };
    if (!body.tableId || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos: mesa y artículos a enviar" },
        { status: 400 }
      );
    }
    const locationId = await resolveLocationId(organizationId, body.locationId);
    const { employeeId } = await getCashierContext(session.user.id, organizationId);

    const result = await sendTicketToKitchen(
      organizationId,
      locationId,
      {
        tableId: body.tableId,
        customerId: body.customerId ?? null,
        items: body.items,
      },
      { userId: session.user.id, employeeId }
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof KitchenError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    if (err instanceof PermissionDeniedError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    console.error("[pos/kitchen]", err);
    return NextResponse.json({ ok: false, error: "Error al enviar a cocina" }, { status: 500 });
  }
}
