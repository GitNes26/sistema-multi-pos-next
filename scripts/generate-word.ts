import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  PageBreak, TabStopPosition, TabStopType, TableOfContents,
} from "docx";
import { writeFileSync } from "fs";

const BLUE = "1a56db";
const GRAY = "f3f4f6";
const GREEN = "16a34a";
const YELLOW = "ca8a04";
const RED = "dc2626";

function title(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, color: BLUE, size: 32 })],
  });
}

function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, color: BLUE, size: 28 })],
  });
}

function h3(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24 })],
  });
}

function p(text: string) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function bold(text: string) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, bold: true, size: 22 })],
  });
}

function cell(text: string, opts?: { bold?: boolean; shading?: string; width?: number }) {
  return new TableCell({
    width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts?.shading ? { fill: opts.shading, type: ShadingType.CLEAR, color: "auto" } : undefined,
    children: [new Paragraph({
      children: [new TextRun({ text, bold: opts?.bold, size: 20 })],
    })],
  });
}

function headerCell(text: string, width?: number) {
  return cell(text, { bold: true, shading: "e5e7eb", width });
}

function table(headers: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((h) => headerCell(h)) }),
      ...rows.map((r) =>
        new TableRow({
          children: r.map((c) => cell(c)),
        })
      ),
    ],
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 80 }, children: [] });
}

// ─── NEGOCIOS DATA ───

const negocios: Record<string, { giro: string; situaciones: string[][] }> = {
  "TIENDA DE ABARROTES": {
    giro: "Venta de alimentos, productos de consumo diario, abarrotes varios.",
    situaciones: [
      ["1", "Venta rápida de productos con código de barras", "Esencial"],
      ["2", "Control de efectivo en caja diario", "Esencial"],
      ["3", "Inventario de productos perecederos", "Esencial"],
      ["4", "Producto a granel (gramos, litros, piezas)", "Necesario"],
      ["5", "Precios diferentes por presentación (pza, 6-pack, 12-pack)", "Necesario"],
      ["6", "Promociones de \"2x1\", \"3x2\", descuentos por volumen", "Necesario"],
      ["7", "Clientes frecuentes con puntos de lealtad", "Deseable"],
      ["8", "Pedido por teléfono/WhatsApp para recoger", "Deseable"],
      ["9", "Reporte de ventas diario/quincenal/mensual", "Esencial"],
      ["10", "Control de Mínimos/Máximos de inventario", "Esencial"],
      ["11", "Revisión física de inventario (conteo)", "Necesario"],
      ["12", "Notas de crédito / devoluciones", "Necesario"],
      ["13", "Múltiples denominaciones de efectivo", "Esencial"],
      ["14", "Venta de productos con variantes (sabores, tamaños)", "Necesario"],
      ["15", "Cupones de descuento para clientes", "Deseable"],
      ["16", "Gestión de proveedores y compras", "Deseable"],
      ["17", "Cajero con permisos limitados", "Esencial"],
      ["18", "Corte de caja al cerrar", "Esencial"],
      ["19", "Lista de precios por cliente mayoreo", "Deseable"],
      ["20", "Cobro con tarjeta (terminal bancaria)", "Necesario"],
    ],
  },
  "FERRETERÍA": {
    giro: "Venta de herramientas, materiales de construcción, plomería, electricidad.",
    situaciones: [
      ["1", "Venta de productos por unidad, caja, rollo, litro, kg", "Esencial"],
      ["2", "Producto a granel (cemento, arena, varilla por metro)", "Esencial"],
      ["3", "Variantes por medida (tornillo 1/4\", 3/8\", 1/2\")", "Esencial"],
      ["4", "Cotizaciones para proyectos de construcción", "Necesario"],
      ["5", "Venta a crédito (fiado) con control de adeudos", "Necesario"],
      ["6", "Clientes mayoristas con precios especiales", "Necesario"],
      ["7", "Inventario con mínimo bajo y máximo alto", "Esencial"],
      ["8", "Transferencias entre sucursales", "Necesario"],
      ["9", "Pedido por catálogo (producto no visible en mostrador)", "Deseable"],
      ["10", "Venta con instalación/servicio (costo separado)", "Deseable"],
      ["11", "Control de series/números de serie", "Deseable"],
      ["12", "Garantías y devoluciones de mercancía", "Necesario"],
      ["13", "Ticket con datos fiscales (RFC, dirección)", "Esencial"],
      ["14", "Reporte de ventas por categoría", "Necesario"],
      ["15", "Comisiones por venta a empleados", "Deseable"],
      ["16", "Venta de precios redondeados", "Esencial"],
      ["17", "Gestión de proveedores y tiempos de entrega", "Deseable"],
      ["18", "Múltiples formas de pago", "Esencial"],
      ["19", "Descuento por pago anticipado", "Deseable"],
      ["20", "Localización GPS para delivery", "Necesario"],
    ],
  },
  "NIEVES": {
    giro: "Venta de nieves artesanales, preparadas al momento según sabor, topping, tamaño.",
    situaciones: [
      ["1", "Producto configurado al gusto (sabor + topping + tamaño)", "Esencial"],
      ["2", "Variantes múltiples (sabores: fresa, chocolate, vainilla, etc.)", "Esencial"],
      ["3", "Tamaños diferentes con precio distinto", "Esencial"],
      ["4", "Combos (nieve + galleta + bebida)", "Necesario"],
      ["5", "Control de inventario de insumos (leche, frutas, toppings)", "Esencial"],
      ["6", "Receta/producción (cuánto insumo se necesita por nieve)", "Necesario"],
      ["7", "Venta por temporada (verano = más ventas)", "Deseable"],
      ["8", "Pedido en línea para recoger o delivery", "Necesario"],
      ["9", "Horarios variables (abierto solo tardes, fines de semana)", "Esencial"],
      ["10", "Venta rápida con poco personal", "Esencial"],
      ["11", "Puntos de lealtad para clientes recurrentes", "Deseable"],
      ["12", "Promociones \"2x1 los martes\"", "Necesario"],
      ["13", "Control de caja diario", "Esencial"],
      ["14", "Notificaciones cuando un pedido está listo", "Necesario"],
      ["15", "Imágenes de cada sabor/topping para el menú", "Deseable"],
      ["16", "Delivery con confirmación por PIN", "Necesario"],
      ["17", "Reporte de sabores más vendidos", "Necesario"],
      ["18", "Horarios de apertura por día", "Esencial"],
      ["19", "Pago con tarjeta", "Necesario"],
      ["20", "Control de desperdicio de insumos", "Deseable"],
    ],
  },
  "SNACKS Y BEBIDAS": {
    giro: "Venta de bebidas frías, refrescos, aguas frescas, snacks, botanas.",
    situaciones: [
      ["1", "Venta rápida de productos embotellados/enlatados", "Esencial"],
      ["2", "Aguas de sabor preparadas (sabor + tamaño)", "Esencial"],
      ["3", "Variantes por sabor y tamaño", "Esencial"],
      ["4", "Productos con código de barras (escaneo rápido)", "Esencial"],
      ["5", "Control de temperatura/caducidad de bebidas", "Necesario"],
      ["6", "Combo (refresco + papas) con precio especial", "Necesario"],
      ["7", "Precio distinto para llevar vs consumir en local", "Deseable"],
      ["8", "Delivery a oficinas cercanas", "Necesario"],
      ["9", "Pedido rápido sin registro (venta anónima)", "Esencial"],
      ["10", "Inventario mínimo de bebidas populares", "Esencial"],
      ["11", "Promociones por volumen (6 refrescos = descuento)", "Necesario"],
      ["12", "Horarios de operación (7am-10pm)", "Esencial"],
      ["13", "Pago en efectivo y tarjeta", "Esencial"],
      ["14", "Cierre de caja diario", "Esencial"],
      ["15", "Clientes recurrentes con puntos", "Deseable"],
      ["16", "Stock de productos de temporada", "Deseable"],
      ["17", "Venta en eventos/fiestas (pedido grande)", "Deseable"],
      ["18", "Reporte de productos más vendidos", "Necesario"],
      ["19", "Notificación de stock bajo", "Necesario"],
      ["20", "Múltiples puntos de venta (local + carrito)", "Deseable"],
    ],
  },
  "BARBERÍA / ESTÉTICA": {
    giro: "Servicios de corte de cabello, afeitado, faciales, manicure, pedicure, tintes.",
    situaciones: [
      ["1", "Citas/agendamiento de servicios", "Esencial"],
      ["2", "Lista de servicios con precios", "Esencial"],
      ["3", "Asignar barbero/estilista a la cita", "Esencial"],
      ["4", "Historial de visitas por cliente", "Esencial"],
      ["5", "Venta de productos (shampoo, pomada, crema)", "Necesario"],
      ["6", "Pago por servicio + propina", "Esencial"],
      ["7", "Clientes frecuentes con descuentos", "Necesario"],
      ["8", "Recordatorio de cita (notificación)", "Deseable"],
      ["9", "Cupón de fidelidad (10 cortes = 1 gratis)", "Necesario"],
      ["10", "Control de caja por barbero/estilista", "Necesario"],
      ["11", "Walk-in (sin cita) + cita agendada", "Esencial"],
      ["12", "Duración estimada del servicio", "Necesario"],
      ["13", "Bloqueo de horarios (almuerzo, días libres)", "Esencial"],
      ["14", "Pago con tarjeta, efectivo o transferencia", "Esencial"],
      ["15", "Notas del cliente (alergias, preferencias)", "Deseable"],
      ["16", "Imágenes antes/después del servicio", "Deseable"],
      ["17", "Reporte de servicios más vendidos", "Necesario"],
      ["18", "Comisiones por servicio al barbero", "Necesario"],
      ["19", "Venta de paquetes (corte + barba + facial)", "Deseable"],
      ["20", "Lista de espera cuando todos están ocupados", "Deseable"],
    ],
  },
  "AUTOLAVADO": {
    giro: "Lavado exterior, interior, descontaminación, pulido, cerámico, sanitización.",
    situaciones: [
      ["1", "Lista de servicios con precios", "Esencial"],
      ["2", "Tipo de vehículo (sedán, SUV, camioneta) con precio distinto", "Esencial"],
      ["3", "Asignación de bahía/cajón al vehículo", "Necesario"],
      ["4", "Asignación de empleado al servicio", "Esencial"],
      ["5", "Tiempo estimado de servicio", "Necesario"],
      ["6", "Ticket con entrada y salida del vehículo", "Necesario"],
      ["7", "Pago al finalizar el servicio", "Esencial"],
      ["8", "Clientes frecuentes con paquetes prepagados", "Necesario"],
      ["9", "Paquetes (10 lavados básicos = precio especial)", "Necesario"],
      ["10", "Control de caja diario", "Esencial"],
      ["11", "Turnos/colas de espera", "Necesario"],
      ["12", "Notificación \"su auto está listo\"", "Necesario"],
      ["13", "Venta de productos complementarios", "Necesario"],
      ["14", "Fotos del antes/después", "Deseable"],
      ["15", "Delivery de service (recoger y entregar auto)", "Deseable"],
      ["16", "Horarios de operación", "Esencial"],
      ["17", "Reporte de servicios por día/empleado", "Necesario"],
      ["18", "Comisiones por servicio al empleado", "Necesario"],
      ["19", "Pago con tarjeta, efectivo", "Esencial"],
      ["20", "Control de insumos (jabón, cera, shampo)", "Necesario"],
    ],
  },
  "VETERINARIA": {
    giro: "Consulta veterinaria, venta de medicamentos, alimentos, accesorios, estética animal.",
    situaciones: [
      ["1", "Ficha/clínica por mascota (nombre, especie, raza, peso, edad)", "Esencial"],
      ["2", "Historial de consultas por mascota", "Esencial"],
      ["3", "Citas para consulta veterinaria", "Esencial"],
      ["4", "Venta de medicamentos con receta", "Esencial"],
      ["5", "Venta de alimentos (por marca, peso, tipo de mascota)", "Esencial"],
      ["6", "Venta de accesorios (collares, juguetes, camas)", "Necesario"],
      ["7", "Servicios de estética (baño, corte, uñas)", "Necesario"],
      ["8", "Vacunación con calendario de refuerzos", "Necesario"],
      ["9", "Desparasitación programada", "Necesario"],
      ["10", "Cirugías con costo estimado", "Necesario"],
      ["11", "Inventario de medicamentos (control caducidad)", "Esencial"],
      ["12", "Venta de productos con código de barras", "Esencial"],
      ["13", "Recordatorio de próxima vacuna/desparasitación", "Deseable"],
      ["14", "Expediente digital de la mascota", "Necesario"],
      ["15", "Pago por servicio + productos", "Esencial"],
      ["16", "Clientes recurrentes con puntos", "Deseable"],
      ["17", "Notas del veterinario por paciente", "Necesario"],
      ["18", "Reporte de servicios más solicitados", "Necesario"],
      ["19", "Control de caja", "Esencial"],
      ["20", "Delivery de medicamentos/alimentos", "Deseable"],
    ],
  },
  "RENTA DE BRINCOLINES": {
    giro: "Renta de inflables, brincolines, mesas, sillas, sonido para fiestas.",
    situaciones: [
      ["1", "Catálogo de artículos disponibles para renta", "Esencial"],
      ["2", "Disponibilidad por fecha y hora", "Esencial"],
      ["3", "Reservación con anticipo", "Esencial"],
      ["4", "Precio por día/hora de renta", "Esencial"],
      ["5", "Delivery e instalación del equipo", "Esencial"],
      ["6", "Recolección del equipo después del evento", "Esencial"],
      ["7", "Daños/roturas con cobro extra", "Necesario"],
      ["8", "Calendarización de reservaciones", "Esencial"],
      ["9", "Estado del equipo (disponible, rentado, en mantenimiento)", "Esencial"],
      ["10", "Clientes con historial de rentas", "Necesario"],
      ["11", "Contrato/aceptación de términos", "Necesario"],
      ["12", "Señas/anticipos con saldo pendiente", "Esencial"],
      ["13", "Cobro total al entregar el equipo", "Esencial"],
      ["14", "Dirección del evento para delivery", "Necesario"],
      ["15", "Multi-ubicación (varios eventos el mismo día)", "Necesario"],
      ["16", "Inventario de piezas (brincolin + cortina + inflador)", "Necesario"],
      ["17", "Mantenimiento programado de equipos", "Deseable"],
      ["18", "Fotografías del equipo antes y después", "Necesario"],
      ["19", "Reporte de rentas por período", "Necesario"],
      ["20", "Pago con tarjeta, efectivo, transferencia", "Esencial"],
    ],
  },
  "SERVICIOS DE FOTOGRAFÍA": {
    giro: "Fotografía de eventos, bodas, quinceañeros, instantáneas, sesiones.",
    situaciones: [
      ["1", "Paquetes de fotografía (básico, premium, completo)", "Esencial"],
      ["2", "Agendamiento de sesiones/eventos", "Esencial"],
      ["3", "Cobertura por horas", "Necesario"],
      ["4", "Fotógrafos disponibles por fecha", "Esencial"],
      ["5", "Venta de productos digitales (álbumes, fotos impresas)", "Necesario"],
      ["6", "Edición de fotos con tiempos de entrega", "Necesario"],
      ["7", "Álbumes personalizados", "Deseable"],
      ["8", "Cobro de apartado/anticipo", "Esencial"],
      ["9", "Saldo pendiente de pago", "Esencial"],
      ["10", "Entrega de productos digitales (link de descarga)", "Necesario"],
      ["11", "Fotografías impresas con tamaño y cantidad", "Necesario"],
      ["12", "Clientes con historial de sesiones", "Necesario"],
      ["13", "Contrato con condiciones", "Necesario"],
      ["14", "Ubicación del evento (dirección, GPS)", "Necesario"],
      ["15", "Notas del cliente (momentos especiales)", "Necesario"],
      ["16", "Pago con tarjeta, efectivo, transferencia", "Esencial"],
      ["17", "Reporte de servicios más contratados", "Necesario"],
      ["18", "Calendario de eventos", "Necesario"],
      ["19", "Venta de accesorios (marcos, albumes)", "Deseable"],
      ["20", "Promociones por temporada", "Deseable"],
    ],
  },
  "RESTAURANTE": {
    giro: "Comida preparada, servicio en mesa, para llevar, delivery.",
    situaciones: [
      ["1", "Menú digital con categorías", "Esencial"],
      ["2", "Producto con opciones (pasta: tipo + salsa + proteína)", "Esencial"],
      ["3", "Órdenes por mesa", "Esencial"],
      ["4", "Órdenes para llevar (takeout)", "Esencial"],
      ["5", "Delivery a domicilio", "Esencial"],
      ["6", "Cocina con impresión de ticket/orden", "Esencial"],
      ["7", "Modificaciones/NOTAS por ítem", "Esencial"],
      ["8", "Tiempo de preparación por platillo", "Necesario"],
      ["9", "Split de cuenta (varias personas pagan separado)", "Necesario"],
      ["10", "Propinas (incluida, voluntaria, no aplica)", "Esencial"],
      ["11", "Descuentos por happy hour", "Necesario"],
      ["12", "Combos/combinaciones", "Necesario"],
      ["13", "Control de inventario de insumos", "Esencial"],
      ["14", "Recetas/porciones (cuánto insumo por platillo)", "Necesario"],
      ["15", "Carta de vinos/bebidas con precios", "Necesario"],
      ["16", "Reservaciones de mesa", "Necesario"],
      ["17", "Estación de cocinero (dashboard de órdenes)", "Necesario"],
      ["18", "Tracking de pedido en tiempo real (cliente)", "Necesario"],
      ["19", "Cierre de caja por turno", "Esencial"],
      ["20", "Reporte de platillos más vendidos", "Necesario"],
    ],
  },
};

const comparativa = [
  ["Venta rápida con código de barras", "✅", "✅", "🟡", "✅", "❌", "❌", "✅", "❌", "❌", "❌"],
  ["Producto a granel (peso/volumen)", "✅", "✅", "🟡", "❌", "❌", "❌", "❌", "❌", "❌", "❌"],
  ["Variantes (sabor/tamaño/color)", "✅", "✅", "✅", "✅", "🟡", "🟡", "🟡", "🟡", "🟡", "✅"],
  ["Opciones configurables", "🟡", "🟡", "✅", "🟡", "✅", "✅", "🟡", "🟡", "✅", "✅"],
  ["Combo/combos", "🟡", "❌", "✅", "✅", "✅", "✅", "❌", "❌", "✅", "✅"],
  ["Notas por ítem", "❌", "❌", "✅", "❌", "❌", "❌", "✅", "❌", "✅", "✅"],
  ["Múltiples formas de pago", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅"],
  ["Pago con tarjeta", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅"],
  ["Pago en línea (Stripe/MP)", "✅", "❌", "✅", "✅", "❌", "❌", "❌", "✅", "✅", "✅"],
  ["Propinas", "❌", "❌", "❌", "❌", "✅", "❌", "❌", "❌", "❌", "✅"],
  ["Split de cuenta", "❌", "❌", "❌", "❌", "❌", "❌", "❌", "❌", "❌", "✅"],
  ["Ticket térmico 80mm", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅"],
  ["Stock por ubicación", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "❌", "✅"],
  ["Mínimos/Máximos", "✅", "✅", "✅", "✅", "🟡", "🟡", "✅", "🟡", "❌", "✅"],
  ["Movimientos (entrada/salida)", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "❌", "✅"],
  ["Revisión física (conteo)", "✅", "✅", "✅", "✅", "❌", "❌", "✅", "🟡", "❌", "✅"],
  ["Alertas de stock bajo", "✅", "✅", "✅", "✅", "🟡", "🟡", "✅", "🟡", "❌", "✅"],
  ["Importar/exportar Excel", "✅", "✅", "✅", "✅", "❌", "❌", "✅", "❌", "❌", "✅"],
  ["Pedido en línea (portal)", "✅", "❌", "✅", "✅", "❌", "❌", "❌", "✅", "✅", "✅"],
  ["Pickup en tienda", "✅", "❌", "✅", "✅", "❌", "❌", "❌", "❌", "❌", "✅"],
  ["Delivery a domicilio", "✅", "❌", "✅", "✅", "❌", "❌", "❌", "✅", "✅", "✅"],
  ["Tracking en tiempo real", "✅", "❌", "✅", "✅", "❌", "❌", "❌", "❌", "❌", "✅"],
  ["Confirmación con PIN/QR", "✅", "❌", "✅", "✅", "❌", "❌", "❌", "❌", "❌", "✅"],
  ["Citas/agendamiento", "❌", "❌", "❌", "❌", "✅", "🟡", "✅", "❌", "✅", "❌"],
  ["Asignación de recurso/personal", "❌", "❌", "❌", "❌", "✅", "✅", "✅", "✅", "✅", "❌"],
  ["Duración estimada", "❌", "❌", "❌", "❌", "✅", "✅", "✅", "✅", "✅", "❌"],
  ["Puntos de lealtad", "✅", "🟡", "✅", "🟡", "✅", "✅", "🟡", "❌", "❌", "🟡"],
  ["Reporte de ventas", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅"],
  ["Reporte de caja", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅"],
  ["Reporte de clientes", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅"],
  ["Roles y permisos", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅", "✅"],
  ["Multi-sucursal", "✅", "✅", "🟡", "🟡", "🟡", "🟡", "🟡", "🟡", "🟡", "🟡"],
];

const headers = ["Funcionalidad", "Abarrotes", "Ferretería", "Nieves", "Snacks", "Barbería", "Autolavado", "Veterinaria", "Brincolines", "Fotografía", "Restaurante"];

const gapAnalysis: [string, string, string][] = [
  ["Sistema de agendamiento/citas con calendario visual", "Barbería, Veterinaria, Fotografía, Autolavado", "Alta"],
  ["Servicios como productos (precio fijo por servicio)", "Todos los de servicio", "Alta"],
  ["Asignación de personal a una cita/servicio", "Barbería, Veterinaria, Fotografía, Autolavado", "Alta"],
  ["Historial de servicios por cliente", "Barbería, Veterinaria, Autolavado", "Alta"],
  ["Duración estimada de servicio", "Barbería, Autolavado, Veterinaria", "Media"],
  ["Recordatorios automáticos (email, SMS, WhatsApp)", "Barbería, Veterinaria, Fotografía", "Media"],
  ["Módulo de alquiler/renta con disponibilidad calendario", "Brincolines", "Alta"],
  ["Reservación con anticipo y saldo pendiente", "Brincolines, Fotografía", "Alta"],
  ["Estado del equipo (disponible/rentado/mantenimiento)", "Brincolines", "Media"],
  ["Contratos digitales con aceptación", "Brincolines, Fotografía", "Media"],
  ["Fotografías antes/después (evidencia)", "Brincolines, Autolavado", "Media"],
  ["Cobro por daños adicional", "Brincolines", "Baja"],
  ["Productos digitales (álbumes, links de descarga)", "Fotografía", "Media"],
  ["Edición con tiempos de entrega", "Fotografía", "Media"],
  ["Propinas en POS y portal", "Barbería, Restaurante", "Media"],
  ["Split de cuenta (dividir factura)", "Restaurante", "Media"],
  ["Notas por ítem en POS (modificaciones)", "Nieves, Restaurante, Veterinaria", "Media"],
  ["Control de caducidad de productos", "Veterinaria, Abarrotes", "Baja"],
  ["Comisiones por servicio/empleado", "Barbería, Autolavado, Fotografía", "Baja"],
  ["Venta a crédito/fiado", "Ferretería", "Baja"],
  ["Cotizaciones", "Ferretería, Fotografía", "Baja"],
  ["Recetas/porciones de producción", "Nieves, Restaurante", "Baja"],
  ["Estación de cocinero (dashboard de órdenes)", "Restaurante", "Media"],
  ["Reservaciones de mesa", "Restaurante", "Media"],
];

const modelos: string[][] = [
  ["Básico", "$499/mes", "1", "2", "Básico", "No", "No", "Email"],
  ["Negocio", "$999/mes", "3", "5", "Completo", "Básico", "Sí", "Email + Chat"],
  ["Profesional", "$1,999/mes", "10", "15", "Completo", "Completo", "Sí", "Prioritario"],
  ["Enterprise", "$3,499/mes", "Ilimitado", "Ilimitado", "Completo", "Completo", "Sí", "Dedicado + SLA"],
];

const ventas: string[][] = [
  ["Licencia perpetua (1 sucursal, 2 cajeros)", "$12,999"],
  ["Sucursal adicional", "$4,999"],
  ["Cajero adicional", "$999"],
  ["Mantenimiento anual", "$2,999/año"],
  ["Instalación y configuración inicial", "$2,499"],
  ["Capacitación presencial (8 horas)", "$3,999"],
  ["Personalización menor", "$1,999"],
  ["Personalización mayor", "Cotizar"],
];

const rentaTemp: string[][] = [
  ["Diario", "$99/día"],
  ["Semanal", "$499/semana"],
  ["Mensual", "$999/mes"],
  ["Temporada (3 meses)", "$2,499"],
  ["Anual", "$8,999/año"],
];

const proyeccion: string[][] = [
  ["Año 1", "50", "$999/mes", "$599,400"],
  ["Año 2", "150", "$1,200/mes", "$2,160,000"],
  ["Año 3", "300", "$1,400/mes", "$5,040,000"],
];

// ─── BUILD DOCUMENT ───

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 22 },
      },
    },
  },
  sections: [
    {
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: [
        // ── PORTADA ──
        spacer(), spacer(), spacer(), spacer(), spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "ANÁLISIS MULTI-POS", bold: true, size: 56, color: BLUE })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "VIABILIDAD POR TIPO DE NEGOCIO", bold: true, size: 36, color: BLUE })],
        }),
        spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "Documento Ejecutivo", size: 28, italics: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "Coahuila, México · Agosto 2026", size: 24, color: "666666" })],
        }),
        spacer(), spacer(), spacer(), spacer(), spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Multi-POS v0.11.1", size: 22, color: "999999" })],
        }),
        new Paragraph({ children: [new PageBreak()] }),

        // ── CONTENIDO ──
        h2("CONTENIDO"),
        p("1. Resumen Ejecutivo"),
        p("2. Análisis por Negocio (10 giros)"),
        p("3. Tabla Comparativa — Sistema vs Necesidades"),
        p("4. Listado Detallado de Funcionalidades"),
        p("5. Gap Analysis — Lo que Falta"),
        p("6. Modelo de Negocio / Venta-Renta"),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 1. RESUMEN ──
        title("1. RESUMEN EJECUTIVO"),
        p("El sistema Multi-POS fue diseñado como una plataforma multi-tenant, multi-sucursal para gestión de puntos de venta, inventario, pedidos en línea, lealtad y reportes."),
        spacer(),
        bold("Capacidad actual del sistema:"),
        p("• 48+ modelos de base de datos"),
        p("• 10 módulos CRUD genéricos"),
        p("• 32 permisos granulares"),
        p("• 150+ funcionalidades documentadas"),
        p("• Arquitectura Next.js 15 + Prisma + MySQL"),
        p("• Despliegue vía Docker/Dokploy"),
        spacer(),
        p("El presente documento evalúa la capacidad del sistema para cubrir 10 tipos de negocio distintos operados por un mismo empresario en Coahuila, México."),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 2. ANÁLISIS POR NEGOCIO ──
        title("2. ANÁLISIS POR NEGOCIO"),
        ...Object.entries(negocios).flatMap(([nombre, { giro, situaciones }]) => [
          h2(`2.${Object.keys(negocios).indexOf(nombre) + 1} ${nombre}`),
          bold(`Giro: ${giro}`),
          p("Situaciones del negocio (de menor a mayor complejidad):"),
          table(["#", "Situación", "Prioridad"], situaciones),
          spacer(),
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 3. TABLA COMPARATIVA ──
        title("3. TABLA COMPARATIVA — SISTEMA vs NECESIDADES"),
        bold("Leyenda:"),
        p("✅ Completo — Funcionalidad implementada y funcional"),
        p("🟡 Parcial — Existe base pero falta personalización"),
        p("❌ No existe — Requiere desarrollo nuevo"),
        spacer(),
        table(headers, comparativa),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 4. LISTADO DETALLADO ──
        title("4. LISTADO DETALLADO DE FUNCIONALIDADES"),
        h2("4.1 PUNTO DE VENTA (POS)"),
        table(["#", "Funcionalidad", "Estado"], [
          ["1", "Catálogo de productos con imagen, precio, código de barras", "✅"],
          ["2", "Búsqueda por nombre, SKU o código de barras", "✅"],
          ["3", "Filtrado por categoría con conteo de productos", "✅"],
          ["4", "Selección de variante (sabor, tamaño, color)", "✅"],
          ["5", "Productos a granel (peso/volumen con paso/mínimo/máximo)", "✅"],
          ["6", "División de producto a granel", "✅"],
          ["7", "Panel de ticket con edición de cantidad y descuento por línea", "✅"],
          ["8", "Modal de cantidad con numpad largo (long-press)", "✅"],
          ["9", "Selección de cliente para venta", "✅"],
          ["10", "Descuento manual (% o monto, tope 10% sin supervisor)", "✅"],
          ["11", "Validación y aplicación de cupones", "✅"],
          ["12", "Canje de puntos de lealtad como pago", "✅"],
          ["13", "Checkout multi-pago (efectivo + tarjeta + puntos + otro)", "✅"],
          ["14", "Numpad de denominaciones MXN", "✅"],
          ["15", "Cálculo automático de cambio", "✅"],
          ["16", "Creación de venta con deducción de inventario", "✅"],
          ["17", "Ticket térmico PDF 80mm con logo, datos fiscales, desglose", "✅"],
          ["18", "Teclado virtual para dispositivos touch", "✅"],
          ["19", "Aprobación de supervisor con PIN", "✅"],
          ["20", "Selector de sucursal y sesión de caja", "✅"],
          ["21", "Panel de pedidos recientes del turno", "✅"],
          ["22", "Estadísticas del día (ventas, conteo, efectivo)", "✅"],
          ["23", "Modal de agregar múltiples productos de golpe", "✅"],
          ["24", "Gestión de sesión de caja (abrir/cerrar)", "✅"],
          ["25", "Reconciliación de caja (efectivo esperado vs real)", "✅"],
        ]),
        spacer(),

        h2("4.2 INVENTARIO"),
        table(["#", "Funcionalidad", "Estado"], [
          ["1", "Vista de existencias con DataTable (paginación, sorting)", "✅"],
          ["2", "Vista de movimientos con DataTable", "✅"],
          ["3", "Vista de revisiones (conteo físico)", "✅"],
          ["4", "Columna de estado (ok/bajo/vacío) con colores", "✅"],
          ["5", "Filtro por tipo de producto (estándar/granel)", "✅"],
          ["6", "Búsqueda por producto, SKU o código de barras", "✅"],
          ["7", "Registro de movimientos: compra, venta, ajuste, transferencia, devolución", "✅"],
          ["8", "Transferencias entre ubicaciones", "✅"],
          ["9", "Revisiones de inventario con flujo: borrador → en progreso → completado", "✅"],
          ["10", "Ajuste automático al completar revisión", "✅"],
          ["11", "Importación masiva desde Excel", "✅"],
          ["12", "Exportación de existencias, movimientos, revisiones a Excel", "✅"],
          ["13", "Alertas de stock bajo con notificación persistente + SSE", "✅"],
          ["14", "Creación automática de filas de inventario para nuevos productos", "✅"],
          ["15", "Formato de stock: enteros para pieza, decimales para granel", "✅"],
        ]),
        spacer(),

        h2("4.3 PEDIDOS EN LÍNEA / PORTAL"),
        table(["#", "Funcionalidad", "Estado"], [
          ["1", "Tienda en línea con catálogo de productos", "✅"],
          ["2", "Selector de variante en portal", "✅"],
          ["3", "Carrito de compras (bottom sheet)", "✅"],
          ["4", "Checkout con método de entrega (pickup/delivery)", "✅"],
          ["5", "Selección de dirección de entrega guardada", "✅"],
          ["6", "Mapa con ubicación del cliente y destinos", "✅"],
          ["7", "Pago en línea (Stripe, MercadoPago)", "✅"],
          ["8", "Pago al recoger/en entrega", "✅"],
          ["9", "Canje de puntos en portal", "✅"],
          ["10", "Historial de pedidos", "✅"],
          ["11", "Detalle de pedido con items, estado, pagos", "✅"],
          ["12", "Tracking en tiempo real (SSE)", "✅"],
          ["13", "Cancelación de pedidos pendientes", "✅"],
          ["14", "Confirmación de entrega con PIN o QR", "✅"],
          ["15", "Favoritos de productos", "✅"],
          ["16", "Listas de compras", "✅"],
          ["17", "Métodos de pago guardados (tarjetas)", "✅"],
          ["18", "Perfil de cliente con dirección y GPS", "✅"],
          ["19", "Notificaciones de pedidos", "✅"],
          ["20", "Publicaciones/noticias de la empresa", "✅"],
          ["21", "Dashboard del cliente (puntos, pedidos activos, promociones)", "✅"],
          ["22", "Horarios de sucursales", "✅"],
          ["23", "Políticas de delivery por sucursal", "✅"],
          ["24", "Formato de direcciones con geolocalización", "✅"],
        ]),
        spacer(),

        h2("4.4 SERVICIOS / AGENDAMIENTO"),
        table(["#", "Funcionalidad", "Estado"], [
          ["1", "Agendamiento de citas", "🟡 (base: schedule)"],
          ["2", "Asignación de personal/recurso", "🟡 (empleados existe)"],
          ["3", "Calendario visual de ocupación", "❌"],
          ["4", "Duración estimada del servicio", "❌"],
          ["5", "Recordatorios automáticos", "❌"],
          ["6", "Walk-in + cita agendada", "❌"],
          ["7", "Lista de espera", "❌"],
          ["8", "Estado de la estación/bahía", "❌"],
          ["9", "Historial de servicios por cliente", "🟡 (historial de ventas)"],
          ["10", "Comisiones por servicio al empleado", "❌"],
          ["11", "Servicios con receta/fórmula", "❌"],
          ["12", "Contratos/aceptación de términos", "❌"],
        ]),
        spacer(),

        h2("4.5 ALQUILER / RENTA"),
        table(["#", "Funcionalidad", "Estado"], [
          ["1", "Catálogo de artículos disponibles", "🟡 (productos)"],
          ["2", "Disponibilidad por fecha", "❌"],
          ["3", "Reservación con anticipo", "❌"],
          ["4", "Precio por día/hora", "❌"],
          ["5", "Delivery e instalación", "🟡 (delivery existe)"],
          ["6", "Recolección del equipo", "❌"],
          ["7", "Cobro por daños", "❌"],
          ["8", "Calendarización de reservaciones", "❌"],
          ["9", "Estado del equipo", "❌"],
          ["10", "Contrato con aceptación", "❌"],
          ["11", "Señas/anticipos con saldo pendiente", "❌"],
          ["12", "Fotografías antes/después", "❌"],
        ]),
        spacer(),

        h2("4.6 FOTOGRAFÍA"),
        table(["#", "Funcionalidad", "Estado"], [
          ["1", "Paquetes de servicio con precio fijo", "🟡 (productos)"],
          ["2", "Agendamiento de sesiones", "❌"],
          ["3", "Cobertura por horas", "❌"],
          ["4", "Asignación de fotógrafo", "🟡 (empleados)"],
          ["5", "Productos digitales (álbumes, fotos)", "❌"],
          ["6", "Edición con tiempos de entrega", "❌"],
          ["7", "Álbumes personalizados", "❌"],
          ["8", "Entrega de link de descarga", "❌"],
          ["9", "Cobro de apartado/anticipo", "❌"],
          ["10", "Saldo pendiente", "❌"],
          ["11", "Contrato con condiciones", "❌"],
          ["12", "Calendario de eventos", "❌"],
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 5. GAP ANALYSIS ──
        title("5. GAP ANALYSIS — LO QUE FALTA"),
        h2("5.1 Funcionalidades Críticas"),
        p("Afectan todos los negocios de servicios:"),
        table(["Funcionalidad", "Negocios afectados", "Prioridad"], gapAnalysis),
        spacer(),
        bold("COBERTURA ACTUAL DEL SISTEMA: ~70-80%"),
        spacer(),
        p("Las principales brechas están en:"),
        p("1. Servicios/agendamiento — Necesario para barbería, veterinaria, fotografía, autolavado"),
        p("2. Alquiler/renta — Necesario para brincolines"),
        p("3. Funciones de restaurante — Estación de cocina, notas por ítem, split de cuenta"),
        spacer(),
        bold("RECOMENDACIÓN:"),
        p("Priorizar el desarrollo de un módulo de agendamiento/servicios que cubra barbería, veterinaria y autolavado — esto desbloquea 4 de los 10 negocios con una sola funcionalidad nueva."),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 6. MODELO DE NEGOCIO ──
        title("6. MODELO DE NEGOCIO — VENTA / RENTA DEL SISTEMA"),
        h2("6.1 Contexto: Coahuila, México"),
        p("• Mercado objetivo: PyMEs de 1-50 empleados"),
        p("• Moneda: Peso mexicano (MXN)"),
        p("• Competencia: Clover ($800-$2,000/mes), Square ($0-$60/mes + comisión), Thiendita ($500-$1,500/mes), Sistemas locales ($3,000-$15,000 único)"),
        p("• Ventaja competitiva: Sistema todo-en-uno con portal de clientes, inventario avanzado, multi-sucursal, lealtad, delivery, reportes PDF"),
        spacer(),

        h2("6.2 Modelo 1: RENTA MENSUAL (SaaS)"),
        p("Ideal para: Negocios que quieren empezar sin inversión alta."),
        table(["Plan", "Precio MXN/mes", "Sucursales", "Cajeros", "Inventario", "Portal", "Delivery", "Soporte"], modelos),
        spacer(),
        bold("Incluye en todos los planes:"),
        p("• Actualizaciones automáticas • Respaldo diario en la nube • Soporte técnico • Capacitación inicial (2 horas)"),
        spacer(),
        bold("Costos adicionales:"),
        p("• Sucursal adicional: $199/mes • Cajero adicional: $49/mes • Pasarela de pago: $0 + comisión • Dominio personalizado: $299/año • SSL wildcard: Incluido"),
        spacer(),

        h2("6.3 Modelo 2: VENTA + RENTA (Híbrido)"),
        p("Ideal para: Negocios que prefieren poseer el sistema pero pagar mantenimiento."),
        table(["Concepto", "Precio MXN"], ventas),
        spacer(),
        bold("Descuentos:"),
        p("• Pago anticipado 3 meses: 10% • 6 meses: 15% • 12 meses: 20% • 3+ sucursales: 10% adicional"),
        spacer(),

        h2("6.4 Modelo 3: RENTA TEMPORAL"),
        p("Ideal para: Negocios estacionales (nieves en verano, brincolines en temporada de fiestas)."),
        table(["Período", "Precio MXN"], rentaTemp),
        spacer(),
        p("Incluye: Todo del plan Negocio + soporte prioritario del período."),
        spacer(),

        h2("6.5 Modelo 4: FRANQUICIA / MULTI-TENANT"),
        p("Ideal para: Empresarios con múltiples negocios bajo una marca."),
        p("• Licencia multi-negocio (hasta 5 giros): $19,999"),
        p("• Giros adicionales: $2,999 cada uno"),
        p("• Mantenimiento anual (todos los giros): $5,999/año"),
        p("• Panel de administración central: Incluido"),
        p("• Reportes consolidados: Incluido"),
        spacer(),

        h2("6.6 Proyección de Ingresos (escenario conservador)"),
        table(["Año", "Clientes", "Ticket promedio", "Ingreso anual"], proyeccion),
        spacer(),
        p("Basado en crecimiento orgánico en zona de Coahuila (Saltillo, Torreón, Monterrey cercano)."),
        spacer(),

        h2("6.7 Punto de Equilibrio"),
        p("Costo de operación mensual estimado: ~$29,000 MXN"),
        p("Punto de equilibrio: ~30 clientes plan Negocio ($999 × 30 = $29,970)"),
        spacer(),

        h2("6.8 Modelo Recomendado para Nuestros 10 Negocios"),
        table(["Negocio", "Modelo", "Plan", "Inversión mensual"], [
          ["Tienda de abarrotes", "Renta mensual", "Negocio", "$999"],
          ["Ferretería", "Renta mensual", "Negocio", "$999"],
          ["Nieves", "Renta temporal", "3 meses", "$833/mes"],
          ["Snacks y bebidas", "Renta mensual", "Básico", "$499"],
          ["Barbería/estética", "Renta mensual", "Negocio", "$999"],
          ["Autolavado", "Renta mensual", "Básico", "$499"],
          ["Veterinaria", "Renta mensual", "Negocio", "$999"],
          ["Renta de brincolines", "Renta temporal", "3 meses", "$833/mes"],
          ["Servicios de fotografía", "Renta mensual", "Básico", "$499"],
          ["Restaurante", "Renta mensual", "Profesional", "$1,999"],
          ["TOTAL", "", "", "$9,990/mes"],
        ]),
        spacer(),
        p("Alternativa de compra (híbrida): Licencia perpetua para los 10 negocios: ~$39,999 + Mantenimiento anual: ~$9,999. ROI en ~4 meses vs modelo de renta."),
        new Paragraph({ children: [new PageBreak()] }),

        // ── CONCLUSIÓN ──
        title("CONCLUSIÓN"),
        p("El sistema Multi-POS cubre aproximadamente el 70-80% de las necesidades de los 10 negocios analizados. Las principales brechas están en servicios/agendamiento, alquiler/renta y funcionalidades de restaurante."),
        spacer(),
        p("El sistema es competitivo en precio y funcionalidad vs soluciones del mercado en Coahuila. El modelo de renta mensual es el más atractivo para PyMEs, mientras que el híbrido (venta + mantenimiento) genera mayor ingreso recurrente."),
        spacer(),
        bold("Recomendación final:"),
        p("Priorizar el desarrollo de un módulo de agendamiento/servicios que cubra barbería, veterinaria y autolavado — esto desbloquea 4 de los 10 negocios con una sola funcionalidad nueva."),
        spacer(), spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Documento generado para análisis interno · Multi-POS · Coahuila, México · Agosto 2026", size: 18, color: "999999", italics: true })],
        }),
      ],
    },
  ],
});

async function main() {
  const buffer = await Packer.toBuffer(doc);
  const outPath = "C:\\Users\\Usuario\\Desktop\\Otros\\NESTOR\\NESSIK\\SISTEMA-MULTI-POS\\sistema-multi-pos-react-node-chadcnui\\docs\\ANALISIS_NEGOCIOS_MULTI_POS.docx";
  writeFileSync(outPath, buffer);
  console.log("✅ Word generado:", outPath);
}

main();
