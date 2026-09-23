import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { getAppSettings } from "@/lib/db/app-settings";
import { prisma } from "@/lib/db";
import { AppearanceSync } from "@/components/appearance/appearance-sync";
import { Splash } from "@/components/appearance/splash";
import { PortalShell } from "@/components/portal/portal-shell";
import { SessionGuard } from "@/components/auth/session-guard";
import { OrganizationContextSync } from "@/components/auth/organization-context-sync";
import type { BusinessMode } from "@/lib/auth/options";
import { OnboardingSheet } from "@/components/portal/onboarding-sheet";
import { RouteTransition } from "@/components/layout/route-transition";

export default async function PortalShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/portal/auth/login");
  }
  const organizationId = session.user.organizationId ?? null;
  const tenant = organizationId ? await getAppSettings(organizationId) : null;

  let storeName = "Mi Tienda";
  let logoUrl: string | null = null;
  let businessMode: BusinessMode | null = null;
  let organizationName: string | null = null;
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, businessMode: true, companyProfile: { select: { tradeName: true, logoUrl: true } } },
    });
    storeName = org?.companyProfile?.tradeName ?? org?.name ?? "Mi Tienda";
    organizationName = org?.name ?? null;
    logoUrl = org?.companyProfile?.logoUrl ?? null;
    businessMode = org?.businessMode ?? null;
  }

  return (
    <SessionGuard loginPath="/portal/auth/login">
      <>
        <AppearanceSync tenant={tenant} />
        <OrganizationContextSync
          organizationId={organizationId}
          organizationName={organizationName}
          businessMode={businessMode}
        />
        <Splash delay={500} orgName={storeName} logoUrl={logoUrl} />
        <OnboardingSheet />
        <PortalShell
          storeName={storeName}
          logoUrl={logoUrl}
          businessMode={businessMode}
          user={{ name: session?.user?.name, image: session?.user?.image }}
        >
          <RouteTransition>{children}</RouteTransition>
        </PortalShell>
      </>
    </SessionGuard>
  );
}
