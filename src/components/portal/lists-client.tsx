"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Copy, ListChecks, MoreHorizontal, Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react"
import * as yup from "yup"
import { portalApi } from "@/lib/portal/client"
import type { ShoppingListRow } from "@/lib/portal/server"
import { swalConfirm, swalToast } from "@/lib/swal"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { ListsEmptyIllustration } from "@/components/shared/animated-illustrations"
import { usePortalStore } from "@/stores/portal-store"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const listSchema = yup.object({
  name: yup.string().trim().required("Escribe un nombre para la lista").max(80, "Máximo 80 caracteres"),
  notes: yup.string().max(300, "Máximo 300 caracteres"),
})

export function ListsClient() {
  const router = useRouter()
  const [lists, setLists] = useState<ShoppingListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)
  const [notesError, setNotesError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try { setError(null); setLists((await portalApi.lists()).lists) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron cargar las listas") }
  }, [])
  useEffect(() => { void load() }, [load])

  const openForm = (list?: ShoppingListRow) => {
    setEditingId(list?.id ?? null)
    setName(list?.name ?? "")
    setNotes(list?.notes ?? "")
    setNameError(null)
    setNotesError(null)
    setFormError(null)
    setFormOpen(true)
    requestAnimationFrame(() => nameRef.current?.focus())
  }

  const saveForm = async (event: React.FormEvent) => {
    event.preventDefault()
    setNameError(null); setNotesError(null); setFormError(null)
    try { await listSchema.validate({ name, notes }, { abortEarly: false }) }
    catch (cause) {
      if (cause instanceof yup.ValidationError) {
        for (const issue of cause.inner.length ? cause.inner : [cause]) {
          if (issue.path === "name") setNameError(issue.message)
          if (issue.path === "notes") setNotesError(issue.message)
        }
        if (cause.inner.some((issue) => issue.path === "name") || cause.path === "name") nameRef.current?.focus()
      }
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const detail = await portalApi.list(editingId)
        await portalApi.updateList(editingId, {
          name: name.trim(), notes: notes.trim() || null,
          items: detail.list.items.map((item) => ({ variantId: item.variantId, productId: item.variantId ? null : item.productId, unitId: item.unitId, quantity: item.quantity })),
        })
        setLists((current) => current?.map((list) => list.id === editingId ? { ...list, name: name.trim(), notes: notes.trim() || null } : list) ?? null)
        swalToast("Lista actualizada")
      } else {
        const created = await portalApi.createList({ name: name.trim(), notes: notes.trim() || null, items: [] })
        swalToast("Lista creada")
        router.push(`/portal/lists/${created.list.id}`)
      }
      setFormOpen(false)
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "No se pudo guardar la lista") }
    finally { setSaving(false) }
  }

  const duplicate = async (id: string) => {
    try {
      const result = await portalApi.duplicateList(id)
      setLists((current) => current ? [{ id: result.list.id, name: result.list.name, notes: result.list.notes, itemsCount: result.list.items.length, createdAt: result.list.createdAt }, ...current] : current)
      swalToast("Lista duplicada")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo duplicar la lista") }
  }

  const remove = async (id: string) => {
    if (!await swalConfirm("Eliminar lista", "¿Seguro que quieres eliminar esta lista?", { danger: true })) return
    try { await portalApi.deleteList(id); setLists((current) => current?.filter((list) => list.id !== id) ?? null); swalToast("Lista eliminada", "info") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo eliminar la lista") }
  }

  const addAllToCart = async (listId: string) => {
    try {
      const [res, storefront] = await Promise.all([portalApi.list(listId), portalApi.storefront()])
      usePortalStore.getState().setStorefront(storefront.categories, storefront.products)
      let added = 0, limited = 0, skipped = 0
      for (const item of res.list.items) {
        const product = storefront.products.find((candidate) => candidate.productId === item.productId)
        if (!product?.isAvailable) { skipped++; continue }
        if (!item.variantId && item.unitId && product.bulk) {
          const unit = item.unitId === product.bulk.unitId ? { unitId: product.bulk.unitId, unitName: product.bulk.unitName, unitAbbrev: product.bulk.unitAbbrev, price: product.bulk.price } : product.bulk.split?.unitId === item.unitId ? product.bulk.split : null
          if (!unit) { skipped++; continue }
          const result = usePortalStore.getState().addBulk(product, { qty: item.quantity, unitId: unit.unitId, unitName: unit.unitName, unitAbbrev: unit.unitAbbrev, pricePerUnit: unit.price })
          if (result.added > 0) { added++; if (result.limited) limited++ } else skipped++
        } else {
          const variant = product.variants.find((candidate) => candidate.id === item.variantId)
          if (!variant?.isAvailable) { skipped++; continue }
          const result = usePortalStore.getState().addStandard(product, variant, item.quantity)
          if (result.added > 0) { added++; if (result.limited) limited++ } else skipped++
        }
      }
      if (!added) { swalToast("No hay productos disponibles para agregar", "info"); return }
      if (limited || skipped) {
        setError(`${limited ? `${limited} producto${limited === 1 ? "" : "s"} ajustado${limited === 1 ? "" : "s"} al stock disponible. ` : ""}${skipped ? `${skipped} producto${skipped === 1 ? "" : "s"} no disponible${skipped === 1 ? "" : "s"}.` : ""}`)
      } else {
        setError(null)
      }
      usePortalStore.getState().setCartOpen(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo agregar la lista al carrito") }
  }

  return <div className="space-y-4 p-4">
    <header className="flex items-center justify-between gap-3"><div><h1 className="text-xl font-bold">Mis listas</h1><p className="text-sm text-muted-foreground">Organiza compras habituales y repítelas en un toque.</p></div><Button className="h-11 shrink-0" onClick={() => openForm()}><Plus className="size-4" /> Nueva lista</Button></header>
    {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error} <button type="button" className="font-semibold underline" onClick={() => void load()}>Reintentar</button></div>}
    {!lists ? <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div> : lists.length === 0 ? <div className="space-y-4"><EmptyState icon={ListChecks} illustration={ListsEmptyIllustration} title="Todavía no tienes listas" description="Crea una lista para guardar los productos que compras con frecuencia." /><Button className="w-full h-11" onClick={() => openForm()}><Plus className="size-4" /> Crear mi primera lista</Button></div> : <div className="space-y-3">{lists.map((list) => <article key={list.id} className="rounded-2xl border bg-card p-4">
      <Link href={`/portal/lists/${list.id}`} className="flex items-start gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-primary"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ListChecks className="size-5" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{list.name}</strong><span className="text-xs text-muted-foreground">{list.itemsCount} producto{list.itemsCount === 1 ? "" : "s"}</span>{list.notes && <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{list.notes}</span>}</span></Link>
      <div className="mt-3 flex items-center gap-2 border-t pt-3"><Button variant="secondary" className="h-11 flex-1" disabled={!list.itemsCount} onClick={() => void addAllToCart(list.id)}><ShoppingCart className="size-4" /> Comprar lista</Button><Button variant="outline" size="icon" className="size-11" aria-label={`Editar ${list.name}`} onClick={() => openForm(list)}><Pencil className="size-4" /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="size-11" aria-label={`Más opciones para ${list.name}`}><MoreHorizontal className="size-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="min-h-11" onSelect={() => void duplicate(list.id)}><Copy className="size-4" /> Duplicar</DropdownMenuItem><DropdownMenuItem variant="destructive" className="min-h-11" onSelect={() => void remove(list.id)}><Trash2 className="size-4" /> Eliminar</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
    </article>)}</div>}

    <DialogComponent open={formOpen} onOpenChange={setFormOpen} title={editingId ? "Editar lista" : "Nueva lista"} description="Ponle un nombre fácil de reconocer. Después podrás añadir productos y cantidades." icon={<ListChecks className="size-5" />} size="sm" footer={<><Button variant="outline" type="button" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" form="shopping-list-form" disabled={saving}>{saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear lista"}</Button></>}>
      <form id="shopping-list-form" onSubmit={saveForm} noValidate className="space-y-4 py-2"><InputGroupField ref={nameRef} id="shopping-list-name" label="Nombre de la lista" required leftIcon={<ListChecks className="size-4" />} placeholder="Ej. Despensa semanal" value={name} error={nameError ?? undefined} onChange={(event) => { setName(event.target.value); setNameError(null) }} /><div className="space-y-2"><label htmlFor="shopping-list-notes" className="flex items-center gap-2 text-sm font-medium"><Pencil className="size-4 text-muted-foreground" /> Notas (opcional)</label><Textarea id="shopping-list-notes" rows={3} maxLength={300} placeholder="Ej. Comprar para el fin de semana" value={notes} aria-invalid={Boolean(notesError)} onChange={(event) => { setNotes(event.target.value); setNotesError(null) }} />{notesError && <p className="text-xs text-destructive">{notesError}</p>}</div>{formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}</form>
    </DialogComponent>
  </div>
}
