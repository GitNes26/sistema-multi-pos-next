# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Dueño de negocio pequeño/medio**: Administra sucursales, productos, empleados, reportes y configuración desde el panel. Necesita visibilidad completa y control centralizado.
- **Gerente/Supervisor**: Gestiona operaciones diarias, inventario, cajas, y supervisa empleados en una o más sucursales.
- **Cajero/Empleado**: Opera el POS táctil diariamente. Procesa ventas, escanea productos, maneja pagos split, abre/cierra caja. Velocidad y simplicidad son críticas.
- **Cliente final**: Navega la tienda online, hace pedidos (pickup/delivery), acumula puntos, gestiona favoritos y listas de compra.

## Product Purpose

Multi-POS es un sistema web multi-sucursal de punto de venta que integra POS táctil, panel administrativo y portal de clientes en una sola plataforma. Existe para que negocios pequeños/medianos con una o múltiples sucursales tengan control total de ventas, inventario, clientes y operaciones sin depender de múltiples herramientas separadas.

El éxito significa: el dueño puede administrar todo desde un solo lugar, el cajero puede vender rápido sin fricción, y el cliente puede comprar en línea con la misma experiencia que en tienda.

## Positioning

Multi-POS se diferencia por tres capacidades que rara vez coexisten en una sola plataforma POS:

1. **Productos a granel nativos**: Soporte completo para venta por peso (kg), pieza, litro o monto ($), con cálculo de precio en tiempo real en el POS. No es un add-on — es un tipo de producto de primera clase.
2. **Multi-sucursal con inventario distribuido**: Cada sucursal y CEDIS tiene su propio inventario con movimientos, transferencias y revisiones físicas. No es una caja aislada — es una red de distribución.
3. **Portal de clientes integrado**: Los clientes pueden comprar en línea, rastrear pedidos, acumular puntos y gestionar favoritos, todo conectado al mismo catálogo y reglas de negocio del POS.

## Operating Context

- **Entorno de uso**: Tiendas de conveniencia, abarrotes, minisupers, restaurantes pequeños, cadenas de retail con 1-20 sucursales.
- **Hardware del POS**: Touch-screen, escáner de códigos de barras, impresora térmica de tickets (80mm), teclado virtual.
- **Conectividad**: Funciona con internet; el POS requiere conexión al servidor (VPS Hostinger + Dokploy). El portal de clientes es 100% online.
- **Moneda**: MXN (peso mexicano), configurable por organización.
- **Idioma**: Español (México).

## Capabilities and Constraints

- POS táctil con grid de productos, escáner de barras, teclado virtual, ticket digital, pagos split (efectivo, tarjeta, wallet, puntos), promociones automáticas y cupones.
- Panel administrativo: dashboard analítico, CRUD de productos/inventario/clientes/empleados/promociones/sucursales, reportes con exportación Excel/PDF.
- Portal de clientes: tienda online con catálogo, carrito, pedidos con tracking en tiempo real, favoritos, listas de compra, acumulación de puntos.
- Sistema de permisos por roles (owner, manager, cashier, superadmin, admin) con roles personalizados y permisos granulares.
- Notificaciones en tiempo real por SSE (nuevos pedidos, stock bajo, ventas).
- Responsive con comportamiento nativo en móvil (BottomTabBar, NavigationDrawer, safe areas, splash screen).
- Soporte para productos estándar (con variantes/SKU) y productos a granel (con unidades de medida).
- Multi-tenant: cada empresa tiene sus datos aislados.
- Desplegado en VPS Hostinger con Dokploy, Docker, MySQL 8.

## Brand Commitments

- Nombre: **Multi-POS**
- Sin logo, paleta, tipografía o guía de estilo formal definidos aún.
- La interfaz actual usa shadcn/ui + TailwindCSS v4 con tema configurable por empresa (hues, densidad, border-radius, tipografía).

## Evidence on Hand

- Código completo del sistema (Next.js 15, 500+ archivos) en el repositorio.
- PLAN.md con 20 fases documentadas y completadas.
- Landing page funcional en `/`.
- Preview del POS y panel admin disponibles para inspección visual.
- No hay testimonials, case studies, benchmarks, ni contenido de marketing.

## Product Principles

1. **Un solo sistema, múltiples roles**: El mismo sistema sirve al dueño, al cajero y al cliente sin fragmentar la experiencia.
2. **Productos a granel son ciudadanos de primera**: No es un caso edge — es un tipo de producto con soporte completo desde el POS hasta el inventario.
3. **Inventario distribuido, visión centralizada**: Cada sucursal opera con su stock, pero el dueño ve todo consolidado.
4. **Velocidad en caja**: El POS debe ser rápido y sin fricción — el cajero no puede esperar.
5. **Control total, datos propios**: El dueño controla su servidor y sus datos, sin depender de un SaaS externo.

## Accessibility & Inclusion

- Sin requisitos de accesibilidad específicos establecidos aún.
- La interfaz POS táctil debe ser usable con una mano y sin teclado físico.
- Responsive design para dispositivos móviles y tablets.
