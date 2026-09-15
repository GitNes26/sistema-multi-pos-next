# Multi-POS — visión técnica

Multi-POS es una aplicación web multi-organización para operar tiendas, restaurantes, servicios, rentas y negocios híbridos. Conserva Next.js, React, Prisma y MySQL.

## Superficies

- `/admin`: configuración, catálogos, inventario, ventas, reportes, usuarios y políticas.
- `/pos`: caja, productos, mesas, descuentos, pagos y tickets.
- `/kds`: comandas y entregas para restaurante/híbrido.
- `/agenda` y `/reservaciones`: citas y rentas.
- `/portal`: catálogo, carrito, checkout, pedidos y cuenta del cliente.
- `/reservar`: reservas públicas de mesa con verificación.

Cada petición se resuelve dentro de una organización y los permisos se comprueban en API y navegación. Las operaciones monetarias críticas validan importes, moneda, firma del proveedor y estado antes de confirmar.

## Datos y pruebas

Las migraciones Prisma son históricas e inmutables; los ajustes se agregan mediante migraciones nuevas. `scripts/test-env.mjs` prepara bases desechables `multi_pos_test_*`, aplica migraciones y ejecuta seed mínimo o demo. La suite HTTP exige una base explícitamente identificada y un servidor local con token de prueba.

## Estado de esta candidata

La regresión HTTP cubre 17 escenarios y pasa completa. Typecheck y build pasan; lint no tiene errores y conserva advertencias heredadas. Integraciones de pagos, mensajería, impresión y hardware quedan pendientes de sandbox o equipo físico.
