# =============================================================
# Multi-POS — Imagen Docker para Dokploy (Next.js full-stack + Prisma/MySQL)
# El proyecto es un monolito: front (React) + back (API routes) en el mismo server.
# =============================================================

# ---- Etapa 1: dependencias (cache de npm ci) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Etapa 2: build (genera el cliente de Prisma y compila Next) ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# ---- Etapa 3: runner (solo lo necesario para producción) ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    SEED_DEMO=false

# node_modules completo (incluye la CLI de prisma + tsx) + build + assets
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
# src + tsconfig: los necesita el seeder (prisma/seed.ts importa src/lib/*)
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

# Asegura que /app/public/uploads exista (Dokploy monta un volumen persistente aqui).
RUN mkdir -p /app/public/uploads

# Aplica migraciones, siembra datos base (seed de produccion, idempotente) y arranca.
# Para sembrar tambien datos demo: define SEED_DEMO=true en el environment de Dokploy.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed && npm run start"]
