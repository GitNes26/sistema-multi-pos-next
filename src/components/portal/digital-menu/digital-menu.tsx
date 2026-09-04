"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroupField } from "@/components/base/input-group-field";
import { Spinner } from "@/components/base/spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductBuilder } from "@/components/pos/product-builder";
import { cn } from "@/lib/utils";
import { money } from "@/lib/pos/money";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  category: string;
  categoryId: string;
  hasOptions: boolean;
  options: {
    id: string;
    name: string;
    position: number;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    values: {
      id: string;
      value: string;
      extraPrice: number;
      imageUrl: string | null;
      isActive: boolean;
    }[];
  }[];
  variants: {
    id: string;
    name: string;
    price: number;
  }[];
  isActive: boolean;
}

interface CartItem {
  key: string;
  product: MenuItem;
  quantity: number;
  selectedOptions: { optionName: string; value: string; extraPrice: number }[];
  notes: string;
  extraPrice: number;
  unitPrice: number;
}

interface DigitalMenuProps {
  tableId?: string;
  tableToken?: string;
  orgSlug?: string;
}

/* ------------------------------------------------------------------ */
/*  DigitalMenu                                                        */
/* ------------------------------------------------------------------ */

export function DigitalMenu({ tableId }: DigitalMenuProps) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [builderProduct, setBuilderProduct] = useState<MenuItem | null>(null);
  const [showCart, setShowCart] = useState(false);

  // Load menu items
  useEffect(() => {
    const loadMenu = async () => {
      try {
        const res = await fetch("/api/portal/storefront");
        const data = await res.json();
        if (data.ok) {
          // Filter only active products with images for food_service
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawProducts: any[] = data.products || [];
          const menuItems = rawProducts
            .filter((p) => p.isActive !== false)
            .map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description || null,
              imageUrl: p.imageUrl || p.variants?.[0]?.imageUrl || null,
              basePrice: p.variants?.[0]?.price || 0,
              category: p.categoryName || "Sin categoría",
              categoryId: p.categoryId || "",
              hasOptions: (p.options?.length || 0) > 0,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              options: (p.options || []).map((o: any) => ({
                id: o.id,
                name: o.name,
                required: o.required || false,
                minSelect: o.minSelect || 0,
                maxSelect: o.maxSelect || 10,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                values: (o.values || []).map((v: any) => ({
                  id: v.id,
                  value: v.value,
                  extraPrice: v.extraPrice || 0,
                  imageUrl: v.imageUrl || null,
                })),
              })),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              variants: (p.variants || []).map((v: any) => ({
                id: v.id,
                name: v.name || "Regular",
                price: v.price,
              })),
              isActive: true,
            }));
          setItems(menuItems);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    loadMenu();
  }, []);

  // Categories
  const categories = [...new Set(items.map((i) => i.category))].sort();

  // Filtered items
  const filtered = items.filter((item) => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedCategory && item.category !== selectedCategory) return false;
    return true;
  });

  // Add to cart
  const addToCart = (item: MenuItem, quantity: number = 1, selectedOptions: { optionName: string; value: string; extraPrice: number }[] = [], notes: string = "", extraPrice: number = 0) => {
    const unitPrice = item.basePrice + extraPrice;
    const cartItem: CartItem = {
      key: `${item.id}-${Date.now()}`,
      product: item,
      quantity,
      selectedOptions,
      notes,
      extraPrice,
      unitPrice,
    };
    setCart((prev) => [...prev, cartItem]);
  };

  // Remove from cart
  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
  };

  // Update cart item quantity
  const updateCartQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.key === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
      ).filter((i) => i.quantity > 0)
    );
  };

  // Cart total
  const cartTotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Menú
            </h1>
            {tableId && (
              <Badge variant="outline" className="text-sm">
                <Clock className="w-3 h-3 mr-1" />
                Mesa activa
              </Badge>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <InputGroupField
              placeholder="Buscar en el menú..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="max-w-6xl mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory("")}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                !selectedCategory
                  ? "bg-emerald-500 text-white shadow-md"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              )}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                  selectedCategory === cat
                    ? "bg-emerald-500 text-white shadow-md"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Menu grid */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description="No se encontraron productos con esos filtros."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <Card
                key={item.id}
                className="group overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
                onClick={() => {
                  if (item.hasOptions) {
                    setBuilderProduct(item);
                  } else {
                    addToCart(item);
                  }
                }}
              >
                {/* Image */}
                <div className="relative h-48 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ShoppingCart className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-emerald-500 text-white font-bold">
                      {money(item.basePrice)}
                    </Badge>
                  </div>
                  {item.hasOptions && (
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="outline" className="bg-white/90 text-slate-700 text-xs">
                        Configurable
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Content */}
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-lg font-bold text-emerald-600">
                      {money(item.basePrice)}
                    </span>
                    <Button
                      size="sm"
                      className={cn(
                        "transition-all",
                        item.hasOptions
                          ? "bg-amber-500 hover:bg-amber-600"
                          : "bg-emerald-500 hover:bg-emerald-600"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.hasOptions) {
                          setBuilderProduct(item);
                        } else {
                          addToCart(item);
                        }
                      }}
                    >
                      {item.hasOptions ? "Configurar" : "Agregar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            size="lg"
            className="rounded-full w-16 h-16 shadow-2xl bg-emerald-500 hover:bg-emerald-600"
            onClick={() => setShowCart(true)}
          >
            <div className="relative">
              <ShoppingCart className="w-6 h-6" />
              <AnimatePresence>
                <motion.div
                  key={cartCount}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold"
                >
                  {cartCount}
                </motion.div>
              </AnimatePresence>
            </div>
          </Button>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 shadow-xl flex flex-col">
            {/* Cart header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">Tu orden</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCart(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <EmptyState
                  icon={ShoppingCart}
                  title="Carrito vacío"
                  description="Agrega productos del menú."
                />
              ) : (
                cart.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"
                  >
                    <img
                      src={item.product.imageUrl || ""}
                      alt={item.product.name}
                      className="w-14 h-14 rounded-lg object-cover bg-slate-200"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product.name}</p>
                      {item.selectedOptions.length > 0 && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {item.selectedOptions.map((o) => o.optionName).join(", ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-[10px] text-amber-600 italic truncate">
                          📝 {item.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => updateCartQuantity(item.key, -1)}
                        >
                          -
                        </Button>
                        <span className="text-sm font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => updateCartQuantity(item.key, 1)}
                        >
                          +
                        </Button>
                        <span className="text-sm font-bold ml-auto">
                          {money(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500"
                      onClick={() => removeFromCart(item.key)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Cart footer */}
            {cart.length > 0 && (
              <div className="border-t p-4 space-y-3">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-emerald-600">{money(cartTotal)}</span>
                </div>
                <Button
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-12"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/portal/orders", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                          tableId: tableId || undefined,
                          deliveryMethod: "pickup",
                          locationId: undefined,
                          paymentMethod: "cash",
                          subtotal: cartTotal,
                          discount: 0,
                          total: cartTotal,
                          items: cart.map((ci) => ({
                            productId: ci.product.id,
                            variantId: null,
                            productType: "standard",
                            productName: ci.product.name,
                            variantName: null,
                            quantity: ci.quantity,
                            unitId: null,
                            unitPrice: ci.unitPrice,
                            lineTotal: ci.unitPrice * ci.quantity,
                            categoryId: ci.product.categoryId,
                          })),
                          notes: null,
                        }),
                      })
                      if (res.ok) {
                        setCart([])
                        setShowCart(false)
                      }
                    } catch {
                      // silently fail
                    }
                  }}
                >
                  Enviar orden a cocina
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ProductBuilder dialog */}
      {builderProduct && (
        <ProductBuilder
          portalProduct={builderProduct}
          open={!!builderProduct}
          onClose={() => setBuilderProduct(null)}
          onAdd={(configured) => {
            const mappedOptions = (configured.selectedOptions || []).flatMap(
              (opt) => opt.values.map((v) => ({
                optionName: opt.optionName,
                value: v.value,
                extraPrice: v.extraPrice,
              }))
            );
            addToCart(
              builderProduct,
              configured.quantity || 1,
              mappedOptions,
              configured.notes || "",
              configured.totalExtraPrice || 0
            );
            setBuilderProduct(null);
          }}
        />
      )}
    </div>
  );
}
