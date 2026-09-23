FROM oven/bun:1.4.2-alpine AS pruner
ENV TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
WORKDIR /app
COPY . .
RUN bunx turbo prune workers --docker --skip-infer

FROM oven/bun:1.4.2-alpine AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
# См. apps/presentation-layer/Dockerfile: pruned bun.lock от `turbo prune` невалиден
# для bun, поэтому frozen-установка идёт по оригинальному lockfile.
COPY --from=pruner /app/bun.lock ./bun.lock
COPY --from=pruner /app/patches ./patches
RUN bun install --frozen-lockfile

FROM installer AS builder
COPY --from=pruner /app/out/full/ .
RUN bunx turbo run build --filter=workers

FROM oven/bun:1.4.2-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/workers/dist ./dist
COPY --from=builder /app/apps/workers/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
CMD ["bun", "run", "dist/index.js"]
