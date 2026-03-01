/**
 * 认证错误处理钩子
 * 
 * 提供统一的认证错误处理逻辑，当检测到认证失败时自动重定向到登录页
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { AuthenticationError } from '@/services/api';
import { ApiError } from '@/services/api';
import { clearClientCaches } from '@/utils/cache';

/**
 * 认证错误处理钩子
 */
export function useAuthErrorHandler() {
  const router = useRouter();

  /**
   * 处理认证错误
   * 如果是认证错误，登出并重定向到登录页
   */
  const handleAuthError = useCallback(async (error: unknown) => {
    const isAuthError =
      error instanceof AuthenticationError ||
      (error instanceof ApiError && error.status === 401);

    if (isAuthError) {
      console.warn('[Auth] 认证失败，正在重定向到登录页...');

      // 会话失效时清理前端缓存，避免继续展示旧数据
      clearClientCaches({ clearUserIdentity: true, clearQueryCache: true });
      
      // 登出当前会话
      await signOut({ redirect: false });
      
      // 重定向到登录页
      const currentPath = window.location.pathname;
      router.push(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
      
      return true; // 表示已处理
    }
    return false; // 表示未处理
  }, [router]);

  /**
   * 包装异步函数，自动处理认证错误
   */
  const withAuthErrorHandler = useCallback(<T,>(
    asyncFn: () => Promise<T>
  ): Promise<T | null> => {
    return asyncFn().catch(async (error) => {
      const handled = await handleAuthError(error);
      if (!handled) {
        // 不是认证错误，重新抛出
        throw error;
      }
      return null;
    });
  }, [handleAuthError]);

  return {
    handleAuthError,
    withAuthErrorHandler,
  };
}

export default useAuthErrorHandler;
