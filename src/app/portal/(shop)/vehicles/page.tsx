import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { SERVICE_ORDER_MODES } from "@/lib/service-orders/server";
import { VehiclesClient } from "@/components/portal/vehicles-client";

export const metadata: Metadata = { title: "Mis vehículos — Portal" };
export const dynamic = "force-dynamic";

// Solo los negocios con servicios (autolavado, taller, estética…) ofrecen vehículos y seguimiento.
export default async function PortalVehiclesPage() {
  const session = await getServerSession(authOptions);
  const organization = session?.user?.organizationId
    ? await prisma.organization.findUnique({ where: { id: session.user.organizationId }, select: { businessMode: true } })
    : null;
  if (!organization || !SERVICE_ORDER_MODES.includes(organization.businessMode)) redirect("/portal/profile");
  return <VehiclesClient />;
}
