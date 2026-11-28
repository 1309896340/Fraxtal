import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
} from "@/server/auth/password";

describe("password", () => {
  it("正确密码校验通过", async () => {
    const hashStr = await hashPassword("correct horse battery staple");
    await expect(
      verifyPassword(hashStr, "correct horse battery staple"),
    ).resolves.toBe(true);
  });

  it("错误密码被拒绝", async () => {
    const hashStr = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hashStr, "wrong password")).resolves.toBe(
      false,
    );
  });

  it("哈希输出不含明文子串（防明文落库）", async () => {
    const plain = "correct horse battery staple";
    const hashStr = await hashPassword(plain);
    expect(hashStr).not.toContain(plain);
    expect(hashStr).toMatch(/^\$argon2id\$/); // PHC 格式且明确为 argon2id
  });
});
