"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useUiStore } from "@/stores/ui-store";

// Red de seguridad contra «la pantalla no responde al tocar hasta recargar» (sobre todo en el celular).
// Pasa cuando una capa (menú lateral, menú desplegable o modal de Radix) se cierra A MITAD de una navegación y deja
// puesto `pointer-events: none` / `overflow: hidden` en <body>, o una capa invisible encima. Al cambiar de ruta:
//  1) cierra el menú lateral,
//  2) y, pasado un instante, si ya no queda ninguna capa abierta, devuelve la interacción al <body>.
const OPEN_LAYER = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [data-radix-popper-content-wrapper], .swal2-container';

export function InteractionGuard() {
  const pathname = usePathname();
  const setNavOpen = useUiStore((s) => s.setNavOpen);

  React.useEffect(() => {
    setNavOpen(false);
    const timers = [250, 900].map((ms) =>
      window.setTimeout(() => {
        if (document.querySelector(OPEN_LAYER)) return;
        const body = document.body;
        if (body.style.pointerEvents === "none") body.style.pointerEvents = "";
        if (body.style.overflow === "hidden") body.style.overflow = "";
        body.removeAttribute("data-scroll-locked");
        document.documentElement.style.pointerEvents = "";
      }, ms)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [pathname, setNavOpen]);

  return null;
}
