import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { TransferDetailView } from "@/components/admin/inventory/transfers/transfer-detail"

export const metadata: Metadata = { title: "Traslado" }

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.scope === "portal" || !hasPermission(session, "transfers.view")) redirect("/admin")
  const { id } = await params
  return (
    <TransferDetailView
      id={id}
      perms={{
        dispatch: hasPermission(session, "transfers.dispatch"),
        receive: hasPermission(session, "transfers.receive"),
        cancel: hasPermission(session, "transfers.cancel"),
      }}
    />
  )
}
