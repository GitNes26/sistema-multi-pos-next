# =============================================================
# Multi-POS — Imagen Docker para Dokploy (Next.js full-stack + Prisma/MySQL)
# =============================================================

# ---- Etapa 1: dependencias (cache de npm ci) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Etapa 2: build (genera Prisma + compila Next) ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* se inyectan en build time.
# NEXT_PUBLIC_VAPID_PUBLIC_KEY es OBLIGATORIA para web push: se embebe en el
# bundle del cliente y sin ella el navegador nunca pide permiso de notificación.
# Genera el par con: npx web-push generate-vapid-keys
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_WHATSAPP_NUMBER
ARG NEXT_PUBLIC_WHATSAPP_MESSAGE
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_WHATSAPP_NUMBER=$NEXT_PUBLIC_WHATSAPP_NUMBER
ENV NEXT_PUBLIC_WHATSAPP_MESSAGE=$NEXT_PUBLIC_WHATSAPP_MESSAGE
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npx prisma generate
RUN npm run build

# ---- Etapa 3: runner ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    SEED_DEMO=false

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
RUN mkdir -p /app/public/uploads

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
