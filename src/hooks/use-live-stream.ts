"use client"

import { useEffect, useRef } from "react"

/**
 * Escucha un canal SSE y avisa (con un pequeño debounce) cada vez que llega un evento. Al reconectar también
 * avisa, por si se perdió algo mientras no había conexión. Ignora el saludo inicial del canal.
 */
export function useLiveStream(url: string, onChange: () => void) {
  const cb = useRef(onChange)
  useEffect(() => {
    cb.current = onChange
  })

  useEffect(() => {
    let es: EventSource | null = null
    let debounce: ReturnType<typeof setTimeout> | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let closed = false
    let reconnecting = false

    const fire = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => cb.current(), 150)
    }
    const connect = () => {
      es = new EventSource(url)
      es.onopen = () => {
        if (reconnecting) fire()
        reconnecting = false
      }
      es.onmessage = fire
      es.onerror = () => {
        es?.close()
        reconnecting = true
        if (!closed) retry = setTimeout(connect, 5000)
      }
    }
    connect()
    return () => {
      closed = true
      es?.close()
      if (debounce) clearTimeout(debounce)
      if (retry) clearTimeout(retry)
    }
  }, [url])
}
