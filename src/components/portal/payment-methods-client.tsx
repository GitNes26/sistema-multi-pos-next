"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, CreditCard, Hash, Plus, Star, Trash2, TriangleAlert, Wallet } from "lucide-react"
import { portalApi } from "@/lib/portal/client"
import type { ExpiringCardView, PaymentMethodView } from "@/lib/portal/server"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { InputGroupField } from "@/components/base/input-group-field"
import { BottomSheet } from "@/components/portal/bottom-sheet"
import { cn } from "@/lib/utils"

const CARD_COLORS = [
  "#1a1a2e",
  "#0f3460",
  "#e94560",
  "#533483",
  "#2b9348",
  "#f77f00",
  "#7209b7",
  "#3a86ff",
]

function CardView({ m, onSetDefault, onRemove }: {
  m: PaymentMethodView
  onSetDefault: () => void
  onRemove: () => void
}) {
  const colorIdx = (m.last4 ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % CARD_COLORS.length
  const color = (m as unknown as Record<string, string>).color ?? CARD_COLORS[colorIdx]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, x: -50 }}
      whileTap={{ scale: 0.98 }}
      className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg"
      style={{ backgroundColor: color }}
    >
      {/* Decorative circles */}
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-4 -left-4 size-16 rounded-full bg-white/5" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            {m.alias && <p className="text-xs font-medium opacity-80">{m.alias}</p>}
            <p className="mt-1 text-lg font-bold tracking-wider">
              •••• •••• •••• {m.last4}
            </p>
          </div>
          {m.isDefault && (
            <Badge className="bg-white/20 text-white text-[10px] border-0">Predeterminada</Badge>
          )}
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase opacity-60">Expira</p>
            <p className="text-sm font-semibold">
              {String(m.expMonth).padStart(2, "0")}/{m.expYear}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <p className="text-[10px] uppercase opacity-60 mr-1">{m.brand || "CARD"}</p>
            <button
              onClick={onSetDefault}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                m.isDefault ? "bg-white/20" : "bg-white/10 hover:bg-white/20"
              )}
              aria-label="Predeterminada"
            >
              <Star className={cn("size-4", m.isDefault && "fill-current")} />
            </button>
            <button
              onClick={onRemove}
              className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20 transition-colors"
              aria-label="Eliminar"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function PaymentMethodsClient() {
  const [methods, setMethods] = useState<PaymentMethodView[] | null>(null)
  const [expiring, setExpiring] = useState<ExpiringCardView[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ alias: "", brand: "", last4: "", expMonth: "", expYear: "", isDefault: false, color: CARD_COLORS[0] })

  const load = () => {
    portalApi.paymentMethods().then((d) => setMethods(d.methods)).catch(() => undefined)
    portalApi.expiringCards().then((d) => setExpiring(d.cards)).catch(() => undefined)
  }

  useEffect(() => { load() }, [])

  const add = async () => {
    if (!/^\d{4}$/.test(form.last4)) {
      swalError("Los últimos 4 dígitos son inválidos")
      return
    }
    try {
      const res = await portalApi.addPaymentMethod({
        alias: form.alias,
        brand: form.brand || "card",
        last4: form.last4,
        expMonth: Number(form.expMonth),
        expYear: Number(form.expYear),
        isDefault: form.isDefault,
      })
      setMethods(res.methods)
      setShowForm(false)
      setForm({ alias: "", brand: "", last4: "", expMonth: "", expYear: "", isDefault: false, color: CARD_COLORS[0] })
      swalToast("Tarjeta agregada")
    } catch (err) {
      swalError("No se pudo agregar", err instanceof Error ? err.message : undefined)
    }
  }

  const remove = async (id: string) => {
    const ok = await swalConfirm("Eliminar tarjeta", "¿Seguro?", { danger: true })
    if (!ok) return
    try {
      await portalApi.removePaymentMethod(id)
      setMethods((prev) => (prev ? prev.filter((m) => m.id !== id) : prev))
      swalToast("Tarjeta eliminada", "info")
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined)
    }
  }

  const setDefault = async (id: string) => {
    try {
      const res = await portalApi.setDefaultPaymentMethod(id)
      setMethods(res.methods)
      swalToast("Tarjeta predeterminada")
    } catch (err) {
      swalError("Error", err instanceof Error ? err.message : undefined)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Métodos de pago</h1>
        <Button size="sm" className="rounded-xl" onClick={() => setShowForm(true)}>
          <Plus className="size-4" /> Agregar
        </Button>
      </div>

      {expiring.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-700">Por vencer</p>
            {expiring.map((c) => (
              <p key={c.id} className="text-xs text-amber-700/80">
                {c.alias ? `${c.alias} — ` : ""}•••• {c.last4} ({c.expMonth}/{c.expYear})
              </p>
            ))}
          </div>
        </motion.div>
      )}

      {!methods ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : methods.length === 0 ? (
        <div className="py-16 text-center">
          <CreditCard className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">No tienes tarjetas guardadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {methods.map((m) => (
              <CardView
                key={m.id}
                m={m}
                onSetDefault={() => setDefault(m.id)}
                onRemove={() => remove(m.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <BottomSheet open={showForm} onOpenChange={setShowForm} title="Agregar tarjeta">
        <div className="space-y-3">
          <InputGroupField label="Alias" leftIcon={<Wallet className="size-4" />} placeholder="Mi tarjeta" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
          <InputGroupField label="Marca" leftIcon={<CreditCard className="size-4" />} placeholder="Visa, MC…" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          <InputGroupField label="Últimos 4 dígitos" inputMode="numeric" leftIcon={<Hash className="size-4" />} maxLength={4} placeholder="4242" value={form.last4} onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
          <div className="grid grid-cols-2 gap-3">
            <InputGroupField label="Mes" type="number" min={1} max={12} leftIcon={<Calendar className="size-4" />} placeholder="MM" value={form.expMonth} onChange={(e) => setForm({ ...form, expMonth: e.target.value })} />
            <InputGroupField label="Año" type="number" leftIcon={<Calendar className="size-4" />} placeholder="YYYY" value={form.expYear} onChange={(e) => setForm({ ...form, expYear: e.target.value })} />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Color de la tarjeta</p>
            <div className="flex gap-2">
              {CARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={cn(
                    "size-8 rounded-full border-2 transition-all",
                    form.color === c ? "border-white scale-110 shadow-lg" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="size-4 rounded" />
            Predeterminada
          </label>

          <Button className="w-full h-11 rounded-xl font-semibold" onClick={add}>Guardar tarjeta</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
