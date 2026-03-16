/**
 * API 配置
 */

/**
 * 后端 API 基础 URL
 * - 开发环境：直接访问后端
 * - 生产环境：通过 Next.js API 路由代理
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/**
 * 前端 API 基础 URL
 */
export const FRONTEND_API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
