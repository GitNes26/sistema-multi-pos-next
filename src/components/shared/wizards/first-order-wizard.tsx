"use client"

import { useState } from "react"
import { ExternalLink, ShoppingCart, CreditCard, CheckCircle2 } from "lucide-react"
import { WizardShell, type WizardStep } from "./wizard-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const steps: WizardStep[] = [
  { id: "portal", title: "Ver portal" },
  { id: "cart", title: "Agregar al carrito" },
  { id: "checkout", title: "Finalizar" },
  { id: "done", title: "¡Listo!" },
]

interface Props { portalUrl?: string }

export function FirstOrderWizard({ portalUrl = "/portal" }: Props) {
  return (
    <WizardShell steps={steps} onFinish={() => {}} finishLabel="¡Entendido!">
      {({ step, isLast }) => {
        if (step.id === "portal") {
          return (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10"><ExternalLink className="size-7 text-primary" /></div>
              <p className="text-sm text-muted-foreground">Tu negocio tiene un portal online donde tus clientes pueden hacer pedidos, pagar en línea y acumular puntos.</p>
              <Button variant="outline" className="w-full" onClick={() => window.open(portalUrl, "_blank")}><ExternalLink className="size-4" /> Abrir portal</Button>
            </div>
          )
        }
        if (step.id === "cart") {
          return (
            <div className="space-y-3">
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><Badge variant="outline" className="shrink-0">1</Badge> Abre el portal y ve a la tienda</li>
                <li className="flex items-start gap-2"><Badge variant="outline" className="shrink-0">2</Badge> Busca un producto y agrégalo al carrito</li>
                <li className="flex items-start gap-2"><Badge variant="outline" className="shrink-0">3</Badge> Presiona &quot;Finalizar pedido&quot;</li>
              </ol>
              <Button variant="outline" className="w-full" onClick={() => window.open(`${portalUrl}/store`, "_blank")}><ShoppingCart className="size-4" /> Ir a la tienda</Button>
            </div>
          )
        }
        if (step.id === "checkout") {
          return (
            <div className="space-y-3">
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><Badge variant="outline" className="shrink-0">1</Badge> Elige entrega o recoger</li>
                <li className="flex items-start gap-2"><Badge variant="outline" className="shrink-0">2</Badge> Selecciona método de pago</li>
                <li className="flex items-start gap-2"><Badge variant="outline" className="shrink-0">3</Badge> Confirma — ¡aparecerá en tu POS y admin!</li>
              </ol>
              <Button variant="outline" className="w-full" onClick={() => window.open(`${portalUrl}/checkout`, "_blank")}><CreditCard className="size-4" /> Ir al checkout</Button>
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
