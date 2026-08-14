import type { Metadata } from "next";
import { OrderTrackingClient } from "@/components/portal/order-tracking-client";

export const metadata: Metadata = { title: "Seguimiento — Portal" };

export default async function PortalOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderTrackingClient orderId={id} />;
}
