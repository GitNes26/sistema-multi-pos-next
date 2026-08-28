import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: {
        organizationId: guard.organizationId,
        isActive: true,
        couponCode: null, // Solo promos automáticas (no cupones)
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: { priority: "asc" },
      take: 20,
      include: {
        targets: { select: { kind: true, targetId: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      promotions: promotions.map((p) => ({
        id: p.id,
        name: p.name,
        benefit: p.benefit,
        scope: p.scope,
        value: Number(p.value),
        buyQuantity: p.buyQuantity,
        getQuantity: p.getQuantity,
        minAmount: Number(p.minAmount),
        minQuantity: Number(p.minQuantity),
        couponCode: p.couponCode,
        requiresCustomer: p.requiresCustomer,
        priority: p.priority,
        exclusive: p.exclusive,
        maxUses: p.maxUses,
        usesCount: p.usesCount,
        startsAt: p.startsAt?.toISOString() ?? null,
        endsAt: p.endsAt?.toISOString() ?? null,
        weekdays: p.weekdays,
        startTime: p.startTime,
        endTime: p.endTime,
        targets: p.targets.map((t) => ({ kind: t.kind, targetId: t.targetId })),
      })),
    });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
