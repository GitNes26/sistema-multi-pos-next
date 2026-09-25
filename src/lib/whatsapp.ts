type PlanContact = {
  name: string
  monthlyPrice: number | string | { toString(): string }
  includedLocations: number
  includedEmployees: number
}

const DEFAULT_MESSAGE =
  "Hola, me interesa Multi-POS para mi negocio. Quisiera conocer los planes, cómo se adapta a mi operación y qué necesito para comenzar. ¿Podrían ayudarme?"

function configuredMessage() {
  const value = process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE?.trim()
  if (!value) return DEFAULT_MESSAGE
  try {
    return decodeURIComponent(value.replace(/\+/g, "%20"))
  } catch {
    return value
  }
}

export function whatsappUrl(message = configuredMessage()) {
  const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "")
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function planWhatsappUrl(plan: PlanContact) {
  const price = Number(plan.monthlyPrice).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  })
  return whatsappUrl(
    `Hola, me interesa contratar el plan ${plan.name} de Multi-POS (${price} al mes), que incluye ${plan.includedLocations} sucursal(es) y ${plan.includedEmployees} empleado(s). ¿Podrían explicarme el proceso de contratación y ayudarme a confirmar si es el plan adecuado para mi negocio?`,
  )
}
