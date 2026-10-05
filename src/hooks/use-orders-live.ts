"use client"

import { useEffect, useRef } from "react"

/**
 * Escucha el canal en vivo de la organización (SSE) y avisa cuando un pedido o
 * comanda cambia. El primer mensaje es el estado inicial y se ignora; los
 * siguientes (y las reconexiones) disparan `onChange` con un pequeño debounce.
 */
export function useOrdersLive(onChange: () => void) {
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    let es: EventSource | null = null
    let debounce: ReturnType<typeof setTimeout> | null = null
    let first = true
    let retry: ReturnType<typeof setTimeout> | null = null
    let closed = false

    const connect = () => {
      es = new EventSource("/api/kds/stream")
      es.onmessage = () => {
        if (first) {
          first = false
          return
        }
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(() => cb.current(), 250)
      }
      es.onerror = () => {
        es?.close()
        if (!closed) retry = setTimeout(connect, 5000)
        first = true
      }
    }
    connect()
    // Red de seguridad por si un evento se pierde.
    const fallback = setInterval(() => cb.current(), 60_000)
    return () => {
      closed = true
      es?.close()
      if (debounce) clearTimeout(debounce)
      if (retry) clearTimeout(retry)
      clearInterval(fallback)
    }
  }, [])
}
