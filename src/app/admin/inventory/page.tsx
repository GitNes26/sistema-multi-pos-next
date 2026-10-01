import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Boxes } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { InventoryPage } from "@/components/admin/inventory/inventory-page";

// FASE 8 — Inventario (existencias, movimientos, mínimos, transferencias y revisiones).

export const metadata: Metadata = { title: "Inventario" };

export default async function AdminInventoryPage() {
  const session = await getServerSession(authOptions);
  const authed = !!session?.user && session.user.scope !== "portal";
  const canManage = authed && hasPermission(session, "inventory.manage");
  const canRevise = authed && hasPermission(session, "inventory.revision");
  const canPurchase = authed && hasPermission(session, "purchasing.manage");
  const transfers = {
    view: authed && hasPermission(session, "transfers.view"),
    request: authed && hasPermission(session, "transfers.request"),
  };

  return (
    <InventoryPage
      canManage={canManage}
      canRevise={canRevise}
      canPurchase={canPurchase}
      transfers={transfers}
      icon={<Boxes className="size-5" />}
    />
  );
}