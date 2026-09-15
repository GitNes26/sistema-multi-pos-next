import { create } from "zustand";
import type {
  ThemeMode,
  AppearanceParams,
} from "@/lib/appearance";

interface ThemeState {
  // La empresa es la fuente de verdad; los overrides solo sirven como vista previa.
  theme: ThemeMode;
  overrides: Partial<AppearanceParams>;
  // Preferencias del tenant (desde app_settings de la organización; no persistidas)
  tenant: Partial<AppearanceParams> | null;

  setTheme: (theme: ThemeMode) => void;
  setAppearanceOverride: (patch: Partial<AppearanceParams>) => void;
  resetAppearanceOverrides: () => void;
  setTenant: (tenant: Partial<AppearanceParams> | null) => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
      theme: "system",
      overrides: {},
      tenant: null,

      setTheme: (theme) => set({ theme }),
      setAppearanceOverride: (patch) =>
        set((s) => ({ overrides: { ...s.overrides, ...patch } })),
      resetAppearanceOverrides: () => set({ overrides: {} }),
      setTenant: (tenant) => set({ tenant }),
}));
