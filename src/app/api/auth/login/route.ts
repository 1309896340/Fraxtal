import { NextResponse, type NextRequest } from "next/server";
import { apiError, fieldErrorsFromZod } from "@/lib/schemas/api";
import { loginRequestSchema } from "@/lib/schemas/user";
import { verifyPassword } from "@/server/auth/password";
import { getUserByEmail, issueSession } from "@/server/auth/session";
import { setAuthCookies } from "@/server/auth/cookies";

/**
 * POST /api/auth/login
 * 成功：200 + 双会话 Cookie。
 * 凭据错误（邮箱不存在或密码错误）：统一 401 INVALID_CREDENTIALS，防枚举。
 */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = loginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError("VALIDATION", "输入校验失败", fieldErrorsFromZod(parsed.error)),
      { status: 422 },
    );
  }

  const { email, password } = parsed.data;
  const user = await getUserByEmail(email);
  const passwordOk =
    user !== null && (await verifyPassword(user.passwordHash, password));
  if (!passwordOk) {
    // 不区分「邮箱不存在」与「密码错误」（spec 防枚举）
    return NextResponse.json(
      apiError("INVALID_CREDENTIALS", "邮箱或密码错误"),
      { status: 401 },
    );
  }

  const session = await issueSession(user);
  const response = NextResponse.json({
    user: { id: user.id, email: user.email },
  });
  setAuthCookies(request, response, session);
  return response;
}
