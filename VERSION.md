# VERSIONES — Multi-POS

> Registro cronológico de versiones y progreso del sistema.
> Este archivo se actualiza **automáticamente** en cada commit (hook de Git).

## Esquema de versionado

Formato: `MAJOR.MINOR.PATCH.REVISION` (X.X.X.X)

| Nivel | Nombre | ¿Qué abarca? |
|-------|--------|--------------|
| 1º | Major | Cambios rompedores o re-arquitectura (rompen compatibilidad) |
| 2º | Minor | Nuevas funcionalidades compatibles con lo anterior |
| 3º | Patch | Corrección de bugs o mejora de funcionalidad existente |
| 4º | Revision | Ajustes finos: UI/UX, estilos, documentación, refactor |

> Al subir un dígito, los dígitos a su derecha se reinician a `0`.

## Prefijos de commit

| Prefijo | Nivel que sube | Ejemplo |
|---------|----------------|---------|
| `breaking:` / `major:` | Major (1º) | `breaking: migré la base de datos` |
| `feat:` / `feature:` | Minor (2º) | `feat: agregué el portal de clientes` |
| `fix:` / `perf:` | Patch (3º) | `fix: corregí el bug del QR` |
| `ui:` / `ux:` / `style:` | Revision (4º) | `ui: rediseñé la landing page` |
| `docs:` / `chore:` / `refactor:` / `test:` / `build:` / `ci:` | Revision (4º) | `docs: actualicé la documentación` |

---

## Historial

### [0.12.5.0] — 2026-08-28
- **Tipo:** `fix` (Patch)
- fix: se resolvieron que no aplica promociones en el POS y en el portal, politicas de envio

### [0.12.4.0] — 2026-08-28
- **Tipo:** `fix` (Patch)
- fix:se agrego pie y logo al ticket y correxion de politicas, ademas guardamos para ver una implementacion de impeccable

### [0.12.3.1] — 2026-08-28
- **Tipo:** `fix` (Patch)
- fix: agregar logo y pie de ticket al recibo y PDF, fixear tipo ticketFooter en store

### [0.12.3.0] — 2026-08-28
- **Tipo:** `fix` (Patch)
- fix:se mejoror el diseño del dialog de devolución y que ligue correctamente las politicas de envio
### [0.12.2.1] — 2026-08-28
- **Tipo:** `ux` (Revision)
- ux: se mejoro los permisos y las promos con notificaciones

### [0.12.2.0] — 2026-08-28
- **Tipo:** `fix` (Patch)
- fix: se corrgiieron detalles de la edicion del producto para que actualice productos cartesianos y los usuarios se les asigne todos los roles creados segun su empresa y los globales

### [0.12.1.0] — 2026-08-27
- **Tipo:** `fix` (Patch)
- fix: se corrgiieron detalles de los formularios para que saliera el icono correcto, y botones para la parte de Devoluciones y cambios

### [0.12.0.1] — 2026-08-27
- **Tipo:** `chore` (Revision)
- se hicieron cambios de los inputs a los correctos, y se agrego horario quebrado al horario y componente

### [0.12.0.0] — 2026-08-27
- **Tipo:** `feat` (Minor)
- feat(schedule-editor): real-time legend + TimePicker component

### [0.11.1.1] — 2026-08-27
- **Tipo:** `chore` (Revision)
- semodifco el Dockerfile para que funcione

### [0.11.1.0] — 2026-08-27
- **Tipo:** `fix` (Patch)
- fix(deploy): remove duplicate CMD in Dockerfile + fix 'module' variable name

### [0.11.0.1] — 2026-08-26
- **Tipo:** `ui` (Revision)
- ui: mejora de diseños y detalles corregidos de los iconos en los inputs

### [0.11.0.0] — 2026-08-26
- **Tipo:** `feat` (Minor)
- feat(crud-form): refactor to use standardized components

### [0.10.0.0] — 2026-08-26
- **Tipo:** `feat` (Minor)
- feat(switch-field): optional icon prop for inline icon+label pattern

### [0.9.1.0] — 2026-08-26
- **Tipo:** `fix` (Patch)
- fix(inputs): md:pl-9 on all Input with leftIcon/leftAddon for desktop consistency

### [0.9.0.0] — 2026-08-26
- **Tipo:** `feat` (Minor)
- feat(menus): icon preview in combobox, create permissions, SwitchField component

### [0.8.0.0] — 2026-08-26
- **Tipo:** `feat` (Minor)
- feat(Dockerfile): DB_RESET=true env var for conditional db reset

### [0.7.0.4] — 2026-08-26
- **Tipo:** `chore` (Revision)
- se agrego el flujo de devoluciones y cambios, correxion de errores de formulario, y se intenta unificar los inputs, vamos a resetear la BD

### [0.7.0.3] — 2026-08-26
- **Tipo:** `docs` (Revision)
- docs(Dockerfile): clarify db reset is manual, not automatic

### [0.7.0.2] — 2026-08-26
- **Tipo:** `chore` (Revision)
- chore: add db:reset script (force-reset + seed)

### [0.7.0.1] — 2026-08-26
- **Tipo:** `refactor` (Revision)
- refactor(forms): standardize all form inputs with InputGroupField + icons + validation

### [0.7.0.0] — 2026-08-26
- **Tipo:** `feat` (Minor)
- feat(address): reusable AddressField component with GPS everywhere

### [0.6.0.0] — 2026-08-26
- **Tipo:** `feat` (Minor)
- feat(schedule): reusable ScheduleEditor component + structured branch hours

### [0.5.2.0] — 2026-08-26
- **Tipo:** `fix` (Patch)
- fix(products): delete FK cleanup + identical create/edit form

### [0.5.1.0] — 2026-08-26
- **Tipo:** `fix` (Patch)
- fix(crud): nested dialogs close only inner, not all parents

### [0.5.0.0] — 2026-08-25
- **Tipo:** `feat` (Minor)
- feat(returns): sistema completo de devoluciones/cambios

### [0.4.2.1] — 2026-08-25
- **Tipo:** `docs` (Revision)
- docs: se actualizo el Dockerfile para actualizar DB

### [0.4.2.0] — 2026-08-25
- **Tipo:** `fix` (Patch)
- fix(docker): use prisma db push instead of migrate deploy for schema sync

### [0.4.1.1] — 2026-08-25
- **Tipo:** `ui` (Revision)
- ui: se intenta corregir al 100 el inventario, se agregaron campos de politicas de entrega

### [0.4.1.0] — 2026-08-25
- **Tipo:** `fix` (Patch)
- fix(pdf): column overflow + fillColor state leak in reports

### [0.4.0.0] — 2026-08-25
- **Tipo:** `feat` (Minor)
- feat(inventory): DataTable migration + dedup bulk + stock formatting + PDF fixes

### [0.3.0.0] — 2026-08-24
- **Tipo:** `feat` (Minor)
- feat(portal): mejoras en el proceso de pago + corrección del informe PDF pendiente

### [0.2.1.1] — 2026-08-24
- **Tipo:** `ui` (Revision)
- ui: se rediseño la landingPage

### [0.2.1.0] — 2026-08-24
- **Tipo:** `chore` (Revision)
- Inicialización del registro de versiones.
