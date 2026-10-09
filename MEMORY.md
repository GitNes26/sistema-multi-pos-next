# Memoria operativa de Multi-POS

Actualizada: 1 de octubre de 2026.

## Identidad

- Monolito full-stack Next.js 15 + React 19 + TypeScript estricto + Prisma 6/MySQL.
- SaaS multiempresa y multisucursal con cinco modos: retail, restaurante, servicios, rentas e híbrido.
- Superficies: panel, POS, KDS, agenda, reservaciones, portal, menú público y APIs/webhooks.

## Decisiones duraderas

- Aislamiento por organización efectiva en toda operación; `superadmin` selecciona empresa para operar datos de negocio.
- Acceso efectivo = permisos del rol limitados por el plan contratado.
- Servidor recalcula dinero y reglas comerciales; los flujos contables relacionados usan transacciones.
- Pedidos comerciales generan una venta vinculada al cobrarse/concluirse para afectar caja, ticket, inventario y reportes una sola vez.
- Inventario: estándar/personalizado por variante; granel por producto; servicios sin existencia salvo consumo de receta.
- UI canónica: componentes base compartidos, CRUD genérico cuando aplica, `DialogComponent`, React Hook Form + Yup, tokens semánticos, targets táctiles y safe areas.
- `PLAN.md` es histórico. La fuente extensa es `CONTEXTO_SISTEMA.md`; las instrucciones de trabajo están en `AGENTS.md` y `docs/agents/`.

## Estado comprobado

- Esquema y rutas cubren catálogo, ventas/caja, pedidos, inventario/traslados, compras, proveedores, promociones, publicaciones, crédito, lealtad, nómina ligera, mesas/KDS, agenda, rentas, devoluciones, BI, planes y suscripciones.
- Existen seed mínimo, cinco organizaciones demo y empresa de prueba NESSIK Test condicionada por variable.
- Hay suites unitarias, integración, E2E y barreras para impedir pruebas destructivas contra la BD normal.

## Validaciones externas pendientes

- Impresora y escáner físicos, báscula/puerto serial y experiencia táctil en hardware real.
- Pasarelas y terminales en sandbox, entrega real de correo/push y configuración de infraestructura/volúmenes.
- No confundir estos bloqueos externos con funcionalidad implementada o con pruebas locales aprobadas.

## Hechos duraderos recientes

- Propina: separada de `Sale.total`, no es ingreso ni margen; sí entra a pago/caja y nómina.
- Devolución: una vigente por venta, folio `DEV-n`, cambio descuenta inventario del reemplazo; reimpresión lleva marca.
- Permisos de traslados por etapa (`transfers.*`); roles de sistema solo los edita el superAdmin.
- Seeder: respaldo único de permisos nuevos de traslados para roles propios y planes ya guardados.
- Permiso `payroll.manage` (nómina) separado de `employees.manage`; respaldo único en el seeder. Formularios: teclado según el dato y Date/Time pickers (ver `docs/agents/FORMULARIOS_Y_CRUD.md`).

## Recuperación rápida

1. Leer `AGENTS.md`.
2. Leer la ruta temática en `docs/agents/README.md`.
3. Consultar `CONTEXTO_SISTEMA.md` solo para dominio o arquitectura amplia.
4. Confirmar detalles cambiantes en código, schema, migraciones y `git status`.
- Clientes: cuenta compartida, un `Customer` por negocio; menú QR público con carrito por mesa; POS alterna cuentas abiertas (ver `CONTEXTO_SISTEMA.md`).
- Skill `.agents/skills/plan-plantilla-administrativa`: crea o planea la plantilla administrativa de un proyecto nuevo con la esencia de este sistema (modo Crear/Planear/Sincronizar). Cuando cambien el núcleo, las tablas base o las guías de diseño/formularios, sincronizar sus referencias.
