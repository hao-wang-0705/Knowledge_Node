# Knowledge Node Backend Dockerfile
# 版本: 2.1
FROM node:20-alpine AS base

# 构建时间戳参数（用于破坏缓存）
ARG BUILD_TIMESTAMP=default

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Build the source code
FROM base AS builder
ARG BUILD_TIMESTAMP=default
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

# 复制所有源代码（在 BUILD_TIMESTAMP 之后以确保重新复制）
COPY . .

# 写入构建信息
RUN echo "BUILD_TIMESTAMP=$BUILD_TIMESTAMP" > .build-info && \
    echo "BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .build-info

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/.build-info ./.build-info

USER nestjs

EXPOSE 4000

ENV PORT=4000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -q --spider http://localhost:4000/api/docs || exit 1

# Run migrations and start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
