import type { Metadata } from "next"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { authOptions } from "@/lib/auth/options"
import { Button } from "@/components/ui/button"
import { CreditClient } from "@/components/portal/credit-client"

export const metadata: Metadata = { title: "Mi Crédito" }

export default async function PortalCreditPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/portal/login")

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="flex items-center gap-2 px-4 py-3">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href="/portal">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-sm font-semibold">Mi Crédito</h1>
        </div>
      </div>
      <CreditClient />
    </div>
  )
}
