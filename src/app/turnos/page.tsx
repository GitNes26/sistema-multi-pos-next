import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { AccessDenied } from "@/components/shared/access-denied";
import { TurnsScreen } from "@/components/turnos/turns-screen";
import { SERVICE_ORDER_MODES } from "@/lib/service-orders/server";

export const metadata: Metadata = { title: "Turnos" };
export const dynamic = "force-dynamic";

// Pantalla de turnos para la clientela (TV o tableta en la sala de espera). Solo giros con órdenes de servicio.
export default async function TurnosPage() {
  const session = await getServerSession(authOptions);
  const organizationId = effectiveOrgId(session);
  if (!organizationId) redirect("/pos");

  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, businessMode: true } });
  if (!org || !SERVICE_ORDER_MODES.includes(org.businessMode)) redirect("/pos");
  if (!hasPermission(session, "service_orders.view")) return <AccessDenied permission="service_orders.view" />;

  return <TurnsScreen organizationName={org.name} />;
}
