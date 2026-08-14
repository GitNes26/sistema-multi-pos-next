import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Truck } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { OrdersMonitor } from "@/components/admin/orders/orders-monitor";

export const metadata: Metadata = { title: "Monitoreo de pedidos" };

// FASE 12.4 — Semáforo de estados de pedidos.

export default async function AdminOrdersMonitoringPage() {
  const session = await getServerSession(authOptions);
  const canManage = hasPermission(session, "orders.manage");

  return <OrdersMonitor canManage={canManage} icon={<Truck className="size-5" />} />;
}