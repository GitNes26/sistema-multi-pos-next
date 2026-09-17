import type { ReactNode } from "react"

// FASE — Definiciones de las guías inmersivas del panel admin.
// Cada guía es una secuencia de pasos que navega entre las páginas REALES del
// sistema, resalta el elemento que hay que tocar (selector) y explica qué hace.
// Si un selector no aparece (o no existe en esa vista), el coach muestra el paso
// como explicación centrada — la guía nunca se rompe por eso.

export interface GuideStepAction {
  label: string
  href: string
  primary?: boolean
  newTab?: boolean
}

export interface GuideStep {
  /** Ruta donde vive el paso. Si difiere de la actual, el coach navega primero. */
  route?: string
  /** Selector CSS del elemento a resaltar. Sin selector → explicación centrada. */
  selector?: string
  /** Si el paso avanza solo al hacer clic en el elemento resaltado. */
  advanceOnClick?: boolean
  title: string
  body: ReactNode
  /** Botones de acción al final del paso (navegan y cierran la guía). */
  actions?: GuideStepAction[]
}

export interface GuideDef {
  id: string
  title: string
  steps: GuideStep[]
}

// ── Guía principal: Agrega tu primer producto (flujo completo) ───────────────

const productGuide: GuideDef = {
  id: "product",
  title: "Agrega tu primer producto",
  steps: [
    {
      route: "/admin/products",
      title: "Catálogo de productos",
      body: (
        <p>
          Esta es la página donde se registra{" "}
          <strong>todo lo que vendes</strong>. Aquí puedes crear, editar,
          desactivar y eliminar productos, ver sus <strong>variantes</strong>{" "}
          (tallas, sabores, presentaciones), exportar e importar el catálogo y
          subir fotos en lote.
        </p>
      ),
    },
    {
      route: "/admin/products",
      selector: "[data-guide='crud-new']",
      title: "Crea tu primer producto",
      body: (
        <p>
          Presiona el botón <strong>«Nuevo»</strong> (arriba a la derecha) para
          abrir el formulario. Te explicaré campo por campo en el siguiente
          paso.
        </p>
      ),
      advanceOnClick: true,
    },
    {
      route: "/admin/products",
      selector: "#product-form",
      title: "El formulario de producto",
      body: (
        <div className="space-y-2">
          <p>
            Este es el formulario real. La guía permanecerá contigo mientras lo
            llenas:
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong>Nombre</strong> — cómo lo verá el cliente (ej. “Arroz 1
              kg”).
            </li>
            <li>
              <strong>Categoría</strong> — si no existe la que necesitas, créala
              desde el propio selector o ve antes a Catálogos → Categorías.
            </li>
            <li>
              <strong>Tipo</strong> — Estándar (variantes como talla/sabor),
              Granel (se vende por peso) o Personalizado (se construye con
              opciones: nieves, cafés, platillos).
            </li>
            <li>
              <strong>Precio, unidad e impuesto</strong> — el resto son
              opcionales.
            </li>
          </ul>
          <p className="pt-1 font-medium">
            Primero decide qué clase de producto vas a vender.
          </p>
        </div>
      ),
    },
    {
      route: "/admin/products",
      selector: "#product-productType",
      title: "Elige el tipo correcto",
      body: (
        <p>
          Usa <strong>Estándar</strong> para artículos y variantes;{" "}
          <strong>Granel</strong>
          para peso, volumen o longitud; y <strong>Personalizado</strong> para
          productos construidos con tamaños, ingredientes y extras. Los
          siguientes campos se adaptan a tu elección.
        </p>
      ),
    },
    {
      route: "/admin/products",
      selector: "#product-name",
      title: "Nombre claro para venta",
      body: (
        <p>
          Escribe el nombre que reconocerán tanto el cajero como el cliente. El
          sistema marcará aquí cualquier error antes de guardar.
        </p>
      ),
    },
    {
      route: "/admin/products",
      selector: "#product-category",
      title: "Categoría y catálogos relacionados",
      body: (
        <p>
          La categoría organiza el POS y el portal. Puedes elegir una existente
          o crearla desde este selector. El mismo patrón se aplica a unidades y
          otros selectores: crea el catálogo relacionado sin perder lo que ya
          capturaste.
        </p>
      ),
    },
    {
      route: "/admin/products",
      selector: "#product-taxRate",
      title: "Impuesto y datos comerciales",
      body: (
        <p>
          Confirma el impuesto aplicable. Después completa imagen, precio,
          costo, SKU, código de barras y los campos propios del tipo elegido.
        </p>
      ),
    },
    {
      route: "/admin/products",
      selector: "[data-guide='crud-submit']",
      title: "Crea el producto",
      body: (
        <p>
          Presiona <strong>«Crear producto»</strong>. Si falta algo, el
          formulario enfocará el primer campo inválido y mostrará todos los
          errores junto a sus campos. Continúa cuando el diálogo se cierre.
        </p>
      ),
    },
    {
      route: "/admin/products",
      selector: "[data-guide='crud-table']",
      title: "Tu producto ya está en la tabla",
      body: (
        <div className="space-y-2">
          <p>
            Tu producto aparece en la lista con su categoría, tipo y precio. En
            cada fila tienes:
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong>Lápiz</strong> — editar el producto.
            </li>
            <li>
              <strong>Capas</strong> — abrir sus <strong>variantes</strong> (si
              las incluye): ahí terminas de definir tallas/sabores y sus
              precios.
            </li>
            <li>
              <strong>Papelera</strong> — eliminar (borra también sus
              variantes).
            </li>
          </ul>
        </div>
      ),
    },
    {
      route: "/admin/products",
      selector: "[data-guide='variants-btn']",
      title: "Personaliza las variantes",
      body: (
        <p>
          Si tu producto usa tallas, sabores o presentaciones, abre{" "}
          <strong>«Variantes»</strong> en su fila y termina SKU, código, precio,
          costo e imagen. Si no usa variantes, continúa al inventario.
        </p>
      ),
    },
    {
      route: "/admin/inventory",
      title: "Inventario: tus existencias",
      body: (
        <p>
          Ya tienes el producto; ahora asegúrate de tener <strong>stock</strong>{" "}
          para vender. El inventario se maneja en esta página, eligiendo primero
          la <strong>sucursal</strong> (o CEDIS) arriba a la izquierda.
        </p>
      ),
    },
    {
      route: "/admin/inventory",
      selector: "[data-guide='inv-search']",
      title: "Busca tu producto",
      body: (
        <div className="space-y-2">
          <p>
            Escribe el <strong>nombre o SKU</strong> para encontrarlo. Aquí
            también puedes:
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Filtrar por tipo y ver solo los de stock bajo.</li>
            <li>Exportar el listado a Excel o PDF.</li>
            <li>Importar existencias desde un archivo Excel.</li>
          </ul>
        </div>
      ),
    },
    {
      route: "/admin/inventory",
      selector: "[data-value='movements']",
      title: "Historial de movimientos",
      body: (
        <p>
          La pestaña <strong>«Historial de movimientos»</strong> registra cada
          entrada y salida de mercancía (compras, ventas, devoluciones,
          ajustes). Regresa a la pestaña <strong>«Existencias»</strong> para el
          siguiente paso.
        </p>
      ),
    },
    {
      route: "/admin/inventory",
      selector: "[data-guide='inv-movement']",
      title: "Registra un movimiento",
      body: (
        <p>
          En la fila de tu producto, presiona <strong>«Movimiento»</strong>: ahí
          eliges el tipo — <strong>Compra</strong> (entrada),{" "}
          <strong>Ajuste</strong> (±, puede ser negativo),{" "}
          <strong>Venta</strong> (salida) o <strong>Devolución</strong>{" "}
          (entrada) — más la cantidad y un motivo opcional.
        </p>
      ),
      advanceOnClick: true,
    },
    {
      route: "/admin/inventory",
      selector: "[data-guide='movement-dialog']",
      title: "El formulario de movimiento",
      body: (
        <div className="space-y-2">
          <p>Consejos para llenarlo rápido:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Usa los botones de <strong>cantidad rápida</strong> (+1, +10, +50)
              o escribe directo el número.
            </li>
            <li>
              En <strong>Ajuste</strong>, una cantidad con signo{" "}
              <strong>menos</strong> (ej. -5) resta stock.
            </li>
            <li>El motivo queda registrado en el historial para auditoría.</li>
          </ul>
          <p className="pt-1 font-medium">
            Registra tu entrada de stock y continúa.
          </p>
        </div>
      ),
    },
    {
      route: "/admin/inventory",
      selector: "[data-guide='inv-threshold']",
      title: "Define el stock mínimo",
      body: (
        <p>
          El botón <strong>«Mínimo»</strong> de cada fila define el umbral:
          cuando el stock baje de ahí, el sistema te <strong>notifica</strong>{" "}
          para que reabastezcas antes de quedarte sin producto.
        </p>
      ),
    },
    {
      route: "/admin/inventory",
      selector: "[data-guide='inv-transfer']",
      title: "Traslada entre ubicaciones",
      body: (
        <p>
          Cuando tengas más de una sucursal o CEDIS, usa{" "}
          <strong>«Transferir»</strong>. Elige origen, destino y cantidad; el
          sistema valida disponibilidad y registra ambos movimientos.
        </p>
      ),
    },
    {
      title: "¡Terminaste el paso a paso! 🎉",
      body: (
        <p>
          Tu producto está registrado, con stock y mínimo configurado. Ya puedes
          venderlo en la caja o seguir agregando productos al catálogo.
        </p>
      ),
      actions: [
        { label: "Ir al POS a vender", href: "/pos", primary: true },
        { label: "Agregar otro producto", href: "/admin/products" },
        { label: "Volver al panel", href: "/admin" },
      ],
    },
  ],
}

// ── Guías de las demás tarjetas del dashboard ────────────────────────────────
// Navegan a la sección real y explican qué encontrarán ahí. El motor de spotlight
// se reutiliza; conforme existan selectores estables se agregan pasos con
// resaltado (ver `productGuide` como referencia de cómo hacerlo).

const combosGuide: GuideDef = {
  id: "combos",
  title: "Crea un combo",
  steps: [
    {
      title: "¿Qué es un combo?",
      body: (
        <p>
          Un combo es un paquete de productos (o construcciones) con un{" "}
          <strong>precio especial</strong>: ej. “Combo familiar = 2 pizzas + 2
          refrescos”. Atrae clientes y sube el ticket promedio.
        </p>
      ),
    },
    {
      route: "/admin/combos",
      selector: "[data-guide='combo-new']",
      title: "La página de combos",
      body: (
        <p>
          Aquí está la lista de tus combos. Presiona <strong>«Nuevo»</strong> y
          arma el paquete eligiendo los productos que lo componen y su precio
          final. Se desactivan o eliminan igual que un producto.
        </p>
      ),
    },
    {
      route: "/admin/combos",
      selector: "[data-guide='combo-dialog']",
      title: "Arma el combo en el formulario real",
      body: (
        <p>
          Define nombre, vigencia y precio; después agrega los productos y
          cantidades. El resumen compara el precio individual con el precio
          especial antes de guardar.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          El combo aparecerá en tu caja (POS) y en el portal del cliente.
          ¿Seguimos con otro paso de tu puesta en marcha?
        </p>
      ),
      actions: [
        { label: "Volver al panel", href: "/admin", primary: true },
        { label: "Crear un producto", href: "/admin/products" },
      ],
    },
  ],
}

const inventoryGuide: GuideDef = {
  id: "inventory",
  title: "Registra tu inventario",
  steps: [
    {
      route: "/admin/inventory",
      title: "Tu inventario en un solo lugar",
      body: (
        <p>
          Esta página concentra{" "}
          <strong>existencias, movimientos, mínimos y transferencias</strong>{" "}
          por sucursal. Elige la sucursal arriba a la izquierda y verás el stock
          de cada producto.
        </p>
      ),
    },
    {
      route: "/admin/inventory",
      selector: "[data-guide='inv-search']",
      title: "Busca y filtra",
      body: (
        <p>
          El buscador encuentra por nombre o SKU; también puedes filtrar por
          tipo de producto, ver solo <strong>stock bajo</strong>, exportar a
          Excel/PDF e importar existencias desde un archivo.
        </p>
      ),
    },
    {
      route: "/admin/inventory",
      selector: "[data-guide='inv-movement']",
      title: "Registra entradas y salidas",
      body: (
        <div className="space-y-2">
          <p>Lo esencial en esta página:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong>Movimiento</strong> — entradas y salidas de mercancía.
            </li>
            <li>
              <strong>Mínimo</strong> — umbral de alerta de stock bajo.
            </li>
            <li>
              <strong>Transferir</strong> — mover stock entre sucursales/CEDIS.
            </li>
          </ul>
        </div>
      ),
    },
    {
      route: "/admin/inventory",
      selector: "[data-guide='inv-threshold']",
      title: "Configura el mínimo",
      body: (
        <p>
          Define el nivel que dispara una alerta de reabastecimiento para esta
          variante y ubicación.
        </p>
      ),
    },
    {
      route: "/admin/inventory",
      selector: "[data-guide='inv-transfer']",
      title: "Transfiere existencias",
      body: (
        <p>
          Mueve unidades entre sucursales o CEDIS. El traslado conserva el
          historial de origen y destino.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Con tu inventario registrado el sistema te avisará cuando algo esté
          por agotarse. ¿Seguimos?
        </p>
      ),
      actions: [
        { label: "Volver al panel", href: "/admin", primary: true },
        { label: "Ir a productos", href: "/admin/products" },
      ],
    },
  ],
}

const tablesGuide: GuideDef = {
  id: "tables",
  title: "Configura tus mesas",
  steps: [
    {
      route: "/admin/tables",
      title: "El mapa de tu salón",
      body: (
        <p>
          Aquí dibujas el plano de tu restaurante: <strong>mesas</strong> con su
          número y capacidad, y también{" "}
          <strong>entradas, salidas, baños y cocina</strong>. Así quien asigna
          mesas ve todo el salón de un vistazo.
        </p>
      ),
    },
    {
      route: "/admin/tables",
      selector: "[data-guide='tables-plan']",
      title: "Diseña el plano real",
      body: (
        <div className="space-y-2">
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong>Crear mesas</strong> arrastrándolas en el plano y
              ajustando su capacidad.
            </li>
            <li>
              <strong>Configurar la política de reservación</strong> (días de
              anticipación, horarios, ocupación por reserva).
            </li>
            <li>
              <strong>QR para menú digital</strong> por mesa, y ver el historial
              de cada mesa.
            </li>
          </ul>
        </div>
      ),
    },
    {
      route: "/admin/tables",
      selector: "[data-guide='tables-policy']",
      title: "Define las reglas de reservación",
      body: (
        <p>
          Configura anticipación, duración, tolerancia y capacidad. Estas reglas
          se comparten con el panel, el portal y la reservación pública.
        </p>
      ),
    },
    {
      route: "/admin/tables",
      selector: "[data-guide='tables-reservation']",
      title: "Prueba una reservación",
      body: (
        <p>
          Abre el flujo real de reservación, elige fecha, turno, cantidad de
          personas y mesa. Así compruebas el recorrido antes de compartirlo.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Tu salón ya está mapeado y listo para asignar mesas desde el POS.
          ¿Seguimos con la cocina?
        </p>
      ),
      actions: [
        { label: "Activar pantalla de cocina", href: "/kds", primary: true },
        { label: "Volver al panel", href: "/admin" },
      ],
    },
  ],
}

const kdsGuide: GuideDef = {
  id: "kds",
  title: "Activa la pantalla de cocina",
  steps: [
    {
      title: "¿Qué es la pantalla de cocina?",
      body: (
        <p>
          Es una vista aparte (idealmente en una tablet o pantalla de la cocina)
          que muestra los pedidos en tiempo real, con{" "}
          <strong>sonido al recibir uno nuevo</strong> y estado por pedido
          (nuevo, preparando, listo).
        </p>
      ),
    },
    {
      route: "/kds",
      selector: "[data-guide='kds-screen']",
      title: "La pantalla de cocina",
      body: (
        <p>
          Esta pantalla recibe los pedidos que se mandan desde la caja (POS).
          Déjala abierta en la cocina y cada pedido aparecerá aquí
          automáticamente.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Cuando un cliente pida desde su mesa o en línea, la cocina lo verá al
          instante. ¿Volvemos al panel?
        </p>
      ),
      actions: [
        { label: "Volver al panel", href: "/admin", primary: true },
        { label: "Configurar mesas", href: "/admin/tables" },
      ],
    },
  ],
}

const agendaGuide: GuideDef = {
  id: "agenda",
  title: "Configura tu agenda de citas",
  steps: [
    {
      route: "/agenda",
      selector: "[data-guide='agenda-tabs']",
      title: "Tu agenda de citas",
      body: (
        <p>
          Aquí ves el calendario de citas por día y asignas cada servicio a tu{" "}
          <strong>personal</strong>. El cliente también puede reservar desde el
          portal.
        </p>
      ),
    },
    {
      route: "/agenda",
      selector: "[data-guide='agenda-calendar']",
      title: "Revisa disponibilidad",
      body: (
        <div className="space-y-2">
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong>Agendar</strong> la primera cita (cliente, servicio,
              personal y hora).
            </li>
            <li>
              <strong>Reagendar o cancelar</strong> con un clic; el cliente
              recibe el aviso.
            </li>
            <li>
              Marcar <strong>asistencia</strong> al terminar la cita.
            </li>
          </ul>
        </div>
      ),
    },
    {
      route: "/agenda",
      selector: "[data-guide='agenda-new']",
      title: "Agenda la primera cita",
      body: (
        <p>
          Abre el formulario real y elige cliente, servicio, miembro del equipo,
          fecha y hora. Si aún no asignaste servicios, usa primero la pestaña{" "}
          <strong>«Personal y servicios»</strong>.
        </p>
      ),
      advanceOnClick: true,
    },
    {
      route: "/agenda",
      selector: "[data-guide='agenda-dialog']",
      title: "Completa la cita sin salir de la agenda",
      body: (
        <p>
          Selecciona cliente, personal y servicio. La duración y la
          disponibilidad se validan contra el horario del empleado; agrega una
          nota si el equipo necesita preparación especial.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Tu agenda está lista para recibir citas del mostrador y del portal.
          ¿Volvemos al panel?
        </p>
      ),
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
}

const reservationGuide: GuideDef = {
  id: "reservation",
  title: "Configura tus reservaciones",
  steps: [
    {
      route: "/reservaciones",
      selector: "[data-guide='reservation-availability']",
      title: "Reservaciones y disponibilidad",
      body: (
        <p>
          Esta pantalla muestra el <strong>calendario de disponibilidad</strong>{" "}
          por día y las reservaciones existentes. Es el mismo flujo que usa el
          cliente en el portal: elegir día → hora → asientos → sala/mesa.
        </p>
      ),
    },
    {
      route: "/reservaciones",
      selector: "[data-guide='reservation-new']",
      title: "Aparta una unidad",
      body: (
        <div className="space-y-2">
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong>Reservar</strong> para un cliente desde aquí mismo.
            </li>
            <li>
              Ver el <strong>plano de salas/mesas</strong> y asignar la
              ubicación.
            </li>
            <li>
              Confirmar o cancelar reservaciones; el cliente recibe el aviso.
            </li>
          </ul>
        </div>
      ),
      advanceOnClick: true,
    },
    {
      route: "/reservaciones",
      selector: "[data-guide='reservation-dialog']",
      title: "Completa la renta",
      body: (
        <p>
          Selecciona o crea el cliente, indica entrega y devolución, añade
          artículos y cantidades. El sistema evita reservar más unidades de las
          disponibles.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: <p>Tu calendario ya acepta reservaciones. ¿Volvemos al panel?</p>,
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
}

const deliveryGuide: GuideDef = {
  id: "delivery",
  title: "Configura envíos y recoger",
  steps: [
    {
      route: "/admin/settings/delivery-policy",
      selector: "[data-guide='delivery-home']",
      title: "Política de entrega",
      body: (
        <p>
          Define aquí cómo entregas: <strong>costo de envío</strong> (fijo o por
          distancia), <strong>pedido mínimo</strong> para envío y los{" "}
          <strong>horarios</strong> en que aceptas pedidos. Todo se aplica en el
          portal del cliente.
        </p>
      ),
    },
    {
      route: "/admin/settings/delivery-policy",
      selector: "[data-guide='delivery-pickup']",
      title: "Recoger en tienda",
      body: (
        <p>
          Además del envío, el cliente puede elegir <strong>«Recoger»</strong> y
          verá el horario en que su pedido estará listo. Configura ese tiempo
          aquí mismo.
        </p>
      ),
    },
    {
      route: "/admin/settings/delivery-policy",
      selector: "[data-guide='delivery-save']",
      title: "Guarda y comprueba",
      body: (
        <p>
          Guarda los cambios y prueba ambos métodos desde el portal. Si activas
          pago en línea, continúa después en <strong>Ajustes → Pagos</strong>.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Con tu política guardada, los costos y horarios aparecen
          automáticamente en el portal. ¿Volvemos al panel?
        </p>
      ),
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
}

const creditGuide: GuideDef = {
  id: "credit",
  title: "Vende a crédito",
  steps: [
    {
      route: "/admin/settings/credit-policy",
      selector: "[data-guide='credit-config']",
      title: "Política de crédito",
      body: (
        <p>
          Configura el crédito a clientes: <strong>límite por cliente</strong>,{" "}
          <strong>plazo</strong> (ej. 30 días) y si aplica{" "}
          <strong>interés</strong>. Estos valores se aplican en caja y en el
          portal.
        </p>
      ),
    },
    {
      route: "/admin/settings/credit-policy",
      selector: "[data-guide='credit-save']",
      title: "¿Dónde se usa?",
      body: (
        <div className="space-y-2">
          <ul className="list-disc space-y-1 pl-4">
            <li>
              En <strong>caja</strong>: cobra con “a crédito” a clientes con
              cuenta.
            </li>
            <li>
              En el <strong>portal</strong>: el cliente ve su saldo, paga a
              plazos y recibe <strong>recordatorios</strong> antes de vencer.
            </li>
            <li>
              En <strong>Panel → Crédito</strong>: abonos, cargos y cortes de
              cuenta.
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: "¡Listo!",
      body: <p>Tu política de crédito está activa. ¿Volvemos al panel?</p>,
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
}

const promotionGuide: GuideDef = {
  id: "promotion",
  title: "Crea una promoción",
  steps: [
    {
      route: "/admin/promotions",
      selector: "[data-guide='crud-new']",
      title: "Promociones",
      body: (
        <p>
          Crea descuentos por porcentaje, monto fijo, <strong>2x1</strong> o
          cupones con vigencia. La promoción aplica automáticamente en caja y en
          el portal.
        </p>
      ),
    },
    {
      route: "/admin/promotions",
      selector: "[data-guide='promotions-dialog']",
      title: "Configura el formulario real",
      body: (
        <p>
          Empieza simple: elige el producto, el tipo de descuento y las fechas.{" "}
          <strong>Actívala</strong> al guardar y aparecerá en la tienda en línea
          al instante.
        </p>
      ),
    },
    {
      route: "/admin/promotions",
      selector: "[data-guide='crud-submit']",
      title: "Valida y publica",
      body: (
        <p>
          Guarda la promoción. Si está activa, el sistema prepara también su
          publicación. Verifica después el resultado en POS y portal.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: <p>Tu promoción está en marcha. ¿Volvemos al panel?</p>,
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
}

const paymentsGuide: GuideDef = {
  id: "payments",
  title: "Activa pagos en línea",
  steps: [
    {
      route: "/admin/settings/payments",
      selector: "[data-guide='payments-provider']",
      title: "Pagos en línea",
      body: (
        <p>
          Conecta tu cuenta de <strong>Stripe o MercadoPago</strong> para que el
          cliente pague en línea al pedir en el portal. Sin esto, el cliente
          solo podrá pagar en tienda o contra entrega.
        </p>
      ),
    },
    {
      route: "/admin/settings/payments",
      selector: "[data-guide='payments-save']",
      title: "También en caja",
      body: (
        <p>
          Los métodos que actives aquí también aparecen en la caja (POS):
          efectivo, tarjeta, transferencia y pago en línea.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: <p>Pagos en línea activados. ¿Volvemos al panel?</p>,
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
}

const companyGuide: GuideDef = {
  id: "company",
  title: "Completa los datos de tu empresa",
  steps: [
    {
      route: "/admin/settings/company",
      selector: "#company-form",
      title: "Tu empresa",
      body: (
        <p>
          Registra tu <strong>razón social, RFC, dirección y contacto</strong>.
          Estos datos salen en tus tickets, facturas e informes — es importante
          que estén correctos.
        </p>
      ),
    },
    {
      route: "/admin/settings/company",
      selector: "[data-guide='company-save']",
      title: "Logo, contacto y guardado",
      body: (
        <p>
          También puedes subir aquí tu <strong>logo</strong>: aparecerá en los
          tickets, en el portal y en la pantalla de inicio.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: <p>Datos de empresa completos. ¿Volvemos al panel?</p>,
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
}

const portalGuide: GuideDef = {
  id: "portal",
  title: "Prueba tu portal",
  steps: [
    {
      route: "/admin/customers",
      selector: "[data-guide='crud-new']",
      title: "Crea un cliente de prueba",
      body: (
        <p>
          El portal es para tus <strong>clientes</strong>. Para probarlo
          necesitas una cuenta de cliente: créala en{" "}
          <strong>Catálogos → Clientes</strong> (se le asigna una contraseña
          inicial).
        </p>
      ),
      advanceOnClick: true,
    },
    {
      route: "/admin/customers",
      selector: "[data-guide='customers-dialog']",
      title: "Completa la cuenta real",
      body: (
        <p>
          Captura nombre, correo y los datos necesarios. Guarda la cuenta y
          conserva sus credenciales de prueba para abrir el portal en una sesión
          separada.
        </p>
      ),
    },
    {
      route: "/admin/customers",
      title: "Cierra el círculo",
      body: (
        <p>
          Abre el portal en otra pestaña o en una ventana privada, entra con el
          cliente de prueba y haz un pedido. Después vuelve a{" "}
          <strong>Operación → Pedidos</strong>
          para verlo, prepararlo y completar su entrega.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: <p>Tu tienda en línea ya vende. ¿Volvemos al panel?</p>,
      actions: [
        {
          label: "Abrir portal en otra pestaña",
          href: "/portal/auth/login",
          primary: true,
          newTab: true,
        },
        { label: "Ver pedidos", href: "/admin/orders" },
        { label: "Volver al panel", href: "/admin" },
      ],
    },
  ],
}

const posFoodGuide: GuideDef = {
  id: "pos-food",
  title: "Mesa, cocina y cobro",
  steps: [
    {
      route: "/pos",
      selector: "[data-guide='pos-table']",
      title: "Selecciona la mesa",
      body: (
        <p>
          Abre el mapa y elige la mesa antes de agregar productos. El ticket y
          la comanda quedarán ligados a esa mesa.
        </p>
      ),
      advanceOnClick: true,
    },
    {
      route: "/pos",
      selector: "[data-guide='pos-table-dialog']",
      title: "Revisa el estado del salón",
      body: (
        <p>
          Las mesas libres, ocupadas y reservadas se distinguen aquí. Elige una
          libre para continuar el recorrido en la caja.
        </p>
      ),
    },
    {
      route: "/pos",
      selector: "[data-guide='pos-send-kitchen']",
      title: "Envía la comanda",
      body: (
        <p>
          Agrega productos al ticket y usa <strong>«Enviar a cocina»</strong>.
          Solo se envían las líneas nuevas; el estado se actualiza en vivo.
        </p>
      ),
    },
    {
      route: "/kds",
      selector: "[data-guide='kds-screen']",
      title: "Cocina continúa el pedido",
      body: (
        <p>
          En KDS el equipo marca la comanda como preparando y luego lista. La
          caja ve esos cambios sin recargar.
        </p>
      ),
    },
    {
      route: "/pos",
      selector: "[data-guide='pos-checkout']",
      title: "Cobra y libera",
      body: (
        <p>
          Cuando el pedido esté listo, vuelve al POS, abre la mesa y cobra. Al
          completar el pago, la mesa queda libre para el siguiente cliente.
        </p>
      ),
    },
    {
      title: "Flujo de mesa terminado",
      body: (
        <p>
          Ya recorriste la operación completa: mesa, comanda, cocina y cobro.
        </p>
      ),
      actions: [
        { label: "Seguir en el POS", href: "/pos", primary: true },
        { label: "Volver al panel", href: "/admin" },
      ],
    },
  ],
}

const purchasingGuide: GuideDef = {
  id: "purchasing",
  title: "Realiza tu primera compra",
  steps: [
    {
      route: "/admin/purchasing",
      selector: "[data-guide='purchasing-workspace']",
      title: "Tu ciclo de abastecimiento",
      body: (
        <p>
          Esta mesa de trabajo conecta{" "}
          <strong>proveedores, cotizaciones, órdenes y recepciones</strong>.
          Cada entrada queda ligada al inventario y conserva quién la realizó.
        </p>
      ),
    },
    {
      route: "/admin/purchasing",
      selector: "[data-guide='supplier-new']",
      title: "Registra al proveedor",
      body: (
        <p>
          Comienza con <strong>Nuevo proveedor</strong>. Guarda razón social,
          contacto, condiciones de pago y días habituales de entrega.
        </p>
      ),
      advanceOnClick: true,
    },
    {
      route: "/admin/purchasing",
      selector: "[data-guide='supplier-dialog']",
      title: "Completa su ficha comercial",
      body: (
        <p>
          Solo la razón social es obligatoria. El código se genera
          automáticamente. Los demás datos ayudan a comparar condiciones y dar
          seguimiento sin buscar información fuera del sistema.
        </p>
      ),
    },
    {
      route: "/admin/purchasing",
      selector: "[data-guide='supplier-link']",
      title: "Vincula su catálogo",
      body: (
        <p>
          Relaciona productos o variantes con el proveedor. Puedes guardar su
          SKU, costo, pedido mínimo y marcarlo como proveedor preferido.
        </p>
      ),
    },
    {
      route: "/admin/purchasing",
      selector: "[data-guide='purchasing-quotes-tab']",
      title: "Solicita una cotización",
      body: (
        <p>
          Abre <strong>Cotizaciones</strong> para registrar lo que necesitas,
          cantidades y vigencia. Todavía no modifica inventario.
        </p>
      ),
      advanceOnClick: true,
    },
    {
      route: "/admin/purchasing",
      selector: "[data-guide='quote-new']",
      title: "Crea la solicitud",
      body: (
        <p>
          Selecciona el proveedor y agrega cada producto. Los costos vinculados
          sirven como referencia y pueden ajustarse antes de continuar.
        </p>
      ),
    },
    {
      route: "/admin/purchasing",
      selector: "[data-guide='purchasing-orders-tab']",
      title: "Convierte y aprueba la orden",
      body: (
        <p>
          Desde una cotización usa <strong>Crear orden</strong>, elige sucursal
          o CEDIS de destino y revisa totales. La aprobación queda separada por
          permiso para mantener control interno.
        </p>
      ),
      advanceOnClick: true,
    },
    {
      route: "/admin/purchasing",
      selector: "[data-guide='order-list']",
      title: "Sigue el pedido",
      body: (
        <p>
          La orden pasa por borrador, aprobada y enviada. El estado y las
          cantidades recibidas muestran lo que sigue pendiente.
        </p>
      ),
    },
    {
      route: "/admin/purchasing",
      selector: "[data-guide='receive-action']",
      title: "Recibe la mercancía",
      body: (
        <p>
          Cuando llegue el pedido, pulsa <strong>Recibir</strong>. Confirma
          únicamente las cantidades físicas; puedes hacer varias recepciones
          parciales y el sistema impide exceder lo solicitado.
        </p>
      ),
    },
    {
      route: "/admin/purchasing",
      selector: "[data-guide='purchasing-receipts-tab']",
      title: "Comprueba la entrada",
      body: (
        <p>
          El historial conserva el folio de recepción. Al confirmar, se
          incrementa el inventario del destino, se registra el movimiento de
          compra y se actualiza el costo de la variante.
        </p>
      ),
    },
    {
      title: "Compra registrada de principio a fin",
      body: (
        <p>
          Ya conoces el ciclo completo de abastecimiento. Puedes revisar las
          existencias resultantes o iniciar otra compra.
        </p>
      ),
      actions: [
        { label: "Ver inventario", href: "/admin/inventory", primary: true },
        { label: "Nueva compra", href: "/admin/purchasing" },
        { label: "Volver al panel", href: "/admin" },
      ],
    },
  ],
}

export const GUIDES: Record<string, GuideDef> = {
  product: productGuide,
  combos: combosGuide,
  inventory: inventoryGuide,
  tables: tablesGuide,
  kds: kdsGuide,
  agenda: agendaGuide,
  reservation: reservationGuide,
  delivery: deliveryGuide,
  credit: creditGuide,
  promotion: promotionGuide,
  payments: paymentsGuide,
  company: companyGuide,
  portal: portalGuide,
  "pos-food": posFoodGuide,
  purchasing: purchasingGuide,
}
