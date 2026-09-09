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
"Agrega tu primer producto", "Configura tus mesas" o "Vende a crédito" que te llevan
directamente a la pantalla donde completas ese paso. Cuando ya tienes actividad, esa
tarjeta desaparece sola.

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

### Categorías, Medidas, Promociones y Publicaciones
- **Categorías:** agrupan productos (Bebidas, Postres…) y pueden tener subcategorías.
- **Medidas:** piezas, kilos, litros y sus conversiones.
- **Promociones:** `% de descuento`, `Descuento en $`, `Precio fijo`, `Lleva X y paga Y`
  (2x1…) y `Producto gratis`. Cada promoción se limita por días, horarios, categoría o
  producto, y se activa sola en caja y en la app del cliente.
- **Publicaciones:** avisos y promociones que ven tus clientes en la app (novedades, horarios).

### Clientes, Empleados y Puestos
- **Clientes:** nombre, teléfono, correo, dirección, puntos. Desde aquí se ve también su crédito.
- **Empleados y Puestos:** tu personal, su puesto (cajero, mesero, estilista) y a qué sucursal pertenecen.

## 2.3 Inventario (Operación → Inventario)

Para tiendas, restaurantes e híbridos. En una sola pantalla manejas:

- **Existencias por sucursal** y por variante.
- **Registrar movimiento:** entradas, salidas y ajustes (con motivo).
- **Stock mínimo:** al tocar el mínimo el sistema **avisa** (alerta de stock bajo).
- **Transferencias:** mover stock entre sucursales y desde tu almacén central (CEDIS, tiendas e híbridos).
- **Revisiones:** contar el inventario real y cuadrar diferencias.
- **Exportar/Importar:** descarga tu listado en Excel o PDF e importa existencias desde Excel.

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

La política general del crédito se configura en **Ajustes → Crédito** (ver capítulo 8).

## 2.9 Ajustes

- **Empresa:** datos, logo y colores (la apariencia se refleja en POS y app).
- **Sucursales:** cada local con su horario y dirección.
- **Cajas:** las cajas registradoras por sucursal.
- **Lealtad:** reglas de puntos.
- **Supervisor:** PIN de autorización para descuentos grandes y cortes.
- **Pagos:** conecta Stripe o MercadoPago para que tus clientes paguen en línea.
- **Entrega:** costos de envío, horarios, recoger en tienda.
- **Crédito:** política general (capítulo 8).
- **Apariencia:** tema claro/oscuro y colores de marca.
- **Usuarios y permisos:** crea usuarios, asígnales rol (Dueño, Administrador, Cajero…) y
  define qué pueden ver y hacer por módulo.
- **Menú:** ordena y oculta secciones del panel para tu equipo.
- **Empresas y roles:** para quienes administran varios negocios.

## 2.10 Notificaciones

La campana del panel avisa en vivo (con sonido) sobre: ventas completadas, pedidos nuevos
y sus cambios, stock bajo y créditos por vencer. Puedes ver solo las no leídas y marcar
todo como leído.
