import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { OrderPrepare } from "@/components/admin/orders/order-prepare";

export const metadata: Metadata = { title: "Preparación de pedido" };

// FASE 12.3 — Preparación de pedido (timer + check-list).

export default async function AdminOrderPreparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "orders.manage")) redirect("/admin/orders");

  const { id } = await params;
  return <OrderPrepare orderId={id} />;
}