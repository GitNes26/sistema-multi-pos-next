import { test, expect } from "@playwright/test";

for (const path of ["/auth/login", "/portal/auth/login", "/reservar/verificar"]) {
  test(`superficie pública ${path} no desborda`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `overflow horizontal en ${path}`).toBe(false);
  });
}

test("login enfoca el primer campo inválido y marca todos los errores", async ({ page }) => {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /^entrar/i }).click();
  await expect(page.locator("#identifier")).toBeFocused();
  await expect(page.locator("#identifier")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#password")).toHaveAttribute("aria-invalid", "true");
});
