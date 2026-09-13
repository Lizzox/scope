FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ARG SCOPE_VERSION=dev
ARG VCS_REF=unknown
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 SCOPE_VERSION=$SCOPE_VERSION
LABEL org.opencontainers.image.title="Scope" \
      org.opencontainers.image.description="Self-hosted project planner with optional AI" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.version=$SCOPE_VERSION \
      org.opencontainers.image.revision=$VCS_REF
RUN addgroup --system --gid 1001 scope && adduser --system --uid 1001 scope
COPY --from=prod-deps --chown=scope:scope /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=scope:scope /app/.next/standalone ./
COPY --from=builder --chown=scope:scope /app/.next/static ./.next/static
COPY --from=builder --chown=scope:scope /app/drizzle ./drizzle
COPY --from=builder --chown=scope:scope /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=scope:scope /app/scripts/worker.mjs ./scripts/worker.mjs
COPY --from=builder --chown=scope:scope /app/scripts/discord-bot.mjs ./scripts/discord-bot.mjs
COPY --from=builder --chown=scope:scope /app/scripts/validate-env.mjs ./scripts/validate-env.mjs
RUN mkdir -p /data/uploads && chown -R scope:scope /data
USER scope
EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["sh", "-c", "node scripts/validate-env.mjs && node scripts/migrate.mjs && exec node server.js"]
