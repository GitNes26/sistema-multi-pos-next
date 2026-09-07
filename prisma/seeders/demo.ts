import { $Enums } from "@prisma/client"
import { randomBytes } from "node:crypto"
import { prisma } from "../../src/lib/db/client"
import { seedProduction, SYSTEM_UNITS } from "./production"
import { emptySchedule } from "../../src/lib/schedule"
import { placeholderImageUrl } from "../../src/lib/catalog/placeholder"

// FASE 1.3.2 — Seed de demo
// Genera organizaciones de ejemplo con datos deterministas (una por modo
// de negocio que ya tiene flujo operativo en la plataforma):
// - "Supermercado Demo" (retail) — catálogo, inventario y ventas de tienda.
// - "Restaurante Demo" (food_service) — equipo con roles del modo
//   (mesero/cocina vía roleId), combos, mesas y pedidos a cocina (KDS); la
//   mesa 3 queda con una orden en cocina sin cobrar para demostrar el ciclo
//   completo: cobro en POS (sale del KDS) o cancelación de la orden.
// - "Estética Demo" (services) — agente de atención vía roleId, catálogo
//   de servicios y productos, y ventas de caja.
// - "Fiestas Demo" (rental) — agente de renta vía roleId, catálogo de
//   unidades rentables (brincolines, mobiliario, audio) y ventas de caja.

const DEMO_ORG_NAME = "Supermercado Demo"
const REST_ORG_NAME = "Restaurante Demo"
const EST_ORG_NAME = "Estética Demo"
const FIE_ORG_NAME = "Fiestas Demo"
const HYB_ORG_NAME = "Híbrido Demo"
const DEMO_PASSWORD = "demo1234"

// Miembros del restaurante (además del owner compartido demo@multi-pos.com).
const REST_TEAM = [
  { email: "gerente-rest@demo.multi-pos.com", fullName: "Sofía Ramírez" },
  { email: "cajero-rest@demo.multi-pos.com", fullName: "Diego Torres" },
  { email: "mesero@demo.multi-pos.com", fullName: "Valentina Flores" },
  { email: "cocina@demo.multi-pos.com", fullName: "Ricardo Núñez" },
] as const

// Comensales frecuentes del restaurante (portal del cliente).
const REST_CUSTOMERS = [
  { name: "Elena Vargas", phone: "5522113344" },
  { name: "Santiago Rojas", phone: "5533224455" },
  { name: "Camila Herrera", phone: "5544335566" },
  { name: "Mateo Jiménez", phone: "5555446677" },
  { name: "Renata Cruz", phone: "5566557788" },
  { name: "Emilio Peña", phone: "5577668899" },
] as const

// Menú del restaurante (categoría → productos con precio en MXN).
// Los platos del menú llevan descripción e imagen (emoji sobre gradiente de la
// categoría) para que el menú digital y el catálogo se vean completos.
type MenuDef = { category: string; name: string; price: number; emoji: string; desc: string }

const REST_PRODUCTS: MenuDef[] = [
  // Desayunos
  {
    category: "Desayunos",
    name: "Huevos al gusto",
    price: 85,
    emoji: "🍳",
    desc: "Huevos estrellados, revueltos o en omelette con frijoles, queso y tortillas calientes.",
  },
  {
    category: "Desayunos",
    name: "Hot cakes con miel",
    price: 75,
    emoji: "🥞",
    desc: "Tres hot cakes esponjosos con mantequilla y miel de maple.",
  },
  {
    category: "Desayunos",
    name: "Chilaquiles verdes",
    price: 90,
    emoji: "🌮",
    desc: "Totopos crujientes en salsa verde con crema, queso fresco y cebolla morada.",
  },
  {
    category: "Desayunos",
    name: "Omelette de queso",
    price: 95,
    emoji: "🧀",
    desc: "Omelette de tres huevos relleno de queso derretido, con ensalada fresca de acompañamiento.",
  },
  // Entradas
  {
    category: "Entradas",
    name: "Guacamole con totopos",
    price: 65,
    emoji: "🥑",
    desc: "Guacamole recién hecho con aguacate, tomate, cebolla, cilantro y limón, con totopos crujientes.",
  },
  {
    category: "Entradas",
    name: "Nachos con queso",
    price: 70,
    emoji: "🧀",
    desc: "Totopos horneados cubiertos de queso cheddar fundido y jalapeños en escabeche.",
  },
  {
    category: "Entradas",
    name: "Sopa de tortilla",
    price: 60,
    emoji: "🍲",
    desc: "Caldo de jitomate con tiras de tortilla frita, chile pasilla, queso y crema.",
  },
  {
    category: "Entradas",
    name: "Ensalada César",
    price: 85,
    emoji: "🥗",
    desc: "Lechuga romana, crutones, queso parmesano y aderezo César; con pollo a la parrilla.",
  },
  // Platos fuertes
  {
    category: "Platos fuertes",
    name: "Hamburguesa clásica",
    price: 120,
    emoji: "🍔",
    desc: "Carne de res a la parrilla con queso, lechuga, jitomate y cebolla en pan brioche.",
  },
  {
    category: "Platos fuertes",
    name: "Papas a la francesa",
    price: 45,
    emoji: "🍟",
    desc: "Papas doradas y crujientes con sal de grano, para acompañar o compartir.",
  },
  {
    category: "Platos fuertes",
    name: "Alitas BBQ (10 pzas)",
    price: 110,
    emoji: "🍗",
    desc: "Diez alitas bañadas en salsa BBQ ahumada, con aderezo ranch y apio.",
  },
  {
    category: "Platos fuertes",
    name: "Tacos de arrachera (3 pzas)",
    price: 135,
    emoji: "🌮",
    desc: "Tres tacos de arrachera marinada con cebolla caramelizada, aguacate y salsa de la casa.",
  },
  {
    category: "Platos fuertes",
    name: "Milanesa de pollo",
    price: 115,
    emoji: "🍗",
    desc: "Pechuga empanizada y dorada, servida con arroz rojo, frijoles y ensalada.",
  },
  {
    category: "Platos fuertes",
    name: "Pasta Alfredo",
    price: 130,
    emoji: "🍝",
    desc: "Fettuccine en salsa cremosa de parmesano con pollo asado y perejil fresco.",
  },
  {
    category: "Platos fuertes",
    name: "Filete de pescado",
    price: 160,
    emoji: "🐟",
    desc: "Filete fresco a la plancha con mantequilla y limón, papas al romero y verduras.",
  },
  {
    category: "Platos fuertes",
    name: "Costillas BBQ",
    price: 175,
    emoji: "🍖",
    desc: "Costillas de cerdo glaseadas en salsa BBQ, cocidas a fuego lento hasta desprenderse del hueso.",
  },
  // Bebidas
  {
    category: "Bebidas",
    name: "Refresco de lata",
    price: 25,
    emoji: "🥤",
    desc: "Refresco frío de 355 ml con hielos; elige tu sabor favorito.",
  },
  {
    category: "Bebidas",
    name: "Agua natural",
    price: 28,
    emoji: "💧",
    desc: "Agua purificada con hielo, en vaso o jarra de 500 ml.",
  },
  {
    category: "Bebidas",
    name: "Limonada",
    price: 40,
    emoji: "🍋",
    desc: "Limonada natural bien fría; pídela mineral o con un toque de hierbabuena.",
  },
  {
    category: "Bebidas",
    name: "Café americano",
    price: 30,
    emoji: "☕",
    desc: "Café de grano recién preparado, suave y aromático, en taza de 250 ml.",
  },
  {
    category: "Bebidas",
    name: "Cerveza artesanal",
    price: 55,
    emoji: "🍺",
    desc: "Cerveza artesanal de temporada, bien fría, en botella de 355 ml.",
  },
  // Postres
  {
    category: "Postres",
    name: "Flan napolitano",
    price: 45,
    emoji: "🍮",
    desc: "Flan cremoso de huevo con caramelo, receta tradicional de la casa.",
  },
  {
    category: "Postres",
    name: "Pastel de chocolate",
    price: 55,
    emoji: "🍰",
    desc: "Rebanada generosa de pastel de chocolate húmedo con ganache.",
  },
  {
    category: "Postres",
    name: "Helado de vainilla",
    price: 40,
    emoji: "🍨",
    desc: "Dos bolas de helado de vainilla con trocitos de vaina natural.",
  },
]

// Combos (constructor de producto): los items referencian nombres del menú.
const REST_COMBOS: {
  name: string
  price: number
  items: [string, number][]
}[] = [
  {
    name: "Combo Hamburguesa",
    price: 159,
    items: [
      ["Hamburguesa clásica", 1],
      ["Papas a la francesa", 1],
      ["Refresco de lata", 1],
    ],
  },
  {
    name: "Combo Alitas",
    price: 139,
    items: [
      ["Alitas BBQ (10 pzas)", 1],
      ["Refresco de lata", 1],
    ],
  },
  {
    name: "Combo Desayuno",
    price: 99,
    items: [
      ["Huevos al gusto", 1],
      ["Café americano", 1],
    ],
  },
  {
    name: "Combo Familiar",
    price: 349,
    items: [
      ["Hamburguesa clásica", 2],
      ["Refresco de lata", 2],
      ["Nachos con queso", 1],
    ],
  },
]

// Mesas del comedor (número, capacidad, posición en el mapa).
// Mesas demo con id + qrToken FIJOS: los enlaces QR del menú digital quedan
// estables entre re-siembras y están documentados en el README (Datos demo →
// Menú digital por QR) para que testers escaneen sin consultar la BD.
// Salas del local (plano visual por sala): nombre + orden de presentación.
// Las mesas referencian una sala por clave para la siembra.
type TableRoomKey = "principal" | "bar" | "terraza"
const ROOM_NAMES: Record<TableRoomKey, string> = {
  principal: "Salón principal",
  bar: "Barra",
  terraza: "Terraza",
}
const ROOM_ORDER: Record<TableRoomKey, number> = {
  principal: 0,
  bar: 1,
  terraza: 2,
}

/** Upsert de la sala de la org: devuelve su id (crea si no existe). */
async function ensureTableRoom(
  organizationId: string,
  locationId: string,
  key: TableRoomKey
): Promise<string> {
  const name = ROOM_NAMES[key]
  const existing = await prisma.tableRoom.findFirst({ where: { organizationId, name } })
  if (existing) return existing.id
  const room = await prisma.tableRoom.create({
    data: { organizationId, locationId, name, sortOrder: ROOM_ORDER[key] },
  })
  return room.id
}

const REST_TABLES: {
  number: number
  capacity: number
  x: number
  y: number
  id: string
  qrToken: string
  room: TableRoomKey
  shape: "round" | "square" | "rectangle" | "booth" | "bar"
  width: number
  height: number
}[] = [
  { number: 1, capacity: 2, x: 1, y: 1, id: "demo-rest-t1", qrToken: "demo-rest-qr-t1", room: "principal", shape: "round", width: 72, height: 72 },
  { number: 2, capacity: 2, x: 3, y: 1, id: "demo-rest-t2", qrToken: "demo-rest-qr-t2", room: "principal", shape: "round", width: 72, height: 72 },
  { number: 3, capacity: 4, x: 1, y: 2, id: "demo-rest-t3", qrToken: "demo-rest-qr-t3", room: "principal", shape: "round", width: 84, height: 84 },
  { number: 4, capacity: 4, x: 3, y: 2, id: "demo-rest-t4", qrToken: "demo-rest-qr-t4", room: "principal", shape: "round", width: 84, height: 84 },
  { number: 5, capacity: 6, x: 2, y: 3, id: "demo-rest-t5", qrToken: "demo-rest-qr-t5", room: "bar", shape: "bar", width: 160, height: 56 },
  { number: 6, capacity: 4, x: 1, y: 4, id: "demo-rest-t6", qrToken: "demo-rest-qr-t6", room: "terraza", shape: "round", width: 84, height: 84 },
  { number: 7, capacity: 4, x: 3, y: 4, id: "demo-rest-t7", qrToken: "demo-rest-qr-t7", room: "terraza", shape: "round", width: 84, height: 84 },
  { number: 8, capacity: 8, x: 2, y: 5, id: "demo-rest-t8", qrToken: "demo-rest-qr-t8", room: "terraza", shape: "rectangle", width: 160, height: 84 },
]

type ProductDef = {
  category: string
  name: string
  price: number
  /** Emoji ilustrativo para la imagen placeholder del catálogo. */
  emoji: string
  /** Descripción corta que se muestra en el portal del cliente. */
  desc: string
  bulk?: boolean
  variants?: { name: string; price: number }[]
}

const PRODUCTS: ProductDef[] = [
  // Abarrotes
  {
    category: "Abarrotes",
    name: "Arroz 1kg",
    price: 24.5,
    emoji: "🍚",
    desc: "Arroz de grano largo, ideal para guisados, caldos y la mesa de todos los días.",
  },
  {
    category: "Abarrotes",
    name: "Frijoles 900g",
    price: 32,
    emoji: "🫘",
    desc: "Frijol bayo seleccionado, listo para remojar y cocinar en olla o presión.",
  },
  {
    category: "Abarrotes",
    name: "Aceite vegetal 1L",
    price: 45,
    emoji: "🫒",
    desc: "Aceite comestible de soya, ligero para freír, guisar y aliñar ensaladas.",
  },
  {
    category: "Abarrotes",
    name: "Atún en lata",
    price: 28.5,
    emoji: "🐟",
    desc: "Atún en agua, proteína lista para ensaladas, tortas y sándwiches.",
  },
  {
    category: "Abarrotes",
    name: "Spaghetti 500g",
    price: 18.9,
    emoji: "🍝",
    desc: "Pasta de trigo durum, la clásica para pastas, sopas y guisos con salsa.",
  },
  // Bebidas
  {
    category: "Bebidas",
    name: "Refresco cola 2L",
    price: 28,
    emoji: "🥤",
    desc: "El sabor clásico de cola en presentación familiar de 2 litros, bien fría.",
  },
  {
    category: "Bebidas",
    name: "Agua natural 1.5L",
    price: 22,
    emoji: "💧",
    desc: "Agua purificada de 1.5 litros, ligera y fresca para toda la familia.",
  },
  {
    category: "Bebidas",
    name: "Jugo de naranja 1L",
    price: 25,
    emoji: "🧃",
    desc: "Jugo de naranja 100% natural sin azúcares añadidos; refrigera tras abrir.",
  },
  {
    category: "Bebidas",
    name: "Cerveza 355ml",
    price: 19.5,
    emoji: "🍺",
    desc: "Cerveza ligera tipo lager en lata de 355 ml, para acompañar una tarde con amigos.",
  },
  {
    category: "Bebidas",
    name: "Té helado 600ml",
    price: 18,
    emoji: "🧋",
    desc: "Té helado sabor limón, refrescante y listo para llevar a donde vayas.",
  },
  // Lácteos
  {
    category: "Lácteos y Huevo",
    name: "Leche entera 1L",
    price: 23,
    emoji: "🥛",
    desc: "Leche de vaca entera ultrapasteurizada, con todo el sabor de siempre.",
    variants: [
      { name: "Entera", price: 23 },
      { name: "Light", price: 23.5 },
    ],
  },
  {
    category: "Lácteos y Huevo",
    name: "Queso manchego 400g",
    price: 89,
    emoji: "🧀",
    desc: "Queso tipo manchego cremoso, perfecto para sándwiches, gratinados y botanas.",
  },
  {
    category: "Lácteos y Huevo",
    name: "Yogurt natural 1kg",
    price: 52,
    emoji: "🥣",
    desc: "Yogurt natural sin azúcar, cremoso; combínalo con fruta y granola.",
  },
  {
    category: "Lácteos y Huevo",
    name: "Mantequilla 90g",
    price: 26,
    emoji: "🧈",
    desc: "Mantequilla de mesa con sal, para untar, hornear y dar sabor a tus guisos.",
  },
  {
    category: "Lácteos y Huevo",
    name: "Huevo blanco 12 pzas",
    price: 42,
    emoji: "🥚",
    desc: "Huevo blanco de rancho, docena seleccionada para desayunos y repostería.",
    variants: [
      { name: "Blanco 12", price: 42 },
      { name: "Rojo 12", price: 44 },
    ],
  },
  // Frutas y Verduras (a granel)
  {
    category: "Frutas y Verduras",
    name: "Tomate rojo",
    price: 28,
    emoji: "🍅",
    desc: "Tomate saladette rojo, firme y jugoso para salsas, guisados y ensaladas.",
    bulk: true,
  },
  {
    category: "Frutas y Verduras",
    name: "Cebolla blanca",
    price: 22,
    emoji: "🧅",
    desc: "Cebolla blanca seleccionada, el sazón de base de la cocina mexicana.",
    bulk: true,
  },
  {
    category: "Frutas y Verduras",
    name: "Papa",
    price: 20,
    emoji: "🥔",
    desc: "Papa blanca de primera, para guisar, freír o hacer un puré cremoso.",
    bulk: true,
  },
  {
    category: "Frutas y Verduras",
    name: "Manzana roja",
    price: 35,
    emoji: "🍎",
    desc: "Manzana roja crujiente y dulce, perfecta para llevar o para postres.",
    bulk: true,
  },
  {
    category: "Frutas y Verduras",
    name: "Plátano",
    price: 18,
    emoji: "🍌",
    desc: "Plátano tabasco maduro, dulce y cremoso; rico solo o en licuados.",
    bulk: true,
  },
  // Carnes
  {
    category: "Carnes y Pescados",
    name: "Pechuga de pollo",
    price: 98,
    emoji: "🍗",
    desc: "Pechuga de pollo fresca y sin piel, baja en grasa y muy versátil.",
    bulk: true,
  },
  {
    category: "Carnes y Pescados",
    name: "Res molida",
    price: 120,
    emoji: "🥩",
    desc: "Carne de res molida 90/10, lista para hamburguesas, albóndigas y picadillo.",
    bulk: true,
  },
  {
    category: "Carnes y Pescados",
    name: "Chuleta de cerdo",
    price: 110,
    emoji: "🍖",
    desc: "Chuleta de cerdo fresca y jugosa, para asar, empanizar o guisar.",
    bulk: true,
  },
  {
    category: "Carnes y Pescados",
    name: "Tilapia",
    price: 85,
    emoji: "🐠",
    desc: "Filete de tilapia fresco, de sabor delicado; ideal a la plancha.",
  },
  {
    category: "Carnes y Pescados",
    name: "Tocino",
    price: 65,
    emoji: "🥓",
    desc: "Tocino ahumado en rebanadas, crujiente para desayunos, tortas y pastas.",
  },
  // Panadería
  {
    category: "Panadería",
    name: "Pan blanco 600g",
    price: 35,
    emoji: "🍞",
    desc: "Pan de caja blanco y suave, para sándwiches, molletes y desayunos rápidos.",
  },
  {
    category: "Panadería",
    name: "Pan de caja integral",
    price: 38.5,
    emoji: "🥖",
    desc: "Pan de caja integral con fibra, ligero para sándwiches saludables.",
  },
  {
    category: "Panadería",
    name: "Bolillo",
    price: 1.5,
    emoji: "🥖",
    desc: "Bolillo crujiente horneado en el día, el clásico para tortas y sándwiches.",
  },
  {
    category: "Panadería",
    name: "Concha",
    price: 12,
    emoji: "🥐",
    desc: "Concha de azúcar suave y esponjosa, la favorita del pan dulce mexicano.",
  },
  {
    category: "Panadería",
    name: "Pastel de chocolate",
    price: 120,
    emoji: "🎂",
    desc: "Rebanada de pastel de chocolate con betún, el capricho de la panadería.",
  },
  // Limpieza
  {
    category: "Limpieza",
    name: "Jabón en polvo 1kg",
    price: 55,
    emoji: "🧺",
    desc: "Detergente en polvo con aroma a frescura, rinde para muchas cargas de ropa.",
  },
  {
    category: "Limpieza",
    name: "Cloro 1L",
    price: 15.5,
    emoji: "🧪",
    desc: "Cloro concentrado para desinfectar superficies, pisos y blanquear ropa blanca.",
  },
  {
    category: "Limpieza",
    name: "Detergente trastes 500ml",
    price: 24,
    emoji: "🫧",
    desc: "Detergente para trastes que corta la grasa y deja aroma a limón.",
  },
  {
    category: "Limpieza",
    name: "Papel higiénico 4 pzas",
    price: 46,
    emoji: "🧻",
    desc: "Papel higiénico suave de doble hoja, paquete con 4 rollos grandes.",
  },
  {
    category: "Limpieza",
    name: "Esponja",
    price: 18,
    emoji: "🧽",
    desc: "Esponja de doble cara, suave y abrasiva para lavar trastes y superficies.",
  },
  // Electrónica
  {
    category: "Electrónica",
    name: "Baterías AA 4 pzas",
    price: 49,
    emoji: "🔋",
    desc: "Paquete con 4 baterías alcalinas AA, de larga duración para tus aparatos.",
  },
  {
    category: "Electrónica",
    name: "Audífonos",
    price: 199,
    emoji: "🎧",
    desc: "Audífonos de diadema con sonido claro y almohadilla cómoda.",
  },
  {
    category: "Electrónica",
    name: "Cable USB-C",
    price: 89,
    emoji: "🔌",
    desc: "Cable USB-C de 1 metro con carga rápida y transferencia de datos.",
  },
  {
    category: "Electrónica",
    name: "Memoria USB 32GB",
    price: 149,
    emoji: "💾",
    desc: "Memoria USB de 32 GB con conector estándar, práctica para llevar tus archivos.",
  },
  {
    category: "Electrónica",
    name: "Bocina bluetooth",
    price: 499,
    emoji: "🔊",
    desc: "Bocina portátil bluetooth con buen sonido y batería de larga duración.",
  },
  // Ropa
  {
    category: "Ropa",
    name: "Calcetines x3",
    price: 59,
    emoji: "🧦",
    desc: "Paquete con 3 pares de calcetines de algodón, cómodos para el diario.",
  },
  {
    category: "Ropa",
    name: "Playera básica",
    price: 99,
    emoji: "👕",
    desc: "Playera de algodón en colores básicos, corte regular y cuello redondo.",
  },
  {
    category: "Ropa",
    name: "Pantalón de mezclilla",
    price: 349,
    emoji: "👖",
    desc: "Mezclilla clásica de corte recto, durable para el uso diario.",
    variants: [
      { name: "28", price: 349 },
      { name: "30", price: 349 },
      { name: "32", price: 349 },
    ],
  },
  {
    category: "Ropa",
    name: "Gorra",
    price: 129,
    emoji: "🧢",
    desc: "Gorra ajustable tipo béisbol, para protegerte del sol con estilo.",
  },
  {
    category: "Ropa",
    name: "Cinturón",
    price: 89,
    emoji: "🪢",
    desc: "Cinturón de piel sintética con hebilla metálica, ajustable a tu medida.",
  },
  // Salud y Cuidado
  {
    category: "Salud y Cuidado",
    name: "Shampoo 400ml",
    price: 62,
    emoji: "🧴",
    desc: "Shampoo balanceado para uso diario, deja el cabello limpio y suave.",
  },
  {
    category: "Salud y Cuidado",
    name: "Pasta dental",
    price: 35,
    emoji: "🦷",
    desc: "Pasta dental con flúor y protección anticaries para toda la familia.",
  },
  {
    category: "Salud y Cuidado",
    name: "Jabón de tocador",
    price: 22,
    emoji: "🧼",
    desc: "Jabón de tocador con crema humectante, ideal para piel sensible.",
  },
  {
    category: "Salud y Cuidado",
    name: "Cepillo dental",
    price: 28,
    emoji: "🪥",
    desc: "Cepillo dental de cerdas suaves con mango ergonómico antideslizante.",
  },
  {
    category: "Salud y Cuidado",
    name: "Alcohol 70% 500ml",
    price: 25,
    emoji: "🧴",
    desc: "Alcohol 70% para desinfectar manos y superficies, con tapa de seguridad.",
  },
]

// Combos del Supermercado Demo (retail): paquetes con precio especial, igual
// que REST_COMBOS en el restaurante. Cada ítem referencia un producto del
// catálogo por nombre (se usa la primera variante creada del producto).
const SUPER_COMBOS: { name: string; price: number; items: [string, number][] }[] = [
  {
    name: "Despensa para toda la semana",
    price: 129,
    items: [
      ["Arroz 1kg", 1],
      ["Frijoles 900g", 1],
      ["Aceite vegetal 1L", 1],
      ["Atún en lata", 1],
      ["Spaghetti 500g", 1],
    ],
  },
  {
    name: "Kit de limpieza para el hogar",
    price: 139,
    items: [
      ["Jabón en polvo 1kg", 1],
      ["Cloro 1L", 1],
      ["Detergente trastes 500ml", 1],
      ["Papel higiénico 4 pzas", 1],
      ["Esponja", 1],
    ],
  },
  {
    name: "Desayuno para la familia",
    price: 115,
    items: [
      ["Leche entera 1L", 1],
      ["Huevo blanco 12 pzas", 1],
      ["Pan blanco 600g", 1],
      ["Mantequilla 90g", 1],
      ["Bolillo", 6],
    ],
  },
  {
    name: "Kit de cuidado personal",
    price: 149,
    items: [
      ["Shampoo 400ml", 1],
      ["Pasta dental", 1],
      ["Jabón de tocador", 1],
      ["Cepillo dental", 1],
      ["Alcohol 70% 500ml", 1],
    ],
  },
]

const CUSTOMERS = [
  { name: "María García", phone: "5512345678" },
  { name: "José Martínez", phone: "5523456789" },
  { name: "Lucía Fernández", phone: "5534567890" },
  { name: "Miguel Hernández", phone: "5545678901" },
  { name: "Carmen López", phone: "5556789012" },
  { name: "Jorge Sánchez", phone: "5567890123" },
  { name: "Fernanda Díaz", phone: "5578901234" },
  { name: "Roberto Torres", phone: "5589012345" },
  { name: "Patricia Ramírez", phone: "5590123456" },
  { name: "Andrés Castillo", phone: "5501234567" },
]

// PRNG determinista
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

const pick = <T>(arr: T[], rnd: () => number): T =>
  arr[Math.floor(rnd() * arr.length)]

// ── Imágenes placeholder del catálogo ────────────────────────────────────────
// Delegan en src/lib/catalog/placeholder.ts (paleta compartida con POS, portal
// y admin). Los seeds guardan la URL de la ruta de imágenes en lugar de data
// URIs: `imageUrl` se comporta como cualquier archivo y subir una foto real
// después es el mismo flujo de siempre.
function productImageUrl(emoji: string, category: string): string {
  return placeholderImageUrl(emoji, category)
}

/** Emoji representativo por categoría para su imagen en el catálogo. */
const CATEGORY_EMOJI: Record<string, string> = {
  // Restaurante / Híbrido
  Desayunos: "🍳",
  Entradas: "🥗",
  "Platos fuertes": "🍽️",
  Bebidas: "🥤",
  Postres: "🍰",
  Despensa: "🫙",
  "Botanas y dulces": "🍿",
  Cocina: "🍳",
  // Supermercado
  Abarrotes: "🛒",
  "Lácteos y Huevo": "🥛",
  "Frutas y Verduras": "🍎",
  "Carnes y Pescados": "🥩",
  Panadería: "🥖",
  Limpieza: "🧼",
  Electrónica: "🔌",
  Ropa: "👕",
  "Salud y Cuidado": "💊",
  // Estética
  Cortes: "💇",
  Color: "🎨",
  "Manicure y Pedicure": "💅",
  Tratamientos: "🧖",
  "Maquillaje y Peinado": "💄",
  Productos: "🧴",
  // Fiestas
  Brincolines: "🏰",
  "Mobiliario y Carpas": "⛺",
  Fotografía: "📸",
  "Audio e Iluminación": "🔊",
  "Juegos y Extras": "🎉",
}

/** Imagen de una categoría (mismo placeholder que los productos). */
const categoryImageUrl = (name: string): string =>
  productImageUrl(CATEGORY_EMOJI[name] ?? "🏷️", name)

/** Clave de día local (AAAA-MM-DD) para llevar unidades apartadas por fecha. */
const ymdKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`

const RENTAL_NOTES = [
  "Montaje incluido en el domicilio",
  "Requiere supervisión de adulto",
  "Entrega el viernes por la mañana",
  "Cliente recoge en sucursal",
  "Incluye extensión eléctrica",
  "Paquete de cumpleaños infantil",
  "Recoger antes de las 8 pm",
]

async function cleanupDemo(orgIds: string[], emails: string[]) {
  const d = prisma
  // Agenda de citas (appointments → saleId y employee_services → empleados)
  await d.appointment.deleteMany()
  await d.employeeService.deleteMany()
  // Reservaciones de renta (reservation_items → variantes, reservations → sale)
  await d.reservationItem.deleteMany()
  await d.reservation.deleteMany()
  // Pedidos + mesas (food_service) y devoluciones/ventas
  await d.orderPreparationItem.deleteMany()
  await d.orderPreparation.deleteMany()
  await d.orderStatusHistory.deleteMany()
  await d.orderItem.deleteMany()
  await d.order.deleteMany()
  await d.tableSession.deleteMany()
  await d.table.deleteMany()
  await d.saleDiscount.deleteMany()
  await d.salePayment.deleteMany()
  await d.saleItem.deleteMany()
  await d.sale.deleteMany()
  await d.saleReturnItem.deleteMany()
  await d.saleReturn.deleteMany()
  await d.employeeCommission.deleteMany()
  await d.coupon.deleteMany()
  await d.loyaltyTransaction.deleteMany()
  await d.promotionTarget.deleteMany()
  await d.promotion.deleteMany()
  await d.inventoryRevisionItem.deleteMany()
  await d.inventoryRevision.deleteMany()
  await d.variantPriceHistory.deleteMany()
  await d.inventoryMovement.deleteMany()
  await d.inventory.deleteMany()
  // Transferencias, snapshots y pares (dependen de productos/ubicaciones)
  await d.transferItem.deleteMany()
  await d.transfer.deleteMany()
  await d.inventorySnapshot.deleteMany()
  await d.dailySalesSummary.deleteMany()
  await d.hourlySalesSnapshot.deleteMany()
  await d.productPair.deleteMany()
  await d.comboItem.deleteMany()
  await d.productCombo.deleteMany()
  await d.customerAddress.deleteMany()
  await d.branchDeliveryPolicy.deleteMany()
  await d.deliveryPolicy.deleteMany()
  await d.variantOptionValue.deleteMany()
  await d.shoppingListItem.deleteMany()
  await d.shoppingList.deleteMany()
  await d.customerFavorite.deleteMany()
  await d.productVariant.deleteMany()
  await d.productOptionValue.deleteMany()
  await d.productOption.deleteMany()
  await d.product.deleteMany()
  await d.category.deleteMany()
  // Crédito, segmentos y métodos de pago del cliente
  await d.customerSegment.deleteMany()
  await d.creditTransaction.deleteMany()
  await d.customerCredit.deleteMany()
  await d.creditPolicy.deleteMany()
  await d.customerPaymentMethod.deleteMany()
  await d.customer.deleteMany()
  await d.cashSession.deleteMany()
  await d.cashRegister.deleteMany()
  await d.cedi.deleteMany()
  await d.location.deleteMany()
  await d.employee.deleteMany()
  await d.employeePosition.deleteMany()
  await d.membership.deleteMany()
  await d.userInvitation.deleteMany()
  await d.notification.deleteMany()
  await d.publication.deleteMany()
  await d.pushSubscription.deleteMany()
  await d.companyProfile.deleteMany()
  await d.appSettings.deleteMany()
  await d.profile.deleteMany()
  await d.organization.deleteMany({ where: { id: { in: orgIds } } })
  // Conserva cuentas que siguen siendo dueñas de otra organización (ownerId
  // de organizations es NOT NULL): si otro org de prueba usa al dueño demo,
  // no se borra su cuenta sino que el seeder la reutiliza (upsert).
  await d.user.deleteMany({
    where: { email: { in: emails }, organizationsOwned: { none: {} } },
  })
}

/**
 * Restaurante Demo — organización food_service.
 * Equipo con roles del modo por roleId (mesero → system-food_service-waiter,
 * cocina → system-food_service-kitchen), menú con combos, mesas del comedor,
 * pedidos en curso para KDS/Mesas y ventas históricas.
 */
async function seedRestaurantDemo(ownerUserId: string, passwordHash: string) {
  const d = prisma
  const rnd = mulberry32(2047)
  const now = Date.now()

  // Cuentas del equipo (owner compartido demo@multi-pos.com)
  const teamUsers = new Map<string, string>()
  teamUsers.set(ownerUserId, "Ana López")
  for (const t of REST_TEAM) {
    const user = await d.user.upsert({
      where: { email: t.email },
      update: { passwordHash, fullName: t.fullName, isActive: true },
      create: { email: t.email, passwordHash, fullName: t.fullName, isActive: true },
    })
    teamUsers.set(user.id, t.fullName)
  }
  const gerenteId = (await d.user.findUniqueOrThrow({ where: { email: "gerente-rest@demo.multi-pos.com" } })).id
  const cajeroId = (await d.user.findUniqueOrThrow({ where: { email: "cajero-rest@demo.multi-pos.com" } })).id
  const meseroId = (await d.user.findUniqueOrThrow({ where: { email: "mesero@demo.multi-pos.com" } })).id
  const cocinaId = (await d.user.findUniqueOrThrow({ where: { email: "cocina@demo.multi-pos.com" } })).id

  // Organización (food_service)
  const org = await d.organization.create({
    data: {
      name: REST_ORG_NAME,
      ownerId: ownerUserId,
      currency: "MXN",
      businessMode: "food_service",
      pointsPerCurrency: 1,
      pointValue: 0.1,
      loyaltyEnabled: true,
    },
  })

  await d.companyProfile.create({
    data: {
      organizationId: org.id,
      legalName: "Restaurante Demo S.A. de C.V.",
      tradeName: "Restaurante Demo",
      taxId: "RDM000202020",
      city: "Ciudad de México",
      state: "CDMX",
      postalCode: "06700",
      country: "México",
      phone: "5512341111",
      email: "contacto@restaurante.demo",
      website: "https://restaurante.demo",
      ticketFooter: "¡Buen provecho!",
    },
  })

  await d.appSettings.create({
    data: {
      organizationId: org.id,
      primaryHue: 24,
      accentHue: 35,
      theme: "system",
      fontFamily: "montserrat",
    },
  })

  await d.deliveryPolicy.create({
    data: {
      organizationId: org.id,
      pickupEnabled: true,
      pickupMinAmount: 0,
      pickupFee: 0,
      pickupFeeEnabled: false,
      deliveryEnabled: true,
      deliveryMinAmount: 150,
      deliveryFee: 35,
      deliveryFeeEnabled: true,
      deliveryRadiusKm: 6,
      deliveryEstimatedMins: 40,
    },
  })

  // Roles de sistema (ids estables de seedProduction)
  const SHARED = {
    owner: "system-owner",
    manager: "system-manager",
    cashier: "system-cashier",
  } as const
  const membership = (userId: string, role: $Enums.OrgRole, roleId: string) =>
    d.membership.create({
      data: { userId, organizationId: org.id, role, roleId },
    })
  await membership(ownerUserId, "owner", SHARED.owner)
  await membership(gerenteId, "manager", SHARED.manager)
  await membership(cajeroId, "cashier", SHARED.cashier)
  await membership(meseroId, "cashier", "system-food_service-waiter")
  await membership(cocinaId, "cashier", "system-food_service-kitchen")

  // Puestos y empleados (login por código de nómina)
  const positions: Record<string, string> = {}
  for (const name of ["Gerente", "Supervisor", "Cajero", "Mesero", "Cocina"]) {
    const p = await d.employeePosition.create({
      data: { organizationId: org.id, name },
    })
    positions[name] = p.id
  }

  const employees: Record<string, string> = {}
  const makeEmployee = async (
    userId: string,
    code: string,
    fullName: string,
    position: string,
    phone: string
  ) => {
    const emp = await d.employee.create({
      data: {
        organizationId: org.id,
        userId,
        employeeCode: code,
        fullName,
        positionId: positions[position],
        phone,
      },
    })
    employees[userId] = emp.id
  }
  await makeEmployee(ownerUserId, "EMP-200", "Ana López", "Supervisor", "5512341000")
  await makeEmployee(gerenteId, "EMP-201", "Sofía Ramírez", "Gerente", "5512341001")
  await makeEmployee(cajeroId, "EMP-202", "Diego Torres", "Cajero", "5512341002")
  await makeEmployee(meseroId, "EMP-203", "Valentina Flores", "Mesero", "5512341003")
  await makeEmployee(cocinaId, "EMP-204", "Ricardo Núñez", "Cocina", "5512341004")

  // Sucursal + cajas
  const location = await d.location.create({
    data: {
      organizationId: org.id,
      name: "Matriz",
      code: "LOC-R1",
      latitude: 19.427,
      longitude: -99.167,
      address: "Av. Insurgentes Sur 450, Col. Roma Norte, CDMX",
      managerName: "Sofía Ramírez",
      allowsPickup: true,
      allowsDelivery: true,
      openingHours: "Lun-Dom 08:00-23:00",
      openingScheduleJson: JSON.stringify(emptySchedule()),
    },
  })
  const registerIds: string[] = []
  for (const [name, prefix] of [
    ["Caja 1", "RC1"],
    ["Caja 2", "RC2"],
  ] as const) {
    const r = await d.cashRegister.create({
      data: { locationId: location.id, organizationId: org.id, name, folioPrefix: prefix },
    })
    registerIds.push(r.id)
  }

  // Unidades del sistema
  const units = await d.unitOfMeasure.findMany({ where: { organizationId: null } })
  const unitPza = units.find((u) => u.abbreviation === "pza")

  // Categorías del menú
  const catIds: Record<string, string> = {}
  for (const name of [
    "Desayunos",
    "Entradas",
    "Platos fuertes",
    "Bebidas",
    "Postres",
  ]) {
    const c = await d.category.create({
      data: { organizationId: org.id, name, imageUrl: categoryImageUrl(name) },
    })
    catIds[name] = c.id
  }

  // Productos + variantes + inventario
  const menuVariants: {
    id: string
    productId: string
    productName: string
    price: number
  }[] = []
  const productIdByName = new Map<string, string>()
  const variantByProduct = new Map<string, string>()
  for (let i = 0; i < REST_PRODUCTS.length; i++) {
    const def = REST_PRODUCTS[i]
    const product = await d.product.create({
      data: {
        organizationId: org.id,
        categoryId: catIds[def.category],
        name: def.name,
        description: def.desc,
        imageUrl: productImageUrl(def.emoji, def.category),
        taxRate: 0.16,
        trackInventory: true,
        productType: "standard",
        allowSplit: false,
      },
    })
    productIdByName.set(def.name, product.id)
    const variant = await d.productVariant.create({
      data: {
        productId: product.id,
        organizationId: org.id,
        sku: `R-${String(i + 1).padStart(3, "0")}`,
        barcode: `7520${String(i + 1).padStart(8, "0")}`,
        name: "Default",
        price: def.price,
        cost: round2(def.price * 0.35),
      },
    })
    variantByProduct.set(def.name, variant.id)
    menuVariants.push({
      id: variant.id,
      productId: product.id,
      productName: def.name,
      price: def.price,
    })
    await d.inventory.create({
      data: {
        organizationId: org.id,
        variantId: variant.id,
        locationId: location.id,
        locationType: "location",
        quantity: round2(20 + rnd() * 180),
        unitId: unitPza?.id,
        minThreshold: 5,
      },
    })
  }

  // Combos (constructor de producto)
  for (const comboDef of REST_COMBOS) {
    const combo = await d.productCombo.create({
      data: {
        organizationId: org.id,
        name: comboDef.name,
        description: `Ahorra con ${comboDef.name.toLowerCase()}`,
        comboPrice: comboDef.price,
        isActive: true,
      },
    })
    for (const [itemName, quantity] of comboDef.items) {
      await d.comboItem.create({
        data: {
          comboId: combo.id,
          productId: productIdByName.get(itemName)!,
          variantId: variantByProduct.get(itemName)!,
          quantity,
        },
      })
    }
  }

  // Comensales (portal del cliente)
  const restCustomers = []
  for (let i = 0; i < REST_CUSTOMERS.length; i++) {
    const c = REST_CUSTOMERS[i]
    const email = `rcli-${String(i + 1).padStart(3, "0")}@restaurante.local`
    const user = await d.user.upsert({
      where: { email },
      update: { passwordHash, fullName: c.name, isActive: true },
      create: { email, passwordHash, fullName: c.name, isActive: true },
    })
    const customer = await d.customer.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        customerCode: `COM-${String(i + 1).padStart(3, "0")}`,
        fullName: c.name,
        phone: c.phone,
        points: round2(rnd() * 300),
      },
    })
    restCustomers.push(customer)
  }

  // Mesas del comedor (qrToken único para el menú digital: mismo formato
  // que genera /api/tables al crear mesas en producción)
  const tables: Record<string, { id: string; number: number }> = {}
  // Salas del local: cada mesa cae en su sala (comedor/barra/terraza).
  const rooms: Partial<Record<TableRoomKey, string>> = {}
  for (const t of REST_TABLES) {
    // id + qrToken fijos (ver nota en REST_TABLES): enlaces QR documentados.
    if (!rooms[t.room]) rooms[t.room] = await ensureTableRoom(org.id, location.id, t.room)
    const table = await d.table.create({
      data: {
        id: t.id,
        organizationId: org.id,
        locationId: location.id,
        roomId: rooms[t.room],
        number: t.number,
        name: `Mesa ${t.number}`,
        capacity: t.capacity,
        shape: t.shape,
        width: t.width,
        height: t.height,
        status: "free",
        posX: t.x * 120,
        posY: t.y * 90,
        isActive: true,
        qrToken: t.qrToken,
      },
    })
    tables[t.number] = { id: table.id, number: t.number }
  }

  // Helper de pedidos (líneas + historial + preparación)
  const unitId = unitPza?.id
  const orderItemsData = (names: string[], comment?: string) =>
    names.map((name) => {
      const v = menuVariants.find((m) => m.productName === name)!
      return {
        productId: v.productId,
        variantId: v.id,
        productName: v.productName,
        variantName: "Default",
        productType: "standard" as const,
        quantity: 1,
        unitId,
        unitPrice: v.price,
        lineTotal: v.price,
        comment: comment ?? null,
      }
    })
  const lineTotal = (names: string[]) =>
    round2(
      names.reduce(
        (acc, n) => acc + (menuVariants.find((m) => m.productName === n)?.price ?? 0),
        0
      )
    )
  const statusHistory = async (
    orderId: string,
    statuses: { status: $Enums.OrderStatus; at: Date; by?: string }[]
  ) => {
    for (const s of statuses) {
      await d.orderStatusHistory.create({
        data: {
          orderId,
          status: s.status,
          userId: s.by,
          employeeId: s.by ? employees[s.by] : undefined,
          createdAt: s.at,
        },
      })
    }
  }
  const markPrepared = async (
    orderId: string,
    items: { id: string }[],
    startedAt: Date,
    done: boolean
  ) => {
    const prep = await d.orderPreparation.create({
      data: {
        orderId,
        employeeId: employees[cocinaId],
        startedAt,
        completedAt: done ? new Date(startedAt.getTime() + 12 * 60000) : null,
        elapsedSeconds: done ? 720 : null,
      },
    })
    await d.orderPreparationItem.createMany({
      data: items.map((it) => ({
        preparationId: prep.id,
        orderItemId: it.id,
        scanned: done,
        found: done,
      })),
    })
  }

  const makeOrder = async (input: {
    status: $Enums.OrderStatus
    deliveryMethod: $Enums.DeliveryMethod
    tableId?: string
    customerId?: string
    minutesAgo: number
    names: string[]
    comment?: string
    tip?: number
    address?: string
    deliveryFee?: number
    prepStatus?: "none" | "active" | "done"
  }) => {
    const at = new Date(now - input.minutesAgo * 60000)
    const subtotal = lineTotal(input.names)
    const discount = 0
    const total = round2(subtotal * 1.16)
    const order = await d.order.create({
      data: {
        organizationId: org.id,
        locationId: location.id,
        customerId: input.customerId,
        tableId: input.tableId,
        status: input.status,
        deliveryMethod: input.deliveryMethod,
        subtotal,
        discount,
        total,
        tip: input.tip ?? null,
        address: input.address ?? null,
        deliveryFee: input.deliveryFee ?? 0,
        createdAt: at,
        updatedAt: at,
        paidAt:
          input.status === "delivered" || input.status === "ready"
            ? at
            : null,
        items: { create: orderItemsData(input.names, input.comment) },
      },
      include: { items: true },
    })

    // Historial de estados hasta el estado actual
    const flow: $Enums.OrderStatus[] = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "delivered",
    ]
    const idx = flow.indexOf(input.status)
    const steps: { status: $Enums.OrderStatus; at: Date; by?: string }[] = []
    for (let s = 0; s <= Math.max(idx, 0); s++) {
      const st = flow[s]
      const isKitchen = st === "preparing" || st === "ready"
      steps.push({
        status: st,
        at: new Date(at.getTime() + s * 4 * 60000),
        by: st === "confirmed" ? meseroId : isKitchen ? cocinaId : meseroId,
      })
    }
    if (input.status === "cancelled") {
      steps.push({ status: "cancelled", at: new Date(at.getTime() + 10 * 60000), by: meseroId })
    }
    await statusHistory(order.id, steps)

    // Preparación (KDS)
    if (input.prepStatus && input.prepStatus !== "none") {
      await markPrepared(
        order.id,
        order.items,
        new Date(at.getTime() + 4 * 60000),
        input.prepStatus === "done"
      )
    }
    return order
  }

  // ── Pedidos en curso (KDS + Mesas) ──────────────────────────────────────
  // Mesa 1: ocupada con pedido en preparación
  await d.table.update({ where: { id: tables[1].id }, data: { status: "occupied" } })
  await d.tableSession.create({
    data: {
      tableId: tables[1].id,
      startedAt: new Date(now - 25 * 60000),
      notes: "Comensal en mesa",
    },
  })
  const t1Order = await makeOrder({
    status: "preparing",
    deliveryMethod: "pickup",
    tableId: tables[1].id,
    minutesAgo: 18,
    names: ["Milanesa de pollo", "Refresco de lata", "Flan napolitano"],
    comment: "Sin cebolla",
    prepStatus: "active",
  })
  await d.tableSession.updateMany({
    where: { tableId: tables[1].id, endedAt: null },
    data: { orderId: t1Order.id },
  })

  // Mesa 2: ocupada, pedido confirmado (aún no en cocina)
  await d.table.update({ where: { id: tables[2].id }, data: { status: "occupied" } })
  await d.tableSession.create({
    data: {
      tableId: tables[2].id,
      startedAt: new Date(now - 15 * 60000),
    },
  })
  const t2Order = await makeOrder({
    status: "confirmed",
    deliveryMethod: "pickup",
    tableId: tables[2].id,
    minutesAgo: 8,
    names: ["Alitas BBQ (10 pzas)", "Refresco de lata"],
    comment: "Aderezo aparte",
    prepStatus: "none",
  })
  await d.tableSession.updateMany({
    where: { tableId: tables[2].id, endedAt: null },
    data: { orderId: t2Order.id },
  })

  // Mesa 3 (momento demo): orden EN COCINA (preparing, visible en el KDS) de
  // una mesa cuyo ticket el mesero ya limpió sin cobrar. Guion demo:
  // a) cobrarla desde el POS (Mesa 3 + artículos → la orden sale del KDS) o
  // b) regresarla: Catálogos → Pedidos → pedido de mesa → "Cancelar orden".
  await d.table.update({ where: { id: tables[3].id }, data: { status: "occupied" } })
  await d.tableSession.create({
    data: {
      tableId: tables[3].id,
      startedAt: new Date(now - 6 * 60000),
      notes: "Ticket enviado a cocina; cobro pendiente (momento demo)",
    },
  })
  await makeOrder({
    status: "preparing",
    deliveryMethod: "pickup",
    tableId: tables[3].id,
    minutesAgo: 5,
    names: ["Chilaquiles verdes", "Café americano"],
    prepStatus: "active",
  })

  // Mesa 4: reservada
  await d.table.update({ where: { id: tables[4].id }, data: { status: "reserved" } })

  // Delivery y pickup en curso
  await makeOrder({
    status: "preparing",
    deliveryMethod: "delivery",
    customerId: restCustomers[0].id,
    minutesAgo: 22,
    names: ["Hamburguesa clásica", "Papas a la francesa", "Refresco de lata"],
    address: "Calle Durango 789, Col. Roma Norte, CDMX",
    deliveryFee: 35,
    comment: "Toca el timbre",
    prepStatus: "active",
  })
  await makeOrder({
    status: "pending",
    deliveryMethod: "pickup",
    customerId: restCustomers[1].id,
    minutesAgo: 5,
    names: ["Nachos con queso", "Refresco de lata", "Refresco de lata"],
    prepStatus: "none",
  })

  // ── Historial de pedidos recientes ──────────────────────────────────────
  await makeOrder({
    status: "ready",
    deliveryMethod: "pickup",
    customerId: restCustomers[2].id,
    minutesAgo: 26 * 60,
    names: ["Hamburguesa clásica", "Papas a la francesa"],
    prepStatus: "done",
  })
  await makeOrder({
    status: "delivered",
    deliveryMethod: "delivery",
    customerId: restCustomers[3].id,
    minutesAgo: 27 * 60,
    names: ["Costillas BBQ", "Limonada"],
    address: "Blvd. Insurgentes 456, Del. Miguel Hidalgo, CDMX",
    deliveryFee: 35,
    tip: 30,
    prepStatus: "done",
  })
  await makeOrder({
    status: "cancelled",
    deliveryMethod: "pickup",
    customerId: restCustomers[4].id,
    minutesAgo: 30 * 60,
    names: ["Filete de pescado"],
    comment: "Cancelado por el cliente",
    prepStatus: "none",
  })

  // ── Ventas históricas (30) ──────────────────────────────────────────────
  const cashiers = [cajeroId, gerenteId, ownerUserId]
  let saleSeq = 0
  for (let s = 0; s < 30; s++) {
    saleSeq += 1
    const reg = registerIds[s % registerIds.length]
    const cashier = cashiers[Math.floor(rnd() * cashiers.length)]
    const customer = rnd() < 0.65 ? pick(restCustomers, rnd) : null
    const saleDate = new Date(now - Math.floor(rnd() * 30) * 86400000)
    saleDate.setHours(8 + Math.floor(rnd() * 13), Math.floor(rnd() * 60), 0, 0)

    const itemCount = 1 + Math.floor(rnd() * 4)
    const itemNames = []
    for (let k = 0; k < itemCount; k++) {
      itemNames.push(pick(menuVariants, rnd).productName)
    }
    const sub = lineTotal(itemNames)
    const hasDiscount = rnd() < 0.2
    const discount = hasDiscount ? round2(sub * 0.1) : 0
    const tax = round2((sub - discount) * 0.16)
    const total = round2(sub - discount + tax)
    const tip = rnd() < 0.4 ? round2(total * 0.1) : 0
    const sale = await d.sale.create({
      data: {
        organizationId: org.id,
        locationId: location.id,
        cashRegisterId: reg,
        cashierId: cashier,
        employeeId: employees[cashier],
        customerId: customer?.id,
        locationSaleNumber: BigInt(saleSeq),
        subtotal: sub,
        discount,
        tax,
        total,
        tip,
        pointsEarned: customer ? round2(total) : 0,
        status: "completed",
        notes: hasDiscount ? "Descuento de cortesía" : null,
        createdAt: saleDate,
        items: {
          create: itemNames.map((n) => {
            const v = menuVariants.find((m) => m.productName === n)!
            return {
              productId: v.productId,
              variantId: v.id,
              productName: v.productName,
              variantName: "Default",
              productType: "standard" as const,
              quantity: 1,
              unitId,
              unitPrice: v.price,
              totalPrice: v.price,
              lineTotal: v.price,
            }
          }),
        },
      },
    })
    await d.salePayment.create({
      data: {
        saleId: sale.id,
        method: rnd() < 0.55 ? "cash" : "card",
        amount: round2(total + tip),
      },
    })
    if (customer) {
      await d.loyaltyTransaction.create({
        data: {
          organizationId: org.id,
          customerId: customer.id,
          saleId: sale.id,
          kind: "earn",
          points: round2(total),
          note: `Venta ${saleSeq}`,
        },
      })
    }
  }
  await d.location.update({
    where: { id: location.id },
    data: { saleSeq: BigInt(saleSeq) },
  })

  // Notificaciones y publicaciones de ejemplo
  await d.notification.createMany({
    data: [
      {
        organizationId: org.id,
        userId: cocinaId,
        kind: "new_order",
        title: "Pedido en espera en cocina",
        body: "La mesa 1 tiene un pedido por preparar.",
        severity: "info",
        link: "/kds",
      },
      {
        organizationId: org.id,
        userId: ownerUserId,
        kind: "new_order",
        title: "Nuevo pedido para entrega",
        body: "Un cliente pidió el Combo Hamburguesa a domicilio.",
        severity: "success",
        link: "/admin/orders",
      },
    ],
  })
  await d.publication.createMany({
    data: [
      {
        organizationId: org.id,
        title: "Combo Familiar por $349",
        content:
          "2 hamburguesas, 2 refrescos y nachos con queso por solo $349.",
        type: "promotion",
        isActive: true,
        publishedAt: new Date(now - 3 * 86400000),
      },
      {
        organizationId: org.id,
        title: "Aviso: horario extendido",
        content: "Los fines de semana abrimos hasta la 1:00 am.",
        type: "notice",
        isActive: true,
        publishedAt: new Date(now - 7 * 86400000),
      },
    ],
  })

  return {
    org,
    teamUsers,
    location,
    registerIds,
    tables,
    customers: restCustomers,
    employees,
    users: { gerenteId, cajeroId, meseroId, cocinaId },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Híbrido Demo (retail + food_service)
// ─────────────────────────────────────────────────────────────────────────────
// Fonda-tienda que combina el modo retail (despensa y botanas en anaquel con
// inventario) y el modo food_service (comida en mesas, combos y pedidos a
// cocina / KDS). El equipo usa los roles del modo híbrido por roleId
// (system-hybrid-waiter / system-hybrid-kitchen) para ejercitar ese set de
// roles en la demo, igual que el restaurante ejercita los de food_service.

// Equipo de la fonda-tienda (además del owner compartido demo@multi-pos.com).
const HYB_TEAM = [
  { email: "gerente-hib@demo.multi-pos.com", fullName: "Claudia Monroy", role: "manager" as const, position: "Gerente" },
  { email: "cajero-hib@demo.multi-pos.com", fullName: "Hugo Paredes", role: "cashier" as const, position: "Cajero" },
  { email: "mesero-hib@demo.multi-pos.com", fullName: "Renata Aguilar", role: "cashier" as const, roleId: "system-hybrid-waiter", position: "Mesero" },
  { email: "cocina-hib@demo.multi-pos.com", fullName: "Iván Robles", role: "cashier" as const, roleId: "system-hybrid-kitchen", position: "Cocina" },
] as const

// Clientes frecuentes (portal del cliente: piden a domicilio y compran).
const HYB_CUSTOMERS = [
  { name: "Regina Solís", phone: "5522001133" },
  { name: "Álvaro Cuevas", phone: "5533112244" },
  { name: "Mónica Peña", phone: "5544223355" },
  { name: "Bruno Ríos", phone: "5555334466" },
  { name: "Adriana Vela", phone: "5566445577" },
  { name: "Leonardo Cano", phone: "5577556688" },
] as const

// Catálogo mixto: anaquel retail (Despensa / Botanas) + comida (Cocina /
// Desayunos / Postres); Bebidas se comparte entre ambos mostradores.
const HYB_PRODUCTS: MenuDef[] = [
  // Despensa (retail)
  {
    category: "Despensa",
    name: "Arroz integral 1kg",
    price: 38,
    emoji: "🍚",
    desc: "Arroz integral de grano largo, ideal para guisados y guarniciones.",
  },
  {
    category: "Despensa",
    name: "Frijol refrito 400g",
    price: 24,
    emoji: "🫘",
    desc: "Frijol bayo refrito, cremoso y listo para acompañar.",
  },
  {
    category: "Despensa",
    name: "Lenteja 500g",
    price: 26,
    emoji: "🫘",
    desc: "Lenteja seleccionada, rica en proteína; rinde para 4 porciones.",
  },
  {
    category: "Despensa",
    name: "Café soluble 200g",
    price: 79,
    emoji: "☕",
    desc: "Café soluble de tueste medio, de disolución rápida.",
  },
  {
    category: "Despensa",
    name: "Galletas de animalitos 300g",
    price: 18,
    emoji: "🍪",
    desc: "Galletitas de azúcar con formas de animalitos, para toda la familia.",
  },
  {
    category: "Despensa",
    name: "Atún en aceite 140g",
    price: 23,
    emoji: "🥫",
    desc: "Atún en trozos en aceite vegetal, práctico para ensaladas y tortas.",
  },
  // Botanas y dulces (retail)
  {
    category: "Botanas y dulces",
    name: "Papas fritas 45g",
    price: 15,
    emoji: "🍟",
    desc: "Papas fritas crujientes con sal, bolsa individual.",
  },
  {
    category: "Botanas y dulces",
    name: "Cacahuate garapiñado",
    price: 20,
    emoji: "🥜",
    desc: "Cacahuate cubierto de caramelo crujiente, dulce y salado.",
  },
  {
    category: "Botanas y dulces",
    name: "Palomitas para microondas",
    price: 22,
    emoji: "🍿",
    desc: "Palomitas de mantequilla listas en 3 minutos en el microondas.",
  },
  {
    category: "Botanas y dulces",
    name: "Chicharrón de harina 90g",
    price: 18,
    emoji: "🫓",
    desc: "Chicharrón de harina crujiente para tacos, con guacamole o solo.",
  },
  // Bebidas (ambos mostradores)
  {
    category: "Bebidas",
    name: "Refresco de vidrio 355ml",
    price: 26,
    emoji: "🥤",
    desc: "Refresco bien frío en botella de vidrio retornable.",
  },
  {
    category: "Bebidas",
    name: "Agua mineral 600ml",
    price: 18,
    emoji: "💧",
    desc: "Agua mineral con gas o natural, botella de 600 ml.",
  },
  // Cocina (comida corrida)
  {
    category: "Cocina",
    name: "Guisado del día con arroz",
    price: 85,
    emoji: "🍛",
    desc: "Comida corrida con guisado del día, arroz, frijoles y tortillas.",
  },
  {
    category: "Cocina",
    name: "Torta de milanesa",
    price: 70,
    emoji: "🥪",
    desc: "Milanesa de pollo crujiente en telera con frijoles, aguacate, jitomate y cebolla.",
  },
  {
    category: "Cocina",
    name: "Quesadillas (2 pzas)",
    price: 55,
    emoji: "🌮",
    desc: "Dos quesadillas de tortilla de harina o maíz con queso derretido; elige tu guiso.",
  },
  {
    category: "Cocina",
    name: "Enchiladas verdes",
    price: 80,
    emoji: "🌯",
    desc: "Tres enchiladas de pollo en salsa verde con crema, queso y cebolla.",
  },
  {
    category: "Cocina",
    name: "Tostadas de tinga",
    price: 65,
    emoji: "🌮",
    desc: "Dos tostadas crujientes con tinga de pollo, crema, queso y aguacate.",
  },
  {
    category: "Cocina",
    name: "Sopa de verduras",
    price: 45,
    emoji: "🥣",
    desc: "Sopa casera de verduras de temporada con caldo de pollo.",
  },
  // Desayunos (food_service)
  {
    category: "Desayunos",
    name: "Molletes",
    price: 60,
    emoji: "🥖",
    desc: "Bolillo partido con frijoles refritos, queso gratinado y pico de gallo.",
  },
  {
    category: "Desayunos",
    name: "Huevos a la mexicana",
    price: 70,
    emoji: "🍳",
    desc: "Huevos revueltos con jitomate, cebolla y chile, con frijoles y tortillas.",
  },
  {
    category: "Desayunos",
    name: "Chilaquiles rojos",
    price: 85,
    emoji: "🌶️",
    desc: "Totopos en salsa roja picante con crema, queso fresco y cebolla.",
  },
  {
    category: "Desayunos",
    name: "Café de olla",
    price: 25,
    emoji: "🫖",
    desc: "Café de olla con piloncillo y canela, servido bien caliente.",
  },
  // Postres
  {
    category: "Postres",
    name: "Gelatina de fresa",
    price: 25,
    emoji: "🍓",
    desc: "Gelatina de fresa fresca con trocitos de fruta.",
  },
  {
    category: "Postres",
    name: "Arroz con leche",
    price: 30,
    emoji: "🍧",
    desc: "Arroz con leche cremoso con canela y pasitas.",
  },
  {
    category: "Postres",
    name: "Pastel de tres leches",
    price: 55,
    emoji: "🍰",
    desc: "Rebanada de pastel de tres leches esponjoso con crema batida.",
  },
]

// Combos (constructor de producto): los items referencian nombres del catálogo.
const HYB_COMBOS: { name: string; price: number; items: [string, number][] }[] = [
  {
    name: "Combo Torta",
    price: 89,
    items: [
      ["Torta de milanesa", 1],
      ["Refresco de vidrio 355ml", 1],
    ],
  },
  {
    name: "Combo Mañanero",
    price: 79,
    items: [
      ["Molletes", 1],
      ["Café de olla", 1],
    ],
  },
  {
    name: "Combo Familiar",
    price: 229,
    items: [
      ["Torta de milanesa", 2],
      ["Refresco de vidrio 355ml", 2],
      ["Gelatina de fresa", 1],
    ],
  },
]

// Mesas del comedor (número, capacidad, posición en el mapa).
const HYB_TABLES: {
  number: number
  capacity: number
  x: number
  y: number
  id: string
  qrToken: string
  room: TableRoomKey
  shape: "round" | "square" | "rectangle" | "booth" | "bar"
  width: number
  height: number
}[] = [
  { number: 1, capacity: 2, x: 1, y: 1, id: "demo-hyb-t1", qrToken: "demo-hyb-qr-t1", room: "principal", shape: "round", width: 72, height: 72 },
  { number: 2, capacity: 2, x: 3, y: 1, id: "demo-hyb-t2", qrToken: "demo-hyb-qr-t2", room: "principal", shape: "round", width: 72, height: 72 },
  { number: 3, capacity: 4, x: 2, y: 2, id: "demo-hyb-t3", qrToken: "demo-hyb-qr-t3", room: "principal", shape: "rectangle", width: 140, height: 72 },
  { number: 4, capacity: 4, x: 2, y: 3, id: "demo-hyb-t4", qrToken: "demo-hyb-qr-t4", room: "principal", shape: "rectangle", width: 140, height: 72 },
]

async function seedHybridDemo(ownerUserId: string, passwordHash: string) {
  const d = prisma
  const rnd = mulberry32(6027)
  const now = Date.now()

  // Cuentas del equipo (owner compartido demo@multi-pos.com)
  const teamUsers = new Map<string, string>()
  teamUsers.set(ownerUserId, "Ana López")
  for (const t of HYB_TEAM) {
    const user = await d.user.upsert({
      where: { email: t.email },
      update: { passwordHash, fullName: t.fullName, isActive: true },
      create: { email: t.email, passwordHash, fullName: t.fullName, isActive: true },
    })
    teamUsers.set(user.id, t.fullName)
  }
  const gerenteId = (await d.user.findUniqueOrThrow({ where: { email: "gerente-hib@demo.multi-pos.com" } })).id
  const cajeroId = (await d.user.findUniqueOrThrow({ where: { email: "cajero-hib@demo.multi-pos.com" } })).id
  const meseroId = (await d.user.findUniqueOrThrow({ where: { email: "mesero-hib@demo.multi-pos.com" } })).id
  const cocinaId = (await d.user.findUniqueOrThrow({ where: { email: "cocina-hib@demo.multi-pos.com" } })).id

  // Organización (hybrid)
  const org = await d.organization.create({
    data: {
      name: HYB_ORG_NAME,
      ownerId: ownerUserId,
      currency: "MXN",
      businessMode: "hybrid",
      pointsPerCurrency: 1,
      pointValue: 0.1,
      loyaltyEnabled: true,
    },
  })

  await d.companyProfile.create({
    data: {
      organizationId: org.id,
      legalName: "Híbrido Demo S.A. de C.V.",
      tradeName: "Híbrido Demo",
      taxId: "HBD000505050",
      city: "Ciudad de México",
      state: "CDMX",
      postalCode: "06700",
      country: "México",
      phone: "5512344444",
      email: "contacto@hibrido.demo",
      website: "https://hibrido.demo",
      ticketFooter: "¡Vuelva pronto!",
    },
  })

  await d.appSettings.create({
    data: {
      organizationId: org.id,
      primaryHue: 340,
      accentHue: 200,
      theme: "system",
      fontFamily: "montserrat",
    },
  })

  await d.deliveryPolicy.create({
    data: {
      organizationId: org.id,
      pickupEnabled: true,
      pickupMinAmount: 0,
      pickupFee: 0,
      pickupFeeEnabled: false,
      deliveryEnabled: true,
      deliveryMinAmount: 100,
      deliveryFee: 25,
      deliveryFeeEnabled: true,
      deliveryRadiusKm: 5,
      deliveryEstimatedMins: 35,
    },
  })

  // Roles de sistema (ids estables de seedProduction)
  const SHARED = {
    owner: "system-owner",
    manager: "system-manager",
    cashier: "system-cashier",
  } as const
  const membership = (userId: string, role: $Enums.OrgRole, roleId: string) =>
    d.membership.create({
      data: { userId, organizationId: org.id, role, roleId },
    })
  await membership(ownerUserId, "owner", SHARED.owner)
  await membership(gerenteId, "manager", SHARED.manager)
  await membership(cajeroId, "cashier", SHARED.cashier)
  // Roles del modo híbrido por roleId (mesero / cocina bajo system-hybrid-*)
  await membership(meseroId, "cashier", "system-hybrid-waiter")
  await membership(cocinaId, "cashier", "system-hybrid-kitchen")

  // Puestos y empleados (login por código de nómina)
  const positions: Record<string, string> = {}
  for (const name of ["Supervisor", "Gerente", "Cajero", "Mesero", "Cocina"]) {
    const p = await d.employeePosition.create({
      data: { organizationId: org.id, name },
    })
    positions[name] = p.id
  }

  const employees: Record<string, string> = {}
  const makeEmployee = async (
    userId: string,
    code: string,
    fullName: string,
    position: string,
    phone: string
  ) => {
    const emp = await d.employee.create({
      data: {
        organizationId: org.id,
        userId,
        employeeCode: code,
        fullName,
        positionId: positions[position],
        phone,
      },
    })
    employees[userId] = emp.id
  }
  await makeEmployee(ownerUserId, "EMP-500", "Ana López", "Supervisor", "5512344400")
  await makeEmployee(gerenteId, "EMP-501", "Claudia Monroy", "Gerente", "5512344401")
  await makeEmployee(cajeroId, "EMP-502", "Hugo Paredes", "Cajero", "5512344402")
  await makeEmployee(meseroId, "EMP-503", "Renata Aguilar", "Mesero", "5512344403")
  await makeEmployee(cocinaId, "EMP-504", "Iván Robles", "Cocina", "5512344404")

  // Sucursal + cajas
  const location = await d.location.create({
    data: {
      organizationId: org.id,
      name: "Matriz",
      code: "LOC-H1",
      latitude: 19.4186,
      longitude: -99.1609,
      address: "Av. Álvaro Obregón 130, Col. Roma Norte, CDMX",
      managerName: "Claudia Monroy",
      allowsPickup: true,
      allowsDelivery: true,
      openingHours: "Lun-Dom 08:00-22:00",
      openingScheduleJson: JSON.stringify(emptySchedule()),
    },
  })
  const registerIds: string[] = []
  for (const [name, prefix] of [
    ["Caja 1", "HC1"],
    ["Caja 2", "HC2"],
  ] as const) {
    const r = await d.cashRegister.create({
      data: { locationId: location.id, organizationId: org.id, name, folioPrefix: prefix },
    })
    registerIds.push(r.id)
  }

  // Unidades del sistema
  const units = await d.unitOfMeasure.findMany({ where: { organizationId: null } })
  const unitPza = units.find((u) => u.abbreviation === "pza")

  // Categorías (retail + food_service)
  const catIds: Record<string, string> = {}
  for (const name of [
    "Despensa",
    "Botanas y dulces",
    "Bebidas",
    "Cocina",
    "Desayunos",
    "Postres",
  ]) {
    const c = await d.category.create({
      data: { organizationId: org.id, name, imageUrl: categoryImageUrl(name) },
    })
    catIds[name] = c.id
  }

  // Productos + variantes + inventario
  const menuVariants: {
    id: string
    productId: string
    productName: string
    price: number
  }[] = []
  const productIdByName = new Map<string, string>()
  const variantByProduct = new Map<string, string>()
  for (let i = 0; i < HYB_PRODUCTS.length; i++) {
    const def = HYB_PRODUCTS[i]
    const product = await d.product.create({
      data: {
        organizationId: org.id,
        categoryId: catIds[def.category],
        name: def.name,
        description: def.desc,
        imageUrl: productImageUrl(def.emoji, def.category),
        taxRate: 0.16,
        trackInventory: true,
        productType: "standard",
        allowSplit: false,
      },
    })
    productIdByName.set(def.name, product.id)
    const variant = await d.productVariant.create({
      data: {
        productId: product.id,
        organizationId: org.id,
        sku: `H-${String(i + 1).padStart(3, "0")}`,
        barcode: `7521${String(i + 1).padStart(8, "0")}`,
        name: "Default",
        price: def.price,
        cost: round2(def.price * 0.4),
      },
    })
    variantByProduct.set(def.name, variant.id)
    menuVariants.push({
      id: variant.id,
      productId: product.id,
      productName: def.name,
      price: def.price,
    })
    await d.inventory.create({
      data: {
        organizationId: org.id,
        variantId: variant.id,
        locationId: location.id,
        locationType: "location",
        quantity: round2(10 + rnd() * 120),
        unitId: unitPza?.id,
        minThreshold: 5,
      },
    })
  }

  // Combos (constructor de producto)
  for (const comboDef of HYB_COMBOS) {
    const combo = await d.productCombo.create({
      data: {
        organizationId: org.id,
        name: comboDef.name,
        description: `Ahorra con ${comboDef.name.toLowerCase()}`,
        comboPrice: comboDef.price,
        isActive: true,
      },
    })
    for (const [itemName, quantity] of comboDef.items) {
      await d.comboItem.create({
        data: {
          comboId: combo.id,
          productId: productIdByName.get(itemName)!,
          variantId: variantByProduct.get(itemName)!,
          quantity,
        },
      })
    }
  }

  // Clientes (portal del cliente)
  const hybCustomers = []
  for (let i = 0; i < HYB_CUSTOMERS.length; i++) {
    const c = HYB_CUSTOMERS[i]
    const email = `hcli-${String(i + 1).padStart(3, "0")}@hibrido.local`
    const user = await d.user.upsert({
      where: { email },
      update: { passwordHash, fullName: c.name, isActive: true },
      create: { email, passwordHash, fullName: c.name, isActive: true },
    })
    const customer = await d.customer.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        customerCode: `HCL-${String(i + 1).padStart(3, "0")}`,
        fullName: c.name,
        phone: c.phone,
        points: round2(rnd() * 300),
      },
    })
    hybCustomers.push(customer)
  }

  // Mesas del comedor (qrToken único para el menú digital: mismo formato
  // que genera /api/tables al crear mesas en producción)
  const tables: Record<string, { id: string; number: number }> = {}
  // Salas del local: el híbrido (fonda-tienda) usa el salón principal.
  const rooms: Partial<Record<TableRoomKey, string>> = {}
  for (const t of HYB_TABLES) {
    // id + qrToken fijos (ver nota en HYB_TABLES): enlaces QR documentados.
    if (!rooms[t.room]) rooms[t.room] = await ensureTableRoom(org.id, location.id, t.room)
    const table = await d.table.create({
      data: {
        id: t.id,
        organizationId: org.id,
        locationId: location.id,
        roomId: rooms[t.room],
        number: t.number,
        name: `Mesa ${t.number}`,
        capacity: t.capacity,
        shape: t.shape,
        width: t.width,
        height: t.height,
        status: "free",
        posX: t.x * 120,
        posY: t.y * 90,
        isActive: true,
        qrToken: t.qrToken,
      },
    })
    tables[t.number] = { id: table.id, number: t.number }
  }

  // Helper de pedidos (líneas + historial + preparación)
  const unitId = unitPza?.id
  const orderItemsData = (names: string[], comment?: string) =>
    names.map((name) => {
      const v = menuVariants.find((m) => m.productName === name)!
      return {
        productId: v.productId,
        variantId: v.id,
        productName: v.productName,
        variantName: "Default",
        productType: "standard" as const,
        quantity: 1,
        unitId,
        unitPrice: v.price,
        lineTotal: v.price,
        comment: comment ?? null,
      }
    })
  const lineTotal = (names: string[]) =>
    round2(
      names.reduce(
        (acc, n) => acc + (menuVariants.find((m) => m.productName === n)?.price ?? 0),
        0
      )
    )
  const statusHistory = async (
    orderId: string,
    statuses: { status: $Enums.OrderStatus; at: Date; by?: string }[]
  ) => {
    for (const s of statuses) {
      await d.orderStatusHistory.create({
        data: {
          orderId,
          status: s.status,
          userId: s.by,
          employeeId: s.by ? employees[s.by] : undefined,
          createdAt: s.at,
        },
      })
    }
  }
  const markPrepared = async (
    orderId: string,
    items: { id: string }[],
    startedAt: Date,
    done: boolean
  ) => {
    const prep = await d.orderPreparation.create({
      data: {
        orderId,
        employeeId: employees[cocinaId],
        startedAt,
        completedAt: done ? new Date(startedAt.getTime() + 10 * 60000) : null,
        elapsedSeconds: done ? 600 : null,
      },
    })
    await d.orderPreparationItem.createMany({
      data: items.map((it) => ({
        preparationId: prep.id,
        orderItemId: it.id,
        scanned: done,
        found: done,
      })),
    })
  }

  const makeOrder = async (input: {
    status: $Enums.OrderStatus
    deliveryMethod: $Enums.DeliveryMethod
    tableId?: string
    customerId?: string
    minutesAgo: number
    names: string[]
    comment?: string
    tip?: number
    address?: string
    deliveryFee?: number
    prepStatus?: "none" | "active" | "done"
  }) => {
    const at = new Date(now - input.minutesAgo * 60000)
    const subtotal = lineTotal(input.names)
    const discount = 0
    const total = round2(subtotal * 1.16)
    const order = await d.order.create({
      data: {
        organizationId: org.id,
        locationId: location.id,
        customerId: input.customerId,
        tableId: input.tableId,
        status: input.status,
        deliveryMethod: input.deliveryMethod,
        subtotal,
        discount,
        total,
        tip: input.tip ?? null,
        address: input.address ?? null,
        deliveryFee: input.deliveryFee ?? 0,
        createdAt: at,
        updatedAt: at,
        paidAt:
          input.status === "delivered" || input.status === "ready"
            ? at
            : null,
        items: { create: orderItemsData(input.names, input.comment) },
      },
      include: { items: true },
    })

    // Historial de estados hasta el estado actual
    const flow: $Enums.OrderStatus[] = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "delivered",
    ]
    const idx = flow.indexOf(input.status)
    const steps: { status: $Enums.OrderStatus; at: Date; by?: string }[] = []
    for (let s = 0; s <= Math.max(idx, 0); s++) {
      const st = flow[s]
      const isKitchen = st === "preparing" || st === "ready"
      steps.push({
        status: st,
        at: new Date(at.getTime() + s * 4 * 60000),
        by: st === "confirmed" ? meseroId : isKitchen ? cocinaId : meseroId,
      })
    }
    if (input.status === "cancelled") {
      steps.push({ status: "cancelled", at: new Date(at.getTime() + 10 * 60000), by: meseroId })
    }
    await statusHistory(order.id, steps)

    // Preparación (KDS)
    if (input.prepStatus && input.prepStatus !== "none") {
      await markPrepared(
        order.id,
        order.items,
        new Date(at.getTime() + 4 * 60000),
        input.prepStatus === "done"
      )
    }
    return order
  }

  // ── Pedidos en curso (KDS + Mesas) ──────────────────────────────────────
  // Mesa 1: ocupada con pedido en preparación (cocina híbrida)
  await d.table.update({ where: { id: tables[1].id }, data: { status: "occupied" } })
  await d.tableSession.create({
    data: {
      tableId: tables[1].id,
      startedAt: new Date(now - 20 * 60000),
      notes: "Comensal en mesa",
    },
  })
  const t1Order = await makeOrder({
    status: "preparing",
    deliveryMethod: "pickup",
    tableId: tables[1].id,
    minutesAgo: 12,
    names: ["Guisado del día con arroz", "Refresco de vidrio 355ml", "Gelatina de fresa"],
    comment: "Poco picante",
    prepStatus: "active",
  })
  await d.tableSession.updateMany({
    where: { tableId: tables[1].id, endedAt: null },
    data: { orderId: t1Order.id },
  })

  // Mesa 2: ocupada, pedido confirmado (aún no en cocina)
  await d.table.update({ where: { id: tables[2].id }, data: { status: "occupied" } })
  await d.tableSession.create({
    data: {
      tableId: tables[2].id,
      startedAt: new Date(now - 12 * 60000),
    },
  })
  const t2Order = await makeOrder({
    status: "confirmed",
    deliveryMethod: "pickup",
    tableId: tables[2].id,
    minutesAgo: 6,
    names: ["Torta de milanesa", "Agua mineral 600ml"],
    comment: "Pan tostado",
    prepStatus: "none",
  })
  await d.tableSession.updateMany({
    where: { tableId: tables[2].id, endedAt: null },
    data: { orderId: t2Order.id },
  })

  // Mesa 3: ocupada, pedido recién tomado
  await d.table.update({ where: { id: tables[3].id }, data: { status: "occupied" } })
  await d.tableSession.create({
    data: { tableId: tables[3].id, startedAt: new Date(now - 5 * 60000) },
  })
  const t3Order = await makeOrder({
    status: "pending",
    deliveryMethod: "pickup",
    tableId: tables[3].id,
    minutesAgo: 2,
    names: ["Enchiladas verdes", "Café de olla"],
    prepStatus: "none",
  })
  await d.tableSession.updateMany({
    where: { tableId: tables[3].id, endedAt: null },
    data: { orderId: t3Order.id },
  })

  // Mesa 4: reservada
  await d.table.update({ where: { id: tables[4].id }, data: { status: "reserved" } })

  // Delivery y pickup en curso (portal del cliente)
  await makeOrder({
    status: "preparing",
    deliveryMethod: "delivery",
    customerId: hybCustomers[0].id,
    minutesAgo: 18,
    names: ["Torta de milanesa", "Refresco de vidrio 355ml", "Gelatina de fresa"],
    address: "Calle Córdoba 210, Col. Roma Norte, CDMX",
    deliveryFee: 25,
    comment: "Toca el timbre",
    prepStatus: "active",
  })
  await makeOrder({
    status: "pending",
    deliveryMethod: "pickup",
    customerId: hybCustomers[1].id,
    minutesAgo: 4,
    names: ["Papas fritas 45g", "Refresco de vidrio 355ml", "Cacahuate garapiñado"],
    prepStatus: "none",
  })

  // ── Historial de pedidos recientes ──────────────────────────────────────
  await makeOrder({
    status: "ready",
    deliveryMethod: "pickup",
    customerId: hybCustomers[2].id,
    minutesAgo: 26 * 60,
    names: ["Molletes", "Café de olla"],
    prepStatus: "done",
  })
  await makeOrder({
    status: "delivered",
    deliveryMethod: "delivery",
    customerId: hybCustomers[3].id,
    minutesAgo: 27 * 60,
    names: ["Chilaquiles rojos", "Agua mineral 600ml"],
    address: "Av. Sonora 340, Col. Roma Norte, CDMX",
    deliveryFee: 25,
    tip: 20,
    prepStatus: "done",
  })
  await makeOrder({
    status: "cancelled",
    deliveryMethod: "pickup",
    customerId: hybCustomers[4].id,
    minutesAgo: 30 * 60,
    names: ["Pastel de tres leches"],
    comment: "Cancelado por el cliente",
    prepStatus: "none",
  })

  // ── Ventas históricas (12: anaquel y cocina) ─────────────────────────────
  const cashiers = [cajeroId, gerenteId, ownerUserId]
  let saleSeq = 0
  for (let s = 0; s < 12; s++) {
    saleSeq += 1
    const reg = registerIds[s % registerIds.length]
    const cashier = cashiers[Math.floor(rnd() * cashiers.length)]
    const customer = rnd() < 0.65 ? pick(hybCustomers, rnd) : null
    const saleDate = new Date(now - Math.floor(rnd() * 25) * 86400000)
    saleDate.setHours(9 + Math.floor(rnd() * 12), Math.floor(rnd() * 60), 0, 0)

    const itemCount = 1 + Math.floor(rnd() * 4)
    const itemNames = []
    for (let k = 0; k < itemCount; k++) {
      itemNames.push(pick(menuVariants, rnd).productName)
    }
    const sub = lineTotal(itemNames)
    const hasDiscount = rnd() < 0.2
    const discount = hasDiscount ? round2(sub * 0.1) : 0
    const tax = round2((sub - discount) * 0.16)
    const total = round2(sub - discount + tax)
    const tip = rnd() < 0.4 ? round2(total * 0.1) : 0
    const sale = await d.sale.create({
      data: {
        organizationId: org.id,
        locationId: location.id,
        cashRegisterId: reg,
        cashierId: cashier,
        employeeId: employees[cashier],
        customerId: customer?.id,
        locationSaleNumber: BigInt(saleSeq),
        subtotal: sub,
        discount,
        tax,
        total,
        tip,
        pointsEarned: customer ? round2(total) : 0,
        status: "completed",
        notes: hasDiscount ? "Descuento de cortesía" : null,
        createdAt: saleDate,
        items: {
          create: itemNames.map((n) => {
            const v = menuVariants.find((m) => m.productName === n)!
            return {
              productId: v.productId,
              variantId: v.id,
              productName: v.productName,
              variantName: "Default",
              productType: "standard" as const,
              quantity: 1,
              unitId,
              unitPrice: v.price,
              totalPrice: v.price,
              lineTotal: v.price,
            }
          }),
        },
      },
    })
    await d.salePayment.create({
      data: {
        saleId: sale.id,
        method: rnd() < 0.55 ? "cash" : "card",
        amount: round2(total + tip),
      },
    })
    if (customer) {
      await d.loyaltyTransaction.create({
        data: {
          organizationId: org.id,
          customerId: customer.id,
          saleId: sale.id,
          kind: "earn",
          points: round2(total),
          note: `Venta ${saleSeq}`,
        },
      })
    }
  }
  await d.location.update({
    where: { id: location.id },
    data: { saleSeq: BigInt(saleSeq) },
  })

  // Notificaciones y publicaciones de ejemplo
  await d.notification.createMany({
    data: [
      {
        organizationId: org.id,
        userId: cocinaId,
        kind: "new_order",
        title: "Pedido en espera en cocina",
        body: "La mesa 1 tiene un pedido por preparar.",
        severity: "info",
        link: "/kds",
      },
      {
        organizationId: org.id,
        userId: ownerUserId,
        kind: "new_order",
        title: "Nuevo pedido para entrega",
        body: "Un cliente pidió el Combo Torta a domicilio.",
        severity: "success",
        link: "/admin/orders",
      },
    ],
  })
  await d.publication.createMany({
    data: [
      {
        organizationId: org.id,
        title: "Combo Familiar por $229",
        content:
          "2 tortas de milanesa, 2 refrescos y gelatina por solo $229.",
        type: "promotion",
        isActive: true,
        publishedAt: new Date(now - 3 * 86400000),
      },
      {
        organizationId: org.id,
        title: "Aviso: guisos del día",
        content: "Pregunta por el guisado del día, cambia todos los días.",
        type: "notice",
        isActive: true,
        publishedAt: new Date(now - 8 * 86400000),
      },
    ],
  })

  return {
    org,
    teamUsers,
    location,
    registerIds,
    tables,
    customers: hybCustomers,
    employees,
    users: { gerenteId, cajeroId, meseroId, cocinaId },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verticales services / rental (Estética Demo y Fiestas Demo)
// ─────────────────────────────────────────────────────────────────────────────
// Ambos modos comparten hoy el mismo flujo operativo: catálogo + ventas de
// caja (las agendas de citas/reservaciones están marcadas como "próximamente"
// en src/lib/business-modes.ts, aún sin modelos). Un solo constructor
// data-driven evita duplicar el bloque de creación; el config por organización
// lleva el equipo (con el rol del modo por roleId), catálogo, clientes del
// portal y parámetros de venta.

type VerticalMember = {
  email: string
  fullName: string
  phone: string
  /** Rol enum de respaldo (se conserva como fallback, igual que el restaurante). */
  role: $Enums.OrgRole
  /** roleId del rol de sistema del modo (agente de atención / de renta). */
  roleId?: string
  /** Puesto de nómina dentro de la organización. */
  position: string
  /** true → empleado de nómina sin acceso al panel (no se crea membership). */
  staffOnly?: boolean
}

type VerticalProduct = {
  category: string
  name: string
  price: number
  /** Emoji ilustrativo para la imagen placeholder del catálogo. */
  emoji: string
  /** Descripción corta para el catálogo del POS y el portal del cliente. */
  desc: string
  /** false = servicio puro (sin control de inventario). */
  trackInventory?: boolean
}

type VerticalSeed = {
  name: string
  mode: "services" | "rental"
  legalName: string
  tradeName: string
  taxId: string
  phone: string
  email: string
  website: string
  ticketFooter: string
  address: string
  lat: number
  lng: number
  primaryHue: number
  accentHue: number
  rndSeed: number
  /** Folio inicial de empleados (mantiene un rango de códigos por organización). */
  empCodeStart: number
  locationCode: string
  positions: string[]
  /** Miembros adicionales al owner compartido demo@multi-pos.com. */
  team: VerticalMember[]
  categories: string[]
  products: VerticalProduct[]
  customers: { name: string; phone: string }[]
  /** Prefijo de correo y dominio de los clientes del portal (ecli-001@…). */
  customerEmailPrefix: string
  customerDomain: string
  customerCodePrefix: string
  delivery: {
    enabled: boolean
    fee?: number
    minAmount?: number
    radiusKm?: number
    estimatedMins?: number
  }
  registers: string[]
  salesCount: number
  salesDaysBack: number
  publications: {
    title: string
    content: string
    type: $Enums.PublicationType
    daysAgo: number
  }[]
  /** Agenda de citas (services): empleado (por email) → servicios que presta. */
  staffServices?: {
    email: string
    services: { name: string; durationMin: number }[]
  }[]
}

// Correos de clientes del portal derivados del config (fuente única para la
// limpieza idempotente y para la creación en seedVerticalOrgDemo).
const customerEmails = (s: VerticalSeed) =>
  s.customers.map(
    (_, i) =>
      `${s.customerEmailPrefix}-${String(i + 1).padStart(3, "0")}@${s.customerDomain}`
  )

// ── Estética Demo (services) ────────────────────────────────────────────────
// Salón de belleza: servicios sin inventario + productos retail. El rol del
// modo (Agente de atención) se asigna por roleId system-services-attendant.
const ESTETICA_SEED: VerticalSeed = {
  name: EST_ORG_NAME,
  mode: "services",
  legalName: "Estética Demo S.A. de C.V.",
  tradeName: "Estética Demo",
  taxId: "ESD000303030",
  phone: "5512342222",
  email: "contacto@estetica.demo",
  website: "https://estetica.demo",
  ticketFooter: "¡Gracias por tu visita!",
  address: "Av. Universidad 880, Col. Del Valle, CDMX",
  lat: 19.3846,
  lng: -99.1632,
  primaryHue: 280,
  accentHue: 320,
  rndSeed: 5011,
  empCodeStart: 300,
  locationCode: "LOC-E1",
  positions: [
    "Supervisor",
    "Gerente",
    "Cajero",
    "Atención a clientes",
    "Estilista",
  ],
  team: [
    {
      email: "gerente-est@demo.multi-pos.com",
      fullName: "Ximena Castro",
      phone: "5512342221",
      role: "manager",
      position: "Gerente",
    },
    {
      email: "cajero-est@demo.multi-pos.com",
      fullName: "Fernando Gil",
      phone: "5512342222",
      role: "cashier",
      position: "Cajero",
    },
    {
      email: "agente-est@demo.multi-pos.com",
      fullName: "Daniela Ortiz",
      phone: "5512342223",
      role: "cashier",
      roleId: "system-services-attendant",
      position: "Atención a clientes",
    },
    // Estilistas: personal de nómina sin acceso al panel (para la futura
    // asignación de citas), por eso staffOnly.
    {
      email: "estilista1-est@demo.multi-pos.com",
      fullName: "Mariana Soto",
      phone: "5512342224",
      role: "cashier",
      position: "Estilista",
      staffOnly: true,
    },
    {
      email: "estilista2-est@demo.multi-pos.com",
      fullName: "Paola Reyes",
      phone: "5512342225",
      role: "cashier",
      position: "Estilista",
      staffOnly: true,
    },
  ],
  categories: [
    "Cortes",
    "Color",
    "Manicure y Pedicure",
    "Tratamientos",
    "Maquillaje y Peinado",
    "Productos",
  ],
  products: [
    // Cortes (servicio)
    { category: "Cortes", name: "Corte de cabello mujer", price: 180, emoji: "💇‍♀️", desc: "Corte personalizado con lavado y asesoría de estilo según tu tipo de cabello.", trackInventory: false },
    { category: "Cortes", name: "Corte de cabello hombre", price: 150, emoji: "💈", desc: "Corte clásico o degradado con lavado y arreglo de contornos.", trackInventory: false },
    { category: "Cortes", name: "Corte infantil", price: 130, emoji: "🧒", desc: "Corte a medida para los peques, con paciencia y mucho estilo.", trackInventory: false },
    { category: "Cortes", name: "Corte y barba", price: 210, emoji: "🧔", desc: "Corte más perfilado de barba con toalla caliente y bálsamo hidratante.", trackInventory: false },
    // Color (servicio)
    { category: "Color", name: "Tinte completo", price: 450, emoji: "🎨", desc: "Color uniforme de raíz a puntas con productos profesionales y sellado de brillo.", trackInventory: false },
    { category: "Color", name: "Baño de color", price: 280, emoji: "🌈", desc: "Baño de color semipermanente que reaviva el tono y da brillo espejo.", trackInventory: false },
    { category: "Color", name: "Reflejos y mechas", price: 560, emoji: "✨", desc: "Mechas californianas o babylights para dar luz y dimensión a tu cabello.", trackInventory: false },
    { category: "Color", name: "Retoque de raíz", price: 220, emoji: "🌱", desc: "Retoca y unifica el color de la raíz para un acabado fresco entre tintes.", trackInventory: false },
    // Manicure y Pedicure (servicio)
    { category: "Manicure y Pedicure", name: "Manicure clásico", price: 120, emoji: "💅", desc: "Limpieza, corte y esmaltado tradicional con el color que elijas.", trackInventory: false },
    { category: "Manicure y Pedicure", name: "Manicure en gel", price: 200, emoji: "💎", desc: "Esmaltado semipermanente en gel con secado en lámpara y brillo de larga duración.", trackInventory: false },
    { category: "Manicure y Pedicure", name: "Pedicure clásico", price: 160, emoji: "🦶", desc: "Cuidado completo de pies: exfoliación, limpieza y esmaltado al detalle.", trackInventory: false },
    { category: "Manicure y Pedicure", name: "Pedicure spa", price: 260, emoji: "🛁", desc: "Remojo relajante, exfoliación con sales y masaje, terminado con esmaltado.", trackInventory: false },
    { category: "Manicure y Pedicure", name: "Uñas acrílicas", price: 380, emoji: "🌟", desc: "Extensión de uñas en acrílico con el largo y diseño que quieras lucir.", trackInventory: false },
    // Tratamientos (servicio)
    { category: "Tratamientos", name: "Limpieza facial profunda", price: 400, emoji: "🧖‍♀️", desc: "Limpieza de poros, extracción suave y mascarilla para una piel renovada.", trackInventory: false },
    { category: "Tratamientos", name: "Exfoliación corporal", price: 450, emoji: "🌿", desc: "Exfoliación con sales y aceites que deja la piel suave e hidratada.", trackInventory: false },
    { category: "Tratamientos", name: "Mascarilla capilar", price: 180, emoji: "🧴", desc: "Tratamiento de hidratación profunda que repara y da suavidad al cabello.", trackInventory: false },
    { category: "Tratamientos", name: "Masaje relajante", price: 550, emoji: "💆‍♀️", desc: "Masaje de cuerpo completo con presión suave para liberar tensión y estrés.", trackInventory: false },
    // Maquillaje y Peinado (servicio)
    { category: "Maquillaje y Peinado", name: "Maquillaje social", price: 420, emoji: "💄", desc: "Maquillaje profesional para fiestas y eventos, con productos de larga duración.", trackInventory: false },
    { category: "Maquillaje y Peinado", name: "Maquillaje de novia", price: 950, emoji: "👰", desc: "Maquillaje de novia con prueba previa, acabado HD y retoque el día del evento.", trackInventory: false },
    { category: "Maquillaje y Peinado", name: "Peinado para evento", price: 300, emoji: "🎀", desc: "Recogidos, ondas o trenzas diseñadas para acompañar tu look del evento.", trackInventory: false },
    { category: "Maquillaje y Peinado", name: "Peinado de novia", price: 650, emoji: "💍", desc: "Peinado de novia con prueba previa y fijación de larga duración.", trackInventory: false },
    // Productos (retail, con inventario)
    { category: "Productos", name: "Shampoo profesional", price: 190, emoji: "🧴", desc: "Shampoo de uso profesional para limpieza profunda sin resecar el cabello." },
    { category: "Productos", name: "Acondicionador profesional", price: 190, emoji: "🫧", desc: "Acondicionador que desenreda y da suavidad desde la mitad a las puntas." },
    { category: "Productos", name: "Mascarilla capilar profesional", price: 210, emoji: "🥣", desc: "Mascarilla de tratamiento intensivo para cabello dañado o teñido." },
    { category: "Productos", name: "Aceite de argán", price: 160, emoji: "🧪", desc: "Aceite de argán puro que nutre puntas y aporta brillo sin dejar grasa." },
    { category: "Productos", name: "Spray fijador", price: 150, emoji: "💨", desc: "Spray de fijación flexible que mantiene el peinado sin apelmazar." },
  ],
  customers: [
    { name: "Mónica Delgado", phone: "5500112233" },
    { name: "Andrea Molina", phone: "5500223344" },
    { name: "Karla Suárez", phone: "5500334455" },
    { name: "Gabriela Ríos", phone: "5500445566" },
    { name: "Luis Navarro", phone: "5500556677" },
    { name: "Renata Vega", phone: "5500667788" },
  ],
  customerEmailPrefix: "ecli",
  customerDomain: "estetica.local",
  customerCodePrefix: "CLI-",
  delivery: { enabled: false },
  registers: ["Caja 1"],
  salesCount: 30,
  salesDaysBack: 45,
  // Agenda de citas: las estilistas prestan servicios con su duración.
  staffServices: [
    {
      email: "estilista1-est@demo.multi-pos.com",
      services: [
        { name: "Corte de cabello mujer", durationMin: 45 },
        { name: "Corte de cabello hombre", durationMin: 30 },
        { name: "Corte infantil", durationMin: 30 },
        { name: "Corte y barba", durationMin: 40 },
        { name: "Tinte completo", durationMin: 90 },
        { name: "Baño de color", durationMin: 60 },
        { name: "Retoque de raíz", durationMin: 50 },
        { name: "Mascarilla capilar", durationMin: 30 },
        { name: "Masaje relajante", durationMin: 60 },
      ],
    },
    {
      email: "estilista2-est@demo.multi-pos.com",
      services: [
        { name: "Manicure clásico", durationMin: 40 },
        { name: "Manicure en gel", durationMin: 60 },
        { name: "Pedicure clásico", durationMin: 45 },
        { name: "Pedicure spa", durationMin: 70 },
        { name: "Uñas acrílicas", durationMin: 90 },
        { name: "Reflejos y mechas", durationMin: 120 },
        { name: "Limpieza facial profunda", durationMin: 60 },
        { name: "Maquillaje social", durationMin: 45 },
        { name: "Maquillaje de novia", durationMin: 90 },
        { name: "Peinado para evento", durationMin: 40 },
        { name: "Peinado de novia", durationMin: 60 },
      ],
    },
  ],
  publications: [
    {
      title: "Mes de la belleza",
      content: "20% de descuento en tintes y baños de color durante septiembre.",
      type: "promotion",
      daysAgo: 4,
    },
    {
      title: "Nueva línea de productos",
      content:
        "Shampoo, acondicionador y mascarillas profesionales ya disponibles en mostrador.",
      type: "product_new",
      daysAgo: 9,
    },
  ],
}

// ── Fiestas Demo (rental) ──────────────────────────────────────────────────
// Renta de artículos para fiestas: brincolines, mobiliario, fotocabina y
// audio por unidad (inventario = unidades disponibles). El rol del modo
// (Agente de renta) se asigna por roleId system-rental-agent.
const FIESTAS_SEED: VerticalSeed = {
  name: FIE_ORG_NAME,
  mode: "rental",
  legalName: "Fiestas Demo S.A. de C.V.",
  tradeName: "Fiestas Demo",
  taxId: "FID000404040",
  phone: "5512343333",
  email: "contacto@fiestas.demo",
  website: "https://fiestas.demo",
  ticketFooter: "¡Gracias por tu preferencia!",
  address: "Av. Tláhuac 1200, Col. Santa Úrsula, CDMX",
  lat: 19.3119,
  lng: -99.0664,
  primaryHue: 210,
  accentHue: 190,
  rndSeed: 6023,
  empCodeStart: 400,
  locationCode: "LOC-F1",
  positions: [
    "Supervisor",
    "Gerente",
    "Cajero",
    "Agente de renta",
    "Operador",
  ],
  team: [
    {
      email: "gerente-fie@demo.multi-pos.com",
      fullName: "Héctor Aguilar",
      phone: "5512343331",
      role: "manager",
      position: "Gerente",
    },
    {
      email: "cajero-fie@demo.multi-pos.com",
      fullName: "Brenda Navarro",
      phone: "5512343332",
      role: "cashier",
      position: "Cajero",
    },
    {
      email: "agente-fie@demo.multi-pos.com",
      fullName: "Eduardo Lara",
      phone: "5512343333",
      role: "cashier",
      roleId: "system-rental-agent",
      position: "Agente de renta",
    },
    // Operador: instala/recoge los artículos; nómina sin acceso al panel.
    {
      email: "operador-fie@demo.multi-pos.com",
      fullName: "Javier Méndez",
      phone: "5512343334",
      role: "cashier",
      position: "Operador",
      staffOnly: true,
    },
  ],
  categories: [
    "Brincolines",
    "Mobiliario y Carpas",
    "Fotografía",
    "Audio e Iluminación",
    "Juegos y Extras",
  ],
  products: [
    // Brincolines
    { category: "Brincolines", name: "Brincolín castillo 3x3 m", price: 650, emoji: "🏰", desc: "Inflable tipo castillo con paredes altas y red de seguridad, para hasta 6 niños." },
    { category: "Brincolines", name: "Brincolín resbaladilla 4 m", price: 750, emoji: "🛝", desc: "Brincolín con resbaladilla integrada de 4 metros, el favorito de las fiestas." },
    { category: "Brincolines", name: "Brincolín futbol", price: 700, emoji: "⚽", desc: "Inflable con porterías y balones incluidos para torneos dentro del brincolín." },
    { category: "Brincolines", name: "Brincolín combinado", price: 950, emoji: "🎪", desc: "Cajón, resbaladilla y obstáculos en un solo inflable para diversión larga." },
    { category: "Brincolines", name: "Brincolín casa de muñecas", price: 850, emoji: "🏠", desc: "Inflable temático con casita de muñecas, ideal para fiestas infantiles." },
    // Mobiliario y Carpas
    { category: "Mobiliario y Carpas", name: "Mesa plegable", price: 90, emoji: "🪑", desc: "Mesa rectangular plegable para 8 personas, resistente y fácil de trasladar." },
    { category: "Mobiliario y Carpas", name: "Silla plegable", price: 15, emoji: "🪑", desc: "Silla plegable de plástico reforzado, cómoda y lista para cualquier evento." },
    { category: "Mobiliario y Carpas", name: "Mantelería por mesa", price: 60, emoji: "🍽️", desc: "Manteles de tela en colores a juego con el tema de tu fiesta." },
    { category: "Mobiliario y Carpas", name: "Carpa 3x3 m", price: 380, emoji: "⛺", desc: "Carpa impermeable de 3x3 m con armazón de acero, ideal para tomar el sol." },
    { category: "Mobiliario y Carpas", name: "Carpa 6x6 m", price: 900, emoji: "⛺", desc: "Carpa de 6x6 m para proteger a tus invitados del sol o la lluvia." },
    { category: "Mobiliario y Carpas", name: "Pista de baile 3x3 m", price: 650, emoji: "🕺", desc: "Piso modular tipo hardwood para montar la pista de baile en cualquier jardín." },
    // Fotografía
    { category: "Fotografía", name: "Fotocabina clásica", price: 900, emoji: "📸", desc: "Cabina de fotos con impresión al instante, accesorios y operador incluido." },
    { category: "Fotografía", name: "Fotocabina 360", price: 1300, emoji: "🎥", desc: "Cabina giratoria 360° para videos espectaculares que se comparten al momento." },
    { category: "Fotografía", name: "Rincón de fotos con props", price: 300, emoji: "🎭", desc: "Fondo decorativo con marcos, sombreros y props para fotos grupales." },
    // Audio e Iluminación
    { category: "Audio e Iluminación", name: "Bocina profesional c/ micrófono", price: 550, emoji: "🎤", desc: "Bocina potente con micrófono inalámbrico para música y animación del evento." },
    { category: "Audio e Iluminación", name: "Bocina DJ doble", price: 950, emoji: "🔊", desc: "Sistema de audio doble con bajos potentes, ideal para fiestas grandes." },
    { category: "Audio e Iluminación", name: "Kit de iluminación LED", price: 400, emoji: "💡", desc: "Reflector LED multicolor con efectos sincronizados al ritmo de la música." },
    { category: "Audio e Iluminación", name: "Máquina de humo", price: 300, emoji: "🌫️", desc: "Máquina de humo para dar ambiente a la pista de baile y las fotos." },
    // Juegos y Extras
    { category: "Juegos y Extras", name: "Fuente de chocolate", price: 450, emoji: "🍫", desc: "Fuente de chocolate con frutas y marshmallows para acompañar durante 2 horas." },
    { category: "Juegos y Extras", name: "Máquina de algodón de azúcar", price: 500, emoji: "🍬", desc: "Máquina de algodón de azúcar con operador y refacciones ilimitadas." },
    { category: "Juegos y Extras", name: "Máquina de palomitas", price: 350, emoji: "🍿", desc: "Carrito de palomitas recién hechas, con bolsas para servir a los invitados." },
    { category: "Juegos y Extras", name: "Mini golf inflable", price: 800, emoji: "⛳", desc: "Circuito de mini golf inflable de 6 hoyos con palos y pelotas incluidos." },
  ],
  customers: [
    { name: "Fernanda Lima", phone: "5577990011" },
    { name: "Ricardo Maldonado", phone: "5577881122" },
    { name: "Estefanía Ortega", phone: "5577772233" },
    { name: "Daniel Roldán", phone: "5577663344" },
    { name: "Valeria Guzmán", phone: "5577554455" },
    { name: "Oscar Ibáñez", phone: "5577445566" },
  ],
  customerEmailPrefix: "fcli",
  customerDomain: "fiestas.local",
  customerCodePrefix: "CLI-",
  delivery: { enabled: true, fee: 150, minAmount: 0, radiusKm: 25, estimatedMins: 90 },
  registers: ["Caja 1", "Caja 2"],
  salesCount: 30,
  salesDaysBack: 60,
  publications: [
    {
      title: "Paquete fiesta completa",
      content:
        "Brincolín + fotocabina + sonido con precio especial entre semana.",
      type: "promotion",
      daysAgo: 3,
    },
    {
      title: "Alta temporada",
      content:
        "Reserva con al menos 2 semanas de anticipación para fines de semana.",
      type: "notice",
      daysAgo: 12,
    },
  ],
}

// Rol de sistema compartido según el enum (fallback para memberships).
const sharedSystemRoleId = (role: $Enums.OrgRole): string | null => {
  if (role === "owner") return "system-owner"
  if (role === "admin") return "system-admin"
  if (role === "manager") return "system-manager"
  if (role === "cashier") return "system-cashier"
  return null
}

/**
 * Constructor data-driven de una organización de servicios/renta:
 * org con su businessMode, equipo con memberships por roleId (incluido el rol
 * del modo), empleados, sucursal, catálogo + inventario, clientes del portal
 * y ventas históricas para que dashboards/reportes no arranquen vacíos.
 */
async function seedVerticalOrgDemo(
  ownerUserId: string,
  passwordHash: string,
  cfg: VerticalSeed
) {
  const d = prisma
  const rnd = mulberry32(cfg.rndSeed)
  const now = Date.now()

  // Cuentas del equipo (owner compartido demo@multi-pos.com)
  const teamAccounts: { m: VerticalMember; user: { id: string } }[] = []
  for (const m of cfg.team) {
    const user = await d.user.upsert({
      where: { email: m.email },
      update: { passwordHash, fullName: m.fullName, isActive: true },
      create: {
        email: m.email,
        passwordHash,
        fullName: m.fullName,
        isActive: true,
      },
    })
    teamAccounts.push({ m, user })
  }

  // Organización (services / rental)
  const org = await d.organization.create({
    data: {
      name: cfg.name,
      ownerId: ownerUserId,
      currency: "MXN",
      businessMode: cfg.mode,
      pointsPerCurrency: 1,
      pointValue: 0.1,
      loyaltyEnabled: true,
    },
  })

  await d.companyProfile.create({
    data: {
      organizationId: org.id,
      legalName: cfg.legalName,
      tradeName: cfg.tradeName,
      taxId: cfg.taxId,
      city: "Ciudad de México",
      state: "CDMX",
      postalCode: "06700",
      country: "México",
      phone: cfg.phone,
      email: cfg.email,
      website: cfg.website,
      ticketFooter: cfg.ticketFooter,
    },
  })

  await d.appSettings.create({
    data: {
      organizationId: org.id,
      primaryHue: cfg.primaryHue,
      accentHue: cfg.accentHue,
      theme: "system",
      fontFamily: "montserrat",
    },
  })

  await d.deliveryPolicy.create({
    data: {
      organizationId: org.id,
      pickupEnabled: true,
      pickupMinAmount: 0,
      pickupFee: 0,
      pickupFeeEnabled: false,
      deliveryEnabled: cfg.delivery.enabled,
      deliveryMinAmount: cfg.delivery.minAmount ?? 0,
      deliveryFee: cfg.delivery.fee ?? 0,
      deliveryFeeEnabled: cfg.delivery.enabled,
      deliveryRadiusKm: cfg.delivery.radiusKm ?? null,
      deliveryEstimatedMins: cfg.delivery.estimatedMins ?? null,
    },
  })

  // Memberships: owner compartido + equipo (el agente del modo vía roleId)
  const membership = (userId: string, role: $Enums.OrgRole, roleId?: string) =>
    d.membership.create({
      data: {
        userId,
        organizationId: org.id,
        role,
        roleId: roleId ?? sharedSystemRoleId(role),
      },
    })
  await membership(ownerUserId, "owner")
  for (const { m, user } of teamAccounts) {
    if (!m.staffOnly) await membership(user.id, m.role, m.roleId)
  }

  // Puestos y empleados (owner = Supervisor del primer código del rango)
  const positions: Record<string, string> = {}
  for (const name of cfg.positions) {
    const p = await d.employeePosition.create({
      data: { organizationId: org.id, name },
    })
    positions[name] = p.id
  }

  const employeeByUser = new Map<string, string>()
  const makeEmployee = async (
    userId: string,
    code: string,
    fullName: string,
    position: string,
    phone: string
  ) => {
    const emp = await d.employee.create({
      data: {
        organizationId: org.id,
        userId,
        employeeCode: code,
        fullName,
        positionId: positions[position],
        phone,
      },
    })
    employeeByUser.set(userId, emp.id)
  }
  await makeEmployee(
    ownerUserId,
    `EMP-${cfg.empCodeStart}`,
    "Ana López",
    "Supervisor",
    cfg.phone
  )
  for (let i = 0; i < teamAccounts.length; i++) {
    const { m, user } = teamAccounts[i]
    await makeEmployee(
      user.id,
      `EMP-${cfg.empCodeStart + i + 1}`,
      m.fullName,
      m.position,
      m.phone
    )
  }

  // Sucursal + cajas
  const location = await d.location.create({
    data: {
      organizationId: org.id,
      name: "Matriz",
      code: cfg.locationCode,
      latitude: cfg.lat,
      longitude: cfg.lng,
      address: cfg.address,
      managerName: "Ana López",
      allowsPickup: true,
      allowsDelivery: cfg.delivery.enabled,
      openingHours: "Lun-Sáb 09:00-18:00",
      openingScheduleJson: JSON.stringify(emptySchedule()),
    },
  })
  const registerIds: string[] = []
  for (const name of cfg.registers) {
    const r = await d.cashRegister.create({
      data: {
        locationId: location.id,
        organizationId: org.id,
        name,
        folioPrefix: name.replace(" ", ""),
      },
    })
    registerIds.push(r.id)
  }

  // Unidades del sistema
  const units = await d.unitOfMeasure.findMany({ where: { organizationId: null } })
  const unitPza = units.find((u) => u.abbreviation === "pza")

  // Categorías (con imagen placeholder propia para chips/tarjetas del catálogo)
  const catIds: Record<string, string> = {}
  for (const name of cfg.categories) {
    const c = await d.category.create({
      data: { organizationId: org.id, name, imageUrl: categoryImageUrl(name) },
    })
    catIds[name] = c.id
  }

  // Productos + variantes + inventario (solo si controlan existencias)
  const variants: {
    id: string
    productId: string
    productName: string
    price: number
  }[] = []
  for (let i = 0; i < cfg.products.length; i++) {
    const def = cfg.products[i]
    const trackInventory = def.trackInventory ?? true
    const product = await d.product.create({
      data: {
        organizationId: org.id,
        categoryId: catIds[def.category],
        name: def.name,
        description: def.desc,
        imageUrl: productImageUrl(def.emoji, def.category),
        taxRate: 0.16,
        trackInventory,
        productType: "standard",
        allowSplit: false,
      },
    })
    const variant = await d.productVariant.create({
      data: {
        productId: product.id,
        organizationId: org.id,
        sku: `${cfg.mode === "rental" ? "FIE" : "EST"}-${String(i + 1).padStart(3, "0")}`,
        barcode: `7520${String(i + 1).padStart(8, "0")}`,
        name: "Default",
        price: def.price,
        cost: round2(def.price * 0.4),
      },
    })
    variants.push({
      id: variant.id,
      productId: product.id,
      productName: def.name,
      price: def.price,
    })
    if (trackInventory) {
      await d.inventory.create({
        data: {
          organizationId: org.id,
          variantId: variant.id,
          locationId: location.id,
          locationType: "location",
          // rental: pocas unidades enteras (se reservan por unidad); retail:
          // stock normal con fracciones
          quantity:
            cfg.mode === "rental"
              ? 1 + Math.floor(rnd() * 8)
              : round2(1 + rnd() * 40),
          unitId: unitPza?.id,
          minThreshold: cfg.mode === "rental" ? 1 : 5,
        },
      })
    }
  }

  // Clientes del portal
  const customers = []
  for (let i = 0; i < cfg.customers.length; i++) {
    const c = cfg.customers[i]
    const email = customerEmails(cfg)[i]
    const user = await d.user.upsert({
      where: { email },
      update: { passwordHash, fullName: c.name, isActive: true },
      create: { email, passwordHash, fullName: c.name, isActive: true },
    })
    const customer = await d.customer.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        customerCode: `${cfg.customerCodePrefix}${String(i + 1).padStart(3, "0")}`,
        fullName: c.name,
        phone: c.phone,
        points: round2(rnd() * 250),
      },
    })
    customers.push(customer)
  }

  // ── Ventas históricas ────────────────────────────────────────────────────
  // Quienes cobran: owner + gerente/cajero (como el restaurante; el agente
  // atiende pero la caja la operan esos roles en el demo).
  const cashierIds = [ownerUserId]
  for (const { m, user } of teamAccounts) {
    if (!m.staffOnly && (m.role === "manager" || m.role === "cashier")) {
      cashierIds.push(user.id)
    }
  }
  let saleSeq = 0
  for (let s = 0; s < cfg.salesCount; s++) {
    saleSeq += 1
    const reg = registerIds[s % registerIds.length]
    const cashierId = pick(cashierIds, rnd)
    const customer = rnd() < 0.7 ? pick(customers, rnd) : null
    const saleDate = new Date(now - Math.floor(rnd() * cfg.salesDaysBack) * 86400000)
    saleDate.setHours(9 + Math.floor(rnd() * 10), Math.floor(rnd() * 60), 0, 0)

    const itemCount = 1 + Math.floor(rnd() * 3)
    const items: {
      productId: string
      variantId: string
      productName: string
      variantName: string
      productType: "standard"
      quantity: number
      unitId: string | undefined
      unitPrice: number
      totalPrice: number
      lineTotal: number
    }[] = []
    for (let k = 0; k < itemCount; k++) {
      const v = pick(variants, rnd)
      const quantity = cfg.mode === "rental" ? 1 + Math.floor(rnd() * 2) : 1
      const lineTotal = round2(quantity * v.price)
      items.push({
        productId: v.productId,
        variantId: v.id,
        productName: v.productName,
        variantName: "Default",
        productType: "standard",
        quantity,
        unitId: unitPza?.id,
        unitPrice: v.price,
        totalPrice: lineTotal,
        lineTotal,
      })
    }

    const subtotal = round2(items.reduce((acc, it) => acc + it.lineTotal, 0))
    const hasDiscount = rnd() < 0.12
    const discount = hasDiscount ? round2(subtotal * 0.1) : 0
    const tax = round2((subtotal - discount) * 0.16)
    const total = round2(subtotal - discount + tax)
    const tip =
      cfg.mode === "services" && rnd() < 0.15 ? round2(total * 0.1) : 0
    const sale = await d.sale.create({
      data: {
        organizationId: org.id,
        locationId: location.id,
        cashRegisterId: reg,
        cashierId,
        employeeId: employeeByUser.get(cashierId),
        customerId: customer?.id,
        locationSaleNumber: BigInt(saleSeq),
        subtotal,
        discount,
        tax,
        total,
        tip,
        pointsEarned: customer ? round2(total) : 0,
        status: "completed",
        notes: hasDiscount
          ? cfg.mode === "rental"
            ? "Descuento por paquete"
            : "Descuento de cortesía"
          : null,
        createdAt: saleDate,
        items: { create: items },
      },
    })
    await d.salePayment.create({
      data: {
        saleId: sale.id,
        method: rnd() < 0.55 ? "cash" : "card",
        amount: round2(total + tip),
      },
    })
    if (customer) {
      await d.loyaltyTransaction.create({
        data: {
          organizationId: org.id,
          customerId: customer.id,
          saleId: sale.id,
          kind: "earn",
          points: round2(total),
          note: `Venta ${saleSeq}`,
        },
      })
    }
  }
  await d.location.update({
    where: { id: location.id },
    data: { saleSeq: BigInt(saleSeq) },
  })

  // Notificaciones y publicaciones de ejemplo
  const ownerMember = await d.user.findUniqueOrThrow({
    where: { id: ownerUserId },
  })
  const manager = teamAccounts.find(({ m }) => m.role === "manager")
  await d.notification.createMany({
    data: [
      {
        organizationId: org.id,
        userId: manager?.user.id ?? ownerMember.id,
        kind: "sale",
        title: "Ventas del día registradas",
        body: "El cierre del demo muestra ventas de servicios y productos.",
        severity: "info",
        link: "/admin/sales",
      },
      {
        organizationId: org.id,
        userId: ownerMember.id,
        kind: "customer",
        title: "Nuevos clientes en el portal",
        body: "Los clientes del demo ya acumulan puntos de lealtad.",
        severity: "success",
        link: "/admin/customers",
      },
    ],
  })
  await d.publication.createMany({
    data: cfg.publications.map((p) => ({
      organizationId: org.id,
      title: p.title,
      content: p.content,
      type: p.type,
      isActive: true,
      publishedAt: new Date(now - p.daysAgo * 86400000),
    })),
  })

  // ── Agenda de citas (services; solo si el config asigna personal) ─────────
  if (cfg.staffServices?.length) {
    const employeeIdByEmail = new Map(
      teamAccounts
        .map(({ m, user }) => {
          const employeeId = employeeByUser.get(user.id)
          return employeeId ? ([m.email, employeeId] as const) : null
        })
        .filter((x): x is readonly [string, string] => x !== null)
    )
    const variantByName = new Map(
      variants.map((v) => [v.productName, v])
    )

    // Asignación de servicios por empleado (EmployeeService).
    const staffPools: {
      employeeId: string
      services: { name: string; durationMin: number; variantId: string; productId: string; price: number }[]
    }[] = []
    for (const entry of cfg.staffServices) {
      const employeeId = employeeIdByEmail.get(entry.email)
      if (!employeeId) continue
      const services = entry.services
        .map((s) => {
          const v = variantByName.get(s.name)
          return v ? { ...s, variantId: v.id, productId: v.productId, price: v.price } : null
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
      if (!services.length) continue
      await d.employeeService.createMany({
        data: services.map((s) => ({
          organizationId: org.id,
          employeeId,
          variantId: s.variantId,
          durationMin: s.durationMin,
        })),
      })
      staffPools.push({ employeeId, services })
    }

    // Citas de los últimos 14 días hábiles hasta los próximos 6 (lun–sáb).
    const NOTES = [
      "Cliente prefiere gel sin acetona",
      "Sensibilidad en cuero cabelludo",
      "Primera vez con nosotros",
      "Alergia al amoniaco",
      "Traerá referencia de color",
      "Aplica para cumpleañera del mes",
    ]
    let agendaSeq = 0
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    for (let off = -14; off <= 6; off++) {
      const day = new Date(todayStart.getTime() + off * 86400000)
      if (day.getDay() === 0) continue // domingo cerrado
      const dayEnd = new Date(day)
      dayEnd.setHours(18, 0, 0, 0)

      for (const pool of staffPools) {
        const visits =
          off === 0 ? 4 : off < 0 ? 2 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 2)
        let cursor = new Date(day)
        cursor.setHours(9, 30, 0, 0)
        let made = 0
        let guard = 0
        while (made < visits && guard++ < 12) {
          const svc = pick(pool.services, rnd)
          const startsAt = new Date(cursor)
          const endsAt = new Date(startsAt.getTime() + svc.durationMin * 60000)
          if (endsAt.getTime() > dayEnd.getTime()) break
          const customer = pick(customers, rnd)
          const past = endsAt.getTime() <= now - 20 * 60000
          const future = startsAt.getTime() > now
          const r = rnd()
          const status: $Enums.AppointmentStatus = past
            ? r < 0.13
              ? "cancelled"
              : r < 0.2
                ? "no_show"
                : "completed"
            : future
              ? r < 0.25
                ? "pending"
                : "confirmed"
              : "confirmed"
          const appt = await d.appointment.create({
            data: {
              organizationId: org.id,
              locationId: location.id,
              customerId: customer.id,
              employeeId: pool.employeeId,
              variantId: svc.variantId,
              status,
              startsAt,
              endsAt,
              durationMin: svc.durationMin,
              notes: rnd() < 0.28 ? pick(NOTES, rnd) : null,
            },
          })

          // Las citas completadas quedan ligadas a su venta (checkout).
          if (status === "completed") {
            agendaSeq += 1
            const reg = registerIds[0]
            const cashierId = pick(cashierIds, rnd)
            const subtotal = round2(svc.price)
            const tax = round2(subtotal * 0.16)
            const total = round2(subtotal + tax)
            const tip =
              rnd() < 0.18 && svc.name.includes("novia") ? round2(total * 0.1) : 0
            const sale = await d.sale.create({
              data: {
                organizationId: org.id,
                locationId: location.id,
                cashRegisterId: reg,
                cashierId,
                employeeId: employeeByUser.get(cashierId) ?? null,
                customerId: customer.id,
                locationSaleNumber: BigInt(saleSeq + agendaSeq),
                subtotal,
                discount: 0,
                tax,
                total,
                tip,
                pointsEarned: round2(total),
                status: "completed",
                notes: "Cita: " + svc.name,
                createdAt: endsAt,
                items: {
                  create: [
                    {
                      productId: svc.productId,
                      variantId: svc.variantId,
                      productName: svc.name,
                      variantName: "Default",
                      productType: "standard",
                      quantity: 1,
                      unitId: unitPza?.id,
                      unitPrice: svc.price,
                      totalPrice: subtotal,
                      lineTotal: subtotal,
                    },
                  ],
                },
              },
            })
            await d.salePayment.create({
              data: {
                saleId: sale.id,
                method: rnd() < 0.5 ? "cash" : "card",
                amount: round2(total + tip),
              },
            })
            await d.loyaltyTransaction.create({
              data: {
                organizationId: org.id,
                customerId: customer.id,
                saleId: sale.id,
                kind: "earn",
                points: round2(total),
                note: "Checkout cita: " + svc.name,
              },
            })
            await d.appointment.update({
              where: { id: appt.id },
              data: { saleId: sale.id },
            })
          }

          cursor = new Date(endsAt.getTime() + 15 * 60000)
          made += 1
        }
      }
    }
    if (agendaSeq > 0) {
      await d.location.update({
        where: { id: location.id },
        data: { saleSeq: { increment: BigInt(agendaSeq) } },
      })
    }
  }

  // ── Reservaciones de renta (solo rental) ──────────────────────────────────
  // Fiestas Demo: aparta unidades por períodos (fines de semana cargados). La
  // generación lleva un registro de unidades apartadas por día para nunca
  // sobre-reservar; las completadas quedan ligadas a su venta (checkout).
  if (cfg.mode === "rental") {
    const inv = await d.inventory.findMany({
      where: { organizationId: org.id, locationId: location.id, locationType: "location" },
      select: { variantId: true, quantity: true },
    })
    const totalUnits = new Map(inv.map((i) => [i.variantId, Number(i.quantity)]))
    const booked: Record<string, Record<string, number>> = {}
    const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 5 || d.getDay() === 6

    // Unidades ya apartadas del artículo en el día.
    const bookedOn = (variantId: string, day: Date) => booked[variantId]?.[ymdKey(day)] ?? 0

    let reservationSeq = 0
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    // 45 días de historia + 21 de agenda (fines de semana con más rentas).
    for (let off = -45; off <= 21; off++) {
      const day = new Date(todayStart.getTime() + off * 86400000)
      const weekend = isWeekend(day)
      const count = weekend ? 2 + Math.floor(rnd() * 3) : Math.floor(rnd() * 3)
      let made = 0
      let guard = 0
      while (made < count && guard++ < 14) {
        const v = pick(variants, rnd)
        const units = totalUnits.get(v.id)
        if (!units || units <= 0) continue
        // Duración: fin de semana (vie→lun) o 1 día entre semana.
        const days =
          weekend && day.getDay() === 5 && rnd() < 0.6
            ? 3
            : day.getDay() === 5 || day.getDay() === 6
              ? 2
              : 1
        // Cantidad acotada por unidades libres en todo el rango.
        const spanDays: Date[] = []
        for (let k = 0; k < days; k++) {
          const sd = new Date(day)
          sd.setDate(sd.getDate() + k)
          spanDays.push(sd)
        }
        const free = Math.min(...spanDays.map((sd) => units - bookedOn(v.id, sd)))
        if (free <= 0) continue
        const maxQty = v.productName.toLowerCase().includes("silla")
          ? Math.min(8, units)
          : Math.min(2, units)
        const qty = 1 + Math.floor(rnd() * Math.min(maxQty, free))
        if (qty < 1) continue
        const customer = pick(customers, rnd)
        const startsAt = new Date(day)
        const endsAt = new Date(day)
        endsAt.setDate(endsAt.getDate() + days)

        const ended = endsAt.getTime() <= now - 6 * 3600000
        const future = startsAt.getTime() > now
        const r = rnd()
        const status: $Enums.ReservationStatus = ended
          ? r < 0.16
            ? "cancelled"
            : "completed"
          : future
            ? r < 0.25
              ? "pending"
              : "confirmed"
            : "confirmed"

        const subtotal = round2(qty * v.price)
        const tax = round2(subtotal * 0.16)
        const total = round2(subtotal + tax)
        const res = await d.reservation.create({
          data: {
            organizationId: org.id,
            locationId: location.id,
            customerId: customer.id,
            status,
            startsAt,
            endsAt,
            notes: rnd() < 0.3 ? pick(RENTAL_NOTES, rnd) : null,
            items: {
              create: [
                {
                  variantId: v.id,
                  quantity: qty,
                  unitPrice: v.price,
                  lineTotal: subtotal,
                },
              ],
            },
          },
        })
        for (const sd of spanDays) {
          booked[v.id] = booked[v.id] ?? {}
          booked[v.id][ymdKey(sd)] = (booked[v.id][ymdKey(sd)] ?? 0) + qty
        }

        if (status === "completed") {
          reservationSeq += 1
          const reg = registerIds[0]
          const cashierId = pick(cashierIds, rnd)
          const sale = await d.sale.create({
            data: {
              organizationId: org.id,
              locationId: location.id,
              cashRegisterId: reg,
              cashierId,
              employeeId: employeeByUser.get(cashierId) ?? null,
              customerId: customer.id,
              locationSaleNumber: BigInt(saleSeq + reservationSeq),
              subtotal,
              discount: 0,
              tax,
              total,
              pointsEarned: round2(total),
              status: "completed",
              notes: `Renta: ${v.productName} ×${qty} (${days} día${days > 1 ? "s" : ""})`,
              createdAt: endsAt,
              items: {
                create: [
                  {
                    productId: v.productId,
                    variantId: v.id,
                    productName: v.productName,
                    variantName: "Default",
                    productType: "standard",
                    quantity: qty,
                    unitId: unitPza?.id,
                    unitPrice: v.price,
                    totalPrice: subtotal,
                    lineTotal: subtotal,
                  },
                ],
              },
            },
          })
          await d.salePayment.create({
            data: {
              saleId: sale.id,
              method: rnd() < 0.5 ? "cash" : "card",
              amount: total,
            },
          })
          await d.loyaltyTransaction.create({
            data: {
              organizationId: org.id,
              customerId: customer.id,
              saleId: sale.id,
              kind: "earn",
              points: round2(total),
              note: "Checkout renta: " + v.productName,
            },
          })
          await d.reservation.update({
            where: { id: res.id },
            data: { saleId: sale.id },
          })
        }
        made += 1
      }
    }
    if (reservationSeq > 0) {
      await d.location.update({
        where: { id: location.id },
        data: { saleSeq: { increment: BigInt(reservationSeq) } },
      })
    }
  }

  return {
    org,
    location,
    registerIds,
    customers,
    teamAccounts,
  }
}

/**
 * Demo habilitado solo con opt-in doble:
 *  1. SEED_DEMO === "true" (opt-in explícito, no default-on), y
 *  2. NODE_ENV no es "production" (aunque un operador copie un .env de
 *     desarrollo con SEED_DEMO=true, Prisma lo auto-carga y lo llenaría;
 *     el guard de NODE_ENV lo bloquea en entornos de producción).
 * Así un seed de producción jamás crea organizaciones de demo, y el guard
 * dentro de seedDemo protege también contra invocaciones directas del módulo.
 */
export function isDemoSeedingEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false
  return process.env.SEED_DEMO === "true"
}

export async function seedDemo() {
  // Guard de seguridad: sin el opt-in doble (SEED_DEMO=true y NODE_ENV distinto
  // de production) este módulo no toca la BD — ni siquiera la limpieza global
  // de tablas de demo.
  if (!isDemoSeedingEnabled()) {
    console.log(
      "ℹ️  Seed de demo omitido (requiere SEED_DEMO=\"true\" y NODE_ENV != production)"
    )
    return
  }

  await seedProduction()

  const rnd = mulberry32(2026)

  // ── Limpieza (idempotencia) ──────────────────────────────────────────────
  const existingOrgs = await prisma.organization.findMany({
    where: {
      name: {
        in: [DEMO_ORG_NAME, REST_ORG_NAME, EST_ORG_NAME, FIE_ORG_NAME, HYB_ORG_NAME],
      },
    },
    select: { id: true },
  })
  const demoEmails = [
    "demo@multi-pos.com",
    "manager@demo.multi-pos.com",
    "cajero1@demo.multi-pos.com",
    "cajero2@demo.multi-pos.com",
    "repartidor@demo.multi-pos.com",
    ...CUSTOMERS.map(
      (_, i) => `cli-${String(i + 1).padStart(3, "0")}@portal.local`
    ),
    ...REST_TEAM.map((t) => t.email),
    ...REST_CUSTOMERS.map(
      (_, i) => `rcli-${String(i + 1).padStart(3, "0")}@restaurante.local`
    ),
    // Estética Demo (services)
    ...ESTETICA_SEED.team.map((t) => t.email),
    ...customerEmails(ESTETICA_SEED),
    // Fiestas Demo (rental)
    ...FIESTAS_SEED.team.map((t) => t.email),
    ...customerEmails(FIESTAS_SEED),
    // Híbrido Demo (retail + food_service)
    ...HYB_TEAM.map((t) => t.email),
    ...HYB_CUSTOMERS.map(
      (_, i) => `hcli-${String(i + 1).padStart(3, "0")}@hibrido.local`
    ),
  ]
  if (existingOrgs.length > 0) {
    await cleanupDemo(
      existingOrgs.map((o) => o.id),
      demoEmails
    )
  }

  // ── Usuarios del equipo ──────────────────────────────────────────────────
  const passwordHash = await import("bcryptjs").then((m) =>
    m.hash(DEMO_PASSWORD, 10)
  )

  // upsert: si la cuenta sobrevive a la limpieza (p. ej. es owner de otra
  // organización), se reutiliza reseteando contraseña y nombre.
  const mkUser = async (email: string, fullName: string) =>
    prisma.user.upsert({
      where: { email },
      update: { passwordHash, fullName, isActive: true },
      create: { email, passwordHash, fullName, isActive: true },
    })

  const ownerUser = await mkUser("demo@multi-pos.com", "Ana López")
  const managerUser = await mkUser("manager@demo.multi-pos.com", "Carlos Ruiz")
  const cashier1User = await mkUser("cajero1@demo.multi-pos.com", "Luis Gómez")
  const cashier2User = await mkUser("cajero2@demo.multi-pos.com", "María Pérez")
  const repartidorUser = await mkUser(
    "repartidor@demo.multi-pos.com",
    "Pedro Hernández"
  )

  // ── Organización ─────────────────────────────────────────────────────────
  // businessMode explícito (retail): define páginas, permisos y wizards
  // visibles para esta organización (ver src/lib/business-modes.ts).
  const org = await prisma.organization.create({
    data: {
      name: DEMO_ORG_NAME,
      ownerId: ownerUser.id,
      currency: "MXN",
      businessMode: "retail",
      pointsPerCurrency: 1,
      pointValue: 0.1,
      loyaltyEnabled: true,
    },
  })

  await prisma.companyProfile.create({
    data: {
      organizationId: org.id,
      legalName: "Supermercado Demo S.A. de C.V.",
      tradeName: "Super Demo",
      taxId: "SDM000101010",
      city: "Ciudad de México",
      state: "CDMX",
      postalCode: "06000",
      country: "México",
      phone: "5512340000",
      email: "contacto@demo.multi-pos.com",
      website: "https://demo.multi-pos.com",
      ticketFooter: "¡Gracias por su compra!",
    },
  })

  await prisma.appSettings.create({
    data: {
      organizationId: org.id,
      primaryHue: 160,
      accentHue: 30,
      theme: "system",
      fontFamily: "montserrat",
    },
  })

  // ── DeliveryPolicy ─────────────────────────────────────────────────────
  await prisma.deliveryPolicy.create({
    data: {
      organizationId: org.id,
      pickupEnabled: true,
      pickupMinAmount: 0,
      pickupFee: 0,
      pickupFeeEnabled: false,
      deliveryEnabled: true,
      deliveryMinAmount: 150,
      deliveryFee: 45,
      deliveryFeeEnabled: true,
      deliveryRadiusKm: 8,
      deliveryEstimatedMins: 45,
    },
  })

  // ── Memberships ──────────────────────────────────────────────────────────
  // Todas con roleId del rol de sistema (id estable de seedProduction); el
  // enum se conserva como respaldo para los roles compartidos.
  const SYS_ROLE_ID: Record<string, string> = {
    owner: "system-owner",
    manager: "system-manager",
    cashier: "system-cashier",
    admin: "system-admin",
  }
  const membership = (userId: string, role: $Enums.OrgRole, roleId?: string) =>
    prisma.membership.create({
      data: {
        userId,
        organizationId: org.id,
        role,
        roleId: roleId ?? SYS_ROLE_ID[role] ?? null,
      },
    })
  await membership(ownerUser.id, "owner")
  await membership(managerUser.id, "manager")
  await membership(cashier1User.id, "cashier")
  await membership(cashier2User.id, "cashier")
  // El repartidor (Pedro) lleva su rol de sistema: mismo org que su empleado
  // (inferKindFromUser prefiere el org del empleado), así el courier es sujeto
  // de prueba real del guard pos.use (no lo tiene: sin POS/caja).
  await membership(repartidorUser.id, "cashier", "system-courier")

  // ── Puestos y empleados ──────────────────────────────────────────────────
  const positions: Record<string, string> = {}
  for (const name of [
    "Cajero",
    "Supervisor",
    "Repartidor",
    "Almacenero",
    "Cocinero",
  ]) {
    const p = await prisma.employeePosition.create({
      data: { organizationId: org.id, name },
    })
    positions[name] = p.id
  }

  const employee = (
    userId: string,
    employeeCode: string,
    fullName: string,
    position: string,
    phone?: string
  ) =>
    prisma.employee.create({
      data: {
        organizationId: org.id,
        userId,
        employeeCode,
        fullName,
        positionId: positions[position],
        phone,
      },
    })
  await employee(
    ownerUser.id,
    "EMP-001",
    "Ana López",
    "Supervisor",
    "5512340001"
  )
  await employee(
    managerUser.id,
    "EMP-002",
    "Carlos Ruiz",
    "Supervisor",
    "5512340002"
  )
  await employee(
    cashier1User.id,
    "EMP-003",
    "Luis Gómez",
    "Cajero",
    "5512340003"
  )
  await employee(
    cashier2User.id,
    "EMP-004",
    "María Pérez",
    "Cajero",
    "5512340004"
  )
  await employee(
    repartidorUser.id,
    "EMP-005",
    "Pedro Hernández",
    "Repartidor",
    "5512340005"
  )

  // ── Sucursales, CEDIS y cajas ────────────────────────────────────────────
  const locations = await Promise.all(
    [
      {
        name: "Matriz",
        code: "LOC-001",
        latitude: 19.4326,
        longitude: -99.1332,
        allowsDelivery: true,
      },
      {
        name: "Sucursal 2",
        code: "LOC-002",
        latitude: 19.37,
        longitude: -99.1,
        allowsDelivery: true,
      },
      {
        name: "Sucursal 3",
        code: "LOC-003",
        latitude: 19.45,
        longitude: -99.2,
        allowsPickup: true,
      },
    ].map((loc) =>
      prisma.location.create({
        data: {
          organizationId: org.id,
          name: loc.name,
          code: loc.code,
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: "Av. Principal 123",
          managerName: "Carlos Ruiz",
          allowsPickup: loc.allowsPickup ?? true,
          allowsDelivery: loc.allowsDelivery ?? false,
          openingHours: "Lun-Sab 09:00-18:00",
          openingScheduleJson: JSON.stringify(emptySchedule()),
        },
      })
    )
  )

  await prisma.cedi.create({
    data: {
      organizationId: org.id,
      name: "CEDIS Central",
      code: "CED-001",
      address: "Parque Industrial Norte",
      managerName: "Almacenero Demo",
      openingHours: "Lun-Vie 08:00-17:00",
      openingScheduleJson: JSON.stringify(emptySchedule().map((d, i) => ({ ...d, enabled: i >= 1 && i <= 5, open: "08:00", close: "17:00" }))),
    },
  })

  const registers: { id: string; locationId: string }[] = []
  for (const loc of locations) {
    for (const name of ["Caja 1", "Caja 2"]) {
      const r = await prisma.cashRegister.create({
        data: {
          locationId: loc.id,
          organizationId: org.id,
          name,
          folioPrefix: name.replace(" ", ""),
        },
      })
      registers.push({ id: r.id, locationId: loc.id })
    }
  }

  // ── Direcciones de clientes ────────────────────────────────────────────
  const addressData = [
    { label: "Casa", address: "Av. Reforma 123, Col. Centro, CDMX", lat: 19.4326, lng: -99.1332 },
    { label: "Oficina", address: "Blvd. Insurgentes 456, Del. Miguel Hidalgo, CDMX", lat: 19.4350, lng: -99.1700 },
    { label: "Casa", address: "Calle Durango 789, Col. Roma Norte, CDMX", lat: 19.4195, lng: -99.1620 },
    { label: "Casa", address: "Calzada de Tlalpan 1010, Del. Coyoacán, CDMX", lat: 19.3000, lng: -99.1500 },
    { label: "Trabajo", address: "Av. Insurgentes Sur 2000, Del. Álvaro Obregón, CDMX", lat: 19.3500, lng: -99.2000 },
  ]

  // ── Clientes ─────────────────────────────────────────────────────────────
  const customers = []
  for (let i = 0; i < CUSTOMERS.length; i++) {
    const c = CUSTOMERS[i]
    const code = `CLI-${String(i + 1).padStart(3, "0")}`
    const user = await prisma.user.upsert({
      where: {
        email: `cli-${String(i + 1).padStart(3, "0")}@portal.local`,
      },
      update: { passwordHash, fullName: c.name, isActive: true },
      create: {
        email: `cli-${String(i + 1).padStart(3, "0")}@portal.local`,
        passwordHash,
        fullName: c.name,
        isActive: true,
      },
    })
    const customer = await prisma.customer.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        customerCode: code,
        fullName: c.name,
        phone: c.phone,
        points: round2(rnd() * 500),
        address: addressData[i % addressData.length]?.address ?? null,
        latitude: addressData[i % addressData.length]?.lat ?? null,
        longitude: addressData[i % addressData.length]?.lng ?? null,
      },
    })
    customers.push(customer)
  }

  for (let i = 0; i < Math.min(addressData.length, customers.length); i++) {
    const a = addressData[i]
    await prisma.customerAddress.create({
      data: {
        organizationId: org.id,
        customerId: customers[i].id,
        label: a.label,
        address: a.address,
        latitude: a.lat,
        longitude: a.lng,
      },
    })
  }

  // ── Categorías (jerarquía) ───────────────────────────────────────────────
  const catAbarrotes = await prisma.category.create({
    data: { organizationId: org.id, name: "Abarrotes", imageUrl: categoryImageUrl("Abarrotes") },
  })
  const catFrutas = await prisma.category.create({
    data: { organizationId: org.id, name: "Frutas y Verduras", imageUrl: categoryImageUrl("Frutas y Verduras") },
  })
  const categoryIds: Record<string, string> = {
    Abarrotes: catAbarrotes.id,
    "Frutas y Verduras": catFrutas.id,
  }
  for (const name of [
    "Bebidas",
    "Lácteos y Huevo",
    "Carnes y Pescados",
    "Panadería",
    "Limpieza",
    "Electrónica",
    "Ropa",
    "Salud y Cuidado",
  ]) {
    const cat = await prisma.category.create({
      data: {
        organizationId: org.id,
        name,
        imageUrl: categoryImageUrl(name),
        parentId:
          name === "Bebidas" ||
          name === "Lácteos y Huevo" ||
          name === "Panadería"
            ? catAbarrotes.id
            : undefined,
      },
    })
    categoryIds[name] = cat.id
  }

  // ── Unidades de medida (referencias del sistema) ─────────────────────────
  const units = await prisma.unitOfMeasure.findMany({
    where: {
      organizationId: null,
      abbreviation: { in: SYSTEM_UNITS.map((u) => u.abbreviation) },
    },
  })
  const unitByAbbr = Object.fromEntries(units.map((u) => [u.abbreviation, u]))
  const unitKg = unitByAbbr["kg"]
  const unitPza = unitByAbbr["pza"]

  // ── Productos + variantes + inventario ───────────────────────────────────
  const variants: {
    id: string
    name: string
    price: number
    productId: string
    productName: string
    bulk: boolean
  }[] = []
  const bulkProducts: { id: string; name: string; price: number }[] = []

  for (let i = 0; i < PRODUCTS.length; i++) {
    const def = PRODUCTS[i]
    const barcodeBase = `750${String(i + 1).padStart(8, "0")}`

    const product = await prisma.product.create({
      data: {
        organizationId: org.id,
        categoryId: categoryIds[def.category],
        name: def.name,
        description: def.desc,
        imageUrl: productImageUrl(def.emoji, def.category),
        taxRate: 0.16,
        trackInventory: true,
        productType: def.bulk ? "bulk" : "standard",
        bulkUnitId: def.bulk ? unitKg?.id : undefined,
        bulkPricePerUnit: def.bulk ? def.price : undefined,
        bulkMinQuantity: def.bulk ? 0.1 : undefined,
        bulkStep: def.bulk ? 0.05 : undefined,
        bulkMaxQuantity: def.bulk ? 0 : undefined,
        allowSplit: false,
      },
    })

    if (def.bulk) {
      bulkProducts.push({ id: product.id, name: def.name, price: def.price })
      continue
    }

    const variantDefs = def.variants ?? [{ name: "Default", price: def.price }]
    for (let v = 0; v < variantDefs.length; v++) {
      const vd = variantDefs[v]
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          organizationId: org.id,
          sku: `SKU-${String(i + 1).padStart(3, "0")}${v > 0 ? `-${v + 1}` : ""}`,
          barcode: v > 0 ? `${barcodeBase}${v + 1}` : barcodeBase,
          name: vd.name,
          price: vd.price,
          cost: round2(vd.price * 0.62),
        },
      })
      variants.push({
        id: variant.id,
        name: vd.name,
        price: vd.price,
        productId: product.id,
        productName: def.name,
        bulk: false,
      })
    }
  }

  // Inventario: por variante y por producto granel, en cada sucursal
  for (const loc of locations) {
    for (const v of variants) {
      await prisma.inventory.create({
        data: {
          organizationId: org.id,
          variantId: v.id,
          locationId: loc.id,
          locationType: "location",
          quantity: round2(20 + rnd() * 380),
          unitId: unitPza?.id,
          minThreshold: 10,
        },
      })
    }
    for (const bp of bulkProducts) {
      await prisma.inventory.create({
        data: {
          organizationId: org.id,
          productId: bp.id,
          locationId: loc.id,
          locationType: "location",
          quantity: round2(5 + rnd() * 100),
          unitId: unitKg?.id,
          minThreshold: 5,
        },
      })
    }
  }

  // ── Combos (paquetes retail) ─────────────────────────────────────────────
  // El modo retail también soporta combos (ver src/lib/features.ts): se
  // venden como paquetes con precio especial en el POS y en el portal.
  const productIdByName = new Map<string, string>()
  const firstVariantByProduct = new Map<string, string>()
  for (const v of variants) {
    if (!productIdByName.has(v.productName)) {
      productIdByName.set(v.productName, v.productId)
    }
    if (!firstVariantByProduct.has(v.productName)) {
      firstVariantByProduct.set(v.productName, v.id)
    }
  }
  for (const comboDef of SUPER_COMBOS) {
    const combo = await prisma.productCombo.create({
      data: {
        organizationId: org.id,
        name: comboDef.name,
        description: `Ahorra con ${comboDef.name.toLowerCase()}`,
        comboPrice: comboDef.price,
        isActive: true,
      },
    })
    for (const [itemName, quantity] of comboDef.items) {
      await prisma.comboItem.create({
        data: {
          comboId: combo.id,
          productId: productIdByName.get(itemName)!,
          variantId: firstVariantByProduct.get(itemName)!,
          quantity,
        },
      })
    }
  }

  // ── Promociones ──────────────────────────────────────────────────────────
  const colaVariant = variants.find((v) => v.productName === "Refresco cola 2L")
  const lecheVariant = variants.find((v) => v.productName === "Leche entera 1L")

  const promoData: {
    name: string
    benefit: $Enums.PromoBenefit
    scope: $Enums.PromoScope
    value?: number
    minAmount?: number
    buyQuantity?: number
    getQuantity?: number
    weekdays?: string
  }[] = [
    {
      name: "10% en tu pedido",
      benefit: "percent_off",
      scope: "order",
      value: 10,
    },
    {
      name: "$20 de descuento +$300",
      benefit: "amount_off",
      scope: "order",
      value: 20,
      minAmount: 300,
    },
    {
      name: "2x1 Refresco cola 2L",
      benefit: "buy_x_get_y",
      scope: "product",
      buyQuantity: 2,
      getQuantity: 1,
    },
    {
      name: "Leche a $20",
      benefit: "fixed_price",
      scope: "product",
      value: 20,
    },
    {
      name: "15% en frutas y verduras",
      benefit: "percent_off",
      scope: "category",
      value: 15,
    },
    {
      name: "5% en electrónica",
      benefit: "percent_off",
      scope: "category",
      value: 5,
    },
    {
      name: "Cupón próxima compra +$500",
      benefit: "next_purchase_coupon",
      scope: "order",
      minAmount: 500,
    },
    {
      name: "Jueves de lácteos -10%",
      benefit: "percent_off",
      scope: "category",
      value: 10,
      weekdays: "[4]",
    },
    {
      name: "Artículo gratis +$400",
      benefit: "free_item",
      scope: "order",
      minAmount: 400,
    },
    {
      name: "$15 menos en Bebidas",
      benefit: "amount_off",
      scope: "category",
      value: 15,
      minAmount: 100,
    },
  ]

  const promotions: { id: string; name: string }[] = []
  for (const pd of promoData) {
    const promo = await prisma.promotion.create({
      data: {
        organizationId: org.id,
        name: pd.name,
        benefit: pd.benefit,
        scope: pd.scope,
        value: pd.value,
        buyQuantity: pd.buyQuantity,
        getQuantity: pd.getQuantity,
        minAmount: pd.minAmount,
        weekdays: pd.weekdays,
        isActive: true,
        createdBy: ownerUser.id,
        startsAt: new Date(Date.now() - 30 * 86400000),
        endsAt: new Date(Date.now() + 60 * 86400000),
      },
    })
    promotions.push(promo)
  }

  // Targets de promociones
  const promoTarget = (
    promotionName: string,
    kind: $Enums.PromotionTargetKind,
    targetId: string
  ) =>
    prisma.promotionTarget.create({
      data: {
        promotionId: promotions.find((p) => p.name === promotionName)!.id,
        kind,
        targetId,
      },
    })
  if (colaVariant)
    await promoTarget("2x1 Refresco cola 2L", "variant", colaVariant.id)
  if (lecheVariant) await promoTarget("Leche a $20", "variant", lecheVariant.id)
  await promoTarget("15% en frutas y verduras", "category", catFrutas.id)
  await promoTarget("5% en electrónica", "category", categoryIds["Electrónica"])
  await promoTarget("$15 menos en Bebidas", "category", categoryIds["Bebidas"])

  // ── Ventas históricas (100) ──────────────────────────────────────────────
  const cashiers = [
    { user: cashier1User, employeeId: undefined as string | undefined },
    { user: cashier2User, employeeId: undefined as string | undefined },
    { user: managerUser, employeeId: undefined as string | undefined },
  ]
  const empByUser = await prisma.employee.findMany({
    where: { organizationId: org.id },
  })
  const empIdByUserId = Object.fromEntries(
    empByUser.map((e) => [e.userId, e.id])
  )

  const now = Date.now()
  const saleSeqByLocation: Record<string, number> = {}
  for (const loc of locations) saleSeqByLocation[loc.id] = 0

  for (let s = 0; s < 100; s++) {
    const loc = pick(locations, rnd)
    const reg = pick(
      registers.filter((r) => r.locationId === loc.id),
      rnd
    )
    const cashier = pick(cashiers, rnd)
    const customer = rnd() < 0.7 ? pick(customers, rnd) : null
    const saleDate = new Date(now - Math.floor(rnd() * 90) * 86400000)
    saleDate.setHours(Math.floor(rnd() * 12) + 9, Math.floor(rnd() * 60), 0, 0)

    const itemCount = 1 + Math.floor(rnd() * 7)
    const items = []
    for (let k = 0; k < itemCount; k++) {
      if (rnd() < 0.3 && bulkProducts.length) {
        const bp = pick(bulkProducts, rnd)
        const qty = round2(0.1 + rnd() * 3)
        const unitPrice = bp.price
        const totalPrice = round2(qty * unitPrice)
        items.push({
          productId: bp.id,
          productName: bp.name,
          productType: "bulk" as const,
          quantity: qty,
          unitId: unitKg?.id,
          unitPrice,
          totalPrice,
          lineTotal: totalPrice,
          bulkQuantityDisplay: `${qty} kg`,
        })
      } else {
        const v = pick(variants, rnd)
        const qty = 1 + Math.floor(rnd() * 5)
        const lineTotal = round2(qty * v.price)
        items.push({
          variantId: v.id,
          productId: v.productId,
          productName: v.productName,
          variantName: v.name,
          productType: "standard" as const,
          quantity: qty,
          unitId: unitPza?.id,
          unitPrice: v.price,
          totalPrice: lineTotal,
          lineTotal,
        })
      }
    }

    const subtotal = round2(
      items.reduce((acc, it) => acc + (it.lineTotal as number), 0)
    )
    const hasDiscount = rnd() < 0.25
    const discount = hasDiscount ? round2(subtotal * (0.05 + rnd() * 0.1)) : 0
    const tax = round2((subtotal - discount) * 0.16)
    const total = round2(subtotal - discount + tax)
    const pointsEarned = customer ? round2(total) : 0

    saleSeqByLocation[loc.id] += 1
    const locationSaleNumber = BigInt(saleSeqByLocation[loc.id])

    const sale = await prisma.sale.create({
      data: {
        organizationId: org.id,
        locationId: loc.id,
        cashRegisterId: reg.id,
        cashierId: cashier.user.id,
        employeeId: cashier.employeeId ?? empIdByUserId[cashier.user.id],
        customerId: customer?.id,
        locationSaleNumber,
        subtotal,
        discount,
        tax,
        total,
        pointsEarned,
        status: "completed",
        notes: hasDiscount ? "Descuento manual aplicado" : null,
        createdAt: saleDate,
        items: { create: items },
      },
      include: { items: true },
    })

    const payCash = rnd() < 0.6
    if (payCash) {
      await prisma.salePayment.create({
        data: {
          saleId: sale.id,
          method: "cash",
          amount: total,
          reference: null,
        },
      })
    } else {
      await prisma.salePayment.create({
        data: {
          saleId: sale.id,
          method: "card",
          amount: total,
          reference: `AUTH-${100000 + s}`,
        },
      })
    }

    if (hasDiscount) {
      await prisma.saleDiscount.create({
        data: { saleId: sale.id, label: "Descuento manual", amount: discount },
      })
    }

    if (customer) {
      await prisma.loyaltyTransaction.create({
        data: {
          organizationId: org.id,
          customerId: customer.id,
          saleId: sale.id,
          kind: "earn",
          points: pointsEarned,
          note: `Venta ${locationSaleNumber}`,
        },
      })
    }
  }

  // Actualizar folios de sucursal
  for (const loc of locations) {
    await prisma.location.update({
      where: { id: loc.id },
      data: { saleSeq: BigInt(saleSeqByLocation[loc.id]) },
    })
  }

  // ── Pedidos del portal (20) ──────────────────────────────────────────────
  const statuses = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "delivered",
    "cancelled",
  ] as const
  for (let o = 0; o < 20; o++) {
    const loc = pick(locations, rnd)
    const customer = customers[o % customers.length]
    const status = statuses[Math.floor(rnd() * statuses.length)]
    const deliveryMethod = rnd() < 0.5 ? "pickup" : "delivery"
    const orderDate = new Date(now - Math.floor(rnd() * 60) * 86400000)

    const itemCount = 1 + Math.floor(rnd() * 4)
    const items = []
    for (let k = 0; k < itemCount; k++) {
      const v = pick(variants, rnd)
      const qty = 1 + Math.floor(rnd() * 3)
      const lineTotal = round2(qty * v.price)
      items.push({
        productId: v.productId,
        variantId: v.id,
        productName: v.productName,
        variantName: v.name,
        productType: "standard" as const,
        quantity: qty,
        unitId: unitPza?.id,
        unitPrice: v.price,
        lineTotal,
      })
    }
    const subtotal = round2(
      items.reduce((acc, it) => acc + (it.lineTotal as number), 0)
    )
    const total = round2(subtotal * 1.16)
    const isDelivery = deliveryMethod === "delivery"
    const paymentMethod = pick(["cash", "card", "card"], rnd) as "cash" | "card"
    const isPaid = status === "delivered" || status === "ready" || (status === "confirmed" && rnd() < 0.5)
    const deliveryPin = isDelivery && (status === "ready" || status === "delivered")
      ? String(Math.floor(100000 + rnd() * 900000))
      : null
    const pointsRedeemed = rnd() < 0.2 ? round2(Math.floor(rnd() * 50)) : 0
    const pointsValue = pointsRedeemed > 0 ? round2(pointsRedeemed * 0.1) : 0

    const order = await prisma.order.create({
      data: {
        organizationId: org.id,
        locationId: loc.id,
        customerId: customer.id,
        status,
        deliveryMethod,
        subtotal,
        discount: 0,
        total,
        address: isDelivery ? addressData[o % addressData.length].address : null,
        latitude: isDelivery ? addressData[o % addressData.length].lat : null,
        longitude: isDelivery ? addressData[o % addressData.length].lng : null,
        paymentMethod,
        deliveryFee: isDelivery ? 45 : 0,
        deliveryPin,
        paidAt: isPaid ? orderDate : null,
        pointsRedeemed: pointsRedeemed > 0 ? pointsRedeemed : 0,
        pointsValue: pointsValue > 0 ? pointsValue : 0,
        createdAt: orderDate,
        updatedAt: orderDate,
        items: { create: items },
      },
    })

    // Historial de estados
    const historyFlow: typeof statuses = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "delivered",
      "cancelled",
    ]
    const flowIndex = statuses.indexOf(status)
    for (let hi = 0; hi <= Math.max(flowIndex, 0); hi++) {
      const st = historyFlow[hi]
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: st,
          employeeId: hi === 0 ? undefined : empIdByUserId[managerUser.id],
          userId: hi === 0 ? undefined : managerUser.id,
          notes: st === "delivered" ? "Entregado al cliente" : null,
        },
      })
    }

    // Preparación para algunos
    if (
      status === "preparing" ||
      status === "ready" ||
      status === "delivered"
    ) {
      await prisma.orderPreparation.create({
        data: {
          orderId: order.id,
          employeeId: empIdByUserId[cashier1User.id],
          startedAt: orderDate,
          completedAt:
            status === "ready" || status === "delivered"
              ? new Date(orderDate.getTime() + 15 * 60000)
              : null,
          elapsedSeconds:
            status === "ready" || status === "delivered" ? 900 : null,
        },
      })
    }
  }

  // ── Notificaciones de ejemplo ────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        organizationId: org.id,
        userId: ownerUser.id,
        kind: "new_order",
        title: "Nuevo pedido recibido",
        body: "Un cliente realizó un pedido por pickup.",
        severity: "info",
        link: "/orders",
      },
      {
        organizationId: org.id,
        userId: managerUser.id,
        kind: "low_stock",
        title: "Stock bajo",
        body: "El producto 'Tomate rojo' está por debajo del mínimo.",
        severity: "warning",
        link: "/inventory",
      },
      {
        organizationId: org.id,
        userId: cashier1User.id,
        kind: "sale",
        title: "Venta completada",
        body: "La venta #1 se completó correctamente.",
        severity: "success",
        link: "/sales",
      },
    ],
  })

  // ── Publicaciones de ejemplo ─────────────────────────────────────────────
  await prisma.publication.createMany({
    data: [
      {
        organizationId: org.id,
        title: "¡Nueva llegada! Bocina bluetooth",
        content:
          "Ya está disponible la bocina bluetooth a un precio increíble.",
        type: "product_new",
        isActive: true,
        publishedAt: new Date(now - 2 * 86400000),
      },
      {
        organizationId: org.id,
        title: "Promoción de frutas y verduras",
        content: "15% de descuento en toda la sección de frutas y verduras.",
        type: "promotion",
        isActive: true,
        publishedAt: new Date(now - 5 * 86400000),
      },
      {
        organizationId: org.id,
        title: "Aviso: horario de temporada",
        content: "Extendemos el horario los fines de semana.",
        type: "notice",
        isActive: true,
        publishedAt: new Date(now - 10 * 86400000),
      },
    ],
  })

  // ── Restaurante Demo (food_service) ─────────────────────────────────────
  // Equipo con roles del modo por roleId (mesero/cocina), combos, mesas,
  // pedidos para KDS y ventas históricas.
  const restaurant = await seedRestaurantDemo(ownerUser.id, passwordHash)

  // ── Estética Demo (services) y Fiestas Demo (rental) ─────────────────────
  // Catálogo + ventas de caja con el rol del modo por roleId (agente de
  // atención / agente de renta).
  const estetica = await seedVerticalOrgDemo(
    ownerUser.id,
    passwordHash,
    ESTETICA_SEED
  )
  const fiestas = await seedVerticalOrgDemo(
    ownerUser.id,
    passwordHash,
    FIESTAS_SEED
  )

  // ── Híbrido Demo (retail + food_service) ─────────────────────────────────
  // Fonda-tienda con roles del modo híbrido por roleId (system-hybrid-waiter
  // / system-hybrid-kitchen), mesas, combos y pedidos para KDS.
  const hibrido = await seedHybridDemo(ownerUser.id, passwordHash)

  return {
    org,
    ownerUser,
    managerUser,
    cashier1User,
    cashier2User,
    locations,
    customers,
    restaurant,
    estetica,
    fiestas,
    hibrido,
  }
}

export {
  DEMO_ORG_NAME,
  REST_ORG_NAME,
  EST_ORG_NAME,
  FIE_ORG_NAME,
  HYB_ORG_NAME,
  DEMO_PASSWORD,
}
