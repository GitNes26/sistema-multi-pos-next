---
name: manual-usuario
description: "Regenera y actualiza el manual de usuario de Multi-POS desde el código real del sistema. Úsala cuando el sistema cambie (nuevas pantallas, roles, tipos de negocio, reglas) para mantener el manual sincronizado."
---

# /manual-usuario

Regenera y valida el **manual de usuario** (`docs/manual-usuario/`) a partir del estado
actual del código. El manual está escrito para usuarios finales sin conocimientos técnicos
(gerentes, cajeros, meseros, clientes), en español LATAM, con tono amable y "tú".

## Fuentes de verdad (léelas SIEMPRE, en este orden)

1. `docs/manual-usuario/00-contexto-sistema.md` — el contexto técnico interno. Si el
   sistema cambió, **actualízalo primero** antes de tocar el manual.
2. `src/lib/business-modes.ts` — nombre, descripción y wizards de cada tipo de negocio
   (es lo que el usuario ve al elegir).
3. `src/lib/features.ts` — qué features/páginas activa cada tipo de negocio
   (`FEATURE_FLAGS` + `NAV_HREF_TO_FEATURE`).
4. `src/lib/nav.ts` — secciones reales del panel y sus permisos.
5. `prisma/schema.prisma` — modelos y estados (`Appointment`, `Reservation`, `CreditPolicy`,
   `TableReservation`, `Order`, enums de status, tipos de producto).
6. `src/lib/pos/config.ts` — métodos de pago, estados de pedido, reglas (IVA, supervisor,
   lealtad).
7. Rutas reales: `src/app/admin/**`, `src/app/pos`, `src/app/kds`, `src/app/agenda`,
   `src/app/reservaciones`, `src/app/portal/**`, `src/app/reservar/**`.
8. Componentes clave al dudar de una acción concreta: `src/components/pos/*.tsx`,
   `src/components/portal/checkout-client.tsx`, `src/components/admin/credits/credits-manager.tsx`,
   `src/components/agenda/cita-dialogs.tsx`, `src/components/reservations/*`.

## Metodología (fases, en orden)

### Fase 0 — Re-analizar el sistema
- Recorre las fuentes de verdad y anota qué cambió desde la última revisión
  (la fecha de revisión está en `00-contexto-sistema.md`).
- Actualiza en `00-contexto-sistema.md`: módulos, roles, flujos, dependencias, reglas
  críticas, **puntos faltantes** (cosas que el flag promete pero no tienen UI: no
  documentarlas como disponibles) y redundancias excluidas.
- Regla de oro: **el manual describe lo que el usuario ve y puede hacer**, no lo que el
  código permite en teoría.

### Fase 1 — Estructura
- El índice vive en `docs/manual-usuario/README.md`. Si hay capítulos nuevos o renombrados,
  actualiza el índice antes de redactar.
- Convenciones fijas: pasos numerados, negritas para lo visible en pantalla,
  `[IMAGEN: …]` como marcador de capturas, diagramas `mermaid` para procesos clave,
  "tú" consistente.

### Fase 2 — Redacción/actualización
- Actualiza solo los capítulos afectados por los cambios detectados; no reescribas
  capítulos sanos.
- Cada acción debe responder: qué ve, dónde está el botón, qué pasa al pulsarlo, qué
  recibe como resultado.
- Por tipo de negocio cubre siempre: roles, pantallas, acciones paso a paso y eventos
  típicos de la jornada.

### Fase 3 — Validación
- **Anti-promesa:** para cada acción descrita, confirma en el código que existe la UI
  (botón/pantalla) que la realiza. Ejemplos de trampas pasadas: "abonar en caja" (no hay
  UI: se hace en panel), "crédito en el checkout del portal" (el checkout solo ofrece
  efectivo/línea/tarjeta), "contratos de renta" (flag sin página).
- **Coherencia cruzada:** lo mismo que el panel promete debe aparecer igual en POS y
  portal (estados de pedido, métodos de pago, lealtad).
- **Sin tecnicismos:** busca y reemplaza API, endpoint, servidor, base de datos, JSON,
  id, flag → pantalla, sistema, aviso, registro, opción.
- **Discrepancias:** si el código contradice el manual, gana el código; corrige el manual
  y, si es un defecto del producto, repórtalo en el resumen (no lo arregles aquí).

### Fase 4 — Entrega
- Reporta: qué capítulos cambiaron, qué se detectó nuevo/faltante y qué quedó pendiente
  de decisión del usuario (p. ej. capturas pendientes marcadas con `[IMAGEN: …]`).
- Opcional: regenerar la explicación visual del manual en `.freebuff/` con `/explain`
  y registrarla en el Preview.

## Definición de terminado

- `00-contexto-sistema.md` actualizado con nueva fecha de revisión.
- Índice (`README.md`) sin enlaces rotos hacia los capítulos.
- Cero tecnicismos prohibidos y cero acciones sin UI que las respalde.
- Capturas pendientes marcadas con `[IMAGEN: …]` listadas en el resumen.
