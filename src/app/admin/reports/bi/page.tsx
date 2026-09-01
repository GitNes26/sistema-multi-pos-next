import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { BiReportsPage } from "@/components/admin/reports/bi/bi-reports-page"

export const metadata: Metadata = { title: "Business Intelligence — Reportes" }

export default async function BiReportsPageRoute() {
  const session = await getServerSession(authOptions)
  const canView = hasPermission(session, "reports.view")

  return <BiReportsPage canView={canView} />
}
