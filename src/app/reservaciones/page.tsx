import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/db/app-settings";
import { RESERVATION_MODES } from "@/lib/reservations/server";
import { AppearanceSync } from "@/components/appearance/appearance-sync";
import { Splash } from "@/components/appearance/splash";
import { ReservationsApp } from "@/components/reservations/reservations-app";

export const metadata: Metadata = { title: "Reservaciones" };

export const dynamic = "force-dynamic";

export default async function ReservacionesPage() {
  const session = await getServerSession(authOptions);
  const organizationId = effectiveOrgId(session);

  if (!organizationId) {
    if (session?.user?.scope === "superadmin") redirect("/admin/settings/organizations");
    redirect("/auth/login?callbackUrl=/reservaciones");
  }

  // Solo aplica a rental/híbrido y exige reservations.view (owner/admin pasan
  // por rol; el agente de renta lo trae por roleId).
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { businessMode: true, name: true },
  });
  if (!org || !RESERVATION_MODES.includes(org.businessMode)) redirect("/pos");
  if (!hasPermission(session, "reservations.view")) redirect("/pos");

  const canManage = hasPermission(session, "reservations.manage");
  const tenant = await getAppSettings(organizationId);

  return (
    <>
      <AppearanceSync tenant={tenant} />
      <Splash orgName={org.name} />
      <ReservationsApp orgName={org.name} orgMode={org.businessMode} canManage={canManage} />
    </>
  );
}