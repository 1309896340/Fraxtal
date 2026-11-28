import type { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_TTL_SEC, REFRESH_TOKEN_TTL_SEC } from "@/server/auth/jwt";
import type { IssuedSession } from "@/server/auth/session";

export const ACCESS_COOKIE = "frx_access";
export const REFRESH_COOKIE = "frx_refresh";

/**
 * 按请求实际协议决定 Secure 标志：
 * - HTTPS（含反向代理透传 X-Forwarded-Proto）→ 带 Secure；
 * - HTTP 直连（自托管常见形态）→ 不带——否则浏览器拒存 Cookie，
 *   注册/登录的会话将完全失效。
 */
function shouldUseSecure(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  const proto = (forwarded ?? request.nextUrl.protocol)
    .replace(/:$/, "")
    .toLowerCase();
  return proto === "https";
}

function baseCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: shouldUseSecure(request),
    path: "/",
  } as const;
}

/** 在响应上设置双会话 Cookie（httpOnly + SameSite=Strict，design D-2）。 */
export function setAuthCookies<T>(
  request: NextRequest,
  response: NextResponse<T>,
  session: IssuedSession,
): void {
  response.cookies.set(ACCESS_COOKIE, session.accessToken, {
    ...baseCookieOptions(request),
    maxAge: ACCESS_TOKEN_TTL_SEC,
  });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    ...baseCookieOptions(request),
    maxAge: REFRESH_TOKEN_TTL_SEC,
  });
}

/** 清除双会话 Cookie（登出/全端下线）。 */
export function clearAuthCookies(
  request: NextRequest,
  response: NextResponse,
): void {
  response.cookies.set(ACCESS_COOKIE, "", {
    ...baseCookieOptions(request),
    maxAge: 0,
  });
  response.cookies.set(REFRESH_COOKIE, "", {
    ...baseCookieOptions(request),
    maxAge: 0,
  });
}
