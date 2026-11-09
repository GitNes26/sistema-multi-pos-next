import type { BusinessMode } from "@/lib/auth/options"

// Qué capacidades de los verticales aplican a cada tipo de negocio. Fuente única: la usan el menú (features), las
// páginas, las APIs y los asistentes, para que ninguna función aparezca ni funcione donde no tiene sentido.
//
//                                      retail  food  services  rental  hybrid
//  Tarjeta de visitas                    ✓      ✓       ✓        ·       ✓
//  Paquetes prepagados y membresías      ·      ·       ✓        ·       ✓   (cobro de la cuota manual o en línea: igual)
//  Garantías de servicio                 ·      ·       ✓        ·       ✓
//  Envases retornables (importe)         ✓      ✓       ·        ·       ✓
//  Vehículos/fichas, bahías y sillas     ·      ·       ✓        ·       ✓   (órdenes de servicio y citas, idem)
//  Reservaciones de renta y paquetes     ·      ·       ·        ✓       ✓   (depósito, entrega/devolución, penalizaciones)
//  Plantillas de arranque                según la plantilla: autolavado y barbería → servicios/híbrido; renta → renta/híbrido
//
// La renta no canjea créditos de fidelidad: su cobro pasa por la reservación (depósito y paquetes de renta).

export type LoyaltyKindKey = "visit_card" | "prepaid_pack" | "membership"

export const LOYALTY_KIND_MODES: Record<LoyaltyKindKey, readonly BusinessMode[]> = {
  visit_card: ["retail", "food_service", "services", "hybrid"],
  prepaid_pack: ["services", "hybrid"],
  membership: ["services", "hybrid"],
}

export const LOYALTY_MODES: readonly BusinessMode[] = ["retail", "food_service", "services", "hybrid"]
export const WARRANTY_MODES: readonly BusinessMode[] = ["services", "hybrid"]
export const CONTAINER_MODES: readonly BusinessMode[] = ["retail", "food_service", "hybrid"]
export const SERVICE_STATION_MODES: readonly BusinessMode[] = ["services", "hybrid"]

/** Tipos de programa de fidelidad que puede usar un tipo de negocio. */
export function loyaltyKindsFor(mode: BusinessMode | string | null | undefined): LoyaltyKindKey[] {
  return (Object.keys(LOYALTY_KIND_MODES) as LoyaltyKindKey[]).filter((kind) => LOYALTY_KIND_MODES[kind].includes(mode as BusinessMode))
}

export const LOYALTY_KIND_NAMES: Record<LoyaltyKindKey, string> = {
  visit_card: "La tarjeta de visitas",
  prepaid_pack: "Los paquetes prepagados",
  membership: "Las membresías",
}

const MODE_NAMES: Record<string, string> = {
  retail: "Tienda / Abarrotes",
  food_service: "Restaurante / Café",
  services: "Servicios",
  rental: "Renta",
  hybrid: "Híbrido",
}

/** Texto para explicar que algo no aplica al tipo de negocio de la empresa. */
export function notForModeMessage(what: string, mode: BusinessMode | string | null | undefined, modes: readonly BusinessMode[]): string {
  const names = modes.map((m) => MODE_NAMES[m] ?? m).join(", ")
  return `${what}: función no disponible para tu tipo de negocio (${MODE_NAMES[mode ?? ""] ?? "otro"}). Está disponible en: ${names}.`
}
