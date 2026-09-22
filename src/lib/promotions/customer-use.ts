import type { Prisma } from "@prisma/client"

export function customerMayUsePromotion(limit: number | null, customerId: string | null | undefined, usesCount: number): boolean {
  return limit == null || (Boolean(customerId) && usesCount < limit)
}

/** Cuenta un uso dentro de la transacción; el llamador revierte si devuelve false. */
export async function reservePromotionCustomerUse(
  tx: Prisma.TransactionClient,
  organizationId: string,
  promotionId: string,
  customerId: string | null | undefined,
  limit: number | null,
): Promise<boolean> {
  if (!customerId) {
    return limit == null
  }
  const usage = await tx.promotionCustomerUse.upsert({
    where: { promotionId_customerId: { promotionId, customerId } },
    create: { promotionId, customerId, organizationId, usesCount: 1 },
    update: { usesCount: { increment: 1 } },
  })
  return limit == null || usage.usesCount <= limit
}
