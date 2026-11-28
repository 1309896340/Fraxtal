import { NextResponse, type NextRequest } from "next/server";
import { clearAuthCookies, REFRESH_COOKIE } from "@/server/auth/cookies";
import { logoutSession } from "@/server/auth/session";

/**
 * POST /api/auth/logout
 * 服务端撤销该会话的 refresh 记录并清除双 Cookie。
 * 无效/缺失 refresh 时幂等成功（仍清 Cookie）。
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await logoutSession(refreshToken);
  }
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
