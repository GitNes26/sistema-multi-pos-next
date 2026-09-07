/**
 * Auto-emparejamiento archivo → producto para la carga masiva de imágenes.
 *
 * Un archivo llamado `arroz-1kg.jpg`, `Arroz 1kg (2).png` o `752000000001.jpg`
 * se empareja solo con el producto cuyo nombre, SKU o código de barras
 * coincida. Funciones puras (sin imports de servidor) para poder probarlas y
 * reutilizarlas en cliente.
 */

export interface MatchableProduct {
  id: string;
  name: string;
  skus?: (string | null | undefined)[];
  barcodes?: (string | null | undefined)[];
}

/** Minúsculas, sin acentos y con espacios colapsados. */
export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Como normalizeForMatch pero quitando también separadores: tolera guiones, guiones bajos y puntos entre palabras ("arroz-1kg" ≙ "arroz 1kg"). */
function collapse(value: string): string {
  return normalizeForMatch(value).replace(/[\s._-]+/g, "");
}

/**
 * Nombre de archivo sin extensión y sin sufijos de duplicados del sistema:
 * `arroz (1).jpg` → `arroz`, `foto - copia.png` → `foto`. No se recortan
 * dígitos sueltos para no romper archivos nombrados por SKU o código de
 * barras.
 */
export function stemFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  let stem = dot > 0 ? filename.slice(0, dot) : filename;
  stem = stem.replace(/\s*[([]\s*(?:\d+|copia|copy)\s*[)\]]\s*$/i, "");
  stem = stem.replace(/\s*-\s*(?:copia|copy)\s*$/i, "");
  return stem;
}

/**
 * Encuentra el producto que corresponde a un archivo, o null si no hay
 * coincidencia. Dos pasadas: exacta (nombre/SKU/código ya normalizados) y
 * relajada (ignora espacios, guiones, guiones bajos y puntos).
 */
export function matchFileToProduct(
  filename: string,
  products: MatchableProduct[]
): MatchableProduct | null {
  const stem = stemFilename(filename);
  const exact = normalizeForMatch(stem);
  const loose = collapse(stem);
  if (!exact) return null;

  for (const p of products) {
    if (normalizeForMatch(p.name) === exact) return p;
    for (const sku of p.skus ?? []) {
      if (sku && normalizeForMatch(sku) === exact) return p;
    }
    for (const bc of p.barcodes ?? []) {
      if (bc && normalizeForMatch(bc) === exact) return p;
    }
  }

  for (const p of products) {
    if (collapse(p.name) === loose) return p;
    for (const sku of p.skus ?? []) {
      if (sku && collapse(sku) === loose) return p;
    }
    for (const bc of p.barcodes ?? []) {
      if (bc && collapse(bc) === loose) return p;
    }
  }

  return null;
}
