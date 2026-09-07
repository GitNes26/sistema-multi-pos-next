"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileArchive, Images, ImagePlus, Loader2, RefreshCw, Search, Trash2, X } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crudApi } from "@/lib/api";
import { uploadFile } from "@/lib/uploads";
import { categoryAccent } from "@/lib/catalog/placeholder";
import { matchFileToProduct, type MatchableProduct } from "@/lib/catalog/image-matching";
import {
  useImageDropzone,
  MAX_UPLOAD_SIZE,
  type ExtractedImage,
} from "@/hooks/use-image-dropzone";
import { cn } from "@/lib/utils";
import { swalError, swalToast } from "@/lib/swal";

/**
 * Carga masiva de imágenes de productos desde una sola pantalla.
 *
 * Cada tarjeta de producto es una zona de arrastre y el encabezado del dialog
 * es una zona de lote: los archivos soltos ahí se emparejan solos con su
 * producto por nombre, SKU o código de barras (`arroz-1kg.jpg` → «Arroz
 * 1kg»). Al confirmar se suben todas a /api/uploads y se aplican con PATCH
 * del CRUD genérico — el mismo flujo que editar la imagen de un producto a la
 * vez, pero en lote.
 */

interface ProductRow {
  id: string;
  name: string;
  imageUrl: string | null;
  categoryName: string | null;
  skus: string[];
  barcodes: string[];
}


interface BulkImagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recargar la tabla del manager tras aplicar cambios. */
  onApplied: () => void;
}

export function BulkImagesDialog({ open, onOpenChange, onApplied }: BulkImagesDialogProps) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Asignaciones pendientes: productId → archivo elegido + su URL de preview.
  const [files, setFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState<{ name: string; reason: string }[]>([]);

  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<Record<string, "ok" | "error">>({});

  const previewsRef = useRef<Record<string, string>>({});
  previewsRef.current = previews;
  // Espejo de `files` para callbacks estables (el staging de zips es async).
  const filesRef = useRef<Record<string, File>>({});
  filesRef.current = files;

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { pageSize: 200 };
      if (query.trim()) params.q = query.trim();
      if (categoryId !== "all") params.categoryId = categoryId;
      const res = await crudApi.list("products", params);
      setProducts(
        res.rows.map((r) => ({
          id: String(r.id),
          name: String(r.name ?? ""),
          imageUrl: (r.imageUrl as string | null) ?? null,
          categoryName: (r.categoryName as string | null) ?? null,
          skus: ((r.variants as { sku?: string | null }[] | undefined) ?? [])
            .map((v) => v.sku)
            .filter((s): s is string => Boolean(s)),
          barcodes: ((r.variants as { barcode?: string | null }[] | undefined) ?? [])
            .map((v) => v.barcode)
            .filter((b): b is string => Boolean(b)),
        }))
      );
    } catch (err) {
      swalError("Error al cargar productos", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [query, categoryId]);

  // Búsqueda con debounce (mismo feel que la tabla).
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    loadProducts();
  }, [open, loadProducts, debouncedQuery]);

  // Catálogo de categorías para el filtro (una sola vez por apertura).
  useEffect(() => {
    if (!open) return;
    crudApi
      .list("categories", { pageSize: 200 })
      .then((res) =>
        setCategories(res.rows.map((r) => ({ id: String(r.id), name: String(r.name ?? "") })))
      )
      .catch(() => setCategories([]));
  }, [open]);

  // Limpieza de object URLs al cerrar.
  useEffect(() => {
    if (open) return;
    for (const url of Object.values(previewsRef.current)) URL.revokeObjectURL(url);
    setFiles({});
    setPreviews({});
    setResults({});
    setQuery("");
    setDebouncedQuery("");
    setCategoryId("all");
    setUnmatched([]);
  }, [open]);

  // Y al desmontar.
  useEffect(() => {
    return () => {
      for (const url of Object.values(previewsRef.current)) URL.revokeObjectURL(url);
    };
  }, []);

  const stage = useCallback((productId: string, file: File) => {
    setFiles((prev) => ({ ...prev, [productId]: file }));
    setPreviews((prev) => {
      const old = prev[productId];
      if (old) URL.revokeObjectURL(old);
      return { ...prev, [productId]: URL.createObjectURL(file) };
    });
    setResults((prev) => {
      if (!(productId in prev)) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  // Referencia del producto elegido en el picker (vive fuera del ciclo de render).
  const targetRef = useRef<string | null>(null);

  // Validación y pickers centralizados en el hook compartido.
  const dropzone = useImageDropzone({
    subject: "la imagen",
    onFile: (file) => {
      const target = targetRef.current;
      if (target) stage(target, file);
    },
    onZipImages: (images) => matchAndStageImages(images),
  });

  const unassign = useCallback((productId: string) => {
    setPreviews((prev) => {
      const old = prev[productId];
      if (old) URL.revokeObjectURL(old);
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setFiles((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const openPickerFor = (productId: string) => {
    targetRef.current = productId;
    dropzone.openPicker();
  };

  /** Aplica un lote ya resuelto: asigna previews y reporta el resultado. */
  const applyBatch = useCallback(
    (
      matched: { productId: string; file: File }[],
      misses: { name: string; reason: string }[],
      rejected: number
    ) => {
      if (matched.length > 0) {
        setFiles((prev) => {
          const next = { ...prev };
          for (const { productId, file } of matched) next[productId] = file;
          return next;
        });
        setPreviews((prev) => {
          const next = { ...prev };
          for (const { productId, file } of matched) {
            const old = next[productId];
            if (old) URL.revokeObjectURL(old);
            next[productId] = URL.createObjectURL(file);
          }
          return next;
        });
        setResults((prev) => {
          const next = { ...prev };
          for (const { productId } of matched) delete next[productId];
          return next;
        });
      }
      setUnmatched(misses);
      const total = matched.length + misses.length;
      if (total > 0) {
        if (matched.length > 0 && misses.length === 0) {
          swalToast(
            `${matched.length} imagen${matched.length !== 1 ? "es" : ""} emparejada${matched.length !== 1 ? "s" : ""}`
          );
        } else if (matched.length === 0 && misses.length > 0) {
          swalError(
            "Sin coincidencias",
            "Ningún archivo coincidió con un producto por nombre, SKU o código de barras. Renómbralos o arrástralos sobre la tarjeta del producto."
          );
        } else {
          swalToast(
            `${matched.length} emparejada${matched.length !== 1 ? "s" : ""} · ${misses.length} sin coincidencia`
          );
        }
      } else if (rejected > 0) {
        swalError("Archivos omitidos", `${rejected} archivo${rejected !== 1 ? "s" : ""} con formato o tamaño no permitido.`);
      }
    },
    []
  );

  /** Empareja imágenes (sueltas o de un ZIP) con productos y las deja listas. */
  const matchAndStageImages = useCallback(
    (candidates: ExtractedImage[]) => {
      const matched: { productId: string; file: File }[] = [];
      const misses: { name: string; reason: string }[] = [];
      let rejected = 0;
      const matchables: MatchableProduct[] = products.map((p) => ({
        id: p.id,
        name: p.name,
        skus: p.skus,
        barcodes: p.barcodes,
      }));
      for (const c of candidates) {
        if (c.bytes.byteLength > MAX_UPLOAD_SIZE) {
          rejected++;
          continue;
        }
        const hit = matchFileToProduct(c.name, matchables);
        if (hit) {
          // Sin sobrescribir elecciones manuales ya hechas.
          if (!filesRef.current[hit.id]) {
            matched.push({ productId: hit.id, file: new File([c.bytes], c.name, { type: c.type }) });
          }
        } else {
          misses.push({ name: c.name, reason: "sin coincidencia" });
        }
      }
      applyBatch(matched, misses, rejected);
    },
    [products, applyBatch]
  );

  const pendingCount = useMemo(() => Object.keys(files).length, [files]);

  const handleSave = async () => {
    const entries = Object.entries(files);
    if (entries.length === 0) return;
    setSaving(true);
    setResults({});
    const finalResults: Record<string, "ok" | "error"> = {};
    // Secuencial (no en paralelo) para no saturar el servidor de archivos con
    // cientos de subidas simultáneas de un solo local.
    for (const [productId, file] of entries) {
      try {
        const url = await uploadFile(file);
        await crudApi.update("products", productId, { imageUrl: url });
        finalResults[productId] = "ok";
      } catch {
        finalResults[productId] = "error";
      }
      setResults({ ...finalResults });
    }
    setSaving(false);
    const ok = Object.values(finalResults).filter((r) => r === "ok").length;
    const failed = entries.length - ok;
    // Limpiar solo las aplicadas con éxito; las fallidas quedan asignadas
    // para reintentar sin volver a arrastrarlas.
    for (const [productId, r] of Object.entries(finalResults)) {
      if (r === "ok") unassign(productId);
    }
    if (failed === 0) {
      swalToast(`${ok} imagen${ok !== 1 ? "es" : ""} aplicada${ok !== 1 ? "s" : ""}`);
    } else {
      swalError(
        "Algunas imágenes no se pudieron guardar",
        `${ok} aplicadas · ${failed} con error (revísalas y reintenta).`
      );
    }
    onApplied();
  };

  const assignedCount = products.filter((p) => files[p.id]).length;

  return (
    <>
      <DialogComponent
        open={open}
        onOpenChange={(o) => !saving && onOpenChange(o)}
        title="Imágenes de productos"
        description="Arrastra una foto sobre cada producto o haz clic para elegirla; al confirmar se suben y se aplican todas."
        className="max-w-4xl"
        footerClassName="gap-2"
        footer={
          <>
            <span className="mr-auto text-xs text-muted-foreground">
              {pendingCount > 0
                ? `${pendingCount} imagen${pendingCount !== 1 ? "es" : ""} lista${pendingCount !== 1 ? "s" : ""} para aplicar`
                : "Sin cambios pendientes"}
            </span>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              {saving ? "Ocultar" : "Cerrar"}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || pendingCount === 0}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {saving ? "Aplicando…" : `Aplicar ${pendingCount > 0 ? `(${pendingCount})` : ""}`}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* Zona de lote: emparejamiento automático por nombre/SKU/código */}
          <div
            {...dropzone.dragHandlers}
            className={cn(
              "flex items-center gap-3 rounded-xl border-2 border-dashed p-3 transition",
              dropzone.dragging ? "border-primary bg-primary/5" : "border-border/70 bg-muted/20"
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                dropzone.dragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <Images className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Suelta varios archivos aquí para asignarlos automáticamente</p>
              <p className="text-xs text-muted-foreground">
                Se emparejan por nombre de producto, SKU o código de barras (arroz-1kg.jpg → «Arroz 1kg»). También acepta un .zip con todas las fotos.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={dropzone.openZipPicker}
              disabled={dropzone.zipBusy || saving}
            >
              {dropzone.zipBusy ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />}
              {dropzone.zipBusy ? "Leyendo ZIP…" : "Importar ZIP"}
            </Button>
          </div>

          {unmatched.length > 0 && (
            <div className="rounded-lg border border-amber-400/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
              <span className="font-medium">
                {unmatched.length} archivo{unmatched.length !== 1 ? "s" : ""} sin coincidencia:
              </span>{" "}
              {unmatched.slice(0, 3).map((u) => u.name).join(", ")}
              {unmatched.length > 3 && ` y ${unmatched.length - 3} más`} — renómbralos con el nombre/SKU del producto o arrástralos sobre su tarjeta.
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-64">
              <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o SKU…"
                className="h-9 pl-9"
              />
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="size-9" onClick={() => loadProducts()} disabled={loading}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
            {assignedCount > 0 && (
              <span className="text-xs text-muted-foreground">{assignedCount} en pantalla con imagen asignada</span>
            )}
          </div>

          {/* Grid de productos */}
          {loading && products.length === 0 ? (
            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
          ) : products.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados</p>
          ) : (
            <div className="grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
              {products.map((p) => {
                const file = files[p.id];
                const preview = previews[p.id];
                const result = results[p.id];
                const hasImage = Boolean(p.imageUrl);
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Elegir imagen para ${p.name}`}
                    onClick={() => !saving && openPickerFor(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!saving) openPickerFor(p.id);
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(p.id);
                    }}
                    onDragLeave={() => setDragOver((cur) => (cur === p.id ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver((cur) => (cur === p.id ? null : cur));
                      if (saving) return;
                      const f = e.dataTransfer.files?.[0];
                      if (f) stage(p.id, f);
                    }}
                    className={cn(
                      "group relative cursor-pointer rounded-xl border bg-card p-2 text-left transition",
                      "hover:border-primary/50 hover:shadow-sm",
                      dragOver === p.id && "border-primary bg-primary/5 ring-2 ring-primary/30",
                      result === "ok" && "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                    )}
                  >
                    {/* Estado */}
                    {result === "ok" && (
                      <span className="absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Check className="size-3.5" />
                      </span>
                    )}
                    {result === "error" && (
                      <span className="absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-destructive text-white">
                        <X className="size-3.5" />
                      </span>
                    )}
                    {file && !result && (
                      <button
                        type="button"
                        aria-label="Quitar imagen asignada"
                        onClick={(e) => {
                          e.stopPropagation();
                          unassign(p.id);
                        }}
                        className="absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}

                    {/* Imagen: preview nuevo > foto actual > placeholder por categoría */}
                    <div className="relative flex h-20 items-center justify-center overflow-hidden rounded-lg bg-muted/40">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="" className="size-full object-cover" />
                      ) : p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <span
                          className="flex size-10 items-center justify-center rounded-full border-2"
                          style={{
                            borderColor: categoryAccent(p.categoryName),
                            color: categoryAccent(p.categoryName),
                          }}
                        >
                          <ImagePlus className="size-4" />
                        </span>
                      )}
                      {hasImage && !preview && (
                        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white">
                          actual
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-tight">{p.name}</p>
                  </div>
                );
              })}
            </div>
          )}
          {products.length >= 200 && (
            <p className="text-xs text-muted-foreground">
              Mostrando los primeros 200 productos — usa el buscador o el filtro de categoría para llegar al resto.
            </p>
          )}
        </div>
      </DialogComponent>

      {/* Inputs ocultos del hook: un picker único para todas las tarjetas + ZIP. */}
      {dropzone.inputs.image}
      {dropzone.inputs.zip}
    </>
  );
}
