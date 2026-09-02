"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/layout/logo";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  SplashScreen — Animated entry for the app
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Renders a full-screen overlay with the logo that scales in and fades,
 *  then fades out after a short delay. Used as the first thing users see
 *  when opening the PWA or navigating to the app.
 *
 *  - Respects prefers-reduced-motion (instant show/hide)
 *  - Auto-dismisses after 1.5s (or 0.8s for reduced motion)
 *  - Uses a flag in sessionStorage so it only shows once per session
 */

const SPLASH_DURATION = 1500; // 1.5s visible
const REDUCED_DURATION = 800; // 0.8s for reduced motion
const SESSION_KEY = "multi-pos-splash-seen";

export function SplashScreen({ logoUrl }: { logoUrl?: string | null }) {
  const [visible, setVisible] = useState(true);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    // Skip splash if already seen this session
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY)) {
      setVisible(false);
      return;
    }

    const duration = prefersReduced ? REDUCED_DURATION : SPLASH_DURATION;
    const timer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem(SESSION_KEY, "1");
    }, duration);

    return () => clearTimeout(timer);
  }, [prefersReduced]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: prefersReduced ? 0.15 : 0.4,
            ease: "easeOut",
          }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at center, oklch(0.985 0 0) 0%, oklch(1 0 0) 100%)",
          }}
        >
          {/* Dark mode support */}
          <style
            dangerouslySetInnerHTML={{
              __html: `.dark #splash-root { background: radial-gradient(ellipse at center, oklch(0.205 0 0) 0%, oklch(0.145 0 0) 100%); }`,
            }}
          />
          <div id="splash-root" className="flex flex-col items-center gap-6">
            {/* Logo with entrance animation */}
            <motion.div
              initial={
                prefersReduced
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.6 }
              }
              animate={{ opacity: 1, scale: 1 }}
              transition={
                prefersReduced
                  ? { duration: 0.15 }
                  : {
                      type: "spring",
                      stiffness: 200,
                      damping: 18,
                      delay: 0.1,
                    }
              }
            >
              <Logo
                logoUrl={logoUrl}
                className="h-16 w-auto drop-shadow-lg"
              />
            </motion.div>

            {/* Brand name */}
            <motion.div
              initial={
                prefersReduced
                  ? { opacity: 1 }
                  : { opacity: 0, y: 12 }
              }
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: prefersReduced ? 0.15 : 0.5,
                delay: prefersReduced ? 0.1 : 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="text-center"
            >
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Multi-POS
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Punto de venta multi-sucursal
              </p>
            </motion.div>

            {/* Loading dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: prefersReduced ? 0.2 : 0.7 }}
              className="flex items-center gap-1.5"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full bg-primary/40"
                  animate={
                    prefersReduced
                      ? { opacity: 0.4 }
                      : {
                          opacity: [0.3, 1, 0.3],
                          scale: [0.8, 1.1, 0.8],
                        }
                  }
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
