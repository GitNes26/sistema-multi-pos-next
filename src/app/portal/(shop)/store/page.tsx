import type { Metadata } from "next";
import { StoreClient } from "@/components/portal/store-client";

export const metadata: Metadata = { title: "Tienda — Portal" };

export default function PortalStorePage() {
  return <StoreClient />;
}
