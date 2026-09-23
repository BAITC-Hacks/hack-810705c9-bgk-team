FROM oven/bun:1.4.2-alpine AS pruner
ENV TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
WORKDIR /app
COPY . .
RUN bunx turbo prune presentation-layer --docker --skip-infer

FROM oven/bun:1.4.2-alpine AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
# Bun не может разобрать bun.lock, который генерирует `turbo prune` (встречаются
# висячие ссылки на вырезанные пакеты, напр. @types/node у @types/pg), и
# `bun install --frozen-lockfile` падает с InvalidLockfile. Берём оригинальный
# lockfile из контекста: резолюция та же, установка детерминированная.
COPY --from=pruner /app/bun.lock ./bun.lock
COPY --from=pruner /app/patches ./patches
RUN bun install --frozen-lockfile

FROM installer AS builder
COPY --from=pruner /app/out/full/ .
RUN bunx turbo run build --filter=presentation-layer

# Одноразовый образ для миграций (drizzle-kit живёт в devDependencies).
# Собирается от installer — без шага `next build`, поэтому он быстрый.
# ВАЖНО: stage держим ДО runner — без явного target Docker берёт последний stage.
FROM installer AS migrator
WORKDIR /app
COPY --from=pruner /app/out/full/ .
CMD ["sh", "-c", "cd apps/presentation-layer && bun run db:deploy"]

FROM oven/bun:1.4.2-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/presentation-layer/.next/standalone ./
COPY --from=builder /app/apps/presentation-layer/.next/static ./apps/presentation-layer/.next/static
COPY --from=builder /app/apps/presentation-layer/public ./apps/presentation-layer/public
EXPOSE 3000
CMD ["bun", "run", "apps/presentation-layer/server.js"]
