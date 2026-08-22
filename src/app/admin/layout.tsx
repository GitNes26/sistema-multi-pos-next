import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { getAppSettings } from "@/lib/db/app-settings"
import { prisma } from "@/lib/db"
import { AppearanceSync } from "@/components/appearance/appearance-sync"
import { Splash } from "@/components/appearance/splash"
import { AppShell } from "@/components/layout/app-shell"
import { SessionGuard } from "@/components/auth/session-guard"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/auth/login")
  }
  const organizationId = session.user.activeOrganizationId ?? session.user.organizationId ?? null
  const tenant = organizationId ? await getAppSettings(organizationId) : null

  let logoUrl: string | null = null
  if (organizationId) {
    const profile = await prisma.companyProfile.findUnique({
      where: { organizationId },
      select: { logoUrl: true },
    })
    logoUrl = profile?.logoUrl ?? null
  }

  return (
    <SessionGuard loginPath="/auth/login">
      <>
        <AppearanceSync tenant={tenant} />
        <Splash />
        <AppShell
          logoUrl={logoUrl}
          permissions={session?.user?.permissions}
          user={{
            name: session?.user?.name,
            email: session?.user?.email,
            image: session?.user?.image,
            role: session?.user?.role,
            scope: session?.user?.scope,
            organizationId: session?.user?.organizationId,
            activeOrganizationId: session?.user?.activeOrganizationId,
          }}
        >
          {children}
        </AppShell>
      </>
    </SessionGuard>
  )
}
