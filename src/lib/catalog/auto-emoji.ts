import { placeholderImageUrl } from "@/lib/catalog/placeholder"

// Emoji automático para productos y categorías sin foto: se elige por palabras
// clave del nombre (sin importar acentos ni mayúsculas) y, si no hay
// coincidencia, por la categoría. Con él y el color de la categoría se arma la
// imagen ilustrada que se guarda por defecto.

const RULES: [RegExp, string][] = [
  // Bebidas
  [/\b(cafe|capuchino|cappuccino|latte|americano|espresso|expreso)\b/, "☕"],
  [/\b(te|tisana|chai|matcha)\b/, "🍵"],
  [/\b(refresco|soda|cola|gaseosa)\b/, "🥤"],
  [/\b(agua)\b/, "💧"],
  [/\b(jugo|licuado|smoothie|naranjada|limonada)\b/, "🧃"],
  [/\b(cerveza|chela)\b/, "🍺"],
  [/\b(vino)\b/, "🍷"],
  [/\b(tequila|mezcal|whisky|ron|vodka|coctel|mojito|margarita)\b/, "🍸"],
  [/\b(leche|lacteo|yogur|yoghurt)\b/, "🥛"],
  [/\b(malteada|frappe|frape)\b/, "🥤"],
  // Comida
  [/\b(pizza)\b/, "🍕"],
  [/\b(hamburguesa|burger)\b/, "🍔"],
  [/\b(hot ?dog|salchicha)\b/, "🌭"],
  [/\b(taco|tacos|pastor|suadero)\b/, "🌮"],
  [/\b(burrito|quesadilla|gringa)\b/, "🌯"],
  [/\b(torta|sandwich|sandwiches|baguette)\b/, "🥪"],
  [/\b(enchilada|chilaquil|mole|guisado)\b/, "🫔"],
  [/\b(sopa|caldo|pozole|consome|menudo|crema)\b/, "🍲"],
  [/\b(ensalada)\b/, "🥗"],
  [/\b(pasta|espagueti|spaghetti|lasana|alfredo)\b/, "🍝"],
  [/\b(sushi|roll)\b/, "🍣"],
  [/\b(ramen|fideo)\b/, "🍜"],
  [/\b(arroz)\b/, "🍚"],
  [/\b(pollo|alitas|nuggets|pechuga|milanesa)\b/, "🍗"],
  [/\b(carne|res|bistec|costilla|arrachera|filete)\b/, "🥩"],
  [/\b(pescado|atun|salmon|camaron|mariscos)\b/, "🐟"],
  [/\b(huevo|huevos|omelette)\b/, "🍳"],
  [/\b(papas|fritas)\b/, "🍟"],
  [/\b(pan|bolillo|concha|cuernito|croissant|dona|donas)\b/, "🥐"],
  [/\b(pastel|tarta|cheesecake|flan|gelatina|postre)\b/, "🍰"],
  [/\b(helado|nieve|paleta)\b/, "🍨"],
  [/\b(galleta|galletas)\b/, "🍪"],
  [/\b(chocolate|dulce|dulces|caramelo|chicle)\b/, "🍫"],
  [/\b(botana|chicharron|cacahuate|palomitas|totopos|nachos)\b/, "🍿"],
  [/\b(fruta|manzana|platano|pera|uva|fresa|mango|naranja|limon)\b/, "🍎"],
  [/\b(verdura|lechuga|tomate|jitomate|cebolla|zanahoria|papa)\b/, "🥕"],
  [/\b(queso)\b/, "🧀"],
  [/\b(frijol|lenteja|semilla|cereal|avena|harina|azucar|sal)\b/, "🌾"],
  [/\b(aceite)\b/, "🫒"],
  [/\b(tortilla)\b/, "🫓"],
  [/\b(lata|enlatado|conserva)\b/, "🥫"],
  // Hogar, salud y otros
  [/\b(jabon|detergente|cloro|limpiador|limpieza|suavizante)\b/, "🧼"],
  [/\b(papel|servilleta|toalla)\b/, "🧻"],
  [/\b(shampoo|champu|crema|cosmetico|maquillaje|labial)\b/, "💄"],
  [/\b(medicina|pastilla|vitamina|alcohol|farmacia)\b/, "💊"],
  [/\b(pila|pilas|bateria|cargador|cable|audifonos|bocina|electronica)\b/, "🔋"],
  [/\b(playera|camisa|pantalon|ropa|sudadera|vestido)\b/, "👕"],
  [/\b(zapato|tenis|sandalia)\b/, "👟"],
  [/\b(juguete|pelota|juego)\b/, "🧸"],
  [/\b(corte|cabello|barba|peinado)\b/, "💇"],
  [/\b(manicure|pedicure|unas)\b/, "💅"],
  [/\b(masaje|spa|facial|tratamiento)\b/, "💆"],
  [/\b(brincolin|inflable)\b/, "🎪"],
  [/\b(silla|mesa|mobiliario|carpa)\b/, "🪑"],
  [/\b(foto|fotografia|camara)\b/, "📷"],
  [/\b(audio|sonido|luz|iluminacion|dj)\b/, "🎵"],
  [/\b(flor|flores|ramo)\b/, "💐"],
  [/\b(mascota|perro|gato|croquetas)\b/, "🐾"],
  [/\b(regalo|combo|paquete|kit)\b/, "🎁"],
  [/\b(tornillo|clavo|martillo|herramienta|ferreteria|pinzas|taladro)\b/, "🔧"],
  [/\b(pluma|lapiz|cuaderno|libreta|papeleria|escolar)\b/, "✏️"],
  // Nombres de categoría genéricos (respaldo)
  [/\b(bebidas?|drinks?)\b/, "🥤"],
  [/\b(postres?|reposteria)\b/, "🍰"],
  [/\b(desayunos?)\b/, "🍳"],
  [/\b(entradas?|antojitos?)\b/, "🥟"],
  [/\b(platos?|comidas?|fuertes?|cocina)\b/, "🍽️"],
  [/\b(abarrotes|despensa|super)\b/, "🛒"],
  [/\b(panaderia)\b/, "🥐"],
  [/\b(carnes?|carniceria)\b/, "🥩"],
  [/\b(lacteos?)\b/, "🥛"],
  [/\b(frutas?|verduras?)\b/, "🥬"],
  [/\b(salud|cuidado|higiene)\b/, "🧴"],
  [/\b(hogar)\b/, "🏠"],
]

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

/** Emoji que mejor representa el texto, o null si no hay coincidencia. */
export function emojiFor(text: string | null | undefined): string | null {
  if (!text) return null
  const t = normalize(text)
  for (const [re, emoji] of RULES) if (re.test(t)) return emoji
  return null
}

export const DEFAULT_PRODUCT_EMOJI = "🛍️"
export const DEFAULT_CATEGORY_EMOJI = "🏷️"

/** ¿La URL es una imagen ilustrada generada (y no una foto subida)? */
export function isPlaceholderImage(url: string | null | undefined): boolean {
  return !url || url.startsWith("/api/placeholder/image")
}

/** Imagen ilustrada por defecto de un producto: emoji del nombre + color de su categoría. */
export function productPlaceholder(name: string, categoryName: string | null | undefined): string {
  const emoji = emojiFor(name) ?? emojiFor(categoryName) ?? DEFAULT_PRODUCT_EMOJI
  return placeholderImageUrl(emoji, categoryName ?? null)
}

/** Imagen ilustrada por defecto de una categoría: emoji y color propios. */
export function categoryPlaceholder(name: string): string {
  return placeholderImageUrl(emojiFor(name) ?? DEFAULT_CATEGORY_EMOJI, name)
}

/** Mismo placeholder con otra categoría (conserva el emoji ya elegido). */
export function recolorPlaceholder(url: string, categoryName: string | null): string {
  const q = url.split("?")[1] ?? ""
  const emoji = new URLSearchParams(q).get("e")
  return placeholderImageUrl(emoji, categoryName)
}
