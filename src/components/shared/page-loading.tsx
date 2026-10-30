import { Logo } from "@/components/layout/logo"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Carga al cambiar de pantalla: barra de progreso arriba, marca que respira y esqueletos con la
 * forma de una pantalla típica (encabezado, métricas y listado). Se usa desde los `loading.tsx`.
 */
export function PageLoading({ label = "Cargando…", variant = "page" }: { label?: string; variant?: "page" | "grid" }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="relative flex min-h-[60dvh] flex-col gap-6 p-4 desk:p-6">
      <span className="sr-only">{label}</span>
      <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-primary/10" aria-hidden>
        <div className="loading-bar-run h-full w-1/4 rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 animate-[loading-bar_1.2s_ease-in-out_infinite]" />
      </div>

      <div className="flex items-center gap-3" aria-hidden>
        <Logo size={24} className="brand-breathe animate-[brand-breathe_1.8s_ease-in-out_infinite]" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-64 max-w-[60vw]" />
        </div>
      </div>

      {variant === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
