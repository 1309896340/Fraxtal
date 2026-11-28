import { NextResponse, type NextRequest } from "next/server";
import { findUserById } from "@/server/repositories/user-repo";
import { requireUser } from "@/server/auth/require-user";

/**
 * GET /api/auth/me
 * 受保护端点：返回当前会话用户公开信息（401 未认证）。
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const user = await findUserById(auth.userId);
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未认证" } },
      { status: 401 },
    );
  }
  return NextResponse.json({
    user: { id: user.id, email: user.email },
  });
}
