// Utilidades de fechas para reservaciones de mesa: días en formato YYYY-MM-DD
// LOCAL (new Date("YYYY-MM-DD") es UTC y corre un día en zonas atrasadas) y el
// rango [00:00, 24:00) de un día. Compartido por servidor y cliente.

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" → medianoche LOCAL. */
export function fromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y || 0, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

/** Rango [00:00, 24:00) local del día "YYYY-MM-DD". */
export function dayBounds(ymd: string): { from: Date; to: Date } {
  const from = fromYmd(ymd);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

/** "HH:MM" del día local → minutos desde medianoche. */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
