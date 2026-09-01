import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { OnboardingWizard } from "@/components/shared/onboarding/onboarding-wizard";

export const metadata = { title: "Configuración inicial" };

// Página de onboarding: se muestra al primer login o cuando la empresa no tiene businessMode configurado.

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const user = session.user as { organizationId?: string; organizationName?: string };

  return (
    <OnboardingWizard
      orgId={user.organizationId}
      orgName={user.organizationName}
    />
  );
}
