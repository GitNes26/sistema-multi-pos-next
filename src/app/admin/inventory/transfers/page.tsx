import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = { title: "Traslados" }

// Los traslados viven como pestaña de Inventario.
export default function TransfersIndex() {
  redirect("/admin/inventory?tab=transfers")
}
