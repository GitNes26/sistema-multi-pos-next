"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

// FASE 17.7 — Micro-interacción: scale on tap (0.97).

export function TapScale({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
