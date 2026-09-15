import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"

// ── Credit Policy (per organization) ──────────────────────────────────────

export interface CreditPolicyInput {
  creditEnabled?: boolean
  defaultLimit?: number | null
  maxDaysToPay?: number
  requireApproval?: boolean
  allowPartialPayments?: boolean
  interestRate?: number | null
  notifyBeforeDays?: number
}

const defaultPolicy = {
  creditEnabled: false,
  defaultLimit: null as number | null,
  maxDaysToPay: 30,
  requireApproval: true,
  allowPartialPayments: true,
  interestRate: null as number | null,
  notifyBeforeDays: 3,
}

export async function getCreditPolicy(organizationId: string) {
  const row = await prisma.creditPolicy.findUnique({
    where: { organizationId },
  })
  if (!row) return defaultPolicy
  return {
    creditEnabled: row.creditEnabled,
    defaultLimit: row.defaultLimit != null ? Number(row.defaultLimit) : null,
    maxDaysToPay: row.maxDaysToPay,
    requireApproval: row.requireApproval,
    allowPartialPayments: row.allowPartialPayments,
    interestRate: row.interestRate != null ? Number(row.interestRate) : null,
    notifyBeforeDays: row.notifyBeforeDays,
  }
}

export async function upsertCreditPolicy(
  organizationId: string,
  input: CreditPolicyInput
) {
  const data: Prisma.CreditPolicyUncheckedCreateWithoutOrganizationInput = {
    creditEnabled: input.creditEnabled ?? false,
    defaultLimit: input.defaultLimit != null ? input.defaultLimit : null,
    maxDaysToPay: input.maxDaysToPay ?? 30,
    requireApproval: input.requireApproval ?? true,
    allowPartialPayments: input.allowPartialPayments ?? true,
    interestRate: input.interestRate != null ? input.interestRate : null,
    notifyBeforeDays: input.notifyBeforeDays ?? 3,
  }
  await prisma.creditPolicy.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: data,
  })
  return getCreditPolicy(organizationId)
}

// ── Customer Credit Account ───────────────────────────────────────────────

export interface CustomerCreditInfo {
  id: string
  customerId: string
  creditLimit: number | null
  customCreditLimit: number | null
  useDefaultLimit: boolean
  currentBalance: number
  status: string
}

export async function getCustomerCredit(
  organizationId: string,
  customerId: string
): Promise<CustomerCreditInfo | null> {
  const [row, policy] = await Promise.all([
    prisma.customerCredit.findUnique({ where: { customerId } }),
    getCreditPolicy(organizationId),
  ])
  if (!row || row.organizationId !== organizationId) return null
  return {
    id: row.id,
    customerId: row.customerId,
    creditLimit: row.useDefaultLimit
      ? policy.defaultLimit
      : row.creditLimit != null
        ? Number(row.creditLimit)
        : null,
    customCreditLimit: row.creditLimit != null ? Number(row.creditLimit) : null,
    useDefaultLimit: row.useDefaultLimit,
    currentBalance: Number(row.currentBalance),
    status: row.status,
  }
}

export async function ensureCustomerCredit(
  organizationId: string,
  customerId: string
): Promise<CustomerCreditInfo> {
  const existing = await getCustomerCredit(organizationId, customerId)
  if (existing) return existing

  const policy = await getCreditPolicy(organizationId)
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: { id: true },
  })
  if (!customer) throw new Error("Cliente no encontrado en esta empresa")
  const row = await prisma.customerCredit.create({
    data: {
      customerId,
      organizationId,
      creditLimit: null,
      useDefaultLimit: true,
      currentBalance: 0,
      status: "active",
    },
  })
  return {
    id: row.id,
    customerId: row.customerId,
    creditLimit: policy.defaultLimit,
    customCreditLimit: null,
    useDefaultLimit: true,
    currentBalance: 0,
    status: "active",
  }
}

export async function setCustomerCreditSettings(
  organizationId: string,
  customerId: string,
  input: {
    useDefaultLimit?: boolean
    creditLimit?: number | null
    status?: "active" | "suspended"
  }
) {
  await ensureCustomerCredit(organizationId, customerId)
  if (
    input.creditLimit != null &&
    (!Number.isFinite(input.creditLimit) || input.creditLimit < 0)
  )
    throw new Error("El límite debe ser mayor o igual a cero")
  await prisma.customerCredit.update({
    where: { customerId },
    data: {
      ...(input.useDefaultLimit !== undefined
        ? { useDefaultLimit: input.useDefaultLimit }
        : {}),
      ...(input.creditLimit !== undefined
        ? { creditLimit: input.creditLimit }
        : {}),
      ...(input.status ? { status: input.status } : {}),
    },
  })
}

export async function setCustomerCreditLimit(
  organizationId: string,
  customerId: string,
  limit: number | null
) {
  return setCustomerCreditSettings(organizationId, customerId, {
    useDefaultLimit: false,
    creditLimit: limit,
  })
}

// ── Credit Transactions (charge / payment) ────────────────────────────────

export interface CreditTransactionRow {
  id: string
  type: string
  amount: number
  balanceAfter: number
  description: string | null
  referenceType: string | null
  referenceId: string | null
  dueDate: string | null
  paidAt: string | null
  createdAt: string
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
    description?: string
    referenceType?: string
    referenceId?: string
    dueDate?: Date
  }
): Promise<{ ok: boolean; balance: number }> {
  const credit = await ensureCustomerCredit(organizationId, customerId)
  const policy = await getCreditPolicy(organizationId)

  const absAmount = Math.abs(amount)
  let newBalance: number

  if (type === "charge") {
    if (credit.status === "suspended" || credit.status === "closed")
      throw new Error("La cuenta de crédito está bloqueada")
    newBalance = credit.currentBalance + absAmount
    // Check limit
    if (credit.creditLimit != null && newBalance > credit.creditLimit) {
      throw new Error(
        `Límite de crédito excedido. Límite: $${credit.creditLimit}, actual: $${credit.currentBalance}, nuevo: $${newBalance}`
      )
    }
  } else if (type === "payment") {
    newBalance = Math.max(0, credit.currentBalance - absAmount)
  } else {
    // adjustment or writeoff
    newBalance =
      credit.currentBalance +
      (type === "writeoff" ? -absAmount : amount >= 0 ? absAmount : -absAmount)
    newBalance = Math.max(0, newBalance)
  }

  await prisma.$transaction(async (tx) => {
    // Update balance
    await tx.customerCredit.update({
      where: { customerId },
      data: {
        currentBalance: newBalance,
        status:
          newBalance <= 0
            ? "settled"
            : credit.status === "settled"
              ? "active"
              : credit.status,
      },
    })

    // Create transaction record
    const dueDate =
      type === "charge" && policy.maxDaysToPay
        ? new Date(Date.now() + policy.maxDaysToPay * 86400000)
        : (opts?.dueDate ?? null)

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
    })

    return ct
  })

  return { ok: true, balance: newBalance }
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
  })
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
  }))
}

/**
 * Lista todas las cuentas con saldo de una organización.
 */
export async function listCustomerCredits(organizationId: string) {
  const [customers, policy] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId, isActive: true },
      include: { creditAccount: true },
      orderBy: [
        { creditAccount: { currentBalance: "desc" } },
        { fullName: "asc" },
      ],
    }),
    getCreditPolicy(organizationId),
  ])
  return customers.map((customer) => {
    const account = customer.creditAccount
    const useDefaultLimit = account?.useDefaultLimit ?? true
    return {
      id: account?.id ?? `pending-${customer.id}`,
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      customerCode: customer.customerCode,
      creditLimit: useDefaultLimit
        ? policy.defaultLimit
        : account?.creditLimit != null
          ? Number(account.creditLimit)
          : null,
      customCreditLimit:
        account?.creditLimit != null ? Number(account.creditLimit) : null,
      useDefaultLimit,
      currentBalance: Number(account?.currentBalance ?? 0),
      status: account?.status ?? "active",
    }
  })
}

/**
 * Verifica si un cliente puede hacer pedido a crédito.
 */
export async function canUseCredit(
  organizationId: string,
  customerId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const policy = await getCreditPolicy(organizationId)
  if (!policy.creditEnabled)
    return {
      allowed: false,
      reason: "El crédito no está habilitado para esta organización",
    }

  const credit = await getCustomerCredit(organizationId, customerId)
  if (!credit) return { allowed: true } // Sin cuenta = nuevo cliente, se puede crear

  if (credit.status === "suspended")
    return { allowed: false, reason: "La cuenta de crédito está suspendida" }

  if (credit.status === "closed")
    return { allowed: false, reason: "La cuenta de crédito está cerrada" }

  if (
    credit.creditLimit != null &&
    credit.currentBalance >= credit.creditLimit
  ) {
    return {
      allowed: false,
      reason: `Límite de crédito alcanzado ($${credit.creditLimit})`,
    }
  }

  return { allowed: true }
}
