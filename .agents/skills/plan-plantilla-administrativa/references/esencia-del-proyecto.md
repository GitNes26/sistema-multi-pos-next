# Esencia del proyecto de referencia

Proyecto de referencia: **Multi-POS** (monolito Next.js multiempresa y multisucursal). Esta
guía dice qué se hereda, dónde vive y qué se descarta. Las rutas son relativas a la raíz del
repositorio de referencia. **Verifícalas antes de usarlas**; si una cambió, corrige esta guía.

## 1. Fuentes de verdad y orden de autoridad

Se replican como estructura en el proyecto nuevo (con contenido propio):

1. Instrucciones del usuario/entorno.
2. `AGENTS.md`: reglas obligatorias, invariantes, reglas de implementación, verificación y
   entrega, mantenimiento del contexto. Es corto y enruta a las guías.
3. Código, `prisma/schema.prisma` y migraciones.
4. `CONTEXTO_SISTEMA.md` (verdad extensa del dominio) y `docs/agents/*` (guías temáticas).
5. `MEMORY.md`: índice breve de hechos duraderos para reanudar trabajo.
6. `PLAN.md`: solo histórico.

Guías temáticas (`docs/agents/`): `README.md` (router y economía de lectura),
`PAGINAS_Y_ARQUITECTURA.md`, `FORMULARIOS_Y_CRUD.md`, `DISENO_E_INTERACCION.md`,
`DESARROLLO_Y_VERIFICACION.md`. También `PRODUCT.md` (usuarios, propósito, restricciones) y
`DESIGN.md` (tokens y estilo documentado), y `VERSION.md` + `scripts/gcv.mjs` para el flujo
de versión/commit.

Regla viva: *si documentación y código difieren, se comprueba el comportamiento y se corrige
la documentación en la misma tarea*. Se copia como regla al proyecto nuevo.

## 2. Invariantes que SÍ se heredan (adaptados)

- Todo dato de negocio se aísla por el `organizationId` efectivo de la **sesión**; nunca por
  el cuerpo de la petición.
- Autorización = permiso del rol ∩ lo incluido por el plan; se aplica en interfaz **y** servidor.
  Ocultar un botón no autoriza una API.
- `superadmin` opera sin organización solo en funciones globales (plataforma).
- Cálculos y totales críticos se recalculan en servidor; el cliente solo propone.
- Operaciones compuestas son transaccionales e idempotentes cuando hay reintento.
- Lo inactivo no aparece en flujos operativos y su historia se conserva (inactivar, no borrar).
- Nunca exponer secretos/hashes/tokens; solo nombres de variables de entorno.

Se **excluyen** los invariantes de dominio (venta/caja/inventario/pedido/puntos/devoluciones).

## 3. Reglas de implementación que SÍ se heredan

- Reutilizar primero `components/base`, `components/ui`, CRUD genérico y `lib/*/server.ts`.
- Página nueva: autorización y carga inicial en servidor; interacción en un cliente de módulo;
  estados loading/empty/error; navegación y feature gates coherentes.
- Formularios: React Hook Form + Yup + `useFocusInvalid`; `InputGroupField`,
  `FormCombobox`/`OptionSelect`, pickers y `Attachment`; sin `<select>` ni fechas nativas;
  teclado según el dato (`tel`, `numeric`/`decimal`, `email`, `url`, `search`); hora =
  `TimePicker`, fecha = `DatePicker`; `ClearFiltersButton` en toda pantalla con filtros.
- Overlays con `DialogComponent` (header/footer fijos, cuerpo con scroll, bottom sheet en
  teléfono). Nada de modales ad hoc.
- Diseño: tokens semánticos, superficies planas, `ring` antes que sombras, tipografía y
  densidad configurables, animación funcional y `prefers-reduced-motion`; objetivos táctiles
  de 44–48 px; `desk:` = puntero fino (no solo ancho); safe areas con `env(safe-area-inset-*)`
  y `dvh`.
- API: autenticar → resolver organización efectiva → permiso/plan → validar → lógica en
  `src/lib` → responder sin filtrar datos.
- Prisma: migración versionada + seeder idempotente; nunca `db push`/reset en producción.
- Respetar cambios ajenos del worktree; commit/push solo cuando se pida (flujo `gcv`).
- Mantener el contexto: cuando cambia una decisión duradera se actualizan `CONTEXTO_SISTEMA.md`,
  la guía temática y `MEMORY.md` (solo hechos duraderos, sin credenciales ni resultados puntuales).

## 4. Mapa de archivos canónicos

### Núcleo obligatorio (se lleva)

| Área | Archivos de referencia |
|---|---|
| Layout raíz, manifest, error | `src/app/layout.tsx`, `src/app/globals.css`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/manifest.ts`, `src/app/icon.tsx` |
| Auth y sesión | `src/lib/auth/options.ts` (NextAuth, JWT con `scope`, `permissions`, `planDenied`), `src/lib/auth/org-context.ts` (`effectiveOrgId`), `src/lib/auth/permissions.ts`, `src/lib/auth/permission-keys.ts`, `src/lib/auth/server-permissions.ts`, `src/lib/auth/users.ts`, `src/lib/auth/mail.ts`, `src/middleware.ts` |
| Pantallas de acceso | `src/app/(auth)/*`, `src/app/auth/*`, `src/components/auth/*` (login, registro, recuperación, cambio de contraseña, `SessionGuard`) |
| Planes y acceso por plan | `src/lib/billing/plan-permissions.ts`, `src/lib/billing/subscriptions.ts`, `src/lib/features.ts`, `src/lib/business-modes.ts` (se generaliza a «perfiles de módulo») |
| Menús | `src/lib/menus/server.ts`, `src/lib/menus/client.ts`, `src/lib/nav.ts`, `src/hooks/use-menus.ts`, `src/lib/menu-icons.ts`, `src/app/admin/settings/menus` |
| Shell administrativo | `src/app/admin/layout.tsx`, `src/components/layout/*` (`app-shell`, `app-sidebar`, `app-header`, `bottom-tab-bar`, `navigation-drawer`, `page-header`, `route-transition`, `org-switcher`, `user-menu`, `theme-toggle`, `notifications-bell`, `search-dialog`) |
| Apariencia/tema | `src/components/appearance/*`, `src/lib/appearance.ts`, `src/lib/appearance-apply.ts`, `src/lib/db/app-settings.ts`, `src/stores/theme-store.ts`, `src/providers/*`, `src/app/admin/settings/appearance` |
| Tokens de movimiento | `src/lib/animation-tokens.ts`, clases `.press`, `rise-in`, `fade-in`, easing en `globals.css` |
| Componentes base | `src/components/base/*` (`data-table`, `input-group-field`, `form-combobox`, `date-picker`, `time-picker`, `date-time-picker`, `attachment`, `switch-field`, `segmented-filter`, `status-pill`, `entity-cell`, `row-actions`, `info-field`, `info-tooltip`, `wizard-steps`, `clear-filters-button`, `spinner`, `animated-number`, `quantity-stepper`) |
| Componentes UI (shadcn) | `src/components/ui/*` (`dialog`/`DialogComponent`, `button`, `input` con teclado por tipo, `sheet`, `drawer`, `tabs`, `table`, `skeleton`, `sonner`, etc.) |
| Compartidos | `src/components/shared/{empty-state,error-boundary,back-button,stale-banner,status-pills,role-badge,tooltip-button,swipeable-row,pull-to-refresh}.tsx`, `src/lib/swal.ts` |
| CRUD genérico | `src/lib/crud/{types,modules}.ts`, `src/lib/crud/modules/*`, `src/components/admin/crud/{crud-page,crud-form,crud-config,crud-create-dialog,option-select}.tsx`, `src/app/admin/[module]/page.tsx`, `src/app/api/crud/[module]` |
| Utilidades de formulario | `src/hooks/use-focus-invalid.ts`, `src/lib/input-kind.ts`, `src/lib/date-input.ts`, `src/lib/dates.ts`, `src/lib/utils.ts`, `src/lib/api-helpers.ts`, `src/lib/api.ts` |
| Administración base | `src/app/admin/settings/{users,company,appearance,menus,my-plan,plans,subscriptions,organizations}`, `src/lib/settings/*`, `src/app/admin/profile`, `src/app/admin/onboarding` |
| Notificaciones base | `src/lib/notifications/*`, `src/hooks/use-notifications.ts`, `src/app/api/notifications`, `src/app/admin/notifications` |
| Subida de archivos | `src/lib/uploads*`, `src/app/api/upload`, `src/app/api/uploads` |
| BD y entrega | `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/seeders/production.ts`, `scripts/{gcv,version-bump,db-reset,test-env,test-safety}.mjs`, `tests/unit/*`, `tests/permissions.test.mjs`, `Dockerfile`, `docker-compose.yml`, `.husky`, `eslint.config.mjs` |

### Capacidades opcionales (se activan según el brief)

Importar/exportar Excel (`src/lib/excel`, `exceljs`), PDF/tickets (`src/lib/pdf.ts`),
reportes (`src/components/admin/reports`, `recharts`), mapas/GPS (`address-map-picker`,
`gps-picker`, Leaflet), escáner QR (`qr-scanner`), push (`use-push-subscription`,
`web-push`), tiempo real SSE (`src/lib/kds/live.ts` y `src/hooks/use-orders-live.ts` como
patrón de pub/sub por organización), wizards/guías (`src/components/shared/guide`,
`wizards`), PWA, planes de suscripción y portal de usuarios finales (`src/app/portal`).

### Adaptadores de dominio / excluir

Todo lo de punto de venta y operación comercial: `src/app/{pos,kds,repartidor,reservar,
reservaciones,agenda,portal}`, `src/components/{pos,kds,driver,portal,reservations,agenda}`,
`src/lib/{pos,orders,sales,returns,inventory,purchasing,promotions,payments,credit,payroll,
reservations,tables,agenda,catalog,products,portal}`, y los modelos de BD asociados. No
copiar `.env*`, `tmp/`, `output/`, `test-results/`, `public/` con marca, volcados ni uploads.

## 5. Vocabulario a neutralizar

Al generar el proyecto nuevo sustituye: «organización» puede seguir (o ser «iglesia», «empresa»,
«cliente»); «sucursal/Location» → unidad organizativa del dominio (sede, congregación, ruta,
departamento) o se elimina si no aplica; «businessMode» → perfil de módulos del producto;
«cajero/mesero/gerente» → roles del dominio. Conserva `owner`, `admin`, `superadmin` como
roles de plataforma/propietario.
