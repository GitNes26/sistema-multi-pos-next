"use client"

import { useEffect, useRef, useState } from "react"
import { LocateFixed, Loader2, MapPin, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Info {
  folio: string
  status: string
  fromName: string
  toName: string
  toAddress: string | null
  driverName: string | null
}

const INTERVAL_MS = 15_000

export function ShareLocation({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [state, setState] = useState<"idle" | "active" | "denied" | "waiting">("idle")
  const [lastSent, setLastSent] = useState<number | null>(null)
  const watch = useRef<number | null>(null)
  const last = useRef(0)

  useEffect(() => {
    fetch(`/api/public/transfers/${token}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.ok ? setInfo(d.transfer) : setError(d.error ?? "Enlace inválido")))
      .catch(() => setError("No se pudo cargar el traslado"))
  }, [token])

  useEffect(() => {
    if (!sharing) return
    if (!navigator.geolocation) {
      setState("denied")
      return
    }
    setState("waiting")
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setState("active")
        const now = Date.now()
        if (now - last.current < INTERVAL_MS) return
        last.current = now
        fetch(`/api/public/transfers/${token}/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.ok) {
              setLastSent(Date.now())
              setError(null)
            } else setError(d.error ?? null)
          })
          .catch(() => undefined)
      },
      () => setState("denied"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    )
    return () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current)
      watch.current = null
    }
  }, [sharing, token])

  if (error && !info) {
    return <main className="grid min-h-dvh place-items-center p-6 text-center text-muted-foreground">{error}</main>
  }
  if (!info) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <Loader2 className="size-6 animate-spin" />
      </main>
    )
  }
  const done = info.status === "received" || info.status === "cancelled"

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Truck className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold">Traslado {info.folio}</h1>
          <p className="text-sm text-muted-foreground">{info.driverName ? `Chofer: ${info.driverName}` : "Comparte tu ubicación"}</p>
        </div>
      </header>

      <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
        <p className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" /> <span className="text-muted-foreground">Sale de</span> <b>{info.fromName}</b>
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" /> <span className="text-muted-foreground">Llega a</span> <b>{info.toName}</b>
        </p>
        {info.toAddress && <p className="pl-6 text-xs text-muted-foreground">{info.toAddress}</p>}
      </section>

      {done ? (
        <p className="rounded-2xl bg-muted p-4 text-center text-sm">Este traslado ya terminó. Gracias.</p>
      ) : (
        <>
          <Button className="h-16 gap-2 rounded-2xl text-base" variant={sharing ? "outline" : "default"} onClick={() => setSharing((v) => !v)}>
            <LocateFixed className="size-5" /> {sharing ? "Dejar de compartir" : "Compartir mi ubicación"}
          </Button>
          {sharing && (
            <p role="status" className="text-center text-sm text-muted-foreground">
              {state === "waiting" && "Buscando tu ubicación…"}
              {state === "active" && (lastSent ? `Ubicación enviada a las ${new Date(lastSent).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : "Enviando…")}
              {state === "denied" && "No pudimos usar tu ubicación. Activa el permiso del navegador."}
            </p>
          )}
          {error && <p className="text-center text-xs text-warning-ink">{error}</p>}
          <p className="text-center text-xs text-muted-foreground">Mantén esta pantalla abierta mientras llevas el traslado.</p>
        </>
      )}
    </main>
  )
}
