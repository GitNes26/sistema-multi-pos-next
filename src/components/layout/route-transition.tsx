"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { pageTransition } from "@/lib/animation-tokens";

// FASE 5.9 — Transición de rutas con Motion AnimatePresence.
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const prefersReduced = !!prefersReducedMotion;

  const variants = pageTransition(prefersReduced);

  return (
    <motion.div
      key={pathname}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{ duration: prefersReduced ? 0 : 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}