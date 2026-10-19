import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { PlansManager } from "@/components/admin/settings/plans-manager";

export const metadata: Metadata = { title: "Planes del sistema" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "organizations.manage")) return <AccessDenied permission="organizations.manage" />
  return <PlansManager />;
}
