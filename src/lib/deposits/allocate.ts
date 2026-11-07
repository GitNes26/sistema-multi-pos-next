// Reparto del importe de envases entre lo que el cliente pagó y lo que queda pendiente a su nombre.
// Puro: lo usan el servidor (autoridad) y el cobro (para mostrar lo mismo que se va a registrar).

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface AllocInput {
  productId: string
  /** Envases por los que se cobra importe. */
  charged: number
  unitAmount: number
}

export interface AllocLine extends AllocInput {
  /** Envases cuyo importe sí se cobró. */
  paid: number
  /** Envases cuyo importe queda pendiente (el cliente no lo pagó). */
  owed: number
  collected: number
  pendingAmount: number
}

/**
 * Reparte `available` (lo que sobra después del total y la propina) en piezas completas: no se cobran
 * fracciones de envase. Lo que no alcanza queda pendiente con el cliente, sin impedir la venta.
 */
export function allocateDeposit(lines: AllocInput[], available: number) {
  let left = Math.max(0, available) + 0.005
  const result: AllocLine[] = [...lines]
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((line) => {
      const affordable = line.unitAmount > 0 ? Math.floor(left / line.unitAmount) : 0
      const paid = Math.min(line.charged, Math.max(0, affordable))
      left -= paid * line.unitAmount
      return {
        ...line,
        paid,
        owed: line.charged - paid,
        collected: round2(paid * line.unitAmount),
        pendingAmount: round2((line.charged - paid) * line.unitAmount),
      }
    })
  return {
    lines: result,
    collected: round2(result.reduce((sum, l) => sum + l.collected, 0)),
    pendingAmount: round2(result.reduce((sum, l) => sum + l.pendingAmount, 0)),
    pendingPieces: result.reduce((sum, l) => sum + l.owed, 0),
  }
}
