import { NextRequest, NextResponse } from "next/server";
import { guardCrud } from "../../guard";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { importWorkbook, previewWorkbook } from "@/lib/excel/spreadsheet";
import { enqueueJob, jobFilesDir } from "@/lib/jobs";

// FASE 7.10 / 19.2 — Importación masiva desde Excel (.xlsx) con preview.
// POST /api/crud/[module]/import  (multipart/form-data: "file"; "preview"="true" para vista previa)

const MAX_SIZE = 10 * 1024 * 1024;
// Más de ~80 KB (unos cientos de filas) se importa en segundo plano.
const ASYNC_IMPORT_BYTES = Number(process.env.IMPORT_ASYNC_BYTES) || 80_000;

export async function POST(req: NextRequest) {
  const segments = req.nextUrl.pathname.split("/");
  const moduleKey = segments[segments.length - 2] as string;
  const guard = await guardCrud(moduleKey, "manage");
  if ("response" in guard) return guard.response;
  const { organizationId, userId, canManageInventory } = guard;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Envío el campo «file» con tu .xlsx" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: "El archivo excede 10 MB" }, { status: 413 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ ok: false, error: "Selecciona un archivo Excel .xlsx" }, { status: 415 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return NextResponse.json({ ok: false, error: "El archivo no es un Excel .xlsx válido" }, { status: 415 });
    }

    if (form.get("preview") === "true") {
      const result = await previewWorkbook(organizationId, moduleKey, buffer, { userId, canManageInventory });
      return NextResponse.json({ ok: true, result });
    }

    // Archivos grandes (cientos de filas) se procesan en segundo plano: la respuesta es inmediata
    // y la pantalla consulta el avance en /api/jobs/<id>. Los pequeños siguen siendo instantáneos.
    if (buffer.length > ASYNC_IMPORT_BYTES) {
      const fileName = `${randomUUID()}.xlsx`;
      await mkdir(jobFilesDir(), { recursive: true });
      await writeFile(path.join(jobFilesDir(), fileName), buffer);
      const job = await enqueueJob({ type: "excel.import", organizationId, userId, payload: { module: moduleKey, fileName, userId, canManageInventory } });
      return NextResponse.json({ ok: true, async: true, jobId: job.id }, { status: 202 });
    }

    const result = await importWorkbook(organizationId, moduleKey, buffer, { userId, canManageInventory });
    return NextResponse.json({ ok: result.ok, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error al importar" },
      { status: 400 }
    );
  }
}
