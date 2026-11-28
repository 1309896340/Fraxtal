import { z } from "zod";

/** POST /api/auth/register 请求体。 */
export const registerRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "请输入邮箱")
    .pipe(z.email({ error: "邮箱格式不正确" })),
  password: z.string().min(8, "密码至少 8 个字符"),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/** POST /api/auth/login 请求体。 */
export const loginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "请输入邮箱")
    .pipe(z.email({ error: "邮箱格式不正确" })),
  password: z.string().min(1, "请输入密码"),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** 用户公开信息（响应体；永不包含 password_hash）。 */
export const userPublicSchema = z.object({
  id: z.string(),
  email: z.string(),
});

export type UserPublic = z.infer<typeof userPublicSchema>;
