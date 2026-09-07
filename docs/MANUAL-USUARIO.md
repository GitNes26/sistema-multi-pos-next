# Manual de Usuario — Multi-POS

> Sistema Multi-Punto de Venta, Portal de Clientes y Panel de Administración  
> Versión 0.12.0.0

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Primeros Pasos](#2-primeros-pasos)
3. [Panel de Administración](#3-panel-de-administración)
4. [Punto de Venta (POS)](#4-punto-de-venta-pos)
5. [Pantalla de Cocina (KDS)](#5-pantalla-de-cocina-kds)
6. [Portal de Clientes](#6-portal-de-clientes)
7. [Reportes](#7-reportes)
8. [Gestión de Inventario](#8-gestión-de-inventario)
9. [Devoluciones y Cambios](#9-devoluciones-y-cambios)
10. [Configuración por Tipo de Negocio](#10-configuración-por-tipo-de-negocio)
11. [Preguntas Frecuentes](#11-preguntas-frecuentes)

---

## 1. Introducción

Multi-POS es un sistema integral de gestión comercial que incluye:

- **Panel de Administración** (`/admin`) — Configuración central, productos, clientes, reportes
- **Punto de Venta (POS)** (`/pos`) — Operaciones de venta en tienda física
- **Pantalla de Cocina (KDS)** (`/kds`) — Visualización de pedidos en cocina
- **Portal de Clientes** (`/portal`) — Tienda en línea para clientes
- **Agenda y Reservaciones** — Citas y reservas (según modo de negocio)

### Modos de Negocio

| Modo | Descripción | Módulos principales |
|------|-------------|---------------------|
| **Retail** | Tienda de productos generales | POS, Inventario, Portal |
| **Food Service** | Restaurante, cafetería, food truck | POS, KDS, Reservaciones, Portal con menú |
| **Services** | Salones, talleres, consultorios | POS, Agenda/Citas, Portal |
| **Rental** | Arriendo de equipamiento/espacios | POS, Reservaciones, Portal |
| **Hybrid** | Combinación de los anteriores | Todos los módulos según configuración |

---

## 2. Primeros Pasos

### 2.1 Acceso al Sistema

1. Abre tu navegador y navega a la URL del sistema
2. Ingresa tu **correo electrónico** o **código de empleado** y contraseña
3. El sistema redirige según tu rol:
   - **SuperAdmin / Admin / Owner / Manager** → `/admin`
   - **Cajero / Empleado** → `/pos`
   - **Cliente** → `/portal`

### 2.2 Roles del Sistema

| Rol | Alcance | Permisos principales |
|-----|---------|---------------------|
| **SuperAdmin** | Todas las organizaciones | Control total, gestión de organizaciones |
| **Admin** | Una organización | Configuración, usuarios, roles, reportes |
| **Owner** | Una organización | Todo excepto gestión de usuarios avanzada |
| **Manager** | Una organización | Ventas, inventario, empleados, reportes |
| **Cajero** | Una sucursal | Uso del POS, apertura/cierre de caja |
| **Cliente** | Portal | Compras, pedidos, puntos, perfil |

> **Nota:** Los roles pueden ser globales (aplican a todas las organizaciones) o específicos por organización.

### 2.3 Cambio de Organización

Si perteneces a múltiples organizaciones:
1. Haz clic en el selector de organización (esquina superior izquierda)
2. Selecciona la organización activa
3. Los datos se recargan automáticamente

---

## 3. Panel de Administración

### 3.1 Dashboard (`/admin`)

Panel principal con métricas en tiempo real:
- **Ventas del día** — Total, cantidad de transacciones, ticket promedio
- **Productos con stock bajo** — Alertas de inventario mínimo
- **Pedidos pendientes** — Órdenes online sin procesar
- **Clientes activos** — Registro reciente de clientes
- **Notificaciones** — Alertas del sistema en tiempo real (campana 🔔)

### 3.2 Gestión de Productos (`/admin/products`)

#### Crear un producto
1. Navega a **Productos** en el menú lateral
2. Haz clic en **+ Nuevo Producto**
3. Completa los campos obligatorios:
   - **Nombre** — Nombre del producto
   - **SKU** — Código único (se genera automáticamente si se deja vacío)
   - **Precio** — Precio de venta
   - **Categoría** — Seleccione una categoría existente
   - **Impuesto** — Tasa de impuesto aplicable
4. Opcionalmente agrega:
   - **Descripción** — Detalles del producto
   - **Imagen** — Suba una foto del producto
   - **Variantes** — Tallas, colores, etc. (cada variante tiene su propio SKU, precio y stock)
   - **Stock mínimo** — Para alertas de reposición
   - **Opciones configurables** — Personalizaciones (ej: "Sin cebolla", "Tamaño extra")
   - **Información a granel** — Para productos vendidos por peso/volumen
5. Haz clic en **Guardar**

#### Producto a Granel
Para productos vendidos por peso o volumen (ej: frutas, carnes, grasas):
1. Activa la opción **Producto a granel**
2. Configura:
   - **Unidad de medida** — kg, g, lb, oz, l, ml
   - **Paso mínimo** — Incremento mínimo (ej: 0.1 kg)
   - **Cantidad mínima** — Pedido mínimo
   - **Cantidad máxima** — Límite superior (opcional)
   - **Permitir división** — Si el cliente puede pedir fracciones
3. El POS mostrará un modal especial para ingresar cantidad o monto exacto

#### Variantes
1. Dentro del producto, haz clic en **+ Agregar Variante**
2. Para cada variante define: nombre, SKU, precio, stock, imagen
3. Las variantes aparecen como opciones en el POS y Portal

### 3.3 Gestión de Categorías (`/admin/categories`)

1. Navega a **Categorías**
2. Crea categorías con nombre e imagen
3. Los productos se asignan a categorías al crear/editar
4. Las categorías aparecen como pestañas en el catálogo del POS

### 3.4 Gestión de Clientes (`/admin/customers`)

1. Navega a **Clientes**
2. Crea clientes con: nombre, teléfono, email, dirección
3. Cada cliente tiene un **código único** para búsqueda rápida
4. Los clientes acumulan **puntos de lealtad** por cada compra
5. Puedes editar puntos manualmente (bonificación, canje, ajuste, expiración)

### 3.5 Gestión de Empleados (`/admin/employees`)

1. Navega a **Empleados**
2. Registra empleados con: nombre, código de nómina, cargo, sucursal
3. Asigna un **rol** (Cajero, Gerente, Admin, Owner)
4. El empleado puede acceder al POS usando su código de nómina como credencial

### 3.6 Gestión de Sucursales (`/admin/locations`)

1. Navega a **Sucursales**
2. Crea sucursales con: nombre, código, dirección, teléfono
3. Cada sucursal tiene sus propios:
   - **Cajas registradoras** — Configuración de cajas físicas
   - **Empleados** — Asignación de personal
   - **Productos** — Stock por ubicación (si se usa inventario multi-ubicación)

### 3.7 Promociones (`/admin/promotions`)

#### Crear una promoción
1. Navega a **Promociones**
2. Haz clic en **+ Nueva Promoción**
3. Configura:
   - **Nombre** — Identificador de la promoción
   - **Descripción** — Texto visible para clientes
   - **Tipo de beneficio:**
     - **Porcentaje de descuento** — Ej: 15% en toda la categoría
     - **Monto fijo de descuento** — Ej: $2.000 de descuento
     - **Precio fijo** — Ej: Todo a $990
     - **Compra X lleva Y** — Ej: 2x1, 3x2
     - **Producto gratis** — Ej: Al comprar A, lleva B gratis
     - **Cupón de próxima compra** — Genera un descuento para el siguiente pedido
   - **Alcance:**
     - **Orden completa** — Aplica a todo el ticket
     - **Categoría** — Solo productos de una categoría
     - **Producto específico** — Solo un producto
     - **Variante** — Solo una variante específica
   - **Requisitos mínimos:**
     - **Monto mínimo** — Ej: Compra mínima $10.000
     - **Cantidad mínima** — Ej: Mínimo 3 unidades
   - **Programación:**
     - **Fechas de vigencia** — Desde / Hasta
     - **Días de la semana** — Solo lunes a viernes, fines de semana, etc.
     - **Horario** — Solo happy hour, etc.
   - **Exclusividad** — Si es exclusiva, no se combina con otras promociones
   - **Usos máximos** — Límite total de canjes (opcional)
   - **Código de cupón** — Si requiere código para activar

#### Tipos de alcance visibles en el POS
- **Sin alcance (global)** — Se evalúa automáticamente contra todo el ticket
- **Con alcance** — Se aplica solo a productos/categorías específicos

### 3.8 Publicaciones (`/admin/publications`)

Gestiona contenido visible en el Portal de Clientes:
1. Navega a **Publicaciones**
2. Crea publicaciones con: título, contenido, imagen, tipo
3. Las publicaciones aparecen en la página principal del Portal

### 3.9 Usuarios y Permisos (`/admin/users`)

1. Navega a **Usuarios**
2. Administra cuentas de acceso al sistema
3. Asigna roles por organización
4. **Permisos disponibles (43 en total):**

| Módulo | Permiso | Descripción |
|--------|---------|-------------|
| POS | `pos.use` | Usar el punto de venta |
| POS | `pos.void` | Cancelar ventas |
| POS | `pos.discount` | Aplicar descuentos manuales |
| Productos | `products.view` | Ver productos |
| Productos | `products.manage` | Crear/editar productos |
| Productos | `products.delete` | Eliminar productos |
| Categorías | `categories.manage` | Gestionar categorías |
| Inventario | `inventory.view` | Ver inventario |
| Inventario | `inventory.manage` | Registrar movimientos y mínimos |
| Inventario | `inventory.revision` | Realizar revisiones de inventario |
| Clientes | `customers.view` | Ver clientes |
| Clientes | `customers.manage` | Crear/editar clientes y puntos |
| Empleados | `employees.view` | Ver empleados |
| Empleados | `employees.manage` | Crear/editar empleados |
| Promociones | `promotions.view` | Ver promociones |
| Promociones | `promotions.manage` | Crear/editar promociones |
| Ventas | `sales.view` | Ver historial de ventas |
| Ventas | `sales.manage` | Gestionar devoluciones de ventas |
| Reportes | `reports.view` | Ver reportes |
| Reportes | `reports.export` | Exportar reportes |
| Caja | `cash.open` | Abrir caja |
| Caja | `cash.close` | Cerrar caja / cortes |
| Sucursales | `locations.view` | Ver sucursales |
| Sucursales | `locations.manage` | Crear/editar sucursales |
| CEDIS | `cedis.manage` | Gestionar centros de distribución |
| Pedidos | `orders.view` | Ver pedidos |
| Pedidos | `orders.manage` | Gestionar pedidos |
| KDS | `kds.operate` | Operar la pantalla de cocina |
| Entregas | `delivery.manage` | Gestionar entregas a domicilio |
| Agenda | `appointments.view` | Ver agenda y citas |
| Agenda | `appointments.manage` | Crear/editar citas |
| Reservaciones | `reservations.view` | Ver reservaciones |
| Reservaciones | `reservations.manage` | Crear/editar reservaciones |
| Ajustes | `settings.manage` | Ajustes del sistema y empresa |
| Usuarios | `users.manage` | Administrar usuarios, roles y permisos |
| Publicaciones | `publications.manage` | Gestionar publicaciones |
| Supervisor | `supervisor.approve` | Aprobar acciones |
| Organizaciones | `organizations.manage` | Gestionar organizaciones (Solo SuperAdmin) |

### 3.10 Reportes (`/admin/reports`)

| Reporte | Descripción | Disponibilidad |
|---------|-------------|----------------|
| **Ventas** | Resumen de ventas por período, sucursal, método de pago | Diario, semanal, mensual |
| **Productos** | Productos más vendidos, rendimiento por categoría | Por período |
| **Inventario** | Estado de stock, movimientos, productos bajo mínimo | Tiempo real |
| **Clientes** | Clientes más activos, acumulación de puntos | Por período |
| **Caja** | Arqueos, sobrantes, faltantes | Por sesión |
| **Devoluciones** | Devoluciones procesadas, motivos | Por período |
| **Cupones** | Uso de cupones, conversión | Por campaña |

> **Exportación:** Los reportes se pueden exportar a **PDF** o **Excel** con el botón de descarga.

### 3.11 Configuración de la Empresa (`/admin/settings`)

1. **Datos de la empresa** — Nombre, RUT, dirección, teléfono, logo
2. **Logo del ticket** — Imagen que aparece en el ticket térmico
3. **Pie de página del ticket** — Mensaje personalizado al final del ticket
4. **Tasa de impuesto** — Porcentaje de IVA u otros impuestos
5. **Moneda** — Símbolo y decimales
6. **Modo de negocio** — Retail, Food Service, Services, Rental, Hybrid
7. **Pasarela de pagos** — Configuración de Stripe o MercadoPago
8. **Notificaciones** — Configuración de push y sonidos
9. **Política de entrega** — Pedido mínimo, radio de cobertura, costo de envío

---

## 4. Punto de Venta (POS)

### 4.1 Apertura de Sesión

1. Accede al POS desde `/pos`
2. Selecciona la **sucursal** (si tienes acceso a múltiples)
3. Selecciona la **caja registradora**
4. Ingresa el **monto de apertura** (efectivo inicial en caja)
5. Haz clic en **Abrir Caja**
6. Se reproduce el sonido `cash-open`

> **Regla:** No puedes realizar ventas sin una sesión de caja abierta.

### 4.2 Interfaz del POS

La pantalla se divide en tres paneles principales:

| Panel | Ubicación | Contenido |
|-------|-----------|-----------|
| **Catálogo** | Centro | Pestañas de categorías, barra de búsqueda, tarjetas de productos |
| **Ticket** | Derecha | Líneas del pedido, totales, acciones de cobro |
| **Header** | Superior | Nombre de sucursal, logo, cajero, estado de sesión |

### 4.3 Agregar Productos al Ticket

#### Método 1: Búsqueda por nombre/código
1. Haz clic en la **barra de búsqueda** (se enfoca automáticamente)
2. Escribe el nombre o código de barras del producto
3. Selecciona el producto de los resultados

#### Método 2: Navegación por categoría
1. Selecciona una **pestaña de categoría** en el catálogo
2. Navega por las tarjetas de productos
3. Toca un producto para agregarlo al ticket

#### Método 3: Escaneo de código de barras
1. Conecta un lector de código de barras USB
2. Apunta al código de barras del producto
3. El producto se agrega automáticamente al ticket

### 4.4 Tipos de Productos

#### Producto estándar
- Se agrega con cantidad 1
- Precio unitario fijo
- Stock se decrementa al vender

#### Producto con variantes
- Al seleccionar, se abre un **diálogo de variantes**
- Selecciona la variante deseada (talla, color, sabor, etc.)
- Cada variante puede tener precio y stock diferente

#### Producto configurable (Builder)
- Tiene **grupos de opciones** (requeridas u opcionales)
- Ejemplo: Pizza personalizada con masa, tamaño, ingredientes
- Cada opción puede tener **precio extra**
- Se pueden agregar **notas** específicas

#### Producto a granel
- Se abre un **modal especial** con dos modos:
  - **Por cantidad:** Ingresa el peso/volumen deseado
  - **Por monto:** Ingresa el dinero a gastar (ej: "$5.000 de jamón")
- Se ajusta al paso configurado (ej: 0.1 kg)
- Muestra el precio unitario y el total

#### Combo / Paquete
- Muestra el **precio del combo** vs. el **precio individual total**
- Al agregarlo, incluye todos los items del combo
- Se muestra el ahorro al cliente

### 4.5 Modificar el Ticket

| Acción | Cómo |
|--------|------|
| **Cambiar cantidad** | Usa los botones +/- en cada línea, o escribe directamente |
| **Editar producto a granel** | Haz clic en el ícono de edición (lápiz) en la línea |
| **Agregar nota** | Haz clic en el ícono de nota en la línea del producto |
| **Eliminar producto** | Haz clic en el ícono de X en la línea |
| **Limpiar ticket** | Haz clic en "Limpiar" (borra todo el ticket) |

### 4.6 Asociar Cliente

1. Haz clic en **"Agregar cliente"** en el ticket
2. Busca por nombre, teléfono o código
3. Selecciona el cliente
4. Se muestran sus **puntos de lealtad** disponibles
5. El cliente queda asociado a la venta

> **Beneficio:** Al asociar un cliente, acumula puntos por la compra y puedes ofrecer descuentos por puntos.

### 4.7 Descuentos

#### Descuento manual
1. Haz clic en **"Descuento"** en el ticket
2. Selecciona tipo: **Porcentaje** o **Monto fijo**
3. Ingresa el valor
4. Si el descuento es **mayor al 10%**, se requiere **aprobación de supervisor** (PIN)

#### Cupón de descuento
1. Haz clic en **"Cupón"** en el ticket
2. Ingresa el código del cupón
3. El sistema valida: vigencia, uso mínimo, productos aplicables
4. Se aplica el descuento automáticamente

#### Promociones automáticas
- Las promociones configuradas se evalúan **automáticamente** al agregar productos
- Si se cumple el requisito mínimo, se aplica el mejor descuento disponible
- Las promociones exclusivas reemplazan otras promociones

### 4.8 Puntos de Lealtad

1. Asocia un cliente al ticket
2. Se muestran sus **puntos disponibles**
3. El cliente puede **canjear puntos** a cambio de dinero (según tasa configurada)
4. Al completar la venta, el cliente **acumula nuevos puntos**

> **Regla:** Los puntos se calculan sobre el total de la venta (antes de impuestos). Se redondean hacia abajo al número entero más cercano.

### 4.9 Envío a Cocina (Food Service)

1. Agrega productos al ticket
2. Haz clic en **"Enviar a cocina"**
3. Los items se envían al **KDS** (Pantalla de Cocina)
4. En el ticket se muestra el **estado de cocina**:
   - ⏳ Pendiente
   - ✅ Confirmado
   - 🍳 En preparación
5. Se puede **cancelar** el envío (pull-back) antes de que se confirme

> **Nota:** Se pueden enviar múltiples rondas de productos a la misma mesa.

### 4.10 Mesas (Food Service)

1. Haz clic en **"Seleccionar mesa"** en el ticket
2. Se muestra el **mapa de mesas** con colores:
   - 🟢 **Libre** — Disponible
   - 🟠 **Ocupada** — Con pedido activo
   - 🔴 **Reservada** — Reservada para una hora específica
3. Selecciona una mesa libre
4. Los pedidos se asocian a la mesa
5. Los cambios de estado se actualizan en **tiempo real** (SSE)

### 4.11 Proceso de Cobro

1. Haz clic en **"Cobrar"** o **"Pagar"** en el ticket
2. Se abre el **diálogo de pago** con:
   - **Resumen del ticket** — Subtotal, descuentos, impuesto, total
   - **Métodos de pago** — Efectivo, Tarjeta, Monedero, Crédito, Puntos, Otro
   - **Numpad** — Para ingresar monto en efectivo
   - **Billetes de acceso rápido** — $20.000, $50.000, $100.000, $200.000, $500.000, $1.000.000

#### Pago en efectivo
1. Selecciona **Efectivo**
2. Ingresa el monto recibido (numpad o billetes)
3. El sistema calcula el **vuelto**
4. Haz clic en **"Cobrar"**

#### Pago con tarjeta
1. Selecciona **Tarjeta**
2. Ingresa el monto
3. Procesa la tarjeta en la terminal externa
4. Haz clic en **"Cobrar"**

#### Pago mixto (método dividido)
1. Selecciona un método e ingresa un monto parcial
2. Selecciona otro método para el resto
3. La **barra de progreso** muestra cuánto se ha cubierto
4. Cuando el total está cubierto, se habilita el botón de cobro

#### Pago con puntos
1. Selecciona **Puntos**
2. Ingresa la cantidad de puntos a canjear
3. El sistema convierte a dinero según la tasa configurada
4. Se descuenta del total

### 4.12 Completar la Venta

1. Después del cobro, se muestra el **ticket en pantalla** (formato térmico 80mm)
2. Se reproduce el sonido `sale-complete`
3. Opciones disponibles:
   - **Imprimir ticket** — Envía a impresora térmica
   - **Ver PDF** — Genera ticket en formato PDF con código QR
   - **Enviar por email** — Envía el ticket al correo del cliente
4. El ticket se guarda en el historial de ventas

### 4.13 Cierre de Caja

1. Haz clic en **"Cerrar Caja"** en el header del POS
2. Se muestra el **resumen de sesión:**
   - Cantidad de ventas
   - Total de ventas
   - Pagos en efectivo
   - Cambio dado
3. Ingresa el **efectivo físico** contado
4. El sistema calcula la **diferencia** (sobrante o faltante)
5. Confirma el cierre
6. Se reproduce el sonido `cash-close`

> **Regla:** No puedes cerrar caja si hay pedidos de cocina pendientes sin cobrar.

### 4.14 Funciones Especiales

#### Dividir cuenta
1. En el ticket, haz clic en **"Dividir cuenta"**
2. Se divide el ticket en partes iguales o por items
3. Cada parte se cobra por separado

#### Notas de producto
1. Al agregar un producto, haz clic en el ícono de **nota**
2. Escribe instrucciones especiales (ej: "Sin gluten", "Extra queso")
3. La nota aparece en el ticket y en la cocina

#### Teclado virtual
- Útil en pantallas táctiles sin teclado físico
- Se activa/desactiva con el ícono de teclado
- Incluye letters, números y caracteres especiales

---

## 5. Pantalla de Cocina (KDS)

### 5.1 Acceso

1. Navega a `/kds`
2. Se muestra la **cuadrícula de pedidos activos**
3. Se actualiza automáticamente en tiempo real (SSE)

### 5.2 Visualización de Pedidos

Cada tarjeta de pedido muestra:
- **Número de pedido** — Identificador único
- **Mesa** — Número de mesa (si aplica)
- **Estado** — Pendiente / Confirmado / Preparando
- **Tiempo transcurrido** — Desde que se envió
- **Items** — Lista de productos con cantidad y notas
- **Estado por item** — Pendiente / Preparando / Listo / Servido

### 5.3 Flujo de Operación

1. **Nuevo pedido** → Se reproduce sonido `order-received`
2. **Confirmar** → Cambia estado a "Confirmado" (el cocinero lo acepta)
3. **Preparando** → Cambia estado a "En preparación"
4. **Listo** → Marca item como "Listo"
5. **Servido** → Marca item como "Servido" (entregado al cliente)
6. **Cobrado** → Al cobrar en POS, se cierra automáticamente el pedido de cocina

### 5.4 Panel de Entregas (Delivery)

Si tienes permiso `delivery.manage`, se muestra un panel adicional:
- Pedidos para entrega a domicilio
- Estado del repartidor
- Ubicación del repartidor en mapa (tiempo real)

---

## 6. Portal de Clientes

### 6.1 Acceso

1. Navega a `/portal`
2. Los clientes se registran e inician sesión con email y contraseña
3. También pueden acceder con **número de cliente** (código)

### 6.2 Página Principal (`/portal`)

- **Bienvenida** — Nombre del cliente
- **Productos destacados** — Selección curada
- **Promociones activas** — Descuentos vigentes
- **Accesos rápidos** — Tienda, Pedidos, Favoritos, Puntos
- **Notificaciones** — Campana con contador de no leídas (se actualiza cada 30 segundos)

### 6.3 Tienda (`/portal/store`)

1. Navega por **categorías** o usa la **búsqueda**
2. Toca un producto para ver **detalles**
3. En el detalle:
   - Selecciona variante (si tiene)
   - Selecciona opciones configurables
   - Elige cantidad
   - Agrega al carrito
4. Los **favoritos** se marcan con el corazón ❤️

### 6.4 Carrito de Compras

1. Haz clic en el **ícono del carrito** (FAB flotante)
2. Se abre el panel lateral con:
   - Lista de productos (swipe izquierda para eliminar)
   - Cantidad ajustable por producto
   - Comentarios por producto
   - Subtotal, impuesto, total
3. **Desliza "Pagar"** para ir al checkout

### 6.5 Checkout (`/portal/checkout`)

1. **Método de entrega:**
   - **Retiro en tienda** — Selecciona sucursal
   - **Despacho a domicilio** — Ingresa dirección con GPS
2. **Dirección:**
   - Selecciona una dirección guardada
   - O agrega una nueva con selector de mapa
3. **Método de pago:**
   - Efectivo (contra entrega)
   - Tarjeta (Stripe / MercadoPago)
   - Puntos de lealtad
4. **Notas** — Instrucciones especiales para el pedido
5. **Revisión de promo** — El sistema evalúa promociones automáticamente
6. Haz clic en **"Realizar pedido"**

### 6.6 Mis Pedidos (`/portal/orders`)

- Lista de todos los pedidos con **estado** y **fecha**
- Estados: Pendiente → Confirmado → Preparando → Listo → En tránsito → Entregado
- **Seguimiento en tiempo real** — Actualización por SSE
- **Seguimiento del repartidor** — Mapa con ubicación en tiempo real
- **Repetir pedido** — Reordena los mismos productos

### 6.7 Puntos de Lealtad (`/portal/loyalty`)

- **Tarjeta de puntos** — Saldo actual
- **Historial** — Ganados, canjeados, ajustados, expirados
- **Conversión** — Cuánto vale cada punto en dinero
- **Canje** — Directo desde el portal

### 6.8 Listas de Compra (`/portal/lists`)

1. Crea listas temáticas (ej: "Supermercado", "Despensa")
2. Agrega productos desde la tienda
3. Al abrir una lista, agrega todo al carrito con un clic
4. **Duplicar** listas para reutilizar

### 6.9 Favoritos (`/portal/favorites`)

- Productos marcados con ❤️
- Acceso rápido desde la tienda
- Se sincronizan entre dispositivos

### 6.10 Perfil (`/portal/profile`)

- Editar nombre, teléfono, email
- Gestionar direcciones guardadas
- Métodos de pago guardados
- Personalizar orden del menú inferior
- Ver estadísticas (pedidos, puntos, favoritos)
- Eliminar cuenta

### 6.11 Combos (`/portal/combos`)

- Ofertas de paquetes con precio especial
- Muestra el ahorro vs. compra individual
- Agrega directamente al carrito

### 6.12 Menú Digital (`/portal/menu`)

Disponible para **Food Service**:
- Menú visual con categorías
- Precios e imágenes
- Opciones configurables
- Pedido directo desde el menú

### 6.13 Crédito (`/portal/credit`)

- Saldo de crédito en tienda
- Historial de movimientos
- Uso en checkout

---

## 7. Reportes

### 7.1 Reporte de Ventas

1. Navega a **Reportes → Ventas**
2. Selecciona período (diario, semanal, mensual, personalizado)
3. Filtra por sucursal, método de pago, cajero
4. Visualiza:
   - Total de ventas
   - Cantidad de transacciones
   - Ticket promedio
   - Ventas por hora (gráfica)
   - Métodos de pago (distribución)

### 7.2 Reporte de Productos

- **Más vendidos** — Ranking por cantidad y monto
- **Por categoría** — Rendimiento por categoría
- **Sin movimiento** — Productos sin ventas en el período
- **Margen de ganancia** — Costo vs. precio de venta

### 7.3 Reporte de Inventario

- **Estado actual** — Stock por producto y sucursal
- **Movimientos** — Entradas, salidas, ajustes
- **Productos bajo mínimo** — Alertas de reposición
- **Rotación** — Velocidad de venta por producto

### 7.4 Reporte de Clientes

- **Más activos** — Por cantidad de compras y monto
- **Nuevos registros** — Clientes nuevos en el período
- **Puntos acumulados** — Total de puntos emitidos
- **Frecuencia** — Compra promedio por cliente

### 7.5 Reporte de Caja

- **Arqueos** — Comparación sistema vs. físico
- **Sobrantes/Faltantes** — Historial de diferencias
- **Por cajero** — Rendimiento por empleado

### 7.6 Exportación

1. Genera el reporte deseado
2. Haz clic en **"Exportar"**
3. Selecciona formato: **PDF** o **Excel**
4. Se descarga automáticamente

---

## 8. Gestión de Inventario

### 8.1 Ver Inventario

1. Navega a **Inventario**
2. Visualiza el stock de todos los productos
3. Filtra por: categoría, sucursal, estado (bajo mínimo, sin stock)

### 8.2 Movimientos de Inventario

1. Selecciona un producto
2. Registra un movimiento:
   - **Entrada** — Compra, devolución, ajuste positivo
   - **Salida** — Venta, merma, ajuste negativo
   - **Transferencia** — De una sucursal a otra
3. Ingresa cantidad, motivo y referencia

### 8.3 Stock Mínimo

1. Configura el **stock mínimo** por producto
2. Cuando el stock alcanza el mínimo, se envía una **notificación**
3. El sistema marca el producto con badge de **stock bajo** en el POS

### 8.4 Revisiones de Inventario

1. Selecciona **"Nueva Revisión"**
2. Cuenta el stock físico de productos seleccionados
3. El sistema compara con el stock registrado
4. Genera ajustes automáticos con los diferenz

---

## 9. Devoluciones y Cambios

### 9.1 Crear una Devolución

1. Navega a **Ventas** y selecciona la venta original
2. Haz clic en **"Devolución"**
3. Selecciona los productos a devolver
4. Indica la **cantidad** y el **motivo**:
   - Producto defectuoso
   - Producto incorrecto
   - Cliente se arrepintió
   - Otro
5. El sistema calcula el **reembolso** (monto a devolver)
6. La devolución queda en estado **"Pendiente"**

### 9.2 Aprobar una Devolución

1. Un **supervisor** (con permiso `sales.manage`) revisa la devolución
2. Puede **aprobar** o **rechazar** con observaciones
3. Si se aprueba, se procesa el reembolso:
   - **Efectivo** — Devolver dinero
   - **Puntos** — Devolver puntos al cliente
   - **Tarjeta** — Revertir cargo (si es posible)
   - **Nota de crédito** — Generar crédito para próxima compra

### 9.3 Cambios

1. Similar a una devolución, pero se registra el **producto de reemplazo**
2. Se genera una nueva venta por el producto de cambio
3. Se ajusta la diferencia de precio (si la hay)

---

## 10. Configuración por Tipo de Negocio

### 10.1 Retail

**Módulos activos:** POS, Inventario, Portal, Reportes

**Configuración recomendada:**
- Productos estándar + variantes
- Inventario con stock mínimo
- Promociones por volumen (2x1, 3x2)
- Portal con tienda en línea
- Puntos de lealtad

### 10.2 Food Service

**Módulos activos:** POS, KDS, Reservaciones, Portal con Menú

**Configuración recomendada:**
- Productos con opciones configurables (pizzas, hamburguesas)
- Sistema de mesas
- Envío a cocina (KDS)
- Reservaciones de mesa
- Propinas habilitadas
- Menú digital en portal
- Delivery a domicilio

**Roles específicos:**
- **Cajero** — Cobra en caja
- **Cocinero** — Opera el KDS
- **Mesero** — Toma pedidos en mesa
- **Gerente** — Supervisa todo

### 10.3 Services

**Módulos activos:** POS, Agenda/Citas, Portal

**Configuración recomendada:**
- Productos como servicios (cortes de pelo, masajes, etc.)
- Agenda con calendario
- Asignación de personal por servicio
- Cobro al completar la cita
- Portal con reserva de citas

### 10.4 Rental

**Módulos activos:** POS, Reservaciones, Portal

**Configuración recomendada:**
- Productos como unidades de arriendo
- Reservaciones por fechas
- Control de disponibilidad
- Cobro por período
- Portal con reserva de equipos/espacios

### 10.5 Hybrid

**Módulos activos:** Todos según configuración

**Configuración recomendada:**
- Combina elementos de los modos anteriores
- Ejemplo: Restaurante con tienda de productos
- Ejemplo: Salón de eventos con arriendo de equipos

---

## 11. Preguntas Frecuentes

### ¿Cómo cambio mi contraseña?
1. Ve a tu **Perfil** (`/admin/settings` o `/portal/profile`)
2. Haz clic en **"Cambiar contraseña"**
3. Ingresa la contraseña actual y la nueva
4. Confirma

### ¿Cómo configuro una impresora térmica?
1. Conecta la impresora USB a la computadora del POS
2. Configura la impresora en la configuración de tu sistema operativo
3. En el POS, al completar una venta, selecciona **"Imprimir ticket"**
4. El ticket se genera en formato 80mm estándar

### ¿Puedo usar el POS sin conexión?
No. El POS requiere conexión al servidor para:
- Cargar el catálogo de productos
- Procesar ventas (actualizar inventario, puntos)
- Enviar pedidos a cocina
- Validar cupones y promociones

### ¿Cómo personalizo el ticket?
1. Ve a **Configuración → Empresa**
2. Sube el **logo del ticket** (recomendado: 300x300px)
3. Escribe el **pie de página** (mensaje, redes sociales, etc.)
4. Los cambios se reflejan en todos los tickets nuevos

### ¿Cómo configuro los puntos de lealtad?
1. Ve a **Configuración → Empresa**
2. Activa **Lealtad de clientes**
3. Configura:
   - **Puntos por unidad monetaria** — Ej: 1 punto por $1.000 gastados
   - **Valor del punto** — Ej: Cada punto vale $10
4. Los clientes acumulan puntos automáticamente al comprar

### ¿Cómo creo un cupón de descuento?
1. Ve a **Promociones → Nueva Promoción**
2. Configura el beneficio (porcentaje o monto)
3. Activa **"Requiere código de cupón"**
4. Escribe el código (ej: "VERANO2024")
5. Configura vigencia y condiciones
6. Los clientes ingresan el código en el POS o Portal

### ¿Cómo veo las ventas del día en tiempo real?
1. El **Dashboard** (`/admin`) muestra métricas en tiempo real
2. El **POS** muestra el total de la sesión actual
3. **Reportes → Ventas** permite filtrar por período específico

### ¿Puedo cancelar una venta ya cobrada?
1. Ve a **Ventas** en el admin
2. Selecciona la venta
3. Haz clic en **"Anular"** (requiere permiso `pos.void`)
4. Se genera un registro de anulación
5. El stock se repone automáticamente

### ¿Cómo configuro el KDS?
1. Ve a **Configuración → Empresa**
2. Activa **Pantalla de Cocina (KDS)**
3. En una segunda pantalla o tablet, navega a `/kds`
4. Los pedidos aparecen automáticamente al enviar desde el POS
5. Los cocineros confirman y marcan como preparando/listo

### ¿Cómo acepto pagos con tarjeta en línea?
1. Ve a **Configuración → Pagos**
2. Configura **Stripe** o **MercadoPago** con tus credenciales
3. En el checkout del Portal, el cliente selecciona "Tarjeta"
4. Se redirige a la pasarela de pago segura
5. Al aprobarse, el pedido se confirma automáticamente

### ¿Cómo configuro el delivery?
1. Ve a **Configuración → Empresa**
2. Activa **Despacho a domicilio**
3. Configura:
   - **Pedido mínimo** para delivery
   - **Radio de cobertura** (km desde la sucursal)
   - **Costo de envío** (fijo o por distancia)
4. En el Portal, el cliente selecciona "Despacho" e ingresa su dirección

---

## Información de Contacto

- **Soporte técnico:** [correo de soporte]
- **Documentación:** [URL de documentación]
- **Actualizaciones:** [URL de changelog]

---

> **Versión del manual:** 0.12.0.0  
> **Última actualización:** Septiembre 2026
