import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ThemeMode,
  AppearanceParams,
} from "@/lib/appearance";

const STORAGE_KEY = "multi-pos-appearance-v1";

interface ThemeState {
  // Preferencias locales del dispositivo (persistidas)
  theme: ThemeMode;
  overrides: Partial<AppearanceParams>;
  // Preferencias del tenant (desde app_settings de la organización; no persistidas)
  tenant: Partial<AppearanceParams> | null;

  setTheme: (theme: ThemeMode) => void;
  setAppearanceOverride: (patch: Partial<AppearanceParams>) => void;
  resetAppearanceOverrides: () => void;
  setTenant: (tenant: Partial<AppearanceParams> | null) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      overrides: {},
      tenant: null,

      setTheme: (theme) => set({ theme }),
      setAppearanceOverride: (patch) =>
        set((s) => ({ overrides: { ...s.overrides, ...patch } })),
      resetAppearanceOverrides: () => set({ overrides: {} }),
      setTenant: (tenant) => set({ tenant }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // El tenant se mantiene en memoria (se vuelve a leer al cargar cada app).
      partialize: (s) => ({ theme: s.theme, overrides: s.overrides }),
    }
  )
);

export { STORAGE_KEY };