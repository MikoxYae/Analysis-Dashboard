# ─── Stage 1: Build Frontend ──────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /app

RUN npm install -g pnpm@9 --quiet

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/ ./lib/
COPY artifacts/analytics-dashboard/ ./artifacts/analytics-dashboard/

RUN pnpm install --frozen-lockfile --filter @workspace/analytics-dashboard... 2>/dev/null || \
    pnpm install --filter @workspace/analytics-dashboard...

RUN pnpm --filter @workspace/analytics-dashboard exec \
    vite build --config vite.production.config.ts

# ─── Stage 2: Build API Server ────────────────────────────────────────────────
FROM node:20-slim AS api-builder
WORKDIR /app

RUN npm install -g pnpm@9 --quiet

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm install --frozen-lockfile --filter @workspace/api-server... 2>/dev/null || \
    pnpm install --filter @workspace/api-server...

RUN pnpm --filter @workspace/api-server run build

# ─── Stage 3: Production Image ────────────────────────────────────────────────
FROM node:20-slim AS production
WORKDIR /app

RUN npm install -g pnpm@9 --quiet

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm install --frozen-lockfile --filter @workspace/api-server... --prod 2>/dev/null || \
    pnpm install --filter @workspace/api-server... --prod

COPY --from=api-builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=frontend-builder /app/artifacts/analytics-dashboard/dist/public ./public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
