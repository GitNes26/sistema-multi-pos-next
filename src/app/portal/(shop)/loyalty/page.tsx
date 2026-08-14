import type { Metadata } from "next";
import { LoyaltyClient } from "@/components/portal/loyalty-client";

export const metadata: Metadata = { title: "Puntos y lealtad — Portal" };

export default function PortalLoyaltyPage() {
  return <LoyaltyClient />;
}
