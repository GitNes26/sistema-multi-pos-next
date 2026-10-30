import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/db";
import { cached, orgTag } from "@/lib/cache";

// Pulso operativo del Panel: solo cuenta lo que el usuario puede ver.

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const organizationId = effectiveOrgId(session);
  if (session.user.scope === "portal" || !organizationId) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
  }

  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(session, p);
  try {
    // Los contadores se calculan una vez por empresa y combinación de permisos cada 15 s:
    // con muchos paneles abiertos, la base de datos no repite el mismo conteo en cada uno.
    const mask = ["orders.view", "inventory.view", "cash.open", "cash.close", "transfers.view", "sales.view"].map((p) => (can(p as Parameters<typeof hasPermission>[1]) ? "1" : "0")).join("")
    const live = await cached(`panel:live:${organizationId}:${mask}`, { ttlMs: 15_000, staleMs: 30_000, tags: [orgTag(organizationId)] }, async () => {
    const [orders, stock, registers, transfers, returns] = await Promise.all([
      can("orders.view")
        ? prisma.order.count({ where: { organizationId, source: "portal", status: { in: ["pending", "confirmed", "preparing", "ready", "in_transit", "at_destination"] } } })
        : null,
      can("inventory.view")
        ? prisma.inventory
            .findMany({
              where: { organizationId, minThreshold: { gt: 0 }, OR: [{ product: { isActive: true, trackInventory: true } }, { productId: null, variant: { isActive: true } }] },
              select: { quantity: true, minThreshold: true },
              take: 5000,
            })
            .then((rows) => rows.filter((r) => Number(r.quantity) <= Number(r.minThreshold)).length)
        : null,
      can("cash.open") || can("cash.close")
        ? prisma.cashSession.count({ where: { organizationId, status: "open" } })
        : null,
      can("transfers.view")
        ? prisma.transfer.count({ where: { organizationId, status: { in: ["pending", "preparing", "in_transit"] } } })
        : null,
      can("sales.view")
        ? prisma.saleReturn.count({ where: { organizationId, status: { in: ["pending", "approved"] } } })
        : null,
    ]);
    return { orders, lowStock: stock, openRegisters: registers, transfers, returns };
    });
    return NextResponse.json({ ok: true, live });
  } catch (err) {
    console.error("[panel/live]", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}
