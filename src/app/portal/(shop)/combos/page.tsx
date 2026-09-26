import type { Metadata } from "next";
import { CombosClient } from "@/components/portal/combos-client";

export const metadata: Metadata = { title: "Combos — Portal" };

export default function PortalCombosPage() {
  return <CombosClient />;
}
