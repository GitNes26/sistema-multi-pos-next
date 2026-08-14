import { NextRequest, NextResponse } from "next/server";
import { guardCrud } from "../../guard";
import { importWorkbook, previewWorkbook } from "@/lib/excel/spreadsheet";

// FASE 7.10 / 19.2 — Importación masiva desde Excel (.xlsx) con preview.
// POST /api/crud/[module]/import  (multipart/form-data: "file"; "preview"="true" para vista previa)

const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const segments = req.nextUrl.pathname.split("/");
  const moduleKey = segments[segments.length - 2] as string;
  const guard = await guardCrud(moduleKey, "manage");
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Envío el campo «file» con tu .xlsx" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: "El archivo excede 10 MB" }, { status: 413 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    if (form.get("preview") === "true") {
      const result = await previewWorkbook(organizationId, moduleKey, buffer);
      return NextResponse.json({ ok: true, result });
    }

    const result = await importWorkbook(organizationId, moduleKey, buffer);
    return NextResponse.json({ ok: result.ok, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error al importar" },
      { status: 400 }
    );
  }
}