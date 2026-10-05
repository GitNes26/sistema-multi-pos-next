"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Home, MapPin, MapPinned, Pencil, Plus, Trash2 } from "lucide-react"
import { portalApi } from "@/lib/portal/client"
import type { CustomerAddressView } from "@/lib/portal/server"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { BackButton } from "@/components/shared/back-button"
import { EmptyState } from "@/components/shared/empty-state"
import { useAddressSuggestions } from "@/components/shared/use-address-suggestions"
import type { PickedAddress } from "@/components/shared/address-map-picker"

const AddressMapPicker = dynamic(() => import("@/components/shared/address-map-picker").then((m) => m.AddressMapPicker), { ssr: false })

interface Draft {
  id?: string
  label: string
  address: string
  notes: string
  latitude: number | null
  longitude: number | null
}

const EMPTY: Draft = { label: "", address: "", notes: "", latitude: null, longitude: null }

/** Destinos guardados del cliente: ver, agregar, editar (nombre, dirección, referencias y pin) y quitar. */
export function AddressesClient() {
  const [rows, setRows] = useState<CustomerAddressView[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ label?: string; address?: string }>({})
  const { suggestions, searching, clear, pick } = useAddressSuggestions(query, Boolean(draft), draft?.latitude != null && draft.longitude != null ? { lat: draft.latitude, lon: draft.longitude } : null)

  useEffect(() => {
    portalApi
      .addresses()
      .then((r) => setRows(r.addresses))
      .catch((e) => {
        setRows([])
        swalError("No se pudieron cargar tus direcciones", e instanceof Error ? e.message : undefined)
      })
  }, [])

  const open = (row?: CustomerAddressView) => {
    setErrors({})
    setQuery("")
    setDraft(row ? { id: row.id, label: row.label, address: row.address, notes: row.notes ?? "", latitude: row.latitude, longitude: row.longitude } : { ...EMPTY })
  }

  const applyPick = (v: PickedAddress) =>
    setDraft((d) => (d ? { ...d, address: v.address || d.address, latitude: v.lat, longitude: v.lon } : d))

  const choose = async (i: number) => {
    const res = await pick(i)
    clear()
    setQuery("")
    if (res) applyPick(res)
  }

  const save = async () => {
    if (!draft) return
    const next: typeof errors = {}
    if (!draft.label.trim()) next.label = "Ponle un nombre (Casa, Oficina…)"
    if (!draft.address.trim()) next.address = "Busca o escribe la dirección"
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const body = { label: draft.label, address: draft.address, notes: draft.notes || null, latitude: draft.latitude, longitude: draft.longitude }
      const res = draft.id ? await portalApi.updateAddress(draft.id, body) : await portalApi.addAddress(body)
      setRows((prev) => (draft.id ? (prev ?? []).map((r) => (r.id === draft.id ? res.address : r)) : [...(prev ?? []), res.address]))
      setDraft(null)
      swalToast(draft.id ? "Dirección actualizada" : "Dirección guardada")
    } catch (e) {
      swalError("No se pudo guardar", e instanceof Error ? e.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: CustomerAddressView) => {
    if (!(await swalConfirm("Eliminar dirección", `«${row.label}» ya no aparecerá al pedir a domicilio.`, { danger: true, confirmText: "Eliminar" }))) return
    try {
      await portalApi.removeAddress(row.id)
      setRows((prev) => (prev ?? []).filter((r) => r.id !== row.id))
    } catch (e) {
      swalError("No se pudo eliminar", e instanceof Error ? e.message : undefined)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-1">
        <BackButton fallback="/portal/profile" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">Mis direcciones</h1>
          <p className="text-sm text-muted-foreground">Se ofrecen al pedir a domicilio para no escribirlas cada vez.</p>
        </div>
        <Button className="h-11" onClick={() => open()}>
          <Plus className="size-4" /> Nueva
        </Button>
      </div>

      {rows === null ? (
        <div className="space-y-2">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={MapPin} title="Aún no tienes direcciones guardadas" description="Guarda tu casa u oficina y elige la ubicación exacta en el mapa." action={<Button className="h-12" onClick={() => open()}><Plus className="size-4" /> Agregar dirección</Button>} />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
              <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Home className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.label}</p>
                <p className="text-sm leading-snug text-muted-foreground">{r.address}</p>
                {r.notes && <p className="mt-1 text-xs text-warning-ink">Referencias: {r.notes}</p>}
                <p className={r.latitude != null ? "mt-1 text-xs text-success-ink" : "mt-1 text-xs text-warning-ink"}>
                  {r.latitude != null ? "Con ubicación en el mapa" : "Sin ubicación: ábrela en el mapa para fijar el pin"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col">
                <Button variant="ghost" size="icon" aria-label={`Editar ${r.label}`} onClick={() => open(r)}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" aria-label={`Eliminar ${r.label}`} onClick={() => void remove(r)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DialogComponent
        open={Boolean(draft)}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Editar dirección" : "Nueva dirección"}
        description="Busca la dirección o ubícala en el mapa; agrega referencias para el repartidor."
        icon={<MapPin className="size-5" />}
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </>
        }
      >
        {draft && (
          <>
            <InputGroupField id="addr-label" label="Nombre" required placeholder="Casa, Oficina, Casa de mis padres…" value={draft.label} error={errors.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            <div className="relative">
              <InputGroupField id="addr-search" type="search" label="Buscar dirección" placeholder="Buscar calle, número y colonia" value={query} onChange={(e) => setQuery(e.target.value)} />
              {(suggestions.length > 0 || searching) && (
                <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg" role="listbox">
                  {searching && suggestions.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Buscando…</li>}
                  {suggestions.map((s, i) => (
                    <li key={`${s.description}-${i}`}>
                      <button type="button" role="option" aria-selected={false} onClick={() => void choose(i)} className="flex min-h-12 w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="line-clamp-2">{s.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-address">Dirección <span className="text-destructive">*</span></Label>
              <Textarea id="addr-address" rows={2} value={draft.address} aria-invalid={Boolean(errors.address)} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
              {errors.address && <p role="alert" className="text-xs text-destructive">{errors.address}</p>}
            </div>
            <Button type="button" variant="outline" className="h-12 w-full" onClick={() => setMapOpen(true)}>
              <MapPinned className="size-4" /> {draft.latitude != null ? "Confirmar o ajustar el pin en el mapa" : "Ubicar en el mapa"}
            </Button>
            <div className="space-y-1.5">
              <Label htmlFor="addr-notes">Referencias (opcional)</Label>
              <Textarea id="addr-notes" rows={2} maxLength={200} placeholder="Portón negro, entre calle X y Y, timbre 2…" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          </>
        )}
      </DialogComponent>

      <AddressMapPicker
        open={mapOpen}
        initial={draft?.latitude != null && draft.longitude != null ? { lat: draft.latitude, lon: draft.longitude } : null}
        onClose={() => setMapOpen(false)}
        onConfirm={(v) => {
          setMapOpen(false)
          applyPick(v)
        }}
      />
    </div>
  )
}
