"use client"

import { useMemo, useState } from "react"
import { Check, Layers3, Loader2, Search } from "lucide-react"
import { DialogComponent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { InputGroupField } from "@/components/base/input-group-field"
import { cn } from "@/lib/utils"
import { crudApi } from "@/lib/api"
import { swalError, swalToast } from "@/lib/swal"

const PRESETS: Record<string, string[]> = {
  "Abarrotes / tiendita": ["Abarrotes", "Bebidas", "Botanas", "Dulces", "Lácteos", "Limpieza", "Panadería", "Higiene personal"],
  Ferretería: ["Adhesivos", "Electricidad", "Herramientas", "Iluminación", "Plomería", "Pinturas", "Tornillería", "Seguridad"],
  Carnicería: ["Res", "Cerdo", "Pollo", "Embutidos", "Marinados", "Congelados", "Complementos"],
  Restaurante: ["Entradas", "Platos fuertes", "Bebidas", "Postres", "Combos", "Extras"],
  Farmacia: ["Medicamentos", "Primeros auxilios", "Cuidado personal", "Bebé", "Suplementos", "Higiene"],
  Papelería: ["Cuadernos", "Escritura", "Escolar", "Oficina", "Arte", "Impresión", "Regalos"],
  Ropa: ["Dama", "Caballero", "Niños", "Calzado", "Accesorios", "Temporada"],
  Mascotas: ["Alimento", "Premios", "Higiene", "Accesorios", "Salud", "Juguetes"],
  Autolavado: ["Lavado", "Detallado", "Encerado", "Interiores", "Paquetes", "Extras"],
  Servicios: ["Servicios principales", "Paquetes", "Complementos", "Promociones", "Refacciones e insumos"],
}

export function BulkCategoriesDialog({ open, onOpenChange, onComplete }: { open: boolean; onOpenChange: (open: boolean) => void; onComplete: () => void }) {
  const [sector, setSector] = useState(Object.keys(PRESETS)[0])
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const options = useMemo(() => PRESETS[sector].filter((name) => name.toLowerCase().includes(query.trim().toLowerCase())), [query, sector])

  const toggle = (name: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(name)) next.delete(name); else next.add(name)
    return next
  })

  const create = async () => {
    if (!selected.size) return
    setSaving(true)
    const failures: string[] = []
    let created = 0
    for (const name of selected) {
      try { await crudApi.create("categories", { name, isActive: true }); created += 1 }
      catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : "no se pudo crear"}`) }
    }
    setSaving(false)
    if (created) { swalToast(`${created} categorías creadas`); onComplete(); setSelected(new Set()) }
    if (failures.length) swalError("Algunas categorías no se crearon", failures.slice(0, 6).join(" · "))
    if (!failures.length) onOpenChange(false)
  }

  return (
    <DialogComponent open={open} onOpenChange={onOpenChange} icon={<Layers3 className="size-5" />} title="Agregar categorías en lote" description="Elige un giro y selecciona únicamente las categorías que utiliza tu negocio." size="xl" bodyClassName="space-y-4" footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => void create()} disabled={!selected.size || saving}>{saving && <Loader2 className="size-4 animate-spin" />}Crear {selected.size || ""} categorías</Button></>}>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Object.keys(PRESETS).map((name) => <Button key={name} type="button" size="sm" variant={sector === name ? "default" : "outline"} className="shrink-0" onClick={() => setSector(name)}>{name}</Button>)}
      </div>
      <InputGroupField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar categorías…" leftIcon={<Search className="size-4" />} />
      <div className="flex items-center justify-between text-sm"><span>{selected.size} seleccionadas</span><Button type="button" variant="ghost" size="sm" onClick={() => setSelected((current) => { const next = new Set(current); for (const name of options) next.add(name); return next })}>Seleccionar visibles</Button></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((name) => { const active = selected.has(name); return <button key={name} type="button" aria-pressed={active} onClick={() => toggle(name)} className={cn("flex min-h-11 items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "border-primary bg-primary/5")}><span>{name}</span>{active && <Check className="size-4 text-primary" />}</button> })}
      </div>
    </DialogComponent>
  )
}
