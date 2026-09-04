import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { getAppSettings } from "@/lib/db/app-settings";
import { prisma } from "@/lib/db";
import { AppearanceSync } from "@/components/appearance/appearance-sync";
import { Splash } from "@/components/appearance/splash";
import { PortalShell } from "@/components/portal/portal-shell";
import { SessionGuard } from "@/components/auth/session-guard";
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
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, companyProfile: { select: { tradeName: true, logoUrl: true } } },
    });
    storeName = org?.companyProfile?.tradeName ?? org?.name ?? "Mi Tienda";
    logoUrl = org?.companyProfile?.logoUrl ?? null;
  }

  return (
    <SessionGuard loginPath="/portal/auth/login">
      <>
        <AppearanceSync tenant={tenant} />
        <Splash delay={500} />
        <OnboardingSheet />
        <PortalShell
          storeName={storeName}
          logoUrl={logoUrl}
          user={{ name: session?.user?.name, image: session?.user?.image }}
        >
          <RouteTransition>{children}</RouteTransition>
        </PortalShell>
      </>
    </SessionGuard>
  );
}
