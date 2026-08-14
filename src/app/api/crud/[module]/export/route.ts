import { NextRequest, NextResponse } from "next/server";
import { guardCrud } from "../../guard";
import { exportWorkbook } from "@/lib/excel/spreadsheet";

// FASE 7.10 — Exportación masiva de un módulo a Excel (.xlsx).
// GET /api/crud/[module]/export

export async function GET(req: NextRequest) {
  const segments = req.nextUrl.pathname.split("/");
  const moduleKey = segments[segments.length - 2] as string;
  const guard = await guardCrud(moduleKey, "view");
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;

  try {
    const { buffer, filename } = await exportWorkbook(organizationId, moduleKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error al exportar" },
      { status: 500 }
    );
  }
}