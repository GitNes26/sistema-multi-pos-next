# =============================================================
# Multi-POS — Imagen Docker para Dokploy (Next.js full-stack + Prisma/MySQL)
# El proyecto es un monolito: front (React) + back (API routes) en el mismo server.
# =============================================================

# ---- Etapa 1: dependencias (cache de npm ci) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- Etapa 2: build (genera el cliente de Prisma y compila Next) ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* se inyectan en build time (Next.js las bunkea en el JS del cliente)
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_WHATSAPP_NUMBER
ARG NEXT_PUBLIC_WHATSAPP_MESSAGE
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_WHATSAPP_NUMBER=$NEXT_PUBLIC_WHATSAPP_NUMBER
ENV NEXT_PUBLIC_WHATSAPP_MESSAGE=$NEXT_PUBLIC_WHATSAPP_MESSAGE

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

# Standalone: solo los archivos necesarios (sin node_modules completo)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/package.json ./package.json
# Prisma CLI + tsx para el seeder (no incluidos en standalone)
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/tsx ./node_modules/tsx
COPY --from=deps /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=deps /app/node_modules/@esbuild ./node_modules/@esbuild
COPY --from=deps /app/node_modules/commander ./node_modules/commander
COPY --from=deps /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=deps /app/node_modules/bcrypt ./node_modules/bcrypt

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
  node server.js"]
