"use client"

import { useEffect, useRef } from "react"

/**
 * Como `setInterval`, pero solo mientras la pestaña está visible. Al volver a verla ejecuta de
 * inmediato si ya pasó el intervalo, así los datos no quedan viejos. Una pestaña olvidada en
 * segundo plano deja de consultar al servidor. `ms = null` lo desactiva.
 */
export function useVisibleInterval(callback: () => void, ms: number | null) {
  const cb = useRef(callback)
  useEffect(() => {
    cb.current = callback
  })
  useEffect(() => {
    if (ms == null) return
    let timer: ReturnType<typeof setInterval> | null = null
    let last = Date.now()
    const run = () => {
      last = Date.now()
      cb.current()
    }
    const start = () => {
      if (timer == null) timer = setInterval(run, ms)
    }
    const stop = () => {
      if (timer != null) clearInterval(timer)
      timer = null
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - last >= ms) run()
        start()
      } else {
        stop()
      }
    }
    if (document.visibilityState === "visible") start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [ms])
}
