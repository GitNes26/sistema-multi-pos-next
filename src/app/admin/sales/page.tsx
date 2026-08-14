import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { ShoppingCart } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { SalesPage } from "@/components/admin/sales/sales-page";

// FASE 9 — Historial de ventas, detalle, reimpresión y exportación.

export const metadata: Metadata = { title: "Ventas" };

export default async function AdminSalesPage() {
  const session = await getServerSession(authOptions);
  const authed = !!session?.user && session.user.scope !== "portal";
  const canView = authed && hasPermission(session, "sales.view");

  return <SalesPage canView={canView} icon={<ShoppingCart className="size-5" />} />;
}