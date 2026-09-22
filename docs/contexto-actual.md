# Contexto vigente de Multi-POS

Revisión: 22 de septiembre de 2026.

Multi-POS es una aplicación web multiempresa y multisucursal construida con Next.js 15,
React 19, Prisma 6 y MySQL. Comparte catálogo, ventas, clientes y configuración, y adapta
sus superficies según cinco modos: retail, restaurante, servicios, rentas e híbrido.

## Superficies y actores

- **Panel administrativo:** propietario, administrador, gerente y personal con permisos.
- **POS:** cajero, mesero y operadores autorizados; caja, venta, cobro e impresión.
- **KDS:** cocina; preparación y estados de pedidos.
- **Agenda:** personal de servicios; disponibilidad, citas y cobro relacionado.
- **Reservaciones:** agentes de renta; disponibilidad, período, entrega y devolución.
- **Portal:** cliente; catálogo, carrito, pedido, reservaciones, crédito y seguimiento.
- **Proveedores y compras:** abastecimiento; vínculos de producto, cotizaciones, órdenes,
  aprobaciones y recepciones parciales o completas que actualizan inventario.
- **Planes y suscripciones:** el superadministrador define paquetes, precios, capacidad,
  vencimiento, pagos y bloqueos; cada empresa consulta su consumo desde Mi plan.
- **Público:** acceso, recuperación, onboarding, menú QR y reservación de mesa invitada.

## Reglas transversales

1. Toda operación comercial pertenece a una organización; consultas y mutaciones filtran
   el `organizationId` efectivo de la sesión.
2. Permisos y funciones del modo de negocio se aplican en la interfaz y en la API.
3. Los importes finales se recalculan en servidor; el navegador no autoriza precios.
4. Ventas, pagos, stock, crédito, puntos, preparaciones y devoluciones se actualizan de
   forma transaccional cuando forman una sola operación.
5. Los formularios usan componentes compartidos, Yup, foco al primer campo habilitado o
   inválido y estados accesibles.
6. Producción se siembra con la base mínima. La demo requiere opt-in y queda bloqueada
   cuando `NODE_ENV=production`.

## Dependencias principales

Ventas afectan caja, inventario o recetas, crédito, lealtad, pedidos y reportes. Pedidos
alimentan POS, KDS, entrega y portal. Agenda y rentas pueden crear ventas vinculadas.
Organización, sucursal, apariencia, permisos y pasarelas condicionan todas las superficies.
Los abonos de crédito iniciados en el portal generan una intención de pago: solo el
webhook firmado de la pasarela modifica el saldo. Las notificaciones operativas de
compras y crédito se dirigen al personal con el permiso correspondiente.
Las promociones con límite por cliente registran su uso en la venta o pedido; la
reserva ocurre en la misma transacción y rechaza dos usos concurrentes al llegar al límite.

## Estado conocido

La estabilización funcional y responsive está implementada y cuenta con pruebas de reglas
críticas. Impresión física, escáner, tacto real, mensajería y pasarelas en sandbox requieren
validación externa. Las imágenes subidas requieren un volumen persistente compartido en
el despliegue; el código no puede recuperar archivos que se hayan perdido en el host.
El contador por cliente comienza con la migración que lo crea: usos previos no pueden
reconstruirse íntegramente para pedidos antiguos sin una relación histórica con la promoción.
Los modelos de agregados BI, snapshots, pares, comisiones y segmentos
se conservan aunque algunos procesos de persistencia estén dormidos.
