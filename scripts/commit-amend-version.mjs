#!/usr/bin/env node
/**
 * commit-amend-version.mjs
 * ---------------------------------------------------------------------------
 * Ejecutado desde el hook commit-msg. Hace el bump de versión y luego
 * amenda el commit para que los archivos de versión (package.json,
 * package-lock.json, VERSION.md) queden DENTRO del mismo commit.
 *
 * Flujo:
 *   1. Git crea el commit con la versión vieja
 *   2. Este script bumpa la versión y stagea los archivos
 *   3. `git commit --amend --no-verify` incluye los archivos en el commit
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const PKG_PATH = join(ROOT, "package.json")
const LOCK_PATH = join(ROOT, "package-lock.json")
const VERSION_PATH = join(ROOT, "VERSION.md")

// ── Niveles de versión ─────────────────────────────────────────────────────
const LEVELS = {
  major: { index: 0, name: "Major" },
  minor: { index: 1, name: "Minor" },
  patch: { index: 2, name: "Patch" },
  revision: { index: 3, name: "Revision" },
}

const PREFIX_MAP = {
  breaking: "major",
  major: "major",
  feat: "minor",
  feature: "minor",
  fix: "patch",
  perf: "patch",
  ui: "revision",
  ux: "revision",
  style: "revision",
  docs: "revision",
  chore: "revision",
  refactor: "revision",
  test: "revision",
  build: "revision",
  ci: "revision",
}

function parsePrefix(message) {
  const m = message.match(
    /^(breaking|major|feature|feat|fix|perf|ui|ux|style|docs|chore|refactor|test|build|ci)(\s*\([^)]*\))?\s*:/i
  )
  if (!m) return null
  return m[1].toLowerCase()
}

function levelForPrefix(prefix) {
  if (!prefix) return "revision"
  return PREFIX_MAP[prefix] ?? "revision"
}

function bumpVersion(version, level) {
  const parts = version.split(".").map((n) => parseInt(n, 10) || 0)
  while (parts.length < 4) parts.push(0)
  const { index } = LEVELS[level]
  parts[index] += 1
  for (let i = index + 1; i < 4; i++) parts[i] = 0
  return parts.slice(0, 4).join(".")
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function setPackageVersion(version) {
  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"))
  pkg.version = version
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n")

  if (existsSync(LOCK_PATH)) {
    const lock = JSON.parse(readFileSync(LOCK_PATH, "utf8"))
    if (lock.version !== undefined) lock.version = version
    if (lock.packages?.[""]?.version !== undefined) lock.packages[""].version = version
    writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + "\n")
  }
}

const VERSION_HEADER = `# VERSIONES — Multi-POS

> Registro cronológico de versiones y progreso del sistema.
> Este archivo se actualiza **automáticamente** en cada commit (hook de Git).

## Esquema de versionado

Formato: \`MAJOR.MINOR.PATCH.REVISION\` (X.X.X.X)

| Nivel | Nombre | ¿Qué abarca? |
|-------|--------|--------------|
| 1º | Major | Cambios rompedores o re-arquitectura (rompen compatibilidad) |
| 2º | Minor | Nuevas funcionalidades compatibles con lo anterior |
| 3º | Patch | Corrección de bugs o mejora de funcionalidad existente |
| 4º | Revision | Ajustes finos: UI/UX, estilos, documentación, refactor |

> Al subir un dígito, los dígitos a su derecha se reinician a \`0\`.

## Prefijos de commit

| Prefijo | Nivel que sube | Ejemplo |
|---------|----------------|---------|
| \`breaking:\` / \`major:\` | Major (1º) | \`breaking: migré la base de datos\` |
| \`feat:\` / \`feature:\` | Minor (2º) | \`feat: agregué el portal de clientes\` |
| \`fix:\` / \`perf:\` | Patch (3º) | \`fix: corregí el bug del QR\` |
| \`ui:\` / \`ux:\` / \`style:\` | Revision (4º) | \`ui: rediseñé la landing page\` |
| \`docs:\` / \`chore:\` / \`refactor:\` / \`test:\` / \`build:\` / \`ci:\` | Revision (4º) | \`docs: actualicé la documentación\` |

---

## Historial
`

function ensureVersionFile(version) {
  if (existsSync(VERSION_PATH)) return
  const content =
    VERSION_HEADER +
    `\n### [${version}] — ${today()}\n- **Tipo:** \`chore\` (Revision)\n- Inicialización del registro de versiones.\n`
  writeFileSync(VERSION_PATH, content, "utf8")
}

function addEntry(version, levelName, prefix, message) {
  let content = existsSync(VERSION_PATH) ? readFileSync(VERSION_PATH, "utf8") : VERSION_HEADER
  const anchor = "## Historial"
  const idx = content.indexOf(anchor)
  const entry =
    `\n### [${version}] — ${today()}\n` +
    `- **Tipo:** \`${prefix}\` (${levelName})\n` +
    `- ${message}\n`
  if (idx === -1) {
    content = content.trimEnd() + "\n\n" + anchor + entry
  } else {
    const insertAt = content.indexOf("\n", idx) + 1
    content = content.slice(0, insertAt) + entry + content.slice(insertAt)
  }
  writeFileSync(VERSION_PATH, content, "utf8")
}

function git(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim()
}

function main() {
  // Primer argumento: ruta al archivo temporal del mensaje de commit
  const messageFile = process.argv[2] || null

  // Leer el mensaje de commit
  let commitMessage = ""
  if (messageFile && existsSync(messageFile)) {
    commitMessage = readFileSync(messageFile, "utf8").trim()
  } else if (messageFile) {
    commitMessage = messageFile
  }

  if (!commitMessage) {
    console.log("[version-amend] Sin mensaje de commit, se omite.")
    return
  }

  const firstLine = commitMessage.split("\n")[0].trim()
  const prefix = parsePrefix(firstLine)
  const level = levelForPrefix(prefix)
  const levelInfo = LEVELS[level]

  const currentPkg = JSON.parse(readFileSync(PKG_PATH, "utf8"))
  const current = currentPkg.version
  const next = bumpVersion(current, level)

  if (next === current) {
    console.log("[version-amend] La versión no cambió.")
    return
  }

  // 1. Bump la versión en los archivos
  setPackageVersion(next)
  ensureVersionFile(current)
  addEntry(next, levelInfo.name, prefix ?? "chore", firstLine)

  // 2. Stagear los archivos de versión
  try {
    execSync(`git add "${PKG_PATH}" "${LOCK_PATH}" "${VERSION_PATH}"`, { cwd: ROOT, stdio: "ignore" })
  } catch {
    console.log("[version-amend] No se pudo stagear archivos de versión.")
    return
  }

  // 3. Amendar el commit para incluir los archivos versionados
  //    --no-verify evita que los hooks se vuelvan a ejecutar (loop infinito)
  //    Copiamos el mensaje a un archivo temporal separado para evitar
  //    race conditions con el archivo que Git usa internamente.
  try {
    const tmpMsg = join(ROOT, ".git", "COMMIT_MSG_VERSION_BUMP")
    writeFileSync(tmpMsg, commitMessage + "\n", "utf8")
    try {
      git(`git commit --amend --no-verify -F "${tmpMsg}"`)
    } finally {
      try { execSync(`rm -f "${tmpMsg}"`, { cwd: ROOT, stdio: "ignore" }) } catch {}
    }
    console.log(`[version-amend] ${current} → ${next} (${levelInfo.name}) — commit amendado ✓`)
  } catch (e) {
    console.error("[version-amend] Error al amendear el commit:", e.message)
  }
}

main()
