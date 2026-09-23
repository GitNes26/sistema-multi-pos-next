import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/db/app-settings";
import { AGENDA_MODES } from "@/lib/agenda/server";
import { AppearanceSync } from "@/components/appearance/appearance-sync";
import { OrganizationContextSync } from "@/components/auth/organization-context-sync";
import { Splash } from "@/components/appearance/splash";
import { AgendaApp } from "@/components/agenda/agenda-app";

export const metadata: Metadata = { title: "Agenda de citas" };

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const session = await getServerSession(authOptions);
  const organizationId = effectiveOrgId(session);

  if (!organizationId) {
    if (session?.user?.scope === "superadmin") redirect("/admin/settings/organizations");
    redirect("/auth/login?callbackUrl=/agenda");
  }

  // La agenda solo aplica a servicios/híbrido y exige appointments.view
  // (owner/admin pasan por rol; el agente de atención lo trae por roleId).
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { businessMode: true, name: true },
  });
  if (!org || !AGENDA_MODES.includes(org.businessMode)) redirect("/admin");
  if (!hasPermission(session, "appointments.view")) redirect("/admin");

  const canManage = hasPermission(session, "appointments.manage");
  const tenant = await getAppSettings(organizationId);

  return (
    <>
      <AppearanceSync tenant={tenant} />
      <OrganizationContextSync
        organizationId={organizationId}
        organizationName={org.name}
        businessMode={org.businessMode}
      />
      <Splash orgName={org.name} />
      <AgendaApp orgName={org.name} orgMode={org.businessMode} canManage={canManage} />
    </>
  );
}
