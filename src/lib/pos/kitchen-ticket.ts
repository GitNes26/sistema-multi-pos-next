import type { PosLineItem, PosProduct } from "@/types/pos"

export interface KitchenOrderItemDto {
  id: string
  productId: string | null
  variantId: string | null
  productName: string
  quantity: number
  unitPrice: number
  unitId: string | null
  comment: string | null
  selectedOptions: unknown
  extraPrice: number
  bulkQuantityDisplay: string | null
}

/**
 * Reconstruye las líneas del ticket a partir de la comanda abierta de una mesa
 * (cuenta abierta: se pide, se prepara, se sirve y se paga al final). Las
 * líneas vuelven marcadas como ya enviadas a cocina; el precio es el de la
 * comanda y el resto (impuesto, existencia, imagen) sale del catálogo.
 */
export function rebuildKitchenLines(items: KitchenOrderItemDto[], products: PosProduct[]): PosLineItem[] {
  return items
    .filter((i) => i.productId)
    .map((i) => {
      const product =
        products.find((p) => p.productId === i.productId && (p.variantId ?? null) === (i.variantId ?? null)) ??
        products.find((p) => p.productId === i.productId)
      const options = Array.isArray(i.selectedOptions) ? (i.selectedOptions as PosLineItem["selectedOptions"]) : undefined
      return {
        key: `kitchen-${i.id}`,
        productId: i.productId!,
        variantId: i.variantId,
        kind: product?.kind ?? (i.bulkQuantityDisplay ? "bulk" : "standard"),
        name: i.productName,
        imageUrl: product?.imageUrl ?? null,
        categoryId: product?.categoryId ?? null,
        unitPrice: i.unitPrice,
        unitAbbrev: "pza",
        qty: i.quantity,
        taxRate: product?.taxRate ?? 0,
        unitId: i.unitId,
        trackInventory: product?.trackInventory ?? false,
        stock: product?.stock ?? 0,
        bulkQuantityDisplay: i.bulkQuantityDisplay ?? undefined,
        notes: i.comment ?? undefined,
        selectedOptions: options && options.length ? options : undefined,
        extraPrice: i.extraPrice || undefined,
        sentQty: i.quantity,
      } satisfies PosLineItem
    })
}
