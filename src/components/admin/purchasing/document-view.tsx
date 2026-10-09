"use client"

import { createPortal } from "react-dom"
import { FileText, Printer, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DialogComponent } from "@/components/ui/dialog"
import { PurchaseStatusPill } from "@/components/shared/status-pills"
import { DocumentBrand } from "@/components/shared/document-brand"

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })

export interface ViewableDocument {
  kind: "quote" | "order"
  folio: string
  status: string
  supplierName: string
  supplierContact?: string | null
  createdAt: string
  /** Respuesta antes de (cotización) o entrega esperada (orden). */
  dueAt?: string | null
  destination?: string | null
  notes?: string | null
  /** Folio de la cotización de origen (orden) u orden generada (cotización). */
  linkedFolio?: string | null
  items: { description: string; quantity: number; receivedQuantity?: number; unitCost: number; taxRate: number }[]
}

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "—"

function Sheet({ doc, flat }: { doc: ViewableDocument; flat?: boolean }) {
  const subtotal = doc.items.reduce((a, i) => a + Number(i.quantity) * Number(i.unitCost), 0)
  const tax = doc.items.reduce((a, i) => a + Number(i.quantity) * Number(i.unitCost) * Number(i.taxRate), 0)
  const isOrder = doc.kind === "order"
  return (
    <article className={flat ? "w-full space-y-4 bg-white text-sm text-black" : "space-y-4 rounded-xl border bg-card text-sm"}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/40 p-4 print:bg-transparent">
        <div>
          <DocumentBrand className="mb-2 flex items-center gap-3" />
          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">{isOrder ? "Orden de compra" : "Solicitud de cotización"}</p>
          <p className="font-mono text-2xl font-bold">{doc.folio}</p>
          <p className="mt-1 font-semibold">{doc.supplierName}</p>
          {doc.supplierContact && <p className="text-xs text-muted-foreground">{doc.supplierContact}</p>}
        </div>
        <dl className="text-right text-xs">
          <div><dt className="inline text-muted-foreground">Fecha: </dt><dd className="inline font-medium">{day(doc.createdAt)}</dd></div>
          <div><dt className="inline text-muted-foreground">{isOrder ? "Entrega esperada: " : "Respuesta antes de: "}</dt><dd className="inline font-medium">{day(doc.dueAt)}</dd></div>
          {doc.destination && <div><dt className="inline text-muted-foreground">Llega a: </dt><dd className="inline font-medium">{doc.destination}</dd></div>}
          {doc.linkedFolio && <div><dt className="inline text-muted-foreground">{isOrder ? "Cotización: " : "Orden: "}</dt><dd className="inline font-medium">{doc.linkedFolio}</dd></div>}
        </dl>
      </header>
      <div className="overflow-x-auto px-4">
        <table className="w-full min-w-[28rem]">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">Cant.</th>
              <th className="px-2 py-2 font-medium">Descripción</th>
              {isOrder && <th className="px-2 py-2 text-right font-medium">Recibido</th>}
              <th className="px-2 py-2 text-right font-medium">P. unit.</th>
              <th className="py-2 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((i, n) => (
              <tr key={n} className="border-b last:border-0">
                <td className="py-2 tabular-nums">{Number(i.quantity)}</td>
                <td className="px-2 py-2">{i.description}</td>
                {isOrder && <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{Number(i.receivedQuantity ?? 0)} / {Number(i.quantity)}</td>}
                <td className="px-2 py-2 text-right tabular-nums">{money.format(Number(i.unitCost))}</td>
                <td className="py-2 text-right tabular-nums">{money.format(Number(i.quantity) * Number(i.unitCost))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto max-w-xs space-y-1 px-4 pb-4">
        <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money.format(subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">IVA</dt><dd className="tabular-nums">{money.format(tax)}</dd></div>
        <div className="flex justify-between border-t pt-1 text-base font-semibold"><dt>Total{isOrder ? "" : " estimado"}</dt><dd className="tabular-nums">{money.format(subtotal + tax)}</dd></div>
      </dl>
      {doc.notes && <p className="border-t px-4 py-3 text-xs text-muted-foreground">Notas: {doc.notes}</p>}
    </article>
  )
}

/** Visor de una cotización u orden de compra, listo para imprimir. */
export function DocumentViewDialog({ doc, onClose }: { doc: ViewableDocument | null; onClose: () => void }) {
  const print = () => {
    const root = document.documentElement
    root.dataset.printing = "transfer" // misma regla de impresión: solo el documento
    const clear = () => {
      delete root.dataset.printing
      window.removeEventListener("afterprint", clear)
    }
    window.addEventListener("afterprint", clear)
    window.print()
  }
  return (
    <>
      <DialogComponent
        open={Boolean(doc)}
        onOpenChange={(o) => !o && onClose()}
        title={doc ? `${doc.kind === "order" ? "Orden" : "Cotización"} ${doc.folio}` : "Documento"}
        description={doc ? undefined : ""}
        icon={doc?.kind === "order" ? <ShoppingCart /> : <FileText />}
        size="3xl"
        footer={
          <>
            {doc && <PurchaseStatusPill status={doc.status} />}
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            <Button onClick={print}><Printer className="size-4" /> Imprimir</Button>
          </>
        }
      >
        {doc && <Sheet doc={doc} />}
      </DialogComponent>
      {doc && typeof document !== "undefined" && createPortal(
        <div id="transfer-doc-print" className="hidden print:block">
          <Sheet doc={doc} flat />
        </div>,
        document.body
      )}
    </>
  )
}
