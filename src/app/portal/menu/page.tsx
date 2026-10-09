import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { getAppSettings } from "@/lib/db/app-settings"
import { AppearanceSync } from "@/components/appearance/appearance-sync"
import { DigitalMenu } from "@/components/portal/digital-menu/digital-menu"

export const metadata: Metadata = { title: "Menú de la mesa" }
export const dynamic = "force-dynamic"

// Menú digital por QR de mesa. Es público (sin cuenta): el QR de la mesa es la credencial y
// define el negocio, por lo que también define sus colores.
export default async function MenuPage({ searchParams }: { searchParams: Promise<{ table?: string; token?: string }> }) {
  const { table, token } = await searchParams
  let tenant = null
  if (table && token) {
    const t = await prisma.table.findFirst({ where: { id: table, qrToken: token, isActive: true }, select: { organizationId: true } })
    if (t) tenant = await getAppSettings(t.organizationId)
  }
  return (
    <>
      <AppearanceSync tenant={tenant} />
      <DigitalMenu tableId={table} tableToken={token} />
    </>
  )
}
