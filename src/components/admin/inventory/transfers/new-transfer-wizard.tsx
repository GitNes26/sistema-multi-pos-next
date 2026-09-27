"use client"

import { TransferFlow } from "./transfer-flow"
import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowDownUp, ArrowLeft, ArrowRight, Building2, Package, Search, Send, Store, Trash2, Warehouse } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { QuantityStepper } from "@/components/base/quantity-stepper"
import { WizardSteps } from "@/components/base/wizard-steps"
import { DateTimePicker } from "@/components/base/date-time-picker"
import { ThumbImage } from "@/components/base/thumb-image"
import { crudApi, inventoryApi, type InventoryRow } from "@/lib/api"
import { transfersApi, type PlaceType } from "@/lib/inventory/transfers-client"
import { swalError, swalToast } from "@/lib/swal"
import { cn } from "@/lib/utils"

interface Place {
  id: string
  type: PlaceType
  name: string
}

const STEPS = [
  { title: "Ruta", hint: "Elige de dónde sale la mercancía y a dónde llega." },
  { title: "Productos", hint: "Busca en las existencias del origen y define cuánto enviar." },
  { title: "Confirmar", hint: "Revisa el resumen. El stock sale del origen hasta que el traslado se despache." },
]

const PLACE_ICON = { location: Store, cedis: Warehouse } as const

function PlacePicker({ label, value, onPick, exclude, places }: { label: string; value: Place | null; onPick: (p: Place) => void; exclude?: Place | null; places: Place[] }) {
return (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="grid gap-2 sm:grid-cols-2">
      {places.map((p) => {
        const Icon = PLACE_ICON[p.type]
        const selected = value?.id === p.id && value.type === p.type
        const disabled = exclude?.id === p.id && exclude.type === p.type
        return (
          <button
            key={`${p.type}-${p.id}`}
            type="button"
            disabled={disabled}
            onClick={() => onPick(p)}
            aria-pressed={selected}
            className={cn(
              "press flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-40",
              selected ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:border-primary/40"
            )}
          >
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.type === "cedis" ? "CEDIS" : "Sucursal"}</span>
            </span>
          </button>
        )
      })}
    </div>
  </div>
)
}

/** Asistente para solicitar un traslado. `preset` abre con origen y producto ya elegidos. */
export function NewTransferWizard({
  open,
  onOpenChange,
  onCreated,
  preset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
  preset?: { fromType: PlaceType; fromId: string; inventoryId?: string }
}) {
  const [step, setStep] = useState(0)
  const [places, setPlaces] = useState<Place[]>([])
  const [from, setFrom] = useState<Place | null>(null)
  const [to, setTo] = useState<Place | null>(null)
  const [stock, setStock] = useState<InventoryRow[]>([])
  const [loadingStock, setLoadingStock] = useState(false)
  const [q, setQ] = useState("")
  const [cart, setCart] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState("")
  const [expectedAt, setExpectedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)

  // Ubicaciones (sucursales + CEDIS) al abrir.
  useEffect(() => {
    if (!open) return
    setStep(0)
    setCart({})
    setNotes("")
    setExpectedAt(null)
    setQ("")
    Promise.all([crudApi.list("locations", { pageSize: 250 }), crudApi.list("cedis", { pageSize: 250 })])
      .then(([l, c]) => {
        const all: Place[] = [
          ...l.rows.filter((r) => r.isActive !== false).map((r) => ({ id: String(r.id), type: "location" as const, name: String(r.name) })),
          ...c.rows.filter((r) => r.isActive !== false).map((r) => ({ id: String(r.id), type: "cedis" as const, name: String(r.name) })),
        ]
        setPlaces(all)
        const presetFrom = preset ? all.find((p) => p.id === preset.fromId) : undefined
        setFrom(presetFrom ?? null)
        setTo(null)
        if (presetFrom) setStep(presetFrom ? 0 : 0)
      })
      .catch(() => swalError("No se pudieron cargar las ubicaciones"))
  }, [open, preset])

  // Existencias del origen.
  useEffect(() => {
    if (!from) return
    setLoadingStock(true)
    inventoryApi
      .snapshot({ locationType: from.type, locationId: from.id })
      .then((r) => {
        setStock(r.rows)
        if (preset?.inventoryId && r.rows.some((x) => x.id === preset.inventoryId)) setCart((c) => (Object.keys(c).length ? c : { [preset.inventoryId!]: 1 }))
      })
      .catch(() => setStock([]))
      .finally(() => setLoadingStock(false))
  }, [from, preset])

  const byId = useMemo(() => new Map(stock.map((s) => [s.id, s])), [stock])
  const lines = Object.entries(cart).filter(([, q]) => q > 0)
  const units = lines.reduce((s, [, q]) => s + q, 0)
  const filtered = stock
    .filter((s) => s.quantity > 0)
    .filter((s) => !q || `${s.productName} ${s.variantName ?? ""} ${s.sku ?? ""}`.toLowerCase().includes(q.toLowerCase()))

  const canNext = step === 0 ? Boolean(from && to && !(from.id === to.id && from.type === to.type)) : step === 1 ? lines.length > 0 : true

  const swap = () => {
    setFrom(to)
    setTo(from)
    setCart({})
  }

  const submit = async () => {
    if (!from || !to) return
    setSaving(true)
    try {
      const res = await transfersApi.create({
        fromLocationType: from.type,
        fromLocationId: from.id,
        toLocationType: to.type,
        toLocationId: to.id,
        items: lines.map(([inventoryId, quantity]) => ({ inventoryId, quantity })),
        notes: notes || undefined,
        expectedAt: expectedAt ? expectedAt.toISOString() : null,
      })
      swalToast(`Traslado ${res.folio} solicitado`)
      onOpenChange(false)
      onCreated(res.id)
    } catch (err) {
      swalError("No se pudo crear el traslado", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<Building2 className="size-4 text-primary" />}
      title="Nuevo traslado"
      description="Mueve mercancía entre sucursales y CEDIS con seguimiento de salida, camino y recepción."
      size="lg"
      bodyClassName="space-y-4"
      footer={
        <>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              <ArrowLeft className="size-4" /> Atrás
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continuar <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={saving}>
              <Send className="size-4" /> {saving ? "Solicitando…" : "Solicitar traslado"}
            </Button>
          )}
        </>
      }
    >
      <WizardSteps steps={STEPS} current={step} onStepClick={setStep} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {step === 0 && (
            <>
              <PlacePicker label="¿De dónde sale?" value={from} onPick={(p) => { setFrom(p); setCart({}) }} exclude={to} places={places} />
              <div className="flex justify-center">
                <Button type="button" variant="outline" size="sm" onClick={swap} disabled={!from && !to}>
                  <ArrowDownUp className="size-4" /> Invertir ruta
                </Button>
              </div>
              <PlacePicker label="¿A dónde llega?" value={to} onPick={setTo} exclude={from} places={places} />
              {places.length < 2 && (
                <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning-ink">
                  Necesitas al menos dos ubicaciones activas (sucursales o CEDIS) para hacer un traslado.
                </p>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <InputGroupField
                placeholder={`Buscar en ${from?.name ?? "el origen"}…`}
                leftIcon={<Search className="size-4" />}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                {loadingStock && <p className="py-6 text-center text-sm text-muted-foreground">Cargando existencias…</p>}
                {!loadingStock && filtered.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No hay productos con existencia en el origen.</p>
                )}
                {filtered.map((s) => {
                  const qty = cart[s.id] ?? 0
                  return (
                    <div key={s.id} className={cn("flex items-center gap-3 rounded-xl border p-2.5 transition-colors", qty > 0 && "border-primary/50 bg-primary/5")}>
                      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                        {s.productImage ? <ThumbImage src={s.productImage} alt="" className="size-full object-cover" /> : <Package className="size-5 text-muted-foreground" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.productName}{s.variantName && s.variantName !== "Default" ? ` · ${s.variantName}` : ""}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">Disponible: {s.quantity} {s.unit ?? "pza"}</p>
                      </div>
                      {qty === 0 ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => setCart((c) => ({ ...c, [s.id]: Math.min(1, s.quantity) }))}>
                          Agregar
                        </Button>
                      ) : (
                        <QuantityStepper
                          size="sm"
                          value={qty}
                          max={s.quantity}
                          decimals={s.productType === "bulk" ? 3 : 0}
                          onChange={(v) => setCart((c) => ({ ...c, [s.id]: v }))}
                          ariaLabel={`Cantidad de ${s.productName}`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                {lines.length === 0 ? "Aún no agregas productos." : <><strong className="text-foreground">{lines.length}</strong> productos · <strong className="text-foreground tabular-nums">{units}</strong> unidades</>}
              </p>
            </>
          )}

          {step === 2 && from && to && (
            <>
              <div className="rounded-2xl border bg-muted/40 p-4">
                <TransferFlow status="in_transit" from={{ name: from.name, type: from.type }} to={{ name: to.name, type: to.type }} sent={units} received={null} />
              </div>
              <ul className="divide-y rounded-xl border">
                {lines.map(([id, qty]) => {
                  const s = byId.get(id)
                  if (!s) return null
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="truncate">{s.productName}{s.variantName && s.variantName !== "Default" ? ` · ${s.variantName}` : ""}</span>
                      <span className="flex items-center gap-2">
                        <strong className="tabular-nums">{qty} {s.unit ?? "pza"}</strong>
                        <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar" onClick={() => setCart((c) => ({ ...c, [id]: 0 }))}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </span>
                    </li>
                  )
                })}
              </ul>
              <div className="space-y-3">
                <DateTimePicker label="Llegada estimada (opcional)" value={expectedAt} onChange={setExpectedAt} />
                <div className="space-y-1.5">
                  <Label htmlFor="transfer-notes">Notas para quien prepara</Label>
                  <Textarea id="transfer-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. empacar refrigerados aparte" />
                </div>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </DialogComponent>
  )
}
