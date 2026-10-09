import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { SessionRole } from "@/lib/auth/permissions";
import { isPlanBlockedPath } from "@/lib/billing/plan-permissions";

/** Páginas globales del superAdmin (no dependen de una empresa activa). */
const PLATFORM_PATHS = [
  "/admin/settings/organizations",
  "/admin/settings/subscriptions",
  "/admin/settings/plans",
  "/admin/settings/menus",
];

// FASE 2.7 — Middleware de protección de rutas.
// - /pos          → cualquier sesión de app (no cliente)
// - /admin        → solo owner/manager/superadmin
// - /portal       → solo clientes (el área /portal/auth/* es público)
// - /onboarding   → cualquier sesión de app (primera configuración)
// El callbackUrl viaja en la query para volver a la pantalla original.

const ADMIN_ONLY: SessionRole[] = ["superadmin", "owner", "manager", "admin"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const loginUrl = (base: string, target: string) => {
    const url = req.nextUrl.clone();
    url.pathname = base;
    url.search = `?callbackUrl=${encodeURIComponent(target)}`;
    return url;
  };

  // Sesión inválida (usuario desactivado/eliminado) → tratar como sin sesión.
  const authenticated = Boolean(token && !token.invalid);

  // Áreas que el plan contratado no incluye (CEDIS, KDS, agenda,
  // reservaciones): se redirige a "Mi plan" en lugar de abrir una pantalla vacía.
  if (
    authenticated &&
    token!.scope === "app" &&
    isPlanBlockedPath(pathname, token!.planDenied as string[] | undefined)
  ) {
    const url = new URL("/admin/settings/my-plan", req.url);
    url.searchParams.set("bloqueado", pathname);
    return NextResponse.redirect(url);
  }

  // Al volver con el navegador, un cliente con sesión permanece en su portal.
  if (authenticated && token!.scope === "portal" && (pathname === "/" || pathname === "/portal/auth/login")) {
    return NextResponse.redirect(new URL("/portal", req.url));
  }

  // Onboarding: solo accesible con sesión de app
  if (pathname.startsWith("/onboarding")) {
    if (!authenticated) return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    if (token!.scope === "portal")
      return NextResponse.redirect(loginUrl("/portal/auth/login", pathname + search));
    return NextResponse.next();
  }

  // Panel POS
  if (pathname.startsWith("/pos")) {
    if (!authenticated) return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    if (token!.scope === "portal")
      return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    return NextResponse.next();
  }

  // KDS (pantalla de cocina) e interfaz del repartidor — misma auth que /pos
  if (pathname.startsWith("/kds") || pathname.startsWith("/repartidor")) {
    if (!authenticated) return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    if (token!.scope === "portal")
      return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    return NextResponse.next();
  }

  // Agenda de citas (services / hybrid)
  if (pathname.startsWith("/agenda")) {
    if (!authenticated) return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    if (token!.scope === "portal")
      return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    // El superAdmin sin organización activa primero elige empresa (igual que /admin).
    if (token!.scope === "superadmin" && !token!.activeOrganizationId)
      return NextResponse.redirect(new URL("/admin/settings/organizations", req.url));
    // El giro se valida en la página contra la organización en BD. El JWT puede
    // pertenecer a una sesión abierta antes de que la empresa cambiara de giro.
    return NextResponse.next();
  }

  // Reservaciones (rental / hybrid)
  if (pathname.startsWith("/reservaciones")) {
    if (!authenticated) return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    if (token!.scope === "portal")
      return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    // El superAdmin sin organización activa primero elige empresa (igual que /admin).
    if (token!.scope === "superadmin" && !token!.activeOrganizationId)
      return NextResponse.redirect(new URL("/admin/settings/organizations", req.url));
    // El giro se valida en la página contra la organización en BD. El JWT puede
    // pertenecer a una sesión abierta antes de que la empresa cambiara de giro.
    return NextResponse.next();
  }

  // Panel admin
  if (pathname.startsWith("/admin")) {
    if (!authenticated) return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    if (token!.scope === "portal" || !ADMIN_ONLY.includes((token!.role as SessionRole) ?? "")) {
      return NextResponse.redirect(new URL("/pos", req.url));
    }
    // El superAdmin sin organización activa solo ve las páginas globales de
    // Plataforma (organizaciones, suscripciones, planes y menú); para el
    // resto elige primero en qué empresa operar.
    if (
      token!.scope === "superadmin" &&
      !token!.activeOrganizationId &&
      !PLATFORM_PATHS.some((p) => pathname.startsWith(p))
    ) {
      return NextResponse.redirect(new URL("/admin/settings/organizations", req.url));
    }
    // Usuarios sin organización van al onboarding primero
    if (
      token!.scope !== "superadmin" &&
      !token!.activeOrganizationId &&
      !pathname.startsWith("/admin/onboarding")
    ) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
    return NextResponse.next();
  }

  // Portal de clientes (el login del portal es público)
  // El menú digital por QR de mesa es público (la mesa y su token son la credencial).
  if (pathname.startsWith("/portal") && !pathname.startsWith("/portal/auth") && !pathname.startsWith("/portal/menu")) {
    if (!authenticated || token!.scope !== "portal") {
      return NextResponse.redirect(loginUrl("/portal/auth/login", pathname + search));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/pos/:path*",
    "/kds/:path*",
    "/agenda/:path*",
    "/reservaciones/:path*",
    "/admin/:path*",
    "/portal/:path*",
    "/onboarding",
  ],
};
