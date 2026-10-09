"use client"

import { useCallback, useEffect, useState } from "react"
import { Armchair, ClipboardList, Loader2, Plus, QrCode, ShoppingBag } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { usePosStore, ticketContextKey } from "@/stores/pos-store"
import { fetchOpenAccounts, startNewTakeaway, switchTicket, type OpenAccount, type QrCart } from "@/lib/pos/tickets"
import { money } from "@/lib/pos/money"
import { swalToast } from "@/lib/swal"
import { cn } from "@/lib/utils"

/**
 * Cuentas abiertas del local: el cajero o host alterna entre mesas y pedidos para llevar,
 * ve su consumo, agrega más o cobra. Lo enviado a cocina se recarga de la comanda; lo que
 * aún no se envía queda en pausa en este equipo.
 */
export function OpenAccounts({ refreshKey = 0 }: { refreshKey?: number }) {
  const locationId = usePosStore((s) => s.location.id)
  const held = usePosStore((s) => s.held)
  const currentKey = usePosStore((s) => ticketContextKey(s))
  const [accounts, setAccounts] = useState<OpenAccount[]>([])
  const [carts, setCarts] = useState<QrCart[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetchOpenAccounts(locationId || undefined)
    setAccounts(res.orders)
    setCarts(res.carts)
  }, [locationId])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 20_000)
    return () => clearInterval(t)
  }, [load, refreshKey])
  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const keyOf = (a: OpenAccount) => (a.table ? `table:${a.table.id}` : `take:${a.id}`)
  const drafts = Object.values(held).filter((h) => !accounts.some((a) => keyOf(a) === h.key))
  const count = accounts.length + drafts.length + carts.filter((c) => !accounts.some((a) => a.table?.id === c.tableId)).length

  const go = async (key: string, run: () => Promise<number>, label: string) => {
    setBusy(key)
    try {
      const n = await run()
      swalToast(n > 0 ? `${label}: cuenta cargada (${n} ${n === 1 ? "artículo" : "artículos"})` : label, "info")
      setOpen(false)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-11 w-full justify-between gap-2 desk:h-10" aria-label="Cuentas abiertas">
          <span className="flex items-center gap-2">
            <ClipboardList className="size-4" /> Cuentas abiertas
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold tabular-nums", count ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {count}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] space-y-2 p-2">
        <p className="px-1 pt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Mesas y pedidos para llevar</p>
        {accounts.length === 0 && drafts.length === 0 && carts.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No hay cuentas abiertas.</p>
        )}
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {accounts.map((a) => {
            const key = keyOf(a)
            const here = key === currentKey
            return (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={busy !== null || here}
                  onClick={() =>
                    go(
                      key,
                      () => (a.table ? switchTicket({ type: "table", table: a.table }) : switchTicket({ type: "takeaway", orderId: a.id, orderNumber: a.orderNumber })),
                      a.table ? `Mesa ${a.table.number}` : `Para llevar #${a.orderNumber}`
                    )
                  }
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left transition",
                    here ? "border-primary bg-primary/5" : "hover:bg-muted"
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    {a.table ? <Armchair className="size-4" /> : <ShoppingBag className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {a.table ? `Mesa ${a.table.number}${a.table.name ? ` · ${a.table.name}` : ""}` : `Para llevar #${a.orderNumber}`}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {a.items} {a.items === 1 ? "artículo" : "artículos"} · {a.status === "ready" ? "lista" : "en cocina"}
                      {held[key] ? " · con cambios sin enviar" : ""}
                    </span>
                  </span>
                  {busy === key ? <Loader2 className="size-4 animate-spin" /> : <span className="text-sm font-semibold tabular-nums">{money(a.total)}</span>}
                </button>
              </li>
            )
          })}
          {carts
            .filter((c) => !accounts.some((a) => a.table?.id === c.tableId))
            .map((c) => (
              <li key={`cart-${c.tableId}`}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void go(`cart-${c.tableId}`, () => switchTicket({ type: "table", table: { id: c.tableId, number: c.number, name: c.name } }), `Mesa ${c.number}`)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-3 text-left hover:bg-primary/10"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <QrCode className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">Mesa {c.number} · carrito del cliente</span>
                    <span className="block text-xs text-muted-foreground">{c.count} {c.count === 1 ? "artículo" : "artículos"} armados desde el QR</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{money(c.total)}</span>
                </button>
              </li>
            ))}
          {drafts.map((h) => {
            const sep = h.key.indexOf(":")
            const kind = h.key.slice(0, sep)
            const id = h.key.slice(sep + 1)
            return (
              <li key={h.key}>
                <button
                  type="button"
                  disabled={busy !== null || h.key === currentKey}
                  onClick={() =>
                    void go(
                      h.key,
                      () =>
                        kind === "table"
                          ? switchTicket({ type: "table", table: { id, number: Number(h.label.replace(/\D/g, "")) || 0, name: null } })
                          : switchTicket({ type: "takeaway", orderId: kind === "take" ? id : null }),
                      h.label
                    )
                  }
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-dashed px-3 text-left hover:bg-muted"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning-ink">
                    <ClipboardList className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{h.label}</span>
                    <span className="block text-xs text-muted-foreground">Borrador · {h.items.length} sin enviar</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <Button variant="secondary" className="h-11 w-full gap-2" disabled={busy !== null} onClick={() => void go("new", () => startNewTakeaway(), "Nuevo pedido para llevar")}>
          <Plus className="size-4" /> Nuevo pedido para llevar
        </Button>
      </PopoverContent>
    </Popover>
  )
}
