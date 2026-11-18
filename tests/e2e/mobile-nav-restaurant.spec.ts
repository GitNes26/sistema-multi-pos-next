import { test, expect, type Page } from "@playwright/test"

// 1) Celular: al cambiar de página en el panel, la pantalla debe seguir respondiendo al toque (sin capas invisibles
//    ni bloqueos en <body>). 2) Restaurante: el menú muestra lo suyo (y solo lo suyo) y sus pantallas cargan sin
//    errores de página ni respuestas 5xx.

test.setTimeout(90_000)

async function fillLogin(page: Page, identifier: string, password: string) {
  await page.waitForLoadState("networkidle")
  await expect(async () => {
    await page.locator("#identifier").fill(identifier)
    await page.locator("#password").fill(password)
    await expect(page.locator("#identifier")).toHaveValue(identifier)
    await expect(page.locator("#password")).toHaveValue(password)
  }).toPass({ timeout: 60_000 })
}

async function loginOwner(page: Page, email = "demo@multi-pos.com") {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" })
  await expect(page.locator("#identifier")).toBeVisible({ timeout: 30_000 })
  await fillLogin(page, email, "demo1234")
  await page.getByRole("button", { name: /^entrar/i }).click()
  await page.waitForURL((url) => url.pathname.startsWith("/admin"), { timeout: 120_000, waitUntil: "domcontentloaded" })
}

/** ¿Algo cubre el centro de la pantalla o el body bloquea los toques? */
async function interactionState(page: Page) {
  return page.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
    const covering = el && getComputedStyle(el).position === "fixed" && el.closest("main") === null ? (el as HTMLElement).className || el.tagName : null
    return { bodyPointerEvents: getComputedStyle(document.body).pointerEvents, covering }
  })
}

test.describe("celular: navegar entre páginas del panel", () => {
  test("después de cambiar de página la pantalla sigue respondiendo", async ({ page, isMobile }) => {
    test.skip(!isMobile, "solo aplica al celular")
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.addInitScript(() => localStorage.setItem("mp.nav.all", "1"))
    await loginOwner(page)

    const hops = ["/admin/sales", "/admin/profit", "/admin/reports", "/admin/notifications"]
    for (const href of hops) {
      // 1) Abrir el menú lateral, tocar un enlace: debe navegar y cerrarse.
      await page.getByRole("button", { name: "Abrir menú" }).tap()
      await page.locator(`[role="dialog"] aside a[href="${href}"]`).first().tap()
      await page.waitForURL((u) => u.pathname === href, { timeout: 60_000, waitUntil: "domcontentloaded" })
      await expect(page.getByRole("dialog", { name: "Menú de navegación" })).toHaveCount(0, { timeout: 10_000 })

      // 2) Sin recargar: el estado de interacción es sano y se puede volver a abrir el menú con un toque.
      await expect.poll(async () => (await interactionState(page)).bodyPointerEvents, { timeout: 5_000 }).not.toBe("none")
      await page.getByRole("button", { name: "Abrir menú" }).tap()
      await expect(page.getByRole("dialog", { name: "Menú de navegación" }).locator("aside")).toBeVisible({ timeout: 5_000 })
      await page.locator('[role="dialog"] > button[aria-label="Cerrar menú"]').tap({ position: { x: (page.viewportSize()?.width ?? 360) - 8, y: 400 } })
      await expect(page.getByRole("dialog", { name: "Menú de navegación" })).toHaveCount(0, { timeout: 10_000 })
    }
    expect(errors).toEqual([])
  })

  test("con la barra inferior también responde tras cada cambio", async ({ page, isMobile }) => {
    test.skip(!isMobile, "solo aplica al celular")
    await loginOwner(page)
    // El menú viene de la base y la barra puede cambiar sus enlaces al terminar de cargar: se espera y se lee en cada paso.
    await page.waitForLoadState("networkidle").catch(() => undefined)
    const bar = page.locator('nav[aria-label="Navegación principal"]')
    const links = bar.locator('a[href^="/admin"]')
    const total = Math.min(await links.count(), 4)
    expect(total, "la barra inferior debe traer enlaces del panel").toBeGreaterThan(1)
    for (let i = 0; i < total; i++) {
      const href = (await links.nth(i).getAttribute("href")) ?? "/admin"
      await links.nth(i).tap()
      await page.waitForURL((u) => u.pathname === href, { timeout: 60_000, waitUntil: "domcontentloaded" })
      await expect.poll(async () => (await interactionState(page)).covering, { timeout: 5_000 }).toBeNull()
      expect((await interactionState(page)).bodyPointerEvents).not.toBe("none")
    }
  })
})

test.describe("restaurante", () => {
  test.use({ viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false })

  const PAGES = ["/admin", "/admin/tables", "/admin/orders", "/admin/products", "/admin/combos", "/admin/promotions", "/admin/inventory", "/admin/sales", "/admin/customers", "/admin/loyalty-programs", "/admin/settings", "/kds", "/pos"]

  // El gerente del restaurante entra directo a su negocio (sin cambiar de organización, que se recuerda entre sesiones).
  async function enterRestaurant(page: Page) {
    await page.addInitScript(() => localStorage.setItem("mp.nav.all", "1"))
    await loginOwner(page, "gerente-rest@demo.multi-pos.com")
    await expect.poll(async () => (await (await page.request.get("/api/auth/session")).json())?.user?.businessMode, { timeout: 30_000 }).toBe("food_service")
  }

  test("el menú muestra lo del restaurante y oculta lo que no le toca", async ({ page }) => {
    await enterRestaurant(page)
    await page.goto("/admin", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle").catch(() => undefined)
    const sidebar = page.locator("aside").first()
    // Las secciones del menú arrancan plegadas (excepto Principal): se despliegan.
    for (const section of ["Catálogos", "Operación"]) await sidebar.getByRole("button", { name: section, exact: true }).click()
    for (const label of ["Mesas", "Cocina (KDS)", "Fidelidad", "Pedidos"]) await expect(sidebar.getByRole("link", { name: label })).toBeVisible({ timeout: 30_000 })
    for (const label of ["Garantías", "Bahías y lugares", "Órdenes de servicio", "Pantalla de turnos", "Vehículos y fichas", "Reservaciones", "Agenda de citas"]) {
      await expect(sidebar.getByRole("link", { name: label })).toHaveCount(0)
    }
  })

  test("sus pantallas cargan sin errores ni respuestas 5xx", async ({ page }) => {
    const pageErrors: string[] = []
    const serverErrors: string[] = []
    page.on("pageerror", (e) => pageErrors.push(e.message))
    page.on("response", (r) => {
      if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`)
    })
    await enterRestaurant(page)
    for (const path of PAGES) {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" })
      expect(res?.status() ?? 0, `estado de ${path}`).toBeLessThan(400)
      await page.waitForLoadState("networkidle").catch(() => undefined)
      await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error|Algo salió mal/i)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `desborde en ${path}`).toBe(true)
    }
    expect(pageErrors, "errores de página").toEqual([])
    expect(serverErrors, "respuestas 5xx").toEqual([])
  })

  test("lo que no aplica al restaurante muestra el aviso, no la pantalla", async ({ page }) => {
    await enterRestaurant(page)
    for (const path of ["/admin/warranties", "/admin/stations", "/admin/service-orders"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" })
      await page.waitForLoadState("networkidle").catch(() => undefined)
      await expect(page.getByText(/no disponible para tu tipo de negocio|no aplican? a tu tipo/i).first(), path).toBeVisible({ timeout: 30_000 })
    }
  })

  test("el punto de venta muestra el menú y permite agregar un platillo", async ({ page }) => {
    await enterRestaurant(page)
    await page.goto("/pos", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle").catch(() => undefined)
    const dish = page.getByRole("button", { name: /^Agregar Huevos al gusto$/ })
    await expect(dish).toBeVisible({ timeout: 60_000 })
    await dish.click()
    await expect(page.getByText(/1 artículo/)).toBeVisible({ timeout: 15_000 })
  })
})
