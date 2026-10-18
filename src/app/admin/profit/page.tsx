import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { TrendingUp } from "lucide-react"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { ProfitPage } from "@/components/admin/reports/profit-page"

export const metadata: Metadata = { title: "Ganancias" }

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!hasPermission(session, "expenses.view")) redirect("/admin")
  return <ProfitPage icon={<TrendingUp className="size-5" />} canManageExpenses={hasPermission(session, "expenses.manage")} />
}
