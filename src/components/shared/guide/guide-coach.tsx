"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useGuideStore } from "@/stores/guide-store";
import { GUIDES } from "@/lib/guides";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// FASE — Guía inmersiva del panel: spotlight sobre el elemento real de la página
// + tooltip explicativo. Los pasos pueden navegar a otra ruta (router.push) y
// esperar a que el elemento exista en el DOM antes de mostrar el spotlight.
// La página sigue siendo interactiva (el resaltado no bloquea clics); algunos
// pasos avanzan solos al tocar el elemento (advanceOnClick).

const PAD = 6;

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Espera (poll + MutationObserver) a que un selector exista en el DOM. */
function useWaitForSelector(selector: string | undefined, enabled: boolean) {
  const [target, setTarget] = useState<{ el: Element; found: boolean } | null>(null);

  useEffect(() => {
    if (!enabled || !selector) {
      setTarget(null);
      return;
    }
    let stopped = false;
    let raf = 0;

    const find = () => document.querySelector(selector);
    const check = () => {
      if (stopped) return;
      const el = find();
      if (el) {
        setTarget({ el, found: true });
        cleanup();
      }
    };

    let timeout: ReturnType<typeof setTimeout> | undefined; // eslint-disable-line prefer-const -- assigned after cleanup closure
    let observer: MutationObserver | undefined; // eslint-disable-line prefer-const -- assigned after cleanup closure

    const cleanup = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (timeout) clearTimeout(timeout);
      observer?.disconnect();
    };

    check();
    const started = Date.now();
    const poll = () => {
      if (stopped) return;
      // Fallback: si el selector no aparece, se muestra como paso centrado.
      if (Date.now() - started > 18000) {
        setTarget({ el: document.body, found: false });
        cleanup();
        return;
      }
      check();
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    timeout = setTimeout(cleanup, 20000);
    return cleanup;
  }, [selector, enabled]);

  return target;
}

function measure(el: Element | null): TargetRect | null {
  if (!el || el === document.body) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function GuideCoach() {
  const router = useRouter();
  const pathname = usePathname();
  const { guideId, stepIndex, next, prev, close } = useGuideStore();
  const guide = guideId ? GUIDES[guideId] : undefined;
  const step = guide?.steps[stepIndex];
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState<TargetRect | null>(null);

  // Se mantiene activo mientras el paso esté vigente: si se apagara cuando
  // `ready` pasa a true, target quedaría null y advanceOnClick nunca adjuntaría
  // el listener al elemento resaltado.
  const target = useWaitForSelector(step?.selector, Boolean(guide && step));

  // El paso ya está listo cuando el selector aparece (o falló → centro) y la ruta coincide.
  const routeOk = !step?.route || pathname === step.route;
  const resolved = routeOk && (!step?.selector || target?.found);

  // Reset por cambio de paso / guía + encendido cuando el paso está resuelto.
  // Depende de [guideId, stepIndex, resolved]: `resolved` puede seguir siendo
  // true entre pasos, así que hay que reprogramar el encendido en cada paso.
  useEffect(() => {
    if (guideId === null) return;
    setReady(false);
    setRect(null);
    if (resolved) {
      const t = setTimeout(() => setReady(true), 60);
      return () => clearTimeout(t);
    }
  }, [guideId, stepIndex, resolved]);

  // Navegación: si el paso vive en otra ruta, ir primero y esperar el render.
  useEffect(() => {
    if (!guide || !step) return;
    const route = step.route;
    if (route && pathname !== route) {
      setReady(false);
      router.push(route);
    }
  }, [guide, step, pathname, router]);

  // Medir + reposicionar (scroll, resize, re-render).
  useEffect(() => {
    if (!ready || !step?.selector || !target) return;
    const update = () => {
      if (target.found && target.el !== document.body) {
        const r = measure(target.el);
        setRect(r);
      } else {
        setRect(null);
      }
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [ready, step?.selector, target]);

  // Avance automático al tocar el elemento resaltado.
  useEffect(() => {
    if (!ready || !step?.advanceOnClick || !target?.el || target.el === document.body) return;
    const el = target.el as HTMLElement;
    const handler = () => {
      // Espera un instante para que el clic complete su acción (abrir dialog, etc.).
      setTimeout(() => next(), 350);
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [ready, step?.advanceOnClick, target, next]);

  if (!guide || !step) return null;

  const total = guide.steps.length;
  const progress = Math.round(((stepIndex + (ready ? 1 : 0)) / total) * 100);

  // Posición del tooltip respecto al elemento resaltado.
  let tooltipStyle: React.CSSProperties | undefined;
  const W = 340;
  if (rect) {
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fits = {
      bottom: rect.top + rect.height + margin + 180 <= vh,
      top: rect.top - margin - 180 >= 0,
      right: rect.left + rect.width + margin + W <= vw,
      left: rect.left - margin - W >= 0,
    };
    const preferred: ("bottom" | "top" | "right" | "left")[] = ["bottom", "top", "right", "left"];
    const chosen = preferred.find((p) => fits[p]) ?? "bottom";
    if (chosen === "bottom") tooltipStyle = { top: rect.top + rect.height + margin, left: Math.max(12, Math.min(rect.left + rect.width / 2 - W / 2, vw - W - 12)) };
    if (chosen === "top") tooltipStyle = { top: Math.max(12, rect.top - margin - 190), left: Math.max(12, Math.min(rect.left + rect.width / 2 - W / 2, vw - W - 12)) };
    if (chosen === "right") tooltipStyle = { top: Math.max(12, Math.min(rect.top + rect.height / 2 - 100, vh - 220)), left: rect.left + rect.width + margin };
    if (chosen === "left") tooltipStyle = { top: Math.max(12, Math.min(rect.top + rect.height / 2 - 100, vh - 220)), left: Math.max(12, rect.left - margin - W) };
  } else {
    // Paso centrado: tooltip en el centro de la pantalla.
    tooltipStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  // Si no está listo (navegando o esperando elemento): mini indicador.
  if (!ready) {
    return (
      <div className="guide-fade-in fixed inset-0 z-[9999] flex items-center justify-center bg-background/30 backdrop-blur-[2px]">
        <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-lg">
          <Sparkles className="size-4 animate-pulse text-primary" />
          {step.route && pathname !== step.route ? "Llevándote a la sección…" : "Preparando la guía…"}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes guide-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.55), 0 0 0 9999px rgba(2,6,23,0.72); } 50% { box-shadow: 0 0 0 8px rgba(16,185,129,0.25), 0 0 0 9999px rgba(2,6,23,0.72); } }
        @keyframes guide-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .guide-fade-in { animation: guide-fade-in 0.25s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .guide-pulse { animation: none !important; } }
      `}</style>

      {/* Barra de progreso */}
      <div className="fixed inset-x-0 top-0 z-[9999] h-1 bg-foreground/10">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Cerrar / saltar */}
      <button
        type="button"
        onClick={close}
        aria-label="Salir de la guía"
        className="guide-fade-in fixed top-3 right-3 z-[9999] inline-flex items-center gap-1.5 rounded-full border bg-background/95 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-lg transition hover:text-foreground"
      >
        <X className="size-3.5" /> Saltar guía
      </button>

      {/* Spotlight: oscurece todo menos el elemento resaltado (no bloquea clics). */}
      {step.selector && rect && (
        <div
          className="guide-fade-in guide-pulse fixed rounded-xl border-2 border-primary/80"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(2,6,23,0.72)",
            zIndex: 9998,
            pointerEvents: "none",
            transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="guide-fade-in fixed z-[9999] w-[340px] max-w-[calc(100vw-24px)] rounded-2xl border bg-background/98 p-4 shadow-2xl shadow-black/40"
        style={tooltipStyle}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar guía"
          className="absolute top-2.5 right-2.5 rounded-full p-1 text-muted-foreground/70 transition hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black tracking-wide text-primary uppercase">
            <Sparkles className="size-3" /> Paso {stepIndex + 1} de {total}
          </span>
          {step.route && pathname !== step.route && (
            <span className="text-[10px] text-muted-foreground">· sección {step.route}</span>
          )}
        </div>
        <h3 className="text-base font-black tracking-tight">{step.title}</h3>
        <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</div>
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {stepIndex > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={prev}>
                <ChevronLeft className="size-4" /> Atrás
              </Button>
            )}
          </div>
          {stepIndex < total - 1 ? (
            <Button type="button" size="sm" onClick={next} className="gap-1">
              {step.advanceOnClick ? "Entendido" : "Siguiente"}
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={close} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
              ¡Listo! <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
        {step.actions && step.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
            {step.actions.map((a) => (
              <Button
                key={a.href + a.label}
                type="button"
                size="sm"
                variant={a.primary ? "default" : "outline"}
                onClick={() => {
                  close();
                  if (a.href.startsWith("/")) router.push(a.href);
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
