import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { AccessDenied } from "@/components/shared/access-denied"
import { KitManager } from "@/components/admin/settings/kit-manager"

export const metadata: Metadata = { title: "Kit POS" }

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!hasPermission(session, "kit.manage")) return <AccessDenied permission="kit.manage" />
  return <KitManager />
}
