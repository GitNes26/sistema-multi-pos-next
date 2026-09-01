import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/db";
import { persistNotification } from "@/lib/notifications/helpers";

// POST /api/credit/reminder — Send reminder notifications for overdue credit balances
// Can be called manually or by a cron job (e.g. weekly)

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

  try {
    const now = new Date();

    // Find credits with overdue transactions (dueDate < now and not fully paid)
    const overdueCredits = await prisma.customerCredit.findMany({
      where: {
        organizationId,
        currentBalance: { gt: 0 },
      },
      include: {
        customer: { select: { id: true, userId: true, fullName: true } },
        transactions: {
          where: {
            type: "charge",
            dueDate: { lt: now },
            paidAt: null,
          },
          select: { amount: true, dueDate: true },
        },
      },
    });

    let sentCount = 0;

    for (const credit of overdueCredits) {
      if (credit.transactions.length === 0) continue;

      const oldestDue = credit.transactions
        .map((t) => t.dueDate!)
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime())[0];

      if (!oldestDue) continue;

      const daysOverdue = Math.ceil((now.getTime() - oldestDue.getTime()) / 86400000);
      const balance = Number(credit.currentBalance);

      // Send notification to the customer (portal user)
      if (credit.customer.userId) {
        await persistNotification({
          organizationId,
          userId: credit.customer.userId,
          kind: "credit_reminder",
          title: "Recordatorio de crédito pendiente",
          body: `Tienes un saldo pendiente de $${balance.toFixed(2)} (${daysOverdue} días de vencimiento). Por favor, realiza tu pago lo antes posible.`,
          severity: "warning",
          link: "/portal/credit",
          metadata: {
            creditId: credit.id,
            balance,
            daysOverdue,
            customerName: credit.customer.fullName,
          },
        });
        sentCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Se enviaron ${sentCount} recordatorios`,
      creditsFound: overdueCredits.length,
      sent: sentCount,
    });
  } catch (err) {
    console.error("[credit/reminder]", err);
    return NextResponse.json(
      { ok: false, error: "Error al enviar recordatorios" },
      { status: 500 }
    );
  }
}
