import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveLoginUser } from "@/lib/auth/options";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/org-hint — pista de organización para la pantalla de login.
 * Dado un identificador (email o código de nómina), responde con la
 * organización recordada a la que el usuario volverá a entrar (si sigue
 * teniendo acceso) y cuántas organizaciones tiene accesibles.
 *
 * Sin sesión: es solo una pista visual para el usuario multi-org ("vas a
 * entrar a X"). NUNCA confirma si el identificador existe, ni expone más de
 * un nombre de org, ni permite elegir org desde aquí — la membresía real se
 * resuelve al autenticar. Rate limit básico para frenar sondeo por fuerza
 * bruta de nombres de org.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_REQUESTS;
}

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(ip)) {
      return NextResponse.json(
        { ok: false, error: "Demasiadas solicitudes" },
        { status: 429 }
      );
    }

    const body = (await req.json()) as { identifier?: string };
    const identifier = body.identifier?.trim();
    if (!identifier || identifier.length < 3) {
      return NextResponse.json({ ok: true, lastOrg: null, accessibleCount: 0 });
    }

    const user = await resolveLoginUser(identifier);
    if (!user) {
      // Respuesta neutra: no se revela si el identificador existe.
      return NextResponse.json({ ok: true, lastOrg: null, accessibleCount: 0 });
    }

    const isSuper = user.isSuperadmin;
    const accessible = isSuper
      ? null
      : new Set([
          ...user.employees.map((e) => e.organizationId),
          ...user.memberships.map((m) => m.organizationId),
        ]);

    let lastOrg: { id: string; name: string; businessMode: string } | null = null;
    if (user.lastOrganizationId && (isSuper || accessible!.has(user.lastOrganizationId))) {
      const org = await prisma.organization.findUnique({
        where: { id: user.lastOrganizationId },
        select: { id: true, name: true, businessMode: true },
      });
      if (org) {
        lastOrg = { id: org.id, name: org.name, businessMode: org.businessMode };
      }
    }

    // Lista para el picker del login (multi-org): solo orgs con membresía
    // (el empleado sin membresía no define rol). El superAdmin puede entrar
    // a cualquier empresa: no se expone el catálogo — el switcher post-login
    // lo cubre.
    const organizations = isSuper
      ? []
      : await prisma.organization.findMany({
          where: { id: { in: [...accessible!] } },
          select: { id: true, name: true, businessMode: true, currency: true },
          orderBy: { name: "asc" },
        });

    // El superAdmin puede entrar a cualquier org: sin conteo ni catálogo.
    const accessibleCount = isSuper ? null : organizations.length;

    return NextResponse.json({ ok: true, lastOrg, organizations, accessibleCount });
  } catch (err) {
    console.error("[org-hint]", err);
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500 }
    );
  }
}
