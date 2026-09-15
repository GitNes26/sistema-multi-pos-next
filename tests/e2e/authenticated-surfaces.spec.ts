import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, path: string, email: string, target: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("#identifier").fill(email);
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button", { name: /^entrar/i }).click();
  await page.waitForURL((url) => url.pathname === target || url.pathname.startsWith(`${target}/`), {
    timeout: 20_000,
  });
}

for (const route of ["/portal", "/portal/store", "/portal/orders", "/portal/reservations"]) {
  test(`portal autenticado ${route} no desborda`, async ({ page }) => {
    await login(page, "/portal/auth/login", "hcli-001@hibrido.local", "/portal");
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `overflow horizontal en ${route}`).toBe(false);
  });
}

for (const route of ["/admin", "/admin/inventory", "/admin/reports", "/pos", "/kds"]) {
  test(`superficie protegida ${route} conserva el acceso`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth\/login/);
  });
}
