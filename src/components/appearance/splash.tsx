"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// FASE 3.6 — Splash screen breve al entrar a una sección autenticada.
// Usa los tokens del tenant (--primary) cargados por el ThemeProvider.
export function Splash({ delay = 700 }: { delay?: number }) {
  const [phase, setPhase] = React.useState<"visible" | "hidden" | "off">("visible");

  React.useEffect(() => {
    const showTimer = setTimeout(() => setPhase("hidden"), delay);
    const offTimer = setTimeout(() => setPhase("off"), delay + 350);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(offTimer);
    };
  }, [delay]);

  if (phase === "off") return null;

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background transition-opacity duration-300",
        phase === "hidden" && "opacity-0 pointer-events-none"
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 9.5 12 4l9 5.5-9 5.5-9-5.5Z"
            fill="currentColor"
            opacity="0.9"
          />
          <path d="M6 12v4.5l6 3.5 6-3.5V12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="animate-pulse text-sm font-medium text-muted-foreground">Multi-POS</span>
    </div>
  );
}