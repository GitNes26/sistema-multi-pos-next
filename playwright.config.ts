import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // El servidor de pruebas usa Next dev y la primera ruta puede compilar bajo demanda.
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://127.0.0.1:3107",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile-small", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    // Tablet emulado en Chromium para comprobar orientación y áreas táctiles.
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "tablet-landscape", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 }, hasTouch: true } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    // Habilitar con PLAYWRIGHT_FIREFOX=1 tras instalar el runtime de Firefox en el host.
    ...(process.env.PLAYWRIGHT_FIREFOX === "1"
      ? [{ name: "firefox-desktop", use: { ...devices["Desktop Firefox"], viewport: { width: 1366, height: 768 } } }]
      : []),
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
});
