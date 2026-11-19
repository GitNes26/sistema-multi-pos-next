import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { getAppSettings } from "@/lib/db/app-settings"
import { prisma } from "@/lib/db"
import { AppearanceSync } from "@/components/appearance/appearance-sync"
import { Splash } from "@/components/appearance/splash"
import { AppShell } from "@/components/layout/app-shell"
import { SessionGuard } from "@/components/auth/session-guard"
import { OrganizationContextSync } from "@/components/auth/organization-context-sync"
import type { BusinessMode } from "@/lib/auth/options"
import Link from "next/link"
import { Gift } from "lucide-react"
import { PERMANENT_DEMO_DAYS, daysUntil, demoLabel } from "@/lib/billing/demo"

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
  let orgName: string | null = null
  let organizationName: string | null = null
  let businessMode: BusinessMode | null = null
  let trial: { label: string; urgent: boolean } | null = null
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, businessMode: true, companyProfile: { select: { tradeName: true, logoUrl: true } }, subscription: { select: { isDemo: true, periodEndsAt: true } } },
    })
    logoUrl = org?.companyProfile?.logoUrl ?? null
    orgName = org?.companyProfile?.tradeName ?? org?.name ?? null
    organizationName = org?.name ?? null
    businessMode = org?.businessMode ?? null
    // Prueba gratis: aviso discreto con los días que quedan (las demos permanentes no lo muestran).
    if (org?.subscription?.isDemo && daysUntil(org.subscription.periodEndsAt) <= PERMANENT_DEMO_DAYS) {
      trial = { label: demoLabel(org.subscription.periodEndsAt), urgent: daysUntil(org.subscription.periodEndsAt) <= 3 }
    }
  }

  return (
    <SessionGuard loginPath="/auth/login">
      <>
        <AppearanceSync tenant={tenant} />
        <OrganizationContextSync
          organizationId={organizationId}
          organizationName={organizationName}
          businessMode={businessMode}
        />
        <Splash orgName={orgName} logoUrl={logoUrl} />
        <AppShell
          logoUrl={logoUrl}
          businessMode={businessMode}
          permissions={session?.user?.permissions}
          planDenied={session?.user?.planDenied}
          user={{
            name: session?.user?.name,
            email: session?.user?.email,
            image: session?.user?.image,
            role: session?.user?.role,
            roleName: session?.user?.roleName,
            scope: session?.user?.scope,
            organizationId: session?.user?.organizationId,
            activeOrganizationId: session?.user?.activeOrganizationId,
          }}
        >
          {trial && (
            <Link
              href="/admin/settings/my-plan"
              className={`press mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${trial.urgent ? "border-warning/40 bg-warning/10 text-warning-ink" : "border-info/30 bg-info/10 text-info-ink"}`}
            >
              <Gift className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate"><b>{trial.label}.</b> Ver lo que costaría tu plan</span>
            </Link>
          )}
          {children}
        </AppShell>
      </>
    </SessionGuard>
  )
}
