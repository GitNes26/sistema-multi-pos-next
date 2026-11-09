import { test, expect, type Page } from "@playwright/test"

// Superficies de los verticales (servicios, renta, barbería, fidelidad, garantías, plantillas): cargan con la
// cuenta demo (negocio híbrido), muestran su encabezado, no desbordan en horizontal y no dejan errores de página.

// El servidor de pruebas (Next dev) compila cada ruta la primera vez: se da más margen que el predeterminado.
test.setTimeout(180_000)

/** Llena el formulario de acceso esperando la hidratación: si React reinicia los campos, se vuelve a llenar. */
async function fillLogin(page: Page, identifier: string, password: string) {
  await page.waitForLoadState("networkidle")
  await expect(async () => {
    await page.locator("#identifier").fill(identifier)
    await page.locator("#password").fill(password)
    await expect(page.locator("#identifier")).toHaveValue(identifier)
    await expect(page.locator("#password")).toHaveValue(password)
  }).toPass({ timeout: 60_000 })
}

async function loginOwner(page: Page) {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" })
  await expect(page.locator("#identifier")).toBeVisible({ timeout: 30_000 })
  await fillLogin(page, "demo@multi-pos.com", "demo1234")
  await page.getByRole("button", { name: /^entrar/i }).click()
  await page.waitForURL((url) => url.pathname.startsWith("/admin"), { timeout: 120_000, waitUntil: "domcontentloaded" })
}

async function loginPortal(page: Page) {
  await page.goto("/portal/auth/login", { waitUntil: "domcontentloaded" })
  await expect(page.getByTestId("app-splash")).toBeHidden({ timeout: 30_000 })
  await expect(page.locator("#identifier")).toBeVisible({ timeout: 30_000 })
  await fillLogin(page, "hcli-001@hibrido.local", "demo1234")
  await page.getByRole("button", { name: /^entrar/i }).click()
  await page.waitForURL((url) => url.pathname === "/portal", { timeout: 120_000, waitUntil: "domcontentloaded" })
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

const ADMIN_PAGES: { path: string; heading: RegExp }[] = [
  { path: "/admin/loyalty-programs", heading: /Fidelidad/ },
  { path: "/admin/warranties", heading: /Garantías de servicio/ },
  { path: "/admin/settings/templates", heading: /Plantillas de arranque/ },
]

for (const { path, heading } of ADMIN_PAGES) {
  test(`admin ${path} carga, tiene encabezado y no desborda`, async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (err) => errors.push(err.message))
    await loginOwner(page)
    await page.goto(path, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({ timeout: 30_000 })
    expect(await noOverflow(page), `overflow horizontal en ${path}`).toBe(true)
    expect(errors, `errores de página en ${path}`).toEqual([])
  })
}

test("fidelidad: elegir una opción precargada abre su configuración", async ({ page }) => {
  await loginOwner(page)
  await page.goto("/admin/loyalty-programs", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /Agregar programa/ }).first().click()
  await expect(page.getByText("Membresía mensual: 4 servicios al mes")).toBeVisible({ timeout: 15_000 })
  await page.getByText("Membresía mensual: 4 servicios al mes").click()
  await expect(page.getByText(/Cobro automático de la cuota/)).toBeVisible()
  await expect(page.getByText(/bloqueado/).first()).toBeVisible()
  // Con un diálogo abierto el scroll de la página está bloqueado: se comprueba que el diálogo quepa en la pantalla.
  const box = await page.getByRole("dialog").last().boundingBox()
  const viewport = page.viewportSize()!
  expect(box, "el diálogo debe tener tamaño").not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  // Margen de 12 px: con el scroll bloqueado el navegador de pruebas compensa el ancho de la barra de desplazamiento.
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 12)
})

test("la agenda carga y ofrece agendar con personal opcional", async ({ page }) => {
  await loginOwner(page)
  await page.goto("/agenda", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("button", { name: /Nueva cita/ }).first()).toBeVisible({ timeout: 30_000 })
  expect(await noOverflow(page)).toBe(true)
})

for (const route of ["/portal/loyalty", "/portal/citas"]) {
  test(`portal ${route} no desborda`, async ({ page }) => {
    await loginPortal(page)
    await page.goto(route, { waitUntil: "domcontentloaded" })
    await expect(page.locator("body")).toBeVisible()
    await page.waitForTimeout(1500)
    expect(await noOverflow(page), `overflow horizontal en ${route}`).toBe(true)
  })
}
