"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Carrusel horizontal de planes: todas las tarjetas del mismo alto en una sola fila que se desliza con imán por
 * tarjeta. Las flechas van a media altura de las tarjetas (donde se buscan); el desplazamiento con flechas es
 * animado y suave (sin animación con «reducir movimiento»). En táctil basta con arrastrar.
 */
export function PlanCarousel({ children, className, label = "Planes" }: { children: React.ReactNode; className?: string; label?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [measure, children]);

  const go = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = (card?.offsetWidth ?? el.clientWidth * 0.8) + 16;
    const from = el.scrollLeft;
    const to = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, from + dir * step));
    if (frame.current) cancelAnimationFrame(frame.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.scrollLeft = to;
      return;
    }
    // Mientras se anima se apaga el imán (si no, pelea con cada cuadro); al terminar se restaura y asienta.
    const duration = 520;
    const start = performance.now();
    el.style.scrollSnapType = "none";
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      el.scrollLeft = from + (to - from) * easeInOut(t);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else {
        frame.current = null;
        el.style.scrollSnapType = "";
      }
    };
    frame.current = requestAnimationFrame(tick);
  };

  const hasOverflow = !(edge.start && edge.end);
  const arrow = "absolute top-[calc(50%-0.5rem)] z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full border-2 border-primary-foreground/40 bg-primary text-primary-foreground shadow-e3 ring-4 ring-background/80 transition-[opacity,transform,background-color] duration-200 hover:bg-primary/85 hover:shadow-e3 active:scale-95 desk:grid";

  return (
    <div className={cn("relative", className)} role="region" aria-label={label} aria-roledescription="carrusel">
      <div
        ref={scroller}
        onScroll={measure}
        tabIndex={0}
        className="-mx-1 -mt-2 flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto overscroll-x-contain px-1 pt-2 pb-4 outline-none [-webkit-overflow-scrolling:touch] scrollbar-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
        }}
      >
        {Children.map(children, (child) => (
          <div className="flex w-[min(88%,21rem)] shrink-0 snap-start flex-col sm:w-80 [&>*]:flex-1">{child}</div>
        ))}
      </div>
      {hasOverflow && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Planes anteriores" tabIndex={-1} className={cn(arrow, "-left-3", edge.start && "pointer-events-none opacity-0")}>
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Planes siguientes" tabIndex={-1} className={cn(arrow, "-right-3", edge.end && "pointer-events-none opacity-0")}>
            <ChevronRight className="size-5" />
          </button>
        </>
      )}
    </div>
  );
}
