"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Armchair,
  Check,
  Clock,
  Loader2,
  MapPin,
  Plus,
  QrCode,
  RefreshCcw,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DialogComponent } from "@/components/ui/dialog";
import { InputGroupField } from "@/components/base/input-group-field";
import { Spinner } from "@/components/base/spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TableData {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  status: string;
  qrToken: string | null;
  posX: number | null;
  posY: number | null;
  location: { id: string; name: string } | null;
  _count: { orders: number; sessions: number };
}

interface LocationData {
  id: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  free: { label: "Libre", color: "text-emerald-600", bg: "bg-emerald-100 border-emerald-300", icon: Check },
  occupied: { label: "Ocupada", color: "text-rose-600", bg: "bg-rose-100 border-rose-300", icon: Users },
  reserved: { label: "Reservada", color: "text-amber-600", bg: "bg-amber-100 border-amber-300", icon: Clock },
  cleaning: { label: "Limpieza", color: "text-sky-600", bg: "bg-sky-100 border-sky-300", icon: Loader2 },
};

/* ------------------------------------------------------------------ */
/*  TablesManager                                                      */
/* ------------------------------------------------------------------ */

export function TablesManager() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [qrDialogTable, setQrDialogTable] = useState<TableData | null>(null);

  // Form
  const [formNumber, setFormNumber] = useState("");
  const [formName, setFormName] = useState("");
  const [formCapacity, setFormCapacity] = useState("4");
  const [formLocation, setFormLocation] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationFilter) params.set("locationId", locationFilter);
      if (statusFilter) params.set("status", statusFilter);
      const [tablesRes, locsRes] = await Promise.all([
        fetch(`/api/tables?${params}`).then((r) => r.json()),
        fetch("/api/locations").then((r) => r.json()),
      ]);
      if (tablesRes.ok) setTables(tablesRes.tables);
      if (locsRes.ok) setLocations(locsRes.rows || []);
    } catch {
      swalError("Error al cargar mesas");
    } finally {
      setLoading(false);
    }
  }, [locationFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingTable(null);
    setFormNumber(String(tables.length + 1));
    setFormName("");
    setFormCapacity("4");
    setFormLocation(locations[0]?.id || "");
    setDialogOpen(true);
  };

  const openEdit = (t: TableData) => {
    setEditingTable(t);
    setFormNumber(String(t.number));
    setFormName(t.name || "");
    setFormCapacity(String(t.capacity));
    setFormLocation(t.location?.id || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        id: editingTable?.id,
        number: Number(formNumber),
        name: formName || null,
        capacity: Number(formCapacity),
        locationId: formLocation || null,
      };

      if (editingTable) {
        await fetch("/api/tables", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        swalToast("Mesa actualizada");
      } else {
        await fetch("/api/tables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        swalToast("Mesa creada");
      }
      setDialogOpen(false);
      load();
    } catch (err: unknown) {
      swalError(err instanceof Error ? err.message : "Error al guardar");
    }
  };

  const handleDelete = async (t: TableData) => {
    const confirmed = await swalConfirm(
      "¿Eliminar mesa?",
      `Se eliminará la mesa #${t.number}.`,
      { confirmText: "Eliminar", danger: true }
    );
    if (!confirmed) return;
    try {
      await fetch(`/api/tables?id=${t.id}`, { method: "DELETE" });
      swalToast("Mesa eliminada");
      load();
    } catch {
      swalError("Error al eliminar");
    }
  };

  const stats = {
    total: tables.length,
    free: tables.filter((t) => t.status === "free").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    reserved: tables.filter((t) => t.status === "reserved").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Armchair className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{stats.free}</p>
                <p className="text-xs text-muted-foreground">Libres</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-rose-600">{stats.occupied}</p>
                <p className="text-xs text-muted-foreground">Ocupadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.reserved}</p>
                <p className="text-xs text-muted-foreground">Reservadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas las sucursales</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {["", "free", "occupied", "reserved"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="text-xs"
            >
              {s ? STATUS_CONFIG[s]?.label : "Todas"}
            </Button>
          ))}
        </div>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCcw className="w-4 h-4 mr-1" />
          Actualizar
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          Nueva mesa
        </Button>
      </div>

      {/* Table grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : tables.length === 0 ? (
        <EmptyState icon={Armchair} title="Sin mesas" description="Crea tu primera mesa para comenzar." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tables.map((t) => {
            const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.free;
            const Icon = cfg.icon;
            return (
              <button
                key={t.id}
                onClick={() => openEdit(t)}
                className={cn(
                  "relative group text-center p-4 rounded-2xl border-2 transition-all duration-200",
                  "hover:shadow-md hover:-translate-y-0.5",
                  cfg.bg
                )}
              >
                {/* Actions on hover */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setQrDialogTable(t); }}
                    className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center hover:bg-white"
                  >
                    <QrCode className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
                    className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center hover:bg-rose-100"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" />
                  </button>
                </div>

                {/* Table number */}
                <div className={cn("w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2", cfg.bg)}>
                  <span className={cn("text-xl font-bold", cfg.color)}>{t.number}</span>
                </div>

                {/* Name */}
                {t.name && (
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {t.name}
                  </p>
                )}

                {/* Capacity */}
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Users className={cn("w-3 h-3", cfg.color)} />
                  <span className={cn("text-xs", cfg.color)}>{t.capacity}</span>
                </div>

                {/* Location */}
                {t.location && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400 truncate">{t.location.name}</span>
                  </div>
                )}

                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={cn("mt-2 text-[10px]", cfg.color)}
                >
                  {cfg.label}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <DialogComponent
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingTable ? `Editar Mesa #${editingTable.number}` : "Nueva Mesa"}
      >
        <div className="space-y-4 p-4">
          <InputGroupField
            label="Número de mesa"
            type="number"
            value={formNumber}
            onChange={(e) => setFormNumber(e.target.value)}
            required
            leftIcon={<Armchair className="w-4 h-4 text-slate-400" />}
          />
          <InputGroupField
            label="Nombre (opcional)"
            placeholder="Ej: Terraza, VIP..."
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <InputGroupField
            label="Capacidad"
            type="number"
            value={formCapacity}
            onChange={(e) => setFormCapacity(e.target.value)}
            leftIcon={<Users className="w-4 h-4 text-slate-400" />}
          />
          <div>
            <label className="text-sm font-medium mb-1 block">Sucursal</label>
            <select
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Sin sucursal</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingTable ? "Guardar" : "Crear mesa"}
            </Button>
          </div>
        </div>
      </DialogComponent>

      {/* QR Dialog */}
      <DialogComponent
        open={!!qrDialogTable}
        onOpenChange={() => setQrDialogTable(null)}
        title={`QR Mesa #${qrDialogTable?.number || ""}`}
      >
        {qrDialogTable && (
          <div className="flex flex-col items-center gap-4 p-4">
            <div className="w-48 h-48 bg-white rounded-xl border-2 border-slate-200 flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${typeof window !== "undefined" ? window.location.origin : ""}/portal/menu?table=${qrDialogTable.id}&token=${qrDialogTable.qrToken}`}
                alt={`QR Mesa ${qrDialogTable.number}`}
                className="w-44 h-44"
              />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">Mesa #{qrDialogTable.number}</p>
              <p className="text-sm text-muted-foreground">
                Escanea para ver el menú y ordenar
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${window.location.origin}/portal/menu?table=${qrDialogTable.id}&token=${qrDialogTable.qrToken}`;
                const a = document.createElement("a");
                a.href = url;
                a.download = `qr-mesa-${qrDialogTable.number}.png`;
                a.click();
              }}
            >
              Descargar QR
            </Button>
          </div>
        )}
      </DialogComponent>
    </div>
  );
}
