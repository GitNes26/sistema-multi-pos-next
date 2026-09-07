import { NextResponse } from "next/server";
import {
  placeholderSvg,
  FALLBACK_CATEGORY_COLOR,
} from "@/lib/catalog/placeholder";

// GET /api/placeholder/image?e=🍕&c=Platos%20fuertes
// Imagen placeholder del catálogo generada al vuelo: gradiente por categoría +
// emoji, servida como archivo SVG con caché inmutable (el contenido solo
// depende de la query, así que la caché es segura y eterna).
//
// La usan los seeds al poblar `imageUrl` de productos sin foto real: como la
// celda apunta a una ruta HTTP en vez de a un data-URI, subir después una foto
// desde admin reemplaza la URL con el mismo flujo de siempre.
//
// Nota: sin `force-static` a propósito — ese modo vacía los search params del
// request en route handlers. La caché inmutable la llevan los headers.

const SVG_HEADERS: Record<string, string> = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=31536000, immutable",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const emoji = searchParams.get("e") ?? "";
  const category = searchParams.get("c");

  // Sin emoji no hay placeholder que dibujar (los seeds siempre lo mandan).
  if (!emoji) {
    return NextResponse.redirect(
      new URL(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='${FALLBACK_CATEGORY_COLOR[0]}'/></svg>`
        )}`
      ),
      302
    );
  }

  // El emoji viaja como texto del SVG; SVG se sirve con charset explícito y
  // los parámetros son texto controlado (sin markup: <text> escapa por
  // construcción en el builder — ver placeholderSvg).
  const svg = placeholderSvg(emoji, category);
  return new NextResponse(svg, { headers: SVG_HEADERS });
}
