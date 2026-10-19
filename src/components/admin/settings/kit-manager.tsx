"use client"

import { useCallback, useEffect, useState } from "react"
import { Boxes, EyeOff, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { TextareaField } from "@/components/base/textarea-field"
import { SwitchField } from "@/components/base/switch-field"
import { Attachment } from "@/components/base/attachment"
import { PageHeader } from "@/components/layout/page-header"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import { money } from "@/lib/pos/money"

// Kit POS (plataforma): componentes que la landing ofrece para cotizar por
// WhatsApp. El precio mínimo estimado es solo para nosotros; el cliente no lo ve.

interface KitItem {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  options: string[]
  internalMinPrice: number
  sortOrder: number
  isActive: boolean
}

interface Form {
  id?: string
  name: string
  description: string
  imageUrl: string
  options: string
  internalMinPrice: string
  sortOrder: string
  isActive: boolean
}

const empty = (sortOrder: number): Form => ({ name: "", description: "", imageUrl: "", options: "", internalMinPrice: "", sortOrder: String(sortOrder), isActive: true })

export function KitManager() {
  const [items, setItems] = useState<KitItem[] | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/settings/kit", { cache: "no-store" })
      const d = await r.json()
      if (!r.ok || !d.ok) throw new Error(d.error ?? "No se pudo cargar el kit")
      setItems(d.items)
    } catch (e) {
      swalError("No se pudo cargar el kit", e instanceof Error ? e.message : undefined)
      setItems([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const edit = (item: KitItem) =>
    setForm({
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      imageUrl: item.imageUrl ?? "",
      options: item.options.join("\n"),
      internalMinPrice: item.internalMinPrice ? String(item.internalMinPrice) : "",
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
    })

  const save = async () => {
    if (!form) return
    if (!form.name.trim()) return setError("Escribe el nombre del componente")
    setSaving(true)
    setError("")
    try {
      const r = await fetch("/api/settings/kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, internalMinPrice: Number(form.internalMinPrice) || 0, sortOrder: Number(form.sortOrder) || 0 }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) throw new Error(d.error ?? "No se pudo guardar")
      swalToast(form.id ? "Componente actualizado" : "Componente agregado")
      setForm(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item: KitItem) => {
    if (!(await swalConfirm("Quitar componente", `«${item.name}» dejará de ofrecerse en la landing.`, { danger: true, confirmText: "Quitar" }))) return
    const r = await fetch("/api/settings/kit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: item.id }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d.ok) return swalError("No se pudo quitar", d.error)
    swalToast("Componente quitado")
    await load()
  }

  return (
    <>
      <PageHeader
        icon={<Boxes className="size-5" />}
        title="Kit POS"
        description="Componentes que tus clientes pueden agregar a su cotización desde la landing. Llegan por WhatsApp, igual que los planes."
        actions={
          <Button onClick={() => setForm(empty((items?.length ?? 0) + 1))}>
            <Plus className="size-4" /> Nuevo componente
          </Button>
        }
      />

      {items === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Aún no hay componentes. Agrega el primero para que aparezca la sección «Arma tu Kit POS» en la landing.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card">
              <div className="aspect-[4/3] bg-muted">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.name} className="size-full object-contain" />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <Boxes className="size-8" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{item.name}</h3>
                  {!item.isActive && (
                    <Badge variant="outline" className="shrink-0 gap-1">
                      <EyeOff className="size-3" /> Oculto
                    </Badge>
                  )}
                </div>
                {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                {item.options.length > 0 && <p className="text-xs text-muted-foreground">Opciones: {item.options.join(" · ")}</p>}
                <p className="mt-auto text-xs text-muted-foreground">
                  Mínimo estimado (interno): <span className="font-medium text-foreground tabular-nums">{money(item.internalMinPrice)}</span>
                </p>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => edit(item)}>
                    <Pencil className="size-4" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove(item)} aria-label={`Quitar ${item.name}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DialogComponent
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
        icon={<Boxes className="size-5 text-primary" />}
        title={form?.id ? "Editar componente" : "Nuevo componente"}
        description="Lo que el cliente verá en «Arma tu Kit POS»."
        className="sm:max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <InputGroupField id="kit-name" label="Nombre" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Impresora de tickets" />
            <TextareaField label="Descripción corta" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Una línea que ayude a elegir" rows={2} maxLength={190} />
            <Attachment label="Foto" value={form.imageUrl || null} onChange={(v) => setForm({ ...form, imageUrl: v ?? "" })} upload={uploadFile} accept={UPLOAD_IMAGE_ACCEPT} />
            <TextareaField
              label="Opciones (una por línea)"
              value={form.options}
              onChange={(e) => setForm({ ...form, options: e.target.value })}
              placeholder={"Tablet\nComputadora"}
              rows={3}
              helper="Si el cliente puede elegir entre varias (Tablet o Computadora), escríbelas aquí. Déjalo vacío si no aplica."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputGroupField
                id="kit-price"
                label="Mínimo estimado ($)"
                type="number"
                inputMode="decimal"
                min="0"
                value={form.internalMinPrice}
                onChange={(e) => setForm({ ...form, internalMinPrice: e.target.value })}
                helper="Solo para uso interno: el cliente nunca lo ve."
              />
              <InputGroupField id="kit-order" label="Orden" type="number" inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            </div>
            <SwitchField id="kit-active" label="Visible en la landing" description="Apágalo para ocultarlo sin borrarlo." checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
          </div>
        )}
      </DialogComponent>
    </>
  )
}
