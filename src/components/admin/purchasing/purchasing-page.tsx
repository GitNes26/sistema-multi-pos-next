"use client"

import { ActiveStatusPill, PurchaseStatusPill } from "@/components/shared/status-pills"
import * as React from "react"
import {
  Building2,
  CalendarDays,
  Check,
  FileText,
  Link2,
  Loader2,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Sparkles,
  Truck,
  UserRound,
  ArrowLeft,
  ArrowRight,
  Star,
  Trash2,
  DollarSign,
} from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DialogComponent } from "@/components/ui/dialog"
import { WizardSteps } from "@/components/base/wizard-steps"
import { QuantityStepper } from "@/components/base/quantity-stepper"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { InputGroupField } from "@/components/base/input-group-field"
import { FormCombobox } from "@/components/base/form-combobox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { SwitchField } from "@/components/base/switch-field"
import { cn } from "@/lib/utils"
import { useGuideStore } from "@/stores/guide-store"
import { CrudForm } from "@/components/admin/crud/crud-form"
import { SUPPLIER_FORM_CONFIG } from "@/components/admin/crud/crud-config"

type Item = {
  id: string
  productId: string
  variantId?: string | null
  description: string
  quantity: number
  receivedQuantity?: number
  unitCost: number
  taxRate: number
}
type Supplier = {
  id: string
  code: string
  businessName: string
  tradeName?: string | null
  taxId?: string | null
  contactName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  paymentTerms?: string | null
  leadTimeDays: number
  notes?: string | null
  isActive: boolean
  products: SupplierProduct[]
}
type SupplierProduct = {
  id: string
  productId: string
  variantId?: string | null
  supplierSku?: string | null
  unitCost: number
  minimumOrder: number
  leadTimeDays?: number | null
  isPreferred: boolean
}
type Product = {
  id: string
  name: string
  productType: string
  variants: { id: string; name: string; sku?: string | null; cost: number }[]
}
type Quote = {
  id: string
  folio: string
  status: string
  supplierId: string
  supplier: { businessName: string }
  validUntil?: string | null
  notes?: string | null
  createdAt: string
  items: Item[]
}
type Order = {
  id: string
  folio: string
  status: string
  supplierId: string
  supplier: { businessName: string }
  locationType: "location" | "cedis"
  quoteId?: string | null
  locationId: string
  expectedAt?: string | null
  total: number
  createdAt: string
  items: Item[]
  receipts: { id: string; folio: string; receivedAt: string }[]
}
type Workspace = {
  suppliers: Supplier[]
  products: Product[]
  locations: { id: string; name: string }[]
  cedis: { id: string; name: string }[]
  quotes: Quote[]
  orders: Order[]
  receipts: {
    id: string
    folio: string
    receivedAt: string
    order: { folio: string; supplier: { businessName: string } }
    items: { quantity: number }[]
  }[]
}

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
})
const emptySupplier = {
  businessName: "",
  tradeName: "",
  taxId: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  paymentTerms: "",
  leadTimeDays: 0,
  notes: "",
  isActive: true,
}

async function request(body?: Record<string, unknown>) {
  const response = await fetch(
    "/api/purchasing",
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined
  )
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.ok === false)
    throw new Error(typeof json?.error === "string" ? json.error : "No fue posible completar la operación")
  return json.data
}

function StatusBadge({ status }: { status: string }) {
  return <PurchaseStatusPill status={status} />
}

export function PurchasingPage({
  icon,
  canManage,
  canApprove,
  canReceive,
}: {
  icon: React.ReactNode
  canManage: boolean
  canApprove: boolean
  canReceive: boolean
}) {
  const [data, setData] = React.useState<Workspace | null>(null),
    [loading, setLoading] = React.useState(true),
    [query, setQuery] = React.useState("")
  const [dialog, setDialog] = React.useState<
    "supplier" | "link" | "quote" | "order" | "receive" | null
  >(null)
  const [selected, setSelected] = React.useState<Supplier | Order | null>(null),
    [saving, setSaving] = React.useState(false)
  const [operationError, setOperationError] = React.useState<string | null>(null)
  const [doc, setDoc] = React.useState({
      supplierId: "",
      quoteId: "",
      locationType: "location",
      locationId: "",
      validUntil: "",
      expectedAt: "",
      notes: "",
    })
  const [items, setItems] = React.useState<Item[]>([]),
    [receiveQty, setReceiveQty] = React.useState<Record<string, string>>({})
  const [link, setLink] = React.useState({
    supplierId: "",
    productId: "",
    variantId: "",
    supplierSku: "",
    unitCost: "0",
    minimumOrder: "1",
    isPreferred: false,
  })
  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setData(await request())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])
  React.useEffect(() => {
    void load()
  }, [load])
  const close = () => {
    setDialog(null)
    setSelected(null)
    setItems([])
    setReceiveQty({})
    setOperationError(null)
  }
  const run = async (body: Record<string, unknown>, message: string, keepLinkOpen = false) => {
    setSaving(true)
    setOperationError(null)
    try {
      await request(body)
      toast.success(message)
      if (keepLinkOpen) setLink((current) => ({ ...current, productId: "", supplierSku: "", unitCost: "0", minimumOrder: "1", isPreferred: false }))
      else close()
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : "No fue posible completar la operación"
      setOperationError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }
  const supplierOptions = (data?.suppliers ?? [])
    .filter((s) => s.isActive)
    .map((s) => ({ value: s.id, label: s.businessName, meta: s.code }))
  const productOptions = (data?.products ?? []).flatMap((p) =>
    p.variants.length
      ? p.variants.map((v) => ({
          value: `${p.id}|${v.id}`,
          label: `${p.name} · ${v.name}`,
          meta: v.sku ?? "",
        }))
      : [{ value: `${p.id}|`, label: p.name }]
  )
  const addItem = (value: string) => {
    const [productId, variantId] = value.split("|")
    const product = data?.products.find((p) => p.id === productId)
    const variant = product?.variants.find((v) => v.id === variantId)
    if (
      !product ||
      items.some(
        (i) => i.productId === productId && (i.variantId ?? "") === variantId
      )
    )
      return
    const linked = data?.suppliers
      .find((s) => s.id === doc.supplierId)
      ?.products.find(
        (p) => p.productId === productId && (p.variantId ?? "") === variantId
      )
    setItems((v) => [
      ...v,
      {
        id: crypto.randomUUID(),
        productId,
        variantId: variantId || null,
        description: `${product.name}${variant && variant.name !== "Default" ? ` · ${variant.name}` : ""}`,
        quantity: linked?.minimumOrder ?? 1,
        unitCost: linked?.unitCost ?? Number(variant?.cost ?? 0),
        taxRate: 0,
      },
    ])
  }
  const filteredSuppliers = (data?.suppliers ?? []).filter((s) =>
    `${s.businessName} ${s.code} ${s.contactName ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )
  const selectedOrder =
    selected && "items" in selected ? (selected as Order) : null

  return (
    <div className="space-y-5" data-guide="purchasing-workspace">
      <PageHeader
        icon={icon}
        title="Proveedores y compras"
        description="Del proveedor al inventario, con cotización, aprobación y recepción trazable."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                useGuideStore
                  .getState()
                  .start("purchasing", "/admin/purchasing")
              }
            >
              <Sparkles />
              Guía paso a paso
            </Button>
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              Actualizar
            </Button>
            {canManage && (
              <Button
                data-guide="supplier-new"
                onClick={() => {
                  setDialog("supplier")
                }}
              >
                <Plus />
                Nuevo proveedor
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<Building2 />}
          label="Proveedores activos"
          value={data?.suppliers.filter((s) => s.isActive).length ?? 0}
        />
        <Metric
          icon={<FileText />}
          label="Cotizaciones abiertas"
          value={
            data?.quotes.filter((q) => !["cancelled"].includes(q.status))
              .length ?? 0
          }
        />
        <Metric
          icon={<ShoppingCart />}
          label="Órdenes en tránsito"
          value={
            data?.orders.filter((o) =>
              ["approved", "sent", "partially_received"].includes(o.status)
            ).length ?? 0
          }
        />
        <Metric
          icon={<PackageCheck />}
          label="Recepciones"
          value={data?.receipts.length ?? 0}
        />
      </div>
      <Tabs defaultValue="suppliers">
        <TabsList className="scrollbar-none h-auto w-full justify-start overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
          <TabsTrigger value="quotes" data-guide="purchasing-quotes-tab">
            Cotizaciones
          </TabsTrigger>
          <TabsTrigger value="orders" data-guide="purchasing-orders-tab">
            Órdenes
          </TabsTrigger>
          <TabsTrigger value="receipts" data-guide="purchasing-receipts-tab">
            Historial de recepción
          </TabsTrigger>
        </TabsList>
        <TabsContent value="suppliers" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <InputGroupField
              id="supplier-search"
              label="Buscar proveedor"
              leftIcon={<Search />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, código o contacto"
            />
            {canManage && (
              <Button
                data-guide="supplier-link"
                variant="outline"
                className="self-end"
                onClick={() => {
                  setLink({
                    supplierId: "",
                    productId: "",
                    variantId: "",
                    supplierSku: "",
                    unitCost: "0",
                    minimumOrder: "1",
                    isPreferred: false,
                  })
                  setDialog("link")
                }}
              >
                <Link2 />
                Vincular producto
              </Button>
            )}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredSuppliers.map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{s.businessName}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {s.code}
                        {s.tradeName ? ` · ${s.tradeName}` : ""}
                      </p>
                    </div>
                    <ActiveStatusPill active={s.isActive} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <span className="flex gap-2">
                      <UserRound className="size-4 text-muted-foreground" />
                      {s.contactName || "Sin contacto"}
                    </span>
                    <span className="flex gap-2">
                      <Phone className="size-4 text-muted-foreground" />
                      {s.phone || "Sin teléfono"}
                    </span>
                    <span className="flex gap-2">
                      <Mail className="size-4 text-muted-foreground" />
                      {s.email || "Sin correo"}
                    </span>
                    <span className="flex gap-2">
                      <Truck className="size-4 text-muted-foreground" />
                      {s.leadTimeDays} días de entrega
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-muted-foreground">
                      {s.products.length} productos vinculados
                    </span>
                    {canManage && (
                      <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setOperationError(null); setLink({ supplierId: s.id, productId: "", variantId: "", supplierSku: "", unitCost: "0", minimumOrder: "1", isPreferred: false }); setDialog("link") }}><Link2 className="size-4" /> Productos</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelected(s)
                          setDialog("supplier")
                        }}
                      >
                        Editar
                      </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="quotes">
          <SectionHeader
            title="Solicitudes de cotización"
            action={
              canManage && (
                <Button
                  data-guide="quote-new"
                  onClick={() => {
                    setDoc({
                      supplierId: "",
                      quoteId: "",
                      locationType: "location",
                      locationId: "",
                      validUntil: "",
                      expectedAt: "",
                      notes: "",
                    })
                    setItems([])
                    setDialog("quote")
                  }}
                >
                  <Plus />
                  Nueva cotización
                </Button>
              )
            }
          />
          <DocumentList
            rows={data?.quotes ?? []}
            orders={data?.orders ?? []}
            onEdit={canManage ? (quote) => {
              if (data?.orders.some((order) => order.quoteId === quote.id)) { toast.error("La cotización ya está vinculada a una orden y no puede modificarse"); return }
              setDoc({ supplierId: quote.supplierId, quoteId: quote.id, locationType: "location", locationId: "", validUntil: quote.validUntil ? quote.validUntil.slice(0, 10) : "", expectedAt: "", notes: quote.notes ?? "" })
              setItems(quote.items.map((item) => ({ ...item, id: crypto.randomUUID(), quantity: Number(item.quantity), unitCost: Number(item.unitCost), taxRate: Number(item.taxRate) })))
              setDialog("quote")
            } : undefined}
            onCreateOrder={
              canManage
                ? (quote) => {
                    if (data?.orders.some((order) => order.quoteId === quote.id && order.status !== "cancelled")) {
                      toast.error("Esta cotización ya tiene una orden activa")
                      return
                    }
                    setDoc({
                      supplierId: quote.supplierId,
                      quoteId: quote.id,
                      locationType: "location",
                      locationId: "",
                      validUntil: "",
                      expectedAt: "",
                      notes: "",
                    })
                    setItems(
                      quote.items.map((item) => ({
                        ...item,
                        id: crypto.randomUUID(),
                        quantity: Number(item.quantity),
                        unitCost: Number(item.unitCost),
                        taxRate: Number(item.taxRate),
                      }))
                    )
                    setDialog("order")
                  }
                : undefined
            }
          />
        </TabsContent>
        <TabsContent value="orders">
          <SectionHeader
            title="Órdenes de compra"
            action={
              canManage && (
                <Button
                  data-guide="order-new"
                  onClick={() => {
                    setDoc({
                      supplierId: "",
                      quoteId: "",
                      locationType: "location",
                      locationId: "",
                      validUntil: "",
                      expectedAt: "",
                      notes: "",
                    })
                    setItems([])
                    setDialog("order")
                  }}
                >
                  <Plus />
                  Nueva orden
                </Button>
              )
            }
          />
          <div className="space-y-3" data-guide="order-list">
            {(data?.orders ?? []).map((o) => (
              <Card key={o.id}>
                <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{o.folio}</strong>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {o.supplier.businessName} · {o.items.length} partidas ·{" "}
                      {money.format(o.total)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Recibido:{" "}
                      {o.items.reduce(
                        (a, i) => a + Number(i.receivedQuantity ?? 0),
                        0
                      )}{" "}
                      de {o.items.reduce((a, i) => a + Number(i.quantity), 0)}{" "}
                      unidades
                    </p>
                    <p className="mt-2 text-xs font-medium text-foreground">
                      {o.status === "draft" ? "Siguiente paso: aprobar la orden" : o.status === "approved" ? "Siguiente paso: marcar el envío o registrar la recepción" : o.status === "sent" ? "Siguiente paso: registrar lo recibido" : o.status === "partially_received" ? "Recepción parcial: registra el saldo pendiente" : o.status === "received" ? "Recepción completa; inventario actualizado" : "Orden cancelada"}
                    </p>
                    {o.receipts.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{o.receipts.length} recepción{o.receipts.length === 1 ? "" : "es"} registrada{o.receipts.length === 1 ? "" : "s"} · Última: {new Date(o.receipts[o.receipts.length - 1].receivedAt).toLocaleDateString("es-MX")}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canApprove && o.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          void run(
                            {
                              action: "status",
                              orderId: o.id,
                              status: "approved",
                            },
                            "Orden aprobada"
                          )
                        }
                      >
                        <Check />
                        Aprobar
                      </Button>
                    )}
                    {canManage && o.status === "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void run(
                            { action: "status", orderId: o.id, status: "sent" },
                            "Orden marcada como enviada"
                          )
                        }
                      >
                        <Truck />
                        Marcar enviada
                      </Button>
                    )}
                    {canReceive &&
                      ["approved", "sent", "partially_received"].includes(
                        o.status
                      ) && (
                        <Button
                          data-guide="receive-action"
                          size="sm"
                          onClick={() => {
                            setSelected(o)
                            setReceiveQty(
                              Object.fromEntries(
                                o.items
                                  .filter(
                                    (i) =>
                                      Number(i.receivedQuantity ?? 0) <
                                      Number(i.quantity)
                                  )
                                  .map((i) => [
                                    i.id,
                                    String(
                                      Number(i.quantity) -
                                        Number(i.receivedQuantity ?? 0)
                                    ),
                                  ])
                              )
                            )
                            setDialog("receive")
                          }}
                        >
                          <PackageCheck />
                          Recibir
                        </Button>
                      )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="receipts">
          <SectionHeader title="Entradas confirmadas al inventario" />
          <div className="space-y-2">
            {(data?.receipts ?? []).map((r) => (
              <div
                key={r.id}
                className="flex flex-col justify-between gap-2 rounded-xl border p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <strong>{r.folio}</strong>
                  <p className="text-sm text-muted-foreground">
                    {r.order.supplier.businessName} · Orden {r.order.folio}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {r.items.reduce((a, i) => a + Number(i.quantity), 0)} unidades
                  · {new Date(r.receivedAt).toLocaleString("es-MX")}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <DialogComponent
        open={dialog === "supplier"}
        onOpenChange={(v) => !v && close()}
        title={selected ? "Editar proveedor" : "Nuevo proveedor"}
        description="Registra sus datos comerciales y condiciones habituales."
        icon={<Building2 />}
        size="2xl"
        dataGuide="supplier-dialog"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="supplier-form"
              disabled={saving}
            >
              {saving && <Loader2 className="animate-spin" />}Guardar
            </Button>
          </>
        }
      >
        {operationError && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{operationError}</p>}
        <CrudForm
          formId="supplier-form"
          config={SUPPLIER_FORM_CONFIG}
          initial={selected ? { ...emptySupplier, ...selected } : null}
          onSavingChange={setSaving}
          onSubmit={async (values) => {
            await request({ action: selected ? "supplier.update" : "supplier.create", ...(selected ? { id: selected.id } : {}), ...values })
            toast.success("Proveedor guardado")
            close()
            await load()
          }}
        />

      </DialogComponent>

      <DialogComponent
        open={dialog === "link"}
        onOpenChange={(v) => !v && close()}
        title="Vincular producto"
        description="Guarda SKU, costo y mínimo propios del proveedor."
        icon={<Link2 />}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={saving || !link.supplierId || !link.productId}
              onClick={() => {
                const [productId, variantId] = link.productId.split("|")
                void run(
                  {
                    action: "supplier.link",
                    ...link,
                    productId,
                    variantId: variantId || null,
                    unitCost: Number(link.unitCost),
                    minimumOrder: Number(link.minimumOrder),
                  },
                  "Producto vinculado",
                  true
                )
              }}
            >
              Vincular
            </Button>
          </>
        }
      >
        {operationError && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{operationError}</p>}
        <div className="space-y-4">
          <FormCombobox
            id="link-supplier"
            label="Proveedor"
            required
            icon={<Building2 />}
            options={supplierOptions}
            value={link.supplierId}
            onChange={(supplierId) => setLink((v) => ({ ...v, supplierId }))}
          />
          <FormCombobox
            id="link-product"
            label="Producto o variante"
            required
            icon={<ShoppingCart />}
            options={productOptions}
            value={link.productId}
            onChange={(productId) => setLink((v) => ({ ...v, productId }))}
          />
          <InputGroupField
            id="link-sku"
            label="SKU del proveedor"
            leftIcon={<FileText />}
            value={link.supplierSku}
            onChange={(e) =>
              setLink((v) => ({ ...v, supplierSku: e.target.value }))
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <InputGroupField
              id="link-cost"
              label="Costo unitario"
              type="number"
              min={0}
              step="0.01"
              leftIcon={<ShoppingCart />}
              value={link.unitCost}
              onChange={(e) =>
                setLink((v) => ({ ...v, unitCost: e.target.value }))
              }
            />
            <InputGroupField
              id="link-min"
              label="Pedido mínimo"
              type="number"
              min={0.001}
              step="0.001"
              leftIcon={<PackageCheck />}
              value={link.minimumOrder}
              onChange={(e) =>
                setLink((v) => ({ ...v, minimumOrder: e.target.value }))
              }
            />
          </div>
          <SwitchField
            id="link-preferred"
            label="Proveedor preferido"
            checked={link.isPreferred}
            onCheckedChange={(isPreferred) =>
              setLink((v) => ({ ...v, isPreferred }))
            }
          />
          {link.supplierId && <div className="rounded-xl border" aria-label="Productos vinculados al proveedor">
            <div className="border-b bg-muted/40 px-3 py-2 text-sm font-semibold">Productos vinculados · {data?.suppliers.find((supplier) => supplier.id === link.supplierId)?.products.length ?? 0}</div>
            <div className="max-h-56 overflow-y-auto">
              {data?.suppliers.find((supplier) => supplier.id === link.supplierId)?.products.map((entry) => {
                const product = data.products.find((candidate) => candidate.id === entry.productId)
                const variant = product?.variants.find((candidate) => candidate.id === entry.variantId)
                return <button key={entry.id} type="button" className="flex min-h-12 w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => setLink({ supplierId: link.supplierId, productId: `${entry.productId}|${entry.variantId ?? ""}`, variantId: entry.variantId ?? "", supplierSku: entry.supplierSku ?? "", unitCost: String(entry.unitCost), minimumOrder: String(entry.minimumOrder), isPreferred: entry.isPreferred })}>
                  <span className="min-w-0"><span className="block truncate font-medium">{product?.name ?? "Producto no disponible"}{variant ? ` · ${variant.name}` : ""}</span><span className="block text-xs text-muted-foreground">{entry.supplierSku || "Sin SKU"} · Mínimo {entry.minimumOrder}</span></span>
                  <span className="shrink-0 font-semibold tabular-nums">{money.format(entry.unitCost)}</span>
                </button>
              })}
              {!data?.suppliers.find((supplier) => supplier.id === link.supplierId)?.products.length && <p className="p-3 text-sm text-muted-foreground">Aún no hay productos vinculados. Selecciona uno arriba para agregarlo.</p>}
            </div>
          </div>}
        </div>
      </DialogComponent>

      <PurchaseDocumentDialog
        kind={dialog === "quote" ? "quote" : "order"}
        open={dialog === "quote" || dialog === "order"}
        close={close}
        saving={saving}
        error={operationError}
        data={data}
        doc={doc}
        setDoc={setDoc}
        items={items}
        setItems={setItems}
        addItem={addItem}
        submit={() =>
          void run(
            {
              action: dialog === "quote" ? (doc.quoteId ? "quote.update" : "quote.create") : "order.create",
              ...doc,
              items,
            },
            dialog === "quote" ? (doc.quoteId ? "Cotización actualizada" : "Cotización creada") : "Orden creada"
          )
        }
      />
      <DialogComponent
        open={dialog === "receive"}
        onOpenChange={(v) => !v && close()}
        title={`Recibir ${selectedOrder?.folio ?? "orden"}`}
        description="Confirma solo lo físicamente recibido. Las cantidades se sumarán al inventario del destino."
        icon={<PackageCheck />}
        size="2xl"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={
                saving || !Object.values(receiveQty).some((v) => Number(v) > 0)
              }
              onClick={() => {
                const invalid = selectedOrder?.items.find((item) => {
                  const quantity = Number(receiveQty[item.id] ?? 0)
                  return !Number.isFinite(quantity) || quantity < 0 || quantity > Number(item.quantity) - Number(item.receivedQuantity ?? 0)
                })
                if (invalid) { setOperationError(`Revisa la cantidad de ${invalid.description}: no puede superar lo pendiente ni ser negativa.`); document.getElementById(`receive-${invalid.id}`)?.focus(); return }
                void run(
                  {
                    action: "receive",
                    orderId: selectedOrder?.id,
                    items: Object.entries(receiveQty)
                      .filter(([, q]) => Number(q) > 0)
                      .map(([orderItemId, quantity]) => ({
                        orderItemId,
                        quantity: Number(quantity),
                      })),
                  },
                  "Recepción ingresada al inventario"
                )
              }}
            >
              <PackageCheck />
              Confirmar recepción
            </Button>
          </>
        }
      >
        {operationError && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{operationError}</p>}
        {selectedOrder?.items.map((item) => {
          const pending =
            Number(item.quantity) - Number(item.receivedQuantity ?? 0)
          return (
            pending > 0 && (
              <div
                key={item.id}
                className="grid items-end gap-3 border-b py-3 sm:grid-cols-[1fr_10rem]"
              >
                <div>
                  <strong className="text-sm">{item.description}</strong>
                  <p className="text-xs text-muted-foreground">
                    Pedido {item.quantity} · Recibido{" "}
                    {item.receivedQuantity ?? 0} · Pendiente {pending}
                  </p>
                </div>
                <InputGroupField
                  id={`receive-${item.id}`}
                  label="Recibir ahora"
                  type="number"
                  min={0}
                  max={pending}
                  step="0.001"
                  leftIcon={<PackageCheck />}
                  value={receiveQty[item.id] ?? ""}
                  onChange={(e) =>
                    setReceiveQty((v) => ({ ...v, [item.id]: e.target.value }))
                  }
                />
              </div>
            )
          )
        })}
      </DialogComponent>
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary [&>svg]:size-5">
          {icon}
        </span>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
      <h2 className="font-heading text-base font-medium">{title}</h2>
      {action}
    </div>
  )
}
function DocumentList({
  rows,
  orders,
  onCreateOrder,
  onEdit,
}: {
  rows: Quote[]
  orders: Order[]
  onCreateOrder?: (quote: Quote) => void
  onEdit?: (quote: Quote) => void
}) {
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const linkedOrder = orders.find((order) => order.quoteId === r.id)
        const activeOrder = linkedOrder?.status !== "cancelled" ? linkedOrder : null
        const total = r.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost) * (1 + Number(item.taxRate)), 0)
        return (
        <div
          key={r.id}
          className="flex flex-col justify-between gap-2 rounded-xl border p-4 sm:flex-row sm:items-center"
        >
          <div>
            <div className="flex items-center gap-2">
              <strong>{r.folio}</strong>
              <StatusBadge status={r.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {r.supplier.businessName} · {r.items.length} partidas · {money.format(total)}
            </p>
            {linkedOrder && <p className="mt-1 text-xs text-muted-foreground">Vinculada con la orden {linkedOrder.folio}. Ya no se puede modificar.{activeOrder ? " Para continuar, usa esa orden." : " Puedes crear una nueva orden porque la anterior se canceló."}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {new Date(r.createdAt).toLocaleDateString("es-MX")}
            </span>
            {onEdit && !["cancelled"].includes(r.status) && !linkedOrder && (
              <Button size="sm" variant="outline" onClick={() => onEdit(r)}>Modificar</Button>
            )}
            {onCreateOrder && !activeOrder && r.status !== "cancelled" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCreateOrder(r)}
              >
                <ShoppingCart />
                Crear orden
              </Button>
            )}
          </div>
        </div>
      )})}
    </div>
  )
}

function PurchaseDocumentDialog({
  kind,
  open,
  close,
  saving,
  error,
  data,
  doc,
  setDoc,
  items,
  setItems,
  addItem,
  submit,
}: {
  kind: "quote" | "order"
  open: boolean
  close: () => void
  saving: boolean
  error: string | null
  data: Workspace | null
  doc: {
    supplierId: string
    quoteId: string
    locationType: string
    locationId: string
    validUntil: string
    expectedAt: string
    notes: string
  }
  setDoc: React.Dispatch<React.SetStateAction<typeof doc>>
  items: Item[]
  setItems: React.Dispatch<React.SetStateAction<Item[]>>
  addItem: (value: string) => void
  submit: () => void
}) {
  // Asistente: 1) proveedor (y destino), 2) productos, 3) revisar.
  const steps = [
    { title: "Proveedor", hint: kind === "order" ? "¿A quién le compras y a dónde llega la mercancía?" : "¿A qué proveedor le pides precios?" },
    { title: "Productos", hint: "Los productos que ya surte este proveedor aparecen como sugerencias con su último costo." },
    { title: "Revisar", hint: kind === "order" ? "Confirma importes. La orden queda como borrador hasta que se apruebe." : "Revisa lo que vas a cotizar." },
  ]
  const [step, setStep] = React.useState(0)
  React.useEffect(() => {
    if (open) {
      setStep(doc.supplierId && items.length ? 1 : 0)
    }
    // Solo al abrir: el paso inicial depende de si viene precargado (desde una cotización).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind])

  const supplier = data?.suppliers.find((s) => s.id === doc.supplierId) ?? null
  const productName = (productId: string, variantId?: string | null) => {
    const p = data?.products.find((x) => x.id === productId)
    const v = p?.variants.find((x) => x.id === variantId)
    return `${p?.name ?? "Producto"}${v && v.name !== "Default" ? ` · ${v.name}` : ""}`
  }
  const has = (productId: string, variantId?: string | null) => items.some((i) => i.productId === productId && (i.variantId ?? "") === (variantId ?? ""))
  const suggestions = (supplier?.products ?? []).filter((sp) => !has(sp.productId, sp.variantId))
  const options = (data?.products ?? [])
    .flatMap((p) =>
      p.variants.length
        ? p.variants.map((v) => ({ value: `${p.id}|${v.id}`, label: `${p.name}${v.name !== "Default" ? ` · ${v.name}` : ""}`, meta: v.sku ?? "" }))
        : [{ value: `${p.id}|`, label: p.name, meta: "" }]
    )
    .filter((o) => !items.some((i) => `${i.productId}|${i.variantId ?? ""}` === o.value))
  const destinations = doc.locationType === "cedis" ? (data?.cedis ?? []) : (data?.locations ?? [])

  const subtotal = items.reduce((a, i) => a + Number(i.quantity) * Number(i.unitCost), 0)
  const taxes = items.reduce((a, i) => a + Number(i.quantity) * Number(i.unitCost) * Number(i.taxRate), 0)
  const update = (index: number, patch: Partial<Item>) => setItems((v) => v.map((x, i) => (i === index ? { ...x, ...patch } : x)))

  const pickSupplier = (s: Supplier) => {
    setDoc((v) => {
      // Entrega sugerida = hoy + días de entrega del proveedor (si no se eligió otra).
      const suggested = s.leadTimeDays > 0 && !v.expectedAt ? new Date(Date.now() + s.leadTimeDays * 86400000).toISOString().slice(0, 10) : v.expectedAt
      return { ...v, supplierId: s.id, expectedAt: kind === "order" ? suggested : v.expectedAt }
    })
  }

  const stepValid =
    step === 0
      ? Boolean(doc.supplierId) && (kind === "quote" || Boolean(doc.locationId))
      : step === 1
        ? items.length > 0 && items.every((i) => Number(i.quantity) > 0 && Number(i.unitCost) >= 0)
        : true

  return (
    <DialogComponent
      open={open}
      onOpenChange={(v) => !v && close()}
      title={kind === "quote" ? (doc.quoteId ? "Modificar cotización" : "Nueva solicitud de cotización") : "Nueva orden de compra"}
      description={kind === "quote" ? "Pide precios a tu proveedor en 3 pasos." : "Arma tu pedido al proveedor en 3 pasos."}
      icon={kind === "quote" ? <FileText /> : <ShoppingCart />}
      size="3xl"
      bodyClassName="space-y-4"
      footer={
        <>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              <ArrowLeft /> Atrás
            </Button>
          ) : (
            <Button variant="outline" onClick={close}>Cancelar</Button>
          )}
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!stepValid}>
              Continuar <ArrowRight />
            </Button>
          ) : (
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              {kind === "quote" ? (doc.quoteId ? "Guardar cotización" : "Crear cotización") : "Crear orden"}
            </Button>
          )}
        </>
      }
    >
      <WizardSteps steps={steps} current={step} onStepClick={setStep} />
      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      {step === 0 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Proveedor</Label>
            {(data?.suppliers ?? []).filter((s) => s.isActive).length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Primero da de alta un proveedor en la pestaña Proveedores.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {(data?.suppliers ?? []).filter((s) => s.isActive).map((s) => {
                  const selected = s.id === doc.supplierId
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickSupplier(s)}
                      aria-pressed={selected}
                      className={cn("press rounded-xl border p-3 text-left transition-colors", selected ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:border-primary/40")}
                    >
                      <span className="flex items-center gap-2">
                        <Building2 className={cn("size-4", selected ? "text-primary" : "text-muted-foreground")} />
                        <span className="truncate font-medium">{s.businessName}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{s.products.length} productos vinculados</span>
                        {s.leadTimeDays > 0 && <span>Entrega en {s.leadTimeDays} días</span>}
                        {s.paymentTerms && <span>{s.paymentTerms}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {kind === "order" ? (
            <div className="space-y-2">
              <Label>¿A dónde llega?</Label>
              <SegmentedFilter
                ariaLabel="Tipo de destino"
                value={doc.locationType}
                onChange={(locationType) => setDoc((v) => ({ ...v, locationType, locationId: "" }))}
                options={[
                  { value: "location", label: "Sucursal" },
                  { value: "cedis", label: "CEDIS" },
                ]}
              />
              <div className="grid gap-2 sm:grid-cols-3">
                {destinations.map((d) => {
                  const selected = d.id === doc.locationId
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDoc((v) => ({ ...v, locationId: d.id }))}
                      aria-pressed={selected}
                      className={cn("press flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors", selected ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:border-primary/40")}
                    >
                      <MapPin className={cn("size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate font-medium">{d.name}</span>
                    </button>
                  )
                })}
              </div>
              <InputGroupField
                id="order-expected"
                label="Entrega esperada"
                type="date"
                leftIcon={<CalendarDays />}
                value={doc.expectedAt}
                helper={supplier?.leadTimeDays ? `Sugerida según los ${supplier.leadTimeDays} días de entrega del proveedor.` : undefined}
                onChange={(e) => setDoc((v) => ({ ...v, expectedAt: e.target.value }))}
                className="sm:max-w-xs"
              />
            </div>
          ) : (
            <InputGroupField
              id="quote-valid"
              label="¿Hasta cuándo necesitas la respuesta?"
              type="date"
              leftIcon={<CalendarDays />}
              value={doc.validUntil}
              onChange={(e) => setDoc((v) => ({ ...v, validUntil: e.target.value }))}
              className="sm:max-w-xs"
            />
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Sparkles className="size-4 text-primary" /> Lo que te surte {supplier?.businessName}</Label>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => addItem(`${sp.productId}|${sp.variantId ?? ""}`)}
                    className="press flex items-center gap-2 rounded-full border bg-card py-1.5 pr-3 pl-1.5 text-sm transition-colors hover:border-primary/40"
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary"><Plus className="size-3.5" /></span>
                    <span className="font-medium">{productName(sp.productId, sp.variantId)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{money.format(sp.unitCost)}{sp.minimumOrder > 1 ? ` · mín. ${sp.minimumOrder}` : ""}</span>
                    {sp.isPreferred && <Star className="size-3.5 fill-warning text-warning" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <FormCombobox
            id="purchase-add-product"
            label={suggestions.length ? "¿Algo más? Busca cualquier producto" : "Busca y agrega productos"}
            icon={<Search />}
            options={options}
            value=""
            onChange={(value) => addItem(value)}
            placeholder="Nombre o SKU…"
          />

          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Aún no agregas productos.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item, index) => {
                const link = supplier?.products.find((p) => p.productId === item.productId && (p.variantId ?? "") === (item.variantId ?? ""))
                const belowMin = link && item.quantity < link.minimumOrder
                return (
                  <li key={item.id} className="space-y-2 rounded-xl border bg-muted/30 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-sm">{item.description}</strong>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar" onClick={() => setItems((v) => v.filter((_, i) => i !== index))}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1">
                        <span className="block text-xs text-muted-foreground">Cantidad</span>
                        <QuantityStepper size="sm" value={item.quantity} min={0} decimals={3} onChange={(quantity) => update(index, { quantity })} ariaLabel={`Cantidad de ${item.description}`} />
                      </div>
                      <InputGroupField
                        id={`cost-${item.id}`}
                        label="Costo unitario"
                        type="number"
                        min={0}
                        step="0.01"
                        leftIcon={<DollarSign />}
                        value={item.unitCost}
                        onChange={(e) => update(index, { unitCost: Number(e.target.value) })}
                        className="w-36"
                      />
                      <div className="space-y-1">
                        <span className="block text-xs text-muted-foreground">IVA</span>
                        <div className="flex gap-1" role="radiogroup" aria-label="IVA">
                          {[0, 0.08, 0.16].map((rate) => (
                            <button
                              key={rate}
                              type="button"
                              role="radio"
                              aria-checked={item.taxRate === rate}
                              onClick={() => update(index, { taxRate: rate })}
                              className={cn("h-9 rounded-lg border px-2.5 text-sm tabular-nums transition-colors", item.taxRate === rate ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/40")}
                            >
                              {Math.round(rate * 100)}%
                            </button>
                          ))}
                        </div>
                      </div>
                      <span className="ml-auto text-right">
                        <span className="block text-xs text-muted-foreground">Importe</span>
                        <strong className="tabular-nums">{money.format(item.quantity * item.unitCost * (1 + item.taxRate))}</strong>
                      </span>
                    </div>
                    {belowMin && <p className="text-xs text-warning-ink">El pedido mínimo de este proveedor es {link.minimumOrder}.</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border bg-muted/40 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Proveedor</p>
              <p className="font-semibold">{supplier?.businessName ?? "—"}</p>
            </div>
            {kind === "order" ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Llega a</p>
                  <p className="font-semibold">{destinations.find((d) => d.id === doc.locationId)?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entrega esperada</p>
                  <p className="font-semibold">{doc.expectedAt ? new Date(`${doc.expectedAt}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" }) : "Sin fecha"}</p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground">Respuesta antes de</p>
                <p className="font-semibold">{doc.validUntil ? new Date(`${doc.validUntil}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" }) : "Sin fecha"}</p>
              </div>
            )}
          </div>
          <ul className="divide-y rounded-xl border text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 px-3 py-2">
                <span className="truncate">{i.quantity} × {i.description}</span>
                <span className="tabular-nums">{money.format(i.quantity * i.unitCost)}</span>
              </li>
            ))}
          </ul>
          <dl className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money.format(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">IVA</dt><dd className="tabular-nums">{money.format(taxes)}</dd></div>
            <div className="flex justify-between border-t pt-1 text-base font-semibold"><dt>Total estimado</dt><dd className="tabular-nums">{money.format(subtotal + taxes)}</dd></div>
          </dl>
          <div className="space-y-2">
            <Label htmlFor="purchase-notes">Notas y condiciones</Label>
            <Textarea id="purchase-notes" value={doc.notes} onChange={(e) => setDoc((v) => ({ ...v, notes: e.target.value }))} placeholder="Ej. entregar en horario de 8 a 12" />
          </div>
        </div>
      )}
    </DialogComponent>
  )
}
