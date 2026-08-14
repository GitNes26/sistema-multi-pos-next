import type { Metadata } from "next";
import { ListsClient } from "@/components/portal/lists-client";

export const metadata: Metadata = { title: "Listas de compra — Portal" };

export default function PortalListsPage() {
  return <ListsClient />;
}
