import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { OnboardingWizard } from "@/components/shared/onboarding/onboarding-wizard";
import type { BusinessMode } from "@/lib/auth/options";

export const metadata: Metadata = { title: "Configurar empresa — Onboarding" };

// Mismo flujo que /onboarding: la organización ya existe (nombre + moneda
// creados por el superAdmin) y aquí solo se define el tipo de negocio.

export default async function AdminOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const user = session.user as {
    organizationId?: string;
    activeOrganizationId?: string | null;
  };
  const orgId = user.activeOrganizationId ?? user.organizationId;

  let orgName: string | undefined;
  let orgCurrency = "MXN";
  let currentMode: BusinessMode | null = null;

  if (orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, currency: true, businessMode: true },
    });
    if (org) {
      orgName = org.name;
      orgCurrency = org.currency || "MXN";
      currentMode = org.businessMode ?? null;
    }
  }

  return (
    <OnboardingWizard
      orgId={orgId}
      orgName={orgName}
      orgCurrency={orgCurrency}
      currentMode={currentMode}
    />
  );
}