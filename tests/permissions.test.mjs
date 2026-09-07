// Pruebas de permisos (integración) — Node test runner, sin dependencias.
//
// Requiere:
//   - dev server arriba:  npm run dev   (TEST_BASE_URL para apuntar a otra URL)
//   - demo sembrada:      npm run db:seed  (usa los usuarios de Restaurante Demo)
//
// Ejecutar:  npm test
//
// Verifica en el flujo HTTP real:
//   mesero    → cash open 403, /admin redirige a /pos, CRUD create 403
//   cajero    → cash open 200, catálogo POS 200, /pos 200, /admin redirige a /pos, CRUD create 403
//   gerente   → cash open 200, /admin 200, CRUD create 201 (products.manage)
//   cocina    → /api/pos/* 403 (sin pos.use), /pos redirige a /kds
//   repartidor→ /api/pos/* 403 (sin pos.use), /pos redirige a /kds
//   agenda/reservaciones: agente del modo 200; cajero del MISMO modo 403
//   (sin appointments.*/reservations.*); cajero de otro modo 403
//   flujo mesa: mesero ocupa → envía a cocina (KDS la ve) → gerente cobra
//   → la orden queda delivered+pagada, sale del KDS y la mesa vuelve a free
//   flujo mesa ronda 2: la segunda ronda se agrega a la MISMA orden abierta
//   (createdOrder=false, renglones acumulados, subtotal recalculado) y se
//   cierra con cancel-unsent (DELETE /api/pos/kitchen) + liberación vía
//   PATCH /api/tables/session
//   multi-org → el owner cambia de org y, tras re-login, retoma esa org
//   imágenes: /api/uploads round-trip — 401 anónimo, 415/413 rechazos, URL
//   bajo la org activa, archivo servido, PATCH+GET de imageUrl, y 404
//   cruzado desde otra org
//   guía del POS: mesero híbrido con locations.view/orders.view (botones
//   Mesa/KDS); cajero de retail sin guía (org no food/hybrid); contrato de
//   fuente de pos-app/pos-role-guide/pos-header
//   lista de espera: cliente portal se anota (waiting) → se libera una mesa
//   que le cabe → available + notificación en vivo → claim crea la
//   reservación y la entrada cierra seated
//
// La limpieza se hace por la misma API (cerrar caja, borrar producto) y un
// barrido best-effort en after() (sesiones de caja, productos TEST-PERM y
// las filas del escenario de mesa: orden + venta + folio + mesa).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const PASSWORD = "demo1234";

// PNG 1×1 mínimo (un píxel blanco) para las pruebas de subida de archivos.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

// Cuentas de la demo (rol por roleId en la membership): cocina y mesero en
// Restaurante Demo; repartidor en Supermercado Demo.
const ACCOUNTS = {
  mesero: { email: "mesero@demo.multi-pos.com", label: "Mesero (system-food_service-waiter)" },
  cashier: { email: "cajero-rest@demo.multi-pos.com", label: "Cajero (system-cashier)" },
  manager: { email: "gerente-rest@demo.multi-pos.com", label: "Gerente (system-manager)" },
  kitchen: { email: "cocina@demo.multi-pos.com", label: "Cocina (system-food_service-kitchen)" },
  courier: { email: "repartidor@demo.multi-pos.com", label: "Repartidor (system-courier)" },
  // Híbrido Demo: mesero/cocina/gerente con los roles del modo híbrido.
  meseroHib: { email: "mesero-hib@demo.multi-pos.com", label: "Mesero (system-hybrid-waiter)" },
  cocinaHib: { email: "cocina-hib@demo.multi-pos.com", label: "Cocina (system-hybrid-kitchen)" },
  managerHib: { email: "gerente-hib@demo.multi-pos.com", label: "Gerente (system-manager)" },
  // Modos services/rental: agentes (con permiso del modo) y cajeros del mismo
  // modo (SIN appointments.*/reservations.* aunque su org sí es del modo).
  attendant: { email: "agente-est@demo.multi-pos.com", label: "Agente de atención (system-services-attendant)" },
  cashierEst: { email: "cajero-est@demo.multi-pos.com", label: "Cajero Estética (system-cashier)" },
  rentalAgent: { email: "agente-fie@demo.multi-pos.com", label: "Agente de renta (system-rental-agent)" },
  cashierFie: { email: "cajero-fie@demo.multi-pos.com", label: "Cajero Fiestas (system-cashier)" },
  // Cajero del Supermercado Demo (retail): su org NO es food/hybrid, así que
  // la guía del POS no debe montarse aunque system-cashier traiga los permisos.
  cashierSup: { email: "cajero1@demo.multi-pos.com", label: "Cajero Supermercado (system-cashier)" },
  // Cliente del portal de Híbrido Demo (lista de espera de mesas).
  waitlistCustomer: { email: "hcli-001@hibrido.local", label: "Cliente portal Híbrido (hcli-001)" },
};

const prisma = new PrismaClient();
const ctx = {
  orgId: null,
  registerId: null,
  locationId: null,
  tableId: null,
  dish: null, // { id, name, price } de un platillo real del menú
  createdOrderIds: [],
  createdSaleIds: [],
  // Escenario del Híbrido Demo (roles system-hybrid-*): mesa 4 del seed está
  // reservada y sin órdenes → lienzo limpio para el flujo; se restaura en after().
  hybOrgId: null,
  hybLocationId: null,
  hybTableId: null,
  hybDish: null,
  // Org del repartidor (Supermercado Demo) para el flujo de entrega SSE.
  courierOrgId: null,
  courierLocationId: null,
  courierDish: null,
  // Prueba de imágenes: el producto objetivo y su imageUrl original se
  // resuelven en tiempo de test (la org activa del owner depende de su última
  // sesión) y se restauran en after().
  uploadProductId: null,
  uploadOriginalImageUrl: null,
  uploadProbeUrls: [],
  // Lista de espera: entradas, notificaciones y reservación creadas por el test.
  waitlistEntryIds: [],
  waitlistNotifIds: [],
  createdWaitlistReservationIds: [],
  // Reservación de invitado (sin cuenta) creada por el test.
  guestReservationIds: [],
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Suscriptor SSE de prueba para /api/kds/stream: lee el stream crudo y guarda
 * cada evento con marca de tiempo. `first` resuelve con el snapshot inicial;
 * `waitFor(type, orderId)` resuelve con el primer evento del tipo que llegue
 * después de la marca `since` (o lanza timeout — fallo explícito, no pasivo).
 */
function subscribeKdsStream(cookie, label = "kds-sse") {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const events = [];
    const timers = [];
    let firstResolve;
    const first = new Promise((res) => {
      firstResolve = res;
    });
    let firstSeen = false;

    fetch(`${BASE}/api/kds/stream`, {
      headers: { Cookie: cookie, Accept: "text/event-stream" },
      signal: controller.signal,
    })
      .then((res) => {
        if (res.status !== 200 || !res.body) {
          throw new Error(`${label}: stream respondió ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const pump = () =>
          reader.read().then(({ done, value }) => {
            if (done) return;
            buffer += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buffer.indexOf("\n\n")) >= 0) {
              const chunk = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 2);
              const line = chunk.split("\n").find((l) => l.startsWith("data: "));
              if (!line) continue;
              try {
                const payload = JSON.parse(line.slice(6));
                const isSnapshot = Array.isArray(payload.orders);
                events.push({ at: Date.now(), payload });
                if (isSnapshot && !firstSeen) {
                  firstSeen = true;
                  firstResolve();
                }
              } catch {
                // Frame no-JSON: ignorar.
              }
            }
            return pump();
          });
        pump().catch(() => {});
        // Si el snapshot inicial no llega (fallo transitorio del query), no
        // colgar la prueba: los eventos en vivo igual alimentan a waitFor.
        const snapshotGuard = setTimeout(() => {
          if (!firstSeen) {
            firstSeen = true;
            firstResolve();
          }
        }, 8000);
        timers.push(snapshotGuard);
        first
          .then(() => resolve({ first, waitFor, close, events }))
          .catch(reject);
      })
      .catch((err) => {
        if (err.name !== "AbortError") reject(err);
      });

    /**
     * Resuelve con el primer evento que matchee tras `after` (el evento
     * devuelto por una llamada anterior, o null para buscar desde el inicio).
     * Usa índices, no reloj: dos eventos pueden llegar en el mismo milisegundo.
     */
    function waitFor(type, orderId, { after = null, timeoutMs = 8000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      return new Promise((resolveWait, rejectWait) => {
        const check = () => {
          const startIdx = after ? events.indexOf(after) + 1 : 0;
          const idx = events.findIndex(
            (e, i) =>
              i >= startIdx && e.payload.type === type && e.payload.orderId === orderId
          );
          if (idx >= 0) return resolveWait(events[idx]);
          if (Date.now() > deadline) {
            const seen = events
              .map(
                (e) =>
                  `${e.payload.type ?? "snapshot"}@${e.at} order=${e.payload.orderId} status=${e.payload.status}`
              )
              .join(" | ");
            return rejectWait(
              new Error(
                `${label}: timeout esperando ${type} de la orden ${orderId} (eventos: ${events.length || "ninguno"} [${seen}])`
              )
            );
          }
          timers.push(setTimeout(check, 50));
        };
        check();
      });
    }

    function close() {
      timers.forEach(clearTimeout);
      controller.abort();
    }
  });
}

/** Inicia sesión por el flujo real (CSRF + credentials) y devuelve el jar.
 *  `organizationId` elige la org en el picker del login (multi-org). */
async function login(email, organizationId) {
  // 1) CSRF: hay que devolver la cookie que emite /api/auth/csrf (double-submit).
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrf = await csrfRes.json();
  const csrfCookie = csrfRes.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  // 2) Credentials (campo `identifier`, no `email`).
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(csrfCookie ? { Cookie: csrfCookie } : {}),
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      identifier: email,
      password: PASSWORD,
      ...(organizationId ? { organizationId } : {}),
    }).toString(),
  });
  assert.equal(res.status, 302, `login ${email} debe redirigir (302), obtuvo ${res.status}`);
  const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]);
  return { cookie: cookies.join("; ") };
}

/** Petición a la API/app con la sesión, sin seguir redirecciones. */
async function api(path, { cookie, method = "GET", body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
}

const openCash = (cookie, registerId) =>
  api("/api/pos/cash", {
    cookie,
    method: "POST",
    body: { action: "open", registerId, openingCash: 100 },
  });

const closeCash = (cookie, sessionId) =>
  api("/api/pos/cash", {
    cookie,
    method: "POST",
    body: { action: "close", sessionId, closingCash: 100 },
  });

const createProduct = (cookie, name) =>
  api("/api/crud/products", {
    cookie,
    method: "POST",
    body: { name, taxRate: 0.16, initialVariant: { price: 10 } },
  });

/** POST multipart a /api/uploads con la sesión (idéntico al cliente uploadFile). */
async function uploadImage(cookie, { filename = "probe.png", type = "image/png", bytes = TINY_PNG } = {}) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), filename);
  return fetch(`${BASE}/api/uploads`, {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
    body: form,
  });
}

/**
 * PNG de prueba 1200×800 (gradiente): lo bastante grande para que la subida
 * genere un original 1024px y una miniatura 256px claramente distintos —
 * con el PNG de 1×1 ambos quedaban casi idénticos (sin ampliación).
 */
async function bigProbePng() {
  const { default: sharp } = await import("sharp");
  return sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 40, g: 120, b: 200 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="1200" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2878c8"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/></svg>`
        ),
      },
    ])
    .png()
    .toBuffer();
}

before(async () => {
  const up = await fetch(`${BASE}/auth/login`, { redirect: "manual" })
    .then((r) => r.status === 200)
    .catch(() => false);
  assert.ok(up, `Dev server no disponible en ${BASE}. Corre 'npm run dev' antes de 'npm test'.`);

  const org = await prisma.organization.findFirst({
    where: { name: "Restaurante Demo" },
    select: { id: true },
  });
  assert.ok(org, "No existe Restaurante Demo. Corre 'npm run db:seed'.");
  const reg = await prisma.cashRegister.findFirst({
    where: { organizationId: org.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  assert.ok(reg, "Restaurante Demo no tiene cajas registradoras.");
  ctx.orgId = org.id;
  ctx.registerId = reg.id;

  // Fixtures del flujo de mesa (escenario end-to-end).
  const loc = await prisma.location.findFirst({
    where: { organizationId: org.id },
    select: { id: true },
  });
  assert.ok(loc, "Restaurante Demo no tiene sucursales.");
  const freeTable = await prisma.table.findFirst({
    where: { organizationId: org.id, isActive: true, status: "free" },
    orderBy: { number: "asc" },
    select: { id: true, number: true },
  });
  assert.ok(freeTable, "Restaurante Demo no tiene mesas libres para el flujo de mesa.");
  const dish = await prisma.product.findFirst({
    where: { organizationId: org.id, isActive: true },
    select: {
      id: true,
      name: true,
      variants: { where: { isActive: true }, take: 1, select: { price: true } },
    },
  });
  assert.ok(dish, "Restaurante Demo no tiene productos de menú.");
  const price = Number(dish.variants[0]?.price ?? 0);
  assert.ok(price > 0, `El platillo ${dish.name} debe tener precio`);
  ctx.locationId = loc.id;
  ctx.tableId = freeTable.id;
  ctx.dish = { id: dish.id, name: dish.name, price };

  // Fixtures del escenario híbrido (misma siembra, modo hybrid).
  const hybOrg = await prisma.organization.findFirst({
    where: { name: "Híbrido Demo" },
    select: { id: true },
  });
  assert.ok(hybOrg, "No existe Híbrido Demo. Corre 'npm run db:seed'.");
  const hybLoc = await prisma.location.findFirst({
    where: { organizationId: hybOrg.id },
    select: { id: true },
  });
  assert.ok(hybLoc, "Híbrido Demo no tiene sucursales.");
  // Mesa 4 del híbrido: reservada y sin órdenes sembradas (mesas 1-3 tienen
  // pedidos en curso del KDS que no debe tocar la prueba).
  const hybTable = await prisma.table.findFirst({
    where: { organizationId: hybOrg.id, isActive: true, number: 4 },
    select: { id: true, number: true },
  });
  assert.ok(hybTable, "Híbrido Demo no tiene la mesa 4 del seed.");
  const hybDish = await prisma.product.findFirst({
    where: { organizationId: hybOrg.id, isActive: true },
    select: {
      id: true,
      name: true,
      variants: { where: { isActive: true }, take: 1, select: { price: true } },
    },
  });
  assert.ok(hybDish, "Híbrido Demo no tiene productos de menú.");
  const hybPrice = Number(hybDish.variants[0]?.price ?? 0);
  assert.ok(hybPrice > 0, `El platillo híbrido ${hybDish.name} debe tener precio`);
  ctx.hybOrgId = hybOrg.id;
  ctx.hybLocationId = hybLoc.id;
  ctx.hybTableId = hybTable.id;
  ctx.hybDish = { id: hybDish.id, name: hybDish.name, price: hybPrice };

  // Fixtures del flujo de entrega (org del repartidor: Supermercado Demo).
  // No toca las órdenes sembradas: el pedido de prueba se crea y borra aquí.
  const courierOrg = await prisma.organization.findFirst({
    where: { name: "Supermercado Demo" },
    select: { id: true },
  });
  assert.ok(courierOrg, "No existe Supermercado Demo. Corre 'npm run db:seed'.");
  const courierLoc = await prisma.location.findFirst({
    where: { organizationId: courierOrg.id },
    select: { id: true },
  });
  assert.ok(courierLoc, "Supermercado Demo no tiene sucursales.");
  const courierProduct = await prisma.product.findFirst({
    where: { organizationId: courierOrg.id, isActive: true },
    select: { id: true, name: true, variants: { where: { isActive: true }, take: 1, select: { price: true } } },
  });
  assert.ok(courierProduct, "Supermercado Demo no tiene productos.");
  const courierPrice = Number(courierProduct.variants[0]?.price ?? 0);
  assert.ok(courierPrice > 0, "El producto del supermercado debe tener precio");
  ctx.courierOrgId = courierOrg.id;
  ctx.courierLocationId = courierLoc.id;
  ctx.courierDish = { id: courierProduct.id, name: courierProduct.name, price: courierPrice };
});

after(async () => {
  // Barrido best-effort: nunca dejar sesiones de caja abiertas de la prueba.
  await prisma.cashSession.deleteMany({ where: { organizationId: ctx.orgId, status: "open" } });
  // El DELETE del CRUD es soft-delete (desactiva); borrado físico aquí para no
  // dejar filas de prueba en la demo.
  const prods = await prisma.product.findMany({
    where: { name: { startsWith: "TEST-PERM" } },
    select: { id: true },
  });
  if (prods.length > 0) {
    const ids = prods.map((p) => p.id);
    await prisma.inventory.deleteMany({ where: { variant: { productId: { in: ids } } } });
    await prisma.productVariant.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
  }

  // Limpieza del escenario de mesa: orden de cocina, venta, folio y mesa.
  // Orden de borrado por FKs: hijos de la orden → orden (referencia la venta)
  // → hijos de la venta → venta.
  if (ctx.createdOrderIds.length > 0) {
    const preps = await prisma.orderPreparation.findMany({
      where: { orderId: { in: ctx.createdOrderIds } },
      select: { id: true },
    });
    const prepIds = preps.map((p) => p.id);
    if (prepIds.length > 0) {
      await prisma.orderPreparationItem.deleteMany({ where: { preparationId: { in: prepIds } } });
      await prisma.orderPreparation.deleteMany({ where: { id: { in: prepIds } } });
    }
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: ctx.createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ctx.createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: ctx.createdOrderIds } } });
  }
  if (ctx.createdSaleIds.length > 0) {
    await prisma.saleItem.deleteMany({ where: { saleId: { in: ctx.createdSaleIds } } });
    await prisma.salePayment.deleteMany({ where: { saleId: { in: ctx.createdSaleIds } } });
    await prisma.saleDiscount.deleteMany({ where: { saleId: { in: ctx.createdSaleIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: ctx.createdSaleIds } } });
    // La venta incrementó el folio de la sucursal; devolverlo para no
    // desplazar los folios de la demo.
    if (ctx.locationId) {
      await prisma.location.update({
        where: { id: ctx.locationId },
        data: { saleSeq: { decrement: ctx.createdSaleIds.length } },
      });
    }
  }
  // Restaurar la mesa usada por el flujo (estado libre + sin sesión abierta).
  if (ctx.tableId) {
    await prisma.table.updateMany({ where: { id: ctx.tableId }, data: { status: "free" } });
    await prisma.tableSession.deleteMany({ where: { tableId: ctx.tableId, endedAt: null } });
  }
  // Restaurar la mesa del escenario híbrido (vuelve a "reserved", su estado del seed).
  if (ctx.hybTableId) {
    await prisma.table.updateMany({ where: { id: ctx.hybTableId }, data: { status: "reserved" } });
    await prisma.tableSession.deleteMany({ where: { tableId: ctx.hybTableId, endedAt: null } });
  }
  // Lista de espera: borrar entradas, la reservación del claim y las
  // notificaciones de mesa disponible generadas por el test.
  if (ctx.waitlistEntryIds.length > 0) {
    await prisma.tableWaitlist.deleteMany({ where: { id: { in: ctx.waitlistEntryIds } } });
  }
  if (ctx.createdWaitlistReservationIds.length > 0) {
    await prisma.tableReservation.deleteMany({ where: { id: { in: ctx.createdWaitlistReservationIds } } });
  }
  if (ctx.waitlistNotifIds.length > 0) {
    await prisma.notification.deleteMany({ where: { id: { in: ctx.waitlistNotifIds } } });
  }
  // Reservaciones de invitado (sin cuenta) creadas por el test.
  if (ctx.guestReservationIds.length > 0) {
    await prisma.tableReservation.deleteMany({ where: { id: { in: ctx.guestReservationIds } } });
  }
  // Prueba de imágenes: restaurar imageUrl original y borrar los archivos
  // subidos por la prueba (el borrado es best-effort: si falla, quedan
  // archivos huérfanos en public/uploads pero la demo sigue consistente).
  if (ctx.uploadProductId && ctx.uploadOriginalImageUrl !== undefined) {
    await prisma.product.update({
      where: { id: ctx.uploadProductId },
      data: { imageUrl: ctx.uploadOriginalImageUrl },
    });
  }
  const { unlink } = await import("node:fs/promises");
  const { join } = await import("node:path");
  for (const url of ctx.uploadProbeUrls) {
    try {
      await unlink(join(process.cwd(), "public", url));
    } catch {
      // Ya no existe / nunca se escribió: nada que hacer.
    }
  }
  await prisma.$disconnect();
});

test("mesero: sin caja ni CRUD create; /admin redirige a /pos", async () => {
  const s = await login(ACCOUNTS.mesero.email);

  const cash = await openCash(s.cookie, ctx.registerId);
  assert.equal(cash.status, 403, "cash open debe ser 403 para mesero");
  const cashBody = await cash.json();
  assert.match(cashBody.error ?? "", /permiso/i);

  const admin = await api("/admin", { cookie: s.cookie });
  assert.ok(admin.status >= 300 && admin.status < 400, `/admin debe redirigir, obtuvo ${admin.status}`);
  assert.match(admin.headers.get("location") ?? "", /\/pos$/, "/admin debe redirigir a /pos");

  const create = await createProduct(s.cookie, `TEST-PERM mesero ${Date.now()}`);
  assert.equal(create.status, 403, "CRUD create debe ser 403 para mesero");
});

test("cajero: opera POS (catalog 200, cash open/close 200, /pos 200), CRUD create 403", async () => {
  const s = await login(ACCOUNTS.cashier.email);

  // El cajero SÍ tiene pos.use: catálogo del POS y página /pos cargan.
  const catalog = await api("/api/pos/catalog", { cookie: s.cookie });
  assert.equal(catalog.status, 200, "catálogo POS debe ser 200 para cajero");

  const posPage = await api("/pos", { cookie: s.cookie });
  assert.equal(posPage.status, 200, `/pos debe cargar (200), obtuvo ${posPage.status}`);

  const cash = await openCash(s.cookie, ctx.registerId);
  assert.equal(cash.status, 200, "cash open debe ser 200 para cajero");
  const sessionId = (await cash.json())?.session?.id;
  assert.ok(sessionId, "la apertura debe devolver session.id");
  const closed = await closeCash(s.cookie, sessionId);
  assert.equal(closed.status, 200, "cash close debe ser 200 para cajero");

  const admin = await api("/admin", { cookie: s.cookie });
  // El panel admin es de owner/manager/admin: el cajero se redirige a /pos.
  assert.ok(admin.status >= 300 && admin.status < 400, `/admin debe redirigir, obtuvo ${admin.status}`);
  assert.match(admin.headers.get("location") ?? "", /\/pos$/, "/admin debe redirigir a /pos para cajero");

  const create = await createProduct(s.cookie, `TEST-PERM cajero ${Date.now()}`);
  assert.equal(create.status, 403, "CRUD create debe ser 403 para cajero (sin products.manage)");
});

test("cocina: /api/pos/* 403 y /pos redirige a /kds (sin pos.use)", async () => {
  const s = await login(ACCOUNTS.kitchen.email);

  const catalog = await api("/api/pos/catalog", { cookie: s.cookie });
  assert.equal(catalog.status, 403, "catálogo POS debe ser 403 para cocina");
  const catalogBody = await catalog.json();
  assert.match(catalogBody.error ?? "", /pos\.use/, "el 403 debe indicar el permiso faltante");

  const cash = await openCash(s.cookie, ctx.registerId);
  assert.equal(cash.status, 403, "cash open debe ser 403 para cocina");

  const pos = await api("/pos", { cookie: s.cookie });
  assert.ok(pos.status >= 300 && pos.status < 400, `/pos debe redirigir, obtuvo ${pos.status}`);
  assert.match(pos.headers.get("location") ?? "", /\/kds/, "/pos debe redirigir a /kds para cocina");
});

test("repartidor: /api/pos/* 403 y /pos redirige a /kds (sin pos.use)", async () => {
  const s = await login(ACCOUNTS.courier.email);

  const catalog = await api("/api/pos/catalog", { cookie: s.cookie });
  assert.equal(catalog.status, 403, "catálogo POS debe ser 403 para repartidor");
  const catalogBody = await catalog.json();
  assert.match(catalogBody.error ?? "", /pos\.use/, "el 403 debe indicar el permiso faltante");

  const cash = await openCash(s.cookie, ctx.registerId);
  assert.equal(cash.status, 403, "cash open debe ser 403 para repartidor");

  const pos = await api("/pos", { cookie: s.cookie });
  assert.ok(pos.status >= 300 && pos.status < 400, `/pos debe redirigir, obtuvo ${pos.status}`);
  assert.match(pos.headers.get("location") ?? "", /\/kds/, "/pos debe redirigir a /kds para repartidor");
});

test("agenda: agente de atención 200; cajero del mismo modo 403; cajero de otro modo 403", async () => {
  const attendant = await login(ACCOUNTS.attendant.email);
  const agenda = await api("/api/agenda", { cookie: attendant.cookie });
  assert.equal(agenda.status, 200, "agenda GET debe ser 200 para el agente de atención");

  // Cajero de Estética (org services, pero system-cashier no trae
  // appointments.*): el guard de modo debe bloquearlo pese a que su org sí es
  // del modo.
  const cashier = await login(ACCOUNTS.cashierEst.email);
  const denied = await api("/api/agenda", { cookie: cashier.cookie });
  assert.equal(denied.status, 403, "agenda GET debe ser 403 para cajero de Estética");
  const deniedBody = await denied.json();
  assert.match(deniedBody.error ?? "", /appointments\.view/, "el 403 debe indicar el permiso de modo");

  // Cajero de Restaurante (food_service): otro modo, también 403.
  const otherMode = await login(ACCOUNTS.cashier.email);
  const cross = await api("/api/agenda", { cookie: otherMode.cookie });
  assert.equal(cross.status, 403, "agenda GET debe ser 403 para un cajero de otro modo");
});

test("reservaciones: agente de renta 200; cajero del mismo modo 403; cajero de otro modo 403", async () => {
  const agent = await login(ACCOUNTS.rentalAgent.email);
  const res = await api("/api/reservaciones", { cookie: agent.cookie });
  assert.equal(res.status, 200, "reservaciones GET debe ser 200 para el agente de renta");

  const cashier = await login(ACCOUNTS.cashierFie.email);
  const denied = await api("/api/reservaciones", { cookie: cashier.cookie });
  assert.equal(denied.status, 403, "reservaciones GET debe ser 403 para cajero de Fiestas");
  const deniedBody = await denied.json();
  assert.match(deniedBody.error ?? "", /reservations\.view/, "el 403 debe indicar el permiso de modo");

  const otherMode = await login(ACCOUNTS.cashier.email);
  const cross = await api("/api/reservaciones", { cookie: otherMode.cookie });
  assert.equal(cross.status, 403, "reservaciones GET debe ser 403 para un cajero de otro modo");
});

test("gerente: abre y cierra caja (200), entra a /admin, CRUD create 201 y limpia", async () => {
  const s = await login(ACCOUNTS.manager.email);

  const cash = await openCash(s.cookie, ctx.registerId);
  assert.equal(cash.status, 200, "cash open debe ser 200 para gerente");
  const sessionId = (await cash.json())?.session?.id;
  const closed = await closeCash(s.cookie, sessionId);
  assert.equal(closed.status, 200, "cash close debe ser 200 para gerente");

  const admin = await api("/admin", { cookie: s.cookie });
  assert.equal(admin.status, 200, `/admin debe cargar (200), obtuvo ${admin.status}`);

  const create = await createProduct(s.cookie, `TEST-PERM gerente ${Date.now()}`);
  assert.equal(create.status, 201, "CRUD create debe ser 201 para gerente (products.manage)");
  const { row } = await create.json();
  assert.ok(row?.id, "la creación debe devolver el producto");

  const del = await api(`/api/crud/products/${row.id}`, { cookie: s.cookie, method: "DELETE" });
  assert.equal(del.status, 200, "el producto de prueba debe eliminarse");
});

test("flujo mesa: mesero ocupa → envía a cocina (KDS la ve) → gerente cobra → orden cerrada y mesa libre", async () => {
  const mesero = await login(ACCOUNTS.mesero.email);
  const gerente = await login(ACCOUNTS.manager.email);
  const { dish } = ctx;
  const qty = 2;
  const subtotal = round2(qty * dish.price);
  const total = round2(subtotal * 1.16);

  // 1) Sentar: el mesero ocupa una mesa libre (solo status → pos.use).
  const seat = await api("/api/tables", {
    cookie: mesero.cookie,
    method: "PUT",
    body: { id: ctx.tableId, status: "occupied" },
  });
  assert.equal(seat.status, 200, "mesero debe poder ocupar la mesa");

  // La cocina (sin pos.use) NO puede cambiar el estado de la mesa.
  const cocina = await login(ACCOUNTS.kitchen.email);
  const seatKitchen = await api("/api/tables", {
    cookie: cocina.cookie,
    method: "PUT",
    body: { id: ctx.tableId, status: "free" },
  });
  assert.equal(seatKitchen.status, 403, "cocina no debe ocupar/liberar mesas (sin pos.use)");

  // 2) Ordenar: el mesero envía el ticket a cocina.
  const send = await api("/api/pos/kitchen", {
    cookie: mesero.cookie,
    method: "POST",
    body: {
      tableId: ctx.tableId,
      locationId: ctx.locationId,
      items: [
        {
          key: "mesa-e2e",
          productId: dish.id,
          variantId: null,
          productName: dish.name,
          quantity: qty,
          unitPrice: dish.price,
          taxRate: 0.16,
        },
      ],
    },
  });
  assert.equal(send.status, 200, "el envío a cocina debe funcionar para el mesero");
  const { orderId, orderNumber } = await send.json();
  assert.ok(orderId, "el envío debe devolver la orden creada");
  ctx.createdOrderIds.push(orderId);

  const dbOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: { preparation: { select: { id: true } } },
  });
  assert.ok(dbOrder, "la orden debe existir en BD");
  assert.equal(dbOrder.status, "preparing", "el envío debe dejar la orden en preparing");
  assert.equal(dbOrder.tableId, ctx.tableId, "la orden debe quedar ligada a la mesa");
  assert.ok(dbOrder.preparation, "la orden debe tener sesión de preparación (KDS)");

  // 3) El KDS muestra la orden de la mesa.
  const kds = await api(`/api/kds?locationId=${ctx.locationId}`, { cookie: mesero.cookie });
  const kdsBody = await kds.json();
  assert.ok(kdsBody.orders?.some((o) => o.id === orderId), `el KDS debe listar la orden #${orderNumber}`);

  // 3b) Cocina avanza su artículo a "ready" desde el KDS (kds.operate). Con
  //     todo listo, la orden deja de listarse en el KDS y el cobro debe
  //     cerrarla igual (delivered + venta ligada) aunque ya no esté abierta.
  const kdsRow = kdsBody.orders.find((o) => o.id === orderId);
  assert.ok(kdsRow?.items?.length > 0, "la orden del KDS debe tener artículos");
  const advance = await api("/api/kds", {
    cookie: cocina.cookie,
    method: "PUT",
    body: { orderItemId: kdsRow.items[0].id, status: "ready" },
  });
  assert.equal(advance.status, 200, "cocina debe poder marcar el artículo como ready");
  const advancedItem = await prisma.orderItem.findUnique({
    where: { id: kdsRow.items[0].id },
    select: { itemStatus: true },
  });
  assert.equal(advancedItem.itemStatus, "ready", "el artículo debe quedar ready en BD");
  const orderAfterAdvance = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  assert.equal(
    orderAfterAdvance.status,
    "ready",
    "con todos los artículos listos, la orden pasa a ready (fuera del KDS)"
  );
  const kdsAfterReady = await api(`/api/kds?locationId=${ctx.locationId}`, { cookie: mesero.cookie });
  const kdsAfterReadyBody = await kdsAfterReady.json();
  assert.ok(
    !kdsAfterReadyBody.orders?.some((o) => o.id === orderId),
    "la orden en ready ya no debe listarse en el KDS"
  );

  // 4) Cobrar: el gerente cobra el ticket de la mesa.
  const charge = await api("/api/pos/sales", {
    cookie: gerente.cookie,
    method: "POST",
    body: {
      locationId: ctx.locationId,
      payload: {
        items: [
          {
            productId: dish.id,
            variantId: null,
            productType: "standard",
            productName: dish.name,
            quantity: qty,
            unitId: null,
            unitPrice: dish.price,
            totalPrice: subtotal,
            discount: 0,
            taxRate: 0.16,
            lineTotal: subtotal,
            // Sin descuento de inventario: la demo conserva su stock intacto
            // (el seed no descuenta inventario en sus ventas).
            trackInventory: false,
          },
        ],
        subtotal,
        discount: 0,
        tax: round2(subtotal * 0.16),
        total,
        changeGiven: 0,
        pointsEarned: 0,
        pointsRedeemed: 0,
        pointsRedeemedValue: 0,
        payments: [{ method: "cash", amount: total }],
        discounts: [],
        tableId: ctx.tableId,
      },
    },
  });
  assert.equal(charge.status, 200, "el cobro de la mesa debe funcionar para el gerente");
  const saleId = (await charge.json())?.sale?.id;
  assert.ok(saleId, "el cobro debe devolver la venta");
  ctx.createdSaleIds.push(saleId);

  // 5) La orden queda cerrada: delivered + venta ligada + pagada. Cocina ya
  //    la había dejado en ready (3b): el cobro la cierra igual, preservando
  //    el estado listo de los artículos.
  const closed = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { id: true, itemStatus: true } } },
  });
  assert.equal(closed.status, "delivered", "la orden debe cerrarse al cobrar la mesa");
  assert.equal(closed.saleId, saleId, "la orden debe quedar ligada a la venta");
  assert.ok(closed.paidAt, "la orden debe quedar pagada");
  assert.ok(
    closed.items.every((i) => i.itemStatus === "ready"),
    "los artículos deben conservar su estado ready tras el cobro"
  );

  // 6) El KDS ya no la muestra y la mesa quedó libre.
  const kdsAfter = await api(`/api/kds?locationId=${ctx.locationId}`, { cookie: mesero.cookie });
  const kdsAfterBody = await kdsAfter.json();
  assert.ok(
    !kdsAfterBody.orders?.some((o) => o.id === orderId),
    "la orden cobrada no debe seguir en el KDS"
  );
  const tableAfter = await prisma.table.findUnique({
    where: { id: ctx.tableId },
    select: { status: true },
  });
  assert.equal(tableAfter.status, "free", "la mesa debe quedar libre tras el cobro");
  const openSessions = await prisma.tableSession.count({
    where: { tableId: ctx.tableId, endedAt: null },
  });
  assert.equal(openSessions, 0, "no debe quedar sesión de mesa abierta");
});

test("flujo mesa ronda 2: la segunda ronda se agrega a la misma orden abierta", async () => {
  const mesero = await login(ACCOUNTS.mesero.email);
  const { dish } = ctx;

  // Sentar la mesa (la prueba anterior la dejó libre al cobrar).
  const seat = await api("/api/tables", {
    cookie: mesero.cookie,
    method: "PUT",
    body: { id: ctx.tableId, status: "occupied" },
  });
  assert.equal(seat.status, 200, "mesero debe poder ocupar la mesa");

  // Ronda 1: primer envío a cocina (crea la orden de la mesa).
  const send1 = await api("/api/pos/kitchen", {
    cookie: mesero.cookie,
    method: "POST",
    body: {
      tableId: ctx.tableId,
      locationId: ctx.locationId,
      items: [
        {
          key: "mesa-r2-a",
          productId: dish.id,
          variantId: null,
          productName: dish.name,
          quantity: 1,
          unitPrice: dish.price,
          taxRate: 0.16,
        },
      ],
    },
  });
  assert.equal(send1.status, 200, "la primera ronda debe enviarse a cocina");
  const r1 = await send1.json();
  assert.equal(r1.createdOrder, true, "la primera ronda debe crear la orden");
  assert.equal(r1.orderStatus, "preparing", "la orden creada entra a cocina");
  ctx.createdOrderIds.push(r1.orderId);

  const dbOrder1 = await prisma.order.findUnique({
    where: { id: r1.orderId },
    include: {
      items: { select: { id: true } },
      preparation: { include: { items: { select: { id: true } } } },
    },
  });
  assert.ok(dbOrder1, "la orden de la ronda 1 debe existir en BD");
  assert.equal(dbOrder1.items.length, 1, "la orden debe tener 1 renglón tras la ronda 1");
  assert.equal(dbOrder1.preparation.items.length, 1, "el checklist del KDS debe tener 1 artículo");

  // Ronda 2: el mesero agrega más artículos al ticket y vuelve a enviar.
  const send2 = await api("/api/pos/kitchen", {
    cookie: mesero.cookie,
    method: "POST",
    body: {
      tableId: ctx.tableId,
      locationId: ctx.locationId,
      items: [
        {
          key: "mesa-r2-b",
          productId: dish.id,
          variantId: null,
          productName: dish.name,
          quantity: 2,
          unitPrice: dish.price,
          taxRate: 0.16,
        },
      ],
    },
  });
  assert.equal(send2.status, 200, "la segunda ronda debe enviarse a cocina");
  const r2 = await send2.json();
  assert.equal(r2.createdOrder, false, "la segunda ronda NO debe crear una orden nueva");
  assert.equal(r2.orderId, r1.orderId, "la segunda ronda debe caer en la MISMA orden abierta");
  assert.equal(r2.orderNumber, r1.orderNumber, "el número de orden no debe cambiar");
  assert.ok(r2.created?.[0]?.orderItemId, "la segunda ronda debe devolver el artículo creado");
  assert.notEqual(
    r2.created[0].orderItemId,
    dbOrder1.items[0].id,
    "la segunda ronda debe AGREGAR un renglón, no mutar el existente"
  );

  // La orden abierta acumula ambas rondas: 2 renglones (1+2 pzas), subtotal
  // recalculado, sigue preparing con UNA sola sesión de preparación y sin venta.
  const dbOrder2 = await prisma.order.findUnique({
    where: { id: r1.orderId },
    include: {
      items: { select: { id: true, quantity: true } },
      preparation: { include: { items: { select: { id: true } } } },
    },
  });
  assert.equal(dbOrder2.items.length, 2, "la orden debe acumular 2 renglones (uno por ronda)");
  assert.equal(
    Number(dbOrder2.subtotal),
    round2(3 * dish.price),
    "el subtotal debe reflejar ambas rondas (1 + 2 × precio)"
  );
  assert.equal(dbOrder2.status, "preparing", "la orden sigue en cocina (preparing)");
  assert.equal(dbOrder2.preparation.items.length, 2, "el KDS debe tener los 2 artículos en el checklist");
  assert.equal(dbOrder2.saleId, null, "la orden sigue sin cobrar");

  // El KDS muestra UNA sola orden para la mesa, con los artículos de ambas rondas.
  const kds = await api(`/api/kds?locationId=${ctx.locationId}`, { cookie: mesero.cookie });
  const kdsBody = await kds.json();
  const kdsRows = kdsBody.orders?.filter((o) => o.id === r1.orderId) ?? [];
  assert.equal(kdsRows.length, 1, "el KDS debe listar la orden una sola vez (sin duplicar por ronda)");
  assert.equal(kdsRows[0]?.items?.length, 2, "el KDS debe mostrar los artículos de ambas rondas");

  // Cierre sin cobro: el mesero regresa la orden (cancel-unsent) y libera la
  // mesa vía PATCH /api/tables/session (el mismo flujo del ticket del POS).
  // La cocina (sin orders.manage) NO puede cancelar la orden.
  const cocina = await login(ACCOUNTS.kitchen.email);
  const cancelKitchen = await api(`/api/pos/kitchen?orderId=${r1.orderId}`, {
    cookie: cocina.cookie,
    method: "DELETE",
  });
  assert.equal(cancelKitchen.status, 403, "cocina no debe cancelar la orden (sin orders.manage)");

  const cancel = await api(`/api/pos/kitchen?orderId=${r1.orderId}`, {
    cookie: mesero.cookie,
    method: "DELETE",
  });
  assert.equal(cancel.status, 200, "el mesero debe poder cancelar la orden sin cobrar");
  const cancelled = await prisma.order.findUnique({
    where: { id: r1.orderId },
    select: { status: true },
  });
  assert.equal(cancelled.status, "cancelled", "la orden cancelada debe quedar en cancelled");

  const release = await api("/api/tables/session", {
    cookie: mesero.cookie,
    method: "PATCH",
    body: { tableId: ctx.tableId },
  });
  assert.equal(release.status, 200, "el mesero debe poder liberar la mesa (cierra su sesión)");
  const tableAfter = await prisma.table.findUnique({
    where: { id: ctx.tableId },
    select: { status: true },
  });
  assert.equal(tableAfter.status, "free", "la mesa debe quedar libre tras liberarla");
});

test("flujo mesa híbrido: mesero/cocina del modo híbrido ejecutan el ciclo completo", async () => {
  const mesero = await login(ACCOUNTS.meseroHib.email);
  const gerente = await login(ACCOUNTS.managerHib.email);
  const cocina = await login(ACCOUNTS.cocinaHib.email);
  const { dish } = { dish: ctx.hybDish };
  const qty = 1;
  const subtotal = round2(qty * dish.price);
  const total = round2(subtotal * 1.16);

  // 1) Sentar: el mesero híbrido ocupa la mesa reservada (PUT solo-status → pos.use).
  const seat = await api("/api/tables", {
    cookie: mesero.cookie,
    method: "PUT",
    body: { id: ctx.hybTableId, status: "occupied" },
  });
  assert.equal(seat.status, 200, "el mesero híbrido debe poder ocupar la mesa");

  // 2) Enviar a cocina: primera ronda crea la orden (preparing) en el KDS.
  const send = await api("/api/pos/kitchen", {
    cookie: mesero.cookie,
    method: "POST",
    body: {
      tableId: ctx.hybTableId,
      locationId: ctx.hybLocationId,
      items: [
        {
          key: "hib-e2e",
          productId: dish.id,
          variantId: null,
          productName: dish.name,
          quantity: qty,
          unitPrice: dish.price,
          taxRate: 0.16,
        },
      ],
    },
  });
  assert.equal(send.status, 200, "el envío a cocina debe funcionar para el mesero híbrido");
  const { orderId, orderNumber } = await send.json();
  assert.ok(orderId, "el envío debe devolver la orden creada");
  ctx.createdOrderIds.push(orderId);

  const dbOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { select: { id: true, itemStatus: true } },
      preparation: { select: { id: true } },
    },
  });
  assert.equal(dbOrder.status, "preparing", "la orden híbrida debe quedar preparing");
  assert.equal(dbOrder.tableId, ctx.hybTableId, "la orden debe quedar ligada a la mesa híbrida");
  assert.ok(dbOrder.preparation, "la orden híbrida debe tener preparación (KDS)");

  // 3) El KDS la lista para la sucursal del híbrido.
  const kds = await api(`/api/kds?locationId=${ctx.hybLocationId}`, { cookie: mesero.cookie });
  const kdsBody = await kds.json();
  const kdsRow = kdsBody.orders?.find((o) => o.id === orderId);
  assert.ok(kdsRow, `el KDS debe listar la orden híbrida #${orderNumber}`);

  // 4) Cocina híbrida (kds.operate) avanza el artículo a ready → la orden
  //    completa pasa a ready y sale del tablero antes del cobro.
  const advance = await api("/api/kds", {
    cookie: cocina.cookie,
    method: "PUT",
    body: { orderItemId: kdsRow.items[0].id, status: "ready" },
  });
  assert.equal(advance.status, 200, "la cocina híbrida debe poder marcar ready");
  const afterAdvance = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  assert.equal(afterAdvance.status, "ready", "la orden debe pasar a ready con el artículo listo");

  // 5) Cobro: el gerente híbrido cobra la mesa; la orden ya ready se cierra igual.
  const charge = await api("/api/pos/sales", {
    cookie: gerente.cookie,
    method: "POST",
    body: {
      locationId: ctx.hybLocationId,
      payload: {
        items: [
          {
            productId: dish.id,
            variantId: null,
            productType: "standard",
            productName: dish.name,
            quantity: qty,
            unitId: null,
            unitPrice: dish.price,
            totalPrice: subtotal,
            discount: 0,
            taxRate: 0.16,
            lineTotal: subtotal,
            trackInventory: false,
          },
        ],
        subtotal,
        discount: 0,
        tax: round2(subtotal * 0.16),
        total,
        changeGiven: 0,
        pointsEarned: 0,
        pointsRedeemed: 0,
        pointsRedeemedValue: 0,
        payments: [{ method: "cash", amount: total }],
        discounts: [],
        tableId: ctx.hybTableId,
      },
    },
  });
  assert.equal(charge.status, 200, "el cobro de la mesa debe funcionar para el gerente híbrido");
  const saleId = (await charge.json())?.sale?.id;
  assert.ok(saleId, "el cobro debe devolver la venta");
  ctx.createdSaleIds.push(saleId);

  // 6) Orden entregada + venta ligada + pagada, aunque kitchen la dejó ready.
  const closed = await prisma.order.findUnique({ where: { id: orderId } });
  assert.equal(closed.status, "delivered", "la orden debe cerrarse al cobrar");
  assert.equal(closed.saleId, saleId, "la orden debe quedar ligada a la venta");
  assert.ok(closed.paidAt, "la orden debe quedar pagada");

  // 7) La mesa híbrida queda libre y sin sesión abierta.
  const tableAfter = await prisma.table.findUnique({
    where: { id: ctx.hybTableId },
    select: { status: true },
  });
  assert.equal(tableAfter.status, "free", "la mesa híbrida debe quedar libre tras el cobro");
  const openSessions = await prisma.tableSession.count({
    where: { tableId: ctx.hybTableId, endedAt: null },
  });
  assert.equal(openSessions, 0, "no debe quedar sesión abierta en la mesa híbrida");
});

test("multi-org: el owner retoma su última organización tras volver a entrar", async () => {
  // Fixtures: Ana (owner con membresías en las 5 orgs de demo) y Fiestas Demo.
  const ana = await prisma.user.findUnique({
    where: { email: "demo@multi-pos.com" },
    select: { id: true, lastOrganizationId: true },
  });
  assert.ok(ana, "El owner de demo (demo@multi-pos.com) debe existir");
  const fiestas = await prisma.organization.findFirst({
    where: { name: "Fiestas Demo" },
    select: { id: true },
  });
  assert.ok(fiestas, "Fiestas Demo debe existir");
  const member = await prisma.membership.findFirst({
    where: { userId: ana.id, organizationId: fiestas.id },
    select: { id: true },
  });
  assert.ok(member, "Ana debe tener membresía en Fiestas Demo");
  const original = ana.lastOrganizationId;

  try {
    // 1) Cambiar de org como lo hace el switcher: update({ activeOrganizationId })
    //    → POST /api/auth/session con { csrfToken, data } (flujo real del cliente).
    const s = await login("demo@multi-pos.com");
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: { Cookie: s.cookie } });
    const csrf = await csrfRes.json();
    const csrfCookie = csrfRes.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const switched = await fetch(`${BASE}/api/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: [s.cookie, csrfCookie].filter(Boolean).join("; "),
      },
      body: JSON.stringify({ csrfToken: csrf.csrfToken, data: { activeOrganizationId: fiestas.id } }),
    });
    assert.equal(switched.status, 200, "el update de sesión debe responder 200");
    const switchedBody = await switched.json();
    assert.equal(
      switchedBody?.user?.activeOrganizationId,
      fiestas.id,
      "la sesión debe quedar en Fiestas Demo tras el cambio"
    );
    const stored = await prisma.user.findUnique({
      where: { id: ana.id },
      select: { lastOrganizationId: true },
    });
    assert.equal(stored.lastOrganizationId, fiestas.id, "el cambio debe quedar recordado en BD");

    // 2) Cerrar y volver a entrar: nueva sesión, debe retomar Fiestas Demo.
    const relog = await login("demo@multi-pos.com");
    const sess = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: relog.cookie } });
    assert.equal(sess.status, 200, "GET /api/auth/session debe responder 200");
    const sessBody = await sess.json();
    assert.equal(
      sessBody?.user?.activeOrganizationId,
      fiestas.id,
      "el re-login debe retomar la organización recordada"
    );
  } finally {
    // Restaurar el valor previo para no desplazar la demo.
    await prisma.user.update({
      where: { id: ana.id },
      data: { lastOrganizationId: original },
    });
  }
});

test("flujo entrega: iniciar entrega y entregar difunden order_removed por el stream del KDS", async () => {
  const courier = await login(ACCOUNTS.courier.email);

  // Fixture directo: pedido a domicilio "ready" de la org del repartidor
  // (Supermercado Demo). La ruta /api/orders/[id]/deliver exige ready+delivery.
  const order = await prisma.order.create({
    data: {
      organizationId: ctx.courierOrgId,
      locationId: ctx.courierLocationId,
      status: "ready",
      deliveryMethod: "delivery",
      notes: "Cliente SSE",
      address: "Calle Falsa 123, Col. Test",
      subtotal: ctx.courierDish.price,
      total: ctx.courierDish.price,
      items: {
        create: [
          {
            productName: ctx.courierDish.name,
            productType: "standard",
            quantity: 1,
            unitPrice: ctx.courierDish.price,
            lineTotal: ctx.courierDish.price,
            itemStatus: "ready",
          },
        ],
      },
    },
    select: { id: true, orderNumber: true },
  });
  ctx.createdOrderIds.push(order.id);

  // Suscribirse al stream ANTES de las transiciones (no perder eventos).
  const sse = await subscribeKdsStream(courier.cookie, "repartidor");
  try {
    // 1) Salir en camino: ready → in_transit. El canal KDS debe difundir
    //    order_removed (la orden ya no está en el tablero de cocina).
    const start = await api(`/api/orders/${order.id}/deliver`, {
      cookie: courier.cookie,
      method: "POST",
      body: {},
    });
    assert.equal(start.status, 200, "el repartidor debe poder iniciar la entrega");
    const removedOnStart = await sse.waitFor("order_removed", order.id);
    assert.equal(
      removedOnStart.payload.status,
      "in_transit",
      "order_removed al salir debe traer in_transit"
    );

    // 2) Confirmar llegada: in_transit → at_destination (también espejo KDS).
    const arrive = await api(`/api/orders/${order.id}/confirm-arrival`, {
      cookie: courier.cookie,
      method: "POST",
      body: {},
    });
    assert.equal(arrive.status, 200, "el repartidor debe poder confirmar llegada");
    const removedOnArrive = await sse.waitFor("order_removed", order.id, {
      after: removedOnStart,
    });
    assert.equal(
      removedOnArrive.payload.status,
      "at_destination",
      "order_removed al llegar debe traer at_destination"
    );

    // 3) Confirmar entrega: at_destination → delivered. order_removed de nuevo.
    const row = await prisma.order.findUnique({
      where: { id: order.id },
      select: { deliveryPin: true },
    });
    assert.ok(row?.deliveryPin, "la llegada debe generar el PIN de entrega");
    const deliver = await api(`/api/orders/${order.id}/confirm-delivery`, {
      cookie: courier.cookie,
      method: "POST",
      body: { pin: row.deliveryPin },
    });
    assert.equal(deliver.status, 200, "el repartidor debe poder confirmar la entrega con PIN");
    const removedOnDeliver = await sse.waitFor("order_removed", order.id, {
      after: removedOnArrive,
    });
    assert.equal(
      removedOnDeliver.payload.status,
      "delivered",
      "order_removed al entregar debe traer delivered"
    );

    // 4) Estado final en BD: delivered y sin PIN residual.
    const final = await prisma.order.findUnique({
      where: { id: order.id },
      select: { status: true, deliveryPin: true },
    });
    assert.equal(final.status, "delivered");
    assert.equal(final.deliveryPin, null);
  } finally {
    sse.close();
  }
});

test("imágenes: subida round-trip con org-scoping y guardas de permisos", async () => {
  // ── 0) Sin sesión, la subida es 401 ─────────────────────────────────
  const anon = await uploadImage(null);
  assert.equal(anon.status, 401, "subir sin sesión debe ser 401");

  const s = await login("demo@multi-pos.com");

  // ── 1) Rechazos de contenido (autenticado) ──────────────────────────
  const badType = await uploadImage(s.cookie, { filename: "nota.txt", type: "text/plain", bytes: Buffer.from("hola") });
  assert.equal(badType.status, 415, "subir un .txt debe ser 415");

  const big = await uploadImage(s.cookie, { bytes: Buffer.alloc(5 * 1024 * 1024 + 1) });
  assert.equal(big.status, 413, "subir >5MB debe ser 413");

  // ── 2) La carga usa la org activa de la sesión ──────────────
  //   La org activa es la recordada del owner (varía según la última
  //   sesión); el archivo debe quedar bajo public/uploads/<org-activa>/ y
  //   el producto objetivo se elige de ESA org para que el round-trip sea
  //   coherente e independiente del orden de ejecución de las pruebas.
  const sess = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: s.cookie } });
  const activeOrg = (await sess.json())?.user?.activeOrganizationId;
  assert.ok(activeOrg, "la sesión debe traer una organización activa");

  const up = await uploadImage(s.cookie, { filename: "probe-rt.png", bytes: await bigProbePng() });
  assert.equal(up.status, 200, "subida autenticada debe ser 200");
  const upBody = await up.json();
  assert.ok(upBody.ok, "la subida debe responder ok:true");
  const url = upBody.url ?? "";
  assert.match(url, new RegExp(`^/uploads/${activeOrg}/[0-9a-f-]+\\.webp$`), "la URL debe vivir bajo la org activa y ser .webp (recompresión)");
  ctx.uploadProbeUrls.push(url);

  // El archivo debe servirse de verdad: 200, content-type WebP y magic bytes
  // válidos (el servidor re-codifica con sharp, el original era PNG).
  const served = await fetch(`${BASE}${url}`);
  assert.equal(served.status, 200, "el archivo subido debe servirse por HTTP");
  assert.match(served.headers.get("content-type") ?? "", /image\/webp/, "el archivo debe servirse como WebP");
  const servedBytes = Buffer.from(await served.arrayBuffer());
  assert.ok(
    servedBytes.length > 12 &&
      servedBytes.slice(0, 4).toString("ascii") === "RIFF" &&
      servedBytes.slice(8, 12).toString("ascii") === "WEBP",
    "el archivo guardado debe ser un WebP válido (magic bytes)"
  );

  // Miniatura: la subida genera el par <uuid>.webp + <uuid>-thumb.webp (256px)
  // y ambos se sirven por HTTP como WebP válido.
  assert.match(upBody.thumbUrl ?? "", new RegExp(`^/uploads/${activeOrg}/[0-9a-f-]+-thumb\\.webp$`), "la respuesta debe traer la URL de la miniatura");
  ctx.uploadProbeUrls.push(upBody.thumbUrl);
  assert.ok(upBody.thumbUrl.startsWith(url.replace(/\.webp$/, "")), "la miniatura comparte el nombre base del original");

  const thumbRes = await fetch(`${BASE}${upBody.thumbUrl}`);
  assert.equal(thumbRes.status, 200, "la miniatura debe servirse por HTTP");
  assert.match(thumbRes.headers.get("content-type") ?? "", /image\/webp/, "la miniatura debe servirse como WebP");
  const thumbBytes = Buffer.from(await thumbRes.arrayBuffer());
  assert.ok(
    thumbBytes.length > 12 &&
      thumbBytes.slice(0, 4).toString("ascii") === "RIFF" &&
      thumbBytes.slice(8, 12).toString("ascii") === "WEBP",
    "la miniatura debe ser un WebP válido (magic bytes)"
  );
  assert.ok(thumbBytes.length < servedBytes.length, "la miniatura debe pesar menos que la imagen completa");
  // Y realmente es 256px (sin ampliación, el gradiente 1200×800 da 256×171).
  const { default: sharp } = await import("sharp");
  const thumbMeta = await sharp(thumbBytes).metadata();
  assert.ok(
    thumbMeta.width <= 256 && thumbMeta.height <= 256,
    `la miniatura debe caber en 256px (llegó ${thumbMeta.width}×${thumbMeta.height})`
  );

  // ── 3) Elegir un producto real de la org activa y hacer el PATCH ────
  const list = await api("/api/crud/products?pageSize=1", { cookie: s.cookie });
  assert.equal(list.status, 200, "el listado de productos debe ser 200 para el owner");
  const target = (await list.json())?.rows?.[0];
  assert.ok(target?.id, "la org activa debe tener al menos un producto");
  ctx.uploadProductId = target.id;
  ctx.uploadOriginalImageUrl = target.imageUrl ?? null;

  const patch = await api(`/api/crud/products/${target.id}`, {
    cookie: s.cookie,
    method: "PATCH",
    body: { imageUrl: url },
  });
  assert.equal(patch.status, 200, "el PATCH de imageUrl debe funcionar para el owner");

  // ── 4) Lectura (GET) confirma la persistencia ───────────────────────
  const get = await api(`/api/crud/products/${target.id}`, { cookie: s.cookie });
  assert.equal(get.status, 200, "el GET del producto debe ser 200");
  const after = (await get.json())?.row;
  assert.equal(after.imageUrl, url, "el GET debe devolver la nueva imageUrl");

  // Confirmación directa en BD.
  const dbRow = await prisma.product.findUnique({
    where: { id: target.id },
    select: { imageUrl: true },
  });
  assert.equal(dbRow.imageUrl, url, "la BD debe reflejar la nueva imageUrl");

  // ── 5) Org-scoping del CRUD: un manager de UNA sola org (Restaurante
  //   Demo) no ve productos de otras orgs. Según de qué org sea el producto
  //   objetivo (la org activa del owner varía), se verifica el 404 cruzado
  //   con el producto ajeno que corresponda.
  const restManager = await login(ACCOUNTS.manager.email);
  if (target.organizationId !== ctx.orgId) {
    const foreignGet = await api(`/api/crud/products/${target.id}`, { cookie: restManager.cookie });
    assert.equal(foreignGet.status, 404, "el producto de otra org debe ser invisible (404)");
    const foreignPatch = await api(`/api/crud/products/${target.id}`, {
      cookie: restManager.cookie,
      method: "PATCH",
      body: { imageUrl: "/uploads/hack.png" },
    });
    assert.equal(foreignPatch.status, 404, "el PATCH cruzado debe ser 404");
  } else {
    assert.ok(target.organizationId === ctx.orgId, "objetivo de la propia org");
    const sm = await prisma.product.findFirst({
      where: { organizationId: ctx.courierOrgId },
      select: { id: true },
    });
    assert.ok(sm, "Supermercado Demo debe tener productos");
    const cross = await api(`/api/crud/products/${sm.id}`, { cookie: restManager.cookie });
    assert.equal(cross.status, 404, "un producto de otra org debe ser 404 para este manager");
    const crossPatch = await api(`/api/crud/products/${sm.id}`, {
      cookie: restManager.cookie,
      method: "PATCH",
      body: { imageUrl: "/uploads/hack.png" },
    });
    assert.equal(crossPatch.status, 404, "el PATCH cruzado debe ser 404");
  }

  // ── 6) Org-scoping del upload: cada subida autenticada cae bajo la org
  //   activa de la sesión (misma regla que la primera subida).
  const scopedUpload = await uploadImage(s.cookie, { filename: "probe-scope.png" });
  assert.equal(scopedUpload.status, 200, "segunda subida debe ser 200");
  const scopedBody = await scopedUpload.json();
  assert.match(
    scopedBody.url ?? "",
    new RegExp(`^/uploads/${activeOrg}/`),
    "las subidas deben quedar bajo la org activa de la sesión"
  );
  assert.match(scopedBody.url ?? "", /\.webp$/, "toda imagen subida se re-codifica a WebP");
  ctx.uploadProbeUrls.push(scopedBody.url);

  // ── 7) Restore: el after() global restaura la imageUrl original y borra
  //   los archivos subidos; la prueba no depende de eso para sus aserciones.
  //   depende de eso para las aserciones (el estado queda verificado arriba).
});

test("seed híbrido: owner con businessMode=hybrid y launcher de 11 wizards", async () => {
  // El seed debe dejar Híbrido Demo lista para demostrar el modo completo:
  // owner que entra directo a la org (picker de login) con sesión hybrid y
  // el set de wizards del dashboard completo (MODE_WIZARDS.hybrid = 11).
  const hibridoOrg = await prisma.organization.findFirst({
    where: { businessMode: "hybrid" },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  assert.ok(hibridoOrg, "el seed debe crear una organización con businessMode=hybrid (Híbrido Demo)");

  // ── 1) El owner entra DIRECTO a Híbrido Demo vía picker del login ──
  const s = await login("demo@multi-pos.com", hibridoOrg.id);
  const sess = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: s.cookie } });
  const user = await sess.json();
  assert.equal(user?.user?.activeOrganizationId, hibridoOrg.id, "el picker del login debe activar Híbrido Demo");
  assert.equal(user?.user?.businessMode, "hybrid", "la sesión debe llevar businessMode=hybrid");
  assert.equal(user?.user?.role, "owner", "el owner debe entrar como owner");

  // ── 2) El launcher debe poder renderizar las 11 tarjetas del modo ──
  //   Se lee MODE_WIZARDS.hybrid del fuente (lib/business-modes.ts): si
  //   alguien agrega/quita un wizard del modo híbrido, este assert lo hace
  //   visible junto con el cambio.
  const { readFileSync } = await import("node:fs");
  const modesSrc = readFileSync(
    new URL("../src/lib/business-modes.ts", import.meta.url),
    "utf8"
  );
  const hybridMatch = modesSrc.match(/hybrid:\s*\[([^\]]+)\]/);
  assert.ok(hybridMatch, "MODE_WIZARDS.hybrid debe existir en business-modes.ts");
  const expectedKinds = [...hybridMatch[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  assert.equal(expectedKinds.length, 11, `el modo híbrido debe exponer 11 wizards (tiene ${expectedKinds.length}: ${expectedKinds.join(", ")})`);
  // Cada wizard del modo debe tener su definición WIZARD_ACTIONS (href+permiso).
  const definedKinds = [...modesSrc.matchAll(/^\s{2}([a-z_]+):\s*{/gm)].map((m) => m[1]);
  for (const kind of expectedKinds) {
    assert.ok(definedKinds.includes(kind), `wizard «${kind}» debe tener entrada en WIZARD_ACTIONS`);
  }

  // El launcher filtra por permisos: el owner (todos los permisos) debe ver
  // los 11. El dashboard alimenta productCount/totalSales — verifica que la
  // sesión híbrida consulta bien su panel.
  const catalogProbe = await api("/api/reports?type=dashboard", { cookie: s.cookie });
  assert.equal(catalogProbe.status, 200, "el dashboard debe responder 200 para el owner híbrido");
  const dash = await catalogProbe.json();
  assert.equal(typeof dash?.data?.productCount, "number", "el dashboard debe traer productCount (input del launcher)");
});

test("guía del POS: el mesero híbrido ve Mesa/KDS; el cajero de retail no la ve", async () => {
  // 1) Mesero híbrido (system-hybrid-waiter): llega al POS (pos.use) con la
  //    sesión del modo hybrid y los permisos que encienden los botones de la
  //    guía: locations.view → «Mesas», orders.view → «Cocina (KDS)».
  const mesero = await login(ACCOUNTS.meseroHib.email);
  const msess = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: mesero.cookie } });
  const m = await msess.json();
  assert.equal(m?.user?.businessMode, "hybrid", "el mesero híbrido opera en Híbrido Demo (businessMode=hybrid)");
  const mPerms = m?.user?.permissions ?? [];
  assert.ok(
    mPerms.includes("locations.view"),
    "el mesero híbrido debe tener locations.view → botón Mesas"
  );
  assert.ok(
    mPerms.includes("orders.view"),
    "el mesero híbrido debe tener orders.view → botón Cocina (KDS)"
  );
  const posM = await api("/pos", { cookie: mesero.cookie });
  assert.equal(posM.status, 200, "el mesero híbrido debe operar el POS (pos.use)");

  // 2) Cajero del Supermercado Demo (retail): aunque system-cashier trae los
  //    mismos permisos, su org NO es food_service/hybrid → la guía no se monta
  //    y el menú del header tampoco ofrece la entrada.
  const cajero = await login(ACCOUNTS.cashierSup.email);
  const csess = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cajero.cookie } });
  const c = await csess.json();
  assert.equal(c?.user?.businessMode, "retail", "Supermercado Demo es retail");
  const posC = await api("/pos", { cookie: cajero.cookie });
  assert.equal(posC.status, 200, "el cajero de retail opera el POS igual");

  // 3) Contrato de fuente (mismo patrón que el test del seed híbrido): la
  //    guía se monta solo en food_service/hybrid, sus botones se llaman
  //    «Mesas» y «Cocina (KDS)» (cada uno tras su permiso) y el menú del
  //    header la reabre vía onOpenGuide tras descartarla.
  const { readFileSync } = await import("node:fs");
  const posApp = readFileSync(
    new URL("../src/components/pos/pos-app.tsx", import.meta.url),
    "utf8"
  );
  assert.match(
    posApp,
    /orgMode === "food_service" \|\| orgMode === "hybrid"/,
    "la guía debe montarse solo en modos food_service/hybrid"
  );
  const guide = readFileSync(
    new URL("../src/components/pos/pos-role-guide.tsx", import.meta.url),
    "utf8"
  );
  assert.match(
    guide,
    /const canTables = usePermission\("locations\.view"\)/,
    "el botón Mesas debe regirse por locations.view"
  );
  assert.match(
    guide,
    /const canKds = usePermission\("orders\.view"\)/,
    "el botón Cocina (KDS) debe regirse por orders.view"
  );
  assert.match(guide, /> Mesas/, "la guía debe ofrecer el botón «Mesas»");
  assert.match(guide, /> Cocina \(KDS\)/, "la guía debe ofrecer el botón «Cocina (KDS)»");
  const header = readFileSync(
    new URL("../src/components/pos/pos-header.tsx", import.meta.url),
    "utf8"
  );
  assert.match(header, /Guía del POS/, "el menú del header debe ofrecer «Guía del POS»");
  assert.match(header, /onOpenGuide/, "la entrada del menú debe reabrir la guía vía onOpenGuide");
});

test("lista de espera: el cliente se anota y recibe aviso cuando se libera una mesa que le cabe", async () => {
  const customer = await login(ACCOUNTS.waitlistCustomer.email);

  // Fixture: limpiar entradas activas que pudieran quedar de corridas previas
  // (el after() global solo borra las de la corrida actual) y ocupar la mesa 4
  // por si quedó libre del flujo híbrido → simular "sin disponibilidad".
  await prisma.tableWaitlist.deleteMany({
    where: { organizationId: ctx.hybOrgId, status: { in: ["waiting", "available"] } },
  });
  await prisma.table.update({ where: { id: ctx.hybTableId }, data: { status: "occupied" } });

  // 1) Sin disponibilidad: el cliente se anota (2 personas) → waiting.
  const enroll = await fetch(`${BASE}/api/portal/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: customer.cookie },
    body: JSON.stringify({ guests: 2 }),
  });
  assert.equal(enroll.status, 200, "el cliente debe poder anotarse a la lista");
  const enrollBody = await enroll.json();
  assert.equal(enrollBody.entry?.status, "waiting", "la entrada inicia en waiting (sin mesas libres)");
  const entryId = enrollBody.entry?.id;
  assert.ok(entryId, "la entrada debe tener id");
  ctx.waitlistEntryIds.push(entryId);

  // 2) El mesero libera la mesa 4 del híbrido (cap 4 ≥ 2): el broadcast dispara
  //    el barrido → la entrada pasa a available con esa mesa.
  const mesero = await login(ACCOUNTS.meseroHib.email);
  const free = await api("/api/tables", {
    cookie: mesero.cookie,
    method: "PUT",
    body: { id: ctx.hybTableId, status: "free" },
  });
  assert.equal(free.status, 200, "el mesero debe poder liberar la mesa");

  const state = await fetch(`${BASE}/api/portal/waitlist`, { headers: { Cookie: customer.cookie } });
  const stateBody = await state.json();
  assert.equal(stateBody.entry?.status, "available", "la entrada debe pasar a available al liberarse la mesa");
  assert.equal(stateBody.entry?.availableTable?.number, 4, "debe ofrecer la mesa 4 liberada");

  // 3) Aviso en vivo persistido: notificación de mesa disponible para el usuario.
  const cust = await prisma.customer.findFirst({
    where: { user: { email: ACCOUNTS.waitlistCustomer.email } },
    select: { userId: true },
  });
  assert.ok(cust?.userId, "el cliente portal debe tener userId");
  const notif = await prisma.notification.findFirst({
    where: { userId: cust.userId, kind: "table-waitlist" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
  assert.ok(notif, "debe persistirse la notificación de mesa disponible");
  assert.match(notif.title, /Mesa disponible/, "la notificación debe anunciar la mesa");
  ctx.waitlistNotifIds.push(notif.id);

  // 4) El cliente confirma: se crea la reservación con la mesa y la entrada
  //    cierra como seated ligada a la mesa liberada.
  const claim = await fetch(`${BASE}/api/portal/waitlist/claim`, {
    method: "POST",
    headers: { Cookie: customer.cookie },
  });
  assert.equal(claim.status, 200, "el cliente debe poder confirmar la mesa liberada");
  const claimBody = await claim.json();
  const resId = claimBody.reservation?.id;
  assert.ok(resId, "el claim debe crear la reservación");
  ctx.createdWaitlistReservationIds.push(resId);

  const closedEntry = await prisma.tableWaitlist.findUnique({
    where: { id: entryId },
    select: { status: true, seatedTableId: true },
  });
  assert.equal(closedEntry.status, "seated", "la entrada cierra como seated tras confirmar");
  assert.equal(closedEntry.seatedTableId, ctx.hybTableId, "debe quedar ligada a la mesa liberada");
  const resRow = await prisma.tableReservation.findUnique({
    where: { id: resId },
    select: { tableId: true, guests: true },
  });
  assert.equal(resRow.tableId, ctx.hybTableId, "la reservación usa la mesa liberada");
  assert.equal(resRow.guests, 2, "la reservación conserva los comensales");
});

test("reservación sin cuenta: nombre+teléfono crean reservación de invitado vía /api/public/reservations", async () => {
  // La ruta pública NO exige sesión: se resuelve la org desde el QR de mesa
  // (par table+token del seed) y basta nombre+teléfono en el body.
  const qr = "table=demo-hyb-t4&token=demo-hyb-qr-t4";

  // 1) Disponibilidad pública (GET sin cookie) responde con salas/mesas.
  const availability = await fetch(
    `${BASE}/api/public/reservations?${qr}&date=2030-01-15&guests=2`
  );
  assert.equal(availability.status, 200, "la disponibilidad pública debe ser 200");
  const availBody = await availability.json();
  assert.ok(availBody.ok, "la disponibilidad debe venir con ok:true");
  assert.ok(Array.isArray(availBody.rooms), "debe listar las salas");
  const total = availBody.rooms.reduce((n, r) => n + (r.tables?.length ?? 0), 0);
  assert.ok(total > 0, "el híbrido debe tener mesas visibles en el plano");

  // 2) Sin nombre → 400.
  const noName = await fetch(`${BASE}/api/public/reservations?${qr}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startsAt: "2030-01-15T13:00:00.000Z",
      guests: 2,
      phone: "5512345678",
    }),
  });
  assert.equal(noName.status, 400, "sin nombre debe rechazarse con 400");

  // 3) Con nombre+teléfono → crea la reservación ligada a esos datos.
  const created = await fetch(`${BASE}/api/public/reservations?${qr}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startsAt: "2030-01-15T13:00:00.000Z",
      guests: 2,
      name: "María García",
      phone: "5512345678",
      tableId: ctx.hybTableId,
    }),
  });
  assert.equal(created.status, 200, "nombre+teléfono deben crear la reservación");
  const createdBody = await created.json();
  const guestResId = createdBody.reservation?.id;
  assert.ok(guestResId, "la reservación debe devolver su id");
  ctx.guestReservationIds.push(guestResId);

  // 4) La fila queda ligada a los datos del invitado (sin customer).
  const row = await prisma.tableReservation.findUnique({
    where: { id: guestResId },
    select: { name: true, phone: true, customerId: true, organizationId: true, tableId: true },
  });
  assert.equal(row.name, "María García", "la reservación guarda el nombre del invitado");
  assert.equal(row.phone, "5512345678", "la reservación guarda el teléfono del invitado");
  assert.equal(row.customerId, null, "el invitado no queda ligado a una cuenta");
  assert.equal(row.organizationId, ctx.hybOrgId, "la org se resuelve desde el QR de mesa");
  assert.equal(row.tableId, ctx.hybTableId, "la reservación usa la mesa pedida");

  // 5) El anfitrión (gerente híbrido) ve la reservación con el invitado.
  const manager = await login(ACCOUNTS.managerHib.email);
  const list = await api("/api/table-reservations", { cookie: manager.cookie });
  assert.equal(list.status, 200, "el anfitrión debe poder listar reservaciones");
  const listBody = await list.json();
  const visible = listBody.reservations?.find((r) => r.id === guestResId);
  assert.ok(visible, "la reservación de invitado aparece en el gestor");
  assert.equal(visible.name, "María García", "el gestor muestra el nombre del invitado");
  assert.equal(visible.phone, "5512345678", "el gestor muestra el teléfono del invitado");
  assert.equal(visible.customer, null, "el gestor sabe que no tiene cuenta");
});