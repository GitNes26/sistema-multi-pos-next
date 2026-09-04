import type { BusinessMode } from "@/lib/auth/options";
import type { PermissionKey } from "@/lib/auth/permission-keys";

// ── Business Modes ─────────────────────────────────────────────────
// Fuente única de verdad para la presentación de cada modo de negocio:
// nombre, descripción (para onboarding y wizard-launcher) y las acciones
// guiadas (wizards) que corresponden a cada modo.
//
// Regla general: el modo de negocio decide qué páginas, permisos y
// acciones tienen sentido. retail y food_service comparten el núcleo
// (POS, catálogo, promociones, portal); food_service suma constructor
// de producto/combos, mesas y cocina; services/rental van por
// agendamiento/reservaciones cuando esas páginas existan.

export interface BusinessModeInfo {
  id: BusinessMode;
  /** Nombre corto para badges y encabezados. */
  label: string;
  /** Descripción para que el usuario sepa qué incluye su tipo de negocio. */
  description: string;
  /** Características visibles (chips) en el selector y la tarjeta del dashboard. */
  features: string[];
  /** Clases de gradiente para el icono. */
  gradient: string;
}

export const BUSINESS_MODES: Record<BusinessMode, BusinessModeInfo> = {
  retail: {
    id: "retail",
    label: "Tienda / Abarrotes",
    description:
      "Venta directa en mostrador con caja, catálogo con variantes, inventario, combos, promociones, crédito y entrega a domicilio.",
    features: [
      "Punto de venta (POS)",
      "Inventario",
      "Variantes de producto",
      "Combos",
      "Promociones",
      "Crédito a clientes",
      "Delivery / recoger",
      "Portal del cliente",
    ],
    gradient: "from-emerald-500 to-teal-600",
  },
  food_service: {
    id: "food_service",
    label: "Nevería / Restaurante / Café",
    description:
      "Todo lo de una tienda, más la construcción de productos con opciones (tamaños, extras, ingredientes), combos, mesas, pantalla de cocina y menú digital.",
    features: [
      "Punto de venta (POS)",
      "Constructor de producto (opciones)",
      "Combos",
      "Mesas",
      "Cocina (KDS)",
      "Notas por ítem",
      "Menú digital",
      "Delivery / recoger",
      "Portal del cliente",
    ],
    gradient: "from-amber-500 to-orange-600",
  },
  services: {
    id: "services",
    label: "Servicios",
    description:
      "Venta de productos y servicios con agenda: citas, asignación de personal, promociones y cobro en caja.",
    features: [
      "Punto de venta (POS)",
      "Catálogo de productos",
      "Promociones",
      "Agenda / citas (próximamente)",
      "Portal del cliente",
    ],
    gradient: "from-violet-500 to-purple-600",
  },
  rental: {
    id: "rental",
    label: "Renta / Alquiler",
    description:
      "Productos que se rentan por períodos: calendario de disponibilidad, reservaciones, contratos y cobro en caja.",
    features: [
      "Punto de venta (POS)",
      "Catálogo de productos",
      "Promociones",
      "Reservaciones (próximamente)",
      "Portal del cliente",
    ],
    gradient: "from-sky-500 to-blue-600",
  },
  hybrid: {
    id: "hybrid",
    label: "Híbrido",
    description:
      "Combinación de los modos anteriores: tienda + comida + servicios o renta. Se activan todas las herramientas.",
    features: [
      "Todo lo de los demás modos",
      "Constructor de producto",
      "Combos · Mesas · Cocina",
      "Inventario · Crédito",
      "Delivery / recoger",
      "Portal del cliente",
    ],
    gradient: "from-rose-500 to-pink-600",
  },
};

export const BUSINESS_MODE_LIST: BusinessModeInfo[] = [
  BUSINESS_MODES.retail,
  BUSINESS_MODES.food_service,
  BUSINESS_MODES.services,
  BUSINESS_MODES.rental,
  BUSINESS_MODES.hybrid,
];

export function businessModeInfo(mode: BusinessMode): BusinessModeInfo {
  return BUSINESS_MODES[mode] ?? BUSINESS_MODES.retail;
}

// ── Wizards por modo de negocio ────────────────────────────────────
// Cada acción corresponde a un "wizard": una tarjeta que lleva al usuario
// al apartado real (Ajustes → Entrega, Catálogos → Productos, etc.) para
// que llene el formulario existente y se ubique en el sistema.

export type WizardActionKind =
  | "product"
  | "combos"
  | "inventory"
  | "tables"
  | "kds"
  | "delivery"
  | "credit"
  | "promotion"
  | "payments"
  | "company"
  | "portal";

export interface WizardActionDef {
  kind: WizardActionKind;
  title: string;
  description: string;
  /** Sección real a la que se navega para llenar el formulario existente. */
  href: string;
  /** Permiso requerido para ver/abrir la acción. */
  permission?: PermissionKey;
  /** Modos de negocio que incluyen esta acción. */
  modes: BusinessMode[];
}

export const WIZARD_ACTIONS: Record<WizardActionKind, WizardActionDef> = {
  product: {
    kind: "product",
    title: "Agrega tu primer producto",
    description: "Crea tu primer artículo en Catálogos → Productos",
    href: "/admin/products",
    permission: "products.manage",
    modes: ["retail", "food_service", "services", "rental", "hybrid"],
  },
  combos: {
    kind: "combos",
    title: "Crea un combo",
    description: "Paquetes con precio especial en Catálogos → Combos",
    href: "/admin/combos",
    permission: "products.manage",
    modes: ["retail", "food_service", "hybrid"],
  },
  inventory: {
    kind: "inventory",
    title: "Registra tu inventario",
    description: "Existencias y mínimos en Operación → Inventario",
    href: "/admin/inventory",
    permission: "inventory.manage",
    modes: ["retail", "food_service", "hybrid"],
  },
  tables: {
    kind: "tables",
    title: "Configura tus mesas",
    description: "Mapa de mesas y QR en Operación → Mesas",
    href: "/admin/tables",
    permission: "locations.view",
    modes: ["food_service", "hybrid"],
  },
  kds: {
    kind: "kds",
    title: "Activa la pantalla de cocina",
    description: "El KDS muestra los pedidos a tu equipo",
    href: "/kds",
    permission: "orders.view",
    modes: ["food_service", "hybrid"],
  },
  delivery: {
    kind: "delivery",
    title: "Configura envíos y recoger",
    description: "Costos y horarios en Ajustes → Entrega",
    href: "/admin/settings/delivery-policy",
    permission: "settings.manage",
    modes: ["retail", "food_service", "hybrid"],
  },
  credit: {
    kind: "credit",
    title: "Vende a crédito",
    description: "Límites y plazos en Ajustes → Crédito",
    href: "/admin/settings/credit-policy",
    permission: "settings.manage",
    modes: ["retail", "food_service", "hybrid"],
  },
  promotion: {
    kind: "promotion",
    title: "Crea una promoción",
    description: "Descuentos, 2x1 o cupones en Catálogos → Promociones",
    href: "/admin/promotions",
    permission: "promotions.manage",
    modes: ["retail", "food_service", "services", "rental", "hybrid"],
  },
  payments: {
    kind: "payments",
    title: "Activa pagos en línea",
    description: "Conecta Stripe o MercadoPago en Ajustes → Pagos",
    href: "/admin/settings/payments",
    permission: "settings.manage",
    modes: ["retail", "food_service", "services", "rental", "hybrid"],
  },
  company: {
    kind: "company",
    title: "Completa los datos de tu empresa",
    description: "RFC, dirección y contacto en Ajustes → Empresa",
    href: "/admin/settings/company",
    permission: "settings.manage",
    modes: ["retail", "food_service", "services", "rental", "hybrid"],
  },
  portal: {
    kind: "portal",
    title: "Prueba tu portal",
    description: "Así ven tus clientes tu negocio en línea",
    href: "/portal",
    modes: ["retail", "food_service", "services", "rental", "hybrid"],
  },
};

/** Orden de los wizards por modo de negocio (orden lógico de puesta en marcha). */
export const MODE_WIZARDS: Record<BusinessMode, WizardActionKind[]> = {
  retail: ["product", "inventory", "promotion", "delivery", "credit", "payments", "company", "portal"],
  food_service: [
    "product",
    "combos",
    "tables",
    "kds",
    "delivery",
    "promotion",
    "credit",
    "payments",
    "company",
    "portal",
  ],
  services: ["product", "promotion", "payments", "company", "portal"],
  rental: ["product", "promotion", "payments", "company", "portal"],
  hybrid: [
    "product",
    "combos",
    "tables",
    "kds",
    "inventory",
    "delivery",
    "promotion",
    "credit",
    "payments",
    "company",
    "portal",
  ],
};