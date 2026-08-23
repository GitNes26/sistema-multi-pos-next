"use client"

import React, { useEffect, useState, useRef } from "react"
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
import { SwipeableRow } from "@/components/shared/swipeable-row"
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

const BRAND_LOGOS: Record<string, { label: string; svg: React.ReactNode }> = {
  visa: {
    label: "VISA",
    svg: (
      <svg viewBox="0 0 48 32" className="h-5 w-auto">
        <rect width="48" height="32" rx="4" fill="#1a1f71" />
        <text x="24" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="sans-serif">VISA</text>
      </svg>
    ),
  },
  mastercard: {
    label: "MC",
    svg: (
      <svg viewBox="0 0 48 32" className="h-5 w-auto">
        <rect width="48" height="32" rx="4" fill="#252525" />
        <circle cx="19" cy="16" r="8" fill="#eb001b" />
        <circle cx="29" cy="16" r="8" fill="#f79e1b" />
        <path d="M24 10.5a8 8 0 010 11" fill="#ff5f00" />
      </svg>
    ),
  },
}

function CardView({ m, onSetDefault, onRemove }: {
  m: PaymentMethodView
  onSetDefault: () => void
  onRemove: () => void
}) {
  const colorIdx = (m.last4 ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % CARD_COLORS.length
  const color = m.color ?? CARD_COLORS[colorIdx]
  const brandKey = (m.brand ?? "").toLowerCase().replace(/\s/g, "")
  const isVisa = brandKey.includes("visa")
  const isMC = brandKey.includes("master") || brandKey === "mc"
  const brandLogo = isVisa ? BRAND_LOGOS.visa : isMC ? BRAND_LOGOS.mastercard : null

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
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-4 -left-4 size-16 rounded-full bg-white/5" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {m.alias && (
              <p className="text-sm font-bold tracking-wide opacity-95">{m.alias}</p>
            )}
            <p className="mt-2 text-lg font-bold tracking-wider">
              •••• •••• •••• {m.last4}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {brandLogo && brandLogo.svg}
            {m.isDefault && (
              <Badge className="bg-white/20 text-white text-[10px] border-0">Predeterminada</Badge>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase opacity-60">Expira</p>
            <p className="text-sm font-semibold">
              {String(m.expMonth).padStart(2, "0")}/{m.expYear}
            </p>
          </div>
          <div className="flex items-center gap-1">
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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const monthRef = useRef<HTMLInputElement>(null)
  const yearRef = useRef<HTMLInputElement>(null)

  const load = () => {
    portalApi.paymentMethods().then((d) => setMethods(d.methods)).catch(() => undefined)
    portalApi.expiringCards().then((d) => setExpiring(d.cards)).catch(() => undefined)
  }

  useEffect(() => { load() }, [])

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.alias.trim()) e.alias = "El alias es obligatorio"
    else if (methods?.some((m) => m.alias?.toLowerCase() === form.alias.trim().toLowerCase())) e.alias = "Ya existe una tarjeta con ese alias"
    if (!form.brand.trim()) e.brand = "La marca es obligatoria"
    if (!/^\d{4}$/.test(form.last4)) e.last4 = "Solo 4 dígitos"
    if (!form.expMonth || Number(form.expMonth) < 1 || Number(form.expMonth) > 12) e.expMonth = "Mes inválido (1-12)"
    if (!form.expYear || form.expYear.length !== 4) e.expYear = "Año inválido (4 dígitos)"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const add = async () => {
    if (!validate()) return
    try {
      const res = await portalApi.addPaymentMethod({
        alias: form.alias.trim(),
        brand: form.brand.trim(),
        last4: form.last4,
        expMonth: Number(form.expMonth),
        expYear: Number(form.expYear),
        isDefault: form.isDefault,
        color: form.color,
      })
      setMethods(res.methods)
      setShowForm(false)
      setForm({ alias: "", brand: "", last4: "", expMonth: "", expYear: "", isDefault: false, color: CARD_COLORS[0] })
      setErrors({})
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
        <Button size="sm" className="rounded-xl" onClick={() => { setShowForm(true); setErrors({}) }}>
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
              <SwipeableRow key={m.id} onDelete={() => remove(m.id)}>
                <CardView
                  m={m}
                  onSetDefault={() => setDefault(m.id)}
                  onRemove={() => remove(m.id)}
                />
              </SwipeableRow>
            ))}
          </AnimatePresence>
        </div>
      )}

      <BottomSheet open={showForm} onOpenChange={setShowForm} title="Agregar tarjeta">
        <div className="space-y-4">
          <InputGroupField
            label="Alias *"
            leftIcon={<Wallet className="size-4" />}
            placeholder="Mi tarjeta"
            value={form.alias}
            error={errors.alias}
            onChange={(e) => setForm({ ...form, alias: e.target.value })}
          />
          <InputGroupField
            label="Marca *"
            leftIcon={<CreditCard className="size-4" />}
            placeholder="Visa, Mastercard…"
            value={form.brand}
            error={errors.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
          />

          {/* Brand quick select */}
          <div className="flex gap-2">
            {Object.entries(BRAND_LOGOS).map(([key, b]) => (
              <button
                key={key}
                type="button"
                onClick={() => setForm({ ...form, brand: b.label })}
                className={cn(
                  "rounded-lg border-2 p-2 transition-all",
                  form.brand.toLowerCase().includes(key) || form.brand.toLowerCase() === b.label.toLowerCase()
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                {b.svg}
              </button>
            ))}
          </div>

          <InputGroupField
            label="Últimos 4 dígitos *"
            inputMode="numeric"
            leftIcon={<Hash className="size-4" />}
            maxLength={4}
            placeholder="4242"
            value={form.last4}
            error={errors.last4}
            onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          />

          <div className="grid grid-cols-2 gap-3">
            <InputGroupField
              ref={monthRef}
              label="Mes *"
              inputMode="numeric"
              leftIcon={<Calendar className="size-4" />}
              placeholder="MM"
              maxLength={2}
              value={form.expMonth}
              error={errors.expMonth}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 2)
                setForm({ ...form, expMonth: v })
                if (v.length === 2) yearRef.current?.focus()
              }}
            />
            <InputGroupField
              ref={yearRef}
              label="Año *"
              inputMode="numeric"
              leftIcon={<Calendar className="size-4" />}
              placeholder="YYYY"
              maxLength={4}
              value={form.expYear}
              error={errors.expYear}
              onChange={(e) => setForm({ ...form, expYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
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
                    form.color === c ? "border-white scale-110 shadow-lg ring-2 ring-primary" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="relative">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="peer sr-only"
              />
              <div className="size-5 rounded-md border-2 border-muted-foreground/30 transition-colors peer-checked:border-primary peer-checked:bg-primary" />
              <svg className="absolute left-0.5 top-0.5 size-4 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium">Predeterminada</p>
              <p className="text-xs text-muted-foreground">Se usará para pagos rápidos</p>
            </div>
          </label>

          <Button className="w-full h-12 rounded-xl font-semibold text-base" onClick={add}>Guardar tarjeta</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
