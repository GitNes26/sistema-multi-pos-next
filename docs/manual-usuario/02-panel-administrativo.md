# 2. Panel Administrativo

El panel es la oficina de tu sistema. Entras desde tu computadora (o tablet) en la
dirección del sistema, con tu correo y contraseña. Si eres dueño o gerente verás el
menú completo; si tu rol es más limitado, solo verás las secciones que te tocan.
Y si tu negocio es de un tipo distinto (tienda, restaurante…), las secciones que no
aplican directamente no aparecen.

[IMAGEN: pantalla del panel con el menú lateral abierto]

## 2.1 Dashboard (Panel)

Es lo primero que ves al entrar. Muestra:

- **Ventas de hoy** (cuánto y cuántos tickets).
- **Ticket promedio** del día.
- **Clientes** registrados.
- **Ventas del período** con su margen.
- Gráficas de **ventas por día** y **ventas por método de pago** (efectivo, tarjeta, monedero, puntos).

Cuando el negocio está nuevo, el dashboard te muestra **acciones guiadas**: tarjetas como
**Agrega tu primer producto**, **Configura tus mesas** o **Vende a crédito**. Al abrir una,
el sistema te lleva a la pantalla real, oscurece el resto y resalta el control que debes
usar. La tarjeta explicativa cambia de posición para no taparlo y el avance se conserva al
pasar a otra sección.

La guía no crea registros por su cuenta. Tú trabajas en los mismos formularios que usarás
después: puedes escribir, abrir selectores, corregir validaciones y guardar sin abandonar el
recorrido. Usa **Atrás** para revisar una explicación, **Ya lo hice/Siguiente** para avanzar
y **Saltar guía** para cerrarla.

El recorrido de producto cubre el flujo completo: **Productos → Nuevo → tipo, nombre,
categoría e impuesto → Crear producto → tabla y variantes → Inventario → búsqueda →
Movimiento → Mínimo → Transferir**. Al terminar puedes ir al POS, agregar otro producto o
volver al panel. Las demás tarjetas aplican el mismo patrón a combos, mesas, cocina, agenda,
reservaciones, entrega, crédito, promociones, pagos, empresa y portal.

[IMAGEN: guía inmersiva resaltando el botón Nuevo de Productos]

## 2.2 Catálogos (menú Catálogos)

### Productos
Aquí se da de alta todo lo que vendes. Por producto eliges:

- **Nombre, categoría, imagen y precio.**
- **Tipo de producto:**
  - *Estándar*: un precio, un stock.
  - *Con variantes*: tamaños o presentaciones (Chico/Grande, 12 pzas/24 pzas).
  - *A granel*: se vende por peso o medida (solo tiendas e híbridos).
  - *Personalizado* (solo restaurantes y híbridos): además de variantes, define **tópicos**:
    grupos de opciones con reglas. Ejemplos: "Tipo de leche" (elige solo 1), "Toppings"
    (hasta 3, cada uno con precio extra), "Sabores" (combinables hasta 2).
    Con el tipo Personalizado marcas si el grupo es **requerido**, cuántas opciones
    se pueden elegir (mínimo y máximo) y cuánto cuesta extra cada una.
- **Stock por sucursal, código interno y código de barras** (para escáner).
- **Combo** (menú Combos, restaurantes e híbridos): paquete de productos con precio especial.
- **Receta e insumos:** en la tabla de productos, pulsa el botón de la olla. Agrega cada
  materia prima, cuánto se consume por venta y la merma prevista. Puedes aplicar un
  consumo siempre, solo a una variante o solo cuando el cliente elige una opción, por
  ejemplo “Chicharrón prensado”. La venta descuenta automáticamente esos insumos.
- **Venta disponible / Ya no hay:** usa el interruptor **Venta** para detener de inmediato
  nuevos pedidos cuando el cálculo teórico no coincide con lo que queda. Esto no cambia
  el conteo del inventario; puedes volver a habilitarlo cuando prepares más.

### Categorías, Medidas, Promociones y Publicaciones
- **Categorías:** agrupan productos (Bebidas, Postres…) y pueden tener subcategorías.
  Cada categoría pertenece a una empresa. Si un producto queda sin una categoría válida,
  sigue disponible en el POS dentro de **Sin categoría** para que puedas reasignarlo.
- **Medidas:** piezas, kilos, litros y sus conversiones.
- **Promociones:** `% de descuento`, `Descuento en $`, `Precio fijo`, `Lleva X y paga Y`
  (2x1…) y `Producto gratis`. Cada promoción se limita por días, horarios, categoría o
  producto, y se activa sola en caja y en la app del cliente.
- **Publicaciones:** avisos y promociones que ven tus clientes en la app (novedades, horarios).

### Clientes, Empleados y Puestos
- **Clientes:** nombre, teléfono, correo, dirección, puntos y número de cliente generado automáticamente. El cliente también ve ese número en su perfil del Portal. Desde aquí se ve su crédito.
- **Empleados y Puestos:** tu personal, su número de nómina generado automáticamente, puesto (cajero, mesero, estilista) y sucursal.

## 2.3 Inventario (Operación → Inventario)

Para tiendas, restaurantes e híbridos. En una sola pantalla manejas:

- **Existencias por sucursal** y por variante.
- **Registrar movimiento:** entradas, salidas y ajustes (con motivo).
- **Stock mínimo:** al tocar el mínimo el sistema **avisa** (alerta de stock bajo).
- **Transferencias:** mover stock entre sucursales y desde tu almacén central (CEDIS, tiendas e híbridos).
- **Revisiones:** contar el inventario real y cuadrar diferencias.
- **Exportar/Importar:** descarga tu listado en Excel o PDF. Para importar, pulsa
  **Plantilla**, lee la hoja **Instrucciones**, copia los identificadores desde
  **Catálogo**, escribe la existencia final y después pulsa **Importar**. Descarga una
  plantilla nueva cada vez para incluir los productos actuales.

[IMAGEN: pantalla de inventario con el botón "Registrar movimiento"]

### CEDIS (solo tiendas e híbridos)
Tu almacén central: recibe mercancía, guarda stock por producto y **transfiere** a las
sucursales. Cada transferencia llega a la sucursal para ser aceptada.

## 2.4 Ventas y devoluciones

En **Ventas** ves todas las ventas de todas las cajas: buscar por folio, ver el detalle
(productos, pagos, cajero), reimprimir ticket y **exportar** a Excel/PDF.

La pestaña **Devoluciones** registra devoluciones de productos:

1. Busca la venta original y abre su detalle.
2. Pulsa **Devolución**.
3. Marca los artículos devueltos, elige cómo se resuelve (dinero de vuelta o crédito en la tienda) y guarda.
4. El inventario y los puntos del cliente se ajustan automáticamente.

## 2.5 Reportes

Informes del negocio con filtros por sucursal y fechas, todos exportables:

- **Ventas:** totales por día, ticket promedio, métodos de pago.
- **Caja:** ventas por sesión de caja, efectivo esperado vs. contado.
- **Pedidos:** pedidos en línea por estado.
- **Business Intelligence:** el catálogo cambia según el tipo de empresa. Restaurante incorpora mesas; servicios incorpora citas; rentas incorpora reservaciones; híbrido reúne los tres. Pulsa **PDF profesional** para elegir uno o varios reportes y generar un solo informe ejecutivo compacto con logo, apariencia y datos de la empresa, filtros, indicadores, análisis, gráficas y tablas.
- **Panel en PDF:** usa **Exportar panel a PDF** para descargar un resumen ejecutivo del periodo con ventas, margen, ticket, clientes, tendencia y productos principales.
- **Crédito:** saldos, adeudos vencidos.
- **Clientes:** compras por cliente, nuevos clientes.
- **Inventario:** productos con stock bajo, valor del inventario.

En tablet, esta pantalla tiene un separador arrastrable entre las gráficas y la tabla
(lo mueves a tu gusto y el sistema recuerda tu tamaño).

## 2.6 Mesas (restaurantes e híbridos)

- **Salas:** crea cada ambiente del local (comedor, terraza, jardín). En el plano ubicas
  mesas, y también **entradas, salidas, baños y cocina** para que el plano sea fiel al local.
- **Mesas:** número, capacidad y estado. Genera un **código QR** por mesa para que el
  cliente pida desde la mesa; puedes imprimir todos los QR de golpe.
- **Lista de espera y reservaciones:** registra grupos en espera y reservas con día, hora
  y personas; cuando llega el grupo, asígnale mesa.

## 2.7 Pedidos (Operación → Pedidos)

Los pedidos que llegan desde la app del cliente (y del menú digital). Cada pedido tiene
**estado**: Pendiente → Confirmado → Preparando → Listo → En camino → Entregado (o
Cancelado). Puedes filtrar por estado, sucursal y fecha; en tablet el separador entre
filtros y lista se arrastra y se recuerda. También hay una vista de **monitoreo** para
ver el avance del día.

## 2.8 Crédito (Operación → Crédito)

Lista de clientes con su saldo, límite y estado. Al abrir un cliente:

- **Historial:** cada cargo (venta fiada), pago y ajuste, con fecha y vencimiento.
- **Registrar pago:** abona al saldo y lo deja documentado.
- **Ajustes:** correcciones con motivo (uso interno del administrador).
- **Cambiar límite:** elige si el cliente sigue la política general o asigna un límite
  individual. Si vuelve a la política general, los cambios futuros de la empresa se le
  aplican automáticamente.
- **Bloquear/Desbloquear crédito:** impide nuevos cargos sin desactivar al cliente ni
  borrar su historial. Los pagos de una deuda existente siguen pudiendo registrarse.

La política general del crédito se configura en **Ajustes → Crédito** (ver capítulo 8).

## 2.9 Ajustes

- **Empresa:** datos, logo y colores (la apariencia se refleja en POS y app).
- **Sucursales:** cada local con su horario y dirección.
- **Sucursales:** al crear una sucursal se precargan los datos disponibles de la empresa y se crea su **Caja principal**. Si no eliges otra imagen, usa el logotipo de la empresa.
- **Cajas:** las cajas registradoras por sucursal. El prefijo se forma y actualiza con el código de sucursal y la abreviación del nombre de caja, por ejemplo `CTR-CP`.
- **Lealtad:** reglas de puntos.
- **Supervisor:** PIN de autorización para descuentos grandes y cortes.
- **Pagos:** conecta Stripe o MercadoPago para que tus clientes paguen en línea.
- **Entrega:** costos, horarios y recogida en tienda. La entrega puede cobrar una **tarifa fija** o un precio **por kilómetro**; la pantalla muestra un ejemplo antes de guardar la regla.
- **Lealtad:** define cuántos puntos gana el cliente por cada peso y cuánto dinero vale cada punto. El ejemplo de $100 permite comprobar la equivalencia antes de guardar.
- **Crédito:** política general (capítulo 8).
- **Apariencia:** tema claro/oscuro y una paleta amplia de colores de marca. Al guardar,
  la selección queda asociada a la empresa activa y se vuelve a aplicar al recargar.
- **Usuarios y permisos:** crea usuarios, asígnales rol (Dueño, Administrador, Cajero…) y
  define qué pueden ver y hacer por módulo.
- **Menú:** ordena y oculta secciones del panel para tu equipo.
- **Empresas y roles:** para quienes administran varios negocios.

## 2.10 Notificaciones

La campana del panel avisa en vivo (con sonido) sobre: ventas completadas, pedidos nuevos
y sus cambios, stock bajo y créditos por vencer. Puedes ver solo las no leídas y marcar
todo como leído.
