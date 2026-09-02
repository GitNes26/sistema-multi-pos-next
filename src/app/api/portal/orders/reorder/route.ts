import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// POST /api/portal/orders/reorder — Copy items from a past order into the portal cart.
// Body: { orderId: string }
// Returns: { ok: true, items: CartItem[] } where each item is ready to add to the portal store.

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.scope !== "portal") {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { orderId } = body as { orderId?: string };
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "orderId requerido" }, { status: 400 });
    }

    // Find the customer record for this user.
    const customer = await prisma.customer.findFirst({
      where: { userId: session.user.id, organizationId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
    }

    // Verify the order belongs to this customer.
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId: customer.id, organizationId },
      include: {
        items: {
          select: {
            variantId: true,
            productId: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            comment: true,
            selectedOptions: true,
            bulkQuantityDisplay: true,
            extraPrice: true,
          },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
    }

    if (order.status === "cancelled") {
      return NextResponse.json({ ok: false, error: "No puedes reordenar un pedido cancelado" }, { status: 400 });
    }

    // Build cart items from the order.
    // Each item is returned so the client can add them to the portal store.
    const cartItems = order.items.map((item) => ({
      variantId: item.variantId,
      productId: item.productId,
      name: item.productName,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      comment: item.comment ?? undefined,
      selectedOptions: (item.selectedOptions as Record<string, unknown>[]) ?? undefined,
      bulkQuantityDisplay: item.bulkQuantityDisplay ?? undefined,
      extraPrice: Number(item.extraPrice) || 0,
    }));

    return NextResponse.json({
      ok: true,
      items: cartItems,
      locationId: order.locationId,
      deliveryMethod: order.deliveryMethod,
    });
  } catch (error) {
    console.error("[portal/reorder] Error:", error);
    return NextResponse.json({ ok: false, error: "Error al procesar reorden" }, { status: 500 });
  }
}
