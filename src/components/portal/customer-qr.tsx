"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import QRCode from "qrcode"
import { Maximize2, ScanLine, SunMedium, X } from "lucide-react"
import { customerQrPayload } from "@/lib/customer-qr"
import { haptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

const EASE = [0.16, 1, 0.3, 1] as const

/** Genera el QR como data URL; siempre negro sobre blanco para que lo lea
 *  cualquier lector, sin importar el tema claro/oscuro del teléfono. */
function useQrDataUrl(text: string, size: number) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((value) => alive && setUrl(value))
      .catch(() => alive && setUrl(null))
    return () => {
      alive = false
    }
  }, [text, size])
  return url
}

/**
 * QR de cliente: miniatura tocable que se amplía a pantalla completa para que
 * el cajero lo escanee en el POS y asigne al cliente en su venta.
 */
export function CustomerQr({
  customerId,
  fullName,
  customerCode,
  className,
}: {
  customerId: string
  fullName: string
  customerCode: string | null
  className?: string
}) {
  const payload = customerQrPayload(customerId)
  const thumb = useQrDataUrl(payload, 240)
  const large = useQrDataUrl(payload, 720)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => setMounted(true), [])

  // Pantalla completa: bloquea el scroll del fondo y cierra con Escape.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic.light()
          setOpen(true)
        }}
        aria-label="Ampliar mi QR de cliente"
        className={cn(
          "group relative flex shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-e1 ring-1 ring-black/5 transition-transform outline-none active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="size-full rounded-lg" draggable={false} />
        ) : (
          <span className="size-full animate-pulse rounded-lg bg-black/5" />
        )}
        <span className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-e1 ring-2 ring-card">
          <Maximize2 className="size-3" />
        </span>
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Mi QR de cliente"
                className="fixed inset-0 z-[80] flex flex-col bg-white text-neutral-900"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setOpen(false)}
              >
                <div className="safe-area-top flex justify-end p-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar"
                    className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition active:scale-95"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <motion.div
                  className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-center"
                  initial={reduce ? false : { scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={reduce ? undefined : { scale: 0.96, opacity: 0 }}
                  transition={{ duration: 0.32, ease: EASE }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="space-y-1">
                    <p className="font-heading text-2xl font-semibold tracking-tight">{fullName}</p>
                    {customerCode && (
                      <p className="text-sm text-neutral-500 tabular">Nº de cliente {customerCode}</p>
                    )}
                  </div>

                  <div className="w-full max-w-[20rem] rounded-3xl bg-white p-3 ring-1 ring-neutral-200">
                    {large ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={large} alt="Código QR para identificarte en caja" className="aspect-square w-full" draggable={false} />
                    ) : (
                      <span className="block aspect-square w-full animate-pulse rounded-2xl bg-neutral-100" />
                    )}
                  </div>

                  <div className="max-w-xs space-y-2 text-sm text-neutral-600">
                    <p className="flex items-center justify-center gap-2 font-medium text-neutral-900">
                      <ScanLine className="size-4" /> Muéstralo en caja al pagar
                    </p>
                    <p>El cajero lo escanea y tu compra queda a tu nombre para sumar puntos y usar tus beneficios.</p>
                    <p className="text-xs text-neutral-500">
                      <SunMedium className="mr-1 inline size-3.5 align-[-3px]" />
                      Sube el brillo de tu pantalla si no lo lee a la primera.
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
