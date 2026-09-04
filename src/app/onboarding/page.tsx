import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { OnboardingWizard } from "@/components/shared/onboarding/onboarding-wizard";
import type { BusinessMode } from "@/lib/auth/options";

export const metadata = { title: "Configuración inicial" };

// Página de onboarding: se muestra al primer login o cuando el negocio aún no
// elige su tipo. La organización (nombre + moneda) y la cuenta del propietario
// ya fueron creadas por el superAdmin; aquí solo se define el businessMode.

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const user = session.user as {
    organizationId?: string;
    activeOrganizationId?: string | null;
    organizationName?: string;
  };

  const orgId = user.activeOrganizationId ?? user.organizationId;

  // Contexto de la organización creada por el superAdmin: nombre, moneda y el
  // modo actual (para preseleccionarlo si el usuario viene a cambiarlo).
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