import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { closeOptions, closeStore, getStoreStatus, openStore, type CloseMode } from "@/lib/store-status";

// Estado Abierto/Cerrado del negocio.
// GET: cualquier sesión de la empresa (panel, POS o portal).
// POST { action: "close", mode, until?, reason? } | { action: "open" }: gestión de pedidos.

async function orgOf() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  const organizationId = session.user.scope === "portal" ? session.user.organizationId : effectiveOrgId(session);
  if (!organizationId) return { error: NextResponse.json({ ok: false, error: "Selecciona una empresa" }, { status: 400 }) };
  return { session, organizationId };
}

export async function GET(req: Request) {
  const access = await orgOf();
  if ("error" in access) return access.error;
  const withOptions = new URL(req.url).searchParams.get("options") === "1" && access.session.user.scope !== "portal";
  const [status, options] = await Promise.all([
    getStoreStatus(access.organizationId),
    withOptions ? closeOptions(access.organizationId) : Promise.resolve(null),
  ]);
  return NextResponse.json({ ok: true, status, options });
}

export async function POST(req: Request) {
  const access = await orgOf();
  if ("error" in access) return access.error;
  if (access.session.user.scope === "portal" || !hasPermission(access.session, "orders.manage")) {
    return NextResponse.json({ ok: false, error: "No tienes permiso para abrir o cerrar el negocio" }, { status: 403 });
  }
  try {
    const body = (await req.json()) as { action?: string; mode?: CloseMode; until?: string | null; reason?: string | null };
    const status =
      body.action === "open"
        ? await openStore(access.organizationId)
        : await closeStore(access.organizationId, { mode: body.mode ?? "next_business_day", until: body.until, reason: body.reason });
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error del servidor" }, { status: status || 500 });
  }
}
