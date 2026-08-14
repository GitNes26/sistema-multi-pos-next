"use client";

import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { usePortalStore, cartSubtotal, cartTax, cartTotal } from "@/stores/portal-store";
import { money, round3, snapToStep } from "@/lib/pos/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";

export function CartSheet() {
  const router = useRouter();
  const open = usePortalStore((s) => s.cartOpen);
  const setCartOpen = usePortalStore((s) => s.setCartOpen);
  const items = usePortalStore((s) => s.items);
  const setQty = usePortalStore((s) => s.setQty);
  const setComment = usePortalStore((s) => s.setComment);
  const removeItem = usePortalStore((s) => s.removeItem);

  const subtotal = cartSubtotal(items);
  const tax = cartTax(items);
  const total = cartTotal(items);

  return (
    <Sheet open={open} onOpenChange={setCartOpen}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Tu carrito</SheetTitle>
          <SheetDescription>
            {items.length
              ? `${items.length} producto${items.length > 1 ? "s" : ""}`
              : "Aún no agregas productos"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
              <ShoppingBag className="size-10" />
              <p className="text-sm">Tu carrito está vacío</p>
              <Button variant="outline" size="sm" onClick={() => { setCartOpen(false); router.push("/portal/store"); }}>
                Ir a la tienda
              </Button>
            </div>
          )}

          {items.map((item) => (
            <div key={item.key} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  {item.variantName && (
                    <p className="text-xs text-muted-foreground">{item.variantName}</p>
                  )}
                  {item.bulkQuantityDisplay && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.bulkQuantityDisplay}</p>
                  )}
                  <p className="mt-1 text-sm font-semibold">
                    {money(item.unitPrice * item.qty)}
                  </p>
                </div>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(item.key)}
                  aria-label="Quitar"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => setQty(item.key, snapToStep(item.qty - item.step, item.step))}
                    disabled={item.qty <= item.step}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-12 text-center text-sm tabular-nums">{round3(item.qty)}</span>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => setQty(item.key, snapToStep(item.qty + item.step, item.step))}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {money(item.unitPrice)}/{item.unitAbbrev}
                </span>
              </div>

              <Input
                className="mt-2 h-8 text-xs"
                placeholder="Comentario para este producto…"
                value={item.comment ?? ""}
                onChange={(e) => setComment(item.key, e.target.value)}
              />
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <SheetFooter>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA</span>
                <span>{money(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setCartOpen(false);
                router.push("/portal/checkout");
              }}
            >
              Ir a pagar
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
