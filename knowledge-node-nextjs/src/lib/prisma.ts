import { PrismaClient } from '@prisma/client';

/**
 * Prisma 客户端单例
 * 
 * 在开发环境中，由于 Next.js 热更新机制，需要将 Prisma 实例存储在全局对象中
 * 以避免创建多个数据库连接
 */

// 扩展全局类型以存储 Prisma 实例
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 创建 Prisma 客户端实例
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] // 开发环境减少日志噪音
      : ['error'],
  });
  
  // 调试：确认客户端已正确创建
  if (process.env.NODE_ENV === 'development') {
    console.log('[Prisma] Client created, available models:', Object.keys(client).filter(k => !k.startsWith('_') && !k.startsWith('$')));
  }
  
  return client;
}

// 获取或创建 Prisma 客户端实例
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

// 在非生产环境中，将实例存储到全局对象
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 导出类型检查辅助函数
export function ensurePrismaClient(): PrismaClient {
  if (!prisma) {
    throw new Error('[Prisma] Client is not initialized');
  }
  return prisma;
}

export default prisma;
