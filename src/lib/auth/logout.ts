"use client";

import { signOut } from "next-auth/react";

// Cierre de sesión central. Única vía para salir del sistema: elimina las
// credenciales/cookies de NextAuth y redirige al login.
//
// NOTA: la sesión es JWT (estateless), así que "eliminar credenciales" significa
// borrar las cookies de sesión (`next-auth.session-token` y `next-auth.csrf-token`),
// lo que hace `signOut()` de forma automática.
export function logout(callbackUrl = "/auth/login") {
  return signOut({ callbackUrl });
}
