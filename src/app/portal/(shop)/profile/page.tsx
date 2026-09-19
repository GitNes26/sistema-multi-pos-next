import type { Metadata } from "next";
import { ProfileClient } from "@/components/portal/profile-client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Perfil — Portal" };

export default async function PortalProfilePage() {
  const session = await getServerSession(authOptions);
  const organization = session?.user?.organizationId
    ? await prisma.organization.findUnique({ where: { id: session.user.organizationId }, select: { businessMode: true } })
    : null;
  return <ProfileClient canReserve={organization?.businessMode === "food_service" || organization?.businessMode === "hybrid"} />;
}
