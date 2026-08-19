import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { updatePublication, deletePublication } from "@/lib/publications/server";

// FASE 18.1 — Editar (PATCH) y borrar (DELETE) una publicación.

export const dynamic = "force-dynamic";

async function guard() {
  const session = await getServerSession(authOptions);
  const organizationId = effectiveOrgId(session);
  if (!session?.user || session.user.scope === "portal" || !organizationId) {
    return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
  }
  if (!hasPermission(session, "publications.manage")) {
    return { response: NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 }) };
  }
  return { organizationId };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await guard();
  if ("response" in g) return g.response;
  const { id } = await params;
  try {
    const input = await req.json();
    const publication = await updatePublication(g.organizationId, id, input);
    return NextResponse.json({ ok: true, publication });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await guard();
  if ("response" in g) return g.response;
  const { id } = await params;
  try {
    const result = await deletePublication(g.organizationId, id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error del servidor" },
      { status: 500 }
    );
  }
}
