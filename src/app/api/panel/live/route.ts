import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/db";

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
    return NextResponse.json({ ok: true, live: { orders, lowStock: stock, openRegisters: registers, transfers, returns } });
  } catch (err) {
    console.error("[panel/live]", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}
