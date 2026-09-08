"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Armchair,
  CalendarCheck2,
  CalendarPlus,
  Check,
  Clock,
  DoorOpen,
  Download,
  History,
  LayoutGrid,
  Loader2,
  MapPin,
  Plus,
  QrCode,
  RefreshCcw,
  Settings2,
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
import { TableHistoryDialog } from "./table-history";
import { FloorPlanEditor } from "./floor-plan-editor";
import type { PlanNode, PlanTable } from "./plan-elements";
import { ReservationPolicyDialog } from "./reservation-policy-dialog";
import { ReservationWizardDialog } from "./reservation-wizard-dialog";

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
  shape: string;
  width: number | null;
  height: number | null;
  posX: number | null;
  posY: number | null;
  room: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  // Aviso de llegada: reservación confirmada próxima (la manda /api/tables).
  upcomingReservation?: { guests: number; startsAt: string } | null;
  _count: { orders: number; sessions: number };
}

interface RoomData {
  id: string;
  name: string;
  location: { id: string; name: string } | null;
  _count: { tables: number };
}

interface ReservationRow {
  id: string;
  guests: number;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  // Reservación de invitado (sin cuenta): nombre y teléfono van en la fila.
  name: string | null;
  phone: string | null;
  room: { id: string; name: string } | null;
  table: { id: string; number: number; name: string | null; capacity: number } | null;
  customer: { id: string; fullName: string | null; phone: string | null } | null;
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

const SHAPE_OPTIONS = [
  { value: "round", label: "Redonda" },
  { value: "square", label: "Cuadrada" },
  { value: "rectangle", label: "Rectangular" },
  { value: "booth", label: "Camarote" },
  { value: "bar", label: "Barra" },
];

/** Convierte TableData → PlanTable para el editor de plano. */
const planOf = (t: TableData): PlanTable & {
  upcomingReservation?: { guests: number; startsAt: string } | null;
} => ({
  id: t.id,
  number: t.number,
  name: t.name,
  capacity: t.capacity,
  shape: t.shape || "round",
  width: t.width,
  height: t.height,
  posX: t.posX,
  posY: t.posY,
  status: t.status,
  upcomingReservation: t.upcomingReservation ?? null,
});

/* ------------------------------------------------------------------ */
/*  TablesManager                                                      */
/* ------------------------------------------------------------------ */

export function TablesManager({ canManage = false }: { canManage?: boolean }) {
  const [tables, setTables] = useState<TableData[]>([]);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [view, setView] = useState<"list" | "plan">("list");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [qrDialogTable, setQrDialogTable] = useState<TableData | null>(null);
  const [historyTable, setHistoryTable] = useState<TableData | null>(null);
  const [exporting, setExporting] = useState(false);
  // Dialogo de salas
  // Nodos del plano (entrada/salida/baños/cocina…) y diálogos de reservación.
  const [planNodes, setPlanNodes] = useState<PlanNode[]>([]);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [roomEditing, setRoomEditing] = useState<RoomData | null>(null);
  const [formRoomName, setFormRoomName] = useState("");
  // Reservaciones de mesa (anfitrión): pendientes/confirmadas del día.
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  // Lista de espera (anfitrión): clientes esperando mesa libre.
  const [waitlistEntries, setWaitlistEntries] = useState<
    {
      id: string;
      guests: number;
      status: string;
      position: number;
      // Invitado (sin cuenta): nombre y teléfono van en la fila.
      name: string | null;
      phone: string | null;
      customer: { id: string; fullName: string | null; phone: string | null } | null;
      availableTable: { id: string; number: number; capacity: number; room: { name: string } | null } | null;
    }[]
  >([]);

  // Ventana del aviso de llegada (horas de anticipación, por organización).
  const [upcomingHours, setUpcomingHours] = useState("3");

  // Form
  const [formNumber, setFormNumber] = useState("");
  const [formName, setFormName] = useState("");
  const [formCapacity, setFormCapacity] = useState("4");
  const [formLocation, setFormLocation] = useState("");
  const [formRoom, setFormRoom] = useState("");
  const [formShape, setFormShape] = useState("round");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationFilter) params.set("locationId", locationFilter);
      if (statusFilter) params.set("status", statusFilter);
      const [tablesRes, locsRes, roomsRes, reservationsRes, waitlistRes, nodesRes] = await Promise.all([
        fetch(`/api/tables?${params}`).then((r) => r.json()),
        fetch("/api/crud/locations?pageSize=200").then((r) => r.json()),
        fetch(`/api/tables/rooms?${params}`).then((r) => r.json()),
        fetch("/api/table-reservations").then((r) => r.json()),
        fetch("/api/table-waitlist").then((r) => r.json()),
        fetch("/api/tables/plan-nodes").then((r) => r.json()),
      ]);
      if (tablesRes.ok) setTables(tablesRes.tables);
      if (locsRes.ok) setLocations(locsRes.rows || []);
      if (roomsRes.ok) setRooms(roomsRes.rooms);
      if (reservationsRes.ok) setReservations(reservationsRes.reservations);
      if (waitlistRes.ok) setWaitlistEntries(waitlistRes.entries);
      if (nodesRes.ok) setPlanNodes(nodesRes.nodes);
    } catch {
      swalError("Error al cargar mesas");
    } finally {
      setLoading(false);
    }
  }, [locationFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Cargar la ventana configurada del aviso de llegada (una sola vez).
  useEffect(() => {
    fetch("/api/table-reservations/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.upcomingWindowHours) setUpcomingHours(String(d.upcomingWindowHours));
      })
      .catch(() => undefined);
  }, []);

  /** Guarda las horas de anticipación del aviso de llegada. */
  const saveUpcomingHours = async () => {
    const hours = Math.round(Number(upcomingHours));
    if (!hours || hours < 1 || hours > 24) {
      swalError("Horas de anticipación inválidas (1–24)");
      return;
    }
    try {
      const res = await fetch("/api/table-reservations/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upcomingWindowHours: hours }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo guardar");
      swalToast(`Aviso de llegada: ${hours} h antes`);
    } catch (err) {
      swalError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  };

  /**
   * Exportación masiva de QRs: abre una ventana de impresión con un QR por
   * cada mesa activa (también sirve de "Guardar como PDF"). Pensado para
   * onboarding de local nuevo: imprimir, recortar y pegar en cada mesa.
   */
  const exportQrs = useCallback(() => {
    const active = tables.filter((t) => t.qrToken);
    if (active.length === 0) {
      swalError("No hay mesas con QR para exportar");
      return;
    }
    const origin = window.location.origin;
    const cards = active
      .map(
        (t) => `
      <div class="card">
        <img
          src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
            `${origin}/portal/menu?table=${t.id}&token=${t.qrToken}`
          )}"
          alt="QR Mesa ${t.number}"
        />
        <p class="num">Mesa #${t.number}</p>
        <p class="hint">Escanea para ver el menú y pedir</p>
      </div>`
      )
      .join("");
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      swalError("El navegador bloqueó la ventana de impresión");
      return;
    }
    win.document.write(`<!doctype html>
      <html>
        <head>
          <title>QRs de mesas</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 24px; }
            h1 { font-size: 18px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
            .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; text-align: center; page-break-inside: avoid; }
            .card img { width: 200px; height: 200px; }
            .num { font-weight: 700; margin: 8px 0 2px; }
            .hint { color: #666; font-size: 12px; margin: 0; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>Menú digital — QRs por mesa</h1>
          <div class="grid">${cards}</div>
          <script>window.onload = () => setTimeout(() => window.print(), 400)</script>
        </body>
      </html>`);
    win.document.close();
  }, [tables]);

  const openCreate = () => {
    setEditingTable(null);
    setFormNumber(String(tables.length + 1));
    setFormName("");
    setFormCapacity("4");
    setFormLocation(locations[0]?.id || "");
    setFormRoom(selectedRoomId || rooms[0]?.id || "");
    setFormShape("round");
    setDialogOpen(true);
  };

  const openEdit = (t: TableData) => {
    setEditingTable(t);
    setFormNumber(String(t.number));
    setFormName(t.name || "");
    setFormCapacity(String(t.capacity));
    setFormLocation(t.location?.id || "");
    setFormRoom(t.room?.id || "");
    setFormShape(t.shape || "round");
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
        roomId: formRoom || null,
        shape: formShape,
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

  const openRoomCreate = () => {
    setRoomEditing(null);
    setFormRoomName("");
    setRoomDialogOpen(true);
  };

  const openRoomEdit = (r: RoomData) => {
    setRoomEditing(r);
    setFormRoomName(r.name);
    setRoomDialogOpen(true);
  };

  const saveRoom = async () => {
    const name = formRoomName.trim();
    if (!name) {
      swalError("Nombre de sala requerido");
      return;
    }
    try {
      const res = await fetch("/api/tables/rooms", {
        method: roomEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(roomEditing ? { id: roomEditing.id } : {}),
          name,
          locationId: formLocation || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo guardar");
      swalToast(roomEditing ? "Sala actualizada" : "Sala creada");
      setRoomDialogOpen(false);
      load();
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    }
  };

  /** Cierra una entrada de la lista de espera (sentado/cancelado). */
  const closeWaitlistEntry = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/table-waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo actualizar");
      swalToast(status === "seated" ? "Cliente sentado" : "Entrada cerrada");
      load();
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  };

  /** Cambia el estado de una reservación de mesa (confirmar/sentar/cancelar). */
  const setReservationStatus = async (r: ReservationRow, status: string) => {
    try {
      const res = await fetch("/api/table-reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo actualizar");
      swalToast(
        status === "seated"
          ? "Mesa sentada — quedó ocupada en el POS"
          : status === "confirmed"
            ? "Reservación confirmada"
            : "Reservación cancelada"
      );
      load();
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  };

  const handleDeleteRoom = async (r: RoomData) => {
    const confirmed = await swalConfirm(
      "¿Eliminar sala?",
      `Se eliminará «${r.name}». Sus mesas quedarán sin sala (no se borran).`,
      { confirmText: "Eliminar", danger: true }
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/tables/rooms?id=${r.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo eliminar");
      swalToast("Sala eliminada");
      if (selectedRoomId === r.id) setSelectedRoomId("");
      load();
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
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

      {/* Lista de espera (anfitrión) */}
      {waitlistEntries.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <Clock className="size-4 text-amber-600" />
            <p className="text-sm font-semibold">Lista de espera</p>
            <Badge variant="outline" className="ml-auto text-[10px]">
              {waitlistEntries.length} {waitlistEntries.length === 1 ? "cliente" : "clientes"}
            </Badge>
          </div>
          <div className="divide-y">
            {waitlistEntries.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Clock className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    #{e.position} · {e.guests} {e.guests === 1 ? "persona" : "personas"}
                    {e.availableTable ? ` · Mesa #${e.availableTable.number} libre` : " · en espera"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.customer?.fullName ?? e.name ?? "Invitado"}
                    {(e.customer?.phone ?? e.phone) ? ` · ${e.customer?.phone ?? e.phone}` : ""}
                    {e.availableTable?.room?.name ? ` · ${e.availableTable.room.name}` : ""}
                  </p>
                </div>
                {!e.customer && <Badge variant="outline" className="text-[10px]">Invitado</Badge>}
                <Badge variant="outline" className={cn("text-[10px]", e.status === "available" ? "text-emerald-600" : "text-amber-600")}>
                  {e.status === "available" ? "Mesa lista" : "Esperando"}
                </Badge>
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-8 px-2 text-xs" onClick={() => closeWaitlistEntry(e.id, "seated")}>
                    Sentado
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-destructive" onClick={() => closeWaitlistEntry(e.id, "cancelled")}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reservaciones de mesa del día (anfitrión) */}
      {reservations.filter((r) => r.status === "pending" || r.status === "confirmed").length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <CalendarCheck2 className="size-4 text-primary" />
            <p className="text-sm font-semibold">Reservaciones de mesa</p>
            <Badge variant="outline" className="ml-auto text-[10px]">
              {reservations.filter((r) => r.status === "pending" || r.status === "confirmed").length} activas
            </Badge>
          </div>
          <div className="divide-y">
            {reservations
              .filter((r) => r.status === "pending" || r.status === "confirmed")
              .map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Users className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {new Date(r.startsAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}{" "}
                      · {r.guests} {r.guests === 1 ? "persona" : "personas"}
                      {r.table ? ` · Mesa #${r.table.number}` : r.room ? ` · ${r.room.name}` : " · sin mesa"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.name ?? r.customer?.fullName ?? "Cliente del portal"}
                      {(r.phone ?? r.customer?.phone) ? ` · ${r.phone ?? r.customer?.phone}` : ""}
                      {!r.customer && r.name ? " · Invitado" : ""}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px]", r.status === "pending" ? "text-amber-600" : "text-sky-600")}>
                    {r.status === "pending" ? "Pendiente" : "Confirmada"}
                  </Badge>
                  <div className="flex gap-1.5">
                    {r.status === "pending" && (
                      <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setReservationStatus(r, "confirmed")}>
                        Confirmar
                      </Button>
                    )}
                    <Button size="sm" className="h-8 px-2 text-xs" onClick={() => setReservationStatus(r, "seated")}>
                      Sentar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-destructive" onClick={() => setReservationStatus(r, "cancelled")}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

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

        <div className="flex gap-1">
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
            className="text-xs"
          >
            <Armchair className="w-3.5 h-3.5 mr-1" />
            Lista
          </Button>
          <Button
            variant={view === "plan" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("plan")}
            className="text-xs"
          >
            <LayoutGrid className="w-3.5 h-3.5 mr-1" />
            Plano
          </Button>
        </div>

        <div className="flex-1" />

        {canManage && (
          <Button
            variant="outline"
            size="sm"
            onClick={exportQrs}
            disabled={exporting}
            title="Descarga un QR imprimible por cada mesa activa"
          >
            {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            Descargar QRs
          </Button>
        )}
        {/* Ventana del aviso de llegada (por organización). */}
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-muted-foreground" />
          <input
            type="number"
            min={1}
            max={24}
            value={upcomingHours}
            onChange={(e) => setUpcomingHours(e.target.value.replace(/\D/g, "").slice(0, 2))}
            onBlur={saveUpcomingHours}
            title="Horas de anticipación con las que una reservación confirmada aparece como próxima (POS/KDS)"
            className="h-8 w-14 rounded-md border border-input bg-background px-2 text-center text-xs"
          />
          <span className="text-xs text-muted-foreground">h antes</span>
        </div>

        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCcw className="w-4 h-4 mr-1" />
          Actualizar
        </Button>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setPolicyOpen(true)} title="Reglas que se aplican al reservar (portal, invitado y panel)">
            <Settings2 className="w-4 h-4 mr-1" />
            Política de reservación
          </Button>
        )}
        {canManage && (
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <CalendarPlus className="w-4 h-4 mr-1" />
            Nueva reservación
          </Button>
        )}
      </div>

      {/* Salas (solo vista plano): chips + crear/renombrar/eliminar */}
      {view === "plan" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <DoorOpen className="size-3.5" /> Salas
          </span>
          <button
            type="button"
            onClick={() => setSelectedRoomId("")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              selectedRoomId === ""
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Sin sala ({tables.filter((t) => !t.room).length})
          </button>
          {rooms.map((r) => (
            <span key={r.id} className="relative">
              <button
                type="button"
                onClick={() => setSelectedRoomId(selectedRoomId === r.id ? "" : r.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  selectedRoomId === r.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {r.name} ({r._count.tables})
              </button>
              {canManage && (
                <span className="absolute -right-1 -top-1 flex gap-0.5">
                  <button
                    type="button"
                    title="Renombrar sala"
                    onClick={() => openRoomEdit(r)}
                    className="flex size-4 items-center justify-center rounded-full border bg-background text-[9px] text-muted-foreground hover:text-foreground"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    title="Eliminar sala"
                    onClick={() => handleDeleteRoom(r)}
                    className="flex size-4 items-center justify-center rounded-full border bg-background text-[9px] text-rose-500 hover:bg-rose-50"
                  >
                    ✕
                  </button>
                </span>
              )}
            </span>
          ))}
          {canManage && (
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={openRoomCreate}>
              <Plus className="size-3.5" />
              Nueva sala
            </Button>
          )}
        </div>
      )}

      {/* Table grid / Plano */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : view === "plan" ? (
        <FloorPlanEditor
          key={selectedRoomId || "no-room"}
          tables={
            selectedRoomId
              ? tables.filter((t) => t.room?.id === selectedRoomId).map(planOf)
              : tables.filter((t) => !t.room).map(planOf)
          }
          nodes={planNodes.filter((n) => (selectedRoomId ? n.roomId === selectedRoomId : !n.roomId))}
          roomName={
            selectedRoomId ? rooms.find((r) => r.id === selectedRoomId)?.name ?? null : null
          }
          canManage={canManage}
          locationId={locationFilter || null}
          roomId={selectedRoomId || null}
          onChanged={load}
        />
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
                onClick={() => (canManage ? openEdit(t) : setHistoryTable(t))}
                className={cn(
                  "relative group text-center p-4 rounded-2xl border-2 transition-all duration-200",
                  "hover:shadow-md hover:-translate-y-0.5",
                  cfg.bg
                )}
              >
                {/* Actions on hover */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setHistoryTable(t); }}
                    title="Historial"
                    className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center hover:bg-white"
                  >
                    <History className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setQrDialogTable(t); }}
                    className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center hover:bg-white"
                  >
                    <QrCode className="w-3 h-3" />
                  </button>
                  {canManage && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
                      title="Eliminar mesa"
                      className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center hover:bg-rose-100"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                    </button>
                  )}
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

                {/* Sala */}
                {t.room && (
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <DoorOpen className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400 truncate">{t.room.name}</span>
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
          <div>
            <label className="text-sm font-medium mb-1 block">Sala</label>
            <select
              value={formRoom}
              onChange={(e) => setFormRoom(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Sin sala</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Forma</label>
            <select
              value={formShape}
              onChange={(e) => setFormShape(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {SHAPE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
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

      {/* Sala Dialog (crear/renombrar) */}
      <DialogComponent
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        title={roomEditing ? `Renombrar sala` : "Nueva sala"}
      >
        <div className="space-y-4 p-4">
          <InputGroupField
            label="Nombre de la sala"
            placeholder="Ej: Salón principal, Terraza, Bar…"
            value={formRoomName}
            onChange={(e) => setFormRoomName(e.target.value)}
            leftIcon={<DoorOpen className="w-4 h-4 text-slate-400" />}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRoomDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveRoom}>{roomEditing ? "Guardar" : "Crear sala"}</Button>
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
      {/* History Dialog */}
      <TableHistoryDialog
        open={!!historyTable}
        tableId={historyTable?.id ?? null}
        tableNumber={historyTable?.number ?? null}
        onClose={() => setHistoryTable(null)}
      />

      {/* Política de reservación + wizard a pasos */}
      <ReservationPolicyDialog open={policyOpen} onOpenChange={setPolicyOpen} />
      <ReservationWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} locations={locations} />
    </div>
  );
}
