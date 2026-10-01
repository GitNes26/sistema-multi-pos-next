# Páginas, arquitectura y scaffolding

## Capas esperadas

```text
page/layout (server) → feature client → /api route → lib/<dominio>/server → Prisma
                                      ↘ reglas puras reutilizables
```

- La página resuelve sesión, organización, acceso y datos iniciales cuando sea útil.
- El componente cliente contiene interacción, query/mutation y estado visual, no reglas contables.
- El route handler autentica y autoriza antes de leer input; delega la operación de dominio.
- `src/lib/<dominio>/server.ts` valida pertenencia tenant y concentra transacciones.
- Cálculos puros viven en archivos sin Prisma para poder probarse unitariamente.

## Crear una página administrativa

1. Confirma si ya existe un módulo en `src/lib/crud/modules.ts`. Si es catálogo convencional, extiende el CRUD genérico y evita otra tabla/interfaz.
2. Define feature/mode/permission y añade navegación canónica (`SYSTEM_MENUS` y fallback `src/lib/nav.ts` cuando corresponda).
3. En `page.tsx`, protege la superficie y pasa solo datos serializables.
4. Compón con `PageHeader`, filtros compartidos, `DataTable`, estados skeleton/empty/error y acciones mediante `RowActions`.
5. Mantén filtros relevantes en query string para deep links y notificaciones.
6. En móvil, deja que `DataTable` use cards; no dupliques una segunda lista sin necesidad.
7. Agrega `data-guide` únicamente si la pantalla participa en un wizard/guía.

## Crear una API

Orden obligatorio:

1. `getServerSession(authOptions)`.
2. Rechazar scope incorrecto.
3. `effectiveOrgId(session)`; global solo cuando la función sea realmente global.
4. `hasPermission`/`assertPermission`, incluyendo `planDenied`.
5. Parsear y validar límites, enums e IDs.
6. Consultar siempre con `organizationId`; validar relaciones cruzadas.
7. Ejecutar lógica/transacción de dominio.
8. Responder errores esperados con 4xx y mensaje accionable; errores internos sin datos sensibles.

No copies el `organizationId` enviado por el navegador como filtro de autoridad. No hagas cálculos financieros finales en el route handler si ya existe un motor de dominio.

## Server y client components

- Prefiere Server Component para shell, autorización y primera carga.
- Añade `"use client"` en la frontera mínima que necesita hooks o eventos.
- Evita importar módulos `server.ts`, Prisma, secrets o Node APIs desde cliente.
- Los datos con `Decimal`, `Date` o enums deben normalizarse antes de cruzar la frontera.

## Navegación, features y planes

- `src/lib/features.ts` decide módulos por `BusinessMode`.
- `src/lib/nav.ts` es fallback; el menú normal viene de BD y se filtra en servidor.
- Un enlace visible requiere feature activa, permiso de rol y permiso incluido en plan.
- La página y la API repiten la autorización; el menú nunca es la barrera de seguridad.
- Rutas solo-superadmin viven en la sección Plataforma y no dependen de una empresa activa salvo que operen datos tenant.

## Operaciones entre dominios

Antes de mutar pregunta qué libros afecta: caja, venta, pedido, inventario/receta, crédito, puntos, promociones, notificaciones, reportes. Si dos efectos representan una sola acción empresarial, deben compartir transacción o una estrategia idempotente explícita.

No borres historia para “corregir” una entidad activa. Usa estado/inactivación y conserva snapshots descriptivos en partidas históricas.
