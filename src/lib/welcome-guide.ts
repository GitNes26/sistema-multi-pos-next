// Preferencia de la guía de bienvenida del dashboard (cerrar / volver a mostrar).
// Se guarda por organización en localStorage; el menú de usuario puede
// restaurarla y la tarjeta reacciona al evento sin recargar.

export const WELCOME_GUIDE_DISMISS_PREFIX = "multi-pos-welcome-dismissed";

/** Evento que pide a la tarjeta de bienvenida reaparecer (si está montada). */
export const WELCOME_GUIDE_RESTORE_EVENT = "multipos:restore-welcome-guide";

export function welcomeGuideDismissKey(orgId?: string | null): string {
  return orgId
    ? `${WELCOME_GUIDE_DISMISS_PREFIX}:${orgId}`
    : WELCOME_GUIDE_DISMISS_PREFIX;
}

/** Borra la preferencia para que la guía vuelva a mostrarse. */
export function clearWelcomeGuideDismissal(orgId?: string | null): void {
  try {
    localStorage.removeItem(welcomeGuideDismissKey(orgId));
  } catch {
    /* localStorage no disponible */
  }
}

/** Pide a la guía reaparecer en la página actual (si está montada). */
export function requestWelcomeGuideRestore(): void {
  try {
    window.dispatchEvent(new Event(WELCOME_GUIDE_RESTORE_EVENT));
  } catch {
    /* entorno sin window */
  }
}
