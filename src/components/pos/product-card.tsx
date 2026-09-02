"use client";

import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Package, Scale } from "lucide-react";
import type { PosProduct } from "@/types/pos";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

interface ProductCardProps {
  product: PosProduct;
  hot?: boolean;
  onSelect: (product: PosProduct) => void;
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="rounded-full bg-destructive/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
        Sin stock
      </span>
    );
  }
  if (stock <= 8) {
    return (
      <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
        {stock} u
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
      {stock} u
    </span>
  );
}

export const ProductCard = memo(function ProductCard({ product, hot, onSelect }: ProductCardProps) {
  const [added, setAdded] = useState(false);

  const handleClick = () => {
    haptic.light();
    onSelect(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 500);
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={{ scale: 0.96 }}
      className={cn(
        "group relative flex h-full flex-col gap-2 rounded-2xl border bg-card p-2.5 text-left shadow-sm transition",
        "hover:border-primary/50 hover:shadow-md",
        product.stock <= 0 && "opacity-60",
        added && "border-primary bg-primary/5"
      )}
    >
      {/* Add feedback overlay */}
      <AnimatePresence>
        {added && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-primary/10"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Check className="size-5" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {product.bulk && (
        <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          <Scale className="size-3" /> A granel
        </span>
      )}
      {hot && (
        <span className="absolute right-2 top-2 z-10 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
          Vigente
        </span>
      )}
      <div className="relative flex h-16 items-center justify-center rounded-xl bg-muted/40">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="size-full rounded-xl object-cover"
          />
        ) : (
          <Package className="size-6 text-muted-foreground" />
        )}
        {product.variantCount > 1 && (
          <span className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
            {product.variantCount} variantes
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-1">
        <div className="flex items-start justify-between gap-1">
          <p className="line-clamp-2 text-xs font-medium leading-tight">{product.name}</p>
        </div>
        <div className="flex items-end justify-between gap-1">
          <p className="text-sm font-bold tabular-nums">
            {money(product.price)}
            {product.bulk && (
              <span className="ml-0.5 text-[9px] font-medium text-muted-foreground">
                /{product.bulk.unitAbbrev}
              </span>
            )}
          </p>
          {product.trackInventory ? (
            <StockBadge stock={Math.floor(product.stock)} />
          ) : (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              —
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
});
