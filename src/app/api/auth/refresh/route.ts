import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/schemas/api";
import {
  clearAuthCookies,
  REFRESH_COOKIE,
  setAuthCookies,
} from "@/server/auth/cookies";
import { rotateSession } from "@/server/auth/session";

/**
 * POST /api/auth/refresh
 * 正常旋转：200 + 全新双 Cookie（旧 refresh 一次性作废）。
 * 重放（已旋转 token 复用）：401 REPLAY_DETECTED + 清 Cookie；
 * 服务端已撤销该用户全部会话并递增 session_version（spec「重放触发全端下线」）。
 * 普通失效（过期/登出/伪造）：401 INVALID_TOKEN。
 */
export async function POST(request: NextRequest) {
  const oldRefreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!oldRefreshToken) {
    return NextResponse.json(apiError("INVALID_TOKEN", "缺少会话凭据"), {
      status: 401,
    });
  }

  const result = await rotateSession(oldRefreshToken);
  if (!result.ok) {
    const response = NextResponse.json(
      apiError(
        result.reason === "replay"
          ? "REPLAY_DETECTED"
          : "INVALID_TOKEN",
        result.reason === "replay"
          ? "检测到会话凭据重放，全部会话已下线"
          : "会话已失效，请重新登录",
      ),
      { status: 401 },
    );
    clearAuthCookies(request, response);
    return response;
  }

  const response = NextResponse.json({ ok: true, userId: result.userId });
  setAuthCookies(request, response, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  return response;
}
