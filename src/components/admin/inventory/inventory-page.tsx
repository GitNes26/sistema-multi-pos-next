"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeftRight,
  Barcode,
  ClipboardCheck,
  FileDown,
  FileSpreadsheet,
  Loader2,
  ScanLine,
  Search,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogComponent } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/base/data-table";
import { crudApi, inventoryApi, type InventoryRow, type InventoryMovement, type InventoryRevision, type RevisionDetailData, type RevisionItem, type RevisionStatus } from "@/lib/api";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { playSound } from "@/lib/sounds";

interface InventoryPageProps {
  canManage: boolean;
  canRevise?: boolean;
  icon?: React.ReactNode;
}

interface LocationOption {
  id: string;
  name: string;
  code: string | null;
}

const MOVEMENT_TYPES: { value: string; label: string }[] = [
  { value: "purchase", label: "Compra (entrada)" },
  { value: "adjustment", label: "Ajuste (±)" },
  { value: "sale", label: "Venta (salida)" },
  { value: "return", label: "Devolución (entrada)" },
];

function statusBadge(status: InventoryRow["status"]) {
  if (status === "empty") return <Badge variant="destructive">Sin stock</Badge>;
  if (status === "low") return <Badge className="bg-amber-500 text-white">Stock bajo</Badge>;
  return <Badge variant="secondary">OK</Badge>;
}

function movementTypeBadge(type: string) {
  const map: Record<string, { label: string; className: string }> = {
    purchase: { label: "Compra", className: "bg-emerald-500 text-white" },
    adjustment: { label: "Ajuste", className: "bg-sky-500 text-white" },
    sale: { label: "Venta", className: "bg-destructive text-white" },
    return: { label: "Devolución", className: "bg-emerald-500 text-white" },
    transfer_in: { label: "Transferencia +", className: "bg-indigo-500 text-white" },
    transfer_out: { label: "Transferencia −", className: "bg-orange-500 text-white" },
  };
  const m = map[type] ?? { label: type, className: "" };
  return <Badge className={m.className}>{m.label}</Badge>;
}

function revisionStatusBadge(status: RevisionStatus) {
  if (status === "draft") return <Badge variant="secondary">Borrador</Badge>;
  if (status === "in_progress") return <Badge className="bg-sky-500 text-white">En conteo</Badge>;
  if (status === "completed") return <Badge className="bg-emerald-500 text-white">Completada</Badge>;
  return <Badge variant="destructive">Cancelada</Badge>;
}

function fmtStock(qty: number, unit: string | null): string {
  const u = (unit ?? "pza").toLowerCase();
  if (u === "pza" || u === "pzas" || u === "pieza" || u === "piezas" || u === "ud" || u === "uds") {
    return String(Math.round(qty));
  }
  if (qty === Math.floor(qty)) return String(qty);
  return qty.toFixed(3).replace(/\.?0+$/, "");
}

function fmtMin(qty: number, unit: string | null): string {
  const u = (unit ?? "pza").toLowerCase();
  if (u === "pza" || u === "pzas" || u === "pieza" || u === "piezas" || u === "ud" || u === "uds") {
    return String(Math.round(qty));
  }
  if (qty === Math.floor(qty)) return String(qty);
  return qty.toFixed(3).replace(/\.?0+$/, "");
}

function stockColumns(): ColumnDef<InventoryRow, unknown>[] {
  return [
    {
      accessorKey: "productName",
      header: "Producto",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-2">
            {r.productImage ? (
              <img
                src={r.productImage}
                alt={r.productName}
                className="size-8 rounded-md object-cover"
              />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                {r.productName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">{r.productName}</p>
              {r.variantName && (
                <p className="truncate text-xs text-muted-foreground">{r.variantName}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "variant",
      header: "Variante / SKU",
      accessorFn: (r) => r.variantName ?? r.sku ?? "",
      cell: ({ row }) => {
        const r = row.original;
        if (!r.variantName && !r.sku) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-muted-foreground">
            {r.variantName ? (
              <>
                {r.variantName}
                {r.sku && <span className="ml-1 text-xs">· {r.sku}</span>}
              </>
            ) : (
              r.sku
            )}
          </span>
        );
      },
    },
    {
      accessorKey: "productType",
      header: "Tipo",
      cell: ({ row }) => (
        <Badge variant={row.original.productType === "bulk" ? "outline" : "secondary"}>
          {row.original.productType === "bulk" ? "Granel" : "Estándar"}
        </Badge>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Stock",
      cell: ({ row }) => <span className="tabular-nums font-medium">{fmtStock(row.original.quantity, row.original.unit)}</span>,
    },
    {
      accessorKey: "unit",
      header: "Unidad",
      cell: ({ row }) => row.original.unit ?? "pza",
    },
    {
      accessorKey: "minThreshold",
      header: "Mínimo",
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{fmtMin(row.original.minThreshold, row.original.unit)}</span>,
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => statusBadge(row.original.status),
    },
  ];
}

const movementColumns: ColumnDef<InventoryMovement, unknown>[] = [
  {
    accessorKey: "createdAt",
    header: "Fecha",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{new Date(row.original.createdAt).toLocaleString()}</span>,
  },
  {
    accessorKey: "type",
    header: "Tipo",
    cell: ({ row }) => movementTypeBadge(row.original.type),
  },
  {
    id: "product",
    header: "Producto",
    accessorFn: (r) => `${r.productName} ${r.variantName ?? ""}`,
    cell: ({ row }) => {
      const m = row.original;
      return (
        <span>
          {m.productName}
          {m.variantName && <span className="text-muted-foreground"> · {m.variantName}</span>}
        </span>
      );
    },
  },
  {
    accessorKey: "quantity",
    header: "Cantidad",
    cell: ({ row }) => (
      <span className="tabular-nums font-medium">
        {row.original.quantity > 0 ? `+${fmtStock(row.original.quantity, row.original.unit)}` : fmtStock(row.original.quantity, row.original.unit)}
      </span>
    ),
  },
  {
    accessorKey: "unit",
    header: "Unidad",
    cell: ({ row }) => row.original.unit ?? "pza",
  },
  {
    accessorKey: "performer",
    header: "Quién",
    cell: ({ row }) => row.original.performer ?? "—",
  },
  {
    accessorKey: "reason",
    header: "Motivo",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.reason ?? "—"}</span>,
  },
];

const revisionColumns: ColumnDef<InventoryRevision, unknown>[] = [
  {
    accessorKey: "revisionNumber",
    header: "#",
    cell: ({ row }) => <span className="tabular-nums">#{row.original.revisionNumber}</span>,
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => revisionStatusBadge(row.original.status),
  },
  {
    accessorKey: "startedAt",
    header: "Inicio",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.startedAt ? new Date(row.original.startedAt).toLocaleString() : "—"}
      </span>
    ),
  },
  {
    accessorKey: "itemCount",
    header: "Productos",
    cell: ({ row }) => <span className="text-right tabular-nums">{row.original.itemCount}</span>,
  },
  {
    accessorKey: "countedCount",
    header: "Contados",
    cell: ({ row }) => <span className="text-right tabular-nums">{row.original.countedCount}</span>,
  },
  {
    accessorKey: "differenceCount",
    header: "Diferencias",
    cell: ({ row }) => (
      <span className="text-right tabular-nums">
        {row.original.differenceCount > 0 ? (
          <span className="font-medium text-amber-600">{row.original.differenceCount}</span>
        ) : (
          row.original.differenceCount
        )}
      </span>
    ),
  },
  {
    accessorKey: "performedBy",
    header: "Responsable",
    cell: ({ row }) => row.original.performedBy ?? "—",
  },
];

function MovementDialog({
  row,
  onClose,
  onDone,
}: {
  row: InventoryRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState("purchase");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      swalError("Cantidad inválida", "Ingresa una cantidad mayor a 0.");
      return;
    }
    setSaving(true);
    try {
      await inventoryApi.register({
        inventoryId: row.id,
        type,
        quantity: qty,
        reason: reason || undefined,
      });
      swalToast("Movimiento registrado");
      onDone();
      onClose();
    } catch (err) {
      swalError("No se pudo registrar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      title="Registrar movimiento"
      description={`${row.variantName ?? row.productName} · stock actual: ${row.quantity} ${row.unit ?? ""}`}
      className="sm:max-w-md"
      bodyClassName="space-y-3"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Registrar
          </Button>
        </>
      }
    >
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipo de movimiento" />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>
              Cantidad ({type === "adjustment" ? "puede ser negativa" : row.unit ?? "pza"})
            </Label>
            <Input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. reposición de inventario" />
          </div>
    </DialogComponent>
  );
}

function ThresholdDialog({
  row,
  onClose,
  onDone,
}: {
  row: InventoryRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(String(row.minThreshold ?? 0));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await inventoryApi.setThreshold(row.id, Number(value) || 0);
      swalToast("Mínimo actualizado");
      onDone();
      onClose();
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      title="Stock mínimo"
      description={`${row.variantName ?? row.productName} · te avisaremos si baja de este umbral.`}
      className="sm:max-w-sm"
      bodyClassName="space-y-3"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Guardar
          </Button>
        </>
      }
    >
          <div className="space-y-1.5">
            <Label>Mínimo ({row.unit ?? "pza"})</Label>
            <Input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
    </DialogComponent>
  );
}

function TransferDialog({
  row,
  locations,
  cedis,
  onClose,
  onDone,
}: {
  row: InventoryRow;
  locations: LocationOption[];
  cedis: LocationOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [toType, setToType] = useState<"location" | "cedis">("location");
  const [toId, setToId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const targets = toType === "location" ? locations : cedis;

  const submit = async () => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      swalError("Cantidad inválida", "Ingresa una cantidad mayor a 0.");
      return;
    }
    if (!toId) {
      swalError("Destino", "Selecciona la ubicación de destino.");
      return;
    }
    setSaving(true);
    try {
      await inventoryApi.transfer({
        fromInventoryId: row.id,
        toLocationType: toType,
        toLocationId: toId,
        quantity: qty,
        reason: reason || undefined,
      });
      swalToast("Transferencia registrada");
      onDone();
      onClose();
    } catch (err) {
      swalError("No se pudo transferir", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      title="Transferir stock"
      description={`${row.variantName ?? row.productName} · disponible: ${row.quantity} ${row.unit ?? ""}`}
      className="sm:max-w-md"
      bodyClassName="space-y-3"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Transferir
          </Button>
        </>
      }
    >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Destino tipo</Label>
              <Select value={toType} onValueChange={(v) => {
                setToType(v as "location" | "cedis");
                setToId("");
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="location">Sucursal</SelectItem>
                  <SelectItem value="cedis">CEDIS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ubicación</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cantidad ({row.unit ?? "pza"})</Label>
            <Input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. traslado de mercancía" />
          </div>
    </DialogComponent>
  );
}

export function InventoryPage({ canManage, canRevise, icon }: InventoryPageProps) {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [cedis, setCedis] = useState<LocationOption[]>([]);
  const [locationType, setLocationType] = useState<"location" | "cedis">("location");
  const [locationId, setLocationId] = useState("");
  const [tab, setTab] = useState<"stock" | "movements" | "revisions">("stock");

  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [mTotal, setMTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [revisions, setRevisions] = useState<InventoryRevision[]>([]);
  const [revTotal, setRevTotal] = useState(0);
  const [activeRevision, setActiveRevision] = useState<RevisionDetailData | null>(null);
  const [newRevisionOpen, setNewRevisionOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const result = await inventoryApi.importStock({ locationType, locationId, file });
      const first = result.errors[0]
        ? ` Primer error: fila ${result.errors[0].row} — ${result.errors[0].message}.`
        : "";
      swalToast(`Se importaron ${result.imported} ${result.imported === 1 ? "existencia" : "existencias"}.${first}`);
      load();
    } catch (err) {
      swalError("No se pudo importar", err instanceof Error ? err.message : undefined);
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [productType, setProductType] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const [mType, setMType] = useState("");
  const [mFrom, setMFrom] = useState("");
  const [mTo, setMTo] = useState("");

  const [exportBusy, setExportBusy] = useState<"pdf" | "xlsx" | "movements" | null>(null);

  const [active, setActive] = useState<InventoryRow | null>(null);
  const [dialog, setDialog] = useState<"movement" | "threshold" | "transfer" | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQ(q), 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [q]);

  useEffect(() => {
    Promise.all([
      crudApi.list("locations", { pageSize: 250 }),
      crudApi.list("cedis", { pageSize: 250 }),
    ])
      .then(([l, c]) => {
        const locs: LocationOption[] = l.rows.map((r) => ({
          id: String(r.id),
          name: String(r.name ?? ""),
          code: r.code != null ? String(r.code) : null,
        }));
        const ceds: LocationOption[] = c.rows.map((r) => ({
          id: String(r.id),
          name: String(r.name ?? ""),
          code: r.code != null ? String(r.code) : null,
        }));
        setLocations(locs);
        setCedis(ceds);
        setLocationId(locs[0]?.id ?? ceds[0]?.id ?? "");
        if (!locs.length) setLocationType("cedis");
      })
      .catch(() => {
        swalError("No se pudieron cargar las ubicaciones");
      });
  }, []);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      if (tab === "stock") {
        const res = await inventoryApi.snapshot({
          locationType,
          locationId,
          q: debouncedQ || undefined,
          productType: productType || undefined,
          lowOnly: lowOnly || undefined,
        });
        setRows(res.rows);
      } else if (tab === "movements") {
        const res = await inventoryApi.movements({
          locationType,
          locationId,
          q: debouncedQ || undefined,
          type: mType || undefined,
          from: mFrom || undefined,
          to: mTo || undefined,
          pageSize: 50,
        });
        setMovements(res.rows);
        setMTotal(res.total);
      } else {
        const res = await inventoryApi.revisions({ locationType, locationId, pageSize: 50 });
        setRevisions(res.rows);
        setRevTotal(res.total);
      }
    } catch (err) {
      swalError("Error al cargar", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [locationType, locationId, tab, debouncedQ, productType, lowOnly, mType, mFrom, mTo]);

  useEffect(() => {
    load();
  }, [load]);

  const currentLocations = locationType === "location" ? locations : cedis;

  const lowCount = useMemo(() => rows.filter((r) => r.status !== "ok").length, [rows]);

  return (
    <>
      <PageHeader icon={icon} title="Inventario" description="Existencias, movimientos, mínimos y transferencias." />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={locationType}
          onValueChange={(v) => {
            setLocationType(v as "location" | "cedis");
            setLocationId("");
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="location">Sucursal</SelectItem>
            <SelectItem value="cedis">CEDIS</SelectItem>
          </SelectContent>
        </Select>

        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="min-w-48">
            <SelectValue placeholder="Selecciona una ubicación…" />
          </SelectTrigger>
          <SelectContent>
            {currentLocations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tab === "stock" && (
          <>
            <div className="relative w-full max-w-56">
              <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar producto, SKU…"
                className="h-8 pl-9"
              />
            </div>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="standard">Estándar</SelectItem>
                <SelectItem value="bulk">Granel</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={lowOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setLowOnly((v) => !v)}
            >
              <TriangleAlert className="size-4" /> Solo bajo stock {lowCount > 0 && `(${lowCount})`}
            </Button>
            {locationId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exportBusy !== null}
                  onClick={async () => {
                    setExportBusy("xlsx");
                    try {
                      await inventoryApi.exportXlsx({ locationType, locationId });
                    } catch (err) {
                      swalError("No se pudo exportar", err instanceof Error ? err.message : undefined);
                    } finally {
                      setExportBusy(null);
                    }
                  }}
                  title="Exportar listado en Excel (.xlsx)"
                >
                  {exportBusy === "xlsx" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                  XLSX
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exportBusy !== null}
                  onClick={async () => {
                    setExportBusy("pdf");
                    try {
                      await inventoryApi.exportPdf({ locationType, locationId });
                    } catch (err) {
                      swalError("No se pudo exportar", err instanceof Error ? err.message : undefined);
                    } finally {
                      setExportBusy(null);
                    }
                  }}
                  title="Exportar inventario en PDF"
                >
                  {exportBusy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                  PDF
                </Button>
              </>
            )}
            {canManage && locationId && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={importing}
                  onClick={() => importInputRef.current?.click()}
                  title="Importar existencias desde Excel (SKU, código de barras o nombre + cantidad)"
                >
                  {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  Importar
                </Button>
              </>
            )}
          </>
        )}

        {tab === "movements" && (
          <>
            <div className="relative w-full max-w-56">
              <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar producto, SKU…"
                className="h-8 pl-9"
              />
            </div>
            <Select value={mType} onValueChange={setMType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
                <SelectItem value="transfer_in">Transferencia +</SelectItem>
                <SelectItem value="transfer_out">Transferencia −</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={mFrom}
              onChange={(e) => setMFrom(e.target.value)}
              className="h-8 w-auto"
              title="Desde"
            />
            <Input
              type="date"
              value={mTo}
              onChange={(e) => setMTo(e.target.value)}
              className="h-8 w-auto"
              title="Hasta"
            />
            {locationId && (
              <Button
                variant="outline"
                size="sm"
                disabled={exportBusy !== null}
                onClick={async () => {
                  setExportBusy("movements");
                  try {
                    await inventoryApi.exportMovementsXlsx({
                      locationType,
                      locationId,
                      type: mType || undefined,
                      from: mFrom || undefined,
                      to: mTo || undefined,
                    });
                  } catch (err) {
                    swalError("No se pudo exportar", err instanceof Error ? err.message : undefined);
                  } finally {
                    setExportBusy(null);
                  }
                }}
                title="Exportar historial de movimientos en Excel (.xlsx)"
              >
                {exportBusy === "movements" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                XLSX
              </Button>
            )}
          </>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "stock" | "movements" | "revisions")}>
        <TabsList>
          <TabsTrigger value="stock">Existencias</TabsTrigger>
          <TabsTrigger value="movements">Historial de movimientos</TabsTrigger>
          <TabsTrigger value="revisions">Revisiones físicas</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card>
            <CardContent className="pt-5">
              {loading ? (
                <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
              ) : (
                <DataTable
                  columns={[
                    ...stockColumns(),
                    ...(canManage
                      ? [
                          {
                            id: "actions" as const,
                            header: "",
                            cell: ({ row }: { row: { original: InventoryRow } }) => {
                              const r = row.original;
                              return (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActive(r);
                                      setDialog("movement");
                                    }}
                                  >
                                    Movimiento
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActive(r);
                                      setDialog("threshold");
                                    }}
                                  >
                                    Mínimo
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActive(r);
                                      setDialog("transfer");
                                    }}
                                  >
                                    <ArrowLeftRight className="size-4" />
                                  </Button>
                                </div>
                              );
                            },
                          },
                        ]
                      : []),
                  ]}
                  data={rows}
                  loading={loading}
                  emptyMessage="Sin existencias para esta ubicación."
                  pageSize={20}
                  pageSizeOptions={[10, 20, 50, 100]}
                  searchable={false}
                  showColumnVisibility={false}
                  toolbarSlot={
                    canManage && rows.filter((r) => r.status !== "ok").length > 0 ? (
                      <Badge variant="outline" className="text-xs">
                        <TriangleAlert className="mr-1 size-3" />
                        {rows.filter((r) => r.status !== "ok").length} bajo stock
                      </Badge>
                    ) : undefined
                  }
                  renderCard={(r) => (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {r.productImage ? (
                          <img
                            src={r.productImage}
                            alt={r.productName}
                            className="size-10 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                            {r.productName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.variantName ?? r.sku ?? "—"} · {r.unit ?? "pza"}
                          </p>
                          {r.status !== "ok" && (
                            <Badge
                              variant="outline"
                              className={`mt-1 text-xs ${r.status === "empty" ? "border-red-500 text-red-600" : "border-amber-500 text-amber-600"}`}
                            >
                              {r.status === "empty" ? "Sin stock" : `Mín. ${r.minThreshold}`}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="tabular-nums font-medium mr-1">{fmtStock(r.quantity, r.unit)}</span>
                        {statusBadge(r.status)}
                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Movimiento"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActive(r);
                                setDialog("movement");
                              }}
                            >
                              <ArrowLeftRight className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Mínimo"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActive(r);
                                setDialog("threshold");
                              }}
                            >
                              <TriangleAlert className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Transferir"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActive(r);
                                setDialog("transfer");
                              }}
                            >
                              <Barcode className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardContent className="pt-5">
              {loading ? (
                <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
              ) : (
                <DataTable
                  columns={movementColumns}
                  data={movements}
                  loading={loading}
                  emptyMessage="Sin movimientos."
                  pageSize={20}
                  pageSizeOptions={[10, 20, 50, 100]}
                  searchable={false}
                  renderCard={(m) => (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {m.productName}
                          {m.variantName && <span className="text-muted-foreground"> · {m.variantName}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {movementTypeBadge(m.type)} · {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="tabular-nums font-medium">
                          {m.quantity > 0 ? `+${fmtStock(m.quantity, m.unit)}` : fmtStock(m.quantity, m.unit)}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">{m.unit ?? "pza"}</span>
                      </div>
                    </div>
                  )}
                  toolbarSlot={
                    mTotal > 0 ? (
                      <div className="text-sm text-muted-foreground">{mTotal} movimiento(s)</div>
                    ) : undefined
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revisions">
          <Card>
            <CardContent className="pt-5">
              {canRevise && (
                <div className="mb-3 flex justify-end">
                  <Button size="sm" onClick={() => setNewRevisionOpen(true)}>
                    <ClipboardCheck className="size-4" /> Nueva revisión
                  </Button>
                </div>
              )}
              {loading ? (
                <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
              ) : (
                <DataTable
                  columns={[
                    ...revisionColumns,
                    {
                      id: "actions",
                      header: "",
                      cell: ({ row }) => {
                        const r = row.original;
                        return (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Exportar reporte en PDF"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await inventoryApi.exportRevisionPdf(r.id);
                                } catch (err) {
                                  swalError("No se pudo exportar", err instanceof Error ? err.message : undefined);
                                }
                              }}
                            >
                              <FileDown className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const res = await inventoryApi.getRevision(r.id);
                                  setActiveRevision(res.revision);
                                } catch (err) {
                                  swalError("Error", err instanceof Error ? err.message : undefined);
                                }
                              }}
                            >
                              {canRevise && (r.status === "draft" || r.status === "in_progress")
                                ? "Conteo"
                                : "Ver"}
                            </Button>
                          </div>
                        );
                      },
                    },
                  ]}
                  data={revisions}
                  loading={loading}
                  emptyMessage="Sin revisiones para esta ubicación."
                  pageSize={20}
                  pageSizeOptions={[10, 20, 50, 100]}
                  searchable={false}
                  onRowClick={(r) => {
                    inventoryApi.getRevision(r.id).then((res) => setActiveRevision(res.revision)).catch((err) => swalError("Error", err instanceof Error ? err.message : undefined));
                  }}
                  renderCard={(r) => (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">#{r.revisionNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.startedAt ? new Date(r.startedAt).toLocaleString() : "—"} · {r.performedBy ?? "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {revisionStatusBadge(r.status)}
                        {r.differenceCount > 0 ? (
                          <Badge className="bg-amber-500 text-white">{r.differenceCount} diffs</Badge>
                        ) : (
                          <Badge variant="secondary">{r.differenceCount}</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  toolbarSlot={
                    revTotal > 0 ? (
                      <div className="text-sm text-muted-foreground">{revTotal} revisión(es)</div>
                    ) : undefined
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {active && dialog === "movement" && (
        <MovementDialog row={active} onClose={() => setDialog(null)} onDone={load} />
      )}
      {active && dialog === "threshold" && (
        <ThresholdDialog row={active} onClose={() => setDialog(null)} onDone={load} />
      )}
      {active && dialog === "transfer" && (
        <TransferDialog
          row={active}
          locations={locations}
          cedis={cedis}
          onClose={() => setDialog(null)}
          onDone={load}
        />
      )}

      {newRevisionOpen && (
        <NewRevisionDialog
          locationType={locationType}
          locationId={locationId}
          onClose={() => setNewRevisionOpen(false)}
          onCreated={(revision) => {
            setNewRevisionOpen(false);
            setActiveRevision(revision);
            load();
          }}
        />
      )}

      {activeRevision && (
        <RevisionDialog
          revision={activeRevision}
          canManage={canRevise ?? false}
          onClose={() => setActiveRevision(null)}
          onDone={load}
        />
      )}
    </>
  );
}

function NewRevisionDialog({
  locationType,
  locationId,
  onClose,
  onCreated,
}: {
  locationType: "location" | "cedis";
  locationId: string;
  onClose: () => void;
  onCreated: (revision: RevisionDetailData) => void;
}) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await inventoryApi.createRevision({ locationType, locationId, notes: notes || undefined });
      swalToast("Revisión creada");
      onCreated(res.revision);
    } catch (err) {
      swalError("No se pudo crear", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      title="Nueva revisión física"
      description="Se generará el checklist con el stock esperado de todos los productos de esta ubicación."
      className="sm:max-w-md"
      bodyClassName="space-y-3"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Crear revisión
          </Button>
        </>
      }
    >
          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. inventario de fin de mes" />
          </div>
    </DialogComponent>
  );
}

function RevisionDialog({
  revision,
  canManage,
  onClose,
  onDone,
}: {
  revision: RevisionDetailData;
  canManage: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const editable = canManage && (revision.status === "draft" || revision.status === "in_progress");
  const [items, setItems] = useState<RevisionItem[]>(revision.items);
  const [scanQ, setScanQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [notes, setNotes] = useState(revision.notes ?? "");

  // Fuente de verdad síncrona para conteos rápidos por escaneo (evita perder lecturas).
  const countsRef = useRef<Map<string, number>>(new Map());
  const persistTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const round3 = (n: number) => Math.round(n * 1000) / 1000;

  const applyCount = (itemId: string, counted: number, scanned: boolean, expected: number) =>
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, countedQuantity: counted, difference: round3(counted - expected), scanned }
          : i
      )
    );

  // Persistencia con debounce: las ráfagas de escaneo se envían con el valor final acumulado.
  const schedulePersist = (itemId: string, counted: number, scanned: boolean) => {
    const prevTimer = persistTimersRef.current.get(itemId);
    if (prevTimer) clearTimeout(prevTimer);
    persistTimersRef.current.set(
      itemId,
      setTimeout(() => {
        persistTimersRef.current.delete(itemId);
        inventoryApi
          .setRevisionCount(revision.id, itemId, { countedQuantity: counted, scanned })
          .catch((err) => swalError("No se pudo guardar", err instanceof Error ? err.message : undefined));
      }, 300)
    );
  };

  const bump = (item: RevisionItem) => {
    const prev = countsRef.current.get(item.id) ?? item.countedQuantity ?? 0;
    const next = round3(prev + 1);
    countsRef.current.set(item.id, next);
    applyCount(item.id, next, true, item.expectedQuantity);
    playSound("scan");
    schedulePersist(item.id, next, true);
  };

  const handleScan = () => {
    const q = scanQ.trim().toLowerCase();
    if (!q) return;
    const item = items.find(
      (i) =>
        (i.barcode && i.barcode.toLowerCase() === q) ||
        (i.sku && i.sku.toLowerCase() === q) ||
        i.productName.toLowerCase().includes(q) ||
        (i.variantName ?? "").toLowerCase().includes(q)
    );
    if (!item) {
      playSound("error");
      swalError("No encontrado", "No hay un producto con ese código o búsqueda.");
      return;
    }
    bump(item);
    setScanQ("");
  };

  const commitManual = async (item: RevisionItem, countedQuantity: number) => {
    setBusy(item.id);
    try {
      await inventoryApi.setRevisionCount(revision.id, item.id, { countedQuantity, scanned: false });
      countsRef.current.set(item.id, countedQuantity);
      applyCount(item.id, countedQuantity, false, item.expectedQuantity);
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const handleNotesChange = (v: string) => {
    setNotes(v);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      inventoryApi
        .updateRevisionNotes(revision.id, v)
        .catch((err) => swalError("No se pudieron guardar las notas", err instanceof Error ? err.message : undefined));
    }, 400);
  };

  const finish = (action: "complete" | "cancel") => async () => {
    const label = action === "complete" ? "Completar" : "Cancelar";
    const msg =
      action === "complete"
        ? "Las diferencias se aplicarán al inventario como ajustes. ¿Continuar?"
        : "La revisión quedará cancelada y no se aplicarán cambios. ¿Continuar?";
    setActionBusy(true);
    try {
      const confirmed = await swalConfirm(msg, label, { confirmText: label, icon: "warning" });
      if (!confirmed) {
        setActionBusy(false);
        return;
      }
      await inventoryApi.finishRevision(revision.id, action);
      swalToast(`Revisión ${action === "complete" ? "completada" : "cancelada"}`);
      onClose();
      onDone();
    } catch (err) {
      swalError(`No se pudo ${label.toLowerCase()}`, err instanceof Error ? err.message : undefined);
    } finally {
      setActionBusy(false);
    }
  };

  const counted = items.filter((i) => i.countedQuantity != null).length;
  const withDiff = items.filter((i) => i.difference != null && i.difference !== 0).length;

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      title={
        <>
          Revisión #{revision.revisionNumber} {revisionStatusBadge(revision.status)}
        </>
      }
      description={
        <>
          {new Date(revision.startedAt ?? revision.createdAt).toLocaleString()} · {counted}/{items.length} contados
          {withDiff > 0 && <span className="text-amber-600"> · {withDiff} con diferencia</span>}
        </>
      }
      className="sm:max-w-4xl"
      footer={
        editable ? (
          <>
            <Button variant="outline" onClick={finish("cancel")} disabled={actionBusy}>
              Cancelar revisión
            </Button>
            <Button onClick={finish("complete")} disabled={actionBusy}>
              {actionBusy && <Loader2 className="size-4 animate-spin" />} Completar y aplicar
            </Button>
          </>
        ) : undefined
      }
    >
        {editable && (
          <>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
              <ScanLine className="size-4 shrink-0 text-muted-foreground" />
              <Barcode className="size-4 shrink-0 text-muted-foreground" />
              <Input
                value={scanQ}
                onChange={(e) => setScanQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleScan();
                  }
                }}
                placeholder="Escanear o buscar por código / nombre… (suma 1)"
                className="flex-1"
                autoFocus
              />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
              <ClipboardCheck className="size-3.5 shrink-0" />
              El conteo se guarda automáticamente al escanear o escribir; no requiere presionar ningún botón.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="revisionNotes">Notas (opcional)</Label>
              <Textarea
                id="revisionNotes"
                rows={2}
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Ej. conteo de fin de mes, incidencias…"
              />
            </div>
          </>
        )}
        {!editable && notes && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Notas</p>
            <p className="mt-0.5 text-sm">{notes}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Producto</th>
                <th className="py-2 pr-3 font-medium">Variante / SKU</th>
                <th className="py-2 pr-3 text-right font-medium">Esperado</th>
                <th className="py-2 pr-3 text-right font-medium">Contado</th>
                <th className="py-2 pr-3 text-right font-medium">Diferencia</th>
                <th className="py-2 font-medium">Modo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const diff = item.difference;
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{item.productName}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {item.variantName
                        ? `${item.variantName}${item.sku ? ` · ${item.sku}` : ""}`
                        : item.sku ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {fmtStock(item.expectedQuantity, item.unit)}
                      <span className="ml-1 text-xs text-muted-foreground">{item.unit ?? "pza"}</span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {editable ? (
                        <span className="inline-flex items-center gap-1">
                          {busy === item.id && <Loader2 className="size-3 animate-spin" />}
                          <Input
                            type="number"
                            step="any"
                            className="h-7 w-24"
                            value={item.countedQuantity ?? ""}
                            placeholder="—"
                            onChange={(e) => {
                              const v = e.target.value;
                              setItems((prev) =>
                                prev.map((i) => (i.id === item.id ? { ...i, countedQuantity: v === "" ? null : Number(v) } : i))
                              );
                            }}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v >= 0) commitManual(item, v);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const v = Number((e.target as HTMLInputElement).value);
                                if (Number.isFinite(v) && v >= 0) commitManual(item, v);
                              }
                            }}
                          />
                        </span>
                      ) : (
                        <span className="tabular-nums">{item.countedQuantity != null ? fmtStock(item.countedQuantity, item.unit) : "—"}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {diff == null ? (
                        "—"
                      ) : diff === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : diff > 0 ? (
                        <span className="font-medium text-emerald-600">+{fmtStock(diff, item.unit)}</span>
                      ) : (
                        <span className="font-medium text-destructive">{fmtStock(diff, item.unit)}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {item.scanned ? (
                        <Badge className="bg-indigo-500 text-white">
                          <Barcode className="size-3" /> Escaneado
                        </Badge>
                      ) : item.countedQuantity != null ? (
                        <Badge variant="secondary">Manual</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Esta revisión no tiene productos.</p>
        )}
    </DialogComponent>
  );
}