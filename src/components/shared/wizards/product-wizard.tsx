"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import { WizardShell, type WizardStep } from "./wizard-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { swalError, swalLoading, swalClose } from "@/lib/swal"

interface ProductData {
  name: string
  price: number
  taxRate: number
  categoryId: string
  trackInventory: boolean
  sku: string
}

const steps: WizardStep[] = [
  { id: "basic", title: "Producto" },
  { id: "confirm", title: "Confirmar" },
]

interface Props {
  categories: { id: string; name: string }[]
  onSave: (data: ProductData) => Promise<void>
  onClose: () => void
}

export function ProductWizard({ categories, onSave, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<ProductData>({ name: "", price: 0, taxRate: 16, categoryId: "", trackInventory: true, sku: "" })
  const update = (p: Partial<ProductData>) => setForm((f) => ({ ...f, ...p }))

  const submit = async () => {
    if (!form.name.trim() || form.price <= 0) { swalError("Nombre y precio obligatorios"); return }
    setLoading(true)
    try { await onSave(form); swalClose(); onClose() }
    catch (err) { swalError("Error", err instanceof Error ? err.message : undefined) }
    finally { setLoading(false) }
  }

  return (
    <WizardShell steps={steps} onFinish={submit} finishLabel={loading ? "Guardando…" : "Crear producto"} loading={loading}>
      {({ step }) => {
        if (step.id === "basic") {
          return (
            <div className="space-y-3">
              <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="Refresco Cola 600ml" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Precio *</Label><Input type="number" min={0} step={0.01} value={form.price || ""} onChange={(e) => update({ price: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>IVA (%)</Label><Input type="number" min={0} max={100} value={form.taxRate} onChange={(e) => update({ taxRate: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div>
                <Label>Categoría</Label>
                <select value={form.categoryId} onChange={(e) => update({ categoryId: e.target.value })} className="flex h-10 w-full rounded-xl border bg-background px-3 text-sm">
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div><p className="text-sm font-medium">Controlar inventario</p><p className="text-xs text-muted-foreground">Descuenta stock al vender</p></div>
                <Switch checked={form.trackInventory} onCheckedChange={(c) => update({ trackInventory: c })} />
              </div>
              <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => update({ sku: e.target.value })} placeholder="Código interno (opcional)" /></div>
            </div>
          )
        }
        if (step.id === "confirm") {
          return (
            <div className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Package className="size-5" /></div>
              <div>
                <p className="font-bold">{form.name}</p>
                <p className="text-xs text-muted-foreground">${form.price.toFixed(2)} · IVA {form.taxRate}% · Stock: {form.trackInventory ? "Sí" : "No"} · SKU: {form.sku || "—"}</p>
              </div>
            </div>
          )
        }
        return null
      }}
    </WizardShell>
  )
}
