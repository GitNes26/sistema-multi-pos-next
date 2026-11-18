"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

import { NavSection } from "@/lib/nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { useUiStore } from "@/stores/ui-store";
import { DURATION, SPRING_SOFT, TRANSITION_FADE_FAST } from "@/lib/animation-tokens";

const CLOSE_MS = 320;

// FASE 5.7 — NavigationDrawer: slide-in con overlay (tablet y móvil < 1024px).
export function NavigationDrawer({
  sections,
  orgScope,
  orgActiveId,
}: {
  sections: NavSection[];
  /** Contexto de org para el OrgSwitcher del sidebar (el header lo oculta). */
  orgScope?: string | null;
  orgActiveId?: string | null;
}) {
  const navOpen = useUiStore((s) => s.navOpen);
  const setNavOpen = useUiStore((s) => s.setNavOpen);

  React.useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [navOpen, setNavOpen]);

  // El menú sigue montado un instante tras cerrarse para que se vea la animación de salida, pero se desmonta con un
  // temporizador propio: la salida de AnimatePresence se llegaba a atorar al navegar y dejaba el telón invisible
  // encima de la pantalla (los toques dejaban de responder hasta recargar).
  const [mounted, setMounted] = React.useState(navOpen);
  React.useEffect(() => {
    if (navOpen) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [navOpen]);

  if (!mounted) return null;
  return (
    <div
      className={navOpen ? "lg:hidden" : "pointer-events-none lg:hidden"}
      role="dialog"
      aria-modal={navOpen}
      aria-label="Menú de navegación"
      data-state={navOpen ? "open" : "closed"}
    >
      <motion.button
        type="button"
        aria-label="Cerrar menú"
        initial={{ opacity: 0 }}
        animate={{ opacity: navOpen ? 1 : 0 }}
        transition={TRANSITION_FADE_FAST}
        onClick={() => setNavOpen(false)}
        tabIndex={navOpen ? 0 : -1}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: "-100%" }}
        animate={{ x: navOpen ? 0 : "-100%" }}
        transition={SPRING_SOFT}
        className="fixed inset-y-0 left-0 z-50 w-[min(88vw,320px)] border-r bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <button
          type="button"
          onClick={() => setNavOpen(false)}
          aria-label="Cerrar"
          className="absolute right-2 top-3 z-10 flex size-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="h-full">
          <AppSidebar sections={sections} orgScope={orgScope} orgActiveId={orgActiveId} onOrgSwitched={() => setNavOpen(false)} />
        </div>
      </motion.aside>
    </div>
  );
}
