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
