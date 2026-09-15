import { test } from "node:test";
import assert from "node:assert/strict";
import { assertTestEnvironment } from "../../scripts/test-safety.mjs";

const valid = {
  TEST_DATABASE_CONFIRMED: "true",
  TEST_DATABASE_URL: "mysql://local:secret@localhost:3306/multi_pos_test_demo",
  DATABASE_URL: "mysql://local:secret@localhost:3306/multi_pos_test_demo",
  TEST_BASE_URL: "http://127.0.0.1:3107",
  TEST_SERVER_TOKEN: "a".repeat(32),
};
test("isolated, explicitly selected database is accepted", () => {
  assert.equal(assertTestEnvironment(valid).baseURL, valid.TEST_BASE_URL);
});
test("refuses missing opt-in, existing DB, mismatched DB, remote server and missing token", () => {
  for (const override of [
    { TEST_DATABASE_CONFIRMED: "false" },
    { TEST_DATABASE_URL: "mysql://local:secret@localhost/multi_pos", DATABASE_URL: "mysql://local:secret@localhost/multi_pos" },
    { DATABASE_URL: "mysql://local:secret@localhost/multi_pos" },
    { TEST_BASE_URL: "https://example.com" },
    { TEST_SERVER_TOKEN: "" },
  ]) assert.throws(() => assertTestEnvironment({ ...valid, ...override }));
});
