import type { Metadata } from "next"
import { Layers } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { CombosManager } from "@/components/admin/combos/combos-manager"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Combos" }

export default async function CombosPage() {
  return (
    <>
      <PageHeader
        icon={<Layers className="size-5" />}
        title="Combos"
        description="Administra los combos de productos con precios especiales."
      />
      <CombosManager />
    </>
  )
}
