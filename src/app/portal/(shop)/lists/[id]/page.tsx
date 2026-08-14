import type { Metadata } from "next";
import { ListDetailClient } from "@/components/portal/list-detail-client";

export const metadata: Metadata = { title: "Lista de compra — Portal" };

export default async function PortalListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ListDetailClient listId={id} />;
}
