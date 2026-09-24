"use client"

import { useMemo, useState } from "react"
import { Check, Layers3, Loader2, Search } from "lucide-react"
import { DialogComponent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { InputGroupField } from "@/components/base/input-group-field"
import { cn } from "@/lib/utils"
import { crudApi } from "@/lib/api"
import { swalError, swalToast } from "@/lib/swal"
import { BULK_CATEGORY_PRESETS as PRESETS } from "@/lib/categories/bulk-presets"

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
    <DialogComponent open={open} onOpenChange={onOpenChange} icon={<Layers3 className="size-5" />} title="Agregar categorías en lote" description="Explora 50 sugerencias por giro. Busca, combina giros y selecciona únicamente lo que utiliza tu negocio." size="4xl" className="h-[min(90vh,56rem)]" bodyClassName="min-h-0" footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => void create()} disabled={!selected.size || saving}>{saving && <Loader2 className="size-4 animate-spin" />}Crear {selected.size || ""} categorías</Button></>}>
      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Giros de negocio" className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-y-auto md:border-r md:pb-0 md:pr-3">
          {Object.keys(PRESETS).map((name) => <Button key={name} type="button" variant={sector === name ? "default" : "ghost"} className="min-h-11 shrink-0 justify-between md:w-full" onClick={() => setSector(name)}><span className="truncate">{name}</span><span className="ml-2 text-xs opacity-70">50</span></Button>)}
        </nav>
        <section className="flex min-h-0 flex-col gap-3" aria-labelledby="bulk-category-sector">
          <div>
            <h3 id="bulk-category-sector" className="font-heading text-base font-semibold">{sector}</h3>
            <p className="text-sm text-muted-foreground">Puedes conservar selecciones al cambiar de giro.</p>
          </div>
          <InputGroupField value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar entre las categorías de ${sector}…`} leftIcon={<Search className="size-4" />} />
          <div className="flex items-center justify-between gap-3 text-sm"><span><strong>{selected.size}</strong> seleccionadas · {options.length} visibles</span><div className="flex gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => setSelected((current) => { const next = new Set(current); for (const name of options) next.add(name); return next })}>Seleccionar visibles</Button>{selected.size > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Limpiar</Button>}</div></div>
          <div className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {options.map((name) => { const active = selected.has(name); return <button key={name} type="button" aria-pressed={active} onClick={() => toggle(name)} className={cn("flex min-h-11 items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "border-primary bg-primary/5")}><span>{name}</span>{active && <Check className="size-4 shrink-0 text-primary" />}</button> })}
            {!options.length && <p className="col-span-full py-12 text-center text-sm text-muted-foreground">No hay coincidencias. Prueba con otro término.</p>}
          </div>
        </section>
      </div>
    </DialogComponent>
  )
}
