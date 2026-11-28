import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { nanoid } from "nanoid";
import {
  createUser,
  findUserByEmail,
  findUserById,
  incrementSessionVersion,
} from "@/server/repositories/user-repo";
import {
  createRefreshRecord,
  findRefreshRecordById,
  revokeAllUserRefreshRecords,
  revokeRefreshRecord,
} from "@/server/repositories/session-repo";

// 本组为连接本地 dev 库的集成测试（vitest.setup.ts 提供 DATABASE_URL）
const suffix = nanoid(8);
const testEmails = [`repo-test-${suffix}@example.com`, `repo-test-2-${suffix}@example.com`];
const userIds: string[] = [];

afterAll(async () => {
  // 清理测试数据（refresh_tokens 级联删除）
  for (const email of testEmails) {
    await db.delete(users).where(eq(users.email, email));
  }
});

describe("user-repo（真库集成）", () => {
  it("创建用户并可按 email / id 查回", async () => {
    const created = await createUser(testEmails[0], "argon2hash");
    userIds.push(created.id);
    expect(created.email).toBe(testEmails[0]);
    expect(created.sessionVersion).toBe(0);

    const byEmail = await findUserByEmail(testEmails[0]);
    expect(byEmail?.id).toBe(created.id);
    expect(byEmail).not.toHaveProperty("passwordHash", undefined);

    const byId = await findUserById(created.id);
    expect(byId?.email).toBe(testEmails[0]);
  });

  it("重复 email 触发唯一约束错误（23505）", async () => {
    const dupEmail = `repo-test-dup-${suffix}@example.com`;
    testEmails.push(dupEmail);
    await createUser(dupEmail, "first");
    // drizzle 将底层错误包为 DrizzleQueryError，postgres 错误码在 cause 上
    const error = await createUser(dupEmail, "dup").catch((e) => e);
    expect((error as { cause?: { code?: string } }).cause?.code).toBe("23505");
  });

  it("查询不存在的用户返回 null", async () => {
    await expect(findUserById("nonexistent")).resolves.toBeNull();
    await expect(findUserByEmail("ghost@example.com")).resolves.toBeNull();
  });

  it("session_version 原子递增", async () => {
    const created = await createUser(testEmails[1], "argon2hash");
    userIds.push(created.id);
    await expect(incrementSessionVersion(created.id)).resolves.toBe(1);
    await expect(incrementSessionVersion(created.id)).resolves.toBe(2);
  });
});

describe("session-repo（真库集成）", () => {
  it("创建/查询/旋转/全量撤销 refresh 记录", async () => {
    const sessionEmail = `repo-test-session-${suffix}@example.com`;
    testEmails.push(sessionEmail);
    const created = await createUser(sessionEmail, "argon2hash");
    userIds.push(created.id);

    const recA = await createRefreshRecord({
      id: nanoid(),
      userId: created.id,
      tokenHash: `hash_a_${suffix}`,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const recB = await createRefreshRecord({
      id: nanoid(),
      userId: created.id,
      tokenHash: `hash_b_${suffix}`,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const found = await findRefreshRecordById(recA.id);
    expect(found?.tokenHash).toBe(`hash_a_${suffix}`);

    // 旋转 A：撤销 + 继任指针
    await revokeRefreshRecord(recA.id, recB.id);
    const revoked = await findRefreshRecordById(recA.id);
    expect(revoked?.revokedAt).not.toBeNull();
    expect(revoked?.replacedBy).toBe(recB.id);

    // 全量撤销后 B 也被标记
    await revokeAllUserRefreshRecords(created.id);
    const revokedB = await findRefreshRecordById(recB.id);
    expect(revokedB?.revokedAt).not.toBeNull();
  });
});
