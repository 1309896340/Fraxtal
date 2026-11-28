import { beforeEach, describe, expect, it, vi } from "vitest";

// ── 内存状态（模拟两张表）─────────────────────────────
const { users, records, revokeAllSpy, incrementVersionSpy } = vi.hoisted(
  () => {
    const users = new Map<
      string,
      {
        id: string;
        email: string;
        passwordHash: string;
        sessionVersion: number;
        createdAt: Date;
      }
    >();
    const records = new Map<
      string,
      {
        id: string;
        userId: string;
        tokenHash: string;
        expiresAt: Date;
        revokedAt: Date | null;
        replacedBy: string | null;
        createdAt: Date;
      }
    >();
    return {
      users,
      records,
      revokeAllSpy: vi.fn(async (userId: string) => {
        for (const r of records.values()) {
          if (r.userId === userId && !r.revokedAt) r.revokedAt = new Date();
        }
      }),
      incrementVersionSpy: vi.fn(async (id: string) => {
        const u = users.get(id);
        if (!u) return 0;
        u.sessionVersion += 1;
        return u.sessionVersion;
      }),
    };
  },
);

vi.mock("@/server/repositories/user-repo", () => ({
  createUser: vi.fn(async (email: string, passwordHash: string) => {
    const user = {
      id: `user_${users.size + 1}`,
      email,
      passwordHash,
      sessionVersion: 0,
      createdAt: new Date(),
    };
    users.set(user.id, user);
    return user;
  }),
  findUserByEmail: vi.fn(async (email: string) =>
    [...users.values()].find((u) => u.email === email) ?? null,
  ),
  findUserById: vi.fn(async (id: string) => users.get(id) ?? null),
  incrementSessionVersion: incrementVersionSpy,
}));

vi.mock("@/server/repositories/session-repo", () => ({
  createRefreshRecord: vi.fn(async (input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) => {
    const record = {
      ...input,
      revokedAt: null,
      replacedBy: null,
      createdAt: new Date(),
    };
    records.set(input.id, record);
    return record;
  }),
  findRefreshRecordById: vi.fn(async (id: string) => records.get(id) ?? null),
  revokeRefreshRecord: vi.fn(async (id: string, replacedBy: string) => {
    const r = records.get(id);
    if (r) {
      r.revokedAt = new Date();
      r.replacedBy = replacedBy;
    }
  }),
  revokeRefreshRecordOnly: vi.fn(async (id: string) => {
    const r = records.get(id);
    if (r) r.revokedAt = new Date();
  }),
  revokeAllUserRefreshRecords: revokeAllSpy,
}));

import {
  issueSession,
  isAccessSessionValid,
  logoutSession,
  rotateSession,
} from "@/server/auth/session";

function activeCount(): number {
  return [...records.values()].filter((r) => !r.revokedAt).length;
}

describe("session", () => {
  beforeEach(() => {
    users.clear();
    records.clear();
    vi.clearAllMocks();
    users.set("user_1", {
      id: "user_1",
      email: "a@b.c",
      passwordHash: "hash",
      sessionVersion: 0,
      createdAt: new Date(),
    });
  });

  it("签发会话：产生一条活跃 refresh 记录", async () => {
    const user = users.get("user_1")!;
    const { accessToken, refreshToken } = await issueSession(user);
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    expect(activeCount()).toBe(1);
  });

  it("正常旋转：旧记录撤销并指向继任，签发新双 token", async () => {
    const user = users.get("user_1")!;
    const first = await issueSession(user);
    const result = await rotateSession(first.refreshToken);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.refreshToken).not.toBe(first.refreshToken);
      expect(result.userId).toBe("user_1");
    }
    // 两条记录：旧（撤销+继任指针）、新（活跃）
    expect(records.size).toBe(2);
    expect(activeCount()).toBe(1);
  });

  it("重放触发全端下线：旧 access 即时失效、全部会话撤销", async () => {
    const user = users.get("user_1")!;
    const first = await issueSession(user);

    // 第一次旋转成功
    const rotated = await rotateSession(first.refreshToken);
    expect(rotated.ok).toBe(true);

    // 重放：旧 refresh 再次提交
    const replay = await rotateSession(first.refreshToken);
    expect(replay).toEqual({ ok: false, reason: "replay" });

    // 全端下线：该用户所有记录撤销 + session_version 递增
    expect(revokeAllSpy).toHaveBeenCalledWith("user_1");
    expect(incrementVersionSpy).toHaveBeenCalledWith("user_1");
    expect(users.get("user_1")!.sessionVersion).toBe(1);
    expect(activeCount()).toBe(0);
    // 旧 access token（sv=0）不再通过 API 层完整校验
    await expect(isAccessSessionValid("user_1", 0)).resolves.toBe(false);
    await expect(isAccessSessionValid("user_1", 1)).resolves.toBe(true);
  });

  it("登出后复用旧 refresh：普通失效，不触发惩罚", async () => {
    const user = users.get("user_1")!;
    const first = await issueSession(user);
    await logoutSession(first.refreshToken);

    const result = await rotateSession(first.refreshToken);
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(revokeAllSpy).not.toHaveBeenCalled();
  });

  it("伪造 refresh token：invalid", async () => {
    const result = await rotateSession("garbage.token.value");
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });
});
