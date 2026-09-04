"use client"

import { useRouter } from "next/navigation"
import { Minus, Plus, Package, Trash2, ShoppingBag } from "lucide-react"
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion"
import { usePortalStore, cartSubtotal, cartTax, cartTotal } from "@/stores/portal-store"
import { money, round3, snapToStep } from "@/lib/pos/money"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/portal/bottom-sheet"
import { CartEmptyIllustration } from "@/components/shared/animated-illustrations"
import { SlideToPay } from "@/components/shared/slide-to-pay"
import { haptic } from "@/lib/haptics"
import { useState } from "react"

/* ─── Swipeable Cart Item ─────────────────────────────────── */

function SwipeableCartItem({
  item,
  onRemove,
}: {
  item: {
    key: string
    name: string
    variantName: string | null
    imageUrl: string | null
    unitPrice: number
    qty: number
    step: number
    unitAbbrev: string
    trackInventory: boolean
    stock: number
    bulkQuantityDisplay?: string
    comment?: string
  }
  onRemove: () => void
}) {
  const { setQty, removeItem, setComment } = usePortalStore()
  const x = useMotionValue(0)
  const [isDeleted, setIsDeleted] = useState(false)

  // Delete background: reveals as user swipes left
  const deleteBg = useTransform(x, [-100, -50, 0], ["#ef4444", "#ef444480", "rgba(0,0,0,0)"])
  const deleteOpacity = useTransform(x, [-100, -50, 0], [1, 0.6, 0])
  const deleteScale = useTransform(x, [-100, -50, 0], [1, 0.8, 0.6])

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (info.offset.x < -80 || info.velocity.x < -500) {
      haptic.heavy()
      setIsDeleted(true)
      setTimeout(() => {
        removeItem(item.key)
        onRemove()
      }, 300)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Red delete background */}
      <motion.div
        style={{ backgroundColor: deleteBg, opacity: deleteOpacity }}
        className="absolute inset-0 flex items-center justify-end rounded-2xl pr-5"
      >
        <motion.div style={{ scale: deleteScale }} className="text-white">
          <Trash2 className="size-5" />
        </motion.div>
      </motion.div>

      {/* Card content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={isDeleted ? { opacity: 0, x: -200, height: 0, marginBottom: 0, marginTop: 0 } : {}}
        transition={{ duration: 0.3 }}
        className="relative flex items-center gap-3 rounded-2xl bg-zinc-900 p-3 dark:bg-zinc-800"
      >
        {/* Product image */}
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-700">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Package className="size-6 text-zinc-500" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {item.name}
          </p>
          {item.variantName && (
            <p className="truncate text-xs text-zinc-400">{item.variantName}</p>
          )}
          <div className="mt-1.5 flex items-center gap-3">
            <p className="text-sm font-bold text-white">{money(item.unitPrice * item.qty)}</p>
            <div className="flex items-center gap-1">
              {/* Minus button */}
              <button
                className="flex size-7 items-center justify-center rounded-full bg-pink-500/20 text-pink-400 transition-colors hover:bg-pink-500/30 active:bg-pink-500/40"
                onClick={(e) => {
                  e.stopPropagation()
                  haptic.light()
                  setQty(item.key, snapToStep(item.qty - item.step, item.step))
                }}
                disabled={item.qty <= item.step}
              >
                <Minus className="size-3.5" />
              </button>
              {/* Quantity */}
              <span className="w-8 text-center text-sm tabular-nums font-bold text-white">
                {round3(item.qty)}
              </span>
              {/* Plus button */}
              <button
                className="flex size-7 items-center justify-center rounded-full bg-pink-500/20 text-pink-400 transition-colors hover:bg-pink-500/30 active:bg-pink-500/40"
                onClick={(e) => {
                  e.stopPropagation()
                  haptic.light()
                  setQty(item.key, snapToStep(item.qty + item.step, item.step))
                }}
                disabled={item.trackInventory && item.qty >= item.stock}
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* ─── Cart Sheet ──────────────────────────────────────────── */

export function CartSheet() {
  const router = useRouter()
  const open = usePortalStore((s) => s.cartOpen)
  const setCartOpen = usePortalStore((s) => s.setCartOpen)
  const items = usePortalStore((s) => s.items)

  const subtotal = cartSubtotal(items)
  const tax = cartTax(items)
  const total = cartTotal(items)
  const deliveryFee = 0 // Could be dynamic based on delivery policy

  return (
    <BottomSheet
      open={open}
      onOpenChange={setCartOpen}
      title="Cart"
      description={
        items.length
          ? `${items.length} producto${items.length > 1 ? "s" : ""} en tu carrito`
          : "Aún no agregas productos"
      }
      footer={
        items.length > 0 ? (
          <div className="w-full space-y-3 pt-1">
            {/* Summary */}
            <div className="rounded-2xl bg-pink-500/10 p-4">
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium">{money(deliveryFee)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                <span className="text-lg font-bold">{money(total + deliveryFee)}</span>
              </div>
            </div>

            {/* Slide to Pay */}
            <SlideToPay
              label="Desliza para pagar"
              onConfirm={() => {
                setCartOpen(false)
                router.push("/portal/checkout")
              }}
            />
          </div>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* Empty state */}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
            <CartEmptyIllustration />
            <p className="text-sm font-medium">Tu carrito está vacío</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCartOpen(false)
                router.push("/portal/store")
              }}
            >
              Ir a la tienda
            </Button>
          </div>
        )}

        {/* Cart items */}
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <SwipeableCartItem
              key={item.key}
              item={item}
              onRemove={() => {}}
            />
          ))}
        </AnimatePresence>
      </div>
    </BottomSheet>
  )
}
