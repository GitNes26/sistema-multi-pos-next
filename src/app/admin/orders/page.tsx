import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { ClipboardList } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { OrdersPage } from "@/components/admin/orders/orders-page";

export const metadata: Metadata = { title: "Pedidos" };

// FASE 12.1 — Vista admin de pedidos.

export default async function AdminOrdersPage() {
  const session = await getServerSession(authOptions);
  const canManage = hasPermission(session, "orders.manage");

  return <OrdersPage canManage={canManage} icon={<ClipboardList className="size-5" />} />;
}