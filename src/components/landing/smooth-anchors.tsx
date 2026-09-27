"use client"

import { useEffect } from "react"

// Desplazamiento suave para los enlaces internos de la portada (#planes,
// #preguntas…). Respeta el scroll-margin de cada sección (encabezado fijo),
// actualiza la URL sin salto y usa movimiento instantáneo con reduced-motion.
export function SmoothAnchors() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = (event.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null
      if (!link) return
      const id = decodeURIComponent(link.hash.slice(1))
      const target = id ? document.getElementById(id) : document.body
      if (!target) return
      event.preventDefault()
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
      history.replaceState(null, "", id ? `#${id}` : window.location.pathname)
      // Mueve el foco a la sección para teclado y lectores de pantalla.
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1")
      target.focus({ preventScroll: true })
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])
  return null
}
