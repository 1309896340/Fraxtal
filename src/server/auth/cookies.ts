import type { NextResponse } from "next/server";
import { ACCESS_TOKEN_TTL_SEC, REFRESH_TOKEN_TTL_SEC } from "@/server/auth/jwt";
import type { IssuedSession } from "@/server/auth/session";

export const ACCESS_COOKIE = "frx_access";
export const REFRESH_COOKIE = "frx_refresh";

const isProduction = () => process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: isProduction(),
  path: "/",
} as const;

/** 在响应上设置双会话 Cookie（httpOnly + SameSite=Strict，design D-2）。 */
export function setAuthCookies<T>(
  response: NextResponse<T>,
  session: IssuedSession,
): void {
  response.cookies.set(ACCESS_COOKIE, session.accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_TTL_SEC,
  });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_TOKEN_TTL_SEC,
  });
}

/** 清除双会话 Cookie（登出/全端下线）。 */
export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });
}
