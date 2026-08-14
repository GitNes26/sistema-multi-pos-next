"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Barcode,
  ClipboardCheck,
  FileDown,
  Loader2,
  PackageSearch,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { crudApi, inventoryApi, type InventoryRow, type InventoryMovement, type InventoryRevision, type RevisionDetailData, type RevisionItem, type RevisionStatus } from "@/lib/api";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";

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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>
            {row.variantName ?? row.productName} · stock actual: {row.quantity} {row.unit ?? ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
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
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Registrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Stock mínimo</DialogTitle>
          <DialogDescription>
            {row.variantName ?? row.productName} · te avisaremos si baja de este umbral.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Mínimo ({row.unit ?? "pza"})</Label>
            <Input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir stock</DialogTitle>
          <DialogDescription>
            {row.variantName ?? row.productName} · disponible: {row.quantity} {row.unit ?? ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
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
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Transferir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
        const res = await inventoryApi.movements({ locationType, locationId, q: debouncedQ || undefined, pageSize: 50 });
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
  }, [locationType, locationId, tab, debouncedQ, productType, lowOnly]);

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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await inventoryApi.exportPdf({ locationType, locationId });
                    } catch (err) {
                      swalError("No se pudo exportar", err instanceof Error ? err.message : undefined);
                    }
                  }}
                  title="Exportar inventario en PDF"
                >
                  <FileDown className="size-4" /> PDF
                </Button>
              </>
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
            <CardContent className="space-y-3 pt-5">
              {loading ? (
                <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <PackageSearch className="size-8" />
                  <p className="text-sm">Sin existencias para esta ubicación.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Producto</th>
                        <th className="py-2 pr-3 font-medium">Variante / SKU</th>
                        <th className="py-2 pr-3 font-medium">Tipo</th>
                        <th className="py-2 pr-3 text-right font-medium">Stock</th>
                        <th className="py-2 pr-3 font-medium">Unidad</th>
                        <th className="py-2 pr-3 text-right font-medium">Mínimo</th>
                        <th className="py-2 pr-3 font-medium">Estado</th>
                        {canManage && <th className="py-2 font-medium" />}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 pr-3">{r.productName}</td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {r.variantName ? (
                              <>
                                {r.variantName}
                                {r.sku && <span className="ml-1 text-xs">· {r.sku}</span>}
                              </>
                            ) : (
                              r.sku ?? "—"
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            <Badge variant={r.productType === "bulk" ? "outline" : "secondary"}>
                              {r.productType === "bulk" ? "Granel" : "Estándar"}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums font-medium">{r.quantity}</td>
                          <td className="py-2 pr-3">{r.unit ?? "pza"}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{r.minThreshold}</td>
                          <td className="py-2 pr-3">{statusBadge(r.status)}</td>
                          {canManage && (
                            <td className="py-2">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => { setActive(r); setDialog("movement"); }}>
                                  Movimiento
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => { setActive(r); setDialog("threshold"); }}>
                                  Mínimo
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => { setActive(r); setDialog("transfer"); }}>
                                  <ArrowLeftRight className="size-4" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardContent className="space-y-3 pt-5">
              {loading ? (
                <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
              ) : movements.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Sin movimientos.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Fecha</th>
                        <th className="py-2 pr-3 font-medium">Tipo</th>
                        <th className="py-2 pr-3 font-medium">Producto</th>
                        <th className="py-2 pr-3 text-right font-medium">Cantidad</th>
                        <th className="py-2 pr-3 font-medium">Unidad</th>
                        <th className="py-2 pr-3 font-medium">Quién</th>
                        <th className="py-2 pr-3 font-medium">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                            {new Date(m.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2 pr-3">{movementTypeBadge(m.type)}</td>
                          <td className="py-2 pr-3">
                            {m.productName}
                            {m.variantName && <span className="text-muted-foreground"> · {m.variantName}</span>}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums font-medium">
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </td>
                          <td className="py-2 pr-3">{m.unit ?? "pza"}</td>
                          <td className="py-2 pr-3">{m.performer ?? "—"}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{m.reason ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {mTotal > 0 && (
                <div className="text-right text-sm text-muted-foreground">{mTotal} movimiento(s)</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revisions">
          <Card>
            <CardContent className="space-y-3 pt-5">
              {canRevise && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setNewRevisionOpen(true)}>
                    <ClipboardCheck className="size-4" /> Nueva revisión
                  </Button>
                </div>
              )}
              {loading ? (
                <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
              ) : revisions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <ClipboardCheck className="size-8" />
                  <p className="text-sm">Sin revisiones para esta ubicación.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">#</th>
                        <th className="py-2 pr-3 font-medium">Estado</th>
                        <th className="py-2 pr-3 font-medium">Inicio</th>
                        <th className="py-2 pr-3 text-right font-medium">Productos</th>
                        <th className="py-2 pr-3 text-right font-medium">Contados</th>
                        <th className="py-2 pr-3 text-right font-medium">Diferencias</th>
                        <th className="py-2 pr-3 font-medium">Responsable</th>
                        <th className="py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {revisions.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 tabular-nums">#{r.revisionNumber}</td>
                          <td className="py-2 pr-3">{revisionStatusBadge(r.status)}</td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {r.startedAt ? new Date(r.startedAt).toLocaleString() : "—"}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{r.itemCount}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{r.countedCount}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {r.differenceCount > 0 ? (
                              <span className="font-medium text-amber-600">{r.differenceCount}</span>
                            ) : (
                              r.differenceCount
                            )}
                          </td>
                          <td className="py-2 pr-3">{r.performedBy ?? "—"}</td>
                          <td className="py-2">
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {revTotal > 0 && (
                <div className="text-right text-sm text-muted-foreground">{revTotal} revisión(es)</div>
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva revisión física</DialogTitle>
          <DialogDescription>
            Se generará el checklist con el stock esperado de todos los productos de esta ubicación.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. inventario de fin de mes" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Crear revisión
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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

  const commit = async (item: RevisionItem, countedQuantity: number, scanned: boolean) => {
    setBusy(item.id);
    try {
      await inventoryApi.setRevisionCount(revision.id, item.id, { countedQuantity, scanned });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, countedQuantity, difference: Math.round((countedQuantity - i.expectedQuantity) * 1000) / 1000, scanned }
            : i
        )
      );
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
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
      swalError("No encontrado", "No hay un producto con ese código o búsqueda.");
      return;
    }
    const next = Math.round(((item.countedQuantity ?? 0) + 1) * 1000) / 1000;
    commit(item, next, true);
    setScanQ("");
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Revisión #{revision.revisionNumber} {revisionStatusBadge(revision.status)}
          </DialogTitle>
          <DialogDescription>
            {new Date(revision.startedAt ?? revision.createdAt).toLocaleString()} · {counted}/{items.length} contados
            {withDiff > 0 && <span className="text-amber-600"> · {withDiff} con diferencia</span>}
          </DialogDescription>
        </DialogHeader>

        {editable && (
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
            />
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
                    <td className="py-2 pr-3 text-right tabular-nums">{item.expectedQuantity}</td>
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
                              if (Number.isFinite(v) && v >= 0) commit(item, v, false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const v = Number((e.target as HTMLInputElement).value);
                                if (Number.isFinite(v) && v >= 0) commit(item, v, false);
                              }
                            }}
                          />
                        </span>
                      ) : (
                        <span className="tabular-nums">{item.countedQuantity ?? "—"}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {diff == null ? (
                        "—"
                      ) : diff === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : diff > 0 ? (
                        <span className="font-medium text-emerald-600">+{diff}</span>
                      ) : (
                        <span className="font-medium text-destructive">{diff}</span>
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

        {editable && (
          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={finish("cancel")} disabled={actionBusy}>
              Cancelar revisión
            </Button>
            <Button onClick={finish("complete")} disabled={actionBusy}>
              {actionBusy && <Loader2 className="size-4 animate-spin" />} Completar y aplicar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}