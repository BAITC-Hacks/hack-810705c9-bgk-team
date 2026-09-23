FROM oven/bun:1.4.2-alpine AS pruner
ENV TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
WORKDIR /app
COPY . .
RUN bunx turbo prune ai-logic-layer --docker --skip-infer

FROM oven/bun:1.4.2-alpine AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
# См. apps/presentation-layer/Dockerfile: pruned bun.lock от `turbo prune` невалиден
# для bun, поэтому frozen-установка идёт по оригинальному lockfile.
COPY --from=pruner /app/bun.lock ./bun.lock
RUN bun install --frozen-lockfile

FROM installer AS builder
COPY --from=pruner /app/out/full/ .
RUN bunx turbo run build --filter=ai-logic-layer

FROM oven/bun:1.4.2-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/ai-logic-layer/.mastra/output ./output
COPY --from=builder /app/apps/ai-logic-layer/package.json ./package.json
EXPOSE 4111
CMD ["bun", "run", "output/index.mjs"]
