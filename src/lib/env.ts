import { z } from "zod";

/**
 * 运行环境配置（app-runtime「运行环境配置」需求）。
 * 必需变量缺失或非法时应用拒绝启动，错误信息指明变量名。
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "必填——Postgres 连接串（例 postgres://user:pass@host:5432/db）"),
  JWT_SECRET: z
    .string()
    .min(32, "必填——会话签名密钥，至少 32 个字符"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

/** 解析原始环境变量（可注入便于测试），失败时抛出含变量名的错误。 */
export function loadEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<unknown>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`环境变量缺失或非法：${details}。请参照 .env.example 配置`);
  }
  return result.data;
}

let cached: Env | null = null;

/** 惰性单例：首次访问时校验并缓存，避免构建期误触发运行时校验。 */
export function getEnv(): Env {
  cached ??= loadEnv(process.env);
  return cached;
}
