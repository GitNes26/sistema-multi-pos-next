import { prisma } from "@/lib/db"
import { persistNotification } from "@/lib/notifications/helpers"

// Avisos al cliente por canales intercambiables. Hoy: app (campana del portal) y notificación push,
// que van juntas en `persistNotification`. WhatsApp queda preparado como canal futuro: basta con
// registrar un `CustomerChannel` real en `CHANNELS` (y guardar la preferencia del cliente); quien
// avisa (órdenes de servicio, citas…) no cambia.

export interface CustomerMessage {
  organizationId: string
  customerId: string
  /** Tipo de aviso (clasifica y permite plantillas por canal). */
  kind: string
  title: string
  body: string
  /** Ruta dentro del portal a la que lleva el aviso. */
  link?: string
  locationId?: string | null
}

export interface CustomerContact {
  customerId: string
  userId: string | null
  phone: string | null
  fullName: string
}

export interface CustomerChannel {
  id: "app" | "whatsapp"
  /** ¿Este canal puede avisarle a este cliente ahora? (cuenta del portal, teléfono, proveedor configurado…) */
  available(contact: CustomerContact): boolean
  send(contact: CustomerContact, message: CustomerMessage): Promise<boolean>
}

/** App del portal + notificación push (requiere que el cliente tenga cuenta en el portal). */
const appChannel: CustomerChannel = {
  id: "app",
  available: (c) => Boolean(c.userId),
  async send(contact, message) {
    await persistNotification({
      organizationId: message.organizationId,
      locationId: message.locationId ?? null,
      recipientUserId: contact.userId,
      kind: message.kind,
      title: message.title,
      body: message.body,
      link: message.link,
      metadata: { customerId: contact.customerId },
    })
    return true
  },
}

/**
 * WhatsApp: pendiente. Se activa registrando un proveedor (API de WhatsApp Business) aquí; mientras no
 * exista, `available` es falso y el aviso simplemente no se envía por este canal.
 */
const whatsappChannel: CustomerChannel = {
  id: "whatsapp",
  available: () => false,
  async send() {
    return false
  },
}

export const CHANNELS: CustomerChannel[] = [appChannel, whatsappChannel]

/** Avisa al cliente por todos los canales disponibles. Nunca lanza: un aviso fallido no debe frenar la operación. */
export async function notifyCustomer(message: CustomerMessage): Promise<string[]> {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: message.customerId, organizationId: message.organizationId },
      select: { id: true, userId: true, phone: true, fullName: true },
    })
    if (!customer) return []
    const contact: CustomerContact = { customerId: customer.id, userId: customer.userId, phone: customer.phone, fullName: customer.fullName }
    const sent: string[] = []
    for (const channel of CHANNELS) {
      if (!channel.available(contact)) continue
      try {
        if (await channel.send(contact, message)) sent.push(channel.id)
      } catch (err) {
        console.error(`[notify] canal ${channel.id}:`, err)
      }
    }
    return sent
  } catch (err) {
    console.error("[notify] aviso al cliente:", err)
    return []
  }
}
