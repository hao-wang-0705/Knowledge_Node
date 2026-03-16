# Knowledge Node Backend - Docker 构建与运行
# 多阶段：deps -> builder -> runner

FROM node:20-alpine AS base
ARG BUILD_TIMESTAMP=default

# -----------------------------------------------------------------------------
# 阶段 1: 依赖安装 + Prisma 生成
# -----------------------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci --omit=dev \
  && npx prisma generate

# -----------------------------------------------------------------------------
# 阶段 2: 编译
# -----------------------------------------------------------------------------
FROM base AS builder
ARG BUILD_TIMESTAMP=default
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
RUN echo "BUILD_TIMESTAMP=$BUILD_TIMESTAMP" > .build-info \
  && echo "BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .build-info

RUN npx prisma generate \
  && npm run build

# -----------------------------------------------------------------------------
# 阶段 3: 生产镜像（仅生产依赖）
# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

RUN apk add --no-cache openssl3-libs 2>/dev/null || apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate \
  && chown -R nestjs:nodejs /app

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/.build-info ./.build-info

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -q --spider http://localhost:4000/health/ready || exit 1

# 启动前执行迁移；若数据库已存在且未做 baseline（P3005）则仅打日志并继续启动
CMD ["sh", "-c", "npx prisma migrate deploy || echo 'Warning: migrate deploy failed (e.g. P3005 existing DB), starting app anyway.'; exec node dist/main.js"]
