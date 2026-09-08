"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import { HeroBackground } from "@/components/landing/hero-background";

/**
 * Splash screen breve al entrar a una sección autenticada.
 * Mismo tratamiento que el SplashScreen principal: el logo vuela a la
 * esquina del header al salir, mientras el resto se desvanece.
 */
export function Splash({
  delay = 700,
  logoUrl,
  orgName,
}: {
  delay?: number;
  logoUrl?: string | null;
  orgName?: string | null;
}) {
  const [visible, setVisible] = React.useState(true);
  // Esquina del header (padding 24 + tile 32 → centro 40): se calcula en
  // cliente (window no existe durante SSR; useMemo con window tumba la RSC).
  const [exitTo, setExitTo] = React.useState({ x: 0, y: -120, scale: 0.5 });
  const prefersReduced = useReducedMotion();

  React.useEffect(() => {
    if (prefersReduced) return;
    const HEADER_X = 40;
    const HEADER_Y = 40;
    setExitTo({
      x: -(window.innerWidth / 2 - HEADER_X),
      y: -(window.innerHeight / 2 - HEADER_Y),
      scale: 0.5,
    });
  }, [prefersReduced]);

  React.useEffect(() => {
    const timer = setTimeout(() => setVisible(false), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="auth-splash"
          initial={{ opacity: 1 }}
          className="fixed inset-0 z-[100] overflow-hidden bg-slate-950 text-slate-50"
        >
          {/* Fondo: se desvanece */}
          <motion.div
            className="absolute inset-0"
            exit={{ opacity: 0, transition: { duration: prefersReduced ? 0.15 : 0.4 } }}
          >
            <HeroBackground />
          </motion.div>

          <div className="relative flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
            {/* Logo: vuela a la esquina del header */}
            <motion.div
              initial={
                prefersReduced
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.6 }
              }
              animate={{ opacity: 1, scale: 1 }}
              exit={
                prefersReduced
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : {
                      x: exitTo.x,
                      y: exitTo.y,
                      scale: exitTo.scale,
                      opacity: [1, 1, 0],
                      transition: { duration: 0.5, times: [0, 0.75, 1], ease: "easeInOut" },
                    }
              }
              transition={
                prefersReduced
                  ? { duration: 0.15 }
                  : { type: "spring", stiffness: 200, damping: 18, delay: 0.05 }
              }
              className="drop-shadow-[0_0_2.5rem_rgba(16,185,129,0.35)]"
            >
              <Logo logoUrl={logoUrl} className="h-20 w-auto" size={48} />
            </motion.div>

            {/* Brand name */}
            <motion.div
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.25 } }}
              transition={{
                duration: prefersReduced ? 0.15 : 0.45,
                delay: prefersReduced ? 0.1 : 0.25,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {orgName ? (
                <>
                  <span className="max-w-sm truncate bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                    {orgName}
                  </span>
                  <span className="mt-1.5 block text-xs text-slate-400">Multi-POS</span>
                </>
              ) : (
                <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                  Multi-POS
                </span>
              )}
            </motion.div>

            {/* Loading indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ delay: prefersReduced ? 0.1 : 0.35 }}
              className="flex items-center gap-1.5"
              aria-hidden
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full bg-emerald-400/50"
                  animate={
                    prefersReduced
                      ? undefined
                      : { opacity: [0.35, 1, 0.35], scale: [0.9, 1.15, 0.9] }
                  }
                  transition={
                    prefersReduced
                      ? undefined
                      : { duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }
                  }
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
