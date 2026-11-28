import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/schemas/api";
import { ACCESS_COOKIE } from "@/server/auth/cookies";
import { verifyAccessToken } from "@/server/auth/jwt";
import { isAccessSessionValid } from "@/server/auth/session";

export interface AuthedRequest {
  ok: true;
  userId: string;
}

export interface RejectedRequest {
  ok: false;
  response: NextResponse;
}

/**
 * 受保护 API 的完整校验（design D-2）：
 * 验签 + 过期 + 比对 DB 中 session_version——重放事件后
 * 旧 access token 即时失效（401 UNAUTHORIZED）。
 */
export async function requireUser(
  request: NextRequest,
): Promise<AuthedRequest | RejectedRequest> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const unauthorized = (): RejectedRequest => ({
    ok: false,
    response: NextResponse.json(
      apiError("UNAUTHORIZED", "未认证"),
      { status: 401 },
    ),
  });

  if (!accessToken) {
    return unauthorized();
  }
  let claims;
  try {
    claims = await verifyAccessToken(accessToken);
  } catch {
    return unauthorized();
  }
  if (!(await isAccessSessionValid(claims.sub, claims.sv))) {
    return unauthorized();
  }
  return { ok: true, userId: claims.sub };
}
