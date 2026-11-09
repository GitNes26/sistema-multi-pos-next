// Opciones precargadas de garantía de servicio (el dueño elige una y ajusta ventana, porcentaje y servicios).
// Sin dependencias de servidor: se usa también en el cliente.

export interface WarrantyPreset {
  key: string;
  name: string;
  blurb: string;
  windowHours: number;
  sameDayOnly: boolean;
  discountPercent: number;
}

export const WARRANTY_PRESETS: WarrantyPreset[] = [
  { key: "rain_same_day", name: "Lluvia el mismo día", blurb: "Si llueve el mismo día del servicio, el cliente repite el lavado sin costo presentando su ticket.", windowHours: 24, sameDayOnly: true, discountPercent: 100 },
  { key: "redo_24h_free", name: "Repetir gratis en 24 horas", blurb: "Si el cliente no queda conforme, repite el servicio gratis dentro de las 24 horas.", windowHours: 24, sameDayOnly: false, discountPercent: 100 },
  { key: "redo_48h_half", name: "Repetir en 48 horas a mitad de precio", blurb: "Una garantía más cuidadosa para ti: repite el servicio con 50% dentro de 48 horas.", windowHours: 48, sameDayOnly: false, discountPercent: 50 },
];

export const warrantyPresetByKey = (key: string | null | undefined) => WARRANTY_PRESETS.find((p) => p.key === key) ?? null;

/** Texto del ticket: la leyenda del dueño o una armada con las condiciones configuradas. */
export function warrantyLegendText(rule: { name: string; windowHours: number; sameDayOnly: boolean; discountPercent: number; legend: string | null }): string {
  if (rule.legend?.trim()) return rule.legend.trim();
  const when = rule.sameDayOnly ? "el mismo día de tu servicio" : rule.windowHours % 24 === 0 ? `dentro de ${rule.windowHours / 24} ${rule.windowHours === 24 ? "día" : "días"}` : `dentro de ${rule.windowHours} horas`;
  const what = rule.discountPercent >= 100 ? "sin costo" : `con ${rule.discountPercent}% de descuento`;
  return `Garantía «${rule.name}»: presenta este ticket ${when} para repetir tu servicio ${what}.`;
}
