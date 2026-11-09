// Opciones precargadas de fidelidad: el dueño elige una, la ajusta a su gusto (cuántas visitas, qué servicios,
// qué porcentaje cubre cada crédito, vigencia de la membresía…) y la activa. Sin dependencias de servidor:
// se usa también en el cliente.

export type LoyaltyKind = "visit_card" | "prepaid_pack" | "membership";

export interface LoyaltyPreset {
  key: string;
  kind: LoyaltyKind;
  name: string;
  /** Texto corto que explica la idea al elegirla. */
  blurb: string;
  visitsRequired: number | null;
  /** Paquete: servicios incluidos. Membresía: créditos por periodo. */
  packUses: number | null;
  discountPercent: number;
  /** Solo membresía. */
  periodDays?: number;
  rollover?: boolean;
  reminderDays?: number;
  terms?: string;
}

export const LOYALTY_PRESETS: LoyaltyPreset[] = [
  { key: "visit_5_free", kind: "visit_card", name: "Cada 5 servicios, el siguiente gratis", blurb: "Tarjeta de visitas: al completar 5 servicios el cliente gana uno gratis.", visitsRequired: 5, packUses: null, discountPercent: 100 },
  { key: "visit_10_free", kind: "visit_card", name: "Cada 10 servicios, uno gratis", blurb: "Tarjeta de visitas más pausada: 10 servicios para ganar uno gratis.", visitsRequired: 10, packUses: null, discountPercent: 100 },
  { key: "visit_4_half", kind: "visit_card", name: "Cada 4 servicios, 50% en el siguiente", blurb: "Premio más barato para ti: cada 4 servicios, la mitad en el siguiente.", visitsRequired: 4, packUses: null, discountPercent: 50 },
  { key: "pack_5", kind: "prepaid_pack", name: "Paquete de 5 servicios", blurb: "El cliente paga 5 servicios por adelantado (con tu precio de paquete) y los va usando.", visitsRequired: null, packUses: 5, discountPercent: 100 },
  { key: "pack_10", kind: "prepaid_pack", name: "Paquete de 10 servicios", blurb: "Paquete grande para clientes frecuentes, con tu mejor precio.", visitsRequired: null, packUses: 10, discountPercent: 100 },
  {
    key: "member_4", kind: "membership", name: "Membresía mensual: 4 servicios al mes", blurb: "El cliente paga una cuota cada mes y recibe 4 servicios que se renuevan con cada pago.",
    visitsRequired: null, packUses: 4, discountPercent: 100, periodDays: 30, rollover: false, reminderDays: 3,
    terms: "Los servicios incluidos se renuevan al pagar la cuota del mes. Los servicios sin usar no se acumulan. La membresía es personal e intransferible.",
  },
  {
    key: "member_8_carry", kind: "membership", name: "Membresía mensual: 8 servicios (se acumulan)", blurb: "Más servicios por mes, y los que no use se pasan al siguiente si renueva a tiempo.",
    visitsRequired: null, packUses: 8, discountPercent: 100, periodDays: 30, rollover: true, reminderDays: 5,
    terms: "Los servicios sin usar pasan al siguiente periodo si la membresía se renueva antes de vencer. Si vence, se pierden. La membresía es personal e intransferible.",
  },
];

export const presetByKey = (key: string | null | undefined) => LOYALTY_PRESETS.find((p) => p.key === key) ?? null;

export const LOYALTY_KIND_LABEL: Record<LoyaltyKind, string> = {
  visit_card: "Tarjeta de visitas",
  prepaid_pack: "Paquete prepagado",
  membership: "Membresía",
};
