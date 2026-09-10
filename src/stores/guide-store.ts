import { create } from "zustand";

// FASE — Guía inmersiva (coach marks): motor de pasos que navega entre páginas
// reales del panel, resalta el elemento que hay que tocar y explica cada campo.
// El estado vive aquí para sobrevivir la navegación (el provider se monta en el
// layout admin, fuera de las páginas que cambian).

export interface GuideState {
  /** Id de la guía activa (null = sin guía). */
  guideId: string | null;
  /** Paso actual dentro de la guía. */
  stepIndex: number;
  /** Ruta de la que partió la guía (para "volver al panel" al terminar). */
  originRoute: string | null;

  start: (guideId: string, originRoute?: string) => void;
  next: () => void;
  prev: () => void;
  jumpTo: (index: number) => void;
  close: () => void;
}

export const useGuideStore = create<GuideState>()((set) => ({
  guideId: null,
  stepIndex: 0,
  originRoute: null,

  start: (guideId, originRoute) =>
    set({ guideId, stepIndex: 0, originRoute: originRoute ?? null }),
  next: () => set((s) => ({ stepIndex: s.stepIndex + 1 })),
  prev: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),
  jumpTo: (stepIndex) => set({ stepIndex }),
  close: () => set({ guideId: null, stepIndex: 0, originRoute: null }),
}));