import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { listPublications, createPublication } from "@/lib/publications/server";

// FASE 18.1/18.5 — Publicaciones: listar (GET) y crear (POST).

export const dynamic = "force-dynamic";

function guard() {
  return getServerSession(authOptions).then((session) => {
    if (!session?.user) {
      return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
    }
    if (session.user.scope === "portal" || !session.user.organizationId) {
      return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
    }
    if (!hasPermission(session, "publications.manage")) {
      return { response: NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 }) };
    }
    return { organizationId: session.user.organizationId };
  });
}

export async function GET() {
  const g = await guard();
  if ("response" in g) return g.response;
  try {
    const publications = await listPublications(g.organizationId);
    return NextResponse.json({ ok: true, publications });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const g = await guard();
  if ("response" in g) return g.response;
  try {
    const input = await req.json();
    const publication = await createPublication(g.organizationId, input);
    return NextResponse.json({ ok: true, publication });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error del servidor" },
      { status: 500 }
    );
  }
}
