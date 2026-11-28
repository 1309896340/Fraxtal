import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  apiError,
  fieldErrorsFromZod,
} from "@/lib/schemas/api";
import { registerRequestSchema } from "@/lib/schemas/user";

describe("apiError / fieldErrorsFromZod", () => {
  it("构造统一错误信封结构", () => {
    expect(apiError("INVALID_CREDENTIALS", "邮箱或密码错误")).toEqual({
      error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" },
    });
  });

  it("带字段级错误时包含 fieldErrors", () => {
    const body = apiError("VALIDATION", "输入校验失败", {
      password: ["密码至少 8 个字符"],
    });
    expect(body.error.fieldErrors).toEqual({
      password: ["密码至少 8 个字符"],
    });
  });

  it("zod 校验失败映射为字段级错误", () => {
    const result = registerRequestSchema.safeParse({
      email: "not-an-email",
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = fieldErrorsFromZod(result.error);
      expect(fieldErrors.email).toBeTruthy();
      expect(fieldErrors.password).toContain("密码至少 8 个字符");
    }
  });

  it("合法注册请求通过且 email 归一化", () => {
    const result = registerRequestSchema.safeParse({
      email: "  User@Example.COM ",
      password: "long-enough-password",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("fieldErrorsFromZod 对嵌套路径生成点分 key", () => {
    const schema = z.object({ user: z.object({ email: z.email() }) });
    const result = schema.safeParse({ user: { email: "bad" } });
    if (!result.success) {
      const fieldErrors = fieldErrorsFromZod(result.error);
      expect(fieldErrors["user.email"]).toBeTruthy();
    }
  });
});
