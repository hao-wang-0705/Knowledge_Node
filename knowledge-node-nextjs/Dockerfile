# Knowledge Node Frontend (Next.js) - Docker 构建与运行
# 多阶段：deps -> builder -> runner（standalone 输出）

FROM node:20-alpine AS base
ARG BUILD_TIMESTAMP=default
ARG BACKEND_API_URL=http://backend:4000
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_VENUS_API_URL=http://v2.open.venus.oa.com/llmproxy
ARG NEXT_PUBLIC_VENUS_MODEL=gemini-2.5-flash

# -----------------------------------------------------------------------------
# 阶段 1: 依赖安装 + Prisma 生成
# -----------------------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps \
  && npx prisma generate

# -----------------------------------------------------------------------------
# 阶段 2: 编译（构建时注入 NEXT_PUBLIC_* 与 BACKEND_API_URL）
# -----------------------------------------------------------------------------
FROM base AS builder
ARG BUILD_TIMESTAMP=default
ARG BACKEND_API_URL=http://backend:4000
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_VENUS_API_URL=http://v2.open.venus.oa.com/llmproxy
ARG NEXT_PUBLIC_VENUS_MODEL=gemini-2.5-flash
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV BACKEND_API_URL=$BACKEND_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_VENUS_API_URL=$NEXT_PUBLIC_VENUS_API_URL
ENV NEXT_PUBLIC_VENUS_MODEL=$NEXT_PUBLIC_VENUS_MODEL

RUN echo "BUILD_TIMESTAMP=$BUILD_TIMESTAMP" > public/build-info.txt \
  && echo "BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> public/build-info.txt

# Next.js 16：Alpine/arm64 下用 webpack 构建，避免 turbopack/swc 兼容问题
RUN npm run build -- --webpack

# -----------------------------------------------------------------------------
# 阶段 3: 生产镜像（standalone）
# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
