"use client"

import { useEffect, useState } from "react"
import Lottie from "lottie-react"
import { motion } from "framer-motion"
import { ChefHat, CircleCheck, Clock, MapPin, Package, PartyPopper, Store, Truck, XCircle, type LucideIcon } from "lucide-react"

const FILES: Record<string, string> = {
  pending: "pending", confirmed: "confirmed", preparing: "preparing", ready: "ready",
  in_transit: "in-transit", at_destination: "at-destination", delivered: "delivered", cancelled: "cancelled",
}

const ICONS: Record<string, LucideIcon> = {
  pending: Clock,
  confirmed: CircleCheck,
  preparing: ChefHat,
  ready: Store,
  in_transit: Truck,
  at_destination: MapPin,
  delivered: PartyPopper,
  cancelled: XCircle,
}

/** Ilustración de respaldo: ícono de la etapa con anillos que laten. */
function StageIllustration({ status }: { status: string }) {
  const Icon = ICONS[status] ?? Package
  return (
    <div className="relative grid h-36 w-48 place-items-center" aria-hidden>
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="absolute size-24 rounded-full border-2 border-primary/30 motion-reduce:hidden"
          animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: i, ease: "easeOut" }}
        />
      ))}
      <motion.span
        className="relative grid size-24 place-items-center rounded-full bg-primary text-primary-foreground shadow-e3"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className="size-11" />
      </motion.span>
    </div>
  )
}

export function OrderStatusLottie({ status }: { status: string }) {
  const [animation, setAnimation] = useState<{ nm?: string } | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setAnimation(null)
    setFailed(false)
    void fetch(`/assets/order-status/${FILES[status] ?? "pending"}.json`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => (data ? setAnimation(data) : setFailed(true)))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [status])

  // Los archivos de ejemplo ("placeholder") aún no se reemplazan por una
  // animación real: se muestra la ilustración propia en su lugar.
  const isPlaceholder = animation?.nm?.toLowerCase().includes("placeholder")
  if (failed || isPlaceholder) return <StageIllustration status={status} />
  return animation ? (
    <Lottie animationData={animation} loop className="h-36 w-48" aria-label="Estado animado del pedido" />
  ) : (
    <div className="flex h-36 w-48 items-center justify-center">
      <Package className="size-14 animate-pulse text-primary" />
    </div>
  )
}
