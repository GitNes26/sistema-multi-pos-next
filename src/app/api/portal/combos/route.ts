import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePortalCustomer, portalErrorResponse } from "../guard";
import type { PortalCombo } from "@/lib/portal/server";

// GET /api/portal/combos — List active combos for the portal

export const dynamic = "force-dynamic";

const toNum = (v: { toString(): string } | number | string | null): number =>
  v == null ? 0 : Number(v);

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const combosRaw = await prisma.productCombo.findMany({
      where: { organizationId: guard.organizationId, isActive: true },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: {
            product: { select: { name: true, imageUrl: true } },
            variant: { select: { name: true, price: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const combos: PortalCombo[] = combosRaw.map((c) => {
      // Calculate original price from items
      const originalPrice = c.items.reduce((sum, ci) => {
        const variantPrice = ci.variant?.price ? toNum(ci.variant.price) : 0;
        const extraPrice = toNum(ci.extraPrice);
        // Use variant price if available, otherwise use extraPrice as the item cost
        const itemCost = variantPrice > 0 ? variantPrice * toNum(ci.quantity) : extraPrice;
        return sum + itemCost;
      }, 0);

      const comboPrice = toNum(c.comboPrice);

      return {
        id: c.id,
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        comboPrice,
        originalPrice,
        savings: Math.max(0, originalPrice - comboPrice),
        items: c.items.map((ci) => ({
          id: ci.id,
          productName: ci.product.name,
          variantName: ci.variant?.name ?? null,
          quantity: toNum(ci.quantity),
          extraPrice: toNum(ci.extraPrice),
        })),
      };
    });

    return NextResponse.json({ ok: true, combos });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
