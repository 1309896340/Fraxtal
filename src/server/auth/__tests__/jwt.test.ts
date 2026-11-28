import { describe, expect, it } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/server/auth/jwt";

describe("jwt", () => {
  it("有效 access token 校验通过并返回 claims", async () => {
    const token = await signAccessToken({ sub: "user_1", sv: 3 });
    await expect(verifyAccessToken(token)).resolves.toEqual({
      sub: "user_1",
      sv: 3,
    });
  });

  it("过期 access token 被拒绝", async () => {
    const token = await signAccessToken({ sub: "user_1", sv: 0 }, -1);
    await expect(verifyAccessToken(token)).rejects.toThrow();
  });

  it("篡改签名的 token 被拒绝", async () => {
    const token = await signAccessToken({ sub: "user_1", sv: 0 });
    const [, payload] = token.split(".");
    const forged = ["eyJhbGciOiJIUzI1NiJ9", btoa('{"sv":99}'), payload].join(
      ".",
    );
    await expect(verifyAccessToken(forged)).rejects.toThrow();
  });

  it("refresh token 往返校验通过", async () => {
    const token = await signRefreshToken({ sub: "user_2", jti: "rec_9" });
    await expect(verifyRefreshToken(token)).resolves.toEqual({
      sub: "user_2",
      jti: "rec_9",
    });
  });
});
