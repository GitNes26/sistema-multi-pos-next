// Cálculo puro del canje de un crédito de fidelidad (lo comparten el POS y el servidor).

export interface RedeemLine {
  productId: string;
  unitPrice: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Un crédito cubre `percent`% de UNA unidad elegible: la más barata (así el premio nunca excede lo pactado). */
export function redemptionAmount(lines: RedeemLine[], targetProductIds: string[], percent: number, excludeProductIds: string[] = []): number {
  const prices = lines
    .filter((l) => !excludeProductIds.includes(l.productId) && (targetProductIds.length === 0 || targetProductIds.includes(l.productId)))
    .map((l) => l.unitPrice)
    .filter((p) => p > 0);
  if (!prices.length) return 0;
  return round2((Math.min(...prices) * Math.min(100, Math.max(0, percent))) / 100);
}
