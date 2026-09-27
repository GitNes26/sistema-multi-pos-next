export type PublicationDesignType = "product_new" | "promotion" | "notice"

/**
 * Plantillas de composición. Cada diseño elige una, más sus colores y textos;
 * así 30 diseños comparten ~17 composiciones sin duplicar código.
 */
export type FlyerLayout =
  | "arc" | "full-bleed" | "card-left" | "circle-burst" | "side-strip" | "tilted" | "banner-bottom"
  | "avatar" | "hazard" | "editorial" | "polaroid" | "sticker" | "magazine" | "ticket" | "halo"
  | "dots" | "stamp"

export interface PublicationDesign {
  id: string
  name: string
  type: PublicationDesignType
  layout: FlyerLayout
  /** Colores por defecto: [fondo, acento]. */
  colors: [string, string]
  title: string
  content: string
  /** Texto del pie o sello del flyer. */
  footer: string
  /** Símbolo grande decorativo (p. ej. "%", "2×1", "!"). */
  glyph?: string
}

// Los 10 primeros ids existían antes: se conservan para que las publicaciones
// guardadas sigan viéndose igual.
export const PUBLICATION_DESIGNS: PublicationDesign[] = [
  // ── Producto nuevo ────────────────────────────────────────────────
  { id: "new-arrival", name: "Recién llegado", type: "product_new", layout: "arc", colors: ["#064e3b", "#a7f3d0"], title: "¡Tenemos algo nuevo!", content: "Conoce la novedad que acabamos de agregar para ti.", footer: "Descúbrelo hoy" },
  { id: "spotlight", name: "Producto destacado", type: "product_new", layout: "full-bleed", colors: ["#164e63", "#67e8f9"], title: "Producto de la semana", content: "Descubre por qué se está convirtiendo en uno de los favoritos.", footer: "Favorito de la casa" },
  { id: "back-in-stock", name: "De vuelta", type: "product_new", layout: "card-left", colors: ["#0f172a", "#e2e8f0"], title: "¡Ya está disponible otra vez!", content: "El producto que esperabas regresó. Consulta disponibilidad.", footer: "Disponible nuevamente", glyph: "↺" },
  { id: "polaroid-new", name: "Instantánea", type: "product_new", layout: "polaroid", colors: ["#fef3c7", "#b45309"], title: "Recién salido", content: "Lo acabamos de recibir y queríamos que fueras el primero en verlo.", footer: "Nuevo en tienda" },
  { id: "sticker-new", name: "Etiqueta nueva", type: "product_new", layout: "sticker", colors: ["#1e1b4b", "#facc15"], title: "Estreno en tienda", content: "Pruébalo antes que nadie.", footer: "Solo en tu tienda", glyph: "NUEVO" },
  { id: "magazine-new", name: "Portada", type: "product_new", layout: "magazine", colors: ["#111827", "#f472b6"], title: "Lo más nuevo", content: "Una novedad pensada para ti.", footer: "Edición especial" },
  { id: "halo-new", name: "Resplandor", type: "product_new", layout: "halo", colors: ["#312e81", "#a5b4fc"], title: "Te presentamos", content: "Nuestro nuevo producto ya está aquí.", footer: "Recién llegado" },
  { id: "dots-new", name: "Pop", type: "product_new", layout: "dots", colors: ["#be123c", "#fde68a"], title: "¡Novedad!", content: "Algo nuevo para tu antojo de hoy.", footer: "Pídelo ya" },
  { id: "tilted-new", name: "Vitrina", type: "product_new", layout: "tilted", colors: ["#14532d", "#bbf7d0"], title: "Nuevo en la vitrina", content: "Ven a conocerlo en sucursal o pídelo en línea.", footer: "Ya disponible" },
  { id: "editorial-new", name: "Elegante", type: "product_new", layout: "editorial", colors: ["#1c1917", "#d6b98c"], title: "Una nueva favorita", content: "Calidad que se nota desde el primer momento.", footer: "Colección nueva" },

  // ── Promoción ─────────────────────────────────────────────────────
  { id: "limited-offer", name: "Oferta limitada", type: "promotion", layout: "circle-burst", colors: ["#78350f", "#fcd34d"], title: "Aprovecha antes de que termine", content: "Promoción disponible por tiempo limitado. Aplican condiciones.", footer: "Tiempo limitado" },
  { id: "percentage", name: "Descuento", type: "promotion", layout: "side-strip", colors: ["#881337", "#fda4af"], title: "Un beneficio especial para ti", content: "Visítanos y aprovecha esta promoción en productos participantes.", footer: "Promoción especial", glyph: "%" },
  { id: "weekend", name: "Fin de semana", type: "promotion", layout: "tilted", colors: ["#4c1d95", "#c4b5fd"], title: "Este fin de semana hay más", content: "Consulta los productos y horarios participantes.", footer: "Solo este fin" },
  { id: "coupon", name: "Cupón", type: "promotion", layout: "ticket", colors: ["#7f1d1d", "#fecaca"], title: "Cupón de descuento", content: "Muéstralo en caja o úsalo en tu pedido en línea.", footer: "Válido en tienda y en línea", glyph: "-15%" },
  { id: "two-for-one", name: "2×1", type: "promotion", layout: "sticker", colors: ["#0c4a6e", "#fde047"], title: "Llévate dos, paga uno", content: "En productos seleccionados, mientras haya existencias.", footer: "Hasta agotar existencias", glyph: "2×1" },
  { id: "flash", name: "Relámpago", type: "promotion", layout: "hazard", colors: ["#18181b", "#facc15"], title: "Oferta relámpago", content: "Solo por unas horas. ¡No te la pierdas!", footer: "Solo hoy", glyph: "⚡" },
  { id: "combo-deal", name: "Combo", type: "promotion", layout: "magazine", colors: ["#9a3412", "#fed7aa"], title: "Arma tu combo y ahorra", content: "Combina tus favoritos a un precio especial.", footer: "Precio especial" },
  { id: "happy-hour", name: "Hora feliz", type: "promotion", layout: "halo", colors: ["#701a75", "#f0abfc"], title: "Hora feliz", content: "Precios especiales en el horario de promoción.", footer: "Consulta horarios" },
  { id: "loyalty-bonus", name: "Puntos dobles", type: "promotion", layout: "dots", colors: ["#065f46", "#fbbf24"], title: "Gana puntos dobles", content: "Acumula el doble de puntos en tus compras participantes.", footer: "Programa de lealtad", glyph: "×2" },
  { id: "season-sale", name: "Temporada", type: "promotion", layout: "full-bleed", colors: ["#1e3a8a", "#fca5a5"], title: "Rebajas de temporada", content: "Descuentos en productos seleccionados por tiempo limitado.", footer: "Temporada de ofertas" },

  // ── Aviso ─────────────────────────────────────────────────────────
  { id: "schedule", name: "Cambio de horario", type: "notice", layout: "banner-bottom", colors: ["#1e3a8a", "#93c5fd"], title: "Aviso sobre nuestro horario", content: "Revisa nuestros horarios antes de visitarnos.", footer: "Horario" },
  { id: "service", name: "Servicio", type: "notice", layout: "avatar", colors: ["#134e4a", "#99f6e4"], title: "Información importante del servicio", content: "Te compartimos una actualización para planear mejor tu visita.", footer: "Servicio" },
  { id: "maintenance", name: "Mantenimiento", type: "notice", layout: "hazard", colors: ["#7c2d12", "#fdba74"], title: "Mantenimiento programado", content: "Algunas funciones o servicios podrían no estar disponibles temporalmente.", footer: "Información de servicio", glyph: "!" },
  { id: "general", name: "Comunicado", type: "notice", layout: "editorial", colors: ["#171717", "#f5f5f5"], title: "Tenemos un aviso para ti", content: "Lee esta información antes de tu próxima compra o visita.", footer: "Comunicado" },
  { id: "holiday", name: "Día festivo", type: "notice", layout: "stamp", colors: ["#7c2d12", "#fef08a"], title: "Horario de día festivo", content: "Ese día atenderemos en un horario especial.", footer: "Día festivo", glyph: "★" },
  { id: "closed", name: "Cerrado", type: "notice", layout: "stamp", colors: ["#450a0a", "#fca5a5"], title: "Permaneceremos cerrados", content: "Retomamos actividades en la fecha indicada. ¡Gracias por tu comprensión!", footer: "Aviso", glyph: "✕" },
  { id: "new-branch", name: "Nueva sucursal", type: "notice", layout: "polaroid", colors: ["#ecfeff", "#0e7490"], title: "¡Abrimos nueva sucursal!", content: "Te esperamos en nuestra nueva ubicación.", footer: "Gran apertura" },
  { id: "delivery", name: "Envíos", type: "notice", layout: "card-left", colors: ["#0f766e", "#ccfbf1"], title: "Ahora con envío a domicilio", content: "Haz tu pedido desde el portal y recíbelo en casa.", footer: "Pide en línea", glyph: "➜" },
  { id: "thanks", name: "Agradecimiento", type: "notice", layout: "halo", colors: ["#831843", "#fbcfe8"], title: "¡Gracias por tu preferencia!", content: "Cada visita nos motiva a mejorar.", footer: "Con cariño" },
  { id: "survey", name: "Tu opinión", type: "notice", layout: "ticket", colors: ["#1e40af", "#bfdbfe"], title: "Queremos escucharte", content: "Cuéntanos cómo fue tu experiencia en tu próxima visita.", footer: "Tu opinión cuenta", glyph: "?" },
]

export function publicationDesign(id: string | null | undefined) {
  return PUBLICATION_DESIGNS.find((design) => design.id === id) ?? PUBLICATION_DESIGNS.find((d) => d.id === "general")!
}

export function designsForType(type: PublicationDesignType) {
  return PUBLICATION_DESIGNS.filter((d) => d.type === type)
}
