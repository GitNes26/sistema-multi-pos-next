import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId, isSuperadminSession } from "@/lib/auth/org-context";
import { ordersGuard, ordersErrorResponse } from "../orders/guard";
import {
  getCustomerCredit,
  ensureCustomerCredit,
  setCustomerCreditLimit,
  createCreditTransaction,
  listCreditTransactions,
  listCustomerCredits,
  canUseCredit,
} from "@/lib/credit/server";
import { prisma } from "@/lib/db";

// GET /api/customer-credit?customerId=xxx  → credit info + transactions
// GET /api/customer-credit                  → all customers with credit balance
// GET /api/customer-credit?allOrgs=true     → superadmin: all orgs
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const isSuper = isSuperadminSession(session);
  const organizationId = effectiveOrgId(session);
  if (!organizationId && !isSuper) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get("customerId");
    const allOrgs = url.searchParams.get("allOrgs") === "true" && isSuper;

    if (customerId && organizationId) {
      const credit = await getCustomerCredit(organizationId, customerId);
      const canUse = await canUseCredit(organizationId, customerId);
      const transactions = await listCreditTransactions(organizationId, customerId);
      return NextResponse.json({ ok: true, credit, canUse, transactions });
    }

    if (allOrgs) {
      // Superadmin: list all credits across all orgs
      const rows = await prisma.customerCredit.findMany({
        where: { currentBalance: { gt: 0 } },
        include: {
          customer: { select: { id: true, fullName: true, phone: true, customerCode: true } },
          organization: { select: { id: true, name: true } },
        },
        orderBy: { currentBalance: "desc" },
      });
      const credits = rows.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        customerName: r.customer.fullName,
        customerPhone: r.customer.phone,
        customerCode: r.customer.customerCode,
        organizationId: r.organizationId,
        organizationName: r.organization.name,
        creditLimit: r.creditLimit != null ? Number(r.creditLimit) : null,
        currentBalance: Number(r.currentBalance),
        status: r.status,
      }));
      return NextResponse.json({ ok: true, credits, isSuperadmin: true });
    }

    if (organizationId) {
      const credits = await listCustomerCredits(organizationId);
      return NextResponse.json({ ok: true, credits });
    }

    return NextResponse.json({ ok: true, credits: [] });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}

// POST /api/customer-credit  → charge, pay, adjust, or writeoff
export async function POST(req: Request) {
  const guard = await ordersGuard("orders.manage");
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json();
    const { customerId, type, amount, description, referenceType, referenceId } = body;

    if (!customerId || !type || amount == null) {
      return NextResponse.json(
        { ok: false, error: "customerId, type y amount son requeridos" },
        { status: 400 }
      );
    }

    const result = await createCreditTransaction(
      guard.organizationId,
      customerId,
      type,
      Number(amount),
      { description, referenceType, referenceId }
    );

    return NextResponse.json({ ok: true, balance: result.balance });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}

// PATCH /api/customer-credit  → update credit limit
export async function PATCH(req: Request) {
  const guard = await ordersGuard("settings.manage");
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json();
    const { customerId, creditLimit } = body;

    if (!customerId) {
      return NextResponse.json({ ok: false, error: "customerId requerido" }, { status: 400 });
    }

    await setCustomerCreditLimit(
      guard.organizationId,
      customerId,
      creditLimit != null ? Number(creditLimit) : null
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}
