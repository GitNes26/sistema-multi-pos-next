import test from "node:test";
import assert from "node:assert/strict";
import { isNavHrefEnabled } from "../../src/lib/nav.ts";

test("agenda only appears for service businesses and hybrid mode", () => {
  assert.equal(isNavHrefEnabled("/agenda", "retail"), false);
  assert.equal(isNavHrefEnabled("/agenda", "food_service"), false);
  assert.equal(isNavHrefEnabled("/agenda", "services"), true);
  assert.equal(isNavHrefEnabled("/agenda", "hybrid"), true);
});

test("reservations only appear for rental businesses and hybrid mode", () => {
  assert.equal(isNavHrefEnabled("/reservaciones", "retail"), false);
  assert.equal(isNavHrefEnabled("/reservaciones", "food_service"), false);
  assert.equal(isNavHrefEnabled("/reservaciones", "services"), false);
  assert.equal(isNavHrefEnabled("/reservaciones", "rental"), true);
  assert.equal(isNavHrefEnabled("/reservaciones", "hybrid"), true);
});
