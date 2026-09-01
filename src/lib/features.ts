import type { BusinessMode } from "@/lib/auth/options";

// ── Feature Flags ──────────────────────────────────────────────────
// Fuente única de verdad: qué features existen y qué businessModes las activan.
// El sidebar, POS, portal y cualquier componente consultan estos flags.

export type FeatureKey =
  // Core (todos los modos)
  | "products"
  | "categories"
  | "promotions"
  | "publications"
  | "customers"
  | "employees"
  | "locations"
  | "settings"
  | "sales"
  | "reports"
  | "notifications"
  // Retail
  | "inventory"
  | "bulk_products"
  | "cedis"
  | "credit"
  // Food Service
  | "product_builder"
  | "item_notes"
  | "combos"
  | "tables"
  | "kds"
  | "digital_menu"
  | "tips"
  | "split_bill"
  // Services
  | "appointments"
  | "service_catalog"
  // Rental
  | "reservations"
  | "calendar"
  | "availability"
  | "contracts";

export interface FeatureFlag {
  label: string;
  description?: string;
  modes: BusinessMode[];
  /** Optional: permission required to see this feature in nav */
  permission?: string;
  /** Nav item href this feature maps to (for filtering) */
  href?: string;
}

export const FEATURE_FLAGS: Record<FeatureKey, FeatureFlag> = {
  // ── Core (todos los modos) ─────────────────────────────────────
  products:      { label: "Productos",        modes: ["retail", "food_service", "services", "rental", "hybrid"] },
  categories:    { label: "Categorías",       modes: ["retail", "food_service", "services", "rental", "hybrid"] },
  promotions:    { label: "Promociones",      modes: ["retail", "food_service", "services", "rental", "hybrid"] },
  publications:  { label: "Publicaciones",    modes: ["retail", "food_service", "services", "rental", "hybrid"] },
  customers:     { label: "Clientes",         modes: ["retail", "food_service", "services", "rental", "hybrid"] },
  employees:     { label: "Empleados",        modes: ["retail", "food_service", "services", "rental", "hybrid"] },
  locations:     { label: "Sucursales",       modes: ["retail", "food_service", "services", "rental", "hybrid"] },
  settings:      { label: "Ajustes",          modes: ["retail", "food_service", "services", "rental", "hybrid"] },
  sales:         { label: "Ventas",           modes: ["retail", "food_service", "services", "rental", "hybrid"] },
  reports:       { label: "Reportes",         modes: ["retail", "food_service", "services", "rental", "hybrid"] },
  notifications: { label: "Notificaciones",   modes: ["retail", "food_service", "services", "rental", "hybrid"] },

  // ── Retail ─────────────────────────────────────────────────────
  inventory:     { label: "Inventario",       modes: ["retail", "food_service", "hybrid"] },
  bulk_products: { label: "Producto a granel", modes: ["retail", "hybrid"] },
  cedis:         { label: "CEDIS",            modes: ["retail", "hybrid"] },
  credit:        { label: "Crédito",          modes: ["retail", "food_service", "hybrid"] },

  // ── Food Service ───────────────────────────────────────────────
  product_builder: { label: "Product Builder", modes: ["food_service", "hybrid"] },
  item_notes:      { label: "Notas por ítem",  modes: ["food_service", "hybrid"] },
  combos:          { label: "Combos",           modes: ["retail", "food_service", "hybrid"] },
  tables:          { label: "Mesas",            modes: ["food_service", "hybrid"] },
  kds:             { label: "Cocina (KDS)",     modes: ["food_service", "hybrid"] },
  digital_menu:    { label: "Menú digital",     modes: ["food_service", "hybrid"] },
  tips:            { label: "Propinas",         modes: ["food_service", "hybrid"] },
  split_bill:      { label: "Dividir cuenta",   modes: ["food_service", "hybrid"] },

  // ── Services ───────────────────────────────────────────────────
  appointments:     { label: "Citas/Agendamiento", modes: ["services", "hybrid"] },
  service_catalog:  { label: "Catálogo de servicios", modes: ["services", "hybrid"] },

  // ── Rental ─────────────────────────────────────────────────────
  reservations:  { label: "Reservaciones",    modes: ["rental", "hybrid"] },
  calendar:      { label: "Calendario",       modes: ["rental", "hybrid"] },
  availability:  { label: "Disponibilidad",   modes: ["rental", "hybrid"] },
  contracts:     { label: "Contratos",        modes: ["rental", "hybrid"] },
};

// ── Helpers ────────────────────────────────────────────────────────

/** ¿Esta feature está activa para el businessMode dado? */
export function isFeatureEnabled(feature: FeatureKey, mode: BusinessMode): boolean {
  return FEATURE_FLAGS[feature].modes.includes(mode);
}

/** Retorna solo las features habilitadas para un businessMode */
export function enabledFeatures(mode: BusinessMode): FeatureKey[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureKey[]).filter((key) =>
    FEATURE_FLAGS[key].modes.includes(mode)
  );
}

/** Mapa de href → feature key para filtrar nav items */
const HREF_FEATURE_MAP: Record<string, FeatureKey> = {};

// Auto-build from FEATURE_FLAGS that have explicit href mappings
Object.entries(FEATURE_FLAGS).forEach(([key, flag]) => {
  if (flag.href) HREF_FEATURE_MAP[flag.href] = key as FeatureKey;
});

// Manual mappings: nav href → feature key
// These must stay in sync with nav.ts
export const NAV_HREF_TO_FEATURE: Record<string, FeatureKey> = {
  "/admin/inventory":     "inventory",
  "/admin/cedis":         "cedis",
  "/admin/combos":        "combos",
  "/admin/tables":        "tables",
  "/admin/credits":       "credit",
  "/admin/promotions":    "promotions",
  "/admin/publications":  "publications",
  "/admin/products":      "products",
  "/admin/categories":    "categories",
  "/admin/customers":     "customers",
  "/admin/employees":     "employees",
  "/admin/sales":         "sales",
  "/admin/reports":       "reports",
  "/admin/notifications": "notifications",
  "/admin/locations":     "locations",
  "/admin/settings":      "settings",
  "/kds":                 "kds",
};
