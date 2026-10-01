"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, Building2, Check, FileText, Loader2, Pencil, Plus, Search, Star, Trash2, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DialogComponent } from "@/components/ui/dialog"
import { WizardSteps } from "@/components/base/wizard-steps"
import { QuantityStepper } from "@/components/base/quantity-stepper"
import { InputGroupField } from "@/components/base/input-group-field"
import { FormCombobox } from "@/components/base/form-combobox"
import { DatePicker } from "@/components/base/date-picker"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { PurchasingProduct, PurchasingSupplier } from "./purchasing-page"

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })

export interface QuoteLine {
  key: string
  productId: string
  variantId: string | null
  description: string
  quantity: number
  supplierId: string
  unitCost: number
}

export interface QuoteGroup {
  supplierId: string
  validUntil: string
  notes: string
  items: { productId: string; variantId: string | null; description: string; quantity: number; unitCost: number; taxRate: number }[]
}

/**
 * Solicitud de cotización en tres pasos:
 *  1) Productos y cantidades · 2) Proveedor de cada producto (con su precio
 *  unitario) · 3) Resumen con formato de solicitud de compra, para finalizar o
 *  volver a editar. Se genera una cotización por proveedor.
 */
export function QuoteRequestWizard({
  open,
  close,
  saving,
  error,
  suppliers,
  products,
  onFinish,
}: {
  open: boolean
  close: () => void
  saving: boolean
  error: string | null
  suppliers: PurchasingSupplier[]
  products: PurchasingProduct[]
  onFinish: (groups: QuoteGroup[]) => void
}) {
  const [step, setStep] = React.useState(0)
  const [lines, setLines] = React.useState<QuoteLine[]>([])
  const [validUntil, setValidUntil] = React.useState("")
  const [notes, setNotes] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setStep(0)
      setLines([])
      setValidUntil("")
      setNotes("")
    }
  }, [open])

  const active = suppliers.filter((s) => s.isActive)
  const linkOf = (supplierId: string, line: Pick<QuoteLine, "productId" | "variantId">) =>
    suppliers.find((s) => s.id === supplierId)?.products.find((p) => p.productId === line.productId && (p.variantId ?? "") === (line.variantId ?? ""))
  /** Proveedores con el producto vinculado, preferido primero y luego el más barato. */
  const linkedSuppliers = (line: QuoteLine) =>
    active
      .map((s) => ({ supplier: s, link: linkOf(s.id, line) }))
      .filter((x) => x.link)
      .sort((a, b) => Number(b.link!.isPreferred) - Number(a.link!.isPreferred) || a.link!.unitCost - b.link!.unitCost)

  const options = products
    .flatMap((p) =>
      p.variants.length
        ? p.variants.map((v) => ({ value: `${p.id}|${v.id}`, label: `${p.name}${v.name !== "Default" ? ` · ${v.name}` : ""}`, meta: v.sku ?? "" }))
        : [{ value: `${p.id}|`, label: p.name, meta: "" }]
    )
    .filter((o) => !lines.some((l) => `${l.productId}|${l.variantId ?? ""}` === o.value))

  const addProduct = (value: string) => {
    const [productId, variantId] = value.split("|")
    const product = products.find((p) => p.id === productId)
    const variant = product?.variants.find((v) => v.id === variantId)
    if (!product) return
    const base: QuoteLine = {
      key: crypto.randomUUID(),
      productId,
      variantId: variantId || null,
      description: `${product.name}${variant && variant.name !== "Default" ? ` · ${variant.name}` : ""}`,
      quantity: 1,
      supplierId: "",
      unitCost: Number(variant?.cost ?? 0),
    }
    setLines((v) => [...v, base])
  }
  const update = (key: string, patch: Partial<QuoteLine>) => setLines((v) => v.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  // Al pasar al paso 2, cada producto sin proveedor toma el preferido (o el más barato).
  const goToSuppliers = () => {
    setLines((current) =>
      current.map((l) => {
        if (l.supplierId) return l
        const best = linkedSuppliers(l)[0]
        return best ? { ...l, supplierId: best.supplier.id, unitCost: best.link!.unitCost, quantity: Math.max(l.quantity, best.link!.minimumOrder) } : l
      })
    )
    setStep(1)
  }
  const pickSupplier = (line: QuoteLine, supplierId: string) => {
    const link = linkOf(supplierId, line)
    update(line.key, { supplierId, unitCost: link ? link.unitCost : line.unitCost })
  }

  const groups = React.useMemo(() => {
    const map = new Map<string, QuoteLine[]>()
    for (const l of lines) if (l.supplierId) map.set(l.supplierId, [...(map.get(l.supplierId) ?? []), l])
    return [...map].map(([supplierId, items]) => ({ supplier: suppliers.find((s) => s.id === supplierId)!, items }))
  }, [lines, suppliers])

  const grandTotal = lines.reduce((a, l) => a + l.quantity * l.unitCost, 0)
  const valid =
    step === 0
      ? lines.length > 0 && lines.every((l) => l.quantity > 0)
      : step === 1
        ? lines.every((l) => l.supplierId && l.unitCost >= 0)
        : true

  const steps = [
    { title: "Productos", hint: "¿Qué necesitas y cuánto de cada uno?" },
    { title: "Proveedores", hint: "Elige a quién se lo pides; verás el precio unitario de cada proveedor vinculado." },
    { title: "Resumen", hint: "Así quedará la solicitud para cada proveedor. Finaliza o vuelve a editar." },
  ]

  const finish = () =>
    onFinish(
      groups.map((g) => ({
        supplierId: g.supplier.id,
        validUntil,
        notes,
        items: g.items.map((l) => ({ productId: l.productId, variantId: l.variantId, description: l.description, quantity: l.quantity, unitCost: l.unitCost, taxRate: 0 })),
      }))
    )

  return (
    <DialogComponent
      open={open}
      onOpenChange={(v) => !v && close()}
      title="Nueva solicitud de cotización"
      description="Elige los productos, asigna proveedor a cada uno y revisa el documento antes de finalizar."
      icon={<FileText />}
      size="3xl"
      bodyClassName="space-y-4"
      footer={
        <>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              {step === 2 ? <Pencil /> : <ArrowLeft />} {step === 2 ? "Editar" : "Atrás"}
            </Button>
          ) : (
            <Button variant="outline" onClick={close}>Cancelar</Button>
          )}
          {step === 0 && (
            <Button onClick={goToSuppliers} disabled={!valid}>
              Continuar <ArrowRight />
            </Button>
          )}
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!valid}>
              Ver resumen <ArrowRight />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={finish} disabled={saving || groups.length === 0}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              Finalizar{groups.length > 1 ? ` (${groups.length} solicitudes)` : ""}
            </Button>
          )}
        </>
      }
    >
      <WizardSteps steps={steps} current={step} onStepClick={(i) => (i < step ? setStep(i) : undefined)} />
      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      {step === 0 && (
        <div className="space-y-4">
          <FormCombobox
            id="quote-add-product"
            label="Busca y agrega productos"
            icon={<Search />}
            options={options}
            value=""
            onChange={addProduct}
            placeholder="Nombre o SKU…"
          />
          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Aún no agregas productos.</p>
          ) : (
            <ul className="space-y-2">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                  <strong className="min-w-0 flex-1 truncate text-sm">{l.description}</strong>
                  <QuantityStepper size="sm" value={l.quantity} min={0} decimals={3} onChange={(quantity) => update(l.key, { quantity })} ariaLabel={`Cantidad de ${l.description}`} />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar" onClick={() => setLines((v) => v.filter((x) => x.key !== l.key))}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 1 && (
        <ul className="space-y-3">
          {lines.map((l) => {
            const linked = linkedSuppliers(l)
            const chosen = linkOf(l.supplierId, l)
            const lowest = linked.length ? Math.min(...linked.map((x) => x.link!.unitCost)) : null
            const others = active.filter((s) => !linked.some((x) => x.supplier.id === s.id))
            return (
              <li key={l.key} className="space-y-2 rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <span>
                    <strong className="text-sm">{l.description}</strong>
                    <span className="block text-xs text-muted-foreground">{l.quantity} por solicitar</span>
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    <span className="block text-xs text-muted-foreground">Importe</span>
                    <strong>{money.format(l.quantity * l.unitCost)}</strong>
                  </span>
                </div>

                {linked.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={`Proveedor de ${l.description}`}>
                    {linked.map(({ supplier, link }) => {
                      const selected = l.supplierId === supplier.id
                      return (
                        <button
                          key={supplier.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => pickSupplier(l, supplier.id)}
                          className={cn("press rounded-xl border p-2.5 text-left transition-colors", selected ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:border-primary/40")}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <Building2 className={cn("size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                              <span className="truncate text-sm font-medium">{supplier.businessName}</span>
                              {link!.isPreferred && <Star className="size-3.5 shrink-0 fill-warning text-warning" aria-label="Proveedor preferido" />}
                            </span>
                            <span className="text-sm font-semibold tabular-nums">{money.format(link!.unitCost)}</span>
                          </span>
                          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                            <span>precio unitario</span>
                            {link!.unitCost === lowest && linked.length > 1 && <span className="font-medium text-success-ink">el más bajo</span>}
                            {link!.minimumOrder > 1 && <span>mín. {link!.minimumOrder}</span>}
                            {(link!.leadTimeDays ?? supplier.leadTimeDays) > 0 && <span>entrega {link!.leadTimeDays ?? supplier.leadTimeDays} d</span>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-ink">Ningún proveedor tiene vinculado este producto. Elige uno y captura el precio que te dio.</p>
                )}

                {(linked.length === 0 || others.length > 0) && (
                  <div className="flex flex-wrap items-end gap-3">
                    <FormCombobox
                      id={`other-${l.key}`}
                      label={linked.length ? "O pídeselo a otro proveedor" : "Proveedor"}
                      options={(linked.length ? others : active).map((s) => ({ value: s.id, label: s.businessName, meta: s.code }))}
                      value={linked.length && linked.some((x) => x.supplier.id === l.supplierId) ? "" : l.supplierId}
                      onChange={(v) => v && pickSupplier(l, v)}
                      placeholder="Elegir proveedor…"
                      className="min-w-52 flex-1"
                    />
                    {!chosen && l.supplierId && (
                      <InputGroupField
                        id={`price-${l.key}`}
                        label="Precio unitario"
                        type="number"
                        min={0}
                        step="0.01"
                        leftIcon={<DollarSign />}
                        value={l.unitCost}
                        onChange={(e) => update(l.key, { unitCost: Number(e.target.value) })}
                        className="w-36"
                      />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <DatePicker
              id="quote-valid"
              label="¿Hasta cuándo necesitas la respuesta?"
              value={validUntil ? new Date(`${validUntil}T12:00:00`) : null}
              onChange={(d) => setValidUntil(d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "")}
              disabledBefore={new Date()}
              clearable
            />
            <div className="space-y-2">
              <Label htmlFor="quote-notes">Notas y condiciones</Label>
              <Textarea id="quote-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. entregar en horario de 8 a 12" />
            </div>
          </div>

          {groups.map((g, index) => {
            const subtotal = g.items.reduce((a, l) => a + l.quantity * l.unitCost, 0)
            return (
              <article key={g.supplier.id} className="overflow-hidden rounded-xl border bg-card text-sm">
                <header className="flex flex-wrap items-start justify-between gap-2 border-b bg-muted/40 p-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Solicitud de cotización {groups.length > 1 ? `· ${index + 1} de ${groups.length}` : ""}</p>
                    <p className="text-base font-semibold">{g.supplier.businessName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[g.supplier.contactName, g.supplier.phone, g.supplier.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                    </p>
                  </div>
                  <dl className="text-right text-xs">
                    <div><dt className="inline text-muted-foreground">Fecha: </dt><dd className="inline font-medium">{new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</dd></div>
                    <div><dt className="inline text-muted-foreground">Respuesta antes de: </dt><dd className="inline font-medium">{validUntil ? new Date(`${validUntil}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" }) : "Sin fecha"}</dd></div>
                  </dl>
                </header>
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Cant.</th>
                      <th className="px-2 py-2 font-medium">Descripción</th>
                      <th className="px-2 py-2 text-right font-medium">P. unit.</th>
                      <th className="px-4 py-2 text-right font-medium">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((l) => (
                      <tr key={l.key} className="border-b last:border-0">
                        <td className="px-4 py-2 tabular-nums">{l.quantity}</td>
                        <td className="px-2 py-2">{l.description}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{money.format(l.unitCost)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{money.format(l.quantity * l.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <footer className="flex items-center justify-between border-t bg-muted/30 px-4 py-3">
                  <span className="text-xs text-muted-foreground">{g.items.length} partida{g.items.length === 1 ? "" : "s"} · precios antes de IVA</span>
                  <span className="text-base font-semibold tabular-nums">Total estimado {money.format(subtotal)}</span>
                </footer>
              </article>
            )
          })}
          {groups.length > 1 && (
            <p className="text-right text-sm text-muted-foreground">
              Se enviarán {groups.length} solicitudes · total estimado <strong className="text-foreground tabular-nums">{money.format(grandTotal)}</strong>
            </p>
          )}
          <p className="text-xs text-muted-foreground"><Plus className="mr-1 inline size-3" />¿Falta algo? Usa «Editar» para volver y ajustar productos, cantidades o proveedores.</p>
        </div>
      )}
    </DialogComponent>
  )
}
