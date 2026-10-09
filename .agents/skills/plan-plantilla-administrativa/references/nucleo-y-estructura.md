# Núcleo técnico y estructura del starter

Qué contiene la plantilla, cómo se organiza y cuáles son las tablas base. Todo es
transversal: ningún nombre debe aludir al punto de venta.

## 1. Stack que se conserva

Next.js (App Router) + React + TypeScript · Tailwind CSS v4 + shadcn/ui (Radix/Base UI) ·
Prisma + MySQL · NextAuth (JWT) · React Hook Form + Yup · TanStack Table/Query ·
framer-motion · lucide-react · sonner + SweetAlert (`src/lib/swal.ts`) · Playwright/`node:test`.
Si el brief exige otro motor o framework, es una decisión abierta: regístrala antes de
construir y adapta migraciones/seed.

## 2. Estructura de carpetas del starter

```text
.
├─ AGENTS.md  MEMORY.md  CONTEXTO_SISTEMA.md  PRODUCT.md  DESIGN.md  VERSION.md  README.md
├─ docs/agents/            README · PAGINAS_Y_ARQUITECTURA · FORMULARIOS_Y_CRUD ·
│                          DISENO_E_INTERACCION · DESARROLLO_Y_VERIFICACION
├─ prisma/                 schema.prisma · migrations/ · seed.ts · seeders/{production,demo}.ts
├─ scripts/                gcv · version-bump · db-reset · test-env · test-safety
├─ tests/                  unit/*.test.mjs · permissions.test.mjs · e2e/
└─ src/
   ├─ middleware.ts        protección de rutas por scope/rol/plan
   ├─ app/
   │  ├─ layout.tsx · globals.css · error.tsx · global-error.tsx · manifest.ts · icon.tsx
   │  ├─ (auth)/ · auth/   login, registro, recuperación, cambio de contraseña
   │  ├─ admin/            layout.tsx (shell) · page.tsx (panel) · [module]/page.tsx (CRUD)
   │  │  └─ settings/      users (miembros, roles, permisos, invitaciones) · company · appearance · menus · my-plan ·
   │  │                    plans · subscriptions · organizations (plataforma)
   │  ├─ admin/<dominio>/  una carpeta por módulo con página dedicada
   │  └─ api/              auth · crud/[module] · settings · notifications · upload(s) · <dominio>
   ├─ components/
   │  ├─ ui/               primitivos shadcn (dialog, button, input, sheet, tabs…)
   │  ├─ base/             componentes canónicos del sistema (formularios, tabla, filtros)
   │  ├─ layout/           shell, sidebar, header, tab bar móvil, page-header, transiciones
   │  ├─ shared/           empty-state, error-boundary, status pills, back-button…
   │  ├─ appearance/       sincronización de tema, splash, formulario de apariencia
   │  ├─ auth/             formularios de acceso y guardas de sesión
   │  └─ admin/<módulo>/   clientes de módulo (interacción) + crud/ (CrudPage, CrudForm…)
   ├─ hooks/               use-permission(s) · use-focus-invalid · use-menus · use-media-query …
   ├─ lib/
   │  ├─ auth/             options · org-context · permissions · permission-keys · users · mail
   │  ├─ billing/          plan-permissions · subscriptions
   │  ├─ crud/             types · modules.ts (registro) · modules/<entidad>.ts
   │  ├─ menus/ · settings/ · notifications/ · db/ · uploads/
   │  ├─ <dominio>/        server.ts (Prisma + transacciones) y reglas puras (*.ts sin Prisma)
   │  └─ animation-tokens.ts · input-kind.ts · date-input.ts · features.ts · swal.ts · utils.ts
   ├─ providers/ · stores/ · types/
```

Capas: `page/layout (server) → cliente de módulo → /api route → lib/<dominio>/server → Prisma`;
las reglas puras viven aparte para probarse sin base de datos.

## 3. Base de datos mínima (tablas base)

Estas tablas bastan para construir «un sistema de lo que sea». Los nombres actuales entre
paréntesis son los del proyecto de referencia. Lo marcado «propuesta» **no existe aún** en la
referencia: confírmalo y créalo solo si el brief lo pide.

| Grupo | Tabla (modelo) | Propósito / campos clave |
|---|---|---|
| Identidad | `users` (`User`) | `email` único, `passwordHash`, `fullName`, `avatarUrl`, `phone`, `isActive`, `emailVerified`, `activationRequired`, `legalAcceptedAt/legalVersion`, `isSuperadmin`, tokens de recuperación hasheados, `authVersion` (invalida sesiones), `lastOrganizationId` |
| Identidad | `profiles` (`Profile`) | 1:1 con usuario (mismo id); `preferences` JSON |
| Tenancy | `organizations` (`Organization`) | `name`, `ownerId`, `currency`, `isBlocked/blockedReason`, perfil de módulos (`businessMode` → generalizar), timestamps. Quitar campos de dominio (puntos, pasarela, cierre de tienda…) |
| Tenancy | `memberships` (`Membership`) | usuario↔organización, `role` (enum de sistema) y `roleId` (rol configurable); único por (usuario, organización) |
| Tenancy | `company_profiles` (`CompanyProfile`) | marca/razón social/logo/contacto de la organización |
| Acceso | `permissions` (`Permission`) | catálogo: `key` (`modulo.accion`), `module`, `action`, `label` |
| Acceso | `roles` (`Role`) | `organizationId` nulo = rol de sistema; `isSystem`, `permissionsEdited` (el seeder no reescribe roles ajustados), perfil de módulos opcional |
| Acceso | `role_permissions` (`RolePermission`) | rol↔permiso con `allowed`; único (organización, rol, permiso) |
| Acceso | `user_invitations` (`UserInvitation`) | invitación por correo con rol y estado |
| Navegación | `menus` (`Menu`) | árbol (`parentId`), `type` sección/ítem, `label`, `icon` (lucide), `href`, `permissionKey`, `sortOrder`, `isActive` |
| Apariencia | `app_settings` (`AppSettings`) | por organización: `primaryHue`, `accentHue`, `theme`, `fontFamily`, `fontScale`, `cardSize`, `density`, `borderRadius`, `sidebarStyle`, `surfaceTone` |
| Planes (opcional) | `subscription_plans`, `organization_subscriptions`, `subscription_payments` | planes con `features`/`permissions` (JSON; `null` = sin restricción), límites y vigencia |
| Avisos | `notifications` (`Notification`) | `kind`, `title`, `body`, `severity`, `link`, `recipientUserId`, `readAt`, `metadata` |
| Avisos (opcional) | `push_subscriptions` | suscripciones web push |
| Estructura org. (opcional) | `locations` (`Location`) + `employees` / `employee_positions` | unidad organizativa y personal; renombrar al dominio (sede, congregación, ruta, área) o excluir |
| Auditoría (propuesta) | `audit_logs` | `organizationId`, `userId`, `entity`, `entityId`, `action`, `diff` JSON, `ip`, `createdAt`; la referencia usa historiales por entidad, no una bitácora global |
| Archivos (opcional) | `attachments` (propuesta) | metadatos de archivos subidos si el dominio los liga a entidades; la referencia guarda URLs en cada entidad |

Convenciones de modelo: ids `cuid`, `createdAt/updatedAt`, `organizationId` en toda tabla de
negocio con índice, `isActive` para inactivar, decimales monetarios `Decimal(12,2)`, relaciones
con `@@index`/`@@unique` tenant, `@@map` en minúsculas con guiones bajos.

Seed (`prisma/seeders/production.ts`): idempotente (`upsert`), crea catálogo de permisos desde
`permission-keys.ts`, roles de sistema, menús del sistema con ids fijos, planes por defecto y
el superadmin desde variables de entorno. Cuando se agrega un permiso nuevo, respalda **una
sola vez** (según «el permiso aún no existía») a roles propios y planes que ya tenían el
permiso del que se desprende. Demo opt-in (`SEED_DEMO=true` y `NODE_ENV != production`).

## 4. Identidad, tenancy y sesión

- NextAuth con credenciales y JWT; la sesión incluye `id`, `role`, `roleName`,
  `organizationId`, `activeOrganizationId`, `permissions`, `planDenied`, `scope` (`app` o
  `portal`, el segundo solo si el producto tiene usuarios finales).
- `effectiveOrgId(session)` resuelve la organización activa; es la **única** fuente del tenant.
- Superadmin sin organización solo en la sección Plataforma (organizaciones, planes,
  suscripciones, menús). Para datos de negocio necesita organización activa válida.
- `authVersion` invalida sesiones tras cambio de contraseña o desactivación.
- Multi-organización: `lastOrganizationId` + `OrgSwitcher` si el producto lo requiere.

## 5. Permisos, roles, plan y menús

- Catálogo único en `src/lib/auth/permission-keys.ts` (`modulo.accion`, con etiqueta en
  español, `superAdminOnly` opcional). Agrupado por módulo para los editores de roles y planes.
- Permiso efectivo = permiso del rol ∩ permisos del plan (`planDenied`). Roles de sistema
  parten del seeder (`SYSTEM_ROLES`); el superadmin puede ajustarlos (`permissionsEdited`) y
  cada organización crea roles propios.
- Defensa en profundidad: middleware (rutas/plan) → página (`hasPermission` + `redirect`) →
  API (mismo permiso) → UI (oculta lo no permitido). Nunca confiar solo en el menú.
- Menús: ítems de BD filtrados en servidor por feature, rol y plan; `nav.ts` es fallback.
  Cada ítem lleva `permissionKey`; las secciones vacías no se muestran.
- Rol «todo en uno» para equipos pequeños: define un rol de sistema compartido con la unión de
  los permisos operativos de los roles inferiores al gerente (en la referencia,
  «Trabajador completo», `system-all-rounder`). Inclúyelo en el starter si el dominio tiene
  más de un rol operativo.

## 6. API y módulos CRUD

Orden obligatorio de un route handler: sesión → scope → `effectiveOrgId` → permiso/plan →
validar entrada (límites, enums, ids) → consultar siempre con `organizationId` y validar
relaciones cruzadas → lógica en `lib/<dominio>/server.ts` → errores esperados 4xx con mensaje
accionable.

Catálogos convencionales se registran en `src/lib/crud/modules.ts` con
`CrudRegistryEntry { module, title, description, permissionView, permissionManage,
permissionDelete? }` y un `CrudModule<T>` (`list/get/create/update/remove/restore`). La UI se
describe en `components/admin/crud/crud-config.ts` (campos, tipos, iconos, `optionsModule`,
`showIf`). `/admin/[module]` y `/api/crud/[module]` ya los sirven; solo hay página dedicada
cuando el flujo no es un catálogo.

## 7. Scripts, pruebas y entrega

- `package.json`: `dev`, `build`, `typecheck`, `lint`, `test` (node:test sobre
  `tests/unit/*.test.mjs`), `db:generate/migrate/seed/reset`, `gcv` (commit + versión).
- Pruebas: reglas puras en `tests/unit`; permisos en `tests/permissions.test.mjs`; entornos de
  integración/E2E aislados con barreras (`scripts/test-env.mjs`, `test-safety.mjs`).
- Entrega: `Dockerfile`, `docker-compose.yml`, husky, ESLint. Producción usa
  `prisma migrate deploy`, nunca `db push`.
- `VERSION.md` + `gcv` solo si el proyecto nuevo adopta ese flujo; de lo contrario, omítelos.

## 8. Orden de construcción por lotes

1. Esqueleto: `create-next-app`/copia limpia, dependencias, ESLint, Tailwind, shadcn, scripts.
2. Prisma: modelos base §3, migración inicial, seeder de producción, superadmin por env.
3. Auth: NextAuth, `org-context`, `permissions`, middleware, pantallas de acceso.
4. Shell: layout administrativo, sidebar/header/tab bar, tema y apariencia, menús desde BD.
5. Componentes `ui` y `base`, `DialogComponent`, `swal`, utilidades de formulario.
6. CRUD genérico + administración base (usuarios con roles/permisos e invitaciones, empresa, apariencia, menús,
   perfil, notificaciones).
7. Primer módulo de dominio (receta en `crear-proyecto-nuevo.md` §4).
8. Documentación del proyecto nuevo y pruebas; verificación final.
