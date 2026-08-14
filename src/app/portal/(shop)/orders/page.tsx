import type { Metadata } from "next";
import { OrdersClient } from "@/components/portal/orders-client";

export const metadata: Metadata = { title: "Mis pedidos — Portal" };

export default function PortalOrdersPage() {
  return <OrdersClient />;
}
