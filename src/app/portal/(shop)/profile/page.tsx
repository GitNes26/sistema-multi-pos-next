import type { Metadata } from "next";
import { ProfileClient } from "@/components/portal/profile-client";

export const metadata: Metadata = { title: "Perfil — Portal" };

export default function PortalProfilePage() {
  return <ProfileClient />;
}
