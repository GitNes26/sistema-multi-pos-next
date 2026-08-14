import { NextResponse } from "next/server";
import { listRoles, createRole } from "@/lib/settings/server";
import { usersManageGuard, settingsErrorResponse } from "../guard";

// FASE 14.x/15.4 — Roles: listar (GET) y crear (POST).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const roles = await listRoles(guard.organizationId);
    return NextResponse.json({ ok: true, roles });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const role = await createRole(guard.organizationId, input);
    return NextResponse.json({ ok: true, role });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
