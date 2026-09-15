# Guion de demo y capacitación Multi-POS (45 minutos)

## Preparación

Ejecuta `node scripts/test-env.mjs prepare demo` para una base demo desechable y abre `/onboarding`, `/admin`, `/pos`, `/kds`, `/portal` y `/reservar`. Usa exclusivamente `demo@multi-pos.com` / `demo1234` y las cuentas de portal sembradas en la demo. No conectes pagos, mensajería ni impresoras reales.

## Agenda

| Minutos | Actividad |
|---|---|
| 0–5 | Descubrir operación, sucursales y roles. |
| 5–10 | Wizard 1: Bienvenida → Tipo de negocio → ¡Listo! |
| 10–20 | Acciones guiadas inmersivas del dashboard sobre pantallas reales. |
| 20–30 | POS: abrir caja, vender, descuento con PIN, cobro y ticket. |
| 30–38 | Guía del portal: cliente real → portal en otra pestaña → pedido → Operación → Pedidos. |
| 38–45 | KDS/entrega, objeciones y plan de implantación. |

## Organización según el cliente

| Cliente | Demo | Enfoque |
|---|---|---|
| Tienda | Supermercado Demo | Inventario, granel, CEDIS y crédito. |
| Restaurante | Restaurante Demo | Mesas, menú QR, cocina y cuenta dividida. |
| Servicios | Estética Demo | Agenda, asignación y cobro de citas. |
| Rentas | Fiestas Demo | Disponibilidad, reservas y cobro. |
| Operación mixta | Híbrido Demo | POS, mesas, KDS, agenda y portal. |

## Demostración

1. “Primero elijo el tipo de negocio; el sistema prepara el espacio de trabajo.” Completa el Wizard 1.
2. En `/admin`, abre **Agrega tu primer producto**. Di: “La guía no sustituye la pantalla: me acompaña dentro del formulario que usaré todos los días”. Muestra el resaltado de **Nuevo**, tipo, nombre, categoría e impuesto; crea el producto, revisa su fila y variantes; continúa a Inventario con búsqueda, **Movimiento**, **Mínimo** y **Transferir**. Momento wow: el mismo recorrido cruza módulos sin perder el paso.
3. En `/pos`, abre caja, agrega una variante o producto a granel, aplica un descuento mayor a 10% con el PIN de supervisor, cobra y visualiza el ticket.
4. En food_service o hybrid, ocupa una mesa, envía la comanda a `/kds`, cambia su estado y cobra en caja.
5. En **Prueba tu portal**, crea un cliente desde el formulario real, abre `/portal/auth/login` en otra pestaña, agrega al carrito y confirma un pedido. Regresa a **Operación → Pedidos**. Momento wow: la operación del cliente termina visible en el panel.
6. Abre `/reservar` y `/reservar/verificar` para mostrar la reserva pública y su confirmación.

### Mapa de acciones guiadas por intención

| Acción | Recorrido real que debes mostrar | Momento wow |
|---|---|---|
| Producto | Productos → formulario → fila/variantes → Inventario → movimiento/mínimo/traslado | Cruza catálogo e inventario sin duplicar captura. |
| Combo | Combos → Nuevo combo → productos, cantidades y precio especial | Compara precio individual y precio del paquete. |
| Inventario | Buscar → Movimiento → Mínimo → Transferir | Cada ajuste queda en el historial por ubicación. |
| Mesas | Mesas → Plano → Política → Nueva reservación | Plano, reglas y reserva usan la operación real. |
| Cocina | KDS → comanda → preparando → listo | La caja recibe el estado en vivo. |
| Agenda | Agenda/Personal → calendario → Nueva cita → formulario | Valida servicio, profesional y horario juntos. |
| Reservaciones | Disponibilidad → Nueva reservación → cliente, período y unidades | Impide superar unidades disponibles. |

Durante la demostración, cambia entre empresas y señala que el menú se adapta al tipo de negocio incluso para SuperAdmin: **Agenda** aparece en Servicios y **Reservaciones** en Renta. En **Ajustes → Apariencia**, guarda un color, recarga y muestra que permanece ligado a esa empresa. Al crear un cliente o empleado, muestra el número generado; en el Portal abre **Perfil** para enseñar el número de cliente.

En Inventario, pulsa **Plantilla** antes de **Importar** y enseña sus tres hojas: captura, instrucciones y catálogo. En el POS abre el botón de información de un producto para leer su descripción; después abre el mismo producto en el Portal y muestra que el cliente recibe esa información antes de agregarlo.
| Entrega | Ajustes → Entrega → domicilio/recoger/horarios → Guardar | El portal usa costo y horario guardados. |
| Crédito | Ajustes → Crédito → límites/plazo/aprobación → Guardar | La política gobierna el cobro a crédito. |
| Promoción | Promociones → Nuevo → beneficio/alcance/vigencia → Crear | La promoción activa genera su publicación. |
| Pagos | Ajustes → Pagos → proveedor/credenciales → Guardar | Una configuración alimenta el checkout. |
| Empresa | Ajustes → Empresa → datos/logo → Guardar | Identidad compartida en las superficies visibles. |
| Portal | Clientes → Nuevo → portal en otra pestaña → pedido → Pedidos | Cierra el círculo cliente-operación. |
| POS restaurante | Mesa → ticket → Enviar a cocina → KDS → Cobrar | La guía acompaña el flujo entre POS y KDS. |

## Objeciones

<details><summary>“¿Funciona sin internet?”</summary>La candidata actual requiere conexión; ventas offline quedan fuera de esta etapa.</details>
<details><summary>“¿Puedo conectar pagos reales?”</summary>Configúralos después de validar credenciales y sandbox; esta demo nunca genera cobros reales.</details>
<details><summary>“¿Puedo usar cualquier teléfono?”</summary>La interfaz se adapta a móvil, tablet y escritorio. Hardware físico se valida por separado.</details>

## Plan de implantación

1. Preparar organización, roles, sucursales y catálogo.
2. Sembrar datos iniciales y validar caja/inventario.
3. Capacitar por rol con recorridos críticos.
4. Probar integraciones en sandbox y realizar piloto controlado.
5. Aceptar la versión candidata y planificar el despliegue.

## Chuleta

Rutas: `/onboarding`, `/admin`, `/pos`, `/kds`, `/portal`, `/reservar`, `/reservar/verificar`.
Credencial general de demo: `demo@multi-pos.com` / `demo1234`.
# Mejoras operativas para demostrar

- En **Configuración → Lealtad**, cambia ambas reglas y lee el ejemplo de compra de $100.
- En **Configuración → Entrega**, alterna entre tarifa fija y por kilómetro; muestra cómo el portal explica y calcula el costo.
- Crea una sucursal y confirma que hereda los datos disponibles, crea su caja principal y actualiza el prefijo en vivo.
- En una transferencia de inventario y una aprobación de devolución, demuestra el control de deslizamiento como confirmación deliberada.
- En Cocina, señala el resumen, la antigüedad de las comandas y los botones táctiles. En el portal, abre el seguimiento, el mapa y la hoja inferior del detalle.
