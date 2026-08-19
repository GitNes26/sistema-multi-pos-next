import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { SessionRole } from "@/lib/auth/permissions";

// FASE 2.7 — Middleware de protección de rutas.
// - /pos          → cualquier sesión de app (no cliente)
// - /admin        → solo owner/manager/superadmin
// - /portal       → solo clientes (el área /portal/auth/* es público)
// El callbackUrl viaja en la query para volver a la pantalla original.

const ADMIN_ONLY: SessionRole[] = ["superadmin", "owner", "manager"];

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

  // Panel POS
  if (pathname.startsWith("/pos")) {
    if (!authenticated) return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    if (token!.scope === "portal")
      return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    return NextResponse.next();
  }

  // Panel admin
  if (pathname.startsWith("/admin")) {
    if (!authenticated) return NextResponse.redirect(loginUrl("/auth/login", pathname + search));
    if (token!.scope === "portal" || !ADMIN_ONLY.includes((token!.role as SessionRole) ?? "")) {
      return NextResponse.redirect(new URL("/pos", req.url));
    }
    return NextResponse.next();
  }

  // Portal de clientes (el login del portal es público)
  if (pathname.startsWith("/portal") && !pathname.startsWith("/portal/auth")) {
    if (!authenticated || token!.scope !== "portal") {
      return NextResponse.redirect(loginUrl("/portal/auth/login", pathname + search));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/pos/:path*", "/admin/:path*", "/portal/:path*"],
};