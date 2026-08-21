"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

const ROUTE_DEPTH: Record<string, number> = {
  "/portal": 0,
  "/portal/store": 1,
  "/portal/orders": 1,
  "/portal/lists": 1,
  "/portal/profile": 1,
  "/portal/favorites": 1,
  "/portal/loyalty": 1,
  "/portal/payment-methods": 1,
  "/portal/checkout": 2,
}

function getDepth(pathname: string): number {
  if (ROUTE_DEPTH[pathname] !== undefined) return ROUTE_DEPTH[pathname]
  if (pathname.startsWith("/portal/orders/")) return 2
  if (pathname.startsWith("/portal/lists/")) return 2
  return 1
}

export function PortalPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const prevDepthRef = React.useRef(getDepth(pathname))
  const prefersReducedMotion = useReducedMotion()

  const currentDepth = getDepth(pathname)
  const goingForward = currentDepth >= prevDepthRef.current

  React.useEffect(() => {
    prevDepthRef.current = currentDepth
  }, [currentDepth])

  if (prefersReducedMotion) {
    return <>{children}</>
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{
          opacity: 0,
          x: goingForward ? 30 : -30,
        }}
        animate={{
          opacity: 1,
          x: 0,
        }}
        exit={{
          opacity: 0,
          x: goingForward ? -30 : 30,
        }}
        transition={{
          duration: 0.2,
          ease: "easeInOut",
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
