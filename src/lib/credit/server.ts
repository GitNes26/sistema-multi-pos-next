import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// ── Credit Policy (per organization) ──────────────────────────────────────

export interface CreditPolicyInput {
  creditEnabled?: boolean;
  defaultLimit?: number | null;
  maxDaysToPay?: number;
  requireApproval?: boolean;
  allowPartialPayments?: boolean;
  interestRate?: number | null;
  notifyBeforeDays?: number;
}

const defaultPolicy = {
  creditEnabled: false,
  defaultLimit: null as number | null,
  maxDaysToPay: 30,
  requireApproval: true,
  allowPartialPayments: true,
  interestRate: null as number | null,
  notifyBeforeDays: 3,
};

export async function getCreditPolicy(organizationId: string) {
  const row = await prisma.creditPolicy.findUnique({ where: { organizationId } });
  if (!row) return defaultPolicy;
  return {
    creditEnabled: row.creditEnabled,
    defaultLimit: row.defaultLimit != null ? Number(row.defaultLimit) : null,
    maxDaysToPay: row.maxDaysToPay,
    requireApproval: row.requireApproval,
    allowPartialPayments: row.allowPartialPayments,
    interestRate: row.interestRate != null ? Number(row.interestRate) : null,
    notifyBeforeDays: row.notifyBeforeDays,
  };
}

export async function upsertCreditPolicy(organizationId: string, input: CreditPolicyInput) {
  const data: Prisma.CreditPolicyUncheckedCreateWithoutOrganizationInput = {
    creditEnabled: input.creditEnabled ?? false,
    defaultLimit: input.defaultLimit != null ? input.defaultLimit : null,
    maxDaysToPay: input.maxDaysToPay ?? 30,
    requireApproval: input.requireApproval ?? true,
    allowPartialPayments: input.allowPartialPayments ?? true,
    interestRate: input.interestRate != null ? input.interestRate : null,
    notifyBeforeDays: input.notifyBeforeDays ?? 3,
  };
  const row = await prisma.creditPolicy.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: data,
  });
  return getCreditPolicy(organizationId);
}

// ── Customer Credit Account ───────────────────────────────────────────────

export interface CustomerCreditInfo {
  id: string;
  customerId: string;
  creditLimit: number | null;
  currentBalance: number;
  status: string;
}

export async function getCustomerCredit(organizationId: string, customerId: string): Promise<CustomerCreditInfo | null> {
  const row = await prisma.customerCredit.findUnique({ where: { customerId } });
  if (!row || row.organizationId !== organizationId) return null;
  return {
    id: row.id,
    customerId: row.customerId,
    creditLimit: row.creditLimit != null ? Number(row.creditLimit) : null,
    currentBalance: Number(row.currentBalance),
    status: row.status,
  };
}

export async function ensureCustomerCredit(organizationId: string, customerId: string): Promise<CustomerCreditInfo> {
  const existing = await getCustomerCredit(organizationId, customerId);
  if (existing) return existing;

  const policy = await getCreditPolicy(organizationId);
  const row = await prisma.customerCredit.create({
    data: {
      customerId,
      organizationId,
      creditLimit: policy.defaultLimit,
      currentBalance: 0,
      status: "active",
    },
  });
  return {
    id: row.id,
    customerId: row.customerId,
    creditLimit: row.creditLimit != null ? Number(row.creditLimit) : null,
    currentBalance: 0,
    status: "active",
  };
}

export async function setCustomerCreditLimit(organizationId: string, customerId: string, limit: number | null) {
  await ensureCustomerCredit(organizationId, customerId);
  await prisma.customerCredit.update({
    where: { customerId },
    data: { creditLimit: limit },
  });
}

// ── Credit Transactions (charge / payment) ────────────────────────────────

export interface CreditTransactionRow {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

/**
 * Registra un cargo (venta a crédito) o un abono/pago.
 * - type: "charge" (deuda) | "payment" (abono) | "adjustment" | "writeoff"
 */
export async function createCreditTransaction(
  organizationId: string,
  customerId: string,
  type: "charge" | "payment" | "adjustment" | "writeoff",
  amount: number,
  opts?: {
    description?: string;
    referenceType?: string;
    referenceId?: string;
    dueDate?: Date;
  }
): Promise<{ ok: boolean; balance: number }> {
  const credit = await ensureCustomerCredit(organizationId, customerId);
  const policy = await getCreditPolicy(organizationId);

  const absAmount = Math.abs(amount);
  let newBalance: number;

  if (type === "charge") {
    newBalance = credit.currentBalance + absAmount;
    // Check limit
    if (credit.creditLimit != null && newBalance > credit.creditLimit) {
      throw new Error(
        `Límite de crédito excedido. Límite: $${credit.creditLimit}, actual: $${credit.currentBalance}, nuevo: $${newBalance}`
      );
    }
  } else if (type === "payment") {
    newBalance = Math.max(0, credit.currentBalance - absAmount);
  } else {
    // adjustment or writeoff
    newBalance = credit.currentBalance + (type === "writeoff" ? -absAmount : (amount >= 0 ? absAmount : -absAmount));
    newBalance = Math.max(0, newBalance);
  }

  const tx = await prisma.$transaction(async (tx) => {
    // Update balance
    await tx.customerCredit.update({
      where: { customerId },
      data: { currentBalance: newBalance, status: newBalance <= 0 ? "settled" : credit.status },
    });

    // Create transaction record
    const dueDate = type === "charge" && policy.maxDaysToPay
      ? new Date(Date.now() + policy.maxDaysToPay * 86400000)
      : opts?.dueDate ?? null;

    const ct = await tx.creditTransaction.create({
      data: {
        creditId: credit.id,
        customerId,
        organizationId,
        type,
        amount: absAmount,
        balanceAfter: newBalance,
        description: opts?.description ?? null,
        referenceType: opts?.referenceType ?? null,
        referenceId: opts?.referenceId ?? null,
        dueDate,
        paidAt: type === "payment" ? new Date() : null,
      },
    });

    return ct;
  });

  return { ok: true, balance: newBalance };
}

/**
 * Lista transacciones de crédito de un cliente.
 */
export async function listCreditTransactions(
  organizationId: string,
  customerId: string,
  opts?: { limit?: number; offset?: number }
): Promise<CreditTransactionRow[]> {
  const rows = await prisma.creditTransaction.findMany({
    where: { organizationId, customerId },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 50,
    skip: opts?.offset ?? 0,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    balanceAfter: Number(r.balanceAfter),
    description: r.description,
    referenceType: r.referenceType,
    referenceId: r.referenceId,
    dueDate: r.dueDate?.toISOString() ?? null,
    paidAt: r.paidAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Lista todas las cuentas con saldo de una organización.
 */
export async function listCustomerCredits(organizationId: string) {
  const rows = await prisma.customerCredit.findMany({
    where: { organizationId, currentBalance: { gt: 0 } },
    include: {
      customer: { select: { id: true, fullName: true, phone: true, customerCode: true } },
    },
    orderBy: { currentBalance: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    customerName: r.customer.fullName,
    customerPhone: r.customer.phone,
    customerCode: r.customer.customerCode,
    creditLimit: r.creditLimit != null ? Number(r.creditLimit) : null,
    currentBalance: Number(r.currentBalance),
    status: r.status,
  }));
}

/**
 * Verifica si un cliente puede hacer pedido a crédito.
 */
export async function canUseCredit(organizationId: string, customerId: string): Promise<{ allowed: boolean; reason?: string }> {
  const policy = await getCreditPolicy(organizationId);
  if (!policy.creditEnabled) return { allowed: false, reason: "El crédito no está habilitado para esta organización" };

  const credit = await getCustomerCredit(organizationId, customerId);
  if (!credit) return { allowed: true }; // Sin cuenta = nuevo cliente, se puede crear

  if (credit.status === "suspended") return { allowed: false, reason: "La cuenta de crédito está suspendida" };

  if (credit.status === "closed") return { allowed: false, reason: "La cuenta de crédito está cerrada" };

  if (credit.creditLimit != null && credit.currentBalance >= credit.creditLimit) {
    return { allowed: false, reason: `Límite de crédito alcanzado ($${credit.creditLimit})` };
  }

  return { allowed: true };
}
