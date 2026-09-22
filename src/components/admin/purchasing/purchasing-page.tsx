"use client"

import * as React from "react"
import * as yup from "yup"
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
} from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { FormCombobox } from "@/components/base/form-combobox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { SwitchField } from "@/components/base/switch-field"
import { cn } from "@/lib/utils"
import { useGuideStore } from "@/stores/guide-store"

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

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  requested: "Solicitada",
  quoted: "Respondida",
  approved: "Aprobada",
  sent: "Enviada",
  partially_received: "Recepción parcial",
  received: "Recibida",
  cancelled: "Cancelada",
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

const supplierSchema = yup.object({
  businessName: yup.string().trim().required("Ingresa la razón social"),
  email: yup.string().trim().email("Ingresa un correo válido"),
  leadTimeDays: yup.number().min(0, "Los días de entrega no pueden ser negativos"),
})

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
  const json = await response.json()
  if (!response.ok)
    throw new Error(json.error ?? "No fue posible completar la operación")
  return json.data
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={
        status === "received"
          ? "default"
          : status === "cancelled"
            ? "destructive"
            : "secondary"
      }
    >
      {statusLabel[status] ?? status}
    </Badge>
  )
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
  const [supplierErrors, setSupplierErrors] = React.useState<Record<string, string>>({})
  const [supplier, setSupplier] = React.useState(emptySupplier),
    [doc, setDoc] = React.useState({
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
    setSupplierErrors({})
  }
  const submitSupplier = async () => {
    try {
      await supplierSchema.validate(supplier, { abortEarly: false })
      setSupplierErrors({})
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {}
        for (const issue of error.inner.length ? error.inner : [error]) {
          if (issue.path && !next[issue.path]) next[issue.path] = issue.message
        }
        setSupplierErrors(next)
        const first = ["businessName", "email", "leadTimeDays"].find((key) => next[key])
        const inputId = first === "businessName" ? "supplier-name" : first === "email" ? "supplier-email" : "supplier-lead"
        requestAnimationFrame(() => document.getElementById(inputId)?.focus())
        return
      }
      throw error
    }
    await run({ action: selected ? "supplier.update" : "supplier.create", ...(selected ? { id: selected.id } : {}), ...supplier }, "Proveedor guardado")
  }
  const run = async (body: Record<string, unknown>, message: string) => {
    setSaving(true)
    try {
      await request(body)
      toast.success(message)
      close()
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error")
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
        description: `${product.name}${variant ? ` · ${variant.name}` : ""}`,
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
                  setSupplier(emptySupplier)
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
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
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
                    <Badge variant={s.isActive ? "default" : "secondary"}>
                      {s.isActive ? "Activo" : "Inactivo"}
                    </Badge>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelected(s)
                          setSupplier({
                            businessName: s.businessName,
                            tradeName: s.tradeName ?? "",
                            taxId: s.taxId ?? "",
                            contactName: s.contactName ?? "",
                            email: s.email ?? "",
                            phone: s.phone ?? "",
                            address: s.address ?? "",
                            paymentTerms: s.paymentTerms ?? "",
                            leadTimeDays: s.leadTimeDays,
                            notes: s.notes ?? "",
                            isActive: s.isActive,
                          })
                          setDialog("supplier")
                        }}
                      >
                        Editar
                      </Button>
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
            onEdit={canManage ? (quote) => {
              if (data?.orders.some((order) => order.quoteId === quote.id)) { toast.error("Esta cotización ya tiene una orden"); return }
              setDoc({ supplierId: quote.supplierId, quoteId: quote.id, locationType: "location", locationId: "", validUntil: quote.validUntil ? quote.validUntil.slice(0, 10) : "", expectedAt: "", notes: quote.notes ?? "" })
              setItems(quote.items.map((item) => ({ ...item, id: crypto.randomUUID(), quantity: Number(item.quantity), unitCost: Number(item.unitCost), taxRate: Number(item.taxRate) })))
              setDialog("quote")
            } : undefined}
            onCreateOrder={
              canManage
                ? (quote) => {
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
        <form id="supplier-form" noValidate onSubmit={(event) => { event.preventDefault(); void submitSupplier() }} className="grid gap-4 sm:grid-cols-2">
          <InputGroupField
            id="supplier-name"
            label="Razón social"
            required
            leftIcon={<Building2 />}
            value={supplier.businessName}
            onChange={(e) => { setSupplier((v) => ({ ...v, businessName: e.target.value })); setSupplierErrors((v) => ({ ...v, businessName: "" })) }}
            error={supplierErrors.businessName}
            autoFocus
          />
          <InputGroupField
            id="supplier-trade"
            label="Nombre comercial"
            leftIcon={<Building2 />}
            value={supplier.tradeName}
            onChange={(e) =>
              setSupplier((v) => ({ ...v, tradeName: e.target.value }))
            }
          />
          <InputGroupField
            id="supplier-tax"
            label="RFC"
            leftIcon={<FileText />}
            value={supplier.taxId}
            onChange={(e) =>
              setSupplier((v) => ({
                ...v,
                taxId: e.target.value.toUpperCase(),
              }))
            }
          />
          <InputGroupField
            id="supplier-contact"
            label="Persona de contacto"
            leftIcon={<UserRound />}
            value={supplier.contactName}
            onChange={(e) =>
              setSupplier((v) => ({ ...v, contactName: e.target.value }))
            }
          />
          <InputGroupField
            id="supplier-email"
            label="Correo"
            type="email"
            leftIcon={<Mail />}
            value={supplier.email}
            onChange={(e) => { setSupplier((v) => ({ ...v, email: e.target.value })); setSupplierErrors((v) => ({ ...v, email: "" })) }}
            error={supplierErrors.email}
          />
          <InputGroupField
            id="supplier-phone"
            label="Teléfono"
            leftIcon={<Phone />}
            value={supplier.phone}
            onChange={(e) =>
              setSupplier((v) => ({ ...v, phone: e.target.value }))
            }
          />
          <InputGroupField
            id="supplier-terms"
            label="Condiciones de pago"
            leftIcon={<CalendarDays />}
            value={supplier.paymentTerms}
            onChange={(e) =>
              setSupplier((v) => ({ ...v, paymentTerms: e.target.value }))
            }
            placeholder="Ej. Crédito a 30 días"
          />
          <InputGroupField
            id="supplier-lead"
            label="Tiempo de entrega (días)"
            type="number"
            min={0}
            leftIcon={<Truck />}
            value={supplier.leadTimeDays}
            onChange={(e) => { setSupplier((v) => ({ ...v, leadTimeDays: Number(e.target.value) })); setSupplierErrors((v) => ({ ...v, leadTimeDays: "" })) }}
            error={supplierErrors.leadTimeDays}
          />
          <div className="sm:col-span-2">
            <InputGroupField
              id="supplier-address"
              label="Dirección"
              leftIcon={<MapPin />}
              value={supplier.address}
              onChange={(e) =>
                setSupplier((v) => ({ ...v, address: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="supplier-notes">Notas</Label>
            <Textarea
              id="supplier-notes"
              value={supplier.notes}
              onChange={(e) =>
                setSupplier((v) => ({ ...v, notes: e.target.value }))
              }
            />
          </div>
          <SwitchField
            id="supplier-active"
            label="Proveedor activo"
            checked={supplier.isActive}
            onCheckedChange={(isActive) =>
              setSupplier((v) => ({ ...v, isActive }))
            }
          />
        </form>
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
                  "Producto vinculado"
                )
              }}
            >
              Vincular
            </Button>
          </>
        }
      >
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
        </div>
      </DialogComponent>

      <PurchaseDocumentDialog
        kind={dialog === "quote" ? "quote" : "order"}
        open={dialog === "quote" || dialog === "order"}
        close={close}
        saving={saving}
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
              onClick={() =>
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
              }
            >
              <PackageCheck />
              Confirmar recepción
            </Button>
          </>
        }
      >
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
  onCreateOrder,
  onEdit,
}: {
  rows: Quote[]
  onCreateOrder?: (quote: Quote) => void
  onEdit?: (quote: Quote) => void
}) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
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
              {r.supplier.businessName} · {r.items.length} partidas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {new Date(r.createdAt).toLocaleDateString("es-MX")}
            </span>
            {onEdit && !["cancelled"].includes(r.status) && (
              <Button size="sm" variant="outline" onClick={() => onEdit(r)}>Modificar</Button>
            )}
            {onCreateOrder && (
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
      ))}
    </div>
  )
}

function PurchaseDocumentDialog({
  kind,
  open,
  close,
  saving,
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
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  React.useEffect(() => {
    if (open) setErrors({})
  }, [open, kind])
  const submitValidated = () => {
    const next: Record<string, string> = {}
    if (!doc.supplierId) next.supplier = "Selecciona un proveedor."
    if (kind === "order" && !doc.locationId) next.location = "Selecciona el destino del inventario."
    if (!items.length) next.product = "Agrega al menos un producto."
    for (const item of items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) next[`qty-${item.id}`] = "La cantidad debe ser mayor que cero."
      if (!Number.isFinite(item.unitCost) || item.unitCost < 0) next[`cost-${item.id}`] = "El costo no puede ser negativo."
      if (!Number.isFinite(item.taxRate) || item.taxRate < 0 || item.taxRate > 1) next[`tax-${item.id}`] = "El impuesto debe estar entre 0 y 1."
    }
    setErrors(next)
    const first = ["supplier", "location", "product", ...items.flatMap((item) => [`qty-${item.id}`, `cost-${item.id}`, `tax-${item.id}`])].find((key) => next[key])
    if (first) {
      const id = first === "supplier" ? "purchase-supplier" : first === "location" ? "purchase-target" : first === "product" ? "purchase-add-product" : first
      requestAnimationFrame(() => document.getElementById(id)?.focus())
      return
    }
    submit()
  }
  const options = (data?.products ?? []).flatMap((p) =>
    p.variants.length
      ? p.variants.map((v) => ({
          value: `${p.id}|${v.id}`,
          label: `${p.name} · ${v.name}`,
          meta: v.sku ?? "",
        }))
      : [{ value: `${p.id}|`, label: p.name }]
  )
  const supplierOptions = (data?.suppliers ?? [])
    .filter((s) => s.isActive)
    .map((s) => ({ value: s.id, label: s.businessName, meta: s.code }))
  const destinations =
    doc.locationType === "cedis" ? (data?.cedis ?? []) : (data?.locations ?? [])
  return (
    <DialogComponent
      open={open}
      onOpenChange={(v) => !v && close()}
      title={
        kind === "quote"
          ? doc.quoteId ? "Modificar cotización" : "Nueva solicitud de cotización"
          : "Nueva orden de compra"
      }
      description={
        kind === "quote"
          ? "Define qué necesitas para solicitar precios al proveedor."
          : "Confirma destino, cantidades y costos antes de aprobación."
      }
      icon={kind === "quote" ? <FileText /> : <ShoppingCart />}
      size="4xl"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="purchase-document-form"
            disabled={saving}
          >
            {saving && <Loader2 className="animate-spin" />}
            {kind === "quote" ? doc.quoteId ? "Guardar cotización" : "Crear cotización" : "Crear orden"}
          </Button>
        </>
      }
    >
      <form id="purchase-document-form" noValidate onSubmit={(event) => { event.preventDefault(); submitValidated() }} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormCombobox
            id="purchase-supplier"
            label="Proveedor"
            required
            icon={<Building2 />}
            options={supplierOptions}
            value={doc.supplierId}
            onChange={(supplierId) => { setDoc((v) => ({ ...v, supplierId })); setErrors((v) => ({ ...v, supplier: "" })) }}
            error={errors.supplier}
          />
          {kind === "quote" ? (
            <InputGroupField
              id="quote-valid"
              label="Vigencia"
              type="date"
              leftIcon={<CalendarDays />}
              value={doc.validUntil}
              onChange={(e) =>
                setDoc((v) => ({ ...v, validUntil: e.target.value }))
              }
            />
          ) : (
            <>
              <FormCombobox
                id="purchase-target-type"
                label="Tipo de destino"
                required
                icon={<MapPin />}
                options={[
                  { value: "location", label: "Sucursal" },
                  { value: "cedis", label: "CEDIS" },
                ]}
                value={doc.locationType}
                onChange={(locationType) =>
                  setDoc((v) => ({ ...v, locationType, locationId: "" }))
                }
              />
              <FormCombobox
                id="purchase-target"
                label="Destino del inventario"
                required
                icon={<MapPin />}
                options={destinations.map((x) => ({
                  value: x.id,
                  label: x.name,
                }))}
                value={doc.locationId}
                onChange={(locationId) => { setDoc((v) => ({ ...v, locationId })); setErrors((v) => ({ ...v, location: "" })) }}
                error={errors.location}
              />
              <InputGroupField
                id="order-expected"
                label="Entrega esperada"
                type="date"
                leftIcon={<CalendarDays />}
                value={doc.expectedAt}
                onChange={(e) =>
                  setDoc((v) => ({ ...v, expectedAt: e.target.value }))
                }
              />
            </>
          )}
        </div>
        <FormCombobox
          id="purchase-add-product"
          label="Agregar producto o variante"
          icon={<Plus />}
          options={options.filter(
            (o) =>
              !items.some(
                (i) => `${i.productId}|${i.variantId ?? ""}` === o.value
              )
          )}
          value=""
          onChange={(value) => { addItem(value); setErrors((v) => ({ ...v, product: "" })) }}
          placeholder="Buscar y agregar…"
          error={errors.product}
        />
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="grid gap-2 rounded-xl border p-3 md:grid-cols-[minmax(12rem,1fr)_8rem_9rem_6rem_auto]"
            >
              <div className="self-center">
                <strong className="text-sm">{item.description}</strong>
              </div>
              <InputGroupField
                id={`qty-${item.id}`}
                label="Cantidad"
                type="number"
                min={0.001}
                step="0.001"
                leftIcon={<PackageCheck />}
                value={item.quantity}
                error={errors[`qty-${item.id}`]}
                onChange={(e) => {
                  setErrors((v) => ({ ...v, [`qty-${item.id}`]: "" }))
                  setItems((v) =>
                    v.map((x, i) =>
                      i === index
                        ? { ...x, quantity: Number(e.target.value) }
                        : x
                    )
                  )
                }}
              />
              <InputGroupField
                id={`cost-${item.id}`}
                label="Costo unitario"
                type="number"
                min={0}
                step="0.01"
                leftIcon={<ShoppingCart />}
                value={item.unitCost}
                error={errors[`cost-${item.id}`]}
                onChange={(e) => {
                  setErrors((v) => ({ ...v, [`cost-${item.id}`]: "" }))
                  setItems((v) =>
                    v.map((x, i) =>
                      i === index
                        ? { ...x, unitCost: Number(e.target.value) }
                        : x
                    )
                  )
                }}
              />
              <InputGroupField
                id={`tax-${item.id}`}
                label="Impuesto"
                type="number"
                min={0}
                max={1}
                step="0.01"
                leftIcon={<FileText />}
                value={item.taxRate}
                error={errors[`tax-${item.id}`]}
                onChange={(e) => {
                  setErrors((v) => ({ ...v, [`tax-${item.id}`]: "" }))
                  setItems((v) =>
                    v.map((x, i) =>
                      i === index
                        ? { ...x, taxRate: Number(e.target.value) }
                        : x
                    )
                  )
                }}
              />
              <Button
                type="button"
                className="self-end"
                variant="ghost"
                size="sm"
                onClick={() => setItems((v) => v.filter((_, i) => i !== index))}
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div className="flex justify-end rounded-xl bg-muted p-3 text-sm">
            <strong>
              Total estimado:{" "}
              {money.format(
                items.reduce(
                  (a, i) => a + Number(i.quantity) * Number(i.unitCost) * (1 + Number(i.taxRate)),
                  0
                )
              )}
            </strong>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="purchase-notes">Notas y condiciones</Label>
          <Textarea
            id="purchase-notes"
            value={doc.notes}
            onChange={(e) => setDoc((v) => ({ ...v, notes: e.target.value }))}
          />
        </div>
      </form>
    </DialogComponent>
  )
}
