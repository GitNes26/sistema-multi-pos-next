import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { CreditClient } from "@/components/portal/credit-client"

export const metadata: Metadata = { title: "Mi Crédito" }

export default async function PortalCreditPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/portal/login")

  return <CreditClient />
}
