"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCheck,
  CheckCircle2,
  CircleDot,
  Clock,
  MessageSquarePlus,
  Package,
  PackageCheck,
  Play,
  ScanLine,
  StickyNote,
  UserRound,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ThumbImage } from "@/components/base/thumb-image"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { playSound } from "@/lib/sounds"
import { cn } from "@/lib/utils"
import { ORDER_STATUS_LABELS, ordersApi } from "@/lib/orders/client"
import type { PreparationView } from "@/lib/orders/server"

// FASE 12.3 — Página de preparación de pedido: timer, checklist, progreso, notas.

function useNow(startedAtMs: number | null, running: boolean) {
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    if (!running || !startedAtMs) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running, startedAtMs])
  return now
}

function formatElapsed(s: number): string {
  const hours = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = Math.floor(s % 60)
  return [hours, mins, secs].map((v) => String(v).padStart(2, "0")).join(":")
}

export function OrderPrepare({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [prep, setPrep] = useState<PreparationView | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState("")
  const [generalNotes, setGeneralNotes] = useState("")
  const scanRef = useRef<HTMLInputElement>(null)

  const startedMs = prep?.startedAt ? new Date(prep.startedAt).getTime() : null
  const running = Boolean(prep && !prep.completedAt && prep.startedAt)
  const now = useNow(startedMs, running)
  const elapsedSecs = prep?.startedAt
    ? prep.completedAt
      ? (prep.elapsedSeconds ??
        Math.round(
          (new Date(prep.completedAt).getTime() -
            new Date(prep.startedAt).getTime()) /
            1000
        ))
      : Math.round((now - new Date(prep.startedAt).getTime()) / 1000)
    : 0

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await ordersApi.preparation(orderId)
      setPrep(r.prep)
    } catch {
      setPrep(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    load()
  }, [load])

  const foundCount = prep?.items.filter((i) => i.found).length ?? 0
  const totalItems = prep?.items.length ?? 0
  const progress =
    totalItems > 0 ? Math.round((foundCount / totalItems) * 100) : 0

  const start = async () => {
    setBusy(true)
    try {
      const r = await ordersApi.startPreparation(orderId)
      setPrep(r.prep)
      swalToast("Preparación iniciada")
      setTimeout(() => scanRef.current?.focus(), 100)
    } catch (err) {
      swalError(
        "No se pudo iniciar",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setBusy(false)
    }
  }

  const toggleFound = async (item: PreparationView["items"][number]) => {
    const next = !item.found
    setPrep((p) =>
      p
        ? {
            ...p,
            items: p.items.map((i) =>
              i.id === item.id ? { ...i, found: next, scanned: true } : i
            ),
          }
        : p
    )
    try {
      const r = await ordersApi.setPreparationItem(orderId, item.id, {
        found: next,
        scanned: true,
      })
      setPrep((p) =>
        p
          ? { ...p, items: p.items.map((i) => (i.id === item.id ? r.item : i)) }
          : p
      )
    } catch (err) {
      swalError(
        "No se pudo actualizar",
        err instanceof Error ? err.message : undefined
      )
    }
  }

  const saveNotes = async (
    item: PreparationView["items"][number],
    notes: string | null
  ) => {
    setPrep((p) =>
      p
        ? {
            ...p,
            items: p.items.map((i) => (i.id === item.id ? { ...i, notes } : i)),
          }
        : p
    )
    try {
      await ordersApi.setPreparationItem(orderId, item.id, { notes })
    } catch {
      // silencioso
    }
  }

  const submitScan = () => {
    const q = scan.trim().toLowerCase()
    if (!q || !prep) return
    const target = prep.items.find(
      (i) =>
        !i.found &&
        (i.productName.toLowerCase().includes(q) ||
          (i.variantName ?? "").toLowerCase().includes(q))
    )
    if (target) {
      playSound("scan")
      toggleFound(target)
      swalToast(`Encontrado: ${target.productName}`)
    } else {
      playSound("error")
      swalError(
        "Sin coincidencia",
        "Escribe el nombre del producto o su variante."
      )
    }
    setScan("")
  }

  const complete = async () => {
    // Se puede avanzar sin marcar todo, pero se confirma para que no sea un descuido.
    const unchecked = prep ? prep.items.filter((i) => !i.found).length : 0
    if (prep && unchecked > 0) {
      const none = unchecked === prep.items.length
      const ok = await swalConfirm(
        none ? "¿Completar sin marcar ningún artículo?" : `Faltan ${unchecked} artículo${unchecked === 1 ? "" : "s"} por marcar`,
        none
          ? "No marcaste ningún artículo como encontrado o surtido. Si continúas, la preparación se completa tal cual."
          : "Si continúas, la preparación se completa con esos artículos sin marcar.",
        { confirmText: "Sí, completar", icon: "warning" }
      )
      if (!ok) return
    }
    setBusy(true)
    try {
      const r = await ordersApi.completePreparation(
        orderId,
        generalNotes || undefined
      )
      setPrep(r.prep)
      swalToast("Preparación completada")
    } catch (err) {
      swalError(
        "No se pudo completar",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setBusy(false)
    }
  }

  const markReady = async () => {
    setBusy(true)
    try {
      await ordersApi.updateStatus(orderId, "ready", "Listo para entrega")
      swalToast("Pedido marcado como listo")
      router.push("/admin/orders")
    } catch (err) {
      swalError(
        "No se pudo marcar",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setBusy(false)
    }
  }

  const markAll = async () => {
    if (!prep) return
    for (const item of prep.items.filter((i) => !i.found)) await toggleFound(item)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    )
  }

  if (!prep) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <PackageCheck className="size-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">Preparación no iniciada</p>
            <p className="text-sm text-muted-foreground">
              Inicia la preparación para comenzar el timer y el check-list.
            </p>
          </div>
          <Button onClick={start} disabled={busy} size="lg">
            <Play className="size-4" /> Iniciar preparación
          </Button>
        </CardContent>
      </Card>
    )
  }

  const done = Boolean(prep.completedAt)
  const pending = prep.items.filter((i) => !i.found)
  // Primero lo que falta por surtir; lo ya surtido baja.
  const ordered = [...prep.items].sort((a, b) => Number(a.found) - Number(b.found))

  return (
    <div className="space-y-4 pb-28 md:pb-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/orders")}>
          <ArrowLeft className="size-4" /> Pedidos
        </Button>
      </div>

      {/* Encabezado fijo: pedido, tiempo y avance siempre a la vista */}
      <section
        aria-label="Avance del surtido"
        className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-3 border-b bg-background/95 px-3 py-3 backdrop-blur-md sm:-mx-4 sm:px-4 md:mx-0 md:rounded-2xl md:border"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <PackageCheck className="size-5 text-primary" /> Pedido #{prep.orderNumber}
          </h1>
          <Badge variant="outline">
            {ORDER_STATUS_LABELS[prep.status as keyof typeof ORDER_STATUS_LABELS] ?? prep.status}
          </Badge>
          <span className={cn("ml-auto flex items-center gap-1.5 text-sm font-semibold tabular-nums", !done && "text-primary")}>
            <Clock className="size-4" /> {formatElapsed(elapsedSecs)}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Progress value={progress} className="h-2.5 flex-1" />
          <span className="text-sm font-semibold tabular-nums">
            {foundCount}/{totalItems}
          </span>
        </div>
        {(prep.employeeName || prep.generalNotes) && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {prep.employeeName && (
              <span className="flex items-center gap-1">
                <UserRound className="size-3.5" /> {prep.employeeName}
              </span>
            )}
            {prep.generalNotes && <span>{prep.generalNotes}</span>}
          </p>
        )}
      </section>

      {!done && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <ScanLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={scanRef}
              placeholder="Escanea o escribe el producto y Enter"
              className="pl-9"
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  submitScan()
                }
              }}
            />
          </div>
          {pending.length > 1 && (
            <Button variant="outline" onClick={() => void markAll()} className="shrink-0">
              <CheckCheck className="size-4" /> <span className="hidden sm:inline">Marcar todo</span>
            </Button>
          )}
        </div>
      )}

      {/* Artículos: foto grande, cantidad, tópicos y nota del cliente; un toque los marca */}
      <ul className="grid gap-3 md:grid-cols-2">
        {ordered.map((item) => {
          const variant = item.variantName && item.variantName !== "Default" && item.productName !== item.variantName ? item.variantName : null
          return (
            <li
              key={item.id}
              className={cn(
                "overflow-hidden rounded-2xl border bg-card transition-colors",
                item.found ? "border-success/40 bg-success/5" : "shadow-e1"
              )}
            >
              <button
                type="button"
                disabled={done}
                aria-pressed={item.found}
                aria-label={`${item.found ? "Desmarcar" : "Marcar como surtido"}: ${item.productName}`}
                onClick={() => toggleFound(item)}
                className="flex w-full items-stretch gap-3 p-3 text-left disabled:cursor-default"
              >
                <span className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-28">
                  {item.imageUrl ? (
                    <ThumbImage src={item.imageUrl} alt="" className={cn("size-full object-cover", item.found && "opacity-50")} />
                  ) : (
                    <span className="flex size-full items-center justify-center text-muted-foreground/50">
                      <Package className="size-8" />
                    </span>
                  )}
                  <span className="absolute bottom-1 left-1 rounded-lg bg-foreground px-2 py-0.5 text-sm font-bold tabular-nums text-background">
                    ×{item.bulkQuantityDisplay ? item.bulkQuantityDisplay : item.quantity}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
                  <span className="min-w-0">
                    <span className={cn("block text-base leading-snug font-semibold", item.found && "text-muted-foreground line-through")}>
                      {item.productName}
                    </span>
                    {variant && <span className="block text-sm text-muted-foreground">{variant}</span>}
                    {item.options.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {item.options.map((o, i) => (
                          <span key={i} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                            {o.name ? `${o.name}: ` : ""}
                            {o.value}
                          </span>
                        ))}
                      </span>
                    )}
                    {item.comment && (
                      <span className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-warning/15 px-2 py-1 text-sm font-medium">
                        <StickyNote className="mt-0.5 size-3.5 shrink-0 text-warning-ink" />
                        {item.comment}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-1.5 self-start rounded-xl px-3 text-sm font-semibold",
                      item.found ? "bg-success text-success-foreground" : "border border-dashed text-muted-foreground"
                    )}
                  >
                    {item.found ? (
                      <>
                        <CheckCircle2 className="size-4" /> Surtido
                      </>
                    ) : (
                      <>
                        <CircleDot className="size-4" /> Toca para marcar
                      </>
                    )}
                  </span>
                </span>
              </button>
              {!done ? (
                <details className="border-t px-3 py-2 text-sm">
                  <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-muted-foreground [&::-webkit-details-marker]:hidden">
                    <MessageSquarePlus className="size-4" /> {item.notes ? "Tu comentario" : "Agregar comentario"}
                  </summary>
                  <Textarea
                    className="mt-2 text-base md:text-sm"
                    rows={2}
                    placeholder="Comentario del empleado (opcional)"
                    value={item.notes ?? ""}
                    onChange={(e) => saveNotes(item, e.target.value || null)}
                  />
                </details>
              ) : (
                item.notes && <p className="border-t px-3 py-2 text-xs text-muted-foreground">Comentario: “{item.notes}”</p>
              )}
            </li>
          )
        })}
      </ul>

      {/* Acciones: fijas abajo en teléfono para no perderlas al desplazarse */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md max-md:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-md:pb-3 md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        {!done ? (
          <div className="mx-auto flex max-w-5xl flex-col gap-2 md:max-w-none">
            <Textarea
              placeholder="Observación general (opcional)"
              rows={1}
              className="hidden md:block"
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="hidden sm:inline-flex" onClick={() => router.push("/admin/orders")}>
                Volver
              </Button>
              <Button onClick={complete} disabled={busy} size="lg" className="h-12 flex-1 text-base sm:flex-none">
                {busy ? "Guardando…" : pending.length > 0 ? `Completar (${foundCount}/${totalItems})` : "Completar preparación"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-5xl justify-end md:max-w-none">
            <Button onClick={markReady} disabled={busy || prep.status === "ready"} size="lg" className="h-12 flex-1 text-base sm:flex-none">
              {busy ? "Guardando…" : "Marcar pedido como listo"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
