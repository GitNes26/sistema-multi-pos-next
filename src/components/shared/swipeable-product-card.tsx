"use client"

import { motion, useMotionValue, useTransform } from "framer-motion"
import { ShoppingCart, Heart, Check } from "lucide-react"
import { useState } from "react"
import { haptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

/**
 * ═══════════════════════════════════════════════════════════════
 *  SwipeableProductCard — Dual swipe actions on product cards
 * ═══════════════════════════════════════════════════════════════
 *
 *  Swipe left  → Add to cart (green)
 *  Swipe right → Toggle favorite (pink)
 *
 *  Wraps any children (typically a ProductCard) with drag gestures.
 */

interface SwipeableProductCardProps {
  children: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  /** Show left action (add to cart) */
  showLeft?: boolean
  /** Show right action (favorite) */
  showRight?: boolean
  className?: string
}

export function SwipeableProductCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  showLeft = true,
  showRight = true,
  className,
}: SwipeableProductCardProps) {
  const x = useMotionValue(0)
  const [swipedLeft, setSwipedLeft] = useState(false)
  const [swipedRight, setSwipedRight] = useState(false)

  // Left swipe → green background with cart icon
  const leftBg = useTransform(
    x,
    [-120, -60, 0],
    ["#22c55e", "#22c55e80", "rgba(0,0,0,0)"]
  )
  const leftOpacity = useTransform(x, [-120, -60, 0], [1, 0.8, 0])
  const leftScale = useTransform(x, [-120, -60, 0], [1, 0.9, 0.8])

  // Right swipe → pink background with heart icon
  const rightBg = useTransform(
    x,
    [0, 60, 120],
    ["rgba(0,0,0,0)", "#ec489980", "#ec4899"]
  )
  const rightOpacity = useTransform(x, [0, 60, 120], [0, 0.8, 1])
  const rightScale = useTransform(x, [0, 60, 120], [0.8, 0.9, 1])

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 80
    const velocityThreshold = 500

    if (
      showLeft &&
      (info.offset.x < -threshold || info.velocity.x < -velocityThreshold)
    ) {
      haptic.medium()
      setSwipedLeft(true)
      onSwipeLeft?.()
      setTimeout(() => setSwipedLeft(false), 600)
    } else if (
      showRight &&
      (info.offset.x > threshold || info.velocity.x > velocityThreshold)
    ) {
      haptic.light()
      setSwipedRight(true)
      onSwipeRight?.()
      setTimeout(() => setSwipedRight(false), 600)
    }
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      {/* Left action background (Add to cart) */}
      {showLeft && (
        <motion.div
          style={{ backgroundColor: leftBg }}
          className="absolute inset-0 flex items-center justify-start rounded-2xl pl-4"
        >
          <motion.div
            style={{ opacity: leftOpacity, scale: leftScale }}
            className="flex items-center gap-1.5 text-white"
          >
            {swipedLeft ? (
              <Check className="size-5" />
            ) : (
              <ShoppingCart className="size-5" />
            )}
            <span className="text-xs font-semibold">
              {swipedLeft ? "¡Agregado!" : "Agregar"}
            </span>
          </motion.div>
        </motion.div>
      )}

      {/* Right action background (Favorite) */}
      {showRight && (
        <motion.div
          style={{ backgroundColor: rightBg }}
          className="absolute inset-0 flex items-center justify-end rounded-2xl pr-4"
        >
          <motion.div
            style={{ opacity: rightOpacity, scale: rightScale }}
            className="flex items-center gap-1.5 text-white"
          >
            <span className="text-xs font-semibold">
              {swipedRight ? "¡Favorito!" : "Favorito"}
            </span>
            <Heart
              className={cn(
                "size-5",
                swipedRight && "fill-white"
              )}
            />
          </motion.div>
        </motion.div>
      )}

      {/* Draggable card content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{
          left: showLeft ? -120 : 0,
          right: showRight ? 120 : 0,
        }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        className="relative bg-background"
      >
        {children}
      </motion.div>
    </div>
  )
}
