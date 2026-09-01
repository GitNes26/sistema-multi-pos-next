"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Store, UtensilsCrossed, Wrench, Car, Layers } from "lucide-react"
import { WizardShell, type WizardStep } from "./wizard-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { swalError, swalLoading, swalClose } from "@/lib/swal"
import { cn } from "@/lib/utils"

type Mode = "retail" | "food_service" | "services" | "rental" | "hybrid"

const TYPES: { mode: Mode; label: string; desc: string; icon: React.ReactNode }[] = [
  { mode: "retail", label: "Tienda / Retail", desc: "Abarrotes, ferreterías, minisuper…", icon: <Store className="size-7" /> },
  { mode: "food_service", label: "Restaurante", desc: "Restaurantes, cafeterías, food trucks…", icon: <UtensilsCrossed className="size-7" /> },
  { mode: "services", label: "Servicios", desc: "Salones, talleres, consultorios…", icon: <Wrench className="size-7" /> },
  { mode: "rental", label: "Renta / Alquiler", desc: "Equipo, muebles, espacios…", icon: <Car className="size-7" /> },
  { mode: "hybrid", label: "Híbrido", desc: "Combinación de modelos", icon: <Layers className="size-7" /> },
]

const steps: WizardStep[] = [
  { id: "type", title: "Tipo de negocio" },
  { id: "data", title: "Empresa y sucursal" },
  { id: "confirm", title: "Confirmar" },
]

export function OnboardingWizard() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<Mode | null>(null)
  const [company, setCompany] = useState("")
  const [taxId, setTaxId] = useState("")
  const [phone, setPhone] = useState("")
  const [locationName, setLocationName] = useState("")

  const selected = TYPES.find((t) => t.mode === mode)

  const submit = async () => {
    if (!mode || !company.trim()) { swalError("Selecciona tipo y nombre de empresa"); return }
    swalLoading("Creando tu empresa…")
    setLoading(true)
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          businessMode: mode,
          companyName: company.trim(),
          taxId: taxId || undefined,
          phone: phone || undefined,
          locationName: locationName.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      swalClose()
      router.refresh()
      router.push("/admin")
    } catch (err) {
      swalClose()
      swalError("Error", err instanceof Error ? err.message : undefined)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-black">Configura tu empresa</h1>
        <p className="text-sm text-muted-foreground">En pocos pasos tendrás tu sistema listo</p>
      </div>

      <WizardShell steps={steps} onFinish={submit} finishLabel={loading ? "Creando…" : "Crear empresa"} loading={loading}>
        {({ step }) => {
          if (step.id === "type") {
            return (
              <div className="grid gap-2 sm:grid-cols-2">
                {TYPES.map((t) => (
                  <button key={t.mode} type="button" onClick={() => setMode(t.mode)}
                    className={cn("flex items-start gap-3 rounded-xl border-2 p-3 text-left transition active:scale-[0.98]",
                      mode === t.mode ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:border-muted-foreground/30"
                    )}>
                    <div className={cn("mt-0.5", mode === t.mode ? "text-primary" : "text-muted-foreground")}>{t.icon}</div>
                    <div>
                      <p className="text-sm font-bold">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )
          }

          if (step.id === "data") {
            return (
              <div className="space-y-3">
                <div>
                  <Label>Nombre de la empresa *</Label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Mi Negocio S.A. de C.V." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>RFC / ID fiscal</Label><Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="ABC123456789" /></div>
                  <div><Label>Teléfono</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="55 1234 5678" /></div>
                </div>
                <div>
                  <Label>Nombre de la primera sucursal</Label>
                  <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Sucursal Centro" />
                </div>
              </div>
            )
          }

          if (step.id === "confirm") {
            return (
              <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">{selected?.icon}</div>
                  <div>
                    <p className="font-bold">{company || "—"}</p>
                    <p className="text-xs text-muted-foreground">{selected?.label} · RFC: {taxId || "—"}</p>
                  </div>
                </div>
                {locationName && <p className="text-sm text-muted-foreground">Sucursal: <span className="font-medium text-foreground">{locationName}</span></p>}
              </div>
            )
          }
          return null
        }}
      </WizardShell>
    </div>
  )
}
