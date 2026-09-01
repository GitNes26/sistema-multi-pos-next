import { CombosManager } from "@/components/admin/combos/combos-manager"

export const dynamic = "force-dynamic"

export default async function CombosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Combos</h1>
        <p className="text-sm text-muted-foreground">
          Administra los combos de productos con precios especiales
        </p>
      </div>
      <CombosManager />
    </div>
  )
}
