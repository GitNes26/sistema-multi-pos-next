"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Printer } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePosStore, selectCustomer } from "@/stores/pos-store";
import type { PosCatalog, PosCombo, PosLineItem, PosProduct, PosSalePayload } from "@/types/pos";
import { swalToast, swalError } from "@/lib/swal";
import { bulkDisplay } from "@/stores/pos-store";
import { usePosRefresh } from "@/hooks/use-pos-refresh";
import { PosRoleGuide } from "./pos-role-guide";
import { SupervisorProvider } from "./supervisor-gate";
import { PosHeader } from "./pos-header";
import { CatalogPanel } from "./catalog-panel";
import { TicketPanel } from "./ticket-panel";
import { BulkModal, type BulkDraft } from "./bulk-modal";
import { VariantDialog } from "./variant-dialog";
import { CustomerModal } from "./customer-modal";
import { DiscountDialog } from "./discount-dialog";
import { PaymentDialog } from "./payment-dialog";
import { ProductBuilder } from "./product-builder";
import { CashRegisterPanel } from "./cash-register-panel";
import { CatalogsModal } from "./catalogs-modal";
import { Receipt } from "./receipt";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useGroupRef } from "react-resizable-panels";
import type { Layout, LayoutChangedMeta } from "react-resizable-panels";

interface PosAppProps {
  catalog: PosCatalog;
  /** true si la sesión puede abrir/cerrar caja (cash.open/cash.close). */
  canOperateCash?: boolean;
  /** true si la sesión ve la agenda de citas (appointments.view). */
  canViewAgenda?: boolean;
  /** true si la sesión ve reservaciones (reservations.view). */
  canViewReservations?: boolean;
  /** Modo de negocio de la org activa (para la guía de roles mesa/KDS). */
  orgMode?: string | null;
}

type BulkTarget = {
  product: PosProduct;
  editing?: { key: string; draft: BulkDraft };
};

interface PosSplitProps {
  catalogCollapsed: boolean;
  onToggleCollapsed: () => void;
  onSelect: (product: PosProduct) => void;
  onSelectCombo: (combo: PosCombo) => void;
  onEditBulk: (item: PosLineItem) => void;
  onOpenCustomer: () => void;
  onOpenDiscount: () => void;
  onCheckout: () => void;
  onSplitBill: (parts: number) => void;
}

/**
 * Divide la pantalla del POS según la orientación (`stacked` = ticket arriba /
 * catálogo abajo para tablet vertical; `wide` = catálogo | ticket para desktop
 * y tablet apaisada). El reparto que deja el usuario al arrastrar el separador
 * se recuerda por sucursal y por eje (localStorage), así sobrevive al recargar
 * y al girar la tablet. Se monta con `key` desde PosApp para reiniciar limpio
 * cuando cambia la orientación.
 */
function PosSplit({
  variant,
  locationId,
  ...handlers
}: PosSplitProps & { variant: "stacked" | "wide"; locationId: string }) {
  const groupRef = useGroupRef();
  const axis = variant === "stacked" ? "v" : "h";
  const storageKey = `fb.pos-split.${axis}:${locationId}`;

  // Cargar el reparto guardado de esta sucursal en esta orientación tras el
  // montaje (no durante el render, para no romper la hidratación SSR).
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Layout;
      if (saved && typeof saved === "object") group.setLayout(saved);
    } catch {
      // Almacenamiento no disponible o dato corrupto: se mantiene el default.
    }
  }, [groupRef, storageKey]);

  // Guardar solo cuando el usuario arrastra el separador (ignora resizes y
  // el propio setLayout de carga), para no pisar la preferencia con defaults.
  const onLayoutChanged = useCallback(
    (layout: Layout, meta: LayoutChangedMeta) => {
      if (!meta.isUserInteraction) return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(layout));
      } catch {
        // Sin almacenamiento (incógnito / bloqueado): se ignora.
      }
    },
    [storageKey]
  );

  if (variant === "stacked") {
    return (
      /* Modo vertical (tablet en vertical / estrecho): ticket arriba y
         catálogo abajo, ambos paneles arrastrables con safe area. El ticket
         arranca más alto que su contenido fijo (totales + cobrar) para que
         nada se corte; si el espacio es muy justo, un scroll de respaldo evita
         que se desborde sobre el separador. */
      <ResizablePanelGroup
        groupRef={groupRef}
        orientation="vertical"
        onLayoutChanged={onLayoutChanged}
        className="size-full"
      >
        <ResizablePanel id="ticket" defaultSize="46" minSize="34" maxSize="72" className="min-h-0">
          <div className="scrollbar-none h-full min-h-0 overflow-y-auto overscroll-contain">
            <TicketPanel
              onEditBulk={handlers.onEditBulk}
              onOpenCustomer={handlers.onOpenCustomer}
              onOpenDiscount={handlers.onOpenDiscount}
              onCheckout={handlers.onCheckout}
              onSplitBill={handlers.onSplitBill}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle
          withHandle
          className="h-2 w-full shrink-0 items-center justify-center bg-border/70"
        />
        <ResizablePanel id="catalog" defaultSize="54" minSize="30" className="min-h-0">
          <CatalogPanel
            onSelect={handlers.onSelect}
            onSelectCombo={handlers.onSelectCombo}
            collapsed={handlers.catalogCollapsed}
            onToggleCollapsed={handlers.onToggleCollapsed}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  return (
    /* Modo ancho (desktop / tablet apaisada): catálogo | ticket. */
    <ResizablePanelGroup
      groupRef={groupRef}
      orientation="horizontal"
      onLayoutChanged={onLayoutChanged}
      className="gap-0"
    >
      <ResizablePanel id="catalog" defaultSize="65" minSize="35" className="min-w-0">
        <CatalogPanel
          onSelect={handlers.onSelect}
          onSelectCombo={handlers.onSelectCombo}
          collapsed={handlers.catalogCollapsed}
          onToggleCollapsed={handlers.onToggleCollapsed}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="ticket" defaultSize="35" minSize="25" className="min-w-0">
        <section className="scrollbar-none h-full overflow-y-auto">
          <TicketPanel
            onEditBulk={handlers.onEditBulk}
            onOpenCustomer={handlers.onOpenCustomer}
            onOpenDiscount={handlers.onOpenDiscount}
            onCheckout={handlers.onCheckout}
            onSplitBill={handlers.onSplitBill}
          />
        </section>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function PosApp({
  catalog,
  canOperateCash = false,
  canViewAgenda = false,
  canViewReservations = false,
  orgMode = null,
}: PosAppProps) {
  const setCatalog = usePosStore((s) => s.setCatalog);
  const products = usePosStore((s) => s.products);
  const addProduct = usePosStore((s) => s.addProduct);
  const addBulk = usePosStore((s) => s.addBulk);
  const addConfiguredItem = usePosStore((s) => s.addConfiguredItem);
  const editItem = usePosStore((s) => s.editItem);
  const clearTicket = usePosStore((s) => s.clearTicket);
  const refresh = usePosRefresh();

  // Layout sensible a la pantalla: en pantallas anchas el POS es de dos
  // columnas (catálogo | ticket). En vertical/estrecho (tablet en vertical,
  // móvil) se apilan: ticket arriba y catálogo abajo, ambos con arrastre.
  const isWide = useMediaQuery("(min-width: 1024px)");
  const isShort = useMediaQuery("(max-height: 559px)");
  const stacked = !isWide && !isShort;

  const [catalogCollapsed, setCatalogCollapsed] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<BulkTarget | null>(null);
  const [variantTarget, setVariantTarget] = useState<PosProduct | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [catalogsOpen, setCatalogsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [builderTarget, setBuilderTarget] = useState<PosProduct | null>(null);
  // Diálogo de la guía de roles (mesa/KDS): lo abre la tarjeta o el menú del
  // header («Guía del POS»), así se reabre aunque la tarjeta esté descartada.
  const [guideOpen, setGuideOpen] = useState(false);
  const [lastSale, setLastSale] = useState<{
    sale: { id: string; saleNumber: string; locationName: string };
    payload: PosSalePayload;
  } | null>(null);
  const [splitParts, setSplitParts] = useState<number | null>(null);

  useEffect(() => {
    setCatalog(catalog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  const selectProduct = (product: PosProduct) => {
    if (product.trackInventory && product.stock <= 0) {
      swalError("Sin stock", `${product.name} no tiene existencias en esta sucursal.`);
      return;
    }
    if (product.bulk) {
      setBulkTarget({ product });
      return;
    }
    if (product.variantCount > 1) {
      setVariantTarget(product);
      return;
    }
    if (product.hasOptions && product.options.length > 0) {
      setBuilderTarget(product);
      return;
    }
    addProduct(product);
  };

  const openBulkEdit = (line: PosLineItem) => {
    const product = products.find((p) => p.productId === line.productId);
    if (!product || !product.bulk) return;
    setBulkTarget({
      product,
      editing: {
        key: line.key,
        draft: {
          qty: line.qty,
          unitId: line.unitId ?? product.bulk.unitId,
          pricePerUnit: line.unitPrice,
          abbrev: line.unitAbbrev,
          unitName: line.unitAbbrev,
        },
      },
    });
  };

  const confirmBulk = (product: PosProduct, draft: BulkDraft, editingKey?: string) => {
    if (editingKey) {
      editItem(editingKey, {
        qty: draft.qty,
        unitPrice: draft.pricePerUnit,
        unitId: draft.unitId,
        unitAbbrev: draft.abbrev,
        bulkQuantityDisplay: bulkDisplay(draft.qty, draft.abbrev, draft.pricePerUnit),
      });
    } else {
      addBulk(product, draft);
    }
    setBulkTarget(null);
  };

  const selectCombo = (combo: PosCombo) => {
    // Add each combo item as a configured line item
    for (const item of combo.items) {
      const product = products.find((p) => p.productId === item.productId);
      if (!product) continue;

      // Find the variant if specified
      const variant = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)
        : product.variants[0];

      addProduct(product, {
        qty: item.quantity,
        variant: variant ?? product.variants[0],
      });
    }
  };

  const onSaleSuccess = async (
    sale: { id: string; saleNumber: string; locationName: string },
    payload: PosSalePayload
  ) => {
    setPaymentOpen(false);
    clearTicket();
    setLastSale({ sale, payload });
    void refresh();
    swalToast(`Venta ${sale.saleNumber} registrada`);
  };

  const printReceipt = () => {
    if (lastSale) {
      window.open(`/api/pos/ticket/${lastSale.sale.id}`, "_blank");
    }
  };

  return (
    <SupervisorProvider>
      {/* Safe areas: tablet en PWA/standalone con notch e home indicator. */}
      <div className="flex h-svh flex-col bg-background pt-[env(safe-area-inset-top)] text-foreground">
        <PosHeader
          canOperateCash={canOperateCash}
          canViewAgenda={canViewAgenda}
          canViewReservations={canViewReservations}
          onOpenCatalogs={() => setCatalogsOpen(true)}
          onOpenCash={() => setCashOpen(true)}
          // Solo los modos con mesa/cocina ofrecen la guía en el menú.
          onOpenGuide={
            orgMode === "food_service" || orgMode === "hybrid"
              ? () => setGuideOpen(true)
              : undefined
          }
        />
        {/* Guía de roles para food/hybrid (mesero/cocina): Mesas + KDS. */}
        {(orgMode === "food_service" || orgMode === "hybrid") && (
          <PosRoleGuide
            orgMode={orgMode}
            open={guideOpen}
            onOpenChange={setGuideOpen}
          />
        )}

        <main className="flex min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
          {/* key: al girar la tablet se remonta la instancia del eje correcto
              y restaura el reparto guardado de esta sucursal en ese eje. */}
          <PosSplit
            key={stacked ? "v" : "h"}
            variant={stacked ? "stacked" : "wide"}
            locationId={catalog.location?.id || "default"}
            catalogCollapsed={catalogCollapsed}
            onToggleCollapsed={() => setCatalogCollapsed((v) => !v)}
            onSelect={selectProduct}
            onSelectCombo={selectCombo}
            onEditBulk={openBulkEdit}
            onOpenCustomer={() => setCustomerOpen(true)}
            onOpenDiscount={() => setDiscountOpen(true)}
            onCheckout={() => setPaymentOpen(true)}
            onSplitBill={(parts) => {
              setSplitParts(parts)
              setPaymentOpen(true)
            }}
          />
        </main>
      </div>

      <BulkModal
        open={!!bulkTarget}
        product={bulkTarget?.product ?? null}
        editing={bulkTarget?.editing}
        onClose={() => setBulkTarget(null)}
        onConfirm={confirmBulk}
      />

      <VariantDialog
        product={variantTarget}
        onClose={() => setVariantTarget(null)}
        onSelect={(variant) => {
          if (variantTarget) addProduct(variantTarget, { variant });
        }}
      />

      <CustomerModal open={customerOpen} onClose={() => setCustomerOpen(false)} />
      <DiscountDialog open={discountOpen} onClose={() => setDiscountOpen(false)} />
      <PaymentDialog open={paymentOpen} onClose={() => { setPaymentOpen(false); setSplitParts(null) }} onSuccess={onSaleSuccess} splitParts={splitParts} />
      <ProductBuilder
        product={builderTarget}
        open={Boolean(builderTarget)}
        onClose={() => setBuilderTarget(null)}
        onAdd={(config) => {
          usePosStore.getState().addConfiguredItem(config.product as PosProduct, {
            selectedOptions: config.selectedOptions,
            totalExtraPrice: config.totalExtraPrice,
            notes: config.notes,
            quantity: config.quantity,
          });
        }}
      />
      <CashRegisterPanel open={cashOpen} onClose={() => setCashOpen(false)} />
      <CatalogsModal open={catalogsOpen} onClose={() => setCatalogsOpen(false)} onSelectProduct={selectProduct} />

      <DialogComponent
        open={!!lastSale}
        onOpenChange={(o) => !o && setLastSale(null)}
        icon={<CheckCircle2 className="size-5 text-emerald-600" />}
        title="Venta completada"
        description="Revisa el ticket e imprime o continúa con un nuevo ticket."
        className="sm:max-w-sm"
        footerClassName="gap-2"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                if (lastSale) window.open(`/admin/sales?q=${lastSale.sale.saleNumber}`, "_blank");
              }}
            >
              Devolución
            </Button>
            <Button variant="outline" onClick={printReceipt} className="flex-1">
              <Printer className="size-4" /> Imprimir
            </Button>
            <Button onClick={() => setLastSale(null)} className="flex-1">
              Nuevo ticket
            </Button>
          </>
        }
      >
          {lastSale && (
            <Receipt
              sale={lastSale.sale}
              payload={lastSale.payload}
              cashierName={catalog.cashier.name}
              registerName={catalog.session?.registerName}
              company={catalog.company}
              customer={selectCustomer(lastSale.payload.customerId ?? null)}
            />
          )}
      </DialogComponent>
    </SupervisorProvider>
  );
}