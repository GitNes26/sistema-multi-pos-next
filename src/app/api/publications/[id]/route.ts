import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { updatePublication, deletePublication } from "@/lib/publications/server";

// FASE 18.1 — Editar (PATCH) y borrar (DELETE) una publicación.

export const dynamic = "force-dynamic";

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.scope === "portal" || !session.user.organizationId) {
    return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
  }
  if (!hasPermission(session, "publications.manage")) {
    return { response: NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 }) };
  }
  return { organizationId: session.user.organizationId };
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
