"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  Layers,
  Loader2,
  Package,
  Plus,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DialogComponent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/base/data-table";
import { crudApi, exportExcel, exportTemplate, importExcel, previewExcel, getCustomerActivity, type CustomerActivityData, type ExcelPreviewResult } from "@/lib/api";
import { money } from "@/lib/pos/money";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { CrudForm } from "./crud-form";
import { ProductsForm } from "./products-form";
import { VariantsDialog } from "./variants-dialog";
import { TooltipButton } from "@/components/shared/tooltip-button";
import { getCrudUi, CRUD_PRODUCTS_TITLE, type CrudColumn, type CrudUiConfig } from "./crud-config";

interface CrudPageProps {
  moduleKey: string;
  canManage: boolean;
  canDelete: boolean;
  icon?: React.ReactNode;
}

function isProducts(moduleKey: string) {
  return moduleKey === "products";
}

const EXCEL_MODULES = ["products", "categories", "customers"];
const isExcelModule = (m: string) => EXCEL_MODULES.includes(m);

function renderCell(column: CrudColumn, row: Record<string, unknown>) {
  const value = row[column.key];
  const type = column.type ?? "text";
  if (value === undefined || value === null || value === "") return <span className="text-muted-foreground">—</span>;

  switch (type) {
    case "boolean":
      return (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? "Sí" : "No"}
        </Badge>
      );
    case "money":
      return <span className="tabular-nums">{money(Number(value))}</span>;
    case "percent":
      return <span className="tabular-nums">{(Number(value) * 100).toFixed(2)}%</span>;
    case "count":
      return <span className="tabular-nums text-muted-foreground">{Number(value)}</span>;
    case "code":
      return <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{String(value)}</code>;
    case "badge":
    default:
      return (
        <Badge variant="secondary">
          {column.displayMap && value != null ? column.displayMap[String(value)] ?? String(value) : String(value)}
        </Badge>
      );
  }
}

function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function CrudPage({ moduleKey, canManage, canDelete, icon }: CrudPageProps) {
  const config = useMemo<CrudUiConfig | null>(() => (isProducts(moduleKey) ? null : getCrudUi(moduleKey) ?? null), [moduleKey]);
  const meta = isProducts(moduleKey) ? CRUD_PRODUCTS_TITLE : config ?? { module: moduleKey, title: "Módulo", description: "" };
  const searchPlaceholder = isProducts(moduleKey)
    ? CRUD_PRODUCTS_TITLE.searchPlaceholder
    : config?.searchPlaceholder ?? "Buscar…";

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [excelBusy, setExcelBusy] = useState<"export" | "import" | null>(null);
  const [preview, setPreview] = useState<ExcelPreviewResult | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [activity, setActivity] = useState<CustomerActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityCustomer, setActivityCustomer] = useState<Record<string, unknown> | null>(null);
  const [variantsProduct, setVariantsProduct] = useState<Record<string, unknown> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const res = await crudApi.list(moduleKey, { page, pageSize, q: debouncedQ });
        if (signal?.aborted) return;
        setRows(res.rows);
        setTotal(res.total);
      } catch (err) {
        if (signal?.aborted) return;
        swalError("Error al cargar", err instanceof Error ? err.message : undefined);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [moduleKey, page, pageSize, debouncedQ]
  );

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const isDebouncing = q !== debouncedQ;

  const columns = useMemo(() => {
    if (!config) return [];
    return config.columns.map<ColumnDef<Record<string, unknown>, unknown>>((col) => ({
      id: col.key,
      header: col.label,
      accessorKey: col.key,
      cell: ({ row }) => renderCell(col, row.original),
    }));
  }, [config]);

  const productsColumns = useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(
    () => [
      {
        id: "image",
        header: "",
        cell: ({ row }) => {
          const img = String(row.original.imageUrl ?? "");
          return img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="size-10 rounded-md object-cover" />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Package className="size-4" />
            </span>
          );
        },
      },
      { id: "name", header: "Nombre", accessorKey: "name" },
      {
        id: "categoryName",
        header: "Categoría",
        accessorKey: "categoryName",
        cell: ({ row }) =>
          row.original.categoryName ? <Badge variant="secondary">{String(row.original.categoryName)}</Badge> : <span className="text-muted-foreground">—</span>,
      },
      {
        id: "productType",
        header: "Tipo",
        accessorKey: "productType",
        cell: ({ row }) => (
          <Badge variant={row.original.productType === "bulk" ? "outline" : "secondary"}>
            {row.original.productType === "bulk" ? "Granel" : "Estándar"}
          </Badge>
        ),
      },
      {
        id: "price",
        header: "Precio",
        cell: ({ row }) => {
          const variants = (row.original.variants as { price: number }[] | undefined) ?? [];
          const price = variants[0]?.price;
          return price !== undefined ? (
            <span className="tabular-nums">{money(Number(price))}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "variantsCount",
        header: "Variantes",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {(row.original.variants as unknown[] | undefined)?.length ?? 0}
          </span>
        ),
      },
      {
        id: "isActive",
        header: "Estado",
        accessorKey: "isActive",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Activo" : "Inactivo"}
          </Badge>
        ),
      },
    ],
    []
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const openActivity = async (row: Record<string, unknown>) => {
    setActivityCustomer(row);
    setActivity(null);
    setActivityLoading(true);
    try {
      const data = await getCustomerActivity(String(row.id));
      setActivity(data);
    } catch (err) {
      swalError("No se pudo cargar el historial", err instanceof Error ? err.message : undefined);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleDelete = async (row: Record<string, unknown>) => {
    const ok = await swalConfirm("Eliminar", "Esta acción no se puede deshacer.", {
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(String(row.id));
    try {
      await crudApi.remove(moduleKey, String(row.id));
      swalToast("Eliminado");
      load();
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (editing) {
      await crudApi.update(moduleKey, String(editing.id), values);
      swalToast("Cambios guardados");
    } else {
      await crudApi.create(moduleKey, values);
      swalToast("Registro creado");
    }
    setDialogOpen(false);
    await load();
  };

  const handleExport = async () => {
    if (excelBusy) return;
    setExcelBusy("export");
    try {
      await exportExcel(moduleKey);
      swalToast("Archivo exportado");
    } catch (err) {
      swalError("No se pudo exportar", err instanceof Error ? err.message : undefined);
    } finally {
      setExcelBusy(null);
    }
  };

  const handleTemplate = async () => {
    if (excelBusy) return;
    setExcelBusy("export");
    try {
      await exportTemplate(moduleKey);
      swalToast("Plantilla descargada");
    } catch (err) {
      swalError("No se pudo descargar la plantilla", err instanceof Error ? err.message : undefined);
    } finally {
      setExcelBusy(null);
    }
  };

  const handleImportFile = async (file: File) => {
    setExcelBusy("import");
    try {
      const result = await previewExcel(moduleKey, file);
      setPendingFile(file);
      setPreview(result);
    } catch (err) {
      swalError("No se pudo analizar el archivo", err instanceof Error ? err.message : undefined);
    } finally {
      setExcelBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setExcelBusy("import");
    try {
      const result = await importExcel(moduleKey, pendingFile);
      const errors = result.errors;
      if (errors.length > 0) {
        const first = errors.slice(0, 5).map((e) => `Fila ${e.row}: ${e.message}`).join("  |  ");
        const extra = errors.length > 5 ? `  (+${errors.length - 5} más)` : "";
        swalError(
          "Importación con errores",
          `Se importaron ${result.imported} de ${result.imported + errors.length}. ${first}${extra}`
        );
      } else {
        swalToast(`${result.imported} registros importados`);
      }
      setPreview(null);
      setPendingFile(null);
      await load();
    } catch (err) {
      swalError("No se pudo importar", err instanceof Error ? err.message : undefined);
    } finally {
      setExcelBusy(null);
    }
  };

  const actionColumns = useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(() => {
    if (!canManage) return [];
    return [
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {moduleKey === "customers" && (
              <Button variant="ghost" size="icon" className="size-8" onClick={() => openActivity(row.original)}>
                <Eye className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(row.original)}>
              <Pencil className="size-4" />
            </Button>
            {isProducts(moduleKey) && row.original.productType === "standard" && (
              <Button variant="ghost" size="icon" className="size-8" title="Variantes" onClick={() => setVariantsProduct(row.original)}>
                <Layers className="size-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive"
                disabled={deletingId === String(row.original.id)}
                onClick={() => handleDelete(row.original)}
                title={deletingId === String(row.original.id) ? "Eliminando…" : "Eliminar"}
              >
                {deletingId === String(row.original.id) ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            )}
          </div>
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, canDelete, moduleKey]);

  const activeColumns = isProducts(moduleKey) ? productsColumns : columns;
  const tableColumns = canManage ? [...activeColumns, ...actionColumns] : activeColumns;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <>
      <PageHeader
        icon={icon}
        title={meta.title}
        description={meta.description}
        actions={
          canManage && (
            <div className="flex flex-wrap items-center gap-2">
              {isExcelModule(moduleKey) && (
                <>
                  <Button variant="outline" size="sm" onClick={handleExport} disabled={excelBusy !== null}>
                    {excelBusy === "export" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    {excelBusy === "export" ? "Exportando…" : "Exportar"}
                  </Button>
                  <TooltipButton
                    label="Plantilla vacía con instrucciones y catálogos (descárgala cada vez que vayas a importar)"
                    variant="outline"
                    size="sm"
                    onClick={handleTemplate}
                    disabled={excelBusy !== null}
                  >
                    <FileSpreadsheet className="size-4" />
                    {excelBusy === "export" ? "Descargando…" : "Plantilla"}
                  </TooltipButton>
                  <TooltipButton
                    label="1) Descarga la plantilla · 2) llena las filas · 3) sube el archivo para ver la vista previa · 4) confirma. Descarga la plantilla cada vez, por si se agregaron valores nuevos a los catálogos."
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={excelBusy !== null}
                    side="bottom"
                  >
                    {excelBusy === "import" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {excelBusy === "import" ? "Importando…" : "Importar"}
                  </TooltipButton>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportFile(f);
                    }}
                  />
                </>
              )}
              <Button onClick={openCreate}>
                <Plus className="size-4" /> Nuevo
              </Button>
            </div>
          )
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full max-w-64">
              <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 pl-9 pr-8"
              />
              {(isDebouncing || loading) && (
                <Loader2 className="pointer-events-none absolute inset-y-0 right-2.5 my-auto size-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <span className="text-sm text-muted-foreground">{total} registro(s)</span>
          </div>

          <DataTable
            columns={tableColumns}
            data={rows}
            searchable={false}
            showColumnVisibility={false}
            showPagination={false}
            loading={loading}
            emptyMessage="Sin resultados"
            rowKey={(r) => String(r.id)}
            onRefresh={() => load()}
            refreshing={loading}
          />

          {!loading && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <span className="text-sm tabular-nums text-muted-foreground">
                {from}–{to} de {total}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="px-2 text-sm tabular-nums text-muted-foreground">
                  {page} / {pageCount}
                </span>
                <Button variant="ghost" size="icon" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DialogComponent
        open={dialogOpen}
        onOpenChange={(o) => !o && setDialogOpen(false)}
        title={editing ? "Editar" : "Nuevo"}
        description={meta.title}
        className="max-w-[90vw]"
        footerClassName="gap-2"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={formSaving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form={isProducts(moduleKey) ? "product-form" : "crud-form"}
              disabled={formSaving}
            >
              {formSaving && <Loader2 className="size-4 animate-spin" />}
              {editing ? (formSaving ? "Guardando…" : "Guardar cambios") : isProducts(moduleKey) ? (formSaving ? "Creando…" : "Crear producto") : (formSaving ? "Creando…" : "Crear")}
            </Button>
          </>
        }
      >
          {isProducts(moduleKey) ? (
            <ProductsForm
              key={editing ? String(editing.id) : "new"}
              initial={editing}
              onSubmit={handleSubmit}
              onSavingChange={setFormSaving}
            />
          ) : config ? (
            <CrudForm
              key={editing ? String(editing.id) : "new"}
              config={config}
              initial={editing}
              onSubmit={handleSubmit}
              onSavingChange={setFormSaving}
            />
          ) : null}
          {loading && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}
      </DialogComponent>

      <CustomerActivityDialog
        open={Boolean(activityCustomer)}
        customer={activityCustomer}
        activity={activity}
        loading={activityLoading}
        onClose={() => setActivityCustomer(null)}
      />

      {variantsProduct && (
        <VariantsDialog
          productId={String(variantsProduct.id)}
          productName={String(variantsProduct.name ?? "Producto")}
          productImage={String(variantsProduct.imageUrl ?? "") || null}
          categoryName={String(variantsProduct.categoryName ?? "") || null}
          defaults={{
            sku: String((variantsProduct.variants as { sku?: string }[])?.[0]?.sku ?? ""),
            barcode: String((variantsProduct.variants as { barcode?: string }[])?.[0]?.barcode ?? ""),
            price: Number((variantsProduct.variants as { price?: number }[])?.[0]?.price ?? 0),
            cost: Number((variantsProduct.variants as { cost?: number }[])?.[0]?.cost ?? 0),
          }}
          onClose={() => setVariantsProduct(null)}
        />
      )}

      <DialogComponent
        open={preview !== null}
        onOpenChange={(o) => !o && (setPreview(null), setPendingFile(null))}
        title="Vista previa de importación"
        description={preview ? `Se importarán ${preview.total} fila(s).` : ""}
        className="max-w-[90vw]"
        footer={
          <>
            <Button variant="outline" onClick={() => (setPreview(null), setPendingFile(null))}>
              Cancelar
            </Button>
            <Button
              onClick={confirmImport}
              disabled={excelBusy !== null || (preview?.missingColumns.length ?? 0) > 0}
            >
              {excelBusy === "import" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Confirmar importación
            </Button>
          </>
        }
      >

          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700">
            Descarga la plantilla cada vez que vayas a importar: los catálogos (categorías, unidades, etc.)
            pueden tener valores nuevos que no están en una plantilla descargada anteriormente.
          </div>

          {preview && preview.missingColumns.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Faltan columnas requeridas: {preview.missingColumns.join(", ")}
            </div>
          )}

          {preview && preview.total === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No se detectaron filas de datos en el archivo.
            </p>
          )}

          {preview && preview.sample.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Fila</th>
                    {preview.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap px-2 py-1.5 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((r) => (
                    <tr key={r.line} className="border-t">
                      <td className="px-2 py-1 text-muted-foreground">{r.line}</td>
                      {r.cells.map((c, i) => (
                        <td key={i} className="max-w-40 truncate px-2 py-1">{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </DialogComponent>
    </>
  );
}

function CustomerActivityDialog({
  open,
  customer,
  activity,
  loading,
  onClose,
}: {
  open: boolean;
  customer: Record<string, unknown> | null;
  activity: CustomerActivityData | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={customer ? String(customer.fullName) : "Cliente"}
      description={
        <>
          {customer?.customerCode ? <code className="text-xs">{String(customer.customerCode)}</code> : null}
          <span className="ml-2">{customer?.phone ? String(customer.phone) : ""}</span>
          {activity && (
            <span className="ml-2 font-medium text-foreground">
              · {activity.points.toFixed(2)} puntos
            </span>
          )}
        </>
      }
      className="max-w-[90vw]"
    >
        {loading ? (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        ) : !activity ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin historial.</p>
        ) : (
          <Tabs defaultValue="loyalty">
            <TabsList>
              <TabsTrigger value="loyalty">Puntos ({activity.loyalty.length})</TabsTrigger>
              <TabsTrigger value="sales">Compras ({activity.sales.length})</TabsTrigger>
              <TabsTrigger value="orders">Pedidos ({activity.orders.length})</TabsTrigger>
              <TabsTrigger value="favorites">Favoritos ({activity.favorites.length})</TabsTrigger>
              <TabsTrigger value="payments">Pagos</TabsTrigger>
            </TabsList>

            <TabsContent value="loyalty">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">Fecha</th>
                    <th className="py-1.5 pr-3 font-medium">Tipo</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Puntos</th>
                    <th className="py-1.5 font-medium">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.loyalty.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 text-muted-foreground">{new Date(l.createdAt).toLocaleDateString()}</td>
                      <td className="py-1.5 pr-3 uppercase text-xs">{l.kind}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        <span className={l.points >= 0 ? "text-emerald-600" : "text-destructive"}>
                          {l.points > 0 ? `+${l.points}` : l.points}
                        </span>
                      </td>
                      <td className="py-1.5">{l.note ?? "—"}</td>
                    </tr>
                  ))}
                  {activity.loyalty.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Sin movimientos de puntos.</td></tr>
                  )}
                </tbody>
              </table>
            </TabsContent>

            <TabsContent value="sales">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">Folio</th>
                    <th className="py-1.5 pr-3 font-medium">Fecha</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Artículos</th>
                    <th className="py-1.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.sales.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 tabular-nums">#{s.saleNumber}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{s.itemCount}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{money(s.total)}</td>
                    </tr>
                  ))}
                  {activity.sales.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Sin compras.</td></tr>
                  )}
                </tbody>
              </table>
            </TabsContent>

            <TabsContent value="orders">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">Pedido</th>
                    <th className="py-1.5 pr-3 font-medium">Fecha</th>
                    <th className="py-1.5 pr-3 font-medium">Estatus</th>
                    <th className="py-1.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.orders.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 tabular-nums">#{o.orderNumber}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</td>
                      <td className="py-1.5 pr-3">
                        <Badge variant="secondary">{o.status}</Badge>
                      </td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{money(o.total)}</td>
                    </tr>
                  ))}
                  {activity.orders.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Sin pedidos.</td></tr>
                  )}
                </tbody>
              </table>
            </TabsContent>

            <TabsContent value="favorites">
              <ul className="space-y-1.5">
                {activity.favorites.map((f) => (
                  <li key={f.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
                    <span>
                      {f.productName}
                      {f.variantName && <span className="text-muted-foreground"> · {f.variantName}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
                {activity.favorites.length === 0 && (
                  <li className="py-4 text-center text-sm text-muted-foreground">Sin favoritos.</li>
                )}
              </ul>
            </TabsContent>

            <TabsContent value="payments">
              <ul className="space-y-1.5">
                {activity.paymentMethods.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
                    <span>
                      {p.brand ?? "Tarjeta"}{" "}
                      {p.last4 ? (
                        <span className="font-medium">···· {p.last4}</span>
                      ) : null}
                      {p.expMonth && p.expYear ? (
                        <span className="text-muted-foreground">
                          {" "}· vence {String(p.expMonth).padStart(2, "0")}/{p.expYear}
                        </span>
                      ) : null}
                    </span>
                    {p.isDefault && <Badge>Principal</Badge>}
                  </li>
                ))}
                {activity.paymentMethods.length === 0 && (
                  <li className="py-4 text-center text-sm text-muted-foreground">Sin métodos de pago guardados.</li>
                )}
              </ul>
            </TabsContent>
          </Tabs>
        )}
    </DialogComponent>
  );
}