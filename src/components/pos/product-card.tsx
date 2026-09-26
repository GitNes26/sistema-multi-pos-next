"use client";

import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Info, Package, Scale } from "lucide-react";
import type { PosProduct } from "@/types/pos";
import { money } from "@/lib/pos/money";
import { categoryAccent } from "@/lib/catalog/placeholder";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { ThumbImage } from "@/components/base/thumb-image";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ProductCardProps {
  product: PosProduct;
  hot?: boolean;
  onSelect: (product: PosProduct) => void;
}

// Existencia: discreta cuando sobra, llamativa solo cuando exige atención.
// Un chip saturado en cada tarjeta convierte la rejilla en ruido.
function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="rounded-full bg-destructive/12 px-2 py-0.5 text-xs font-semibold text-destructive">
        Agotado
      </span>
    );
  }
  if (stock <= 8) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-foreground tabular">
        <span aria-hidden className="size-1.5 rounded-full bg-warning" />
        {stock} u
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-muted-foreground tabular">
      {stock} u
    </span>
  );
}

export const ProductCard = memo(function ProductCard({ product, hot, onSelect }: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const handleClick = () => {
    haptic.light();
    onSelect(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 500);
  };

  return (
    <>
    <motion.div
      whileTap={{ scale: 0.96 }}
      className={cn(
        "group relative flex min-h-44 w-full touch-manipulation flex-col gap-2.5 rounded-2xl border bg-card p-2 text-left transition-[border-color,box-shadow,background-color] duration-200",
        "desk:hover:border-foreground/20 desk:hover:shadow-e2",
        (!product.isAvailable || (product.trackInventory && product.stock <= 0)) && "opacity-55 saturate-50",
        added && "border-primary ring-1 ring-primary"
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        className="absolute inset-0 z-20 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Agregar ${product.name}`}
      />
      {/* Add feedback overlay */}
      <AnimatePresence>
        {added && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-primary/10"
          >
            <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-e2">
              <Check className="size-5" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {product.bulk && (
        <span className="absolute left-3.5 top-3.5 z-10 flex items-center gap-1 rounded-md bg-foreground/85 px-1.5 py-0.5 text-xs font-semibold text-background">
          <Scale className="size-3" /> Granel
        </span>
      )}
      {hot && (
        <span className="absolute right-14 top-3.5 z-10 rounded-md bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
          Promo
        </span>
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setInfoOpen(true);
        }}
        className="absolute right-2 top-2 z-30 flex size-11 touch-manipulation items-center justify-center rounded-xl text-muted-foreground transition hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Ver información de ${product.name}`}
        title="Ver información del producto"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-background/85 shadow-e1 supports-backdrop-filter:backdrop-blur-sm">
          <Info className="size-4" />
        </span>
      </button>
      <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-xl bg-surface-sunken">
        {product.imageUrl ? (
          <ThumbImage
            src={product.imageUrl}
            alt={product.name}
            className="size-full rounded-xl object-cover"
          />
        ) : (
          // Sin foto real: anillo + icono con el color de la categoría, el
          // mismo lenguaje visual que las imágenes placeholder generadas.
          <span
            className="flex size-9 items-center justify-center rounded-full border-2"
            style={{
              borderColor: categoryAccent(product.categoryName),
              color: categoryAccent(product.categoryName),
            }}
          >
            <Package className="size-4" />
          </span>
        )}
        {product.variantCount > 1 && (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-xs font-semibold text-foreground shadow-e1">
            {product.variantCount} variantes
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-1.5 px-1 pb-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</p>
        <div className="flex items-end justify-between gap-1">
          <p className="text-lg leading-none font-bold tracking-tight tabular">
            {money(product.price)}
            {product.bulk && (
              <span className="ml-0.5 text-xs font-medium text-muted-foreground">
                /{product.bulk.unitAbbrev}
              </span>
            )}
          </p>
          {product.trackInventory ? (
            <StockBadge stock={Math.floor(product.stock)} />
          ) : (
            <span className="sr-only">Sin control de existencia</span>
          )}
        </div>
      </div>
    </motion.div>
    <DialogComponent
      open={infoOpen}
      onOpenChange={setInfoOpen}
      size="sm"
      icon={<Info className="size-5 text-primary" />}
      title={product.name}
      description={product.categoryName ?? "Información del producto"}
      footer={<Button variant="outline" onClick={() => setInfoOpen(false)}>Cerrar</Button>}
    >
      <div className="space-y-4">
        {product.imageUrl && (
          <ThumbImage src={product.imageUrl} alt={product.name} className="h-40 w-full rounded-xl object-cover" />
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descripción</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
            {product.description?.trim() || "Este producto aún no tiene una descripción registrada."}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Precio</dt><dd className="font-semibold">{money(product.price)}{product.bulk ? ` /${product.bulk.unitAbbrev}` : ""}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Existencia</dt><dd className="font-semibold">{product.trackInventory ? product.stock : "Sin control"}</dd></div>
          {product.sku && <div><dt className="text-xs text-muted-foreground">SKU</dt><dd className="break-all font-medium">{product.sku}</dd></div>}
          {product.barcode && <div><dt className="text-xs text-muted-foreground">Código</dt><dd className="break-all font-medium">{product.barcode}</dd></div>}
        </dl>
      </div>
    </DialogComponent>
    </>
  );
});
