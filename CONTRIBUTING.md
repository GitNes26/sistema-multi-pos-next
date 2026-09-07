# Contributing — Guía rápida

Guía de arranque para clones nuevos y para **reconstruir las 5 organizaciones
demo** desde cero. La referencia completa (seeders, credenciales por
organización, variables de entorno) vive en [`README.md`](README.md).

---

## 1. Requisitos previos

- **Node.js** (versión usada por Next.js 15+; se recomienda 20 o superior).
- **MySQL 8+** corriendo localmente, con un usuario que pueda crear la base de
  datos una sola vez (la que pongas en `DATABASE_URL`).

## 2. Primer arranque (clon nuevo)

```bash
# 1. Variables de entorno — ajusta DATABASE_URL y genera un secreto
cp .env.example .env.local
#    DATABASE_URL="mysql://USUARIO:PASS@localhost:3306/multi_pos"
#    NEXTAUTH_SECRET=$(openssl rand -base64 32)
#    Deja SEED_DEMO="true" (así el paso 5 recrea la demo)

# 2. Dependencias
npm install

# 3. Crea la base de datos — Prisma NO la crea, solo las tablas
mysql -u root -e "CREATE DATABASE IF NOT EXISTS multi_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

# 4. Esquema (dev) — sincroniza el schema de Prisma con la BD
npm run db:push          # o: npm run db:migrate (aplica las migraciones versionadas)

# 5. Seed en dos tiempos (ver sección siguiente)
npm run db:reset         # base de producción (roles, permisos, menús, SuperAdmin)
npm run db:seed          # + 5 organizaciones demo

# 6. Servidor de desarrollo
npm run dev              # http://localhost:3000
```

## 3. Por qué `db:reset` + `db:seed` (y no un solo comando)

`npm run db:reset` destruye **toda** la BD y corre el seed con `NODE_ENV=production`.
Ese guard es intencional: un force-reset jamás puede terminar reconstruyendo
organizaciones demo, ni siquiera si un `.env` de desarrollo filtró
`SEED_DEMO="true"`. Por eso la demo se siembra **después**, aparte, con
`npm run db:seed`.

| Comando | Qué hace | ¿Demo? |
|---|---|---|
| `npm run db:reset` | `prisma db push --force-reset` + seed en modo producción | ❌ bloqueada por diseño |
| `npm run db:seed` | Seed idempotente: producción **+** demo si `SEED_DEMO="true"` y `NODE_ENV != production` | ✅ en dev |

### Flujo diario

```bash
# Reconstrucción completa (recomendado tras tocar el schema o querer un estado limpio)
npm run db:reset
npm run db:seed

# Solo re-siembra (si únicamente cambiaste los seeders; no toca nada más)
npm run db:seed          # idempotente: limpia y recrea las orgs demo
```

Al terminar ambos comandos deberías ver:

```
✅ Seed de producción completado
✅ Seed de demo completado
```

> La demo es **opt-in doble**: requiere `SEED_DEMO="true"` **y** `NODE_ENV`
> distinto de `production`. El `.env.example` trae el opt-in, así que al copiarlo
> a `.env.local` el paso `db:seed` reconstruye la demo sin configuración extra.

## 4. Verificar que las 5 orgs demo quedaron bien

Todas las cuentas demo comparten la contraseña **`demo1234`** (no aplica al
SuperAdmin).

| Para probar | Cuenta | Qué esperar |
|---|---|---|
| **Owner de las 5 orgs** | `demo@multi-pos.com` | Login normal → dashboard con selector **"Cambiar de organización"** (5 orgs: Supermercado, Restaurante, Estética, Fiestas, Híbrido) |
| **SuperAdmin** | `admin@multi-pos.com` / `Admin123!` (override con `SUPERADMIN_*`) | Panel de superadmin → Organizaciones y roles |
| **Rol de modo por org** | `mesero@demo.multi-pos.com`, `cocina@demo.multi-pos.com`, `agente-est@demo.multi-pos.com`, `agente-fie@demo.multi-pos.com`, `mesero-hib@demo.multi-pos.com`… | Entran con su superficie limitada (KDS, agenda, etc.) |
| **Portal de cliente** | `cli-001@portal.local` (Supermercado), `rcli-001@restaurante.local`, `ecli-001@estetica.local`, `fcli-001@fiestas.local`, `hcli-001@hibrido.local` | Login en `/portal` con su tienda sembrada |

El listado completo por organización (gerentes, cajeros, códigos de nómina,
clientes de portal) está en `README.md` → *Seeders → Datos demo*.

### Smoke checks

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm test                 # permisos por rol (requiere dev server arriba + demo sembrada)
```

`npm test` usa los usuarios de **Restaurante Demo** contra el flujo HTTP real
(mesero → `cash open` 403, cajero → 200, gerente → CRUD create 201).

### Organización recordada entre logins (multi-org)

El switcher de organización **recuerda la última org activa en BD**
(`User.lastOrganizationId`): cierra sesión desde Restaurante Demo y al volver a
entrar con la misma cuenta caerás de nuevo en Restaurante Demo, sin tocar el
selector. Detalle en `README.md` → *Sesiones multi-org*.

Para verificarlo en un clon fresco:

1. Entra como `demo@multi-pos.com`, cambia a otra org (p. ej. Híbrido Demo).
2. Cierra sesión y vuelve a entrar con la misma cuenta.
3. Debes caer directamente en la org elegida (no en Supermercado Demo, que es
   la primera membresía), y el header/sidebar muestran su nombre, modo y
   moneda. El selector sigue disponible para moverte a las demás.

Nota de prueba automatizada: `npm test` incluye el caso *"multi-org: el owner
retoma su última organización tras volver a entrar"*, que ejercita exactamente
este comportamiento contra el flujo HTTP real (cambia org, re-loginea y
comprueba la sesión restaurada; luego restaura el valor previo en BD).

## 5. Troubleshooting

| Síntoma | Causa | Solución |
|---|---|---|
| `ℹ️ Seed de demo omitido (requiere SEED_DEMO=true…)` | `SEED_DEMO` no es `"true"` o el shell tiene `NODE_ENV=production` | Pon `SEED_DEMO="true"` en `.env.local`; quita producción del shell (`unset NODE_ENV` en bash) y repite `npm run db:seed` |
| Tras `db:reset` no existen las orgs demo | Es el comportamiento previsto (siembra en modo producción) | Ejecuta `npm run db:seed` |
| Error `P1003` / *database does not exist* | La BD `multi_pos` no existe; Prisma no la crea | `mysql -u root -e "CREATE DATABASE IF NOT EXISTS multi_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"` |
| El seed de demo se interrumpió y quedó a medias | Proceso cortado (orgs a medio sembrar) | Vuelve a correr `npm run db:seed` — es idempotente: limpia y recrea las orgs demo |
| Puerto 3000 ocupado | Otro proceso en el puerto | `PORT=3001 npm run dev` |
| Caracteres raros (ó, emojis) en la BD | Base creada con charset latin1 | Recrea con `utf8mb4` (paso 3) y vuelve a sembrar |

## 6. Estructura relevante

```
prisma/seed.ts                  ← punto de entrada del seeder
prisma/seeders/production.ts    ← base de producción (siempre)
prisma/seeders/demo.ts          ← 5 orgs demo (SEED_DEMO=true, NODE_ENV != production)
scripts/db-reset.mjs            ← wrapper de db:reset (guard NODE_ENV=production)
tests/permissions.test.mjs      ← integración de permisos por rol (npm test)
```
