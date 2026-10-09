"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import { Check, Loader2, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { swalError } from "@/lib/swal"
import { cn } from "@/lib/utils"

interface Business {
  id: string
  name: string
  businessMode: string
  logoUrl: string | null
  city: string | null
  hue: number | null
  joined: boolean
  customerCode: string | null
}

/** Elegir (o unirse a) un negocio: cada uno conserva su propio historial, puntos y crédito. */
export function BusinessesClient({ activeOrganizationId, name }: { activeOrganizationId: string | null; name: string }) {
  const router = useRouter()
  const { update } = useSession()
  const [rows, setRows] = useState<Business[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/portal/businesses", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRows(d.businesses ?? []))
      .catch(() => setRows([]))
  }, [])

  const enter = async (b: Business) => {
    setBusy(b.id)
    try {
      if (!b.joined) {
        const res = await fetch("/api/portal/businesses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: b.id }),
        })
        const data = (await res.json()) as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo unir al negocio")
      }
      await update({ activeOrganizationId: b.id })
      router.replace("/portal")
      router.refresh()
    } catch (e) {
      swalError("No se pudo entrar al negocio", e instanceof Error ? e.message : undefined)
      setBusy(null)
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl space-y-5 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="space-y-1 pt-4">
        <p className="text-sm text-muted-foreground">{name ? `Hola, ${name.split(" ")[0]}` : "Bienvenido"}</p>
        <h1 className="text-2xl font-bold">¿A qué negocio quieres comprar?</h1>
        <p className="text-sm text-muted-foreground">Tu cuenta sirve para todos. En cada negocio llevas tus propios pedidos, puntos, crédito, listas y favoritos.</p>
      </header>

      {rows === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Store} title="Aún no hay negocios disponibles" description="Vuelve más tarde." />
      ) : (
        <ul className="space-y-3">
          {rows.map((b, i) => (
            <motion.li key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void enter(b)}
                className={cn(
                  "flex min-h-24 w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left transition active:scale-[0.99]",
                  b.id === activeOrganizationId ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"
                )}
              >
                <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
                  {b.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Store className="size-6 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{b.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {b.joined ? `Cliente ${b.customerCode ?? ""}`.trim() : "Aún no eres cliente · te registramos al entrar"}
                    {b.city ? ` · ${b.city}` : ""}
                  </span>
                </span>
                {busy === b.id ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : b.id === activeOrganizationId ? (
                  <Check className="size-5 text-primary" />
                ) : (
                  <span className="text-sm font-medium text-primary">{b.joined ? "Entrar" : "Unirme"}</span>
                )}
              </button>
            </motion.li>
          ))}
        </ul>
      )}
      {activeOrganizationId && (
        <Button variant="ghost" className="w-full" onClick={() => router.push("/portal")}>
          Volver a la tienda
        </Button>
      )}
    </main>
  )
}
