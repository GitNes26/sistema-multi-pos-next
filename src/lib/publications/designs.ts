export type PublicationDesignType = "product_new" | "promotion" | "notice"

export interface PublicationDesign {
  id: string
  name: string
  type: PublicationDesignType
  title: string
  content: string
  className: string
  accentClassName: string
}

export const PUBLICATION_DESIGNS: PublicationDesign[] = [
  { id: "new-arrival", name: "Recién llegado", type: "product_new", title: "¡Tenemos algo nuevo!", content: "Conoce la novedad que acabamos de agregar para ti.", className: "bg-emerald-950 text-emerald-50", accentClassName: "bg-emerald-300 text-emerald-950" },
  { id: "spotlight", name: "Producto destacado", type: "product_new", title: "Producto de la semana", content: "Descubre por qué se está convirtiendo en uno de los favoritos.", className: "bg-cyan-950 text-cyan-50", accentClassName: "bg-cyan-300 text-cyan-950" },
  { id: "back-in-stock", name: "De vuelta", type: "product_new", title: "¡Ya está disponible otra vez!", content: "El producto que esperabas regresó. Consulta disponibilidad.", className: "bg-slate-900 text-slate-50", accentClassName: "bg-white text-slate-950" },
  { id: "limited-offer", name: "Oferta limitada", type: "promotion", title: "Aprovecha antes de que termine", content: "Promoción disponible por tiempo limitado. Aplican condiciones.", className: "bg-amber-950 text-amber-50", accentClassName: "bg-amber-300 text-amber-950" },
  { id: "percentage", name: "Descuento", type: "promotion", title: "Un beneficio especial para ti", content: "Visítanos y aprovecha esta promoción en productos participantes.", className: "bg-rose-950 text-rose-50", accentClassName: "bg-rose-300 text-rose-950" },
  { id: "weekend", name: "Fin de semana", type: "promotion", title: "Este fin de semana hay más", content: "Consulta los productos y horarios participantes.", className: "bg-violet-950 text-violet-50", accentClassName: "bg-violet-300 text-violet-950" },
  { id: "schedule", name: "Cambio de horario", type: "notice", title: "Aviso sobre nuestro horario", content: "Revisa nuestros horarios antes de visitarnos.", className: "bg-blue-950 text-blue-50", accentClassName: "bg-blue-300 text-blue-950" },
  { id: "service", name: "Servicio", type: "notice", title: "Información importante del servicio", content: "Te compartimos una actualización para planear mejor tu visita.", className: "bg-teal-950 text-teal-50", accentClassName: "bg-teal-300 text-teal-950" },
  { id: "maintenance", name: "Mantenimiento", type: "notice", title: "Mantenimiento programado", content: "Algunas funciones o servicios podrían no estar disponibles temporalmente.", className: "bg-orange-950 text-orange-50", accentClassName: "bg-orange-300 text-orange-950" },
  { id: "general", name: "Comunicado", type: "notice", title: "Tenemos un aviso para ti", content: "Lee esta información antes de tu próxima compra o visita.", className: "bg-neutral-900 text-neutral-50", accentClassName: "bg-neutral-100 text-neutral-950" },
]

export function publicationDesign(id: string | null | undefined) {
  return PUBLICATION_DESIGNS.find((design) => design.id === id) ?? PUBLICATION_DESIGNS[9]
}
