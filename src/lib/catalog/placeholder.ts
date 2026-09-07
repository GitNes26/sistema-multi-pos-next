/**
 * Imágenes placeholder del catálogo compartidas por todas las superficies.
 *
 * Un producto sin foto real recibe un SVG generado: gradiente derivado de su
 * categoría + emoji del producto. Tres formas de consumirlo:
 *
 * 1. URL de la ruta (`/api/placeholder/image?...`) — la usan los seeds para
 *    poblar `imageUrl`, de modo que subir una foto real después es un flujo
 *    idéntico a cualquier archivo.
 * 2. Data-URI (`dataUri`) — para exportes de Excel/PDF o previews sin red.
 * 3. Colores directos (`categoryColors`) — para anillos/puntos decorativos en
 *    tarjetas que no necesitan una imagen completa.
 */

export const FALLBACK_CATEGORY_COLOR: [string, string] = ["#94a3b8", "#475569"];

/**
 * Paleta por categoría. Clave = nombre exacto de la categoría en los seeds.
 * Si una categoría no está aquí, su color se deriva por hash del nombre.
 */
export const CATEGORY_COLORS: Record<string, [string, string]> = {
  // Restaurante / Híbrido (food_service)
  Desayunos: ["#fbbf24", "#d97706"],
  Entradas: ["#a3e635", "#4d7c0f"],
  "Platos fuertes": ["#fb7185", "#be123c"],
  Bebidas: ["#38bdf8", "#0369a1"],
  Postres: ["#c4b5fd", "#7c3aed"],
  Despensa: ["#d6d3d1", "#57534e"],
  "Botanas y dulces": ["#fb923c", "#c2410c"],
  Cocina: ["#f87171", "#b91c1c"],
  // Supermercado Demo (retail)
  Abarrotes: ["#fde047", "#ca8a04"],
  "Lácteos y Huevo": ["#bae6fd", "#0284c7"],
  "Frutas y Verduras": ["#86efac", "#16a34a"],
  "Carnes y Pescados": ["#fda4af", "#e11d48"],
  Panadería: ["#fdba74", "#ea580c"],
  Limpieza: ["#99f6e4", "#0d9488"],
  Electrónica: ["#a5b4fc", "#4f46e5"],
  Ropa: ["#f0abfc", "#c026d3"],
  "Salud y Cuidado": ["#ddd6fe", "#7c3aed"],
  // Estética Demo (services)
  Cortes: ["#e9d5ff", "#9333ea"],
  Color: ["#f9a8d4", "#db2777"],
  "Manicure y Pedicure": ["#fbcfe8", "#be185d"],
  Tratamientos: ["#bbf7d0", "#059669"],
  "Maquillaje y Peinado": ["#f5d0fe", "#a21caf"],
  Productos: ["#c7d2fe", "#4f46e5"],
  // Fiestas Demo (rental)
  Brincolines: ["#fca5a5", "#dc2626"],
  "Mobiliario y Carpas": ["#fdba74", "#ea580c"],
  Fotografía: ["#a5b4fc", "#4f46e5"],
  "Audio e Iluminación": ["#67e8f9", "#0891b2"],
  "Juegos y Extras": ["#fde047", "#ca8a04"],
};

/** Par [claro, oscuro] de una categoría; las desconocidas caen a un hue por hash. */
export function categoryColors(category: string | null | undefined): [string, string] {
  if (!category) return FALLBACK_CATEGORY_COLOR;
  const known = CATEGORY_COLORS[category];
  if (known) return known;
  // Hash estable (FNV-1a) → hue determinista para categorías no listadas.
  let hash = 0x811c9dc5;
  for (let i = 0; i < category.length; i++) {
    hash ^= category.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hue = hash >>> 0;
  return [`hsl(${hue % 360} 70% 82%)`, `hsl(${hue % 360} 70% 38%)`];
}

/** CSS del color claro de la categoría (para puntos/anillos decorativos). */
export function categoryAccent(category: string | null | undefined): string {
  return categoryColors(category)[0];
}

/** Construye el SVG del placeholder como string. */
export function placeholderSvg(
  emoji: string | null | undefined,
  category: string | null | undefined,
  opts?: { width?: number; height?: number }
): string {
  const width = opts?.width ?? 400;
  const height = opts?.height ?? 300;
  const [a, b] = categoryColors(category);
  const emojiText = emoji ?? "";
  const fontSize = Math.round(Math.min(width, height) * 0.4);
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/>` +
    `</linearGradient></defs><rect width='${width}' height='${height}' fill='url(#g)'/>` +
    `<text x='${width / 2}' y='${height / 2 + fontSize * 0.12}' font-size='${fontSize}' text-anchor='middle'` +
    ` dominant-baseline='middle'>${emojiText}</text></svg>`
  );
}

/** URL absoluta de datos (data-URI) del placeholder. */
export function placeholderDataUri(
  emoji: string | null | undefined,
  category: string | null | undefined
): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(placeholderSvg(emoji, category))}`;
}

/**
 * URL de la ruta de imágenes (`/api/placeholder/image`) — el formato que
 * guardan los seeds en `imageUrl`: se sirve como archivo normal, así que los
 * flujos de subida que después la reemplazan se comportan igual.
 */
export function placeholderImageUrl(
  emoji: string | null | undefined,
  category: string | null | undefined
): string {
  const params = new URLSearchParams();
  if (emoji) params.set("e", emoji);
  if (category) params.set("c", category);
  return `/api/placeholder/image?${params.toString()}`;
}
