import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { getCustomerCredit, listCreditTransactions, canUseCredit } from "@/lib/credit/server";
import { createCreditCheckout } from "@/lib/payments/server";

async function getPortalSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const orgId = session.user.activeOrganizationId ?? session.user.organizationId;
  if (!orgId || session.user.scope !== "portal") return null;
  return { userId: session.user.id, organizationId: orgId };
}

// GET /api/portal/credit  → customer's credit info + transactions
export async function GET() {
  const portal = await getPortalSession();
  if (!portal) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const customer = await prisma.customer.findFirst({
      where: { organizationId: portal.organizationId, userId: portal.userId },
    });
    if (!customer) {
      return NextResponse.json({ ok: true, credit: null, transactions: [], canUse: { allowed: false, reason: "Cliente no encontrado" } });
    }

    const credit = await getCustomerCredit(portal.organizationId, customer.id);
    const canUse = await canUseCredit(portal.organizationId, customer.id);
    const transactions = await listCreditTransactions(portal.organizationId, customer.id, { limit: 100 });
    const recentPayments = await prisma.creditPaymentIntent.findMany({
      where: { organizationId: portal.organizationId, customerId: customer.id },
      select: { id: true, amount: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" }, take: 5,
    });

    return NextResponse.json({ ok: true, credit, transactions, canUse, recentPayments });
  } catch (err) {
    console.error("[portal/credit]", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}

// POST /api/portal/credit  → make a payment toward credit
export async function POST(req: Request) {
  const portal = await getPortalSession();
  if (!portal) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { amount } = body;

    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ ok: false, error: "Monto inválido" }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({
      where: { organizationId: portal.organizationId, userId: portal.userId },
    });
    if (!customer) {
      return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
    }

    const checkout = await createCreditCheckout(portal.organizationId, customer.id, amount);
    return NextResponse.json({ ok: true, url: checkout.url });
  } catch (err) {
    console.error("[portal/credit]", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
