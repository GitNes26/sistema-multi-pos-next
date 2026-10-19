// Glosario con las palabras del sistema explicadas "en corto y sin tecnicismos".
// Las palabras en pantalla se quedan igual; aquí está lo que significan, en un
// tono relajado, para quien apenas está aprendiendo.

export interface GlossaryEntry {
  /** Palabra tal como aparece en el sistema. */
  term: string
  /** Una frase: qué es. */
  short: string
  /** Explicación relajada, con un ejemplo cotidiano. */
  body: string
  example?: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  "fondo-inicial": {
    term: "Fondo inicial",
    short: "El dinero con el que arrancas el día en la caja.",
    body: "Es el cambio que dejas en la caja antes de vender: billetes chicos y monedas para poder regresarle cambio a la gente. No es una venta ni una ganancia, solo el dinero de arranque.",
    example: "Dejas $300 en billetes de $20 y $50 y monedas. Ese es tu fondo inicial.",
  },
  caja: {
    term: "Caja registradora",
    short: "El cajón (físico o en pantalla) donde entra y sale el dinero de las ventas.",
    body: "Abrir la caja es decirle al sistema \"voy a empezar a cobrar\". Todo lo que cobres en efectivo queda ligado a esa caja, y al terminar la cierras para saber si el dinero cuadra.",
    example: "Si tienes dos mostradores, puedes tener la Caja 1 y la Caja 2 abiertas a la vez.",
  },
  corte: {
    term: "Corte de caja",
    short: "La cuenta final del día: lo que debería haber contra lo que de verdad hay.",
    body: "Al cerrar la caja cuentas el efectivo que tienes y el sistema lo compara con lo que esperaba (fondo + ventas en efectivo − cambio − retiros). Si hay diferencia, te la muestra para que sepas qué pasó.",
    example: "Esperaba $1,250 y tú contaste $1,230: faltan $20. Mejor saberlo hoy que a fin de mes.",
  },
  "esperado-en-caja": {
    term: "Esperado en caja",
    short: "El efectivo que el sistema calcula que debería estar en la caja.",
    body: "Se arma con tu fondo inicial, más lo cobrado en efectivo, menos el cambio que diste, las devoluciones en efectivo y los retiros. Si cuentas el cajón y no coincide, hay diferencia.",
  },
  retiro: {
    term: "Retiro de efectivo",
    short: "Dinero que sacas de la caja para algo del negocio.",
    body: "Si sacas dinero de la caja para pagarle al proveedor o comprar algo, regístralo con su motivo. Así el corte no te marca \"faltante\" y queda anotado como gasto.",
    example: "Sacas $120 para pagar los refrescos que acaban de dejar.",
  },
  "bajo-minimo": {
    term: "Bajo mínimo",
    short: "Productos que ya se están acabando.",
    body: "Cada producto puede tener un \"mínimo\": la cantidad en la que dices \"ya toca surtir\". Cuando las existencias bajan de ese número, el producto sale como bajo mínimo y el sistema te puede armar el pedido al proveedor.",
    example: "Si pones mínimo 10 refrescos y quedan 8, aparece como bajo mínimo.",
  },
  "stock-minimo": {
    term: "Stock mínimo",
    short: "La cantidad a partir de la cual toca surtir.",
    body: "Es tu aviso personal de reabastecimiento. Piensa en cuántos te duran hasta que llega el proveedor y pon un poquito más de eso.",
    example: "Tu proveedor tarda 2 días y vendes 5 al día: un mínimo de 12 te cubre.",
  },
  "tipo-negocio": {
    term: "Tipo de negocio",
    short: "Con qué giro trabajas, para mostrarte solo las herramientas que te sirven.",
    body: "Tienda, restaurante, servicios, renta o híbrido (una mezcla). Según lo que elijas se activan cosas como mesas y cocina, agenda de citas o reservaciones. \"Híbrido\" es para quien vende de todo un poco y quiere todas las herramientas encendidas.",
  },
  bi: {
    term: "BI (Inteligencia de negocio)",
    short: "Reportes avanzados para entender cómo va tu negocio.",
    body: "Son gráficas y comparativos más profundos que el reporte normal: qué horas vendes más, qué clientes vuelven, qué productos te dejan más. Si apenas empiezas, con Panel y Ganancias te alcanza; BI es para cuando quieras afinar.",
  },
  medidas: {
    term: "Medidas (unidades de medida)",
    short: "Cómo cuentas lo que vendes: piezas, kilos, litros, metros…",
    body: "Sirven sobre todo para el granel: si vendes frijol por kilo, la medida es \"kg\". El sistema ya trae las comunes; aquí agregas otras si las necesitas.",
  },
  puestos: {
    term: "Puestos",
    short: "El cargo de cada empleado: cajero, cocinero, repartidor…",
    body: "Es solo una etiqueta para organizar a tu equipo y para la nómina. Lo que cada quien puede hacer en el sistema depende de su rol y permisos, no del puesto.",
  },
  cedis: {
    term: "CEDIS",
    short: "Tu bodega o centro de distribución.",
    body: "Si tienes un almacén central desde donde surtes a tus sucursales, ahí lo registras. Desde ahí puedes hacer traslados de mercancía a cada tienda. Con una sola tienda no lo necesitas.",
  },
  kds: {
    term: "Cocina (KDS)",
    short: "La pantalla de cocina donde llegan los pedidos.",
    body: "En lugar de papelitos, la cocina ve en una pantalla qué hay que preparar, lo va marcando como listo y el mesero o el cliente se entera. Solo aplica si preparas comida o bebidas.",
  },
  granel: {
    term: "A granel",
    short: "Productos que vendes por peso o medida, no por pieza.",
    body: "Frijol, arroz, carne, tela… El cliente pide la cantidad que quiere (medio kilo, 300 g) y el sistema calcula el precio.",
  },
  costo: {
    term: "Costo",
    short: "Lo que te cuesta a ti cada producto.",
    body: "Es lo que pagas por el producto, no lo que cobras. Con el costo el sistema calcula tu ganancia: si lo compras en $11 y lo vendes en $18, te quedan $7.",
  },
  ganancia: {
    term: "Ganancia",
    short: "Lo que realmente te queda después de pagar todo.",
    body: "Ventas − lo que te costó la mercancía − tus gastos (renta, luz, sueldos). Si el resultado es negativo, ese mes perdiste.",
  },
  lealtad: {
    term: "Lealtad (puntos)",
    short: "Puntos que tus clientes acumulan por comprar.",
    body: "Cada compra le da puntos al cliente y luego puede cambiarlos por descuento. Sirve para que regresen. Para darle puntos hay que asociar su cuenta a la venta.",
  },
  credito: {
    term: "Crédito",
    short: "Dejar que un cliente pague después (fiado).",
    body: "Le fijas un límite y un plazo, el sistema lleva su saldo y sus abonos. Solo aplica a clientes que tú decidas.",
  },
  traslado: {
    term: "Traslados",
    short: "Mover mercancía de una sucursal o bodega a otra.",
    body: "Registras qué sale, quién lo lleva y quién lo recibe, y los inventarios de ambos lados se ajustan solos.",
  },
}

export function glossaryEntry(id: string): GlossaryEntry | undefined {
  return GLOSSARY[id]
}
