# Knowledge Node Frontend Dockerfile
# 版本: 3.0
FROM node:20-alpine AS base

# 构建时间戳参数（用于破坏缓存）
ARG BUILD_TIMESTAMP=default

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Copy prisma schema for client generation
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Build the source code
FROM base AS builder
ARG BUILD_TIMESTAMP=default
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_VENUS_API_URL=http://v2.open.venus.oa.com/llmproxy
ARG NEXT_PUBLIC_VENUS_MODEL=gemini-2.5-flash
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

# 复制所有源代码
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_VENUS_API_URL=$NEXT_PUBLIC_VENUS_API_URL
ENV NEXT_PUBLIC_VENUS_MODEL=$NEXT_PUBLIC_VENUS_MODEL

# 写入构建信息
RUN echo "BUILD_TIMESTAMP=$BUILD_TIMESTAMP" > public/build-info.txt && \
    echo "BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> public/build-info.txt

# Build the application (Next.js 16 在 Alpine + arm64 下禁用 turbopack 构建，避免 swc/wasm 兼容问题)
RUN npm run build -- --webpack

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets (including build info)
COPY --from=builder /app/public ./public

# Set correct permissions for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 健康检查 (使用 0.0.0.0 因为 Alpine 的 localhost 解析问题)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:3000 || exit 1

CMD ["node", "server.js"]
