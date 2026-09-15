"use client"

import { useEffect, useState } from "react"
import Lottie from "lottie-react"
import { Package } from "lucide-react"

const FILES: Record<string, string> = {
  pending: "pending", confirmed: "confirmed", preparing: "preparing", ready: "ready",
  in_transit: "in-transit", at_destination: "at-destination", delivered: "delivered", cancelled: "cancelled",
}

export function OrderStatusLottie({ status }: { status: string }) {
  const [animation, setAnimation] = useState<object | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setAnimation(null)
    void fetch(`/assets/order-status/${FILES[status] ?? "pending"}.json`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then(setAnimation)
      .catch(() => undefined)
    return () => controller.abort()
  }, [status])
  return animation
    ? <Lottie animationData={animation} loop className="h-36 w-48" aria-label="Estado animado del pedido" />
    : <div className="flex h-36 w-48 items-center justify-center"><Package className="size-14 animate-pulse text-primary" /></div>
}
