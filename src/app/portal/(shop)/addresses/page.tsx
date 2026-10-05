import type { Metadata } from "next";
import { AddressesClient } from "@/components/portal/addresses-client";

export const metadata: Metadata = { title: "Mis direcciones — Portal" };

export default function PortalAddressesPage() {
  return <AddressesClient />;
}
