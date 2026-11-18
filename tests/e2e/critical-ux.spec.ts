import { test, expect, type Page } from "@playwright/test"

async function loginOwner(page: Page) {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" })
  await expect(page.locator("#identifier")).toBeFocused({ timeout: 15_000 })
  await page.locator("#identifier").fill("demo@multi-pos.com")
  await page.locator("#password").fill("demo1234")
  await page.getByRole("button", { name: /^entrar/i }).click()
  await page.waitForURL((url) => url.pathname.startsWith("/admin"), { timeout: 45_000, waitUntil: "domcontentloaded" })
}

async function loginPortal(page: Page) {
  await page.goto("/portal/auth/login", { waitUntil: "domcontentloaded" })
  await expect(page.getByTestId("app-splash")).toBeHidden({ timeout: 30_000 })
  await expect(page.locator("#identifier")).toBeFocused({ timeout: 15_000 })
  await page.locator("#identifier").fill("hcli-001@hibrido.local")
  await page.locator("#password").fill("demo1234")
  await page.getByRole("button", { name: /^entrar/i }).click()
  await page.waitForURL((url) => url.pathname === "/portal", { timeout: 45_000, waitUntil: "domcontentloaded" })
}

// Los campos de CrudForm llevan id con prefijo aleatorio; se localizan por la clave del campo.
const supplierName = (page: Page) => page.locator('#supplier-form [id$="-f-businessName"]')

test("proveedor: foco inicial y Enter guarda el formulario", async ({ page }, testInfo) => {
  await loginOwner(page)
  await page.goto("/admin/purchasing", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "Nuevo proveedor" }).click()
  await expect(supplierName(page)).toBeFocused()
  await supplierName(page).press("Enter")
  await expect(supplierName(page)).toHaveAttribute("aria-invalid", "true")
  await expect(supplierName(page)).toBeFocused()
  const name = `Proveedor UX ${testInfo.project.name} ${Date.now()}`
  await supplierName(page).fill(name)
  await supplierName(page).press("Enter")
  await expect(page.getByRole("dialog", { name: "Nuevo proveedor" })).toBeHidden({ timeout: 30_000 })
  await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: testInfo.outputPath("proveedor-guardado.png"), fullPage: true })
})

test("compras: cotización y orden validan por Enter y conservan los totales", async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await loginOwner(page)
  await page.goto("/admin/purchasing", { waitUntil: "domcontentloaded" })
  const supplierResponse = await page.request.post("/api/purchasing", { data: { action: "supplier.create", businessName: `Proveedor compra ${testInfo.project.name} ${Date.now()}`, leadTimeDays: 0 } })
  expect(supplierResponse.ok()).toBe(true)
  await page.reload()
  await expect(page.getByText(/Proveedores activos/)).toBeVisible({ timeout: 30_000 })
  await page.getByRole("tab", { name: "Cotizaciones" }).click()
  await page.getByRole("button", { name: "Nueva cotización" }).click()
  const dialog = page.getByRole("dialog", { name: "Nueva solicitud de cotización" })
  await expect(dialog).toBeVisible()
  // Asistente de tres pasos: no se avanza sin productos.
  await expect(dialog.getByRole("button", { name: /Continuar/ })).toBeDisabled()
  await page.locator("#quote-add-product").click()
  await page.locator("[cmdk-item]").first().click()
  await dialog.locator('input[aria-label^="Cantidad de"]').first().fill("2")
  await dialog.getByRole("button", { name: /Continuar/ }).click()
  // Paso 2: si el producto no tiene proveedor vinculado, se elige uno y se captura el precio.
  if (await dialog.getByRole("button", { name: /Ver resumen/ }).isDisabled()) {
    await dialog.locator('[id^="other-"]').first().click()
    await page.locator("[cmdk-item]").first().click()
    const price = dialog.locator('input[id^="price-"]').first()
    if (await price.isVisible().catch(() => false)) await price.fill("12.5")
  }
  await dialog.getByRole("button", { name: /Ver resumen/ }).click()
  const quoteResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/purchasing") && response.request().method() === "POST" && response.request().postData()?.includes('"quote.create"') === true)
  await dialog.getByRole("button", { name: /Finalizar/ }).click()
  const quoteResponse = await quoteResponsePromise
  expect(quoteResponse.ok()).toBe(true)
  const quote = (await quoteResponse.json()).data as { folio: string }
  await expect(dialog).toBeHidden({ timeout: 30_000 })
  const quoteRow = page.locator("div.rounded-xl.border.p-4").filter({ has: page.getByText(quote.folio, { exact: true }) })
  await expect(quoteRow).toBeVisible({ timeout: 30_000 })
  await quoteRow.getByRole("button", { name: "Crear orden" }).click()
  const orderDialog = page.getByRole("dialog", { name: "Nueva orden de compra" })
    // Desde una cotización el asistente abre en «productos»; falta el destino: se vuelve al paso 1.
  await orderDialog.getByRole("button", { name: /Atrás/ }).click()
  await expect(orderDialog.getByRole("button", { name: /Continuar/ })).toBeDisabled()
  await orderDialog.locator("button[aria-pressed]").last().click() // los anteriores son proveedores
  await orderDialog.getByRole("button", { name: /Continuar/ }).click()
  await orderDialog.getByRole("button", { name: /Continuar/ }).click()
  const shownTotal = Number((await orderDialog.locator("dt:has-text('Total estimado') + dd").innerText()).replace(/[^0-9.]/g, ""))
  expect(shownTotal).toBeGreaterThan(0)
  await page.route("**/api/purchasing", async (route) => {
    if (route.request().method() === "POST" && route.request().postData()?.includes('"order.create"')) {
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Esta cotización ya tiene una orden activa", field: "quoteId" }) })
    } else await route.continue()
  })
  await orderDialog.getByRole("button", { name: "Crear orden" }).click()
  await expect(orderDialog.getByRole("alert")).toContainText("Esta cotización ya tiene una orden activa")
  await expect(orderDialog).toBeVisible()
  await page.unroute("**/api/purchasing")
  const orderResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/purchasing") && response.request().method() === "POST" && response.request().postData()?.includes('"order.create"') === true)
  await orderDialog.getByRole("button", { name: "Crear orden" }).click()
  const orderResponse = await orderResponsePromise
  expect(orderResponse.ok()).toBe(true)
  const order = (await orderResponse.json()).data as { total: string | number; folio: string }
  expect(Number(order.total)).toBeCloseTo(shownTotal, 2)
  await expect(orderDialog).toBeHidden({ timeout: 30_000 })
  await page.getByRole("tab", { name: "Órdenes" }).click()
  const orderCard = page.locator('[data-slot="card"]').filter({ has: page.getByText(order.folio, { exact: true }) })
  await expect(orderCard).toBeVisible({ timeout: 30_000 })
    await orderCard.getByRole("button", { name: "Aprobar" }).click()
  await expect(orderCard.getByRole("button", { name: "Recibir" })).toBeVisible({ timeout: 30_000 })
  await orderCard.getByRole("button", { name: "Recibir" }).click()
  const receiveDialog = page.getByRole("dialog", { name: `Recibir ${order.folio}` })
  await receiveDialog.locator('input[id^="receive-"]').first().fill("1")
  const receiptResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/purchasing") && response.request().method() === "POST" && response.request().postData()?.includes('"receive"') === true)
  await receiveDialog.getByRole("button", { name: "Confirmar recepción" }).click()
  expect((await receiptResponsePromise).ok()).toBe(true)
  await expect(receiveDialog).toBeHidden({ timeout: 30_000 })
  await expect(orderCard.getByText(/Recibido: 1 de 2 unidades/)).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: testInfo.outputPath("orden-recepcion-parcial.png"), fullPage: true })
})

test("publicación: Enter muestra errores y conserva el foco", async ({ page }, testInfo) => {
  await loginOwner(page)
  await page.goto("/admin/publications", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "Nueva publicación" }).click()
  const title = page.locator("#publication-title")
  await expect(title).toBeFocused()
  await title.press("Enter")
  await expect(title).toBeFocused()
  await expect(title).toHaveAttribute("aria-invalid", "true")
  await expect(page.getByRole("dialog", { name: "Nueva publicación" })).toBeVisible()
  await title.fill("Aviso de prueba")
  await page.getByLabel("Color primario del flyer").fill("#123456")
  await expect(page.getByLabel("Color primario del flyer")).toHaveValue("#123456")
  await page.screenshot({ path: testInfo.outputPath("publicacion-validacion.png"), fullPage: true })
})

test("producto: Enter destaca campos inválidos y enfoca el primero", async ({ page }, testInfo) => {
  await loginOwner(page)
  await page.goto("/admin/products", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /^nuevo producto$/i }).click()
  const name = page.locator("#product-name")
  await expect(page.locator("#product-form")).toBeVisible()
  await name.focus()
  await name.press("Enter")
  await expect(name).toBeFocused()
  await expect(name).toHaveAttribute("aria-invalid", "true")
  await expect(page.locator('[data-slot="dialog-content"] [aria-invalid="true"]').first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("producto-validacion.png"), fullPage: true })
})

test("producto: crear una categoría conserva el formulario padre y selecciona la nueva opción", async ({ page }) => {
  await loginOwner(page)
  await page.goto("/admin/products", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /^nuevo producto$/i }).click()

  const productName = `Producto pendiente ${Date.now()}`
  const categoryName = `Categoría rápida ${Date.now()}`
  await page.locator("#product-name").fill(productName)
  await page.locator("#product-category").click()
  await page.getByRole("button", { name: /^agregar$/i }).click()

  const dialogLayers = page.locator('[data-slot="dialog-content"]')
  await expect(dialogLayers).toHaveCount(2)
  const categoryDialog = page.getByRole("dialog")
  await categoryDialog.getByLabel("Nombre").fill(categoryName)
  await categoryDialog.getByRole("button", { name: /^crear$/i }).click()

  await expect(dialogLayers).toHaveCount(1, { timeout: 30_000 })
  await expect(page.locator("#product-form")).toBeVisible()
  await expect(page.locator("#product-name")).toHaveValue(productName)
  await expect(page.locator("#product-category")).toContainText(categoryName)
})

test("producto personalizado: muestra variantes vendibles y tópicos como secciones independientes", async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await loginOwner(page)
  const organizationSwitcher = page.locator('button[aria-label="Cambiar de organización"]:visible').first()
  await organizationSwitcher.click()
  await page.getByRole("menuitem").filter({ hasText: "Restaurante Demo" }).click()
  await expect(organizationSwitcher).toContainText("Restaurante Demo", { timeout: 30_000 })
  // El cambio de empresa se recuerda en la BD (lastOrganizationId): se devuelve al final para no contaminar otras pruebas.
  try {
    await page.goto("/admin/products", { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: /^nuevo producto$/i }).click()
    await page.getByRole("radio", { name: /^Personalizado/ }).click()

    const form = page.locator("#product-form")
    await expect(form.getByText("Opciones y variantes", { exact: true })).toBeVisible()
    await expect(form.getByText("Personalízalo — tópicos", { exact: true })).toBeVisible()
    await expect(form.getByRole("button", { name: "Agregar opción" })).toBeVisible()
    await form.getByRole("button", { name: "Agregar opción" }).click()
    await expect(form.getByLabel("Opción 1")).toBeVisible()
    await expect(form.getByLabel("Valor 1")).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("producto-personalizado-opciones.png"), fullPage: true })
  } finally {
    await page.goto("/admin", { waitUntil: "domcontentloaded" })
    await organizationSwitcher.click()
    await page.getByRole("menuitem").filter({ hasText: "Híbrido Demo" }).click()
    await expect(organizationSwitcher).toContainText("Híbrido Demo", { timeout: 30_000 })
  }
})

test("portal: Enter en login vacío muestra errores sin desbordamiento", async ({ page }, testInfo) => {
  await page.goto("/portal/auth/login", { waitUntil: "domcontentloaded" })
  await expect(page.getByTestId("app-splash")).toBeHidden({ timeout: 10_000 })
  const first = page.locator("#identifier")
  await expect(first).toBeFocused()
  await first.press("Enter")
  await expect(first).toBeFocused()
  await expect(first).toHaveAttribute("aria-invalid", "true")
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(overflow).toBe(false)
  await page.screenshot({ path: testInfo.outputPath("portal-login-validacion.png"), fullPage: true })
})

test("portal móvil: el arranque no queda bloqueado si el almacenamiento de sesión falla", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage unavailable", "SecurityError")
      },
    })
  })
  await loginPortal(page)
  await expect(page.getByTestId("app-splash")).toBeHidden({ timeout: 6_000 })
  await expect(page.getByTestId("auth-splash")).toBeHidden({ timeout: 6_000 })
  await expect(page.locator("main")).toBeVisible()
  await expect(page.locator("nav.fixed")).toBeVisible()
})

test("portal: detalle de producto, carrito y pago conservan la navegación", async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await loginPortal(page)
  await page.goBack({ waitUntil: "domcontentloaded" })
  await expect(page).toHaveURL(/\/portal$/, { timeout: 15_000 })
  await page.goto("/")
  await expect(page).toHaveURL(/\/portal$/)
  await page.goto("/portal/store", { waitUntil: "domcontentloaded" })
  const skipTour = page.getByRole("button", { name: "Saltar" })
  await expect(skipTour).toBeVisible({ timeout: 15_000 })
  await skipTour.click()
  await expect(skipTour).toBeHidden()
  const productLink = page.locator('a[href^="/portal/store/"]').first()
  await expect(productLink).toBeVisible({ timeout: 30_000 })
  await productLink.locator("p").first().click()
  await expect(page).toHaveURL(/\/portal\/store\/[^/]+/, { timeout: 30_000 })
  await expect(page.locator("h1")).toBeVisible()
  await expect(page.getByRole("button", { name: "Agregar al carrito" })).toBeVisible()
  await page.getByRole("button", { name: "Agregar al carrito" }).click()
  await page.getByRole("button", { name: "Carrito" }).click()
  await page.getByRole("button", { name: "Continuar al pago" }).click()
  await expect(page).toHaveURL(/\/portal\/checkout/, { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "Método de pago" })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator("#pay-credit")).toBeVisible()
  const confirmButton = page.getByRole("button", { name: /Desliza para confirmar|Desliza para pagar/ })
  await expect(confirmButton).toBeVisible()
  const buttonBox = await confirmButton.boundingBox()
  const navBox = await page.locator("nav.fixed").boundingBox()
  expect(buttonBox && navBox && buttonBox.y + buttonBox.height <= navBox.y + 1, "la barra inferior no debe tapar la acción de pago").toBe(true)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(overflow).toBe(false)
  await page.screenshot({ path: testInfo.outputPath("portal-checkout.png"), fullPage: true })
})
