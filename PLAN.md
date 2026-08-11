# ═══════════════════════════════════════════════════════════════════════════════

# PLAN MAESTRO DE DESARROLLO — SISTEMA MULTI-POS

# ═══════════════════════════════════════════════════════════════════════════════

# 

# Stack: Next.js 15 | MySQL | Prisma | NextAuth v4 | React

# TailwindCSS v4 | shadcn/ui | Motion | Zustand | TanStack Query

# 

# Cada ítem lleva ✅ cuando se implementa completamente.

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
9. [FASE 0 — Infraestructura](#fase-0--infraestructura-y-configuración-base)
10. [FASE 1 — Base de Datos](#fase-1--base-de-datos)
11. [FASE 2 — Autenticación](#fase-2--autenticación-y-autorización)
12. [FASE 3 — Apariencia](#fase-3--sistema-de-apariencia)
13. [FASE 4 — Componentes Base](#fase-4--componentes-base) ✅
14. [FASE 5 — Layout y Navegación](#fase-5--layout-y-navegación) ✅
15. [FASE 6 — POS](#fase-6--punto-de-venta)
16. [FASE 7 — Catálogos CRUD](#fase-7--catálogos-cruds)
17. [FASE 8 — Inventario](#fase-8--inventario)
18. [FASE 9 — Ventas e Historial](#fase-9--ventas-e-historial)
19. [FASE 10 — Reportes](#fase-10--reportes-y-analytics)
20. [FASE 11 — Notificaciones SSE](#fase-11--notificaciones-sse)
21. [FASE 12 — Pedidos y Preparación](#fase-12--pedidos-y-preparación)
22. [FASE 13 — Portal de Clientes](#fase-13--portal-de-clientes)
23. [FASE 14 — Permisos](#fase-14--sistema-de-permisos)
24. [FASE 15 — Ajustes](#fase-15--ajustes-del-sistema)
25. [FASE 16 — Pasarelas de Pago](#fase-16--pasarelas-de-pago)
26. [FASE 17 — Multi-plataforma](#fase-17--multi-plataforma)
27. [FASE 18 — Publicaciones](#fase-18--publicaciones-newsfeed)
28. [FASE 19 — Importación/Exportación](#fase-19--importación-y-exportación)
29. [FASE 20 — Calidad y Pulido](#fase-20--calidad-y-pulido)
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

## FASE 0 — INFRAESTRUCTURA Y CONFIGURACIÓN BASE

-  ✅ 0.1 Crear proyecto Next.js 15 (App Router, TypeScript strict)
-  ✅ 0.2 Configurar TailwindCSS v4
-  ✅ 0.3 Instalar y configurar shadcn/ui
-  ✅ 0.4 Instalar Motion (framer-motion v11+)
-  ✅ 0.5 Instalar Zustand
-  ✅ 0.6 Instalar TanStack Query + TanStack Table
-  ✅ 0.7 Instalar react-hook-form + yup
-  ✅ 0.8 Configurar NextAuth v4
-  ✅ 0.9 Configurar Prisma ORM (schema MySQL)
-  ✅ 0.10 Configurar ESLint + Prettier
-  ✅ 0.11 Configurar path aliases (`@/`)
-  ✅ 0.12 Crear estructura de carpetas completa
-  ✅ 0.13 Configurar .env.local y .env.example
-  ✅ 0.14 Configurar next.config.ts
-  ✅ 0.15 Configurar postcss.config.js (implementado como `postcss.config.mjs`, formato oficial de Next 15)
-  ✅ 0.16 Configurar components.json (shadcn)
-  ✅ 0.17 Copiar fonts a assets/fonts/ (Montserrat, Poppins, SpaceMono)
-  ✅ 0.18 Crear assets/sounds/ con nombres de archivo establecidos
-  ✅ 0.19 Configurar fonts en globals.css y layout.tsx
-  ✅ 0.20 Crear providers base (Query, Auth, Theme, Mobile)

---

## FASE 1 — BASE DE DATOS

-  ✅ 1.1 Diseñar schema Prisma completo (48 tablas + 15 enums)
-  ✅ 1.2 Generar migraciones Prisma
  -  3 migraciones: `init`, `system_roles_nullable_org`, `customer_phone_unique_inventory_check` (índice único phone por org; el CHECK XOR de inventory no aplica en MySQL 8, error 3823 + FK SET NULL → validación en app)
-  ✅ 1.3 Crear seeders
  -  ✅ 1.3.1 production.ts (SuperAdmin, 30 permisos, 4 roles default, 8 unidades del sistema)
  -  ✅ 1.3.2 demo.ts (org "Supermercado Demo", 3 sucursales + CEDIS, 6 cajas, 50 productos, 10 clientes, 10 promos, 100 ventas históricas, 20 pedidos) — nota: menos volumen que el plan (50 productos / 10 clientes) para seed rápido (~10s)
-  ✅ 1.4 Configurar Prisma client singleton (`src/lib/db/client.ts`, hecho en FASE 0)
-  ✅ 1.5 Crear tipos TypeScript derivados del schema (`src/types/database.ts`)

---

## FASE 2 — AUTENTICACIÓN Y AUTORIZACIÓN

-  ✅ 2.1 Configurar NextAuth v4 (credentials provider, JWT, session callback)
  -  Resolución por email | código de nómina | nº de cliente; scopes: superadmin/app/portal; permisos embedidos en JWT
-  ✅ 2.2 Login POS (`/auth/login`) — email|nómina + password
-  ✅ 2.3 Login Cliente (`/portal/auth/login`) — email|nºcliente + password
-  ✅ 2.4 Landing page con botón WhatsApp (en vez de registro público)
-  ✅ 2.5 Forgot password flow (tokens guardados hasheados, expiran 1h; en dev se muestra el enlace)
-  ✅ 2.6 Post-login redirect por rol (`src/lib/auth/redirect.ts`)
-  ✅ 2.7 Auth middleware (`src/middleware.ts`: /pos, /admin, /portal)
-  ✅ 2.8 RBAC: 30 permisos + 4 roles de sistema con validación en UI (usePermission) y server (assertPermission)
  -  Nota: FASE 14 ampliará el sistema de permisos (CRUD de roles, matriz, approvals)
-  ✅ 2.9 Registro de empleados desde admin (helper createEmployeeUser; CRUD en FASE 7)
-  ✅ 2.10 Registro de clientes desde admin/POS (helper createCustomerUser; CRUD en FASE 7)
-  ✅ 2.11 Onboarding wizard para nuevos owners (stub en /auth/onboarding; wizard réal en FASE 7)
-  ✅ 2.12 Modo demo (botones por rol en login, solo en desarrollo)
-  ✅ 2.13 Cambio de contraseña (/auth/change-password + POST /api/auth/change-password)
-  Migración nueva: `20260811060000_user_password_reset` (columnas de reset en users)

---

## FASE 3 — SISTEMA DE APARIENCIA

-  ✅ 3.1 CSS custom properties desde app_settings
  -  `src/lib/appearance.ts` (modelo), `src/lib/appearance-apply.ts` (aplica var al DOM: hues, tipografía, escala, densidad, radio, tarjetas, sidebar)
-  ✅ 3.2 Tema: light, dark, pos (high-density dark: fuerza densidad compacta)
-  ✅ 3.3 Parámetros: primary_hue, accent_hue, font_family, font_scale, density, border_radius, card_size (+ sidebar_style)
-  ✅ 3.4 Configuración por empresa (`/admin/settings/appearance` + GET/PATCH `/api/settings/appearance` con permiso settings.manage)
-  ✅ 3.5 Persistencia localStorage (tema + overrides del dispositivo) + cross-tab sync (evento storage)
-  ✅ 3.6 Splash screen con tema del tenant (`src/components/appearance/splash.tsx`)
-  ✅ 3.7 Aplicación de tema en tiempo real (sin recarga): el formulario edita el store y el provider reaplica al instante

---

## FASE 4 — COMPONENTES BASE ✅

-  ✅ 4.1 Instalar 46+ componentes shadcn/ui (40 instalados: accordion, alert, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, dialog, drawer, dropdown-menu, hover-card, input, input-group, input-otp, label, pagination, popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip)
-  ✅ 4.2 InputGroup (`src/components/base/input-group-field.tsx`: `InputGroupField` = label + InfoTooltip + icono + addons + hint/error; re-exporta `InputGroup` compuesto de shadcn)
-  ✅ 4.3 InfoTooltip (`src/components/base/info-tooltip.tsx`)
-  ✅ 4.4 FormCombobox (`src/components/base/form-combobox.tsx`: searchable + sync `RefreshCw` + create inline + preserva selección)
-  ✅ 4.5 DatePicker (`src/components/base/date-picker.tsx`, DD/MM/YYYY, react-day-picker v10, dropdown meses/años)
-  ✅ 4.6 TimePicker (`src/components/base/time-picker.tsx`, HH:MM AM/PM con segmentos)
-  ✅ 4.7 DateTimePicker (`src/components/base/date-time-picker.tsx`)
-  ✅ 4.8 DataTable (`src/components/base/data-table.tsx`: ordenamiento, búsqueda global, faceted, paginación, selección, visibilidad de columnas, responsive cards móvil)
-  ✅ 4.9 Attachment (`src/components/base/attachment.tsx`: upload + preview imagen/PDF + drag & drop + reemplazar/quitar)
-  ✅ 4.10 Spinner + Skeleton (`spinner.tsx` nuevo; skeleton ya era shadcn)
-  ✅ 4.11 AnimatedNumber (`animated-number.tsx`, spring con framer-motion `animate`)
-  ✅ 4.12 InfoField (`info-field.tsx`)
-  ✅ 4.13 SweetAlert2 wrappers (`src/lib/swal.ts`: swalToast, swalMessage, swalError, swalConfirm, swalLoading, swalPrompt) + theming en globals.css
-  ✅ 4.14 GPS Picker (`gps-picker.tsx`: geolocalización + geocode/reverse Nominatim + mapa OSM + dirección completa)
-  ✅ 4.15 Sound player (`src/lib/sounds.ts`: volume/rate + persistencia localStorage + `useSound`)
-  Nota: `@tanstack/react-table` quedó en v8 (la v9 cambió la API; se prefirió la estable). `sweetalert2` agregado. Barrel `src/components/base/index.ts`.

---

## FASE 5 — LAYOUT Y NAVEGACIÓN ✅

-  ✅ 5.1 AppNav (`src/components/layout/app-shell.tsx`: adaptativo — Sidebar desktop fija, BottomBar móvil, Drawer tablet)
-  ✅ 5.2 Header sticky (`app-header.tsx`: logo, buscador, campana de notificaciones, menú de usuario) + `page-header.tsx`
-  ✅ 5.3 User dropdown (`user-menu.tsx`: perfil, cambiar contraseña, preferencias, cerrar sesión)
-  ✅ 5.4 Notifications bell (`notifications-bell.tsx`: badge animado con Motion, popover, SSE vía `use-notifications.ts` + store zustand; fallback demo hasta FASE 11)
-  ✅ 5.5 Sidebar agrupada por secciones colapsables (`app-sidebar.tsx`, Collapsible + NavLink con indicador animado)
-  ✅ 5.6 BottomTabBar móvil (`bottom-tab-bar.tsx`: 5 ítems principales filtrados por permiso)
-  ✅ 5.7 NavigationDrawer (`navigation-drawer.tsx`: slide-in con overlay, cierre por ESC/focus)
-  ✅ 5.8 Safe areas (`env(safe-area-inset-top/bottom)` en header, drawer y bottom bar; layout ya usa viewport-fit=cover)
-  ✅ 5.9 Transiciones entre rutas (`route-transition.tsx`: AnimatePresence + usePathname, respeta prefers-reduced-motion)
-  ✅ 5.10 Navigation adapted (un `AppShell` renderiza la UI correcta por breakpoint via CSS + MobileProvider)
-  ✅ 5.11 Íconos y rutas UNA sola vez (`src/lib/nav.ts`: NAV_SECTIONS/BOTTOM_NAV + filtros por permiso server `filterNavSections` y cliente `filterNavSectionsByUser`)
-  Nota: sidebar/placeholder `src/app/admin/[module]/page.tsx` para módulos de FASEs 7-10. Smoke HTTP 10/10 (login demo → /admin con shell completo, /admin/products y appearace 200).

---

## FASE 6 — PUNTO DE VENTA (POS)

-  6.1 Layout POS (grid responsive: categorías + productos + ticket)
-  6.2 Category tabs (horizontal scroll, activa con estilo)
-  6.3 Product grid (cards estandarizados: imagen, nombre, precio, stock badge)
-  6.3a Badge "A granel" en cards de productos bulk (diferente color/icono)
-  6.4 Búsqueda por SKU/código/nombre/barras
-  6.5 Escáner de barras (input con auto-focus)
-  6.5a Modal de entrada para productos a granel:
  -  Al tocar producto granel → abre modal con:
    - Imagen + nombre del producto
    - Unidad de medida (kg, pieza, lt, etc.)
    - Input de cantidad/precio (NumPad grande)
    - Toggle: "Por cantidad" vs "Por monto" (ej: 1.5 kg ó $10.00)
    - Si allow_split: toggle entre unidad principal y alternativa
    - Precio calculado en tiempo real
    - Cantidad mínima/máxima/step validados
    - Botón "Agregar al ticket"
  -  Si es "por monto" ($10 de azúcar): se calcula la cantidad = monto / precio_por_unidad
  -  Si es "por cantidad" (1.5 kg): se calcula el total = cantidad × precio_por_unidad
  -  Redondeo a 2 decimales en el total
-  6.6 Panel de ticket (lista de items, cantidades +/-, subtotal por item)
-  6.6a En ticket: productos granel muestran "1.5 kg × $18.00/kg = $27.00"
-  6.6b Editar cantidad de producto granel en ticket → re-abre modal de entrada
-  6.7 Asociar cliente (buscar por nombre/teléfono/nº, ver puntos)
-  6.8 Descuento manual + código de cupón
-  6.9 Cálculo en vivo: subtotal, impuestos, descuentos, total
-  6.10 Payment dialog:
  -  NumPad táctil para montos
  -  Denominaciones de efectivo ($20, $50, $100, $200, $500, $1000)
  -  Split payments (múltiples métodos: efectivo + tarjeta + wallet)
  -  Pago con puntos de lealtad
  -  Barra de progreso de pago
  -  Cambio calculado
  -  Permitir montos de más (overpayment)
-  6.11 Virtual keyboard (numérico + completo, toggle on/off)
-  6.12 Ticket/impresión (formato 80mm, puntos acumulados + total actual)
-  6.13 Auto-focus en input de escaneo después de cada acción
-  6.14 Swipe-to-delete en items del ticket (slide izquierdo, fondo rojo "Eliminar")
-  6.15 Cantidad mínima 1, step 0.1
-  6.16 Cerrar caja (corte de caja con reporte detallado)
-  6.17 Modal de catálogos (ver productos, clientes, promos, pedidos desde POS)
-  6.18 Panel colapsable de productos (show/hide toggle)
-  6.19 Supervisor approval (opcional, configurable desde settings)
  -  Cuando está activo, ciertas acciones piden clave de supervisor
  -  Clave cambiable desde perfil con ese permiso
-  6.20 Mapa de monitoreo de pedidos (semáforo: pending=amarillo, preparing=naranja, ready=verde, delivered=azul, cancelled=rojo)

---

## FASE 7 — CATÁLOGOS (CRUDs)

-  7.1 Productos
  -  CRUD completo (crear, editar, activar/desactivar)
  -  Selector de tipo: "Estándar" / "A granel" (al crear, cambia formulario)
  -  Campos comunes: nombre, descripción, categoría, impuesto, imagen, isActive, trackInventory
  -  ── Campos para ESTÁNDAR ──
    -  Variantes (agregar después de crear producto)
    -  Opciones de variante (talla, color, contenido, etc.)
  -  ── Campos para A GRANEL ──
    -  Unidad de medida (FormCombobox: kg, pieza, lt, peso, metro, o custom)
    -  Precio por unidad de medida
    -  Cantidad mínima de venta (ej: 0.1 kg)
    -  Step/incremento (ej: 0.01 kg)
    -  Cantidad máxima (0 = sin límite)
    -  Permitir venta fraccionada (allow_split)
    -  Unidad alternativa (si allow_split: ej pieza si principal es kg)
    -  Precio por unidad alternativa
  -  Imagen (Attachment)
  -  Importación masiva (Excel con plantilla y dropdowns de categorías)
  -  Exportación (Excel)
  -  CRUD de unidades de medida (catálogo personalizado por empresa)
-  7.1a Unidades de Medida
  -  CRUD (nombre, abreviatura, tipo, factor de conversión)
  -  Unidades del sistema pre-cargadas (kg, g, lt, ml, pza, m, cm, peso)
  -  Unidades personalizadas por empresa
-  7.2 Categorías
  -  CRUD completo (crear, editar, activar/desactivar)
  -  Jerarquía (subcategorías)
  -  Imagen (Attachment)
  -  Importación/Exportación
-  7.3 Clientes
  -  CRUD completo
  -  Puntos (ver historial, ajustar)
  -  Favoritos
  -  Historial de compras/pedidos
  -  Métodos de pago guardados
  -  Importación/Exportación
  -  Auto-crea user al registrar
-  7.4 Empleados
  -  CRUD completo
  -  Puestos (CRUD de employee_positions)
  -  Nómina/código único
  -  Asignación de sucursal base
  -  Auto-crea user al registrar
-  7.5 Promociones
  -  CRUD completo
  -  6 tipos de beneficio
  -  4 alcances (order, category, product, variant)
  -  Scheduling (fechas, días de semana, horario)
  -  Cupones
  -  Límites de uso (global y por cliente)
  -  Exclusividad
  -  Prioridad
  -  Targets (location, category, product, variant, reward_variant)
-  7.6 Sucursales
  -  CRUD completo
  -  GPS (lat/lon + dirección completa)
  -  Responsable y contacto
  -  Horarios de apertura
  -  Imagen
  -  Pickup/Delivery toggle
  -  Folio secuencial
-  7.7 CEDIS
  -  CRUD completo
  -  GPS + dirección
  -  Encargado
  -  Horarios
  -  Imagen
-  7.8 Cajas
  -  CRUD por sucursal
  -  Nombre, folio prefix
-  7.9 Puestos de empleado
  -  CRUD (nombre, descripción, isActive)

---

## FASE 8 — INVENTARIO

-  8.1 Vista de inventario (por sucursal/CEDIS, con filtros)
  -  Filtro por tipo de producto (estándar / a granel)
  -  Stock en unidad de medida correcta (kg, pza, lt, etc.)
  -  Columna "Unidad" en la tabla
-  8.2 Movimientos (purchase, sale, adjustment, transfer_in, transfer_out, return)
  -  Para granel: cantidad en unidad de medida (ej: 1.5 kg)
  -  Movimientos registran unit_id
-  8.3 Stock mínimo (min_threshold con alertas automáticas)
-  8.4 Historial de movimientos (con empleado vinculado)
  -  Muestra unidad de medida en cada movimiento
-  8.5 Revisiones físicas de inventario
  -  Vista de conteo con lector de barras o manual
  -  Checklist por producto (escaneado/encontrado)
  -  Diferencias calculadas automáticamente
-  8.6 Importación masiva de inventario
-  8.7 Exportación de inventario (PDF profesional)
-  8.8 Transferencias entre sucursales/CEDIS
-  8.9 Notificación de stock bajo (SSE en tiempo real)

---

## FASE 9 — VENTAS E HISTORIAL

-  9.1 Historial de ventas (DataTable con filtros: fecha, sucursal, empleado, caja)
-  9.2 Detalle de venta (ticket completo con items, pagos, descuentos)
  -  Items granel muestran: "1.5 kg × $18.00/kg = $27.00"
  -  Items standard muestran: "2 × $25.00 = $50.00"
-  9.3 Reimpresión de tickets
-  9.4 Precio histórico (no afecta ventas/reportes pasados)
-  9.5 Folios secuenciales por sucursal
-  9.6 Exportación de ventas (Excel + PDF)

---

## FASE 10 — REPORTES Y ANALYTICS

-  10.1 Dashboard (ventas por día, por método de pago, top productos, márgenes)
-  10.2 Reportes con filtros avanzados (fecha, sucursal, empleado, caja, período)
-  10.3 Exportar reportes (Excel + PDF profesional con diseño)
-  10.4 Gráficas interactivas (Recharts)
-  10.5 Reporte de inventario (PDF profesional)
-  10.6 Reporte de corte de caja
-  10.7 Reporte de pedidos
-  10.8 Reporte de clientes (top, por puntos, por compras)

---

## FASE 11 — NOTIFICACIONES (SSE)

-  11.1 SSE route handler (`/api/sse/notifications`)
-  11.2 Centro de notificaciones (lista completa, mark-as-read individual y batch)
-  11.3 Notifications bell (badge en tiempo real, popover)
-  11.4 Toast de notificaciones (SweetAlert2 theming)
-  11.5 Sonido al recibir notificación
-  11.6 Notificaciones por evento:
  -  Venta completada
  -  Stock bajo
  -  Nuevo pedido
  -  Pedido listo
  -  Pedido entregado
  -  Pedido cancelado
-  11.7 Empleado vinculado a cada movimiento/notificación

---

## FASE 12 — PEDIDOS Y PREPARACIÓN

-  12.1 CRUD pedidos (vista admin con estados y filtros)
-  12.2 Order status history (cada cambio con empleado + timestamp)
-  12.3 Página de preparación de pedido
  -  Datos del pedido (cliente, productos, entrega)
  -  Timer en tiempo real (cuánto se tarda el empleado)
  -  Empleado vinculado a la preparación
  -  Check-list de productos (escaneo con lector o conteo manual)
  -  Progreso: "3 de 10 productos encontrados"
  -  Comentarios por item
  -  Observación general (opcional)
-  12.4 Mapa de monitoreo de pedidos (semáforo de estados)
-  12.5 Notificaciones de cada cambio de estado (SSE)

---

## FASE 13 — PORTAL DE CLIENTES

-  13.1 Layout portal (diseño tipo Cinépolis/app nativa)
-  13.2 Home del portal
  -  Puntos acumulados
  -  Promociones/descuentos activos
  -  Banners de pedidos activos con estatus
  -  Productos nuevos
  -  Publicaciones/avisos
-  13.3 Tienda (catálogo con categorías, búsqueda, filtros)
-  13.4 Product cards
  -  Standard: imagen, precio fijo, variantes selectoras
  -  A granel: imagen, precio por unidad badge ("$18.00/kg"), badge "A granel"
  -  Si allow_split: mostrar ambas unidades ("$18/kg ó $5/pza")
-  13.5 Carrito
  -  Grid de catálogo (no solo lista)
  -  Limitar según stock disponible
  -  Bloquear productos sin stock
  -  Botón "Notificar sin stock" al producto
  -  Comentario por producto seleccionado
  -  ── STANDARD ──
    -  Selector de variante
    -  Cantidad con +/- y step 0.1
  -  ── A GRANEL ──
    -  Al agregar producto granel → abre modal de entrada:
      - Unidad de medida (kg, pza, lt, etc.)
      - Input de cantidad (NumPad)
      - Toggle "Por cantidad" vs "Por monto"
      - Precio calculado en tiempo real
    -  En carrito: mostrar "1.5 kg × $18.00/kg = $27.00"
    -  Editar cantidad → re-abre modal de entrada
    -  Limitar según stock en unidad de medida
    -  Step según configuración del producto (bulk_step)
-  13.6 Checkout
  -  Selección: pickup en sucursal O delivery a domicilio
  -  Selector de sucursal para pickup
  -  Dirección de entrega (con GPS)
  -  Métodos de pago (pasarela o en sucursal)
-  13.7 Tracking de pedido en tiempo real (SSE)
-  13.8 Cancelar pedido (si no fue reclamado/confirmado)
-  13.9 Favoritos (CRUD)
-  13.10 Listas de compra (CRUD + duplicar)
-  13.11 Historial de pedidos
-  13.12 Puntos acumulados + historial de lealtad
-  13.13 Perfil de cliente (editar datos)
-  13.14 Métodos de pago guardados (last4, brand, exp_month, exp_year)
-  13.15 Notificación de tarjetas por vencer

---

## FASE 14 — SISTEMA DE PERMISOS

-  14.1 CRUD de roles (crear, editar, duplicar)
-  14.2 Matriz de permisos (23+ permisos, por sección)
  -  Checkboxes por sección (marcar todos los de un módulo)
  -  Solo lectura / Solo escritura
  -  Duplicar rol existente como base
-  14.3 Asignación de permisos por rol
-  14.4 Control de acceso en UI (ocultar/mostrar elementos según permiso)
-  14.5 Control de acceso en API (middleware de server)
-  14.6 Supervisor approval system (opcional, configurable)
  -  Desde settings: "Activar aprobación de supervisor para: [acciones]"
  -  Al activar una acción restringida → dialog pide clave de supervisor
  -  Clave cambiable desde perfil del supervisor

---

## FASE 15 — AJUSTES DEL SISTEMA

-  15.1 Perfil de usuario (ver/editar, cambiar contraseña, avatar)
-  15.2 Datos de empresa (logo, razón social, RFC, dirección, contacto)
-  15.3 Apariencia (colores, fonts, density, radius, theme, sidebar)
-  15.4 Gestión de usuarios (CRUD + roles + membresías)
-  15.5 Invitaciones de usuarios (por email)
-  15.6 Configuración de lealtad (puntos por compra, valor del punto)
-  15.7 Configuración de supervisor approval (qué acciones requieren)
-  15.8 Configuración de pasarelas de pago

---

## FASE 16 — PASARELAS DE PAGO

-  16.1 Estructura y lógica para Stripe
  -  Create checkout session
  -  Webhook handler
  -  Vinculación de terminal (opcional)
-  16.2 Estructura y lógica para MercadoPago
  -  Create preference
  -  Webhook handler
  -  Vinculación de terminal (opcional)
-  16.3 Configuración de pasarela por empresa (settings/payments)
-  16.4 Selectable: empresa elige entre Stripe o MercadoPago

---

## FASE 17 — MULTI-PLATAFORMA

-  17.1 Responsive: desktop (≥1024px), tablet (768-1023px), móvil (≤767px)
-  17.2 BottomTabBar (móvil: Home, Tienda, Pedidos, Perfil)
-  17.3 NavigationDrawer (tablet: slide-in desde izquierda)
-  17.4 Safe areas iOS/Android (env safe-area-inset)
-  17.5 Splash screen (con logo y tema del tenant)
-  17.6 PWA manifest (instalable desde navegador móvil)
-  17.7 Micro-interacciones (Motion: scale on tap 0.97, list stagger, page transitions)
-  17.8 Pull-to-refresh en listas (móvil)
-  17.9 El POS en móvil: diseño optimizado para pantalla completa
-  17.10 El portal en móvil: se siente como app nativa

---

## FASE 18 — PUBLICACIONES (NEWSFEED)

-  18.1 CRUD de publicaciones (título, contenido, imagen, tipo)
-  18.2 Tipos: producto_nuevo, promoción, aviso
-  18.3 Vista de publicaciones para clientes (home del portal)
-  18.4 Banners promocionales en el portal
-  18.5 Gestión desde admin (/publications)

---

## FASE 19 — IMPORTACIÓN Y EXPORTACIÓN

-  19.1 Exportar productos (Excel)
-  19.2 Importar productos (Excel con plantilla)
  -  Dropdowns en celdas para categorías (catálogo)
  -  Instrucciones claras de llenado
  -  Validación de columnas (error si falta columna requerida)
  -  Preview antes de importar
-  19.3 Exportar clientes (Excel)
-  19.4 Importar clientes (Excel con validación)
-  19.5 Exportar inventario (PDF profesional con diseño)
-  19.6 Exportar ventas (Excel + PDF)
-  19.7 Exportar reportes (PDF con diseño profesional, desglosado)

---

## FASE 20 — CALIDAD Y PULIDO

-  20.1 Loading states (Skeleton en cada página mientras carga)
-  20.2 Empty states (animados con Motion, ilustraciones)
-  20.3 Error boundaries por sección
-  20.4 Transiciones suaves entre rutas (AnimatePresence)
-  20.5 Auto-focus en inputs críticos (POS escaneo)
-  20.6 Cards estandarizados en POS (mismo tamaño)
-  20.7 Modales 3-part (header fijo con icono+título, body scroll en Y, footer fijo con botones)
-  20.8 Modales más anchos (w-full max-w-2xl o max-w-3xl)
-  20.9 Responsive design fixes (testear en 320px, 375px, 768px, 1024px, 1440px)
-  20.10 Sonidos contextualizados (cada acción tiene su sonido apropiado)
-  20.11 Micro-interacciones en todos los elementos clickeables
-  20.12 Estados de carga con Spinner + Skeleton
-  20.13 Navegación always fixed (sidebar, header, bottomBar)
-  20.14 Solo el contenido principal es scrollable (overflow-y-auto, h-dvh)
-  20.15 Testear flujo completo: registro empleado → login → abrir caja → venta → cerrar caja
-  20.16 Testear flujo completo: registro cliente → login portal → crear pedido → tracking → entrega

---

## REGLAS TRANSVERSALES DE UI

Estas reglas se aplican a TODOS los componentes del sistema:

### Inputs

-  NUNCA usar `<select>` nativo → siempre Combobox de shadcn/ui
-  Todo input usa InputGroup con icono (InputGroupAddon + InputGroupInput)
-  Todo campo tiene label obligatorio + InfoTooltip
-  Formularios con react-hook-form + yup
-  Errores: `text-destructive text-sm` bajo el campo
-  Teléfono: solo 10 dígitos (transform yup + onChange sanitizador)
-  RFC/CURP/claves: mayúsculas (transform toUpperCase)
-  Correo: minúsculas + formato email
-  Montos: decimales con 2 posiciones

### Selects (Combobox)

-  NUNCA select nativo
-  Siempre con buscador integrado
-  Botón sincronizar (RefreshCw) a la derecha
-  Botón agregar (Plus) a la derecha (si tiene permiso)
-  Sync: animate-spin + disabled durante carga
-  Create: abre modal, al cerrar selecciona el nuevo registro

### Tablas (DataTable)

-  Todas las tablas usan DataTable de shadcn/ui
-  Ordenamiento por columna
-  Filtros por columna
-  Paginación inferior
-  Selección múltiple (opcional)
-  En móvil: cards apiladas
-  Fechas: DD/MM/YYYY
-  Hora: HH:MM AM/PM
-  Moneda: $1,234.56
-  Booleanos: Badge de color

### Modales (Dialog)

-  3 partes: Header fijo, Body con scroll, Footer fijo
-  Header: icono + título + subtítulo
-  Footer: botones de acción (confirmar, cancelar)
-  Más anchos (max-w-2xl o max-w-3xl)
-  Body con overflow-y-auto

### Micro-interacciones

-  Hover: transition-colors, hover:bg-accent, hover:shadow
-  Active: whileTap={{ scale: 0.97 }}
-  Carga: Spinner + Skeleton
-  Listas: stagger animation
-  Rutas: AnimatePresence page transitions
-  Empty states: animados

### Navegación

-  Sidebar (desktop), Header (sticky), BottomTabBar (móvil), NavigationDrawer (tablet) → always fixed
-  Solo <main> es scrollable (overflow-y-auto, h-dvh)

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
