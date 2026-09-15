import { createHash } from "node:crypto";

/** Fail closed before any test can open a DB connection or mutate an HTTP server. */
export function assertTestEnvironment(env = process.env) {
  if (env.TEST_DATABASE_CONFIRMED !== "true" || !env.TEST_DATABASE_URL) {
    throw new Error("Tests require TEST_DATABASE_CONFIRMED=true and TEST_DATABASE_URL.");
  }
  const database = new URL(env.TEST_DATABASE_URL);
  if (database.protocol !== "mysql:" || !/^multi_pos_test_[a-z0-9_]+$/.test(database.pathname.slice(1))) {
    throw new Error("Test database must be named multi_pos_test_<name>.");
  }
  if (env.DATABASE_URL !== env.TEST_DATABASE_URL) {
    throw new Error("DATABASE_URL must equal TEST_DATABASE_URL; the existing database is never a fallback.");
  }
  if (!env.TEST_BASE_URL || !env.TEST_SERVER_TOKEN || env.TEST_SERVER_TOKEN.length < 32) {
    throw new Error("Tests require an explicit TEST_BASE_URL and TEST_SERVER_TOKEN (32+ characters).");
  }
  const server = new URL(env.TEST_BASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(server.hostname) || !["http:", "https:"].includes(server.protocol)) {
    throw new Error("Test server must be on loopback.");
  }
  return { baseURL: server.origin, fingerprint: createHash("sha256").update(env.TEST_DATABASE_URL).digest("hex") };
}

export async function assertTestServer(env = process.env) {
  const { baseURL, fingerprint } = assertTestEnvironment(env);
  const response = await fetch(`${baseURL}/api/test-environment`, {
    headers: { "x-test-server-token": env.TEST_SERVER_TOKEN },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok || result.fingerprint !== fingerprint) {
    throw new Error("Server is not connected to the explicitly selected test database.");
  }
}
