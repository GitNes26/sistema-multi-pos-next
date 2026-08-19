import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { getAppSettings } from "@/lib/db/app-settings"
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
  const organizationId = session.user.organizationId ?? null
  const tenant = organizationId ? await getAppSettings(organizationId) : null

  return (
    <SessionGuard loginPath="/auth/login">
      <>
        <AppearanceSync tenant={tenant} />
        <Splash />
        <AppShell
          permissions={session?.user?.permissions}
          user={{
            name: session?.user?.name,
            email: session?.user?.email,
            image: session?.user?.image,
            role: session?.user?.role,
          }}
        >
          {children}
        </AppShell>
      </>
    </SessionGuard>
  )
}
