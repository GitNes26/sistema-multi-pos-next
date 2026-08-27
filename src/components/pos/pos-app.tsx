"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Printer } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePosStore, selectCustomer } from "@/stores/pos-store";
import type { PosCatalog, PosLineItem, PosProduct, PosSalePayload } from "@/types/pos";
import { swalToast, swalError } from "@/lib/swal";
import { bulkDisplay } from "@/stores/pos-store";
import { usePosRefresh } from "@/hooks/use-pos-refresh";
import { SupervisorProvider } from "./supervisor-gate";
import { PosHeader } from "./pos-header";
import { CatalogPanel } from "./catalog-panel";
import { TicketPanel } from "./ticket-panel";
import { BulkModal, type BulkDraft } from "./bulk-modal";
import { VariantDialog } from "./variant-dialog";
import { CustomerModal } from "./customer-modal";
import { DiscountDialog } from "./discount-dialog";
import { PaymentDialog } from "./payment-dialog";
import { CashRegisterPanel } from "./cash-register-panel";
import { CatalogsModal } from "./catalogs-modal";
import { Receipt } from "./receipt";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface PosAppProps {
  catalog: PosCatalog;
}

type BulkTarget = {
  product: PosProduct;
  editing?: { key: string; draft: BulkDraft };
};

export function PosApp({ catalog }: PosAppProps) {
  const setCatalog = usePosStore((s) => s.setCatalog);
  const products = usePosStore((s) => s.products);
  const addProduct = usePosStore((s) => s.addProduct);
  const addBulk = usePosStore((s) => s.addBulk);
  const editItem = usePosStore((s) => s.editItem);
  const clearTicket = usePosStore((s) => s.clearTicket);
  const refresh = usePosRefresh();

  const [catalogCollapsed, setCatalogCollapsed] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<BulkTarget | null>(null);
  const [variantTarget, setVariantTarget] = useState<PosProduct | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [catalogsOpen, setCatalogsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [lastSale, setLastSale] = useState<{
    sale: { id: string; saleNumber: string; locationName: string };
    payload: PosSalePayload;
  } | null>(null);

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
      <div className="flex h-svh flex-col bg-background text-foreground">
        <PosHeader onOpenCatalogs={() => setCatalogsOpen(true)} onOpenCash={() => setCashOpen(true)} />

        <main className="flex min-h-0 flex-1">
          <ResizablePanelGroup orientation="horizontal" className="gap-0">
            <ResizablePanel defaultSize="65" minSize="35" className="min-w-0">
              <CatalogPanel
                onSelect={selectProduct}
                collapsed={catalogCollapsed}
                onToggleCollapsed={() => setCatalogCollapsed((v) => !v)}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="35" minSize="25" className="min-w-0">
              <section className="scrollbar-none h-full overflow-y-auto">
                <TicketPanel
                  onEditBulk={openBulkEdit}
                  onOpenCustomer={() => setCustomerOpen(true)}
                  onOpenDiscount={() => setDiscountOpen(true)}
                  onCheckout={() => setPaymentOpen(true)}
                />
              </section>
            </ResizablePanel>
          </ResizablePanelGroup>
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
      <PaymentDialog open={paymentOpen} onClose={() => setPaymentOpen(false)} onSuccess={onSaleSuccess} />
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