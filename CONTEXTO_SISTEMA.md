# Contexto del sistema Multi-POS

Fuente de verdad revisada: 1 de octubre de 2026.

Este documento describe el sistema comprobado mediante el código, `prisma/schema.prisma`, migraciones, rutas, pruebas y documentación vigente. `PLAN.md` conserva el historial de construcción y puede contener nombres, estados o cantidades obsoletos.

## 1. Propósito y alcance

Multi-POS es una plataforma web multiempresa y multisucursal para operar ventas presenciales y pedidos digitales desde un catálogo compartido. Adapta módulos y navegación a negocios retail, restaurante, servicios, rentas e híbridos. Integra la operación diaria —caja, stock, preparación, agenda, reservas, compras y atención al cliente— con administración, permisos, suscripciones y reportes.

No es una suite fiscal ni un ERP/RH completo. La nómina produce cálculo y recibo interno, no CFDI. La facturación oficial, hardware físico, redes bancarias y entrega de mensajería dependen de integraciones o validaciones externas.

## 2. Actores y superficies

| Actor | Superficie | Responsabilidad principal |
|---|---|---|
| Superadministrador | Panel global | Organizaciones, planes, suscripciones y menú global; elige empresa para datos tenant |
| Propietario/administrador | Panel/POS | Configuración y operación permitida por el plan |
| Gerente/supervisor | Panel/POS | Operación delegada, autorizaciones y reportes según rol |
| Cajero/mesero | POS | Caja, venta, cliente, cobro, ticket y pedidos |
| Cocina/preparador | KDS/preparación | Estados e ítems de preparación |
| Personal de servicios | Agenda | Disponibilidad, citas, asignación y cobro |
| Operador de rentas | Reservaciones | Períodos, entrega, devolución y cobro |
| Almacén/compras | Inventario/compras | Existencias, conteos, traslados, proveedores, órdenes y recepciones |
| Cliente autenticado | Portal | Catálogo, carrito, pedido, seguimiento, crédito, lealtad y perfil |
| Visitante | Landing/menú/reservar | Información pública, menú QR y reserva invitada |
| Pasarela/webhook | API externa | Confirmación firmada de pagos |
| Dispositivos | Navegador/hardware | Cámara, GPS, escáner, impresora, báscula y terminal cuando estén disponibles |

## 3. Arquitectura técnica

- Next.js App Router sirve React y route handlers en un solo despliegue Node.
- TypeScript estricto; alias `@/*` hacia `src/*`.
- Prisma 6 conecta MySQL. `Organization` es la raíz tenant.
- NextAuth v4 mantiene sesión, scope, organización activa, rol y permisos efectivos.
- TanStack Query gestiona estado remoto; Zustand cubre estado local persistente cuando corresponde.
- Tailwind CSS v4, shadcn/Radix y Framer Motion forman el sistema visual.
- SSE/polling propagan estados operativos; web push complementa notificaciones.
- PDFKit/ExcelJS generan documentos y exportaciones desde servidor.

Estructura relevante:

```text
src/app/                 páginas y API routes
src/components/base/     lenguaje reusable de formularios, tablas y estados
src/components/ui/       primitivas shadcn/Radix adaptadas al producto
src/components/<área>/   composición por superficie o dominio
src/lib/<dominio>/       reglas, consultas y mutaciones de servidor
src/stores/              estado cliente persistente/efímero
prisma/schema.prisma     contrato de datos
prisma/migrations/       evolución versionada
prisma/seeders/          base, demo y datos de prueba
tests/                   unitarias, integración y E2E
```

## 4. Módulos y dependencias

| Módulo | Responsabilidad | Dependencias clave |
|---|---|---|
| Identidad y organizaciones | Login por correo/teléfono/código, membresías y empresa activa | NextAuth, usuarios, membresías |
| Planes, roles y menú | Capacidad comercial, RBAC y navegación filtrada | Suscripción, permisos, roles, feature gates |
| Catálogo | Categorías, productos, variantes, tópicos, recetas, combos, unidades y servicios | Inventario, precios, promociones |
| POS y caja | Venta táctil, cliente, promociones, pagos, propina, ticket y sesión de caja | Catálogo, stock, lealtad, crédito |
| Pedidos | Checkout portal, preparación, entrega, estados y venta vinculada | Portal, POS, KDS, caja, inventario |
| Inventario | Stock canónico, mínimos, movimientos, conteos, sugerencias y traslados | Productos, ubicaciones, compras, ventas |
| Proveedores y compras | Relación proveedor-producto, cotizaciones, órdenes y recepción | Inventario, sucursal/CEDIS |
| Restaurante | Mesas, salas, sesiones, espera, reserva y KDS | Pedidos, POS, disponibilidad |
| Servicios | Agenda, profesionales, duración, capacidad y cobro | Productos servicio, recetas, ventas |
| Rentas | Disponibilidad temporal, reserva, entrega/devolución y cobro | Catálogo, ventas |
| Clientes | Perfil, direcciones, métodos, favoritos, listas y notificaciones | Portal, pedidos, lealtad, crédito |
| Crédito/lealtad | Límites, cargos, abonos, intenciones, puntos y recordatorios | Cliente, ventas, pagos |
| Nómina ligera | Períodos, captura manual, conceptos configurables y recibos | Empleados; no cálculo fiscal |
| Devoluciones | Validación de cantidades, resolución y reingreso opcional | Venta, caja, inventario, puntos |
| Reportes/BI | Métricas por modo, cortes y exportación ejecutiva | Ventas, pedidos, stock, operación |
| Apariencia/publicaciones | Tema tenant, cierres temporales y comunicación | Todas las superficies, portal |

## 5. Reglas de negocio críticas

### Tenant, roles y planes

1. La organización se deriva de la sesión (`activeOrganizationId` o `organizationId`), no de datos arbitrarios del cliente.
2. Las consultas y escrituras de dominio incluyen ese `organizationId` y validan que entidades relacionadas pertenezcan al mismo tenant.
3. El permiso efectivo es la intersección entre rol y plan. `owner` no puede atravesar un permiso excluido por el plan.
4. `organizations.manage` es global y reservado a `superadmin`. Una sesión portal no puede entrar en APIs administrativas.

### Dinero y transacciones

1. El servidor recalcula precios, descuentos, impuestos, entrega, propina, puntos y total a partir de registros autorizados.
2. Venta, partidas, pagos, caja, consumo de inventario/receta, promociones y lealtad se confirman como una unidad transaccional.
3. La propina se guarda aparte (`Sale.tip`): `Sale.total` y los reportes de ingresos/margen **no** la incluyen; el pago (`SalePayment`) y la caja sí reciben el dinero completo (venta + propina). Es un pasivo hacia el personal (nómina usa `Sale.tip`), no ganancia. El ticket PDF la muestra como «Propina» y «Total pagado». Un pedido del portal convertido en venta respeta la misma regla.
4. Webhooks verifican firma y son la autoridad para pagos asíncronos. El navegador no liquida crédito por sí mismo.
5. Operaciones reintentables usan claves o vínculos idempotentes para evitar ventas, pagos o usos de promoción duplicados.

### Productos e inventario

- `standard` y `custom` operan con variantes activas; si no hay opciones existe una variante por defecto.
- `bulk` opera una fila por producto y unidad de granel, sin inventario paralelo por variante.
- “Servicio” no es un valor de `ProductType`: actualmente se representa como producto `standard` con `trackInventory=false`. No requiere existencia propia; una receta puede consumir materiales físicos.
- Cambiar tipo reconcilia filas sin duplicar stock. Desactivar oculta del uso operativo, no del historial.
- Todo cambio físico crea `InventoryMovement`; venta, devolución, recepción, traslado y ajuste conservan referencia y signo coherentes.
- Traslados distinguen origen/destino sucursal o CEDIS y no mezclan tenant ni claves de inventario.
- Un producto/variante tiene un solo proveedor preferido (`SupplierProduct.isPreferred`): al marcar uno se desmarcan los demás. Duplicar producto (`POST /api/crud/products/[id]/duplicate`) copia variantes (sin SKU/código), opciones, reglas y receta con existencias en cero.
- «Favoritos» del POS son los más vendidos de los últimos 90 días (`topSellers` en el catálogo, caché de 5 min).

### Pedidos y venta

- Flujo base: `pending → confirmed → preparing → ready → in_transit/delivered`, con ramas por pickup/delivery y cancelación permitida según estado.
- Un pedido que se cobra en tienda o concluye con pago debe crear o reutilizar una `Sale` vinculada. Esa venta genera folio con prefijo de pedido, ticket, pago/caja, movimientos, recetas, puntos y reportes.
- La vinculación `Order.saleId` y la lógica de servidor evitan repetir efectos al cambiar nuevamente el estado.
- Comanda ≠ pedido: `Order.source` distingue el pedido del portal (`portal`, aparece en Pedidos) de la comanda del POS (`pos`, solo en cocina). La comanda es «comer aquí» (con mesa) o «para llevar» (`serviceType`). Una comanda lista permanece en el KDS hasta que cocina la marca servida (`kitchenDoneAt`) y su cuenta sigue abierta hasta cobrarse: al elegir la mesa, el POS recarga lo ya pedido, las rondas nuevas se envían a la misma comanda y el cobro la cierra (por mesa o por `kitchenOrderId` en para llevar). El ticket de venta muestra la mesa (`Sale.tableLabel`).
- Todo input de dirección del sistema (`LocationSearch`, `GpsPicker`, portal) usa el mismo selector de mapa a pantalla completa (`shared/address-map-picker`). Las sugerencias se acercan a la ubicación del usuario (última posición conocida o centro del mapa; Google Places con radio y, sin clave, Nominatim con `viewbox`, siempre México) y el mensaje de GPS ya no persiste una vez capturada la ubicación.
- Surtido de pedidos (`OrderPrepare`): tarjetas con foto, cantidad, tópicos y nota del cliente; un toque marca; encabezado de avance fijo y acciones fijas abajo en teléfono.
- Portal: las listas de compras se arman en la tienda en modo lista (`/portal/store?list=ID`: banner con la lista, cada presentación se agrega a la LISTA con su control de cantidad y se guarda sola). La cantidad de carrito, resumen del pedido y listas se edita con `QtyControl` (− / + y tocar para escribir, como en el POS). El pago del portal lista a la vista todo lo que lo bloquea (tienda cerrada, fuera de horario, pedido mínimo, fuera de zona) y el deslizador explica el motivo.
- Dirección de entrega del portal: un solo campo con autocompletado, «mi ubicación», destinos guardados y mapa a pantalla completa con pin al centro (`DeliveryAddressField` / `AddressMapPicker`). El mapa de seguimiento va contenido (`isolate`), traza la ruta restante del repartidor (OSRM) y tiene botón para centrarlo.
- Reparto a domicilio: un pedido no pasa a `in_transit` sin repartidor (`Order.driverEmployeeId`). Se asigna a cualquier empleado (los de rol Repartidor primero) desde el detalle del pedido, o lo toma/acepta quien lo lleva desde Entregas (KDS); queda en el historial y se avisa al asignado. El GPS del dispositivo solo se comparte para las entregas de su dueño y el cliente ve el nombre de pila de quien reparte.
- Interfaz del repartidor (`/repartidor`, permiso `delivery.manage`): pestañas «Mías» y «Disponibles»; aceptar o tomar la entrega, salir en camino (comparte GPS), avisar llegada y confirmar con PIN/QR; el detalle muestra mapa con ruta, cómo llegar, llamar al cliente, artículos y cuánto cobrar. Quien tiene solo `delivery.manage` entra directo a ella. Al completar una preparación sin marcar artículos se pide confirmación.
- Líneas de artículos (ticket POS, carrito y resumen del portal): el nombre no repite los tópicos (van en su propia leyenda) y tocar foto/descripción expande el texto cortado.
- En la PWA instalada los enlaces internos con `target="_blank"` o `window.open` se abren en la misma ventana (`PwaLinkGuard`).

### Disponibilidad y comunicación

- Productos, variantes, opciones y ubicaciones inactivas no se ofrecen para nuevas operaciones.
- Horarios y cierre extraordinario determinan si el portal acepta pedidos; el cierre comunica motivo y reapertura programada.
- Agenda y rentas calculan disponibilidad en servidor y vuelven a validarla al confirmar.

## 6. Flujos end-to-end esenciales

### Venta presencial

1. Empleado autenticado selecciona organización/sucursal/caja y abre sesión de caja.
2. POS carga catálogo permitido y stock; búsqueda, código, cámara o báscula pueden seleccionar/cuantificar.
3. Servidor valida personalizaciones y recalcula el carrito.
4. El cobro crea venta, partidas, pagos, movimientos/recetas, promociones y puntos en transacción.
5. Se emite ticket; efectivo entra al corte y otros métodos quedan desglosados.
6. Error de stock, caja cerrada o autorización devuelve una respuesta accionable sin efectos parciales.

### Pedido del portal

1. Cliente elige organización, sucursal y productos/personalizaciones. Persistir el carrito entre recargas hasta vaciar o concluir es una solicitud abierta al corte de este documento.
2. Checkout valida negocio abierto, método, dirección/radio, inventario, promociones y pago.
3. Se crea pedido e historial; administración/KDS recibe notificación.
4. Preparación y entrega avanzan estados y tracking.
5. Al evento financiero definido se registra una sola venta vinculada y sus efectos contables.
6. Portal muestra estado, incidencias, ticket y opciones permitidas de cancelación/reorden.

### Abastecimiento

1. Inventario detecta existencias en/bajo mínimo y propone cantidades con proveedor preferente o menor costo.
2. El operador ajusta/acepta; cada línea muestra todos los proveedores vinculados con su precio unitario para elegir; se agrupan órdenes por proveedor y destino.
   La solicitud de cotización es un asistente de 3 pasos (productos → proveedor y precio por producto → resumen con formato de solicitud, finalizar/editar) y genera una cotización por proveedor. El historial de recepciones se referencia a su O.C. y detalla partidas y quien recibió.
3. Aprobación conserva proveedor, costos y fechas esperadas.
4. Recepción parcial/completa incrementa inventario y crea movimientos referenciados; nunca “edita stock” sin trazabilidad.

### Traslado

1. Se eligen origen y destino distintos, ambos del tenant, y partidas disponibles.
2. Envío descuenta origen y registra salida/estado/tracking.
3. Recepción validada incrementa destino y registra entrada; discrepancias quedan trazables.
4. Cancelación o reintento no duplica movimientos ya confirmados.
5. Permisos por etapa: `transfers.view`, `transfers.request`, `transfers.dispatch` (preparar/despachar/chofer), `transfers.receive`, `transfers.cancel`. La recepción registra quién recibió (empleado y/o nombre libre) y el detalle ofrece el documento imprimible de solicitud y el botón «Traslado finalizado» hacia Inventario.

### Servicio, renta y restaurante

- Servicio: producto servicio → profesional/horario → cita → prestación → venta; receta consume materiales.
- Renta: artículo/período → disponibilidad → reserva → entrega/devolución → venta/cargos.
- Restaurante: mesa/orden → KDS → preparación → servicio/cobro → liberación de mesa.

### Devolución

0. Una venta admite una sola devolución vigente (las rechazadas no cuentan); se identifica con folio `DEV-<n>` (`SaleReturn.returnNumber`) y la venta lo muestra como insignia.
1. Se calcula cantidad retornable descontando devoluciones previas.
2. Se aprueba/rechaza según permiso.
3. Al completar se registra resolución (reembolso, cupón, puntos o cambio), caja y reingreso opcional.
4. Venta original e historial permanecen inmutables y enlazados.
5. El cambio exige elegir producto(s) de reemplazo (`SaleReturn.exchangeItems`), avisa/bloquea al crear si no hay existencia en la sucursal, y al completar descuenta el inventario del reemplazo con su movimiento.
6. Los tickets de venta y de devolución usan el mismo generador PDF (`src/lib/pos/ticket-pdf.ts`); toda reimpresión (`?reprint=1`) lleva marca «REIMPRESIÓN».

## 7. Convenciones de experiencia

La dirección visual es **Adaptive Operator**: herramienta operativa, clara y táctil; densidad adaptable y decoración mínima. Reglas completas en `docs/agents/DISENO_E_INTERACCION.md`.

- Componentes base antes que markup particular.
- Superficies planas y jerarquía tonal; sombras solo para overlays o elevación temporal.
- Colores semánticos (`primary`, `success`, `warning`, `info`, `destructive`) y tema por organización.
- Poppins en encabezados, Montserrat en cuerpo y Space Mono en importes/folios cuando aporta lectura.
- Motion de 150–300 ms con intención: entrada, cambio de estado, progreso o confirmación; nunca bloquea.
- Móvil/touch conserva 44–48 px aunque sea una tablet ancha. La compactación usa `desk:`.
- Navegación fija; contenido principal desplaza. Safe areas en bordes y `dvh` en viewport.

## 8. Seguridad, datos y operaciones

- Contraseñas con bcrypt; restablecimientos hasheados y con vencimiento; respuestas neutras evitan enumeración.
- Uploads se validan, aíslan por organización y requieren volumen persistente compartido en despliegue.
- Nunca registrar secretos o datos completos de pago; métodos guardados usan referencias seguras y últimos dígitos.
- Producción usa migraciones versionadas (`prisma migrate deploy`), no `db push`.
- Seed de producción es idempotente; demo requiere opt-in y está bloqueada en producción. NESSIK Test también se controla por variable.
- Las pruebas destructivas solo operan bases `multi_pos_test_*`, loopback y opt-in explícito.

## 9. Verificación y estado conocido

Comandos base: `npm run typecheck`, `npm run lint -- --quiet`, `npm test`. Integración/E2E requieren el entorno aislado de `scripts/test-env.mjs`.

Implementado en schema/rutas: catálogo avanzado, POS/caja, pedidos/venta vinculada, inventario y traslados, compras, proveedores, crédito, lealtad, nómina ligera, mesas/KDS, agenda, rentas, devoluciones, reportes, planes y suscripciones.

Validación externa pendiente: impresora, escáner, báscula y terminal física; tacto en dispositivos objetivo; pasarelas sandbox; correo/push reales; infraestructura, cron y almacenamiento persistente. Un módulo presente en código no convierte esas integraciones en verificadas.

Implementado el 1 de octubre de 2026 (pendiente de validación en dispositivo): carrito del portal persistente (`multi-pos.portal-cart`, ligado a la cuenta), variante preseleccionada en el constructor, ticket POS compacto con cantidad editable, datos de transferencia bancaria en el cobro del POS (`CompanyProfile.transfer*`, configurados en Ajustes → Pasarelas), panel con pulso operativo (`/api/panel/live`), logo de fondo y accesos rápidos para quien no puede ver reportes, y roles de sistema editables solo por el superAdmin (`Role.permissionsEdited` evita que el seeder los reescriba). Safe areas: el inset inferior del POS lo aplican los paneles que tocan el borde, no el contenedor.

Implementado el 5 de octubre de 2026 (pendiente de validación en dispositivo): «Mis direcciones» del portal (`/portal/addresses`, alta/edición/baja con pin en mapa; `PATCH /api/portal/addresses/[id]`), wizard de reservación inmersivo (pasos animados con retroceso, horas por franja, resumen tipo boleto, navegación fija en móvil), impresión completa de solicitudes de traslado y visor/impresión de cotizaciones y órdenes de compra (`document-view.tsx`), nómina con conceptos editables, captura rápida de inventario con «Entrada» por defecto, flecha de regreso en el repartidor, teclado por tipo de dato y selectores de fecha/hora en lugar de inputs nativos. Permisos: nuevo `payroll.manage` (módulo Empleados y nómina) separado de `employees.manage`; el seeder lo respalda una sola vez en roles propios y planes que ya tenían `employees.manage`; Propietario, Admin y Gerente lo reciben por catálogo.

Implementado el 5 de octubre de 2026 (segunda tanda, pendiente de validación en dispositivo):
- **Tiempo real de pedidos:** `announceOrderChange` (`src/lib/orders/live.ts`) avisa por SSE al portal (seguimiento) y al canal de la organización cada vez que un pedido cambia (alta, cancelación, cobro, repartidor, preparación). `useOrdersLive` hace que la tabla y el tablero de Pedidos, y el detalle abierto, se refresquen solos; el KDS recibe `order_new` con partidas. El KDS ya no muestra el tablero de envíos (las entregas se operan en Pedidos y `/repartidor`). Las notificaciones de pedido abren «Tablero en vivo».
- **Detalle del pedido:** cobrar en LISTO ya no cierra el modal (`onUpdated` refresca sin cerrar); la cantidad a granel va en su propia etiqueta.
- **Devoluciones:** nuevo tipo `credit` y campos `SaleReturn.customerId` / `creditApplied` (migración `20261005120000`). «Bonificar al cliente» ofrece puntos y/o crédito solo si están habilitados, muestra cliente con saldo actual → nuevo y permite asignar o registrar uno si la venta no lo tiene. El crédito se abona como pago a la deuda (nunca más que el adeudo). La diferencia a favor de un cambio más barato y los reembolsos se entregan en efectivo (sale de la caja), tarjeta u otro medio, o se bonifican en puntos/crédito (`completeReturn` con `pointsAmount`/`creditAmount`); los cortes de caja descuentan también esos efectivos. Al procesar un cupón se muestra el código y se imprime el ticket con el cupón. Vaciar la cantidad de un producto ya no lo desmarca.
- **Otros:** el campo de ubicación del portal siempre muestra el resumen y llena la dirección (aunque el mapa no la resuelva); el historial de movimientos busca por nombre de producto también en variantes «Default»; los números de mesa de mesas archivadas se liberan al crear/renumerar; el IVA del producto no se captura y se guarda en 0; el POS permite cobrar $0 cuando hay cupón, descuento o puntos.

Implementado el 5 de octubre de 2026 (tercera tanda): rol de sistema compartido «Trabajador completo» (`system-all-rounder`) con todo lo operativo de cajero, mesero, cocina, repartidor, almacén, citas y reservaciones (sin administración); aparece como repartidor asignable. Cambio más caro en devoluciones: el cliente paga la diferencia y se registra como `SaleReturnPayment` con importe negativo (el efectivo entra a la caja y compensa reembolsos en el corte). Botón «Limpiar filtros» en las pantallas con filtros.

Implementado el 9 de octubre de 2026 (cuarta tanda, pendiente de validación en dispositivo):
- **Cliente compartido entre negocios:** la cuenta (`User`) es única y cada negocio tiene su propio `Customer` (número de cliente, historial, puntos, crédito, listas y favoritos). Al entrar retoma el último negocio (`lastOrganizationId`); `/portal/businesses` permite elegir o unirse (`joinBusiness`); una cuenta sin negocio entra ahí. Colores y logo salen de la organización activa. El registro público (`/portal/auth/register` → `POST /api/portal/register`) crea la cuenta y envía el enlace de activación; el alta por panel/POS reutiliza la cuenta si el correo ya existe.
- **POS estilo restaurante:** la mesa ya no se ocupa al elegirla, sino al enviar a cocina; se pueden abrir mesas ocupadas, alternar entre cuentas (`OpenAccounts`, `switchTicket`: lo enviado vive en la comanda, lo no enviado queda en pausa en el equipo) y ver mesas en lista o plano. El carrito del menú QR de una mesa aparece en el POS (`TableCartBanner`).
- **Menú QR (`/portal/menu`, público):** mesero digital con carrito compartido por mesa (`TableCart`), envío a cocina (la comanda de la mesa), «Mi cuenta» de solo lectura y «Pedir la cuenta» (aviso al personal). Precios siempre recalculados en servidor (`lib/tables/menu.ts`). Lo enviado no se puede quitar ni disminuir.
- **Mesas:** elemento «Escaleras» (`PlanNodeKind.stairs`), PDF del plano (`/api/tables/plan/pdf`), edición del plano en modal de pantalla completa y refresco silencioso (sin parpadeo).
- **Devoluciones:** se devuelve lo realmente pagado (partida con su parte del descuento); diálogo a dos columnas con resumen, «+1» al agregar el producto de cambio, cantidad editable y aviso cuando el cambio excede el monto a canjear.
- **Traslados:** chofer asignable (trabajador con interfaz en `/repartidor` → pestaña «Traslados», o nombre con enlace público `/traslado/<token>` para compartir ubicación); se puede cambiar en cualquier etapa activa.
- **Documentos:** logo de la empresa en tickets (PNG desde disco; pdfkit no lee WebP), recibos de nómina, solicitudes de traslado, cotizaciones/órdenes y plano; QR + enlace del portal al pie de todos los tickets (`NEXT_PUBLIC_PORTAL_URL` opcional). IVA de productos oculto y en 0 (seeders incluidos).
- **Perfil del portal:** nº de cliente visible y QR con Wake Lock (el navegador no permite subir el brillo del equipo).

Ajustes del 9 de octubre de 2026 (segunda parte): el enlace de activación/recuperación ya es idempotente (`issuePasswordResetToken` deriva el token con HMAC del usuario y su vencimiento, así que pedirlo de nuevo reenvía el mismo enlace válido en lugar de invalidar el anterior); el selector de mapa (`AddressMapPicker`) es un diálogo Radix propio para funcionar dentro de otros diálogos; el QR del ticket va a dos columnas; el plano editable a pantalla completa se ajusta a la ventana.

## 10. Mantenimiento documental

- `AGENTS.md`: reglas obligatorias y router.
- `MEMORY.md`: índice breve de hechos duraderos.
- `docs/agents/*`: procedimientos temáticos.
- `docs/contexto-actual.md`: resumen ejecutivo histórico vigente a su fecha.
- `PLAN.md`: plan histórico, nunca autoridad única.

Toda modificación estructural debe actualizar estos niveles sin copiar secretos ni resultados efímeros.
