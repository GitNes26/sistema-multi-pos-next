/**
 * Nombre de un artículo personalizado sin los tópicos entre paréntesis.
 * Las ventas anteriores guardaron «Producto · Variante (Tópico, Tópico)»; los
 * tópicos ya se muestran en su propia leyenda, así que aquí se quitan.
 */
export function cleanItemName(name: string, productType?: string | null): string {
  if (productType !== "custom") return name
  return name.replace(/\s*\([^()]*\)\s*$/, "")
}
