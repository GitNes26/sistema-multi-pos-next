"use client";

import { GuideCoach } from "./guide-coach";

// FASE — Provider de guías inmersivas. Se monta una vez en el layout del panel
// (fuera de las páginas que cambian) para que la guía sobreviva la navegación
// entre rutas y pueda esperar a que cada elemento aparezca en pantalla.
export function GuideProvider() {
  return <GuideCoach />;
}