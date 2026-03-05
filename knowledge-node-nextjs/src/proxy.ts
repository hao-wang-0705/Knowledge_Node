import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * 公开路由列表（无需登录即可访问）
 */
const publicPaths = [
  '/login',
  '/register',
  '/api/auth',  // NextAuth 内置路由
  '/api/health',
  '/api/ai/test',  // AI 服务连通性测试
  '/api/ai/status',  // AI 服务状态检查
];

/**
 * 静态资源路径（跳过认证检查）
 */
const staticPaths = [
  '/_next',
  '/favicon.ico',
  '/images',
  '/fonts',
];

/**
 * 检查路径是否匹配公开路由
 */
function isPublicPath(pathname: string): boolean {
  return publicPaths.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * 检查路径是否为静态资源
 */
function isStaticPath(pathname: string): boolean {
  return staticPaths.some(path => pathname.startsWith(path));
}

/**
 * 全局认证代理（Next 16 proxy 约定）
 *
 * 功能：
 * 1. 拦截所有请求，验证 JWT Token
 * 2. 未登录用户访问受保护路由时重定向到登录页
 * 3. 已登录用户访问登录/注册页时重定向到首页
 * 4. API 路由返回 401 状态码而非重定向
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 跳过静态资源
  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }

  // 获取 JWT Token（Node 运行时兼容）
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = !!token;
  const isPublic = isPublicPath(pathname);
  const isApiRoute = pathname.startsWith('/api/');
  const isAuthPage = pathname === '/login' || pathname === '/register';

  // 情况1：已登录用户访问登录/注册页 → 重定向到首页
  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 情况2：未登录用户访问受保护路由
  if (!isAuthenticated && !isPublic) {
    // API 路由返回 401
    if (isApiRoute) {
      return NextResponse.json(
        {
          success: false,
          error: '未登录，请先登录',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }

    // 页面路由重定向到登录页，并记录来源 URL
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 情况3：允许访问
  return NextResponse.next();
}

/**
 * 配置代理匹配规则
 *
 * 排除：
 * - _next/static（静态文件）
 * - _next/image（图片优化）
 * - favicon.ico（网站图标）
 */
export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static（静态文件）
     * - _next/image（图片优化）
     * - favicon.ico（网站图标）
     * - public 文件夹下的静态资源
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
