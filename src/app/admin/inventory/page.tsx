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

  return (
    <InventoryPage
      canManage={canManage}
      canRevise={canRevise}
      icon={<Boxes className="size-5" />}
    />
  );
}