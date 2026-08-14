import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getAppSettings } from "@/lib/db/app-settings";
import { prisma } from "@/lib/db";
import { AppearanceSync } from "@/components/appearance/appearance-sync";
import { Splash } from "@/components/appearance/splash";
import { PortalShell } from "@/components/portal/portal-shell";

export default async function PortalShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const organizationId = session?.user?.organizationId ?? null;
  const tenant = organizationId ? await getAppSettings(organizationId) : null;

  let storeName = "Mi Tienda";
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, companyProfile: { select: { tradeName: true } } },
    });
    storeName = org?.companyProfile?.tradeName ?? org?.name ?? "Mi Tienda";
  }

  return (
    <>
      <AppearanceSync tenant={tenant} />
      <Splash delay={500} />
      <PortalShell
        storeName={storeName}
        user={{ name: session?.user?.name, image: session?.user?.image }}
      >
        {children}
      </PortalShell>
    </>
  );
}
