// QR de identificación del cliente (portal → POS).
//
// El contenido es solo alfanumérico a propósito: los lectores de código en
// modo "teclado" (HID) traducen símbolos como ":" o "-" según la distribución
// del teclado del equipo (en español suelen llegar como "Ñ" o "'"), mientras
// que letras y números llegan siempre bien. El id del cliente es un cuid en
// minúsculas; se compara sin distinguir mayúsculas por si el lector o el
// Bloq Mayús alteran el caso.

export const CUSTOMER_QR_PREFIX = "MPOSC"

/** Texto que se codifica en el QR del cliente. */
export function customerQrPayload(customerId: string): string {
  return `${CUSTOMER_QR_PREFIX}${customerId}`
}

/** Devuelve el id del cliente si el texto escaneado es un QR de cliente. */
export function parseCustomerQr(text: string): string | null {
  const value = text.trim()
  if (value.length <= CUSTOMER_QR_PREFIX.length) return null
  if (value.slice(0, CUSTOMER_QR_PREFIX.length).toUpperCase() !== CUSTOMER_QR_PREFIX) return null
  const id = value.slice(CUSTOMER_QR_PREFIX.length).toLowerCase()
  return /^[a-z0-9]{10,40}$/.test(id) ? id : null
}

/** true si el texto ya trae el prefijo del QR de cliente (lectura en curso o completa). */
export function looksLikeCustomerQr(text: string): boolean {
  return text.trim().toUpperCase().startsWith(CUSTOMER_QR_PREFIX)
}
