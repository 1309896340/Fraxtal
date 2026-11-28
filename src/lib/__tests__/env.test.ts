import { describe, expect, it } from "vitest";
import { loadEnv } from "@/lib/env";

const validEnv = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/fraxtal",
  JWT_SECRET: "0123456789abcdef0123456789abcdef",
};

describe("loadEnv", () => {
  it("合法配置解析成功", () => {
    const env = loadEnv(validEnv);
    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(env.NODE_ENV).toBe("development");
  });

  it("缺失 DATABASE_URL 时抛错并指明变量名", () => {
    const rest = { JWT_SECRET: validEnv.JWT_SECRET };
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("JWT_SECRET 过短时抛错并指明变量名", () => {
    expect(() => loadEnv({ ...validEnv, JWT_SECRET: "short" })).toThrow(
      /JWT_SECRET/,
    );
  });
});
