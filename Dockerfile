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

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
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

# OpenSSL necesario para Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

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

# ── CMD por defecto: sync schema + seed + arrancar server ──
# Si DB_RESET=true → fuerza reset completo de la BD (borra todo y re-siembra).
# Ejemplo en Dokploy: DB_RESET=true en las variables de entorno.
CMD ["sh", "-c", "\
  if [ \"$DB_RESET\" = \"true\" ]; then \
    echo '⚠️  DB_RESET=true — Reseteando base de datos...'; \
    npx prisma db push --force-reset --skip-generate && \
    npm run db:seed && \
    echo '✅ BD reseteada y sembrada correctamente.'; \
  else \
    npx prisma db push --skip-generate && \
    npm run db:seed; \
  fi && \
  npm run start"]
