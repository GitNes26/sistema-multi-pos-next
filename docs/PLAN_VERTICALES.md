# Plan: negocios con flujo propio (barbería, autolavado, renta)

Estado: **propuesta**, nada implementado. Fecha: 6 nov 2026.

## 1. Qué hay y qué falta

| Negocio | Ya existe | Falta |
| --- | --- | --- |
| Barbería / estética | `Appointment` (cliente, empleado, servicio, hora, notas), cobro en caja | Silla o lugar, indicaciones estructuradas del corte, ficha de estilo por cliente, agenda por silla |
| Autolavado | Productos con variantes, empleados, comisiones, promociones, puntos, recetas de insumos | Vehículos del cliente, llavero, bahía, flujo de etapas por servicio, tablero, aviso "listo", promociones por visitas |
| Renta | `Reservation` por días con unidades y cobro, calendario | Paquetes, listas de revisión de entrega y devolución, depósito, observaciones, penalizaciones |

Lo común a los tres: **algo atendido** (vehículo, estilo, equipo rentado), **un lugar** (silla, bahía), **un flujo con etapas**, **listas de revisión** y **avisos al cliente**. Por eso se propone un motor genérico configurable y no tres módulos.

## 2. Modelo de datos (borrador)

* `CustomerAsset` — lo que el cliente lleva. **Un cliente tiene muchos** (otro vehículo, otro estilo).
  `organizationId`, `customerId`, `kind` (`vehicle` | `profile` | `equipment` | `other`), `label` ("Tsuru gris 2012"),
  `attributes` JSON (placa, marca, modelo, color, año, tamaño…), `notes`, `isActive`. Índice `(organizationId, customerId)` y búsqueda por placa.
  La placa no es única (un coche puede cambiar de dueño); se avisa si ya existe en otro cliente.
* `ServiceStation` — silla, bahía, cajón: `locationId`, `name`, `kind`, `defaultEmployeeId?` (opcional), `isActive`.
* `ServiceFlow` y etapas — `ServiceFlow(name)` con etapas ordenadas (`key`, `label`, `notifyCustomer`, `color`). Cada servicio (producto/variante) apunta a un flujo
  (lavado exterior: Recibido → Lavando → Secando → Listo; completo: + Aspirado; pulido: + Pulido).
* `ServiceOrder` — la orden: `customerId`, `assetId?`, `stationId?`, `employeeId?`, `flowId`, `stage`, `keyTag` (llavero/gancho del tablero),
  indicaciones (JSON + texto), `promisedAt`, `readyAt`, `deliveredAt`, `saleId?`, `appointmentId?`. Partidas con variante y precio recalculados en servidor.
  `ServiceOrderEvent` guarda cada cambio de etapa (quién, cuándo) para tiempos promedio.
* `ChecklistTemplate` (`phase`: intake | delivery | return, ítems) y resultado guardado en la orden o la reservación (ítem, estado, nota, foto con `Attachment`).
* Renta: `Reservation` suma `deposit`, `deliveryAt`, `returnAt`, `deliveryChecklist`, `returnChecklist`, `observations`, `penalty`. **Paquetes = combos** (ya existen).
* Promociones por visitas: nuevo beneficio configurable "a la N-ésima visita en P días": cuenta órdenes/ventas cobradas del cliente; descuento o servicio gratis.

Reglas del sistema que se mantienen: todo por `organizationId`; permiso del rol ∩ plan (permisos nuevos `service_orders.view/manage`, `assets.manage`, `checklists.manage`);
precios y descuentos recalculados en servidor; una orden cobrada se vincula a **una** venta (ticket, caja y reportes sin duplicar); migración versionada + seeder idempotente; índices compuestos desde el inicio (guía de escalabilidad).

## 3. Cómo se vincula el cliente y su vehículo

1. Al recibir un auto se busca por teléfono o placa. Si el cliente existe, se listan **sus vehículos** y se elige uno o se agrega otro en el momento (3 campos mínimos: placa, marca/color, tamaño).
2. Si es de mostrador sin registro, se crea un cliente rápido (nombre + teléfono) y su vehículo; se puede completar después.
3. El **tamaño** del vehículo elige solo la variante de precio (chico, mediano, camioneta).
4. La llave es dato **de la orden**, no del vehículo: número de llavero/gancho, y el tablero muestra qué gancho está ocupado.
5. El historial del cliente muestra órdenes anteriores por vehículo ("la última vez: lavado completo + cera, 12 oct").

## 4. Fases

| Fase | Contenido | Resultado |
| --- | --- | --- |
| 0 · Fundación (**hecha**, con la política de citas) | `CustomerAsset`, `ServiceStation`, interruptores por empresa (qué módulos usa) y presets de negocio | Se pueden registrar vehículos y lugares |
| 1 · Orden y tablero (**hecha**, con portal del cliente) | `ServiceOrder`, flujos por servicio, tablero por etapas/bahías en vivo (SSE), llavero, cobro ligado a venta, aviso "listo" al cliente | Autolavado operable de punta a punta |
| 2 · Revisiones (**hecha para órdenes de servicio**; las rentas la reutilizarán) | Listas de entrega/devolución con fotos y firma | Sirve a autolavado (daños previos) y renta |
| 3 · Renta | Paquetes, depósito, entrega y devolución, penalizaciones, hoja imprimible | Renta completa |
| 4 · Barbería | Silla en la cita, agenda por silla, ficha de estilo del cliente (asset `profile`), indicaciones del corte | Barbería cubierta |
| 5 · Fidelidad | Promociones por visitas, membresías o paquetes de lavados prepagados | Clientes frecuentes |
| 6 · Comunicación | Landing, asistente de creación de empresa con presets (Autolavado, Barbería, Renta), guías, manual, datos demo y pruebas e2e por vertical | Se ofrece y se explica |

Portal del cliente (fases 1–4): "Mis vehículos", seguimiento de su orden (como el de pedidos) y reserva por silla/horario.

## 5. Ideas extra para autolavado

Extras por servicio (cera, aromatizante) con venta cruzada · fotos antes/después · registro de daños al recibir · tiempo estimado de espera y turnos en pantalla/TV ·
comisión por lavador (ya existe `EmployeeCommission`) · insumos por servicio (ya existen recetas) · recordatorio "toca tu próximo lavado" · reporte por bahía, empleado y tiempo promedio por etapa ·
membresía mensual · pago adelantado por QR.

## 6. Decisiones tomadas (6 nov 2026)

1. **Motor genérico**, para que otros negocios se agreguen configurando y no programando.
2. Cita → orden: se decide al llegar a la fase 4 (barbería). Recomendación: la cita es la reserva y, al llegar el cliente, un botón «Llegó» la convierte en orden de servicio (con silla, indicaciones, etapas y cobro). El autolavado puede aceptar citas después con el mismo mecanismo.
3. **Se empieza por autolavado.**
4. Flujos y listas de revisión **configurables por el dueño**, con plantillas de arranque por negocio.
5. Avisos al cliente **solo por app y notificación push**; el envío se diseña como canales intercambiables (`app`, `push`, y `whatsapp` como canal futuro sin implementar), con plantillas de mensaje por etapa y preferencia por cliente.

## 7. Importe de envases retornables (garantía)

Aplica a tiendas (refresco retornable) y se comparte con el depósito de las rentas. No todos los productos: solo los que se marquen.

* **Catálogo:** `ContainerType` (envase: nombre, importe, ¿lleva control de existencias de vacíos?). Una variante puede declarar qué envase usa.
* **Venta (POS):** al agregar un producto con envase aparece «¿Trae envase?»: sí = canje (sin importe), no = se agrega una partida de **importe** por cada envase faltante. Si trae menos, se cobra solo la diferencia. El servidor recalcula; el cliente solo propone.
* **Devolución del envase:** acción «Recibir envase» en el POS: se regresa el importe en efectivo (sale de la caja y queda en el corte) o se aplica como descuento en la compra actual.
* **Contabilidad:** el importe **no es ingreso ni lleva impuesto**: se registra como pasivo (envases en circulación). No entra en ventas, margen ni comisiones; sí en el efectivo de caja. Reporte «Importes en circulación» y existencias de envases vacíos por sucursal.
* **Cliente identificado:** se lleva su saldo de envases (debe N). Cliente de mostrador: se controla por total de la sucursal y se avisa si se reintegran más envases de los que se cobraron.
* **Pedidos del portal:** el importe se cobra en el pedido; el repartidor recoge los vacíos en la siguiente entrega.
* **Base común:** un libro de movimientos de garantías (`DepositEntry`: cobro/devolución, monto, cantidad, envase, venta, sesión de caja, cliente) que también usan las rentas (depósito en garantía) en la fase 3.
* **Pruebas críticas:** venta con canje parcial, devolución con y sin cliente, cancelación de venta con importe, corte de caja, reintentos idempotentes.
