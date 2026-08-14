import type { Metadata } from "next";
import { HomeClient } from "@/components/portal/home-client";

export const metadata: Metadata = { title: "Inicio — Portal" };

export default function PortalHomePage() {
  return <HomeClient />;
}
