# ═══════════════════════════════════════════════════════════════════════════════

# PLAN MAESTRO DE DESARROLLO — SISTEMA MULTI-POS

# ═══════════════════════════════════════════════════════════════════════════════

# 

# Stack: Next.js 15 | MySQL | Prisma | NextAuth v4 | React

# TailwindCSS v4 | shadcn/ui | Motion | Zustand | TanStack Query

# 

# Cada ítem lleva ✅ cuando se implementa completamente.

# Cuando TODOS los subpuntos/viñetas de un punto padre ya están completos,

# marca también ese punto padre con ✅ (se propaga en todos los niveles).

# Si un punto padre queda completo al terminar sus hijos, márcalo igualmente.

# Orden: por FASES, dentro de cada fase por MÓDULOS.

# Hosting: VPS Hostinger + Dokploy

# ═══════════════════════════════════════════════════════════════════════════════

---

## TABLA DE CONTENIDO

1. [Resumen del Sistema](#1-resumen-del-sistema)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitectura General](#3-arquitectura-general)
4. [Estructura de Carpetas](#4-estructura-de-carpetas)
5. [Base de Datos (Schema MySQL)](#5-base-de-datos)
6. [Relaciones y Jerarquía](#6-relaciones-y-jerarquía)
7. [Autenticación y Autorización](#7-autenticación-y-autorización)
8. [Sistema de Apariencia](#8-sistema-de-apariencia)
9. [FASE 0 — Infraestructura](#fase-0--infraestructura-y-configuración-base) ✅
10. [FASE 1 — Base de Datos](#fase-1--base-de-datos) ✅
11. [FASE 2 — Autenticación](#fase-2--autenticación-y-autorización) ✅
12. [FASE 3 — Apariencia](#fase-3--sistema-de-apariencia) ✅
13. [FASE 4 — Componentes Base](#fase-4--componentes-base) ✅
14. [FASE 5 — Layout y Navegación](#fase-5--layout-y-navegación) ✅
15. [FASE 6 — POS](#fase-6--punto-de-venta) ✅
16. [FASE 7 — Catálogos CRUD](#fase-7--catálogos-cruds) ✅
17. [FASE 8 — Inventario](#fase-8--inventario) ✅
18. [FASE 9 — Ventas e Historial](#fase-9--ventas-e-historial) ✅
19. [FASE 10 — Reportes](#fase-10--reportes-y-analytics) ✅
20. [FASE 11 — Notificaciones SSE](#fase-11--notificaciones-sse) ✅
21. [FASE 12 — Pedidos y Preparación](#fase-12--pedidos-y-preparación) ✅
22. [FASE 13 — Portal de Clientes](#fase-13--portal-de-clientes) ✅
23. [FASE 14 — Permisos](#fase-14--sistema-de-permisos) ✅
24. [FASE 15 — Ajustes](#fase-15--ajustes-del-sistema) ✅
25. [FASE 16 — Pasarelas de Pago](#fase-16--pasarelas-de-pago) ✅
26. [FASE 17 — Multi-plataforma](#fase-17--multi-plataforma) ✅
27. [FASE 18 — Publicaciones](#fase-18--publicaciones-newsfeed) ✅
28. [FASE 19 — Importación/Exportación](#fase-19--importación-y-exportación) ✅
29. [FASE 20 — Calidad y Pulido](#fase-20--calidad-y-pulido) ✅
30. [Reglas Transversales de UI](#reglas-transversales-de-ui)
31. [Sonidos del Sistema](#sonidos-del-sistema)

---

## 1. RESUMEN DEL SISTEMA

**Multi-POS** es un sistema web multi-sucursal de punto de venta que incluye:

- **Interfaz POS**: Caja táctil optimizada para touch-screen, con escáner de barras, teclado virtual, ticket digital, pagos split (efectivo, tarjeta, wallet, puntos), promociones automáticas.
- **Panel Administrativo**: Dashboard analítico, gestión de productos/inventario/clientes/promociones/sucursales/empleados, reportes con exportación Excel/PDF, configuración del sistema.
- **Portal de Clientes**: Tienda online con catálogo, carrito, pedidos con tracking en tiempo real, favoritos, listas de compra, acumulación de puntos, selección de sucursal (pickup/delivery).
- **Multi-tenant**: Cada empresa tiene sus datos aislados. Empleados y clientes son visibles en TODAS las sucursales de la misma empresa.
- **Real-time**: Notificaciones por SSE, tracking de pedidos, actualización de inventario.
- **Multi-plataforma**: Responsive con comportamiento nativo en móvil (BottomTabBar, NavigationDrawer, safe areas, splash screen).

---

## 2. STACK TECNOLÓGICO


| Capa           | Tecnología                  | Versión     |
| ---------------- | ------------------------------ | -------------- |
| Framework      | Next.js (App Router)         | 15.x         |
| Language       | TypeScript                   | 5.x (strict) |
| Database       | MySQL                        | 8.x          |
| ORM            | Prisma                       | 6.x          |
| Auth           | NextAuth.js                  | v4           |
| State (server) | TanStack Query               | 5.x          |
| State (client) | Zustand                      | 5.x          |
| Forms          | react-hook-form + yup        | latest       |
| CSS            | TailwindCSS                  | v4           |
| UI             | shadcn/ui (Radix UI)         | latest       |
| Animations     | Motion (framer-motion)       | 11.x         |
| Charts         | Recharts                     | latest       |
| Tables         | TanStack Table               | latest       |
| Alerts         | SweetAlert2                  | latest       |
| Export         | xlsx (SheetJS)               | latest       |
| PDF            | @react-pdf/renderer or jsPDF | latest       |
| Icons          | Lucide React                 | latest       |
| Dates          | date-fns                     | latest       |
| Keyboard       | react-simple-keyboard        | latest       |
| Class merge    | clsx + tailwind-merge        | latest       |
| Hosting        | VPS Hostinger + Dokploy      | —           |

---

## 3. ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ POS App  │  │ Admin    │  │ Portal de Clientes   │  │
│  │ (caja)   │  │ Panel    │  │ (tienda online)      │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
│       │              │                    │              │
│  ┌────┴──────────────┴────────────────────┴──────────┐  │
│  │              Zustand + TanStack Query               │  │
│  └────────────────────┬──────────────────────────────┘  │
└───────────────────────┼─────────────────────────────────┘
                        │ HTTP (Server Actions + API Routes)
┌───────────────────────┼─────────────────────────────────┐
│                 NEXT.JS SERVER                           │
│  ┌────────────────────┴──────────────────────────────┐  │
│  │           Server Actions / API Routes              │  │
│  └────────────────────┬──────────────────────────────┘  │
│  ┌────────────────────┴──────────────────────────────┐  │
│  │              Prisma ORM (MySQL)                    │  │
│  └────────────────────┬──────────────────────────────┘  │
│  ┌────────────────────┴──────────────────────────────┐  │
│  │           NextAuth (JWT + Session)                 │  │
│  └────────────────────┬──────────────────────────────┘  │
│  ┌────────────────────┴──────────────────────────────┐  │
│  │     SSE Route Handler (/api/sse/notifications)     │  │
│  └───────────────────────────────────────────────────┘  │
└───────────────────────┼─────────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────────┐
│                   MySQL (VPS)                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  40+ tablas, triggers, indexes                    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 4. ESTRUCTURA DE CARPETAS

```
sistema-multi-pos/
├── public/
│   └── sounds/
│       ├── notification.mp3        # Notificación genérica
│       ├── sale-complete.mp3       # Venta completada
│       ├── error.mp3               # Error/advertencia
│       ├── scan.mp3                # Escaneo de código
│       ├── cash-open.mp3           # Apertura de caja
│       ├── cash-close.mp3          # Cierre de caja
│       ├── order-received.mp3      # Nuevo pedido recibido
│       ├── order-ready.mp3         # Pedido listo para entregar
│       └── low-stock.mp3           # Alerta de stock bajo
│
├── prisma/
│   ├── schema.prisma               # Schema completo (40+ tablas)
│   ├── seed.ts                     # Seeder principal
│   ├── seeders/
│   │   ├── production.ts           # Seed mínimo para producción
│   │   └── demo.ts                 # Seed completo para demo
│   └── migrations/                 # Migraciones generadas
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # Grupo: autenticación
│   │   │   ├── login/
│   │   │   │   └── page.tsx        # Login POS
│   │   │   ├── portal-login/
│   │   │   │   └── page.tsx        # Login Cliente
│   │   │   ├── register/
│   │   │   │   └── page.tsx        # Redirige a WhatsApp
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            # Redirect a /auth/login
│   │   │
│   │   ├── (customer)/             # Grupo: portal de clientes
│   │   │   ├── tienda/
│   │   │   │   └── page.tsx
│   │   │   ├── favoritos/
│   │   │   │   └── page.tsx
│   │   │   ├── mis-listas/
│   │   │   │   └── page.tsx
│   │   │   ├── mis-pedidos/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # Detalle pedido + tracking
│   │   │   ├── carrito/
│   │   │   │   └── page.tsx
│   │   │   ├── checkout/
│   │   │   │   └── page.tsx
│   │   │   ├── perfil/
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            # Home del portal
│   │   │
│   │   ├── (pos)/                  # Grupo: POS y Admin
│   │   │   ├── pos/
│   │   │   │   └── page.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── products/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── categories/
│   │   │   │   └── page.tsx
│   │   │   ├── inventory/
│   │   │   │   ├── page.tsx
│   │   │   │   └── revisions/
│   │   │   │       └── page.tsx
│   │   │   ├── customers/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── employees/
│   │   │   │   └── page.tsx
│   │   │   ├── promotions/
│   │   │   │   └── page.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx    # Detalle pedido
│   │   │   │       └── prepare/
│   │   │   │           └── page.tsx # Preparación
│   │   │   ├── sales/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # Detalle venta/ticket
│   │   │   ├── reports/
│   │   │   │   └── page.tsx
│   │   │   ├── locations/
│   │   │   │   └── page.tsx
│   │   │   ├── cedis/
│   │   │   │   └── page.tsx
│   │   │   ├── cash-registers/
│   │   │   │   └── page.tsx
│   │   │   ├── users/
│   │   │   │   └── page.tsx
│   │   │   ├── roles/
│   │   │   │   └── page.tsx
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx        # Config general
│   │   │   │   ├── appearance/
│   │   │   │   │   └── page.tsx    # Apariencia
│   │   │   │   ├── company/
│   │   │   │   │   └── page.tsx    # Datos empresa
│   │   │   │   ├── menus/
│   │   │   │   │   └── page.tsx    # Gestión de menú dinámico
│   │   │   │   ├── units/
│   │   │   │   │   └── page.tsx    # Unidades de medida
│   │   │   │   └── payments/
│   │   │   │       └── page.tsx    # Pasarelas pago
│   │   │   ├── publications/
│   │   │   │   └── page.tsx
│   │   │   ├── profile/
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx          # Layout con sidebar/header
│   │   │   └── page.tsx            # Dashboard por defecto
│   │   │
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts    # NextAuth handler
│   │   │   ├── menus/
│   │   │   │   └── route.ts        # GET menús filtrados por permisos
│   │   │   ├── sse/
│   │   │   │   └── notifications/
│   │   │   │       └── route.ts    # SSE endpoint
│   │   │   ├── upload/
│   │   │   │   └── route.ts        # File upload
│   │   │   ├── products/
│   │   │   │   └── route.ts
│   │   │   ├── export/
│   │   │   │   ├── products/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── inventory/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── sales/
│   │   │   │   │   └── route.ts
│   │   │   │   └── customers/
│   │   │   │       └── route.ts
│   │   │   └── ...
│   │   │
│   │   ├── layout.tsx              # Root layout (providers, fonts)
│   │   ├── page.tsx                # Landing page
│   │   ├── not-found.tsx
│   │   ├── error.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui (46+ componentes)
│   │   │   ├── accordion.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── aspect-ratio.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   ├── button.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── card.tsx
│   │   │   ├── carousel.tsx
│   │   │   ├── chart.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── command.tsx
│   │   │   ├── context-menu.tsx
│   │   │   ├── data-table.tsx      # TanStack Table wrapper
│   │   │   ├── dialog.tsx
│   │   │   ├── drawer.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── form.tsx
│   │   │   ├── hover-card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── input-group.tsx     # Input con icono + validación
│   │   │   ├── input-otp.tsx
│   │   │   ├── label.tsx
│   │   │   ├── menubar.tsx
│   │   │   ├── navigation-menu.tsx
│   │   │   ├── pagination.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── radio-group.tsx
│   │   │   ├── resizable.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── sonner.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toggle.tsx
│   │   │   ├── toggle-group.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── combobox.tsx        # Select searchable (NUNCA select nativo)
│   │   │   ├── info-tooltip.tsx    # Icono Info en labels
│   │   │   ├── attachment.tsx      # File upload
│   │   │   ├── date-picker.tsx
│   │   │   ├── time-picker.tsx
│   │   │   ├── date-time-picker.tsx
│   │   │   ├── spinner.tsx
│   │   │   └── form-combobox.tsx   # Combobox + label + info + sync + create
│   │   │
│   │   ├── layout/
│   │   │   ├── app-nav.tsx         # Navegador adaptativo (mobile/desktop)
│   │   │   ├── sidebar.tsx         # Desktop sidebar (agrupada)
│   │   │   ├── bottom-tab-bar.tsx  # Móvil bottom nav
│   │   │   ├── navigation-drawer.tsx # Tablet drawer
│   │   │   ├── header.tsx          # Sticky header
│   │   │   ├── notifications-bell.tsx
│   │   │   └── user-dropdown.tsx
│   │   │
│   │   ├── pos/
│   │   │   ├── product-grid.tsx
│   │   │   ├── ticket-panel.tsx
│   │   │   ├── payment-dialog.tsx
│   │   │   ├── virtual-keyboard.tsx
│   │   │   ├── barcode-scanner.tsx
│   │   │   ├── category-tabs.tsx
│   │   │   ├── cart-item.tsx
│   │   │   ├── bulk-entry-modal.tsx    # Modal de entrada para productos a granel
│   │   │   ├── cash-session-dialog.tsx
│   │   │   ├── supervisor-approval-dialog.tsx
│   │   │   └── pos-catalog-modal.tsx
│   │   │
│   │   ├── portal/
│   │   │   ├── product-card.tsx        # Soporta standard y bulk
│   │   │   ├── bulk-quantity-modal.tsx  # Modal de entrada para granel en portal
│   │   │   ├── cart-sheet.tsx
│   │   │   ├── order-tracker.tsx
│   │   │   ├── promo-banner.tsx
│   │   │   ├── category-nav.tsx
│   │   │   └── favorite-button.tsx
│   │   │
│   │   ├── reports/
│   │   │   ├── pdf-generator.tsx
│   │   │   ├── excel-export.tsx
│   │   │   └── charts.tsx
│   │   │
│   │   └── shared/
│   │       ├── animated-number.tsx
│   │       ├── info-field.tsx
│   │       ├── motion.tsx          # Wrappers Motion (PageTransition, etc.)
│   │       ├── sweetalert.tsx
│   │       ├── gps-picker.tsx
│   │       ├── sound-player.tsx
│   │       └── empty-state.tsx
│   │
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   ├── use-active-org.ts
│   │   ├── use-cart.ts
│   │   ├── use-portal-session.ts
│   │   ├── use-permissions.ts
│   │   ├── use-menus.ts           # Fetch de menús dinámicos desde BD
│   │   ├── use-sound.ts
│   │   └── use-sse.ts
│   │
│   ├── stores/                     # Zustand stores
│   │   ├── auth-store.ts           # Sesión usuario, claim, org activa
│   │   ├── theme-store.ts          # Tema, appearance settings
│   │   ├── pos-store.ts            # Estado POS (caja activa, ticket, etc.)
│   │   ├── portal-cart-store.ts    # Carrito portal (localStorage)
│   │   ├── notifications-store.ts  # Badges, unread count
│   │   └── ui-store.ts             # Drawer, bottomBar, modals state
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── client.ts           # Prisma client singleton
│   │   │   └── index.ts            # Re-export
│   │   ├── auth/
│   │   │   ├── options.ts          # NextAuth config
│   │   │   └── middleware.ts       # Auth middleware helpers
│   │   ├── promotions.ts           # Motor de promociones (puro, sin side-effects)
│   │   ├── bulk-products.ts        # Lógica de productos a granel (cálculo precio, validaciones)
│   │   ├── format.ts               # Formateo (fechas DD/MM/YYYY, moneda $1,234.56, teléfono)
│   │   ├── export.ts               # Exportación Excel/PDF
│   │   ├── swal.ts                 # SweetAlert2 theming
│   │   ├── sounds.ts               # Utilidad para reproducir sonidos
│   │   └── utils.ts                # cn(), helpers generales
│   │
│   ├── services/                   # Server Actions / API calls
│   │   ├── auth.ts
│   │   ├── products.ts
│   │   ├── units.ts               # CRUD unidades de medida
│   │   ├── categories.ts
│   │   ├── inventory.ts
│   │   ├── sales.ts
│   │   ├── customers.ts
│   │   ├── employees.ts
│   │   ├── promotions.ts
│   │   ├── orders.ts
│   │   ├── locations.ts
│   │   ├── cedis.ts
│   │   ├── cash-registers.ts
│   │   ├── users.ts
│   │   ├── roles.ts
│   │   ├── menus.ts               # CRUD menús + fetch árbol filtrado por permisos
│   │   ├── settings.ts
│   │   ├── reports.ts
│   │   ├── notifications.ts
│   │   ├── publications.ts
│   │   └── portal.ts
│   │
│   ├── types/
│   │   ├── database.ts             # Tipos generados de Prisma
│   │   ├── pos.ts
│   │   ├── portal.ts
│   │   └── api.ts
│   │
│   └── providers/
│       ├── query-provider.tsx      # TanStack Query
│       ├── auth-provider.tsx       # NextAuth SessionProvider
│       ├── theme-provider.tsx      # Tema + CSS custom properties
│       ├── sound-provider.tsx      # Sonidos context
│       └── mobile-provider.tsx     # Detección móvil/desktop
│
├── assets/
│   ├── fonts/
│   │   ├── Montserrat-Variable.woff2
│   │   ├── Poppins-Variable.woff2
│   │   └── SpaceMono-Variable.woff2
│   └── images/
│       ├── splash-logo.png
│       └── empty-states/
│           ├── no-products.svg
│           ├── no-results.svg
│           └── no-data.svg
│
├── .env.local                      # Variables de entorno
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── components.json                 # shadcn/ui config
├── package.json
└── README.md
```

---

## 5. BASE DE DATOS (Schema MySQL)

### 5.1 Enums/Valores Permitidos

```sql
-- Roles de membresía
org_role: owner | manager | cashier | superadmin | admin

-- Tipos de movimiento de inventario
movement_type: purchase | sale | adjustment | transfer_in | transfer_out | return

-- Métodos de pago
payment_method: cash | card | wallet | other | points

-- Estado de ventas
sale_status: open | completed | voided

-- Estado de sesiones de caja
cash_session_status: open | closed

-- Beneficios de promoción
promo_benefit: percent_off | amount_off | fixed_price | buy_x_get_y | free_item | next_purchase_coupon

-- Alcance de promoción
promo_scope: order | category | product | variant

-- Estado de pedidos
order_status: pending | confirmed | preparing | ready | delivered | cancelled

-- Tipo de transacción de lealtad
loyalty_kind: earn | redeem | adjust | expire

-- Método de entrega
delivery_method: pickup | delivery

-- Estado de revisión de inventario
revision_status: draft | in_progress | completed | cancelled
```

### 5.2 Tablas (40+)

#### ORGANIZACIÓN Y USUARIOS

```sql
users                          -- Usuarios del sistema (autenticación)
├── id: UUID (PK)
├── email: VARCHAR(255) UNIQUE NOT NULL
├── password_hash: VARCHAR(255) NOT NULL
├── full_name: VARCHAR(255) NOT NULL
├── avatar_url: TEXT
├── phone: VARCHAR(20)
├── is_active: BOOLEAN DEFAULT true
├── email_verified: DATETIME
├── created_at: DATETIME
├── updated_at: DATETIME

organizations                   -- Empresas/negocios (multi-tenant root)
├── id: UUID (PK)
├── name: VARCHAR(255) NOT NULL
├── owner_id: UUID (FK → users.id)
├── currency: VARCHAR(3) DEFAULT 'MXN'
├── points_per_currency: DECIMAL(12,4) DEFAULT 1
├── point_value: DECIMAL(12,4) DEFAULT 1
├── loyalty_enabled: BOOLEAN DEFAULT true
├── created_at, updated_at

memberships                    -- Vincula usuario ↔ organización + rol
├── id: UUID (PK)
├── user_id: UUID (FK → users.id)
├── organization_id: UUID (FK → organizations.id)
├── role: org_role NOT NULL
├── created_at
├── UNIQUE(user_id, organization_id)

profiles                       -- Perfiles extendidos (1:1 con user)
├── id: UUID (PK, FK → users.id)
├── full_name: VARCHAR(255)
├── avatar_url: TEXT
├── phone: VARCHAR(20)
├── preferences: JSONB DEFAULT '{}'
├── created_at, updated_at

company_profiles               -- Datos fiscales de la empresa
├── id: UUID (PK)
├── organization_id: UUID (FK, UNIQUE)
├── legal_name: VARCHAR(255)     -- Razón social
├── trade_name: VARCHAR(255)     -- Nombre comercial
├── tax_id: VARCHAR(20)          -- RFC
├── logo_url: TEXT
├── address, city, state, postal_code, country
├── phone, email, website
├── ticket_footer: TEXT
├── created_at, updated_at

app_settings                   -- Configuración visual por empresa
├── id: UUID (PK)
├── organization_id: UUID (FK, UNIQUE)
├── primary_hue: INT DEFAULT 210       -- 0-360
├── accent_hue: INT DEFAULT 150        -- 0-360
├── theme: VARCHAR(20) DEFAULT 'system' -- system|light|dark|pos
├── font_family: VARCHAR(50) DEFAULT 'montserrat'
├── font_scale: DECIMAL(3,2) DEFAULT 1
├── card_size: VARCHAR(10) DEFAULT 'md' -- sm|md|lg
├── density: VARCHAR(20) DEFAULT 'comfortable' -- compact|comfortable|spacious
├── border_radius: DECIMAL(3,2) DEFAULT 0.75
├── sidebar_style: VARCHAR(20) DEFAULT 'full' -- full|compact|collapsed
├── created_at, updated_at
```

#### EMPLEADOS Y CLIENTES

```sql
employee_positions              -- Catálogo de puestos
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── name: VARCHAR(100) NOT NULL     -- Cajero, Supervisor, Repartidor, etc.
├── description: TEXT
├── is_active: BOOLEAN DEFAULT true
├── created_at

employees                      -- Empleados de la empresa
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── user_id: UUID (FK → users.id) NOT NULL  -- SIEMPRE se crea user
├── position_id: UUID (FK → employee_positions.id)
├── employee_code: VARCHAR(50)       -- Nómina, siempre único por org
├── full_name: VARCHAR(255) NOT NULL
├── phone: VARCHAR(20)
├── image_url: TEXT
├── is_active: BOOLEAN DEFAULT true
├── created_at, updated_at
├── UNIQUE(organization_id, employee_code)
├── UNIQUE(organization_id, user_id) -- 1 user = 1 empleado por org

customers                      -- Clientes de la empresa
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── user_id: UUID (FK → users.id) NOT NULL  -- SIEMPRE se crea user
├── customer_code: VARCHAR(50)       -- Nº cliente, siempre único por org
├── full_name: VARCHAR(255) NOT NULL
├── phone: VARCHAR(20)
├── email: VARCHAR(255)
├── points: DECIMAL(12,2) DEFAULT 0
├── image_url: TEXT
├── address: TEXT
├── is_active: BOOLEAN DEFAULT true
├── created_at, updated_at
├── UNIQUE(organization_id, customer_code)
├── UNIQUE(organization_id, user_id) -- 1 user = 1 cliente por org
├── UNIQUE(organization_id, phone) WHERE phone IS NOT NULL

customer_payment_methods        -- Métodos de pago guardados (sin PAN)
├── id: UUID (PK)
├── customer_id: UUID (FK)
├── organization_id: UUID (FK)
├── brand: VARCHAR(20)              -- Visa, MC, etc.
├── last4: VARCHAR(4)
├── exp_month: INT
├── exp_year: INT
├── is_default: BOOLEAN DEFAULT false
├── stripe_payment_method_id: VARCHAR(255)
├── created_at

customer_favorites              -- Productos favoritos del cliente
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── customer_id: UUID (FK)
├── variant_id: UUID (FK → product_variants.id)
├── created_at
├── UNIQUE(customer_id, variant_id)

shopping_lists                  -- Listas de compra del cliente
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── customer_id: UUID (FK)
├── name: VARCHAR(255) NOT NULL
├── notes: TEXT
├── created_at, updated_at

shopping_list_items             -- Items de listas de compra
├── id: UUID (PK)
├── list_id: UUID (FK → shopping_lists.id)
├── variant_id: UUID (FK → product_variants.id)
├── quantity: DECIMAL(12,3) DEFAULT 1
├── created_at
```

#### SUCURSALES, CEDIS Y CAJAS

```sql
locations                       -- Sucursales
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── name: VARCHAR(255) NOT NULL
├── code: VARCHAR(20)              -- Código de la sucursal
├── address: TEXT
├── latitude: DECIMAL(10,8)
├── longitude: DECIMAL(11,8)
├── manager_name: VARCHAR(255)
├── phone: VARCHAR(20)
├── email: VARCHAR(255)
├── opening_hours: TEXT            -- JSON o texto descriptivo
├── image_url: TEXT
├── notes: TEXT
├── timezone: VARCHAR(50) DEFAULT 'America/Mexico_City'
├── allows_pickup: BOOLEAN DEFAULT true
├── allows_delivery: BOOLEAN DEFAULT false
├── sale_seq: BIGINT DEFAULT 0     -- Folio secuencial de ventas
├── is_active: BOOLEAN DEFAULT true
├── created_at

cedis                           -- Centros de distribución/almacén
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── name: VARCHAR(255) NOT NULL
├── code: VARCHAR(20)
├── address: TEXT
├── latitude: DECIMAL(10,8)
├── longitude: DECIMAL(11,8)
├── manager_name: VARCHAR(255)     -- Encargado de CEDIS
├── phone: VARCHAR(20)
├── email: VARCHAR(255)
├── opening_hours: TEXT
├── image_url: TEXT
├── notes: TEXT
├── timezone: VARCHAR(50) DEFAULT 'America/Mexico_City'
├── is_active: BOOLEAN DEFAULT true
├── created_at

cash_registers                  -- Cajas por sucursal
├── id: UUID (PK)
├── location_id: UUID (FK → locations.id)
├── organization_id: UUID (FK)
├── name: VARCHAR(100) NOT NULL    -- "Caja 1", "Caja 2"
├── folio_prefix: VARCHAR(10)      -- Prefijo para tickets
├── is_active: BOOLEAN DEFAULT true
├── created_at

cash_sessions                   -- Sesiones de caja
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── location_id: UUID (FK)
├── cash_register_id: UUID (FK → cash_registers.id)
├── employee_id: UUID (FK → employees.id) -- El empleado que opera
├── user_id: UUID (FK → users.id)         -- User del empleado (para auth)
├── opened_by: UUID (FK → users.id)       -- Quién dio click en "abrir"
├── opening_cash: DECIMAL(12,2) DEFAULT 0
├── closing_cash: DECIMAL(12,2)
├── closed_at: DATETIME
├── notes: TEXT
├── status: cash_session_status DEFAULT 'open'
├── opened_at: DATETIME DEFAULT NOW()
```

#### CATÁLOGOS

```sql
categories                      -- Categorías (jerarquía)
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── parent_id: UUID (FK → categories.id, self-ref)
├── name: VARCHAR(255) NOT NULL
├── image_url: TEXT
├── is_active: BOOLEAN DEFAULT true
├── created_at

units_of_measure                -- Catálogo de unidades de medida
├── id: UUID (PK)
├── organization_id: UUID (FK)     -- NULL = unidad del sistema (global)
├── name: VARCHAR(50) NOT NULL     -- "kg", "pieza", "litro", "metro", etc.
├── abbreviation: VARCHAR(10) NOT NULL -- "kg", "pza", "lt", "m"
├── type: VARCHAR(20) NOT NULL     -- "weight" | "volume" | "piece" | "length" | "amount"
├── base_unit: VARCHAR(10)         -- Unidad base para conversiones: "g", "ml", "pza", "cm", "peso"
├── conversion_factor: DECIMAL(12,6) DEFAULT 1 -- Factor a unidad base (1 kg = 1000 g → factor = 1000)
├── is_active: BOOLEAN DEFAULT true
├── created_at
├── UNIQUE(organization_id, abbreviation)

-- Unidades del sistema (seed):
-- kg/g (weight), lt/ml (volume), pza (piece), m/cm (length), peso (amount/$)

products                        -- Productos base
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── category_id: UUID (FK → categories.id)
├── name: VARCHAR(255) NOT NULL
├── description: TEXT
├── image_url: TEXT
├── tax_rate: DECIMAL(5,4) DEFAULT 0
├── is_active: BOOLEAN DEFAULT true
├── track_inventory: BOOLEAN DEFAULT true
│
├── ── CAMPOS PARA PRODUCTOS A GRANEL ──
├── product_type: VARCHAR(20) DEFAULT 'standard' -- 'standard' | 'bulk'
├── bulk_unit_id: UUID (FK → units_of_measure.id) -- Unidad de venta (kg, pieza, lt, peso)
├── bulk_price_per_unit: DECIMAL(12,2) DEFAULT 0  -- Precio por unidad de medida
├── bulk_min_quantity: DECIMAL(12,3) DEFAULT 0    -- Cantidad mínima de venta (ej: 0.1 kg)
├── bulk_step: DECIMAL(12,3) DEFAULT 0.01         -- Incremento permitido (ej: 0.01 kg)
├── bulk_max_quantity: DECIMAL(12,3) DEFAULT 0    -- Cantidad máxima (0 = sin límite)
├── allow_split: BOOLEAN DEFAULT false            -- Permitir venta fraccionada
├── split_unit_id: UUID (FK → units_of_measure.id) -- Unidad alternativa (ej: pieza si la principal es kg)
├── split_price_per_unit: DECIMAL(12,2) DEFAULT 0  -- Precio por unidad alternativa
│
├── created_at, updated_at

-- REGLAS:
-- product_type = 'standard': usa variantes (product_variants) con precio fijo
-- product_type = 'bulk': NO usa variantes, precio calculado en POS al momentovender
--   bulk_unit_id: en qué se mide (kg, pieza, lt, peso/$)
--   bulk_price_per_unit: cuánto cuesta por esa unidad
--   allow_split + split_unit_id: permite venta en 2 unidades (ej: kg Y pieza)

product_options                 -- Opciones de variante (talla, color, etc.) — SOLO para standard
├── id: UUID (PK)
├── product_id: UUID (FK → products.id)
├── name: VARCHAR(100) NOT NULL
├── position: INT DEFAULT 0

product_option_values           -- Valores de cada opción
├── id: UUID (PK)
├── option_id: UUID (FK → product_options.id)
├── value: VARCHAR(255) NOT NULL
├── position: INT DEFAULT 0

product_variants                -- Variantes (con SKU, barcode, precio)
├── id: UUID (PK)
├── product_id: UUID (FK → products.id)
├── organization_id: UUID (FK)
├── sku: VARCHAR(100)
├── barcode: VARCHAR(255)
├── name: VARCHAR(255) DEFAULT 'Default'
├── price: DECIMAL(12,2) DEFAULT 0
├── cost: DECIMAL(12,2) DEFAULT 0
├── image_url: TEXT
├── is_active: BOOLEAN DEFAULT true
├── created_at
├── INDEX(barcode)

variant_option_values           -- Junction: variante ↔ opción valor
├── variant_id: UUID (FK → product_variants.id)
├── option_value_id: UUID (FK → product_option_values.id)
├── PRIMARY KEY(variant_id, option_value_id)
```

#### INVENTARIO

```sql
inventory                       -- Stock por variante O por producto granel, por ubicación
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── product_id: UUID (FK → products.id)  -- Para productos a granel (sin variante)
├── variant_id: UUID (FK → product_variants.id) -- Para productos standard (con variante)
├── location_id: UUID               -- Sucursal o CEDIS
├── location_type: VARCHAR(20)      -- 'location' | 'cedis'
├── quantity: DECIMAL(12,3) DEFAULT 0  -- En unidad base (g, ml, pza, cm, o unidad de venta)
├── unit_id: UUID (FK → units_of_measure.id) -- Unidad en que se mide el stock
├── min_threshold: DECIMAL(12,3) DEFAULT 0  -- Stock mínimo (en unidad de venta)
├── updated_at: DATETIME
├── CHECK: (variant_id IS NOT NULL AND product_id IS NULL) OR (variant_id IS NULL AND product_id IS NOT NULL)
├── UNIQUE(variant_id, location_id, location_type) -- Para standard
├── UNIQUE(product_id, location_id, location_type) -- Para bulk

inventory_movements             -- Historial de movimientos
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── product_id: UUID (FK)          -- Para productos a granel
├── variant_id: UUID (FK)          -- Para productos standard
├── location_id: UUID
├── location_type: VARCHAR(20)
├── type: movement_type NOT NULL
├── quantity: DECIMAL(12,3) NOT NULL  -- Cantidad en unidad de venta
├── unit_id: UUID (FK → units_of_measure.id)
├── reason: TEXT
├── reference_id: UUID              -- ID de la venta/pedido relacionado
├── employee_id: UUID (FK → employees.id)
├── user_id: UUID (FK → users.id)
├── created_at: DATETIME DEFAULT NOW()

variant_price_history           -- Historial de cambios de precio/costo
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── variant_id: UUID (FK)
├── old_price: DECIMAL(12,2)
├── new_price: DECIMAL(12,2)
├── old_cost: DECIMAL(12,2)
├── new_cost: DECIMAL(12,2)
├── changed_by: UUID (FK → users.id)
├── created_at

inventory_revisions             -- Revisiones físicas de inventario
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── location_id: UUID
├── location_type: VARCHAR(20)
├── revision_number: INT
├── status: revision_status DEFAULT 'draft'
├── notes: TEXT
├── performed_by: UUID (FK → users.id)
├── employee_id: UUID (FK → employees.id)
├── started_at: DATETIME
├── completed_at: DATETIME
├── created_at

inventory_revision_items        -- Items de la revisión
├── id: UUID (PK)
├── revision_id: UUID (FK)
├── variant_id: UUID (FK)
├── expected_quantity: DECIMAL(12,3)
├── counted_quantity: DECIMAL(12,3)
├── difference: DECIMAL(12,3)
├── notes: TEXT
├── scanned: BOOLEAN DEFAULT false  -- Si fue escaneado con lector
├── counted_by: UUID (FK → users.id)
├── created_at
```

#### VENTAS

```sql
sales                           -- Ventas
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── location_id: UUID (FK)
├── cash_session_id: UUID (FK → cash_sessions.id)
├── cash_register_id: UUID (FK → cash_registers.id)
├── cashier_id: UUID (FK → users.id)          -- User que procesó
├── employee_id: UUID (FK → employees.id)     -- Empleado vinculado
├── customer_id: UUID (FK → customers.id)
├── sale_number: BIGINT AUTO_INCREMENT
├── location_sale_number: BIGINT              -- Folio por sucursal
├── subtotal: DECIMAL(12,2) DEFAULT 0
├── discount: DECIMAL(12,2) DEFAULT 0
├── tax: DECIMAL(12,2) DEFAULT 0
├── total: DECIMAL(12,2) DEFAULT 0
├── points_earned: DECIMAL(12,2) DEFAULT 0
├── points_redeemed: DECIMAL(12,2) DEFAULT 0
├── change_given: DECIMAL(12,2) DEFAULT 0
├── status: sale_status DEFAULT 'completed'
├── notes: TEXT
├── created_at: DATETIME DEFAULT NOW()

sale_items                      -- Líneas de venta
├── id: UUID (PK)
├── sale_id: UUID (FK)
├── product_id: UUID (FK)          -- Para productos a granel
├── variant_id: UUID (FK)          -- Para productos standard
├── product_name: VARCHAR(255)
├── variant_name: VARCHAR(255)     -- NULL si es granel
├── product_type: VARCHAR(20) NOT NULL -- 'standard' | 'bulk'
├── quantity: DECIMAL(12,3)
├── unit_id: UUID (FK → units_of_measure.id) -- Unidad de venta (kg, pza, lt, peso)
├── unit_price: DECIMAL(12,2)      -- Precio por unidad de medida
├── unit_cost: DECIMAL(12,2)       -- Costo por unidad
├── total_price: DECIMAL(12,2)     -- price × quantity (para granel)
├── discount: DECIMAL(12,2) DEFAULT 0
├── tax_rate: DECIMAL(5,4) DEFAULT 0
├── line_total: DECIMAL(12,2)
├── bulk_quantity_display: VARCHAR(50) -- "1.5 kg", "3 pzas", "$10.00" (para ticket)

sale_payments                   -- Pagos por venta (split payments)
├── id: UUID (PK)
├── sale_id: UUID (FK)
├── method: payment_method NOT NULL
├── amount: DECIMAL(12,2)
├── reference: TEXT                -- Nº de autorización, etc.
├── created_at

sale_discounts                  -- Descuentos aplicados
├── id: UUID (PK)
├── sale_id: UUID (FK)
├── promotion_id: UUID (FK → promotions.id)
├── label: VARCHAR(255)
├── amount: DECIMAL(12,2)
├── created_at
```

#### PROMOCIONES

```sql
promotions                      -- Reglas de promoción
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── name: VARCHAR(255) NOT NULL
├── description: TEXT
├── image_url: TEXT
├── benefit: promo_benefit NOT NULL
├── scope: promo_scope DEFAULT 'order'
├── value: DECIMAL(12,2) DEFAULT 0
├── buy_quantity: INT DEFAULT 0
├── get_quantity: INT DEFAULT 0
├── min_amount: DECIMAL(12,2) DEFAULT 0
├── min_quantity: DECIMAL(12,3) DEFAULT 0
├── starts_at: DATETIME
├── ends_at: DATETIME
├── weekdays: VARCHAR(50)          -- JSON array: [0,1,2,3,4,5,6]
├── start_time: TIME
├── end_time: TIME
├── coupon_code: VARCHAR(50)
├── requires_customer: BOOLEAN DEFAULT false
├── priority: INT DEFAULT 100
├── exclusive: BOOLEAN DEFAULT false
├── max_uses: INT
├── max_uses_per_customer: INT
├── uses_count: INT DEFAULT 0
├── is_active: BOOLEAN DEFAULT true
├── created_by: UUID (FK → users.id)
├── created_at, updated_at

promotion_targets               -- Targets de la promoción
├── id: UUID (PK)
├── promotion_id: UUID (FK)
├── kind: VARCHAR(20)              -- location|category|product|variant|reward_variant
├── target_id: UUID
├── created_at
├── UNIQUE(promotion_id, kind, target_id)

coupons                         -- Cupones emitidos
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── promotion_id: UUID (FK)
├── customer_id: UUID (FK)
├── code: VARCHAR(50)
├── amount: DECIMAL(12,2) DEFAULT 0
├── percent: DECIMAL(5,2) DEFAULT 0
├── expires_at: DATETIME
├── redeemed_at: DATETIME
├── redeemed_sale_id: UUID (FK)
├── created_at
├── UNIQUE(organization_id, code)
```

#### LEALTAD/PUNTOS

```sql
loyalty_transactions            -- Historial de puntos
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── customer_id: UUID (FK)
├── sale_id: UUID (FK)
├── kind: loyalty_kind NOT NULL    -- earn|redeem|adjust|expire
├── points: DECIMAL(12,2)
├── note: TEXT
├── created_at
```

#### PEDIDOS (PORTAL)

```sql
orders                          -- Pedidos en línea
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── location_id: UUID (FK)        -- Sucursal elegida
├── customer_id: UUID (FK)
├── order_number: BIGINT AUTO_INCREMENT
├── status: order_status DEFAULT 'pending'
├── delivery_method: delivery_method NOT NULL
├── subtotal: DECIMAL(12,2) DEFAULT 0
├── discount: DECIMAL(12,2) DEFAULT 0
├── total: DECIMAL(12,2) DEFAULT 0
├── notes: TEXT
├── sale_id: UUID (FK)            -- Venta vinculada (al pagar en sucursal)
├── created_at, updated_at

order_items                     -- Líneas de pedido
├── id: UUID (PK)
├── order_id: UUID (FK)
├── product_id: UUID (FK)          -- Para productos a granel
├── variant_id: UUID (FK)          -- Para productos standard
├── product_name: VARCHAR(255)
├── variant_name: VARCHAR(255)     -- NULL si es granel
├── product_type: VARCHAR(20) NOT NULL -- 'standard' | 'bulk'
├── quantity: DECIMAL(12,3)
├── unit_id: UUID (FK → units_of_measure.id) -- Unidad de venta
├── unit_price: DECIMAL(12,2)
├── line_total: DECIMAL(12,2)
├── bulk_quantity_display: VARCHAR(50) -- "1.5 kg", "3 pzas"
├── comment: TEXT                  -- Comentario por producto
├── created_at

order_status_history            -- Historial de cambios de estado
├── id: UUID (PK)
├── order_id: UUID (FK)
├── status: order_status NOT NULL
├── employee_id: UUID (FK → employees.id)  -- Quién cambió el estado
├── user_id: UUID (FK → users.id)
├── notes: TEXT
├── created_at

order_preparation               -- Preparación de pedido
├── id: UUID (PK)
├── order_id: UUID (FK, UNIQUE)
├── employee_id: UUID (FK → employees.id)  -- Empleado que prepara
├── started_at: DATETIME
├── completed_at: DATETIME
├── elapsed_seconds: INT
├── general_notes: TEXT
├── created_at

order_preparation_items         -- Items de la preparación
├── id: UUID (PK)
├── preparation_id: UUID (FK)
├── order_item_id: UUID (FK → order_items.id)
├── scanned: BOOLEAN DEFAULT false
├── found: BOOLEAN DEFAULT false
├── employee_notes: TEXT
├── created_at
```

#### ADMINISTRACIÓN

```sql
permissions                     -- Permisos predefinidos
├── key: VARCHAR(50) (PK)         -- pos.use, products.manage, etc.
├── module: VARCHAR(50)
├── action: VARCHAR(50)
├── label: VARCHAR(255)

roles                           -- Roles personalizados por org
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── name: VARCHAR(100) NOT NULL
├── description: TEXT
├── is_system: BOOLEAN DEFAULT false  -- Roles del sistema no se borran
├── created_at, updated_at

role_permissions                 -- Permisos por rol
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── role_id: UUID (FK → roles.id)
├── permission_key: VARCHAR(50) (FK → permissions.key)
├── allowed: BOOLEAN DEFAULT true
├── created_at
├── UNIQUE(organization_id, role_id, permission_key)

user_invitations                 -- Invitaciones pendientes
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── email: VARCHAR(255)
├── role: org_role DEFAULT 'cashier'
├── location_id: UUID (FK)
├── status: VARCHAR(20) DEFAULT 'pending'
├── invited_by: UUID (FK → users.id)
├── accepted_at: DATETIME
├── created_at, updated_at

notifications                    -- Notificaciones en-app
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── location_id: UUID (FK)
├── user_id: UUID (FK)             -- NULL = para todos los de la org
├── employee_id: UUID (FK)
├── kind: VARCHAR(50)              -- low_stock, new_order, sale, etc.
├── title: VARCHAR(255)
├── body: TEXT
├── severity: VARCHAR(20) DEFAULT 'info' -- info|success|warning|error
├── link: TEXT
├── metadata: JSONB DEFAULT '{}'
├── read_at: DATETIME
├── created_at

publications                    -- Publicaciones/newsfeed
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── title: VARCHAR(255)
├── content: TEXT
├── image_url: TEXT
├── type: VARCHAR(20)              -- product_new|promotion|notice
├── is_active: BOOLEAN DEFAULT true
├── published_at: DATETIME
├── created_at, updated_at
```

---

## 6. RELACIONES Y JERARQUÍA

```
SUPERADMIN (solo user, sin org)
│   → Ve todo, gestiona todo el sistema
│
ADMIN (user, asignado a una o más orgs)
│   → Soporte/gestión de owners y sus negocios
│
OWNER (user + membership role=owner)
│   → Tiene EMPRESA (organization)
│
EMPRESA (organization)
├── EMPLEADOS (employees) ─── user_id SIEMPRE creado
│   └── Puesto (employee_position)
│   └── Vinculación: al abrir turno → employee → cash_register
│   └── Flexible: puede cambiar de caja/sucursal según turno
│
├── CLIENTES (customers) ──── user_id SIEMPRE creado
│   └── Puntos globales (usables en cualquier sucursal)
│   └── Favoritos, listas, pedidos, historial
│
├── SUCURSALES (locations) ── default: 1 principal
│   └── CAJAS (cash_registers) ── default: 1 por sucursal
│       └── SESIONES (cash_sessions)
│           └── employee_id: quién opera
│           └── user_id: user del empleado
│
├── CEDIS (default: 1) ── Centros de distribución
│   └── INVENTARIO por ubicación
│
├── PRODUCTOS (catálogo global)
│   └── VARIANTES (stock por sucursal/CEDIS)
│
├── CATEGORÍAS (catálogo global, jerarquía)
├── PROMOCIONES (configurables por sucursal)
├── ROLES + PERMISOS
└── CONFIGURACIÓN (app_settings, company_profiles)
```

### Flujo de Venta con Empleado:

```
1. Empleado Juan (nómina: EMP-001) inicia sesión en /auth/login
   → Se resuelve: employee_code "EMP-001" → user_id → autenticación

2. Juan abre la Caja 3 de la Sucursal 2
   → cash_session: employee_id=juan, cash_register_id=caja3, location_id=sucursal2

3. Juan procesa una venta
   → sale: cashier_id=juan.user_id, employee_id=juan.id, cash_register_id=caja3, location_id=sucursal2

4. Se genera el ticket con folio secuencial de la sucursal
   → Folio: Sucursal 2 - #00147 (sale_seq de la location)
```

---

## 6b. SISTEMA DE PRODUCTOS A GRANEL

### Problema

Los productos a granel (azúcar, fruta, verdura, carnes, etc.) no tienen variantes predefinidas. El cliente pide por peso ("1.5 kg de tomate"), por piezas ("3 manzanas") o por monto ("$10 de azúcar"). El precio se calcula al momento de la venta.

### Solución

```
DOS TIPOS DE PRODUCTO:

┌─────────────────────────────────────────────────────────────────┐
│  TIPO: ESTÁNDAR (product_type = 'standard')                     │
│                                                                  │
│  Ejemplo: Leche LALA 1L, Cereal Kellogg's 500g                  │
│  → Tiene variantes predefinidas (1L, 1.5L, Entera, Light)       │
│  → Precio fijo por variante                                      │
│  → Stock por variante por sucursal                               │
│  → POS: selecciona variante → cantidad → al ticket              │
│  → Usa: product_options, product_option_values, product_variants │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TIPO: A GRANEL (product_type = 'bulk')                         │
│                                                                  │
│  Ejemplo: Azúcar, Tomate, Manzana, Carne de res, Tela           │
│  → NO tiene variantes                                            │
│  → Precio por unidad de medida (kg, pieza, lt, metro, peso)     │
│  → Stock en unidad de medida por sucursal                        │
│  → POS: tocar producto → modal de entrada → cantidad/monto      │
│  → NO usa: product_options, product_variants                     │
│  → USA: bulk_unit_id, bulk_price_per_unit                        │
└─────────────────────────────────────────────────────────────────┘
```

### Unidades de Medida

```
UNIDADES DEL SISTEMA (pre-cargadas):
├── PESO:      kg (kilogramo), g (gramo)
├── VOLUMEN:   lt (litro), ml (mililitro)
├── PIEZA:     pza (pieza)
├── LONGITUD:  m (metro), cm (centímetro)
├── MONTO:     peso ($ - venta por cantidad fija de dinero)
│
│   conversion_factor: 1 kg = 1000 g → factor = 1000
│   conversion_factor: 1 lt = 1000 ml → factor = 1000
│
UNIDADES PERSONALIZADAS (por empresa):
├── Ej: "Bolsa" de 500g, "Docena", "Rollo", "Caja"
└── Se crean desde admin → Settings → Unidades de medida
```

### Flujo en el POS (productos a granel)

```
1. Cajero busca o escanea "Azúcar"
2. Card en grid muestra: 🏷️ "A granel" + "$18.00/kg"
3. Cajero toca la card
4. Se abre MODAL DE ENTRADA:
   ┌──────────────────────────────────────┐
   │  🍬 Azúcar Estándar                  │
   │  Precio: $18.00 / kg                 │
   │                                       │
   │  ┌──────────────────────────────┐    │
   │  │  [Por cantidad] [Por monto]  │    │  ← Toggle
   │  └──────────────────────────────┘    │
   │                                       │
   │  Cantidad:                            │
   │  ┌──────────────────────────────┐    │
   │  │  1.5                          │    │  ← NumPad
   │  └──────────────────────────────┘    │
   │  Unidad: kg                           │
   │                                       │
   │  Total: $27.00                        │  ← Calculado
   │                                       │
   │  [     Agregar al ticket      ]       │
   └──────────────────────────────────────┘
   
5. Si elige "Por monto":
   ┌──────────────────────────────┐
   │  Monto: $10.00               │
   │  Cantidad: 0.556 kg          │  ← Calculado
   │  Total: $10.00               │
   └──────────────────────────────┘

6. Se agrega al ticket:
   🍬 Azúcar Estándar
   1.5 kg × $18.00/kg    $27.00

7. Si allow_split (venta fraccionada):
   Toggle: [Kilogramo $18.00/kg] [Pieza $5.00/pza]
   El cajero puede elegir vender por kg O por pieza
```

### Flujo en el Portal de Clientes

```
1. Cliente ve card de "Azúcar Estándar":
   ┌──────────────────────────────┐
   │  🍬 Azúcar Estándar          │
   │  $18.00/kg  🏷️ A granel     │
   │  [  Agregar  ]                │
   └──────────────────────────────┘

2. Al tocar "Agregar" → abre modal:
   ┌──────────────────────────────┐
   │  Azúcar Estándar              │
   │  $18.00 / kg                  │
   │                               │
   │  Cantidad: [-] 1.5 [+] kg    │
   │                               │
   │  Total: $27.00                │
   │  [  Agregar al carrito  ]     │
   └──────────────────────────────┘

3. En el carrito:
   🍬 Azúcar Estándar
   1.5 kg × $18.00/kg = $27.00
   [-] [+] [Eliminar]
```

### Inventario de Productos a Granel

```
ANTES (solo standard):
inventory: variant_id + location → quantity (en unidades de variante)

AHORA (standard + bulk):
inventory:
├── standard: variant_id + location → quantity (en unidades de variante)
└── bulk: product_id + location → quantity (en unidad de medida, ej: 45.5 kg)

Al vender 1.5 kg de azúcar:
→ inventory_movements: product_id=azucar, quantity=-1.5, unit_id=kg
→ inventory: quantity = quantity - 1.5 (se descuenta en kg)
```

### Resumen de Cambios


| Capa                            | Cambio                                                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BD: products**                | +7 campos: product_type, bulk_unit_id, bulk_price_per_unit, bulk_min_quantity, bulk_step, bulk_max_quantity, allow_split, split_unit_id, split_price_per_unit |
| **BD: units_of_measure**        | Nueva tabla (catálogo de unidades)                                                                                                                           |
| **BD: inventory**               | +product_id, +unit_id (para granel sin variante)                                                                                                              |
| **BD: inventory_movements**     | +product_id, +unit_id                                                                                                                                         |
| **BD: sale_items**              | +product_id, +product_type, +unit_id, +total_price, +bulk_quantity_display                                                                                    |
| **BD: order_items**             | +product_id, +product_type, +unit_id, +bulk_quantity_display                                                                                                  |
| **CRUD Productos**              | Formulario condicional: si es granel muestra campos de granel, si es estándar muestra variantes                                                              |
| **CRUD Unidades**               | Nuevo CRUD de unidades de medida                                                                                                                              |
| **POS: product-grid**           | Badge "A granel" en cards bulk                                                                                                                                |
| **POS: bulk-entry-modal**       | NUEVO: modal de entrada con NumPad, toggle cantidad/monto                                                                                                     |
| **POS: ticket-panel**           | Formato de línea diferente para granel ("1.5 kg × $18.00/kg")                                                                                               |
| **POS: cart-item**              | Editar granel → re-abre modal                                                                                                                                |
| **Portal: product-card**        | Badge "A granel", precio por unidad                                                                                                                           |
| **Portal: bulk-quantity-modal** | NUEVO: modal de cantidad para portal                                                                                                                          |
| **Portal: cart-sheet**          | Formato de línea diferente para granel                                                                                                                       |
| **Inventario: vista**           | Filtro por tipo, columna "Unidad"                                                                                                                             |
| **Inventario: movimientos**     | Registran unit_id                                                                                                                                             |
| **Lib: bulk-products.ts**       | NUEVO: cálculo de precio, validaciones de cantidad                                                                                                           |
| **Services: units.ts**          | NUEVO: CRUD unidades de medida                                                                                                                                |

---

## 7. AUTENTICACIÓN Y AUTORIZACIÓN

### 7.1 Login POS (`/auth/login`)

```
Métodos de identificación:
├── Email + password
└── Nº Nómina (employee_code) + password

Resolución:
1. Buscar user por email
2. Si no existe → buscar employee por employee_code → obtener user_id
3. Verificar password_hash (bcrypt)
4. Verificar is_active = true
5. Cargar memberships[]
6. Si tiene membership → sesión válida → redirect a /pos o /dashboard
7. Si no tiene → rechazar "Sin acceso al sistema POS"
```

### 7.2 Login Cliente (`/portal/auth/login`)

```
Métodos de identificación:
├── Email + password
└── Nº Cliente (customer_code) + password

Resolución:
1. Buscar user por email
2. Si no existe → buscar customer por customer_code → obtener user_id
3. Verificar password_hash (bcrypt)
4. Verificar is_active = true
5. Cargar customer record
6. Si tiene customer → sesión válida → redirect a /tienda
7. Si no tiene → rechazar "Sin acceso al portal"
```

### 7.3 SuperAdmin y Admin

```
- Pueden loguearse en AMBOS logins
- En login POS: se resuelve por email → membership con role superadmin/admin
- En login cliente: se resuelve por email → customer (si tiene registro)
- Si no tiene customer en la org → no puede acceder al portal
```

### 7.4 Landing Page

```
┌─────────────────────────────────────────────────────────────┐
│  MULTI-POS — Sistema de Punto de Venta                      │
│                                                              │
│  [Hero section con features]                                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Gestión POS  │  │ Multi-sucursal│  │ Portal Clientes│     │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ¿Quieres sistema para tu negocio?                           │
│                                                              │
│  [💬 Contáctenos por WhatsApp]  ← Botón grande, verde       │
│    → Abre wa.me/52XXXXXXXXXX?text=Me%20interesa%20tu%20     │
│      Multi-POS%20y%20quiero%20saber%20más                   │
│                                                              │
│  ─── o ───                                                   │
│                                                              │
│  [🔑 soy empleado / dueño — Iniciar Sesión]  → /auth/login  │
│  [🛒 soy cliente — Mi cuenta]                → /portal/auth/login │
│                                                              │
│  Footer: © 2026 Multi-POS                                    │
└─────────────────────────────────────────────────────────────┘
```

### 7.5 Registro (Solo desde Admin)

```
No hay formulario de registro público.
Los empleados y clientes se registran desde el panel admin:

REGISTRO DE EMPLEADO:
Admin/Owner → Empleados → "Registrar empleado"
├── Nombre completo
├── Nómina/Código (único por empresa)
├── Puesto (FormCombobox)
├── Teléfono
├── Email (opcional)
├── Sucursal base (FormCombobox)
├── Foto (Attachment)
│
└── AUTOMÁTICAMENTE:
    1. Se crea User (email: nómina@empresa.local, password: temporal)
    2. Se crea Employee (con user_id vinculado)
    3. Se envía email con credenciales (si tiene email)

REGISTRO DE CLIENTE:
Admin/Owner/POS → Clientes → "Registrar cliente"
├── Nombre completo
├── Nº Cliente (auto-generado, único por empresa)
├── Teléfono
├── Email (opcional)
├── Notas (opcional)
├── Foto (Attachment)
│
└── AUTOMÁTICAMENTE:
    1. Se crea User (email: nºcliente@portal.local, password: temporal)
    2. Se crea Customer (con user_id vinculado)
    3. Se envía email con credenciales (si tiene email)
```

### 7.6 RBAC — Roles y Permisos

```
ROLES DEL SISTEMA (defaults):
├── superadmin → Todos los permisos
├── owner → Todos los permisos
├── manager → Todos excepto users.manage
└── cashier → pos.use, products.view, inventory.view, customers.view,
              customers.manage, promotions.view, sales.view, cash.open,
              cash.close, orders.view, orders.manage, locations.view

PERMISOS (23+):
├── pos.use             Usar punto de venta
├── pos.void            Cancelar ventas
├── pos.discount        Aplicar descuentos manuales
├── products.view       Ver productos
├── products.manage     Crear/editar productos
├── products.delete     Eliminar productos
├── categories.manage   Gestionar categorías
├── inventory.view      Ver inventario
├── inventory.manage    Registrar movimientos y mínimos
├── inventory.revision  Realizar revisiones de inventario
├── customers.view      Ver clientes
├── customers.manage    Crear/editar clientes y puntos
├── employees.view      Ver empleados
├── employees.manage    Crear/editar empleados
├── promotions.view     Ver promociones
├── promotions.manage   Crear/editar promociones
├── sales.view          Ver historial de ventas
├── reports.view        Ver reportes
├── reports.export      Exportar reportes
├── cash.open           Abrir caja
├── cash.close          Cerrar caja / cortes
├── locations.view      Ver sucursales
├── locations.manage    Crear/editar sucursales
├── cedis.manage        Gestionar CEDIS
├── orders.view         Ver pedidos
├── orders.manage       Actualizar estatus de pedidos
├── settings.manage     Ajustes del sistema y empresa
├── users.manage        Administrar usuarios, roles y permisos
├── publications.manage Gestionar publicaciones
└── supervisor.approve  Aprobar acciones (opcional, configurable)
```

---

## 8. SISTEMA DE APARIENCIA

### 8.1 CSS Custom Properties (generadas desde `app_settings`)

```css
/* app_settings → CSS custom properties */
:root {
  --primary-hue: 210;        /* organization.primary_hue */
  --accent-hue: 150;         /* organization.accent_hue */
  --font-family: 'Montserrat', sans-serif;
  --font-scale: 1;
  --radius-base: 0.75;
  --density-gap: 0.75rem;
  --card-min-width: 260px;

  --primary: hsl(var(--primary-hue), 70%, 50%);
  --primary-foreground: hsl(var(--primary-hue), 70%, 98%);
  --accent: hsl(var(--accent-hue), 70%, 50%);
  --accent-foreground: hsl(var(--accent-hue), 70%, 98%);
  --radius: calc(var(--radius-base) * 1rem);
  --font-body: var(--font-family);
}

/* Modos de tema */
[data-theme="light"] { /* light mode vars */ }
[data-theme="dark"] { /* dark mode vars */ }
[data-theme="pos"] {
  /* POS mode: dark optimizado para touch-screen */
  /* Alto contraste, alta densidad, fondos oscuros */
}
```

### 8.2 Cómo afecta la apariencia a los componentes

```
Todos los componentes usan:
├── className={cn("base-styles", className)}  → permite override
├── Colores via Tailwind: bg-primary, text-accent, etc.
├── border-radius via var(--radius)
├── density via var(--density-gap) en gaps/paddings
├── font-scale via var(--font-scale) en textos
├── card-size via var(--card-min-width) en grid layouts
└── El POS theme (dark touch) se aplica en /pos globalmente
```

### 8.3 Configuración por empresa (Settings Page)

```
Sección Apariencia (/settings/appearance):
├── Color primario (color picker → primary_hue 0-360)
├── Color acento (color picker → accent_hue 0-360)
├── Tema: System / Light / Dark / POS
├── Fuente: Montserrat / Poppins / System
├── Escala de texto (slider 0.8 - 1.5)
├── Tamaño de cards: Pequeño / Mediano / Grande
├── Densidad: Compacta / Cómoda / Espaciosa
├── Redondeo de bordes (slider 0 - 2)
└── Estilo sidebar: Full / Compact / Collapsed
```

---

## FASE 0 — INFRAESTRUCTURA Y CONFIGURACIÓN BASE ✅

- ✅ 0.1 Crear proyecto Next.js 15 (App Router, TypeScript strict)
- ✅ 0.2 Configurar TailwindCSS v4
- ✅ 0.3 Instalar y configurar shadcn/ui
- ✅ 0.4 Instalar Motion (framer-motion v11+)
- ✅ 0.5 Instalar Zustand
- ✅ 0.6 Instalar TanStack Query + TanStack Table
- ✅ 0.7 Instalar react-hook-form + yup
- ✅ 0.8 Configurar NextAuth v4
- ✅ 0.9 Configurar Prisma ORM (schema MySQL)
- ✅ 0.10 Configurar ESLint + Prettier
- ✅ 0.11 Configurar path aliases (`@/`)
- ✅ 0.12 Crear estructura de carpetas completa
- ✅ 0.13 Configurar .env.local y .env.example
- ✅ 0.14 Configurar next.config.ts
- ✅ 0.15 Configurar postcss.config.js (implementado como `postcss.config.mjs`, formato oficial de Next 15)
- ✅ 0.16 Configurar components.json (shadcn)
- ✅ 0.17 Copiar fonts a assets/fonts/ (Montserrat, Poppins, SpaceMono)
- ✅ 0.18 Crear assets/sounds/ con nombres de archivo establecidos
- ✅ 0.19 Configurar fonts en globals.css y layout.tsx
- ✅ 0.20 Crear providers base (Query, Auth, Theme, Mobile)

---

## FASE 1 — BASE DE DATOS ✅

- ✅ 1.1 Diseñar schema Prisma completo (48 tablas + 15 enums)
- ✅ 1.2 Generar migraciones Prisma
- 3 migraciones: `init`, `system_roles_nullable_org`, `customer_phone_unique_inventory_check` (índice único phone por org; el CHECK XOR de inventory no aplica en MySQL 8, error 3823 + FK SET NULL → validación en app)
- ✅ 1.3 Crear seeders
- ✅ 1.3.1 production.ts (SuperAdmin, 30 permisos, 4 roles default, 8 unidades del sistema)
- ✅ 1.3.2 demo.ts (org "Supermercado Demo", 3 sucursales + CEDIS, 6 cajas, 50 productos, 10 clientes, 10 promos, 100 ventas históricas, 20 pedidos) — nota: menos volumen que el plan (50 productos / 10 clientes) para seed rápido (~10s)
- ✅ 1.4 Configurar Prisma client singleton (`src/lib/db/client.ts`, hecho en FASE 0)
- ✅ 1.5 Crear tipos TypeScript derivados del schema (`src/types/database.ts`)

---

## FASE 2 — AUTENTICACIÓN Y AUTORIZACIÓN ✅

- ✅ 2.1 Configurar NextAuth v4 (credentials provider, JWT, session callback)
- Resolución por email | código de nómina | nº de cliente; scopes: superadmin/app/portal; permisos embedidos en JWT
- ✅ 2.2 Login POS (`/auth/login`) — email|nómina + password
- ✅ 2.3 Login Cliente (`/portal/auth/login`) — email|nºcliente + password
- ✅ 2.4 Landing page con botón WhatsApp (en vez de registro público)
- ✅ 2.5 Forgot password flow (tokens guardados hasheados, expiran 1h; en dev se muestra el enlace)
- ✅ 2.6 Post-login redirect por rol (`src/lib/auth/redirect.ts`)
- ✅ 2.7 Auth middleware (`src/middleware.ts`: /pos, /admin, /portal)
- ✅ 2.8 RBAC: 30 permisos + 4 roles de sistema con validación en UI (usePermission) y server (assertPermission)
- Nota: FASE 14 ampliará el sistema de permisos (CRUD de roles, matriz, approvals)
- ✅ 2.9 Registro de empleados desde admin (helper createEmployeeUser; CRUD en FASE 7)
- ✅ 2.10 Registro de clientes desde admin/POS (helper createCustomerUser; CRUD en FASE 7)
- ✅ 2.11 Onboarding wizard para nuevos owners (stub en /auth/onboarding; wizard réal en FASE 7)
- ✅ 2.12 Modo demo (botones por rol en login, solo en desarrollo)
- ✅ 2.13 Cambio de contraseña (/auth/change-password + POST /api/auth/change-password)
- Migración nueva: `20260811060000_user_password_reset` (columnas de reset en users)

---

## FASE 3 — SISTEMA DE APARIENCIA ✅

- ✅ 3.1 CSS custom properties desde app_settings
- `src/lib/appearance.ts` (modelo), `src/lib/appearance-apply.ts` (aplica var al DOM: hues, tipografía, escala, densidad, radio, tarjetas, sidebar)
- ✅ 3.2 Tema: light, dark, pos (high-density dark: fuerza densidad compacta)
- ✅ 3.3 Parámetros: primary_hue, accent_hue, font_family, font_scale, density, border_radius, card_size (+ sidebar_style)
- ✅ 3.4 Configuración por empresa (`/admin/settings/appearance` + GET/PATCH `/api/settings/appearance` con permiso settings.manage)
- ✅ 3.5 Persistencia localStorage (tema + overrides del dispositivo) + cross-tab sync (evento storage)
- ✅ 3.6 Splash screen con tema del tenant (`src/components/appearance/splash.tsx`)
- ✅ 3.7 Aplicación de tema en tiempo real (sin recarga): el formulario edita el store y el provider reaplica al instante

---

## FASE 4 — COMPONENTES BASE ✅

- ✅ 4.1 Instalar 46+ componentes shadcn/ui (40 instalados: accordion, alert, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, dialog, drawer, dropdown-menu, hover-card, input, input-group, input-otp, label, pagination, popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip)
- ✅ 4.2 InputGroup (`src/components/base/input-group-field.tsx`: `InputGroupField` = label + InfoTooltip + icono + addons + hint/error; re-exporta `InputGroup` compuesto de shadcn)
- ✅ 4.3 InfoTooltip (`src/components/base/info-tooltip.tsx`)
- ✅ 4.4 FormCombobox (`src/components/base/form-combobox.tsx`: searchable + sync `RefreshCw` + create inline + preserva selección)
- ✅ 4.5 DatePicker (`src/components/base/date-picker.tsx`, DD/MM/YYYY, react-day-picker v10, dropdown meses/años)
- ✅ 4.6 TimePicker (`src/components/base/time-picker.tsx`, HH:MM AM/PM con segmentos)
- ✅ 4.7 DateTimePicker (`src/components/base/date-time-picker.tsx`)
- ✅ 4.8 DataTable (`src/components/base/data-table.tsx`: ordenamiento, búsqueda global, faceted, paginación, selección, visibilidad de columnas, responsive cards móvil)
- ✅ 4.9 Attachment (`src/components/base/attachment.tsx`: upload + preview imagen/PDF + drag & drop + reemplazar/quitar)
- ✅ 4.10 Spinner + Skeleton (`spinner.tsx` nuevo; skeleton ya era shadcn)
- ✅ 4.11 AnimatedNumber (`animated-number.tsx`, spring con framer-motion `animate`)
- ✅ 4.12 InfoField (`info-field.tsx`)
- ✅ 4.13 SweetAlert2 wrappers (`src/lib/swal.ts`: swalToast, swalMessage, swalError, swalConfirm, swalLoading, swalPrompt) + theming en globals.css
- ✅ 4.14 GPS Picker (`gps-picker.tsx`: geolocalización + geocode/reverse Nominatim + mapa OSM + dirección completa)
- ✅ 4.15 Sound player (`src/lib/sounds.ts`: volume/rate + persistencia localStorage + `useSound`)
- Nota: `@tanstack/react-table` quedó en v8 (la v9 cambió la API; se prefirió la estable). `sweetalert2` agregado. Barrel `src/components/base/index.ts`.

---

## FASE 5 — LAYOUT Y NAVEGACIÓN ✅

- ✅ 5.1 AppNav (`src/components/layout/app-shell.tsx`: adaptativo — Sidebar desktop fija, BottomBar móvil, Drawer tablet)
- ✅ 5.2 Header sticky (`app-header.tsx`: logo, buscador, campana de notificaciones, menú de usuario) + `page-header.tsx`
- ✅ 5.3 User dropdown (`user-menu.tsx`: perfil, cambiar contraseña, preferencias, cerrar sesión)
- ✅ 5.4 Notifications bell (`notifications-bell.tsx`: badge animado con Motion, popover, SSE vía `use-notifications.ts` + store zustand; fallback demo hasta FASE 11)
- ✅ 5.5 Sidebar agrupada por secciones colapsables (`app-sidebar.tsx`, Collapsible + NavLink con indicador animado)
- ✅ 5.6 BottomTabBar móvil (`bottom-tab-bar.tsx`: 5 ítems principales filtrados por permiso)
- ✅ 5.7 NavigationDrawer (`navigation-drawer.tsx`: slide-in con overlay, cierre por ESC/focus)
- ✅ 5.8 Safe areas (`env(safe-area-inset-top/bottom)` en header, drawer y bottom bar; layout ya usa viewport-fit=cover)
- ✅ 5.9 Transiciones entre rutas (`route-transition.tsx`: AnimatePresence + usePathname, respeta prefers-reduced-motion)
- ✅ 5.10 Navigation adapted (un `AppShell` renderiza la UI correcta por breakpoint via CSS + MobileProvider)
- ✅ 5.11 Íconos y rutas UNA sola vez (`src/lib/nav.ts`: NAV_SECTIONS/BOTTOM_NAV + filtros por permiso server `filterNavSections` y cliente `filterNavSectionsByUser`)
- Nota: sidebar/placeholder `src/app/admin/[module]/page.tsx` para módulos de FASEs 7-10. Smoke HTTP 10/10 (login demo → /admin con shell completo, /admin/products y appearace 200).

---

## FASE 6 — PUNTO DE VENTA (POS) ✅

- ✅ 6.1 Layout POS (grid responsive: categorías + productos + ticket) — `src/components/pos/pos-app.tsx`
- ✅ 6.2 Category tabs (horizontal scroll, activa con estilo) — `catalog-panel.tsx`
- ✅ 6.3 Product grid (cards estandarizados: imagen, nombre, precio, stock badge) — `product-card.tsx`
- ✅ 6.3a Badge "A granel" en cards de productos bulk (diferente color/icono)
- ✅ 6.4 Búsqueda por SKU/código/nombre/barras
- ✅ 6.5 Escáner de barras (input con auto-focus, re-focus tras cada acción vía contador `scanRefocus`)
- ✅ 6.5a Modal de entrada para productos a granel: `bulk-modal.tsx`
- Al tocar producto granel → abre modal con:
  - Imagen + nombre del producto
  - Unidad de medida (kg, pieza, lt, etc.) — unidad principal + alternativa si `allow_split`
  - Input de cantidad/precio (NumPad grande) — `numpad.tsx`
  - Toggle: "Por cantidad" vs "Por monto" (ej: 1.5 kg ó $10.00)
  - Si allow_split: toggle entre unidad principal y alternativa
  - Precio calculado en tiempo real
  - Cantidad mínima/máxima/step validados
  - Botón "Agregar al ticket"
- Si es "por monto" ($10 de azúcar): se calcula la cantidad = monto / precio_por_unidad
- Si es "por cantidad" (1.5 kg): se calcula el total = cantidad × precio_por_unidad
- Redondeo a 2 decimales en el total
- ✅ 6.6 Panel de ticket (lista de items, cantidades +/-, subtotal por item) — `ticket-panel.tsx`
- ✅ 6.6a En ticket: productos granel muestran "1.5 kg × $18.00/kg = $27.00" (`bulkQuantityDisplay`)
- ✅ 6.6b Editar cantidad de producto granel en ticket → re-abre modal de entrada
- ✅ 6.7 Asociar cliente (buscar por nombre/teléfono/nº, ver puntos) — `customer-modal.tsx`
- ✅ 6.8 Descuento manual (con aprobación de supervisor >10%) + código de cupón (`discount-dialog.tsx` + `POST /api/pos/coupons/validate`)
- ✅ 6.9 Cálculo en vivo: subtotal, impuestos, descuentos, total (`src/lib/pos/pricing.ts` engine de promociones + `usePosTotals`)
- ✅ 6.10 Payment dialog: `payment-dialog.tsx`
- NumPad táctil para montos
- Denominaciones de efectivo ($20, $50, $100, $200, $500, $1000)
- Split payments (múltiples métodos: efectivo + tarjeta + wallet)
- Pago con puntos de lealtad
- Barra de progreso de pago
- Cambio calculado
- Permitir montos de más (overpayment)
- ✅ 6.11 Virtual keyboard (`virtual-keyboard.tsx`, toggle on/off)
- ✅ 6.12 Ticket/impresión (formato 80mm `@media print` + impresora, puntos acumulados + total) — `receipt.tsx`
- ✅ 6.13 Auto-focus en input de escaneo después de cada acción
- ✅ 6.14 Swipe-to-delete en items del ticket (framer-motion drag izquierdo, fondo rojo) — `ticket-item-row.tsx`
- ✅ 6.15 Cantidad mínima 1, step 0.1 (rejilla estándar; granel usa min/step del producto)
- ✅ 6.16 Abrir/Cerrar caja (`cash-register-panel.tsx` + `POST /api/pos/cash`: apertura, fondo, corte con cierre/esperado/diferencia)
- ✅ 6.17 Modal de catálogos (ver productos, clientes, promos, pedidos desde POS) — `catalogs-modal.tsx`
- ✅ 6.18 Panel colapsable de productos (show/hide toggle)
- ✅ 6.19 Supervisor approval (opcional, configurable; PIN en localStorage por demo, RBAC `supervisor.approve` en FASE 14) — `supervisor-gate.tsx`
- ✅ 6.20 Monitoreo de pedidos (semáforo: pending=amarillo, preparing=naranja, ready=verde, delivered=azul, cancelled=rojo; polling 15s `GET /api/pos/orders`)
- ✅ Persistencia: `POST /api/pos/sales` (transacción: Sale + SaleItems + SalePayments + SaleDiscounts + decremento de inventario + InventoryMovement + canje/generación de cupones + loyalty earn/redeem + folio por sucursal `Location.saleSeq`)
- ✅ Verificado: typecheck / lint / build + smoke HTTP 17/17 (login → /pos → catálogo → órdenes → caja → cupón → venta real con folio #35 e inventario decrementado)

---

## FASE 7 — CATÁLOGOS (CRUDs) ✅

- ✅ 7.1 Productos
- ✅ CRUD completo (crear, editar, activar/desactivar) — `/admin/products` + API `GET/POST/PATCH/DELETE /api/crud/products` (paginación, búsqueda, filtro por categoría/tipo)
- ✅ Selector de tipo: "Estándar" / "A granel" (al crear, cambia formulario; bloqueado en edición)
- ✅ Campos comunes: nombre, descripción, categoría (combobox), impuesto, imagen (URL), isActive, trackInventory
- ✅ ── Campos para ESTÁNDAR ──
  -  ✅ Variante inicial al crear + gestor de variantes al editar (crear/activar/eliminar; API `/api/crud/products/[id]/variants`)
  -  ✅ Opciones de variante (talla, color, contenido, etc.) — API `GET/PUT /api/crud/products/[id]/options` + `optionValueIds` en crear/editar variante
- ✅ ── Campos para A GRANEL ──
  -  ✅ Unidad de medida (combobox del catálogo de unidades)
  -  ✅ Precio por unidad de medida
  -  ✅ Cantidad mínima de venta / Step / Cantidad máxima
  -  ✅ Permitir venta fraccionada (allow_split)
  -  ✅ Unidad alternativa (si allow_split) + Precio por unidad alternativa
- ✅ Imagen (Attachment) — componente `Attachment` (drag & drop) + `/api/uploads` a `public/uploads/<orgId>`; usado en productos, variantes, categorías, clientes, empleados, sucursales, CEDIS y promociones
- ✅ Importación masiva (Excel .xlsx con plantilla; categoría por nombre, unidad por abreviatura; crea variante inicial estándar o granel)
- ✅ Exportación (Excel .xlsx)
- ✅ CRUD de unidades de medida (catálogo personalizado por empresa)
- ✅ 7.1a Unidades de Medida
- ✅ CRUD (nombre, abreviatura, tipo, factor de conversión) — `/admin/units`
- ✅ Unidades del sistema pre-cargadas (kg, g, lt, ml, pza, m, cm, peso)
- ✅ Unidades personalizadas por empresa
- ✅ 7.2 Categorías
- ✅ CRUD completo (crear, editar, activar/desactivar) — `/admin/categories`
- ✅ Jerarquía (subcategorías; el import resuelve el padre por nombre)
- ✅ Imagen (Attachment) — ver 7.1
- ✅ Importación/Exportación (Excel .xlsx)
- ✅ 7.3 Clientes
- ✅ CRUD completo — `/admin/customers`
- ✅ Puntos (ajustar desde edición)
- ✅ Auto-crea user al registrar (email auto `cli-xxxx@portal.local` si no hay correo)
- ✅ Historial de puntos / Favoritos / Historial de compras-pedidos / Métodos de pago guardados — botón detalle (ojo) en `/admin/customers` + `GET /api/crud/customers/[id]/detail`
- ✅ Importación/Exportación (Excel .xlsx)
- ✅ 7.4 Empleados
- ✅ CRUD completo — `/admin/employees`
- ✅ Puestos (CRUD `/admin/positions` con select en el formulario de empleado)
- ✅ Nómina/código único
- ✅ Auto-crea user + membership al registrar (rol cashier; email auto `emp-CODIGO@empresa.local`)
- ✅ Asignación de sucursal base (Employee.locationId; migración `20260812060205_employee_location`)
- ✅ 7.5 Promociones
- ✅ CRUD completo — `/admin/promotions` (registro + API `GET/POST/PATCH/DELETE /api/crud/promotions`)
- ✅ 6 tipos de beneficio (percent_off, amount_off, fixed_price, buy_x_get_y, free_item, next_purchase_coupon)
- ✅ 4 alcances (order, category, product, variant)
- ✅ Scheduling (fechas inicio/fin, días de semana, horario desde/hasta)
- ✅ Cupones (couponCode en la promoción — redimido por el cajero; tabla Coupon/standalone queda como extra)
- ✅ Límites de uso (máximo global y por cliente)
- ✅ Exclusividad y prioridad
- ✅ Targets (multi-select de sucursales, categorías, productos, variantes y variante de regalo)
- ✅ 7.6 Sucursales
- ✅ CRUD completo — `/admin/locations`
- ✅ GPS (lat/lon + dirección completa) — `GpsPicker` integrado en el formulario (tipo de campo `gps` del CRUD genérico)
- ✅ Responsable y contacto
- ✅ Horarios de apertura
- ✅ Imagen (Attachment) — ver 7.1
- ✅ Pickup/Delivery toggle
- ✅ Folio secuencial (BD `Location.saleSeq`, ya usado por el POS)
- ✅ 7.7 CEDIS
- ✅ CRUD completo — `/admin/cedis` (nombre, código, dirección, GPS manual, encargado, horarios, imagen, notas)
- ✅ 7.8 Cajas
- ✅ CRUD por sucursal — `/admin/cashRegisters` (nombre, folio prefix, sucursal en select)
- ✅ 7.9 Puestos de empleado
- ✅ CRUD (nombre, descripción, isActive) — `/admin/positions`
- Nota: CRUD genérico — registro único con permisos RBAC (`src/lib/crud/modules.ts`) + API `/api/crud/{module}[/{id}]` con guard + UI adaptativa (`src/components/admin/crud/*`) con tabla, buscador, paginación, diálogo de alta/edición y borrado. Módulos implementados: productos (con variantes), unidades, categorías, clientes, empleados, puestos, sucursales, CEDIS, cajas.

---

## FASE 8 — INVENTARIO ✅

- ✅ 8.1 Vista de inventario (por sucursal/CEDIS, con filtros) — `/admin/inventory` + `GET /api/inventory`
- ✅ Filtro por tipo de producto (estándar / a granel) + búsqueda + "solo bajo stock"
- ✅ Stock en unidad de medida correcta (kg, pza, lt, etc.)
- ✅ Columna "Unidad" en la tabla; filas auto-creadas por ubicación (lazy)
- ✅ 8.2 Movimientos (purchase, sale, adjustment, transfer_in, transfer_out, return) — `POST /api/inventory/movements`
- ✅ Para granel: cantidad en unidad de medida (ej: 1.5 kg)
- ✅ Movimientos registran unit_id
- ✅ 8.3 Stock mínimo (min_threshold; alertas SSE pendientes con 8.9) — `POST /api/inventory/threshold`
- ✅ 8.4 Historial de movimientos (con empleado vinculado) — `GET /api/inventory/movements` (tab Historial)
- ✅ Muestra unidad de medida en cada movimiento
- ✅ 8.5 Revisiones físicas de inventario
- ✅ Vista de conteo con lector de barras o manual — `GET/POST /api/inventory/revisions`
- ✅ Checklist por producto (escaneado/encontrado) — `PATCH /api/inventory/revisions/[id]/items/[itemId]`
- ✅ Diferencias calculadas automáticamente (se aplican como ajustes al completar)
- ✅ Permiso `inventory.revision` respetado en API y UI
- ✅ 8.6 Importación masiva de inventario — `POST /api/inventory/import` (Excel: SKU / código de barras / nombre + cantidad; ajusta existencias y registra movimiento)
- ✅ 8.7 Exportación de inventario (PDF profesional) — `GET /api/inventory/export` (pdfkit, encabezado de empresa, tabla con estados, resumen bajo stock)
- ✅ 8.8 Transferencias entre sucursales/CEDIS — `POST /api/inventory/transfers` (transfer_out + transfer_in)
- ✅ 8.9 Notificación de stock bajo (SSE en tiempo real)
- ✅ Endpoint `GET /api/notifications/stream` (SSE con canal por organización, heartbeat y carga de pendientes)
- ✅ Se dispara en ventas POS, movimientos, transferencias, revisiones y/o importación cuando el stock cae al mínimo
- ✅ Persistida en `notifications` (kind `low_stock`) con dedupe por ítem y broadcast en vivo a la campana

---

## FASE 9 — VENTAS E HISTORIAL ✅

- ✅ 9.1 Historial de ventas (DataTable con filtros: fecha, sucursal, empleado, caja)
- ✅ 9.2 Detalle de venta (ticket completo con items, pagos, descuentos)
  - ✅ Items granel muestran: "1.5 kg × $18.00/kg = $27.00"
  - ✅ Items standard muestran: "2 × $25.00 = $50.00"
- ✅ 9.3 Reimpresión de tickets
- ✅ 9.4 Precio histórico (no afecta ventas/reportes pasados)
- ✅ 9.5 Folios secuenciales por sucursal
- ✅ 9.6 Exportación de ventas (Excel + PDF)

---

## FASE 10 — REPORTES Y ANALYTICS ✅

- 10.1 ✅ Dashboard (ventas por día, por método de pago, top productos, márgenes)
- 10.2 ✅ Reportes con filtros avanzados (fecha, sucursal, empleado, caja, período)
- 10.3 ✅ Exportar reportes (Excel + PDF profesional con diseño)
- 10.4 ✅ Gráficas interactivas (Recharts)
- 10.5 ✅ Reporte de inventario (PDF profesional) — `GET /api/inventory/export` (FASE 8.7)
- 10.6 ✅ Reporte de corte de caja
- 10.7 ✅ Reporte de pedidos
- 10.8 ✅ Reporte de clientes (top, por puntos, por compras)

---

## FASE 11 — NOTIFICACIONES (SSE) ✅

- ✅ 11.1 SSE route handler (`/api/notifications/stream`) — canal por organización, heartbeat, carga de pendientes y broadcast
- ✅ 11.2 Centro de notificaciones (lista completa, mark-as-read individual y batch) — `/admin/notifications` + `GET /api/notifications`, `PATCH /api/notifications/[id]`, `POST /api/notifications/read-all`
- ✅ 11.3 Notifications bell (badge en tiempo real, popover) — enlace "Ver todas" al centro; lectura sincronizada al servidor desde el store
- ✅ 11.4 Toast de notificaciones (SweetAlert2 theming) — `swalNotificationToast` (clic → navega al link)
- ✅ 11.5 Sonido al recibir notificación — `playSound` según icono (sale-complete, low-stock, order-received, order-ready, notification)
- ✅ 11.6 Notificaciones por evento:
  - ✅ Venta completada — `notifySaleCompleted` en `createSale` (kind `sale`, link a ventas)
  - ✅ Stock bajo — persistida + SSE (8.9) con empleado vinculado
  - ✅ Pedido nuevo / listo / entregado / cancelado — helper `notifyOrderEvent` listo en `src/lib/notifications/events.ts`; se activa cuando exista el flujo de pedidos (FASE 12/13)
- ✅ 11.7 Empleado vinculado a cada movimiento/notificación — `employeeId` persistido en `Notification` (ventas, movimientos de inventario, low-stock)

---

## FASE 12 — PEDIDOS Y PREPARACIÓN ✅

- ✅ 12.1 CRUD pedidos (vista admin con estados y filtros) — `src/lib/orders/server.ts` + `/admin/orders` (listado, detalle, cambiar estado, filtros). La creación del pedido llega con el flujo del portal (FASE 13); las rutas API quedan en `/api/orders`
- ✅ 12.2 Order status history (cada cambio con empleado + timestamp) — `status_history` registrado en cada `updateOrderStatus`
- ✅ 12.3 Página de preparación de pedido — `/admin/orders/[id]/prepare`
  - ✅ Datos del pedido (cliente, productos, entrega)
  - ✅ Timer en tiempo real (cuánto se tarda el empleado)
  - ✅ Empleado vinculado a la preparación
  - ✅ Check-list de productos (escaneo con lector o conteo manual)
  - ✅ Progreso: "3 de 10 productos encontrados"
  - ✅ Comentarios por item
  - ✅ Observación general (opcional)
- ✅ 12.4 Mapa de monitoreo de pedidos (semáforo de estados) — `/admin/orders/monitoring` con grupos por estado
- ✅ 12.5 Notificaciones de cada cambio de estado (SSE) — `notifyOrderEvent` disparado en `updateOrderStatus`

---

## FASE 13 — PORTAL DE CLIENTES ✅

- ✅ 13.1 Layout portal (diseño tipo Cinépolis/app nativa) — `src/components/portal/portal-shell.tsx` (header + bottom nav + carrito + modal granel); route group `(shop)`
- ✅ 13.2 Home del portal — `home-client.tsx`
  - ✅ Puntos acumulados
  - ✅ Promociones/descuentos activos
  - ✅ Banners de pedidos activos con estatus
  - ✅ Productos nuevos
  - ✅ Publicaciones/avisos
- ✅ 13.3 Tienda (catálogo con categorías, búsqueda, filtros) — `store-client.tsx`
- ✅ 13.4 Product cards — `product-card.tsx`
  - ✅ Standard: imagen, precio fijo, variantes selectoras
  - ✅ A granel: imagen, precio por unidad badge ("$18.00/kg"), badge "A granel"
  - ✅ Si allow_split: mostrar ambas unidades ("$18/kg ó $5/pza")
- ✅ 13.5 Carrito — `portal-store.ts` + `cart-sheet.tsx` + `bulk-modal.tsx`
  - ✅ Grid de catálogo (no solo lista)
  - ✅ Limitar según stock disponible
  - ✅ Bloquear productos sin stock
  - ✅ Botón "Notificar sin stock" al producto (aviso local; sin modelo de BD dedicado)
  - ✅ Comentario por producto seleccionado
  - ── STANDARD ──
    - ✅ Selector de variante
    - ✅ Cantidad con +/- (step 1; el step 0.1 aplica a granel vía bulk_step)
  - ── A GRANEL ──
    - ✅ Al agregar producto granel → abre modal de entrada:
      - ✅ Unidad de medida (kg, pza, lt, etc.)
      - ✅ Input de cantidad (numérico +/-)
      - ✅ Toggle "Por cantidad" vs "Por monto"
      - ✅ Precio calculado en tiempo real
    - ✅ En carrito: mostrar "1.5 kg × $18.00/kg = $27.00"
    - ✅ Editar cantidad (re-abre modal / +/- con step)
    - ✅ Limitar según stock en unidad de medida
    - ✅ Step según configuración del producto (bulk_step)
- ✅ 13.6 Checkout — `checkout-client.tsx` + campos `address/latitude/longitude/paymentMethod/paymentReference` en `Order` (migración 20260813010000)
  - ✅ Selección: pickup en sucursal O delivery a domicilio
  - ✅ Selector de sucursal para pickup
  - ✅ Dirección de entrega (con GPS)
  - ✅ Métodos de pago (en sucursal o tarjeta guardada; la pasarela llega en FASE 16)
- ✅ 13.7 Tracking de pedido en tiempo real (SSE) — `/api/portal/orders/[id]/stream` + `broadcastOrderStatus` en `updateOrderStatus`
- ✅ 13.8 Cancelar pedido (si no fue reclamado/confirmado) — `pending`/`confirmed`
- ✅ 13.9 Favoritos (CRUD) — `/api/portal/favorites`
- ✅ 13.10 Listas de compra (CRUD + duplicar) — `/api/portal/lists`
- ✅ 13.11 Historial de pedidos — `orders-client.tsx`
- ✅ 13.12 Puntos acumulados + historial de lealtad — `loyalty-client.tsx`
- ✅ 13.13 Perfil de cliente (editar datos) — `profile-client.tsx`
- ✅ 13.14 Métodos de pago guardados (last4, brand, exp_month, exp_year) — `payment-methods-client.tsx`
- ✅ 13.15 Notificación de tarjetas por vencer — `listExpiringCards` (próximos 2 meses)

---

## FASE 14 — SISTEMA DE PERMISOS Y MENÚ DINÁMICO ✅

### 14.1 CRUD de Roles ✅

- ✅ Crear, editar, duplicar roles
- ✅ Roles del sistema no se borran (is_system flag)

### 14.2 Matriz de Permisos ✅

- ✅ 23+ permisos predefinidos, por sección
- ✅ Checkboxes por sección (marcar todos los de un módulo)
- ✅ Solo lectura / Solo escritura
- ✅ Duplicar rol existente como base

### 14.3 Asignación de Permisos por Rol ✅

- ✅ Asignar/quitar permisos a roles
- ✅ Defaults por rol (owner=todos, manager=todos-excepto-users, cashier=POS+view)

### 14.4 Menú Dinámico (BD) ✅

- Tabla `menus` multinivel (`parentId`, `type`, `icon`, `href`, `badge`, `permissionKey`, `sortOrder`) + seed global (`prisma/seeders/production.ts` → `SYSTEM_MENUS`)

```
TABLA: menus
├── id: UUID (PK)
├── parent_id: UUID (FK → menus.id, self-ref, NULL = raíz)
├── type: VARCHAR(20) NOT NULL     -- 'section' | 'item'
├── label: VARCHAR(100) NOT NULL   -- "Catálogos", "Productos", etc.
├── icon: VARCHAR(50)              -- Nombre del ícono Lucide (Package, Tags, etc.)
├── href: VARCHAR(255)             -- Ruta: "/admin/products" (NULL si es section)
├── badge: VARCHAR(50)             -- Leyenda opcional: "NEW", "3", etc.
├── badge_variant: VARCHAR(20)     -- 'default' | 'destructive' | 'secondary' | 'outline'
├── permission_key: VARCHAR(50)    -- FK → permissions.key (NULL = visible para todos)
├── sort_order: INT DEFAULT 0      -- Posición en el menú
├── is_active: BOOLEAN DEFAULT true
├── created_at, updated_at
```

### Ejemplo de estructura multinivel:

```
menus (en BD):
│
├── id:1  parent:NULL  type:section  label:"Principal"      icon:"LayoutDashboard"  sort:1
│   ├── id:2  parent:1  type:item  label:"Panel"     href:"/admin"              icon:"LayoutDashboard"  sort:1  perm:NULL
│   ├── id:3  parent:1  type:item  label:"POS"       href:"/pos"                icon:"ShoppingCart"     sort:2  perm:pos.use
│   ├── id:4  parent:1  type:item  label:"Ventas"    href:"/admin/sales"        icon:"DollarSign"       sort:3  perm:sales.view
│   └── id:5  parent:1  type:item  label:"Reportes"  href:"/admin/reports"      icon:"BarChart3"        sort:4  perm:reports.view
│
├── id:10 parent:NULL  type:section  label:"Catálogos"      icon:"Package"          sort:2
│   ├── id:11 parent:10 type:item  label:"Productos"  href:"/admin/products"    icon:"Package"          sort:1  perm:products.view
│   ├── id:12 parent:10 type:item  label:"Categorías" href:"/admin/categories"  icon:"Tags"             sort:2  perm:categories.manage
│   ├── id:13 parent:10 type:item  label:"Clientes"   href:"/admin/customers"   icon:"Users"            sort:3  perm:customers.view
│   ├── id:14 parent:10 type:item  label:"Empleados"  href:"/admin/employees"   icon:"UserCog"          sort:4  perm:employees.view
│   ├── id:15 parent:10 type:item  label:"Promociones" href:"/admin/promotions" icon:"Percent"          sort:5  perm:promotions.view
│   │
│   └── id:16 parent:10 type:item  label:"Inventario" href:"/admin/inventory"   icon:"Boxes"            sort:6  perm:inventory.view
│       ├── id:17 parent:16 type:item  label:"Stock"         href:"/admin/inventory"            icon:"PackageOpen"    sort:1  perm:inventory.view
│       ├── id:18 parent:16 type:item  label:"Movimientos"   href:"/admin/inventory/movements"  icon:"ArrowLeftRight" sort:2  perm:inventory.manage
│       └── id:19 parent:16 type:item  label:"Revisiones"    href:"/admin/inventory/revisions"  icon:"ClipboardCheck" sort:3  perm:inventory.revision
│
├── id:20 parent:NULL  type:section  label:"Operación"      icon:"ClipboardList"    sort:3
│   ├── id:21 parent:20 type:item  label:"Sucursales" href:"/admin/locations"   icon:"MapPin"           sort:1  perm:locations.view
│   ├── id:22 parent:20 type:item  label:"CEDIS"      href:"/admin/cedis"        icon:"Warehouse"        sort:2  perm:cedis.manage
│   ├── id:23 parent:20 type:item  label:"Pedidos"    href:"/admin/orders"       icon:"ClipboardList"    sort:3  perm:orders.view badge:"3" badge_variant:"destructive"
│   └── id:24 parent:20 type:item  label:"Cajas"      href:"/admin/cash-registers" icon:"CreditCard"     sort:4  perm:cash.open
│
├── id:30 parent:NULL  type:section  label:"Administración"  icon:"Shield"           sort:4
│   ├── id:31 parent:30 type:item  label:"Usuarios"   href:"/admin/users"        icon:"Users"            sort:1  perm:users.manage
│   ├── id:32 parent:30 type:item  label:"Roles"      href:"/admin/roles"        icon:"ShieldCheck"      sort:2  perm:users.manage
│   └── id:33 parent:30 type:item  label:"Menú"       href:"/admin/settings/menus" icon:"Menu"           sort:3  perm:users.manage
│
└── id:40 parent:NULL  type:section  label:"Ajustes"        icon:"Settings"          sort:5
    ├── id:41 parent:40 type:item  label:"Apariencia" href:"/admin/settings/appearance" icon:"Palette"  sort:1  perm:settings.manage
    ├── id:42 parent:40 type:item  label:"Empresa"    href:"/admin/settings/company"    icon:"Building" sort:2  perm:settings.manage
    ├── id:43 parent:40 type:item  label:"Unidades"   href:"/admin/settings/units"       icon:"Ruler"    sort:3  perm:settings.manage
    ├── id:44 parent:40 type:item  label:"Pagos"      href:"/admin/settings/payments"    icon:"CreditCard" sort:4 perm:settings.manage
    └── id:45 parent:40 type:item  label:"General"    href:"/admin/settings"             icon:"Settings" sort:5  perm:settings.manage
```

### Renderizado multinivel:

```
SIDEBAR (desktop):
┌──────────────────────────────┐
│ 🔲 Multi-POS                 │
├──────────────────────────────┤
│ ▼ PRINCIPAL                  │  ← Section (type=section)
│   📊 Panel                   │  ← Item (level 1)
│   🛒 POS                     │  ← Item
│   💰 Ventas                  │  ← Item
│   📈 Reportes                │  ← Item
├──────────────────────────────┤
│ ▼ CATÁLOGOS                  │  ← Section
│   📦 Productos               │  ← Item
│   🏷️ Categorías              │  ← Item
│   👥 Clientes                │  ← Item
│   👨‍💼 Empleados               │  ← Item
│   🏷️ Promociones             │  ← Item
│   ▶ 📊 Inventario            │  ← Item con hijos (collapsible)
│     📦 Stock                 │  ← Sub-item (level 2)
│     ↔️ Movimientos           │  ← Sub-item
│     📋 Revisiones            │  ← Sub-item
├──────────────────────────────┤
│ ▶ OPERACIÓN                  │  ← Section (colapsada)
│ ▶ ADMINISTRACIÓN             │  ← Section (colapsada)
│ ▶ AJUSTES                    │  ← Section (colapsada)
└──────────────────────────────┘
```

### 14.5 Lógica de permisos en menú ✅

- `src/lib/menus/server.ts` → `getMenuTree(permissions, isAdmin)`: filtra por `permissionKey`, conserva secciones con hijos visibles; `/api/menus` (GET) lo expone ya filtrado por sesión.

```
FLUJO:
1. Al cargar sesión → fetch menús del servidor (/api/menus)
2. Servidor filtra: WHERE is_active = true
3. Servidor verifica permiso por cada item:
   - Si permission_key IS NULL → siempre visible
   - Si permission_key → verificar con hasPermission(org, user, key)
4. Retornar árbol filtrado al cliente
5. Sidebar/BottomBar/Drawer renderizan el árbol

EN lib/nav.ts (ACTUALIZADO):
- NAV_SECTIONS se vuelve función que recibe árbol de BD
- filterNavSections sigue como fallback hardcodeado
- Nuevo hook useMenus() que fetch desde la API
```

### 14.6 CRUD de Menús (desde admin) ✅

- `/admin/settings/menus` + `menus-manager.tsx` (crear/editar/borrar secciones e items, ícono Lucide con preview, badge, permiso, padre, reordenar arriba/abajo). API: `/api/menus` (POST), `/api/menus/[id]` (PATCH/DELETE), `/api/menus/reorder`.

```
/admin/settings/menus → Gestión del menú

┌──────────────────────────────────────────────────────────────┐
│  Gestión de Menú                                              │
│                                                               │
│  [Agregar sección] [Agregar item]                             │
│                                                               │
│  ▼ Principal (drag para reordenar)                            │
│    📊 Panel              /admin            [editar] [borrar]  │
│    🛒 POS                /pos              [editar] [borrar]  │
│    💰 Ventas             /admin/sales      [editar] [borrar]  │
│  ──────────────────────────────────────                       │
│  ▼ Catálogos                                                  │
│    📦 Productos          /admin/products   [editar] [borrar]  │
│    🏷️ Categorías         /admin/categories [editar] [borrar]  │
│    ▶ 📊 Inventario       /admin/inventory  [editar] [borrar]  │
│      📦 Stock            /admin/inventory  [editar] [borrar]  │
│      ↔️ Movimientos      /admin/inventory/movements [editar]  │
│                                                               │
│  [Drag & drop para reordenar y mover entre secciones]         │
└──────────────────────────────────────────────────────────────┘

CAMPOS DEL FORMULARIO:
├── Tipo: Section / Item
├── Label: Nombre visible en el menú
├── Ícono: Selector de ícono Lucide (con preview)
├── Ruta: href (solo si es item)
├── Badge: Texto de leyenda (opcional)
├── Badge variante: Default / Destructive / Secondary / Outline
├── Permiso requerido: FormCombobox de permisos (NULL = todos)
├── Menú padre: FormCombobox multinivel (para sub-items)
├── Orden: Número de posición (drag & drop)
└── Activo: Toggle
```

### 14.7 BottomTabBar y NavigationDrawer ✅

- `useMenus()` carga el árbol de BD; sidebar y drawer renderizan multinivel; BottomBar deriva los 5 primeros items con `href`; fallback hardcodeado (`NAV_SECTIONS`/`BOTTOM_NAV`) mientras carga.

```
BOTTOM TAB BAR (móvil):
├── Se alimenta de menús con parent_id = NULL
├── Se muestran los primeros 5 items de mayor sort_order
├── Si el menú se modifica desde admin → se refleja en BottomBar
└── hook useMenus() reactiva re-render

NAVIGATION DRAWER (tablet):
├── Muestra el árbol completo igual que sidebar
├── Se alimenta de la misma fuente (BD)
└── Collapsible multinivel
```

### 14.8 Supervisor Approval System ✅

- ✅ Desde settings: "Activar aprobación de supervisor para: [acciones]"
- ✅ Al activar una acción restringida → dialog pide clave de supervisor
- ✅ Clave cambiable desde perfil del supervisor

### Resumen de cambios:


| Capa                      | Cambio                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| **BD: menus**             | Nueva tabla multinivel (parent_id, type, icon, href, badge, permission_key, sort_order) |
| **Seeders**               | Insertar menú completo predefinido (secciones + items + multinivel)                    |
| **Services: menus.ts**    | CRUD de menús + fetch árbol filtrado por permisos                                     |
| **lib/nav.ts**            | Actualizar para consumir de BD (con fallback hardcoded)                                 |
| **app-sidebar.tsx**       | Renderizar árbol multinivel dinámico                                                  |
| **bottom-tab-bar.tsx**    | Consumir de BD (top 5 items)                                                            |
| **navigation-drawer.tsx** | Consumir árbol completo de BD                                                          |
| **/admin/settings/menus** | Página CRUD de menú con drag & drop                                                   |
| **useMenus hook**         | Hook para fetch de menús del servidor                                                  |

---

## FASE 15 — AJUSTES DEL SISTEMA ✅

- ✅ 15.1 Perfil de usuario (ver/editar, cambiar contraseña, avatar) — `/admin/profile` + `profile-form.tsx`; cambio de contraseña en `/auth/change-password` (FASE 2)
- ✅ 15.2 Datos de empresa (logo, razón social, RFC, dirección, contacto) — `/admin/settings/company` + `company-form.tsx` (CompanyProfile)
- ✅ 15.3 Apariencia (colores, fonts, density, radius, theme, sidebar) — `/admin/settings/appearance` (FASE 3)
- ✅ 15.4 Gestión de usuarios (CRUD + roles + membresías) — `/admin/settings/users` + `users-manager.tsx` (cambio de rol, activar/desactivar, quitar miembro; matriz de permisos por módulo con "todos"; crear/duplicar/eliminar roles)
- ✅ 15.5 Invitaciones de usuarios (por email) — pestaña "Invitaciones" (crear/revocar); el envío de email y el flujo de aceptación quedan pendientes de un proveedor SMTP (se registra `UserInvitation`)
- ✅ 15.6 Configuración de lealtad (puntos por compra, valor del punto) — `/admin/settings/loyalty`
- ✅ 15.7 Configuración de supervisor approval (qué acciones requieren) — `/admin/settings/supervisor` (JSON `supervisorApproval` en Organization)
- ✅ 15.8 Configuración de pasarelas de pago — `/admin/settings/payments` (FASE 16)

---

## FASE 16 — PASARELAS DE PAGO ✅

- ✅ 16.1 Estructura y lógica para Stripe — `src/lib/payments/server.ts`: create checkout session (REST), webhook con verificación HMAC (`verifyStripeSignature`) en `/api/payments/webhook/stripe`
  - ✅ Create checkout session
  - ✅ Webhook handler
  - ⏳ Vinculación de terminal (opcional) — no implementado
- ✅ 16.2 Estructura y lógica para MercadoPago — create preference (REST) + webhook (`/api/payments/webhook/mercadopago?org=…`)
  - ✅ Create preference
  - ✅ Webhook handler
  - ⏳ Vinculación de terminal (opcional) — no implementado
- ✅ 16.3 Configuración de pasarela por empresa — `/admin/settings/payments` + `payments-form.tsx` (claves por empresa, JSON `paymentGateway` en Organization)
- ✅ 16.4 Selectable: empresa elige entre Stripe o MercadoPago — selector de proveedor en el mismo formulario

Nota: pago confirmado marca el pedido `pending → confirmed` (SSE + notificación). Las claves reales se cargan en `/admin/settings/payments`; sin clave, el pago en línea devuelve error.

---

## FASE 17 — MULTI-PLATAFORMA ✅

- ✅ 17.1 Responsive: desktop (≥1024px), tablet (768-1023px), móvil (≤767px) — `AppShell` adaptativo (FASE 5)
- ✅ 17.2 BottomTabBar (móvil: Home, Tienda, Pedidos, Perfil) — `bottom-tab-bar.tsx` (admin) + bottom nav del portal
- ✅ 17.3 NavigationDrawer (tablet: slide-in desde izquierda) — `navigation-drawer.tsx` (FASE 5)
- ✅ 17.4 Safe areas iOS/Android (env safe-area-inset) — header/drawer/bottom bar (FASE 5.8)
- ✅ 17.5 Splash screen (con logo y tema del tenant) — `splash.tsx` (FASE 3.6)
- ✅ 17.6 PWA manifest (instalable desde navegador móvil) — `src/app/manifest.ts` + `src/app/icon.tsx`
- ✅ 17.7 Micro-interacciones (Motion: scale on tap 0.97, list stagger, page transitions) — `tap-scale.tsx` + stagger en listas del portal + `route-transition.tsx`
- ✅ 17.8 Pull-to-refresh en listas (móvil) — `pull-to-refresh.tsx` aplicado a pedidos/favoritos/listas del portal
- ✅ 17.9 El POS en móvil: diseño optimizado para pantalla completa — POS responsive (FASE 6)
- ✅ 17.10 El portal en móvil: se siente como app nativa — `portal-shell.tsx` mobile-first (FASE 13)

---

## FASE 18 — PUBLICACIONES (NEWSFEED) ✅

- ✅ 18.1 CRUD de publicaciones (título, contenido, imagen, tipo) — `src/lib/publications/server.ts` + `GET/POST /api/publications`, `PATCH/DELETE /api/publications/[id]`
- ✅ 18.2 Tipos: producto_nuevo, promoción, aviso — enum `PublicationType` + badges por tipo
- ✅ 18.3 Vista de publicaciones para clientes (home del portal) — `home-client.tsx` (sección Avisos con tipo/imagen)
- ✅ 18.4 Banners promocionales en el portal — carrusel de publicaciones con imagen en el home del portal
- ✅ 18.5 Gestión desde admin (/publications) — `/admin/publications` + `publications-manager.tsx` (permiso `publications.manage`)

---

## FASE 19 — IMPORTACIÓN Y EXPORTACIÓN ✅

- ✅ 19.1 Exportar productos (Excel) — `GET /api/crud/products/export` (FASE 7.1)
- ✅ 19.2 Importar productos (Excel con plantilla) — `POST /api/crud/products/import` + `src/lib/excel/spreadsheet.ts`
  - ✅ Dropdowns en celdas para categorías (catálogo) — data validation de Excel ("Categoría" y "Tipo")
  - ✅ Instrucciones claras de llenado — hoja "Instrucciones" en el archivo exportado
  - ✅ Validación de columnas (error si falta columna requerida) — `requiredHeaders` por módulo
  - ✅ Preview antes de importar — `previewWorkbook` + diálogo de vista previa en `crud-page.tsx`
- ✅ 19.3 Exportar clientes (Excel) — `GET /api/crud/customers/export` (FASE 7.3)
- ✅ 19.4 Importar clientes (Excel con validación) — `POST /api/crud/customers/import` (FASE 7.3)
- ✅ 19.5 Exportar inventario (PDF profesional con diseño) — `GET /api/inventory/export` (FASE 8.7)
- ✅ 19.6 Exportar ventas (Excel + PDF) — `GET /api/sales/export` (FASE 9.6)
- ✅ 19.7 Exportar reportes (PDF con diseño profesional, desglosado) — `GET /api/reports/export` (FASE 10.3)

---

## FASE 20 — CALIDAD Y PULIDO ✅

- ✅ 20.1 Loading states (Skeleton en cada página mientras carga) — `Skeleton` en listas del admin y portal
- ✅ 20.2 Empty states (animados con Motion, ilustraciones) — `src/components/shared/empty-state.tsx` aplicado a pedidos/favoritos/listas del portal
- ✅ 20.3 Error boundaries por sección — `src/app/error.tsx`, `global-error.tsx`, `admin/error.tsx`, `portal/(shop)/error.tsx`
- ✅ 20.4 Transiciones suaves entre rutas (AnimatePresence) — `route-transition.tsx`
- ✅ 20.5 Auto-focus en inputs críticos (POS escaneo) — `scanRefocus` (FASE 6.5/6.13)
- ✅ 20.6 Cards estandarizados en POS (mismo tamaño) — `product-card.tsx` del POS (FASE 6.3)
- ✅ 20.7 Modales 3-part (header fijo, body scroll, footer fijo) — `DialogHeader`/contenido scroll/`DialogFooter` de shadcn
- ✅ 20.8 Modales más anchos (max-w-2xl / max-w-3xl) — usados en CRUD, vista previa de import, etc.
- ✅ 20.9 Responsive design fixes — `AppShell` adaptativo + safe areas (FASE 5/17)
- ✅ 20.10 Sonidos contextualizados — `playSound` por evento (FASE 4.15 / 11.5)
- ✅ 20.11 Micro-interacciones en elementos clickeables — `TapScale`, stagger de listas, transiciones
- ✅ 20.12 Estados de carga con Spinner + Skeleton — `spinner.tsx` + `skeleton.tsx`
- ✅ 20.13 Navegación always fixed (sidebar, header, bottomBar) — `AppShell`
- ✅ 20.14 Solo el contenido principal es scrollable — layout flex con `<main>` como scroll
- ✅ 20.15 Flujo empleado (registro → login → abrir caja → venta → cerrar caja) — flujo funcional (FASE 6/7)
- ✅ 20.16 Flujo cliente (registro → login portal → pedido → tracking → entrega) — flujo funcional (FASE 7/12/13)

---

## REGLAS TRANSVERSALES DE UI

Estas reglas se aplican a TODOS los componentes del sistema:

### Inputs

- NUNCA usar `<select>` nativo → siempre Combobox de shadcn/ui
- Todo input usa InputGroup con icono (InputGroupAddon + InputGroupInput)
- Todo campo tiene label obligatorio + InfoTooltip
- Formularios con react-hook-form + yup
- Errores: `text-destructive text-sm` bajo el campo
- Teléfono: solo 10 dígitos (transform yup + onChange sanitizador)
- RFC/CURP/claves: mayúsculas (transform toUpperCase)
- Correo: minúsculas + formato email
- Montos: decimales con 2 posiciones

### Selects (Combobox)

- NUNCA select nativo
- Siempre con buscador integrado
- Botón sincronizar (RefreshCw) a la derecha
- Botón agregar (Plus) a la derecha (si tiene permiso)
- Sync: animate-spin + disabled durante carga
- Create: abre modal, al cerrar selecciona el nuevo registro

### Tablas (DataTable)

- Todas las tablas usan DataTable de shadcn/ui
- Ordenamiento por columna
- Filtros por columna
- Paginación inferior
- Selección múltiple (opcional)
- En móvil: cards apiladas
- Fechas: DD/MM/YYYY
- Hora: HH:MM AM/PM
- Moneda: $1,234.56
- Booleanos: Badge de color

### Modales (Dialog)

- 3 partes: Header fijo, Body con scroll, Footer fijo
- Header: icono + título + subtítulo
- Footer: botones de acción (confirmar, cancelar)
- Más anchos (max-w-2xl o max-w-3xl)
- Body con overflow-y-auto

### Micro-interacciones

- Hover: transition-colors, hover:bg-accent, hover:shadow
- Active: whileTap={{ scale: 0.97 }}
- Carga: Spinner + Skeleton
- Listas: stagger animation
- Rutas: AnimatePresence page transitions
- Empty states: animados

### Navegación

- Sidebar (desktop), Header (sticky), BottomTabBar (móvil), NavigationDrawer (tablet) → always fixed
- Solo <main> es scrollable (overflow-y-auto, h-dvh)

---

## SONIDOS DEL SISTEMA

Archivos en `public/sounds/`:


| Archivo              | Uso                     | Cuándo se reproduce               |
| ---------------------- | ------------------------- | ------------------------------------ |
| `notification.mp3`   | Notificación genérica | Al recibir notificación SSE       |
| `sale-complete.mp3`  | Venta completada        | Al confirmar cobro exitoso         |
| `error.mp3`          | Error/advertencia       | Al error en operación             |
| `scan.mp3`           | Escaneo de código      | Al escanear código de barras      |
| `cash-open.mp3`      | Apertura de caja        | Al abrir sesión de caja           |
| `cash-close.mp3`     | Cierre de caja          | Al cerrar sesión de caja          |
| `order-received.mp3` | Nuevo pedido            | Al recibir pedido del portal       |
| `order-ready.mp3`    | Pedido listo            | Al marcar pedido como ready        |
| `low-stock.mp3`      | Stock bajo              | Al recibir alerta de stock mínimo |

El usuario proporciona los archivos. El sistema solo referencia estos nombres.
La reproducción se hace con utilidad `playSound(name)` que usa `<audio>` element.
Cada empresa puede configurar en settings si los sonidos están activados o no.

---

## SEEDERS

### Producción (`prisma/seeders/production.ts`)

```
- SuperAdmin default (email: admin@multi-pos.com, password: temporal)
- 4 permisos base del sistema
- 4 roles default (superadmin, owner, manager, cashier)
- Permisos predefinidos (23+)
```

### Demo (`prisma/seeders/demo.ts`)

```
- 1 organización demo con company_profile y app_settings
- 3 sucursales (Matriz, Sucursal 2, Sucursal 3) con GPS
- 1 CEDIS
- 2 cajas por sucursal (6 total)
- 1 owner + 1 manager + 2 cashiers (con users y memberships)
- 5 empleados (con puestos: Cajero, Supervisor, Repartidor, Almacenero, Cocinero)
- 10 clientes (con users, puntos, favoritos, listas)
- 10 categorías (con jerarquía)
- 50 productos con variantes (diversos: abarrotes, electrónica, ropa, etc.)
- Stock por variante por sucursal
- 10 promociones activas (diversos tipos)
- 100 ventas históricas (con items, pagos, descuentos, puntos)
- 20 pedidos del portal (diversos estados)
- Notificaciones de ejemplo
- Publicaciones de ejemplo
```

---

## DEPLOYMENT (VPS Hostinger + Dokploy)

```
1. Clonar repo en VPS
2. Configurar .env con variables de producción:
   - DATABASE_URL (MySQL connection string)
   - NEXTAUTH_SECRET (generado con openssl rand -base64 32)
   - NEXTAUTH_URL (https://tu-dominio.com)
3. Dockerfile multi-stage:
   - Stage 1: npm install + prisma generate + prisma migrate deploy
   - Stage 2: npm run build
   - Stage 3: npm run start (Node.js server)
4. Configurar en Dokploy:
   - Puerto: 3000
   - Variables de entorno
   - Dominio
   - SSL (Let's Encrypt)
5. Dominios:
   - app.tudominio.com → POS/Admin
   - portal.tudominio.com → Portal de clientes (optional, or same domain)
```

---

*Plan generado: 2026-08-10*
*Última actualización: 2026-08-10*
