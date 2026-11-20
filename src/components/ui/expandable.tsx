"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Bloque que se expande y se contrae con animación SUAVE en ambos sentidos
 * (altura + opacidad). A diferencia de `{open && <div/>}`, el contenido sigue
 * montado mientras se cierra, y se desmonta al terminar para no pesar ni
 * tomar foco. Sin animación con «reducir movimiento». Para triggers propios
 * (botón + estado); si usas Radix, `CollapsibleContent` ya anima igual.
 */
export function Expandable({
  open,
  children,
  className,
  innerClassName,
}: {
  open: boolean
  children: React.ReactNode
  className?: string
  innerClassName?: string
}) {
  const [mounted, setMounted] = React.useState(open)

  React.useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    // Se desmonta cuando termina la animación de cierre.
    const t = setTimeout(() => setMounted(false), 380)
    return () => clearTimeout(t)
  }, [open])

  if (!mounted && !open) return null

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-[340ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
        open && mounted ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
      aria-hidden={!open}
      inert={!open}
    >
      <div className={cn("min-h-0 overflow-hidden", innerClassName)}>{children}</div>
    </div>
  )
}
