"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Users, ExternalLink, ShoppingCart, CreditCard, CheckCircle2 } from "lucide-react"
import { WizardShell, type WizardStep } from "./wizard-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const steps: WizardStep[] = [
  { id: "customer", title: "Cliente de prueba" },
  { id: "portal", title: "Ver portal" },
  { id: "order", title: "Hacer un pedido" },
  { id: "done", title: "¡Listo!" },
]

interface Props {
  portalUrl?: string
  onClose?: () => void
}

export function FirstOrderWizard({ portalUrl = "/portal", onClose }: Props) {
  const router = useRouter()
  const [closing, setClosing] = useState(false)

  const finish = () => {
    setClosing(true)
    onClose?.()
  }

  return (
    <WizardShell steps={steps} onFinish={finish} finishLabel={closing ? "Cerrando…" : "¡Entendido!"}>
      {({ step }) => {
        if (step.id === "customer") {
          return (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                <Users className="mt-0.5 size-4 shrink-0 text-primary" />
                <p>
                  El portal es para tus <strong className="text-foreground">clientes</strong>, así que para
                  probarlo necesitas una cuenta de cliente. Créala en{" "}
                  <strong className="text-foreground">Catálogos → Clientes</strong>: el cliente entra al
                  portal con su email y la contraseña inicial que se le asigna.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onClose?.()
                  router.push("/admin/customers")
                }}
              >
                <Users className="size-4" /> Crear un cliente de prueba
              </Button>
            </div>
          )
        }
        if (step.id === "portal") {
          return (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10"><ExternalLink className="size-7 text-primary" /></div>
              <p className="text-sm text-muted-foreground">Con la cuenta del cliente entra al portal: ahí se ve tu tienda, el menú, promociones y puntos.</p>
              <div className="grid gap-2">
                <Button variant="outline" className="w-full" onClick={() => window.open(`${portalUrl}/auth/login`, "_blank")}><ExternalLink className="size-4" /> Abrir portal</Button>
                <p className="text-[11px] text-muted-foreground">
                  Si ya tienes sesión como administrador, ciérrala primero (menú de usuario) para entrar con el cliente.
                </p>
              </div>
            </div>
          )
        }
        if (step.id === "order") {
          return (
            <div className="space-y-3">
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><Badge variant="outline" className="shrink-0">1</Badge> Busca un producto y agrégalo al carrito</li>
                <li className="flex items-start gap-2"><Badge variant="outline" className="shrink-0">2</Badge> Elige entrega o recoger</li>
                <li className="flex items-start gap-2"><Badge variant="outline" className="shrink-0">3</Badge> Confirma — el pedido aparecerá en Operación → Pedidos</li>
              </ol>
              <Button variant="outline" className="w-full" onClick={() => window.open(`${portalUrl}/store`, "_blank")}><ShoppingCart className="size-4" /> Ir a la tienda</Button>
              <Button variant="outline" className="w-full" onClick={() => window.open("/admin/orders", "_blank")}><CreditCard className="size-4" /> Ver pedidos en el panel</Button>
            </div>
          )
        }
        if (step.id === "done") {
          return (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30"><CheckCircle2 className="size-7 text-emerald-600" /></div>
              <p className="font-bold">¡Listo para vender!</p>
              <p className="text-sm text-muted-foreground">Cada pedido en línea aparecerá automáticamente en tu sistema.</p>
            </div>
          )
        }
        return null
      }}
    </WizardShell>
  )
}