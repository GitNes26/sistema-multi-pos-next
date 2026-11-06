import { publish, subscribe } from "@/lib/realtime"

type Controller = ReadableStreamDefaultController<Uint8Array>

// Aviso en vivo de cambios en lo que se puede vender (p. ej. un servicio activado o desactivado
// desde el POS): lo escuchan las cajas de la empresa y la tienda del portal.

export interface CatalogChangePayload {
  type: "availability"
  productId: string
  isAvailable: boolean
}

const channel = (organizationId: string) => `catalog:${organizationId}`

export function openCatalogChannel(organizationId: string, controller: Controller) {
  return subscribe(channel(organizationId), controller)
}

export function broadcastCatalogChange(organizationId: string, payload: CatalogChangePayload) {
  publish(channel(organizationId), payload)
}
