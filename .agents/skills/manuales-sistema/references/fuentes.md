# Fuentes por entregable

## Contexto común

1. `docs/contexto-actual.md`
2. `src/lib/business-modes.ts`
3. `src/lib/features.ts`
4. `src/lib/nav.ts`
5. `prisma/schema.prisma`
6. rutas reales bajo `src/app`

## Usuario y vendedor

- `docs/manual-usuario/`
- `docs/capacitacion/guion-demo.md`
- componentes de POS, portal, agenda, reservaciones, KDS y wizards;
- seed demo y cuentas vigentes en `prisma/seeders/demo.ts`.

## Técnico

- `package.json`, `next.config.ts`, `src/middleware.ts`;
- `prisma/seed.ts`, migraciones y scripts;
- `.env.example`, Dockerfile, docker-compose y configuración de Dokploy;
- pruebas en `tests/` y configuración Playwright.

## Crear o modificar módulos

- un CRUD representativo en `src/lib/crud`, `src/app/api/crud` y
  `src/components/admin/crud`;
- permisos, navegación y feature flags;
- guards de rutas especializadas;
- convenciones de formularios y exportaciones.
