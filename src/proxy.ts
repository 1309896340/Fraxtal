import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/server/auth/cookies";

/**
 * 页面路由保护（Next.js 16 proxy 约定，原 middleware）。
 * 快路径：仅检查会话 Cookie 存在性（验签由页面/ API 层完成）。
 * API 路由自行做完整校验（requireUser），不经此拦截。
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const hasAnySession =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  // 未携带任何会话 Cookie 访问受保护页面 → 登录页
  if (!isAuthPage && !hasAnySession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // 排除 API（自带 requireUser 完整校验）与静态资源
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
