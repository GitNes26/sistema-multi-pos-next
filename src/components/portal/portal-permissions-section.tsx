"use client"

import { useState } from "react"
import { Camera, MapPin, Bell, CheckCircle2, XCircle, Shield, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PermissionSlider, type PermissionType } from "@/components/shared/permission-slider"
import { usePortalPermissions, type PortalPermissionType } from "@/hooks/use-portal-permissions"

const PERM_CONFIG: Record<
  PortalPermissionType,
  {
    label: string
    description: string
    icon: typeof Camera
    color: string
    sliderType: PermissionType
  }
> = {
  camera: {
    label: "Cámara",
    description: "Escanear códigos QR y tomar fotos",
    icon: Camera,
    color: "text-violet-500 bg-violet-500/10",
    sliderType: "camera",
  },
  geolocation: {
    label: "Ubicación",
    description: "Delivery y sucursales cercanas",
    icon: MapPin,
    color: "text-emerald-500 bg-emerald-500/10",
    sliderType: "geolocation",
  },
  notifications: {
    label: "Notificaciones",
    description: "Alertas de pedidos y promociones",
    icon: Bell,
    color: "text-amber-500 bg-amber-500/10",
    sliderType: "notifications",
  },
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  granted: { label: "Concedido", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-500/10" },
  denied: { label: "Denegado", icon: XCircle, color: "text-destructive bg-destructive/10" },
  prompt: { label: "Pendiente", icon: RefreshCw, color: "text-amber-600 bg-amber-500/10" },
  unsupported: { label: "No disponible", icon: XCircle, color: "text-muted-foreground bg-muted" },
}

export function PortalPermissionsSection() {
  const { statuses, checkAll } = usePortalPermissions()
  const [sliderType, setSliderType] = useState<PermissionType | null>(null)

  const permTypes: PortalPermissionType[] = ["camera", "geolocation", "notifications"]

  return (
    <>
      <div className="space-y-2.5">
        {permTypes.map((type) => {
          const cfg = PERM_CONFIG[type]
          const status = statuses[type]
          const Icon = cfg.icon
          const st = STATUS_CONFIG[status] ?? STATUS_CONFIG.unsupported
          const StIcon = st.icon

          return (
            <div
              key={type}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3.5 shadow-sm"
            >
              <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", cfg.color)}>
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{cfg.label}</p>
                <p className="text-xs text-muted-foreground">{cfg.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", st.color)}>
                  <StIcon className="size-3" />
                  {st.label}
                </div>
                {status !== "granted" && status !== "unsupported" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => setSliderType(cfg.sliderType)}
                  >
                    Permitir
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {permTypes.some((t) => statuses[t] === "denied") && (
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          <Shield className="mt-0.5 size-4 shrink-0" />
          <span>
            Algunos permisos fueron denegados. Ve a la configuración de tu navegador para habilitarlos
            manualmente.
          </span>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="mt-2 h-8 gap-1.5 text-xs text-muted-foreground"
        onClick={() => void checkAll()}
      >
        <RefreshCw className="size-3" /> Verificar estado
      </Button>

      {sliderType && (
        <PermissionSlider
          type={sliderType}
          open={!!sliderType}
          onOpenChange={(open) => { if (!open) setSliderType(null) }}
          onGranted={() => { void checkAll(); setTimeout(() => setSliderType(null), 1200) }}
          onDenied={() => setSliderType(null)}
        />
      )}
    </>
  )
}
