"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, Layers, Package, PiggyBank, Plus, Search, Sparkles, Tag, Trash2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { QuantityStepper } from "@/components/base/quantity-stepper"
import { WizardSteps } from "@/components/base/wizard-steps"
import { SwitchField } from "@/components/base/switch-field"
import { Attachment } from "@/components/base/attachment"
import { ThumbImage } from "@/components/base/thumb-image"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import { money } from "@/lib/pos/money"
import { swalError, swalToast } from "@/lib/swal"
import { cn } from "@/lib/utils"

export interface ComboWizardProduct {
  id: string
  name: string
  imageUrl?: string | null
  variants: { id: string; name: string; price: number }[]
}

export interface ComboWizardInitial {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  comboPrice: number
  isActive: boolean
  items: { productId: string; variantId?: string | null; quantity: number; extraPrice: number }[]
}

export interface ComboSavePayload {
  id?: string
  name: string
  description: string
  imageUrl: string
  comboPrice: number
  isActive: boolean
  items: { productId: string; variantId?: string; quantity: number; extraPrice: number }[]
}

interface Line {
  productId: string
  variantId: string
  quantity: number
  extraPrice: number
}

const STEPS = [
  { title: "¿Qué incluye?", hint: "Toca los productos que forman el combo y ajusta cuántos lleva de cada uno." },
  { title: "Precio", hint: "Compara contra lo que costaría comprar todo por separado y elige el precio especial." },
  { title: "Presentación", hint: "Así lo verán tus cajeros en el POS y tus clientes en el portal." },
]

const DISCOUNTS = [10, 15, 20, 25]
const variantLabel = (name: string) => (name === "Default" ? "" : name)

/** Asistente para crear/editar un combo, con vista previa en vivo. */
export function ComboWizard({
  open,
  onOpenChange,
  initial,
  products,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: ComboWizardInitial | null
  products: ComboWizardProduct[]
  onSave: (data: ComboSavePayload) => Promise<void>
}) {
  const [step, setStep] = useState(0)
  const [lines, setLines] = useState<Line[]>([])
  const [q, setQ] = useState("")
  const [price, setPrice] = useState(0)
  const [priceTouched, setPriceTouched] = useState(false)
  const [name, setName] = useState("")
  const [nameTouched, setNameTouched] = useState(false)
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(0)
    setQ("")
    setLines(
      (initial?.items ?? []).map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? products.find((p) => p.id === i.productId)?.variants[0]?.id ?? "",
        quantity: Number(i.quantity),
        extraPrice: Number(i.extraPrice ?? 0),
      }))
    )
    setPrice(Number(initial?.comboPrice ?? 0))
    setPriceTouched(Boolean(initial))
    setName(initial?.name ?? "")
    setNameTouched(Boolean(initial))
    setDescription(initial?.description ?? "")
    setImageUrl(initial?.imageUrl ?? null)
    setIsActive(initial?.isActive ?? true)
  }, [open, initial, products])

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const unitPrice = (l: Line) => {
    const p = byId.get(l.productId)
    return (p?.variants.find((v) => v.id === l.variantId)?.price ?? p?.variants[0]?.price ?? 0) + l.extraPrice
  }
  const regular = lines.reduce((s, l) => s + unitPrice(l) * l.quantity, 0)
  const savings = regular - price
  const savingsPct = regular > 0 ? (savings / regular) * 100 : 0

  // Nombre y precio sugeridos mientras el usuario no los escriba.
  const suggestedName = useMemo(() => {
    const names = lines.map((l) => byId.get(l.productId)?.name).filter(Boolean) as string[]
    if (names.length === 0) return ""
    return `Combo ${names.slice(0, 2).join(" + ")}${names.length > 2 ? " y más" : ""}`
  }, [lines, byId])
  useEffect(() => {
    if (!nameTouched) setName(suggestedName)
  }, [suggestedName, nameTouched])
  useEffect(() => {
    if (!priceTouched) setPrice(Math.max(0, Math.floor(regular * 0.9)))
  }, [regular, priceTouched])

  const add = (p: ComboWizardProduct) =>
    setLines((ls) => {
      const existing = ls.findIndex((l) => l.productId === p.id)
      if (existing >= 0) return ls.map((l, i) => (i === existing ? { ...l, quantity: l.quantity + 1 } : l))
      return [...ls, { productId: p.id, variantId: p.variants[0]?.id ?? "", quantity: 1, extraPrice: 0 }]
    })
  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const remove = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i))

  const filtered = products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 60)

  const problems = [
    step >= 0 && lines.length === 0 && "Agrega al menos un producto.",
    step >= 1 && price <= 0 && "El precio del combo debe ser mayor a $0.",
    step >= 2 && !name.trim() && "Escribe un nombre para el combo.",
  ].filter(Boolean) as string[]
  const stepValid = step === 0 ? lines.length > 0 : step === 1 ? price > 0 : Boolean(name.trim())

  const save = async () => {
    if (problems.length) return
    setSaving(true)
    try {
      await onSave({
        id: initial?.id,
        name: name.trim(),
        description: description.trim(),
        imageUrl: imageUrl ?? "",
        comboPrice: price,
        isActive,
        items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, quantity: l.quantity, extraPrice: l.extraPrice })),
      })
      swalToast(initial ? "Combo actualizado" : "Combo creado")
      onOpenChange(false)
    } catch (err) {
      swalError("No se pudo guardar el combo", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<Layers className="size-4 text-primary" />}
      title={initial ? "Editar combo" : "Nuevo combo"}
      description="Agrupa productos con un precio especial en 3 pasos."
      size="2xl"
      bodyClassName="space-y-4"
      dataGuide="combo-dialog"
      footer={
        <>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              <ArrowLeft className="size-4" /> Atrás
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          )}
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!stepValid}>
              Continuar <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={save} disabled={saving || !stepValid}>
              <Check className="size-4" /> {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear combo"}
            </Button>
          )}
        </>
      }
    >
      <WizardSteps steps={STEPS} current={step} onStepClick={setStep} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="min-w-0 space-y-4"
          >
            {step === 0 && (
              <>
                <InputGroupField placeholder="Buscar producto…" leftIcon={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} />
                <div className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {filtered.map((p) => {
                    const count = lines.find((l) => l.productId === p.id)?.quantity ?? 0
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => add(p)}
                        className={cn("press relative flex items-center gap-2 rounded-xl border p-2 text-left transition-colors", count ? "border-primary bg-primary/5" : "hover:border-primary/40")}
                      >
                        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                          {p.imageUrl ? <ThumbImage src={p.imageUrl} alt="" className="size-full object-cover" /> : <Package className="size-4 text-muted-foreground" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm leading-tight font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{money(p.variants[0]?.price ?? 0)}</span>
                        </span>
                        {count > 0 ? (
                          <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">{count}</span>
                        ) : (
                          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><Plus className="size-4" /></span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">En el combo ({lines.length})</Label>
                  {lines.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Toca un producto de arriba para agregarlo.</p>
                  ) : (
                    lines.map((l, i) => {
                      const p = byId.get(l.productId)
                      return (
                        <div key={`${l.productId}-${i}`} className="space-y-2 rounded-xl border bg-muted/30 p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{p?.name ?? "Producto"}</span>
                            <QuantityStepper size="sm" value={l.quantity} min={1} decimals={2} onChange={(v) => update(i, { quantity: v })} ariaLabel={`Cantidad de ${p?.name}`} />
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar" onClick={() => remove(i)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                          {(p?.variants.length ?? 0) > 1 && (
                            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Variante">
                              {p!.variants.map((v) => (
                                <button
                                  key={v.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={l.variantId === v.id}
                                  onClick={() => update(i, { variantId: v.id })}
                                  className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", l.variantId === v.id ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40")}
                                >
                                  {variantLabel(v.name) || "Normal"} · {money(v.price)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Comprado por separado cuesta</p>
                  <p className="font-heading text-2xl font-semibold tabular-nums">{money(regular)}</p>
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {lines.map((l, i) => (
                      <li key={i} className="flex justify-between tabular-nums">
                        <span className="truncate">{l.quantity}× {byId.get(l.productId)?.name}</span>
                        <span>{money(unitPrice(l) * l.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <InputGroupField
                  label="Precio del combo"
                  required
                  leftIcon={<Tag className="size-4" />}
                  type="number"
                  min={0}
                  step={1}
                  value={price}
                  onChange={(e) => {
                    setPriceTouched(true)
                    setPrice(Number(e.target.value) || 0)
                  }}
                  className="text-lg"
                />
                <div className="flex flex-wrap gap-2">
                  <span className="self-center text-xs text-muted-foreground">Atajos:</span>
                  {DISCOUNTS.map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPriceTouched(true)
                        setPrice(Math.floor(regular * (1 - d / 100)))
                      }}
                    >
                      −{d}%
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPriceTouched(true)
                      setPrice(Math.max(9, Math.floor(price / 10) * 10 - 1))
                    }}
                  >
                    Terminar en 9
                  </Button>
                </div>

                {savings > 0 ? (
                  <div className="space-y-2 rounded-2xl border border-success/30 bg-success/5 p-4">
                    <p className="flex items-center gap-2 font-semibold text-success-ink">
                      <PiggyBank className="size-5" /> El cliente ahorra {money(savings)} ({Math.round(savingsPct)}%)
                    </p>
                    <div className="h-2 overflow-hidden rounded-full bg-success/15">
                      <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${Math.min(100, savingsPct * 2)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {savingsPct < 5 ? "Un ahorro menor a 5% casi no se nota." : savingsPct > 35 ? "Ahorro muy alto: revisa que el combo siga dejando margen." : "Buen rango: atractivo para el cliente sin regalar el margen."}
                    </p>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning-ink">
                    <TriangleAlert className="size-4 shrink-0" /> Con este precio el cliente no ahorra nada; el combo pierde atractivo.
                  </p>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-1">
                  <InputGroupField
                    label="Nombre"
                    required
                    leftIcon={<Layers className="size-4" />}
                    value={name}
                    onChange={(e) => {
                      setNameTouched(true)
                      setName(e.target.value)
                    }}
                    placeholder="Ej. Combo Desayuno"
                  />
                  {!nameTouched && suggestedName && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="size-3.5" /> Nombre sugerido; puedes cambiarlo.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="combo-desc">Descripción corta</Label>
                  <Textarea id="combo-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Ideal para compartir en la comida" />
                </div>
                <div className="space-y-4">
                  <Attachment label="Foto" value={imageUrl} onChange={setImageUrl} upload={uploadFile} accept={UPLOAD_IMAGE_ACCEPT} widthClass="w-32" heightClass="h-32" />
                  <SwitchField
                    id="combo-active"
                    label="Disponible para vender"
                    description="Si lo apagas, se conserva pero no aparece en el POS ni en el portal."
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Vista previa: tarjeta tal como se verá al vender */}
        <aside className="space-y-2 lg:sticky lg:top-0 lg:self-start" aria-label="Vista previa">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Vista previa</p>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-e2">
            <div className="relative grid aspect-[4/3] place-items-center bg-muted">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex -space-x-3">
                  {lines.slice(0, 3).map((l, i) => {
                    const p = byId.get(l.productId)
                    return (
                      <span key={i} className="grid size-14 place-items-center overflow-hidden rounded-full border-2 border-card bg-background shadow">
                        {p?.imageUrl ? <ThumbImage src={p.imageUrl} alt="" className="size-full object-cover" /> : <Package className="size-5 text-muted-foreground" />}
                      </span>
                    )
                  })}
                  {lines.length === 0 && <Layers className="size-10 text-muted-foreground" />}
                </div>
              )}
              {savings > 0 && (
                <span className="absolute top-2 left-2 rounded-full bg-success px-2 py-0.5 text-xs font-bold text-success-foreground">Ahorra {Math.round(savingsPct)}%</span>
              )}
            </div>
            <div className="space-y-1 p-3">
              <p className="line-clamp-2 font-semibold leading-tight">{name || "Nombre del combo"}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {lines.length ? lines.map((l) => `${l.quantity}× ${byId.get(l.productId)?.name ?? ""}`).join(" · ") : "Sin productos todavía"}
              </p>
              <p className="flex items-baseline gap-2 pt-1">
                <span className="text-lg font-bold tabular-nums">{money(price)}</span>
                {savings > 0 && <span className="text-xs text-muted-foreground line-through tabular-nums">{money(regular)}</span>}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </DialogComponent>
  )
}
