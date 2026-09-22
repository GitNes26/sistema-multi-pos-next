import { test, expect } from "@playwright/test";

test("portal: productos a granel en listas y acceso a cambio de contraseña", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/portal/auth/login", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#identifier")).toBeFocused({ timeout: 15000 });
  await page.locator("#identifier").fill("cli-001@portal.local");
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button", { name: /^entrar/i }).click();
  await page.waitForURL((url) => url.pathname === "/portal", { timeout: 45000 });
  for (let attempt = 0; attempt < 4; attempt++) {
    const permissionDialog = page.getByRole("dialog", { name: /^Permiso de / });
    if (!await permissionDialog.waitFor({ state: "visible", timeout: 2000 }).then(() => true).catch(() => false)) break;
    await permissionDialog.getByRole("button", { name: "Cancelar" }).click();
  }
  const skipOnboarding = page.getByRole("button", { name: "Saltar" });
  if (await skipOnboarding.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false)) await skipOnboarding.click();
  await expect(page.getByTestId("app-splash")).toBeHidden({ timeout: 15000 });

  await page.getByRole("button", { name: "Abrir menú de navegación" }).click();
  await expect(page.getByRole("navigation", { name: "Secciones del portal" })).toBeVisible();
  await expect(page.locator('[data-slot="sheet-content"][data-side="left"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("menu-lateral.png"), fullPage: true });
  await page.getByRole("button", { name: "Cerrar menú" }).click();

  await page.getByRole("link", { name: "Listas" }).click();
  await page.getByRole("button", { name: "Nueva lista" }).click();
  await page.getByRole("dialog", { name: "Nueva lista" }).getByRole("button", { name: "Crear lista" }).click();
  await expect(page.locator("#shopping-list-name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#shopping-list-name")).toBeFocused();
  const listName = `Lista granel ${testInfo.project.name} ${Date.now()}`;
  await page.locator("#shopping-list-name").fill(listName);
  await page.getByRole("dialog", { name: "Nueva lista" }).getByRole("button", { name: "Crear lista" }).click();
  await page.waitForURL(/\/portal\/lists\//);
  await page.getByRole("button", { name: /agregar/i }).first().click();
  await expect(page.getByRole("button", { name: /kilogramo.*\$/i }).first()).toBeVisible();
  await page.getByRole("button", { name: /kilogramo.*\$/i }).first().click();
  await page.getByRole("button", { name: /listo/i }).click();
  await page.getByRole("button", { name: "Guardar lista" }).click();
  await expect(page.getByText("Lista guardada")).toBeVisible();
  await page.reload();
  if (await page.getByRole("button", { name: "Saltar" }).waitFor({ state: "visible", timeout: 3000 }).then(() => true).catch(() => false)) await page.getByRole("button", { name: "Saltar" }).click();
  await expect(page.getByText(/kg/).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("lista-detalle.png"), fullPage: true });
  await page.getByRole("link", { name: "Listas" }).click();
  const listCard = page.locator("article").filter({ has: page.getByRole("link", { name: new RegExp(listName) }) });
  await listCard.getByRole("button", { name: "Comprar lista" }).click();
  await expect(page.getByText("Tu carrito", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar al pago" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("carrito.png"), fullPage: true });
  await page.getByRole("button", { name: "Cerrar" }).last().click();
  await listCard.getByRole("button", { name: `Editar ${listName}` }).click();
  const editedName = `${listName} editada`;
  await page.locator("#shopping-list-name").fill(editedName);
  await page.getByRole("dialog", { name: "Editar lista" }).getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("link", { name: new RegExp(editedName) })).toBeVisible();

  await page.goto("/portal/profile");
  if (await page.getByRole("button", { name: "Saltar" }).waitFor({ state: "visible", timeout: 3000 }).then(() => true).catch(() => false)) await page.getByRole("button", { name: "Saltar" }).click();
  await expect(page.getByRole("link", { name: "Cambiar contraseña" })).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath("perfil.png"), fullPage: true });
  await page.getByRole("link", { name: "Cambiar contraseña" }).click();
  await expect(page).toHaveURL(/\/portal\/change-password$/, { timeout: 15000 });
  await expect(page.getByText("Cambiar contraseña", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Contraseña actual" })).toBeVisible();

  const response = await page.request.get("/api/portal/storefront");
  expect(response.ok()).toBe(true);
  const storefront = await response.json() as { products: { id: string; name: string; imageUrl: string | null }[] };
  const pictured = storefront.products.find((product) => product.imageUrl);
  expect(pictured).toBeDefined();
  await page.goto(`/portal/store/${pictured!.id}`);
  const productImage = page.getByRole("img", { name: pictured!.name }).first();
  await expect(productImage).toBeVisible({ timeout: 20000 });
  await expect.poll(() => productImage.evaluate((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
});
