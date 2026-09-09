# Contexto del sistema — Fuente de verdad del Manual de Usuario

> **Documento técnico interno (Fase 0).** No es parte del manual para el usuario final:
> es la base que usa el agente (skill `manual-usuario`) para redactar y revalidar el manual.
> Cuando el sistema cambie, actualiza este archivo primero.
> Última revisión: contra el código del 9 de septiembre de 2026 (Multi-POS v0.17.0.0).

---

## 1. Módulos y su propósito

| Módulo | Dónde vive (ruta real) | Propósito para el usuario |
|---|---|---|
| **Panel Administrativo** | `/admin` (+ subpáginas) | Escritorio/web del gerente y administrador: dashboard con métricas, catálogos, ventas, reportes, ajustes. |
| **POS (Punto de Venta)** | `/pos` | Caja de mostrador: tickets, cobro, descuentos, constructor de producto, mesas, apertura/cierre de caja. Se adapta por tipo de negocio. |
| **Cocina (KDS)** | `/kds` | Pantalla de cocina: cola de comandas y tablero de entregas del repartidor (food_service/hybrid). |
| **Agenda de citas** | `/agenda` | Calendario de citas por empleado con checkout/cobro (services/hybrid). |
| **Reservaciones (renta)** | `/reservaciones` | Calendario de disponibilidad, alta/confirmación/cobro de rentas (rental/hybrid). |
| **Portal Cliente** | `/portal` (app móvil/PWA) | Tienda, carrito, checkout con entrega a domicilio o recoger, pedidos con seguimiento, lealtad, crédito, listas, favoritos, reservación de mesas. |
| **Menú digital** | `/portal/menu?table=...` | Menú para leer el QR de la mesa: ordenar desde la mesa. |
| **Reserva pública de mesas** | `/reservar` (+ `/reservar/verificar`) | Flujo de invitado: elegir día/hora/sala y confirmar con código. |
| **Onboarding** | `/onboarding` | Asistente de primer uso: elige tipo de negocio y acciones guiadas ("wizards"). |
| **Notificaciones** | módulo transversal (`/admin/notifications`) | Eventos en vivo con sonido: ventas, pedidos, stock, crédito. |
| **Pagos en línea** | Ajustes → Pagos | Conexión con Stripe o MercadoPago para el checkout del portal. |

**Superadmins** (`/admin/settings/organizations`): crean organizaciones, eligen su tipo de
negocio y administran usuarios y roles. Un negocio real = una organización.

## 2. Tipos de negocio (businessMode) y qué activan

Fuente: `src/lib/business-modes.ts` (nombres y descripciones visibles al usuario) y
`src/lib/features.ts` (qué páginas/funciones aparecen en cada modo).

| Modo | Etiqueta visible | Activa (además del núcleo) |
|---|---|---|
| `retail` | **Tienda / Abarrotes** | Inventario, venta a granel, CEDIS + transferencias, combos, crédito. |
| `food_service` | **Nevería / Restaurante / Café** | Constructor de producto (tipos estándar/variantes/a granel/**Personalizado**), notas por ítem, combos, mesas y salas, cocina (KDS), menú digital, propinas, dividir cuenta. |
| `services` | **Servicios** | Agenda/citas, asignación de servicios a personal, cobro de cita en caja. |
| `rental` | **Renta / Alquiler** | Reservaciones por período, calendario de disponibilidad, contratos, cobro de renta. |
| `hybrid` | **Híbrido** | Todo lo anterior. |

**Núcleo común (los 5):** POS, productos, categorías, medidas, clientes, empleados/puestos,
sucursales, ventas, reportes, promociones, publicaciones, lealtad, notificaciones, portal,
pagos en línea, empresa/apariencia, usuarios y permisos.
Nota: `credit` aparece habilitado en los 5 modos en features, pero su administración completa
(Ajustes → Crédito) es el flujo documentado en retail/food/hybrid.

### Productos y tipos de producto (según modo)
- **Estándar**: precio y stock por unidad (todos los modos).
- **Con variantes**: mismo producto con tamaños/presentaciones, cada variante con precio/stock propio (todos; en retail también combinaciones por tallas/colores).
- **A granel**: se vende por peso o medida ($/kg) — retail y hybrid.
- **Personalizado** (se construye al vender; solo food_service/hybrid): variantes (tamaño) + **tópicos** con reglas por grupo: requerido, mínimo/máximo a elegir, precio extra por tópico, opciones combinables. Ejemplos demo: Nieve de garrafa (sabores combinables hasta 2 + toppings), Café de especialidad (tipo de leche solo 1 + decoraciones hasta 3), Papas estilo Papa Brothers (especialidades según tamaño + aderezos).

## 3. Roles de usuario y responsabilidades

| Rol | Dónde trabaja | Responsabilidades observables |
|---|---|---|
| **Propietario / Dueño** | Panel + POS | Todo: catálogos, ajustes, usuarios, reportes, caja. |
| **Administrador / Gerente** | Panel + POS | Igual que el dueño salvo ajustes restringidos (p. ej. organizaciones). Supervisa reportes, ventas, inventario. |
| **Cajero** | POS (+ Panel en ventas) | Abre/cierra caja, cobra, aplica descuentos ≤10% (más requiere PIN de supervisor), recibe pedidos en línea, registra pagos de crédito. |
| **Mesero** (food/hybrid) | POS: selector de mesa | Toma comandas por mesa, manda a cocina, cobra y libera la mesa. |
| **Cocina** (food/hybrid) | KDS `/kds` | Ve comandas, marca preparando/listo. |
| **Repartidor** (delivery) | KDS → tablero Entregas | Ve pedidos a entregar, comparte GPS en vivo, marca entregado. |
| **Profesional / Estilista** (services) | Agenda `/agenda` | Ve sus citas del día, atiende y cobra. |
| **Agente de renta** (rental) | `/reservaciones` | Aparta unidades, confirma reservas, entrega, cobra y cierra. |
| **Supervisor** | POS | Autoriza con PIN descuentos grandes, anulaciones y cortes de caja. |
| **Cliente** | Portal `/portal` (app) | Compra en línea, agenda/sigue pedidos, usa puntos y crédito, reserva mesas. |
| **Invitado** | `/reservar` | Reserva mesa sin cuenta, confirmando con código. |

Los roles se configuran en Ajustes → Usuarios (roles del sistema + permisos por módulo:
ver/crear/editar/borrar por catálogo). El menú del panel se filtra por permiso y por tipo de negocio.

## 4. Flujos principales (entrada → proceso → salida)

1. **Venta de mostrador (todos los modos):** cliente en caja → cajero arma ticket (escáner/búsqueda, variantes, granel, constructor, notas) → descuentos/cupón/puntos → cobro (efectivo con denominaciones, tarjeta, monedero, puntos, crédito, otro) → venta + ticket 80mm → notificación "Venta completada" → descuento de inventario y puntos ganados.
2. **Comanda en mesa (food/hybrid):** mesero elige mesa/sala → ticket por mesa → enviar a cocina → KDS (preparando/listo) → cobro total o dividido (+propina) → mesa liberada.
3. **Pedido en línea:** cliente del portal arma carrito → checkout (recoger o domicilio con costo) → pago (tarjeta guardada, en línea o efectivo al recibir) → orden con estados pendiente→confirmado→preparando→listo→en camino→domicilio→entregado → cocina atiende en KDS; repartidor en Entregas con GPS en vivo → cliente ve el rastreo y confirma con QR/PIN.
4. **Cita (services/hybrid):** se agenda servicio con empleado asignado → estados pendiente→confirmada→atendida (o cancelada/no asistió) → "Cobrar servicio" genera la venta en caja.
5. **Renta (rental/hybrid):** se apartan unidades por período (pendiente→confirmada) → entrega → "Cobrar y completar" genera la venta → cierre.
6. **Crédito:** cobro en POS con método Crédito (valida límite/saldo contra la política) → el adeudo queda en el cliente → cliente paga desde su portal o en caja → pagos abonan al saldo → recordatorios antes del vencimiento y alertas de vencidos.
7. **Devolución:** Ventas → buscar venta → "Devolución" → elegir artículos y resolución → afecta inventario y puntos.
8. **Inventario/CEDIS (retail/hybrid):** movimientos de entrada/salida, mínimos con alertas, revisiones, transferencias entre sucursales y CEDIS.
9. **Reserva de mesa (invitado):** `/reservar` → sucursal → calendario (solo días con disponibilidad) → hora/asientos → sala/mesa → código de verificación → confirmación.
10. **Lealtad:** 1 punto por peso pagado; 100 puntos = $1.00 de crédito. Canje en POS o checkout.

## 5. Dependencias entre módulos

- POS y Portal dependen de **catálogos** (productos/variantes/precios) y **promociones**.
- POS/Portal/Agenda/Renta generan **ventas**; ventas mueven **inventario** y **lealtad**.
- Pedidos dependen del **portal** y alimentan **KDS** y el tablero de **Entregas**.
- Crédito depende de la **política por organización** (Ajustes → Crédito) y escribe adeudos visibles en Portal → Mi Crédito y en Panel → Crédito.
- Notificaciones dependen de eventos de venta/pedido/inventario/crédito y llegan al panel con sonido y al portal según permisos.
- Mesas generan **QR** apuntando al menú digital; reservaciones de mesa viven en `/admin/tables` (espera + reservas) y `/admin/reservaciones` es de renta (no confundir en el manual).
- El tipo de negocio (elegido en onboarding o por superadmin) decide qué menús existen en panel, POS y portal.

## 6. Reglas de negocio críticas (visibles al usuario)

- **Descuentos manuales:** hasta 10% libre; más requiere PIN de supervisor (por defecto 1234 en demo, configurable en Ajustes → Supervisor).
- **Caja:** el POS exige caja abierta para cobrar; el cierre pide monto contado y genera corte con diferencias.
- **Crédito (política):** activado/desactivado, límite por defecto y por cliente, días máximos para pagar (30 por defecto), aprobación requerida, pagos parciales permitidos, tasa de interés opcional y recordatorio 3 días antes.
- **IVA:** 16% por defecto en los totales.
- **Lealtad:** 1 punto por $1 pagado; 100 puntos = $1; canje parcial en POS.
- **Propinas y dividir cuenta:** solo food_service/hybrid.
- **Combos:** solo food_service/hybrid (el botón no existe en retail; el servidor lo bloquea).
- **Constructor de producto:** solo para productos "Personalizado" en food_service/hybrid; los simples (estándar/variantes/granel) nunca abren el constructor ni en POS ni en portal.
- **Reservaciones:** en rental el calendario aparta unidades por período y la disponibilidad se calcula por día; la reserva de mesa es flujo aparte con código de verificación.
- **Estados de cita:** pendiente, confirmada, atendida, cancelada, no asistió (no asistió queda registrada sin cobro).

## 7. Puntos faltantes detectados (propuestas, no bloquean el manual)

1. No hay UI dedicada de **contratos de renta** (el feature flag `contracts` existe pero sin página); el manual describirá la reservación y su cobro, sin prometer contratos.
2. **Citas desde el portal** para clientes (services) todavía no existe; el portal de services muestra tienda/pedidos. El manual lo describirá como "consultar/disponer de agenda vía panel", sin prometer autoagenda.
3. **División de cuenta** existe en el ticket del POS; el menú digital aún no soporta dividir por comensal.
4. **Recordatorios de crédito** corren por un disparador programado (`/api/cron/credit-reminders`); en despliegues locales hay que llamarlo manualmente — el manual dirá que el sistema avisa "antes del vencimiento" sin prometer horarios exactos.

## 8. Redundancias excluidas del manual

- Página `/admin/[module]` placeholder ("Próximamente") — no se documenta.
- Onboarding interno del superadmin — no aplica al usuario de negocio.
- Vista de monitoreo de pedidos (`/admin/orders/monitoring`) se menciona solo como parte de Pedidos (filtros/monitoreo), no como página separada para el usuario.
- Combos del portal en retail (no existen por diseño).
