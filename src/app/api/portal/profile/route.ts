import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// GET /api/portal/profile — Get customer profile
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.scope !== "portal") {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

  const customer = await prisma.customer.findFirst({
    where: { userId: session.user.id, organizationId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      points: true,
      imageUrl: true,
      address: true,
      latitude: true,
      longitude: true,
    },
  });
  if (!customer) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }

  // Prisma Decimal fields arrive as objects — convert to plain numbers.
  const safe = {
    ...customer,
    points: customer.points != null ? Number(customer.points) : 0,
    latitude: customer.latitude != null ? Number(customer.latitude) : null,
    longitude: customer.longitude != null ? Number(customer.longitude) : null,
  };

  return NextResponse.json({ ok: true, customer: safe });
}

// PATCH /api/portal/profile — Update customer profile
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.scope !== "portal") {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

  const customer = await prisma.customer.findFirst({
    where: { userId: session.user.id, organizationId },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const { fullName, phone, email, address, latitude, longitude } = body;

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      ...(fullName !== undefined ? { fullName } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(email !== undefined ? { email: email || null } : {}),
      ...(address !== undefined ? { address: address || null } : {}),
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
    },
  });

  const updated = await prisma.customer.findUnique({
    where: { id: customer.id },
    select: {
      id: true, fullName: true, phone: true, email: true,
      points: true, imageUrl: true, address: true, latitude: true, longitude: true,
    },
  });

  const safeUpdated = updated ? {
    ...updated,
    points: updated.points != null ? Number(updated.points) : 0,
    latitude: updated.latitude != null ? Number(updated.latitude) : null,
    longitude: updated.longitude != null ? Number(updated.longitude) : null,
  } : updated;

  return NextResponse.json({ ok: true, customer: safeUpdated });
}

// DELETE /api/portal/profile — Self-delete customer account
// Validation rules:
// 1. No pending credit balance (currentBalance > 0)
// 2. No active orders (status not in [delivered, cancelled])
// 3. No pending returns
// 4. No active table sessions
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.scope !== "portal") {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

  const customer = await prisma.customer.findFirst({
    where: { userId: session.user.id, organizationId },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }

  // Check: no pending credit balance
  const credit = await prisma.customerCredit.findFirst({
    where: { customerId: customer.id },
    select: { currentBalance: true },
  });
  if (credit && Number(credit.currentBalance) > 0) {
    return NextResponse.json({
      ok: false,
      error: "No puedes eliminar tu cuenta: tienes saldo de crédito pendiente. Salda tu deuda primero.",
    }, { status: 400 });
  }

  // Check: no active orders (pending, confirmed, preparing, ready, in_transit, at_destination)
  const activeOrders = await prisma.order.count({
    where: {
      customerId: customer.id,
      organizationId,
      status: { notIn: ["delivered", "cancelled"] },
    },
  });
  if (activeOrders > 0) {
    return NextResponse.json({
      ok: false,
      error: "No puedes eliminar tu cuenta: tienes pedidos activos. Espera a que se completen o cancúchalos.",
    }, { status: 400 });
  }

  // Check: no pending returns
  const pendingReturns = await prisma.saleReturn.count({
    where: {
      sale: { customerId: customer.id, organizationId },
      status: "pending",
    },
  });
  if (pendingReturns > 0) {
    return NextResponse.json({
      ok: false,
      error: "No puedes eliminar tu cuenta: tienes devoluciones pendientes.",
    }, { status: 400 });
  }

  // Perform deletion in transaction
  await prisma.$transaction(async (tx) => {
    // Delete related data
    await tx.customerAddress.deleteMany({ where: { customerId: customer.id } });
    await tx.customerFavorite.deleteMany({ where: { customerId: customer.id } });
    await tx.shoppingList.deleteMany({ where: { customerId: customer.id } });
    await tx.customerPaymentMethod.deleteMany({ where: { customerId: customer.id } });
    await tx.customerSegment.deleteMany({ where: { customerId: customer.id } });
    await tx.loyaltyTransaction.deleteMany({ where: { customerId: customer.id } });
    await tx.creditTransaction.deleteMany({ where: { customerId: customer.id } });
    await tx.customerCredit.deleteMany({ where: { customerId: customer.id } });
    await tx.coupon.deleteMany({ where: { customerId: customer.id } });

    // Nullify orders (keep for history but unlink customer)
    await tx.order.updateMany({
      where: { customerId: customer.id },
      data: { customerId: null },
    });

    // Delete customer record
    await tx.customer.delete({ where: { id: customer.id } });

    // Deactivate the user account (don't delete — keeps auth records clean)
    await tx.user.update({
      where: { id: session!.user.id },
      data: { isActive: false },
    });

    // Delete memberships
    await tx.membership.deleteMany({
      where: { userId: session!.user.id, organizationId },
    });
  });

  return NextResponse.json({ ok: true });
}
