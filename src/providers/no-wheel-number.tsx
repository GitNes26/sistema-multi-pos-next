"use client"

import { useEffect } from "react"

/**
 * Evita que girar la rueda del mouse (o el trackpad) cambie el valor de un campo numérico enfocado:
 * al desplazar la página con el cursor encima, el campo pierde el foco y la página simplemente se mueve.
 * Las flechas ↑/↓ del teclado y los botones de los steppers siguen funcionando.
 */
export function NoWheelNumber() {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement && target.type === "number" && document.activeElement === target) target.blur()
    }
    document.addEventListener("wheel", onWheel, { capture: true, passive: true })
    return () => document.removeEventListener("wheel", onWheel, { capture: true })
  }, [])
  return null
}
