import fs from "node:fs"
import { randomBytes } from "node:crypto"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { createRequire } from "node:module"
import { assertTestEnvironment } from "./test-safety.mjs"

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
process.chdir(root)
const mode = process.argv[2]
const profile = process.argv[3] ?? "demo"
if (!["demo", "minimal"].includes(profile))
  throw new Error("Profile must be demo or minimal.")
const envFile = path.join(root, `.env.test-${profile}.local`)

if (mode === "prepare" && !fs.existsSync(envFile)) {
  require("@next/env").loadEnvConfig(root)
  const original = new URL(process.env.DATABASE_URL ?? "")
  if (!["localhost", "127.0.0.1"].includes(original.hostname))
    throw new Error("Automatic setup only supports local MySQL.")
  const databaseName = `multi_pos_test_${profile}_${Date.now()}`
  const { PrismaClient } = require("@prisma/client")
  const admin = new PrismaClient({ datasourceUrl: original.href })
  try {
    await admin.$executeRawUnsafe(
      `CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
  } finally {
    await admin.$disconnect()
  }
  original.pathname = `/${databaseName}`
  fs.writeFileSync(
    envFile,
    JSON.stringify(
      {
        DATABASE_URL: original.href,
        TEST_DATABASE_URL: original.href,
        TEST_DATABASE_CONFIRMED: "true",
        TEST_BASE_URL: `http://127.0.0.1:${profile === "demo" ? 3107 : 3108}`,
        TEST_SERVER_TOKEN: randomBytes(32).toString("hex"),
        NEXTAUTH_SECRET: randomBytes(32).toString("hex"),
        NEXTAUTH_URL: `http://127.0.0.1:${profile === "demo" ? 3107 : 3108}`,
        NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${profile === "demo" ? 3107 : 3108}`,
        SUPERADMIN_EMAIL: "audit-admin@multi-pos.local",
        SUPERADMIN_PASSWORD: randomBytes(24).toString("base64url"),
        SEED_DEMO: profile === "demo" ? "true" : "false",
        // Prevent real messages even if Next loads the developer's .env files.
        TWILIO_ACCOUNT_SID: "",
        TWILIO_AUTH_TOKEN: "",
        SMTP_HOST: "",
        SMTP_USER: "",
        SMTP_PASSWORD: "",
        SMTP_FROM: "",
        VAPID_PRIVATE_KEY: "",
      },
      null,
      2
    )
  )
}
if (!fs.existsSync(envFile)) throw new Error("Run test:prepare first.")
const env = { ...process.env, ...JSON.parse(fs.readFileSync(envFile, "utf8")) }
// Las pruebas nunca deben enviar correos reales, incluso con un entorno antiguo.
for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"]) env[key] = ""
assertTestEnvironment(env)
function run(bin, args, extra = {}) {
  const r = spawnSync(process.execPath, [require.resolve(bin), ...args], {
    cwd: root,
    env: { ...env, ...extra },
    stdio: "inherit",
  })
  if (r.error) throw r.error
  if (r.status !== 0) process.exit(r.status ?? 1)
}
switch (mode) {
  case "schema-diff":
    run("prisma/build/index.js", [
      "migrate",
      "diff",
      "--from-schema-datasource",
      "prisma/schema.prisma",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
    ])
    break
  case "prepare":
    run("prisma/build/index.js", ["migrate", "deploy"])
    run("tsx/cli", ["prisma/seed.ts"], { NODE_ENV: "development" })
    break
  case "serve":
    run(
      "next/dist/bin/next",
      ["dev", "--port", new URL(env.TEST_BASE_URL).port],
      { NODE_ENV: "development" }
    )
    break
  case "integration":
    {
      const r = spawnSync(
        process.execPath,
        ["--test", "tests/permissions.test.mjs"],
        { cwd: root, env, stdio: "inherit" }
      )
      process.exit(r.status ?? 1)
    }
    break
  case "purchasing-integration":
    {
      const r = spawnSync(
        process.execPath,
        ["--import", "tsx", "--test", "tests/purchasing.integration.test.mjs"],
        { cwd: root, env, stdio: "inherit" }
      )
      process.exit(r.status ?? 1)
    }
    break
  case "e2e":
    run("@playwright/test/cli", ["test", ...process.argv.slice(4)])
    break
  default:
    throw new Error(
      "Use prepare, serve, integration, purchasing-integration or e2e."
    )
}
