import test from "node:test";
import assert from "node:assert/strict";
import { reportsForMode } from "../../src/lib/reports/bi-catalog.ts";

test("BI adapta reportes operativos al modo de negocio", () => {
  const ids = (mode) => new Set(reportsForMode(mode).map((report) => report.id));
  assert.equal(ids("retail").has("appointments"), false);
  assert.equal(ids("food_service").has("table_performance"), true);
  assert.equal(ids("services").has("appointments"), true);
  assert.equal(ids("rental").has("rentals"), true);
  assert.deepEqual(["table_performance", "appointments", "rentals"].filter((id) => ids("hybrid").has(id)), ["table_performance", "appointments", "rentals"]);
});
