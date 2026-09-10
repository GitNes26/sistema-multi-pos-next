import type { ReactNode } from "react";

// FASE — Definiciones de las guías inmersivas del panel admin.
// Cada guía es una secuencia de pasos que navega entre las páginas REALES del
// sistema, resalta el elemento que hay que tocar (selector) y explica qué hace.
// Si un selector no aparece (o no existe en esa vista), el coach muestra el paso
// como explicación centrada — la guía nunca se rompe por eso.

export interface GuideStepAction {
  label: string;
  href: string;
  primary?: boolean;
}

export interface GuideStep {
  /** Ruta donde vive el paso. Si difiere de la actual, el coach navega primero. */
  route?: string;
  /** Selector CSS del elemento a resaltar. Sin selector → explicación centrada. */
  selector?: string;
  /** Si el paso avanza solo al hacer clic en el elemento resaltado. */
  advanceOnClick?: boolean;
  title: string;
  body: ReactNode;
  /** Botones de acción al final del paso (navegan y cierran la guía). */
  actions?: GuideStepAction[];
}

export interface GuideDef {
  id: string;
  title: string;
  steps: GuideStep[];
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
          Esta es la página donde se registra <strong>todo lo que vendes</strong>.
          Aquí puedes crear, editar, desactivar y eliminar productos, ver sus{" "}
          <strong>variantes</strong> (tallas, sabores, presentaciones), exportar e
          importar el catálogo y subir fotos en lote.
        </p>
      ),
    },
    {
      selector: "[data-guide='crud-new']",
      title: "Crea tu primer producto",
      body: (
        <p>
          Presiona el botón <strong>«Nuevo»</strong> (arriba a la derecha) para abrir
          el formulario. Te explicaré campo por campo en el siguiente paso.
        </p>
      ),
      advanceOnClick: true,
    },
    {
      selector: "#product-form",
      title: "El formulario de producto",
      body: (
        <div className="space-y-2">
          <p>Llena los campos principales:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong>Nombre</strong> — cómo lo verá el cliente (ej. “Arroz 1 kg”).
            </li>
            <li>
              <strong>Categoría</strong> — si no existe la que necesitas, créala
              desde el propio selector o ve antes a Catálogos → Categorías.
            </li>
            <li>
              <strong>Tipo</strong> — Estándar (variantes como talla/sabor),
              Granel (se vende por peso) o Personalizado (se construye con opciones:
              nieves, cafés, platillos).
            </li>
            <li>
              <strong>Precio, unidad e impuesto</strong> — el resto son opcionales.
            </li>
          </ul>
          <p className="pt-1 font-medium">
            Termina con «Crear producto». Cuando aparezca en la tabla, continúa.
          </p>
        </div>
      ),
    },
    {
      title: "Tu producto ya está en la tabla",
      body: (
        <div className="space-y-2">
          <p>
            Tu producto aparece en la lista con su categoría, tipo y precio. En cada
            fila tienes:
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong>Lápiz</strong> — editar el producto.
            </li>
            <li>
              <strong>Capas</strong> — abrir sus <strong>variantes</strong> (si las
              incluye): ahí terminas de definir tallas/sabores y sus precios.
            </li>
            <li>
              <strong>Papelera</strong> — eliminar (borra también sus variantes).
            </li>
          </ul>
        </div>
      ),
      actions: [{ label: "Abrir variantes", href: "/admin/products" }],
    },
    {
      route: "/admin/inventory",
      title: "Inventario: tus existencias",
      body: (
        <p>
          Ya tienes el producto; ahora asegúrate de tener <strong>stock</strong> para
          vender. El inventario se maneja en esta página, eligiendo primero la{" "}
          <strong>sucursal</strong> (o CEDIS) arriba a la izquierda.
        </p>
      ),
    },
    {
      selector: "[data-guide='inv-search']",
      title: "Busca tu producto",
      body: (
        <div className="space-y-2">
          <p>
            Escribe el <strong>nombre o SKU</strong> para encontrarlo. Aquí también
            puedes:
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
      selector: "[data-value='movements']",
      title: "Historial de movimientos",
      body: (
        <p>
          La pestaña <strong>«Historial de movimientos»</strong> registra cada entrada
          y salida de mercancía (compras, ventas, devoluciones, ajustes). Regresa a
          la pestaña <strong>«Existencias»</strong> para el siguiente paso.
        </p>
      ),
    },
    {
      selector: "[data-guide='inv-movement']",
      title: "Registra un movimiento",
      body: (
        <p>
          En la fila de tu producto, presiona <strong>«Movimiento»</strong>: ahí
          eliges el tipo — <strong>Compra</strong> (entrada), <strong>Ajuste</strong>{" "}
          (±, puede ser negativo), <strong>Venta</strong> (salida) o{" "}
          <strong>Devolución</strong> (entrada) — más la cantidad y un motivo
          opcional.
        </p>
      ),
      advanceOnClick: true,
    },
    {
      selector: "[data-guide='movement-dialog']",
      title: "El formulario de movimiento",
      body: (
        <div className="space-y-2">
          <p>Consejos para llenarlo rápido:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Usa los botones de <strong>cantidad rápida</strong> (+1, +10, +50) o
              escribe directo el número.
            </li>
            <li>
              En <strong>Ajuste</strong>, una cantidad con signo <strong>menos</strong>{" "}
              (ej. -5) resta stock.
            </li>
            <li>El motivo queda registrado en el historial para auditoría.</li>
          </ul>
          <p className="pt-1 font-medium">Registra tu entrada de stock y continúa.</p>
        </div>
      ),
    },
    {
      selector: "[data-guide='inv-threshold']",
      title: "Define el stock mínimo",
      body: (
        <p>
          El botón <strong>«Mínimo»</strong> de cada fila define el umbral: cuando el
          stock baje de ahí, el sistema te <strong>notifica</strong> para que
          reabastezcas antes de quedarte sin producto.
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
};

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
      title: "La página de combos",
      body: (
        <p>
          Aquí está la lista de tus combos. Presiona <strong>«Nuevo»</strong> y
          arma el paquete eligiendo los productos que lo componen y su precio final.
          Se desactivan o eliminan igual que un producto.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          El combo aparecerá en tu caja (POS) y en el portal del cliente. ¿Seguimos
          con otro paso de tu puesta en marcha?
        </p>
      ),
      actions: [
        { label: "Volver al panel", href: "/admin", primary: true },
        { label: "Crear un producto", href: "/admin/products" },
      ],
    },
  ],
};

const inventoryGuide: GuideDef = {
  id: "inventory",
  title: "Registra tu inventario",
  steps: [
    {
      route: "/admin/inventory",
      title: "Tu inventario en un solo lugar",
      body: (
        <p>
          Esta página concentra <strong>existencias, movimientos, mínimos y
          transferencias</strong> por sucursal. Elige la sucursal arriba a la
          izquierda y verás el stock de cada producto.
        </p>
      ),
    },
    {
      selector: "[data-guide='inv-search']",
      title: "Busca y filtra",
      body: (
        <p>
          El buscador encuentra por nombre o SKU; también puedes filtrar por tipo de
          producto, ver solo <strong>stock bajo</strong>, exportar a Excel/PDF e
          importar existencias desde un archivo.
        </p>
      ),
    },
    {
      title: "¿Por dónde empezar?",
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
      title: "¡Listo!",
      body: (
        <p>
          Con tu inventario registrado el sistema te avisará cuando algo esté por
          agotarse. ¿Seguimos?
        </p>
      ),
      actions: [
        { label: "Volver al panel", href: "/admin", primary: true },
        { label: "Ir a productos", href: "/admin/products" },
      ],
    },
  ],
};

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
          número y capacidad, y también <strong>entradas, salidas, baños y
          cocina</strong>. Así quien asigna mesas ve todo el salón de un vistazo.
        </p>
      ),
    },
    {
      title: "¿Qué puedes hacer?",
      body: (
        <div className="space-y-2">
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong>Crear mesas</strong> arrastrándolas en el plano y ajustando su
              capacidad.
            </li>
            <li>
              <strong>Configurar la política de reservación</strong> (días de
              anticipación, horarios, ocupación por reserva).
            </li>
            <li>
              <strong>QR para menú digital</strong> por mesa, y ver el historial de
              cada mesa.
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Tu salón ya está mapeado y listo para asignar mesas desde el POS. ¿Seguimos
          con la cocina?
        </p>
      ),
      actions: [
        { label: "Activar pantalla de cocina", href: "/kds", primary: true },
        { label: "Volver al panel", href: "/admin" },
      ],
    },
  ],
};

const kdsGuide: GuideDef = {
  id: "kds",
  title: "Activa la pantalla de cocina",
  steps: [
    {
      title: "¿Qué es la pantalla de cocina?",
      body: (
        <p>
          Es una vista aparte (idealmente en una tablet o pantalla de la cocina) que
          muestra los pedidos en tiempo real, con <strong>sonido al recibir uno
          nuevo</strong> y estado por pedido (nuevo, preparando, listo).
        </p>
      ),
    },
    {
      route: "/kds",
      title: "La pantalla de cocina",
      body: (
        <p>
          Esta pantalla recibe los pedidos que se mandan desde la caja (POS). Déjala
          abierta en la cocina y cada pedido aparecerá aquí automáticamente.
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
};

const agendaGuide: GuideDef = {
  id: "agenda",
  title: "Configura tu agenda de citas",
  steps: [
    {
      route: "/agenda",
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
      title: "¿Qué puedes hacer?",
      body: (
        <div className="space-y-2">
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong>Agendar</strong> la primera cita (cliente, servicio, personal y
              hora).
            </li>
            <li>
              <strong>Reagendar o cancelar</strong> con un clic; el cliente recibe el
              aviso.
            </li>
            <li>Marcar <strong>asistencia</strong> al terminar la cita.</li>
          </ul>
        </div>
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
};

const reservationGuide: GuideDef = {
  id: "reservation",
  title: "Configura tus reservaciones",
  steps: [
    {
      route: "/reservaciones",
      title: "Reservaciones y disponibilidad",
      body: (
        <p>
          Esta pantalla muestra el <strong>calendario de disponibilidad</strong> por
          día y las reservaciones existentes. Es el mismo flujo que usa el cliente en
          el portal: elegir día → hora → asientos → sala/mesa.
        </p>
      ),
    },
    {
      title: "¿Qué puedes hacer?",
      body: (
        <div className="space-y-2">
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong>Reservar</strong> para un cliente desde aquí mismo.
            </li>
            <li>
              Ver el <strong>plano de salas/mesas</strong> y asignar la ubicación.
            </li>
            <li>
              Confirmar o cancelar reservaciones; el cliente recibe el aviso.
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Tu calendario ya acepta reservaciones. ¿Volvemos al panel?
        </p>
      ),
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
};

const deliveryGuide: GuideDef = {
  id: "delivery",
  title: "Configura envíos y recoger",
  steps: [
    {
      route: "/admin/settings/delivery-policy",
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
      title: "Recoger en tienda",
      body: (
        <p>
          Además del envío, el cliente puede elegir <strong>«Recoger»</strong> y verá
          el horario en que su pedido estará listo. Configura ese tiempo aquí mismo.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Con tu política guardada, los costos y horarios aparecen automáticamente en
          el portal. ¿Volvemos al panel?
        </p>
      ),
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
};

const creditGuide: GuideDef = {
  id: "credit",
  title: "Vende a crédito",
  steps: [
    {
      route: "/admin/settings/credit-policy",
      title: "Política de crédito",
      body: (
        <p>
          Configura el crédito a clientes: <strong>límite por cliente</strong>,{" "}
          <strong>plazo</strong> (ej. 30 días) y si aplica <strong>interés</strong>.
          Estos valores se aplican en caja y en el portal.
        </p>
      ),
    },
    {
      title: "¿Dónde se usa?",
      body: (
        <div className="space-y-2">
          <ul className="list-disc space-y-1 pl-4">
            <li>
              En <strong>caja</strong>: cobra con “a crédito” a clientes con cuenta.
            </li>
            <li>
              En el <strong>portal</strong>: el cliente ve su saldo, paga a plazos y
              recibe <strong>recordatorios</strong> antes de vencer.
            </li>
            <li>
              En <strong>Panel → Crédito</strong>: abonos, cargos y cortes de cuenta.
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Tu política de crédito está activa. ¿Volvemos al panel?
        </p>
      ),
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
};

const promotionGuide: GuideDef = {
  id: "promotion",
  title: "Crea una promoción",
  steps: [
    {
      route: "/admin/promotions",
      title: "Promociones",
      body: (
        <p>
          Crea descuentos por porcentaje, monto fijo, <strong>2x1</strong> o cupones
          con vigencia. La promoción aplica automáticamente en caja y en el portal.
        </p>
      ),
    },
    {
      title: "Consejo",
      body: (
        <p>
          Empieza simple: elige el producto, el tipo de descuento y las fechas.{" "}
          <strong>Actívala</strong> al guardar y aparecerá en la tienda en línea al
          instante.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Tu promoción está en marcha. ¿Volvemos al panel?
        </p>
      ),
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
};

const paymentsGuide: GuideDef = {
  id: "payments",
  title: "Activa pagos en línea",
  steps: [
    {
      route: "/admin/settings/payments",
      title: "Pagos en línea",
      body: (
        <p>
          Conecta tu cuenta de <strong>Stripe o MercadoPago</strong> para que el
          cliente pague en línea al pedir en el portal. Sin esto, el cliente solo
          podrá pagar en tienda o contra entrega.
        </p>
      ),
    },
    {
      title: "También en caja",
      body: (
        <p>
          Los métodos que actives aquí también aparecen en la caja (POS): efectivo,
          tarjeta, transferencia y pago en línea.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Pagos en línea activados. ¿Volvemos al panel?
        </p>
      ),
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
};

const companyGuide: GuideDef = {
  id: "company",
  title: "Completa los datos de tu empresa",
  steps: [
    {
      route: "/admin/settings/company",
      title: "Tu empresa",
      body: (
        <p>
          Registra tu <strong>razón social, RFC, dirección y contacto</strong>. Estos
          datos salen en tus tickets, facturas e informes — es importante que estén
          correctos.
        </p>
      ),
    },
    {
      title: "Dato",
      body: (
        <p>
          También puedes subir aquí tu <strong>logo</strong>: aparecerá en los
          tickets, en el portal y en la pantalla de inicio.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Datos de empresa completos. ¿Volvemos al panel?
        </p>
      ),
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
};

const portalGuide: GuideDef = {
  id: "portal",
  title: "Prueba tu portal",
  steps: [
    {
      route: "/admin/customers",
      title: "Crea un cliente de prueba",
      body: (
        <p>
          El portal es para tus <strong>clientes</strong>. Para probarlo necesitas una
          cuenta de cliente: créala en <strong>Catálogos → Clientes</strong> (se le
          asigna una contraseña inicial).
        </p>
      ),
    },
    {
      route: "/portal",
      title: "Entra como cliente",
      body: (
        <p>
          Abre el portal en otra pestaña con el email y contraseña del cliente de
          prueba: verás tu <strong>tienda</strong>, el menú, promociones, pedidos,
          reservaciones y crédito según lo que tengas habilitado.
        </p>
      ),
    },
    {
      title: "Cierra el círculo",
      body: (
        <p>
          Haz un pedido de prueba: aparecerá en <strong>Operación → Pedidos</strong>{" "}
          de tu panel en tiempo real, listo para prepararlo.
        </p>
      ),
    },
    {
      title: "¡Listo!",
      body: (
        <p>
          Tu tienda en línea ya vende. ¿Volvemos al panel?
        </p>
      ),
      actions: [{ label: "Volver al panel", href: "/admin", primary: true }],
    },
  ],
};

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
};