import { NextResponse, type NextRequest } from "next/server";
import { apiError, fieldErrorsFromZod } from "@/lib/schemas/api";
import { registerRequestSchema } from "@/lib/schemas/user";
import { hashPassword } from "@/server/auth/password";
import {
  getUserByEmail,
  issueSession,
  registerUser,
} from "@/server/auth/session";
import { setAuthCookies } from "@/server/auth/cookies";
/**
 * POST /api/auth/register
 * 成功：201 + 双会话 Cookie（注册即登录，spec「注册成功」场景）
 * email 已存在：409 EMAIL_EXISTS · 校验失败：422 VALIDATION（字段级）
 */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = registerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError("VALIDATION", "输入校验失败", fieldErrorsFromZod(parsed.error)),
      { status: 422 },
    );
  }

  const { email, password } = parsed.data;

  // 快路径预查（省一次 argon2 计算）；插入时唯一约束兜底并发竞态
  const existing = await getUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      apiError("EMAIL_EXISTS", "该邮箱已被注册"),
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await registerUser(email, passwordHash);
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") {
      return NextResponse.json(
        apiError("EMAIL_EXISTS", "该邮箱已被注册"),
        { status: 409 },
      );
    }
    throw error;
  }

  const session = await issueSession(user);
  const response = NextResponse.json(
    { user: { id: user.id, email: user.email } },
    { status: 201 },
  );
  setAuthCookies(request, response, session);
  return response;
}
