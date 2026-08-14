import { NextResponse } from "next/server";
import { getSupervisorSettings, updateSupervisorSettings } from "@/lib/settings/server";
import { settingsManageGuard, settingsErrorResponse } from "../guard";

// FASE 15.7 — Configuración de aprobación de supervisor.

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await settingsManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const settings = await getSupervisorSettings(guard.organizationId);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  const guard = await settingsManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const settings = await updateSupervisorSettings(guard.organizationId, input);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
