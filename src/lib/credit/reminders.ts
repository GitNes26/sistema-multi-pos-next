import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/notifications/push";
import { persistNotification } from "@/lib/notifications/helpers";

/**
 * Revisa créditos próximos a vencer y envía recordatorios.
 * Ideal ejecutar via cron job cada día.
 *
 * Flujo:
 * 1. Busca créditos con deuda > 0 cuyo `dueDate` esté dentro de `notifyBeforeDays`
 * 2. Envía push notification al cliente
 * 3. Crea notificación en la DB (para el portal)
 */
export async function checkCreditExpirationReminders(): Promise<{ notified: number; errors: number }> {
  let notified = 0;
  let errors = 0;

  // Buscar todas las políticas de crédito habilitadas
  const policies = await prisma.creditPolicy.findMany({
    where: { creditEnabled: true },
    select: { organizationId: true, notifyBeforeDays: true },
  });

  for (const policy of policies) {
    const now = new Date();
    const notifyDate = new Date(now.getTime() + policy.notifyBeforeDays * 86400000);

    // Buscar transacciones de cargo (charge) con deuda pendiente y fecha de vencimiento próxima
    const dueTransactions = await prisma.creditTransaction.findMany({
      where: {
        organizationId: policy.organizationId,
        type: "charge",
        paidAt: null,
        dueDate: {
          not: null,
          lte: notifyDate,
          gte: now, // No vencidos ya
        },
      },
      include: {
        credit: {
          include: {
            customer: {
              select: {
                id: true,
                userId: true,
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Agrupar por cliente para evitar notificar múltiples veces al mismo
    const byCustomer = new Map<string, { customer: typeof dueTransactions[0]["credit"]["customer"]; transactions: typeof dueTransactions }>();

    for (const tx of dueTransactions) {
      const customerId = tx.customerId;
      if (!byCustomer.has(customerId)) {
        byCustomer.set(customerId, {
          customer: tx.credit.customer,
          transactions: [],
        });
      }
      byCustomer.get(customerId)!.transactions.push(tx);
    }

    for (const [, { customer, transactions }] of byCustomer) {
      const totalOwed = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const earliestDue = transactions.reduce(
        (min, tx) => (tx.dueDate && tx.dueDate < min ? tx.dueDate : min),
        transactions[0].dueDate!
      );

      const daysUntilDue = Math.ceil((earliestDue.getTime() - now.getTime()) / 86400000);

      try {
        // Push notification
        await sendPushToUser(customer.userId, {
          title: "⏰ Recordatorio de crédito",
          body: `Tienes $${totalOwed.toFixed(2)} pendientes${daysUntilDue <= 0 ? " (vencido)" : ` — vence en ${daysUntilDue} día${daysUntilDue === 1 ? "" : "s"}`}.`,
          url: "/portal/credit",
          tag: `credit-reminder-${customer.id}`,
          sound: "notification",
        });

        // Notificación en DB (para el portal)
        await persistNotification({
          organizationId: policy.organizationId,
          userId: customer.userId,
          kind: "credit_reminder",
          title: "Recordatorio de crédito",
          body: `Tienes $${totalOwed.toFixed(2)} pendientes${daysUntilDue <= 0 ? " (vencido)" : ` — vence en ${daysUntilDue} día${daysUntilDue === 1 ? "" : "s"}`}. Realiza tu abono pronto.`,
          severity: daysUntilDue <= 1 ? "warning" : "info",
          link: "/portal/credit",
          metadata: {
            totalOwed,
            daysUntilDue,
            transactionCount: transactions.length,
            sound: "notification",
          },
        });

        notified++;
      } catch (err) {
        console.error(`[credit-reminder] Error notifying customer ${customer.id}:`, err);
        errors++;
      }
    }
  }

  console.log(`[credit-reminders] Notificados: ${notified}, Errores: ${errors}`);
  return { notified, errors };
}

/**
 * Revisa créditos YA vencidos (pasó la fecha) y envía alertas urgentes.
 */
export async function checkOverdueCredits(): Promise<{ alerted: number; errors: number }> {
  let alerted = 0;
  let errors = 0;

  const now = new Date();

  // Buscar transacciones vencidas sin pagar
  const overdueTransactions = await prisma.creditTransaction.findMany({
    where: {
      type: "charge",
      paidAt: null,
      dueDate: {
        not: null,
        lt: now,
      },
    },
    include: {
      credit: {
        include: {
          customer: {
            select: {
              id: true,
              userId: true,
              fullName: true,
            },
          },
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // Agrupar por cliente
  const byCustomer = new Map<string, { customer: typeof overdueTransactions[0]["credit"]["customer"]; orgId: string; transactions: typeof overdueTransactions }>();

  for (const tx of overdueTransactions) {
    const customerId = tx.customerId;
    if (!byCustomer.has(customerId)) {
      byCustomer.set(customerId, {
        customer: tx.credit.customer,
        orgId: tx.organizationId,
        transactions: [],
      });
    }
    byCustomer.get(customerId)!.transactions.push(tx);
  }

  for (const [, { customer, orgId, transactions }] of byCustomer) {
    const totalOwed = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const earliestDue = transactions.reduce(
      (min, tx) => (tx.dueDate && tx.dueDate < min ? tx.dueDate : min),
      transactions[0].dueDate!
    );
    const daysOverdue = Math.ceil((now.getTime() - earliestDue.getTime()) / 86400000);

    try {
      await sendPushToUser(customer.userId, {
        title: "🚨 Crédito vencido",
        body: `Tienes $${totalOwed.toFixed(2)} vencidos hace ${daysOverdue} día${daysOverdue === 1 ? "" : "s"}. Acude a liquidar tu deuda.`,
        url: "/portal/credit",
        tag: `credit-overdue-${customer.id}`,
        sound: "error",
      });

      await persistNotification({
        organizationId: orgId,
        userId: customer.userId,
        kind: "credit_overdue",
        title: "Crédito vencido",
        body: `Tu crédito de $${totalOwed.toFixed(2)} venció hace ${daysOverdue} día${daysOverdue === 1 ? "" : "s"}. Por favor liquidalo lo antes posible.`,
        severity: "error",
        link: "/portal/credit",
        metadata: {
          totalOwed,
          daysOverdue,
          transactionCount: transactions.length,
          sound: "error",
        },
      });

      alerted++;
    } catch (err) {
      console.error(`[credit-overdue] Error alerting customer ${customer.id}:`, err);
      errors++;
    }
  }

  console.log(`[credit-overdue] Alertados: ${alerted}, Errores: ${errors}`);
  return { alerted, errors };
}
