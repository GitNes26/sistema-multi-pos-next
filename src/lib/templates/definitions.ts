// Plantillas de arranque por tipo de negocio (sin dependencias de servidor): qué crean y para qué modos aplican.

export type TemplateKey = "carwash" | "barber" | "rental";

export interface BusinessTemplate {
  key: TemplateKey;
  label: string;
  description: string;
  /** Modos de negocio en los que tiene sentido aplicarla. */
  modes: string[];
  /** Servicios de ejemplo (nombre y precio): se crean sin inventario y se pueden editar o borrar después. */
  services: { name: string; price: number }[];
  stations: { prefix: string; kind: "bay" | "chair"; count: number } | null;
  flow: { name: string; stages: { label: string; notifyCustomer?: boolean; isReady?: boolean }[] } | null;
  loyaltyPresetKey: string | null;
  rentalPolicy: { defaultDeposit: number; lateFeePerDay: number; graceMinutes: number } | null;
  /** Lista corta de lo que se crea, para mostrarla antes de aplicar. */
  highlights: string[];
}

export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  {
    key: "carwash",
    label: "Autolavado",
    description: "Bahías, servicios de lavado, un flujo por etapas con aviso «listo» y una tarjeta de lavados.",
    modes: ["services", "hybrid"],
    services: [{ name: "Lavado básico", price: 80 }, { name: "Lavado completo", price: 150 }, { name: "Encerado", price: 250 }],
    stations: { prefix: "Bahía", kind: "bay", count: 3 },
    flow: { name: "Autolavado", stages: [{ label: "Recibido" }, { label: "Lavando" }, { label: "Secado y detalle" }, { label: "Listo para entregar", notifyCustomer: true, isReady: true }] },
    loyaltyPresetKey: "visit_5_free",
    rentalPolicy: null,
    highlights: ["3 bahías", "3 servicios de ejemplo", "Flujo: Recibido → Lavando → Secado → Listo", "Cada 5 lavados, el siguiente gratis"],
  },
  {
    key: "barber",
    label: "Barbería",
    description: "Sillas, servicios de corte y barba, y una tarjeta de visitas. La agenda y la ficha de estilo ya vienen incluidas.",
    modes: ["services", "hybrid"],
    services: [{ name: "Corte", price: 150 }, { name: "Barba", price: 100 }, { name: "Corte y barba", price: 220 }],
    stations: { prefix: "Silla", kind: "chair", count: 3 },
    flow: null,
    loyaltyPresetKey: "visit_5_free",
    rentalPolicy: null,
    highlights: ["3 sillas", "3 servicios de ejemplo", "Cada 5 servicios, el siguiente gratis"],
  },
  {
    key: "rental",
    label: "Renta de equipo",
    description: "Política de renta lista: depósito sugerido, cargo por día de retraso y minutos de gracia.",
    modes: ["rental", "hybrid"],
    services: [],
    stations: null,
    flow: null,
    loyaltyPresetKey: null,
    rentalPolicy: { defaultDeposit: 500, lateFeePerDay: 200, graceMinutes: 60 },
    highlights: ["Depósito sugerido de $500", "Cargo por retraso de $200 por día", "60 minutos de gracia"],
  },
];

export const templateByKey = (key: string) => BUSINESS_TEMPLATES.find((t) => t.key === key) ?? null;
