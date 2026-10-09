import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { SessionGuard } from "@/components/auth/session-guard"
import { BusinessesClient } from "@/components/portal/businesses-client"

export const metadata: Metadata = { title: "Elige un negocio" }

// Fuera del layout de tienda: una cuenta nueva aún no tiene negocio activo.
export default async function PortalBusinessesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/portal/auth/login")
  if (session.user.scope !== "portal") redirect("/pos")
  return (
    <SessionGuard loginPath="/portal/auth/login">
      <BusinessesClient activeOrganizationId={session.user.organizationId ?? null} name={session.user.name ?? ""} />
    </SessionGuard>
  )
}
