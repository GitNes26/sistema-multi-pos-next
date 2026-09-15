import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePortalCustomer, portalErrorResponse } from "../guard";
import type { PortalCombo } from "@/lib/portal/server";
import { round2 } from "@/lib/pos/money";

// GET /api/portal/combos — List active combos for the portal

export const dynamic = "force-dynamic";

const toNum = (v: { toString(): string } | number | string | null): number =>
  v == null ? 0 : Number(v);

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    // Los combos son exclusivos de restaurantes; en retail el portal no los
    // ofrece.
    const org = await prisma.organization.findUnique({
      where: { id: guard.organizationId },
      select: { businessMode: true },
    })
    if (org?.businessMode !== "food_service" && org?.businessMode !== "hybrid") {
      return NextResponse.json({ ok: true, combos: [] })
    }

    const combosRaw = await prisma.productCombo.findMany({
      where: { organizationId: guard.organizationId, isActive: true },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: {
            product: {
              select: {
                name: true,
                imageUrl: true,
                productType: true,
                bulkPricePerUnit: true,
                taxRate: true,
                categoryId: true,
                variants: { where: { isActive: true }, take: 1, select: { price: true } },
              },
            },
            variant: { select: { name: true, price: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const combos: PortalCombo[] = combosRaw.map((c) => {
      // Calculate original price from items
      const originalPrice = c.items.reduce((sum, ci) => {
        const variantPrice = ci.variant?.price != null
          ? toNum(ci.variant.price)
          : ci.product.productType === "bulk"
            ? toNum(ci.product.bulkPricePerUnit)
            : toNum(ci.product.variants[0]?.price ?? null);
        const extraPrice = toNum(ci.extraPrice);
        const itemCost = (variantPrice + extraPrice) * toNum(ci.quantity);
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
          productId: ci.productId,
          variantId: ci.variantId,
          productType: ci.product.productType,
          productName: ci.product.name,
          variantName: ci.variant?.name ?? null,
          quantity: toNum(ci.quantity),
          unitPrice: round2(
            (ci.variant?.price != null
              ? toNum(ci.variant.price)
              : ci.product.productType === "bulk"
                ? toNum(ci.product.bulkPricePerUnit)
                : toNum(ci.product.variants[0]?.price ?? null)) + toNum(ci.extraPrice),
          ),
          extraPrice: toNum(ci.extraPrice),
          taxRate: toNum(ci.product.taxRate),
          categoryId: ci.product.categoryId,
        })),
      };
    });

    return NextResponse.json({ ok: true, combos });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
