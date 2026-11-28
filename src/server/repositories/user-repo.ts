import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export type User = typeof users.$inferSelect;

/** 按 email 查询用户；不存在返回 null。 */
export function findUserByEmail(email: string): Promise<User | null> {
  return db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

/** 按 id 查询用户；不存在返回 null。 */
export function findUserById(id: string): Promise<User | null> {
  return db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

/** 创建用户；email 唯一约束冲突时抛出 postgres 唯一性错误（code 23505）。 */
export function createUser(
  email: string,
  passwordHash: string,
): Promise<User> {
  return db
    .insert(users)
    .values({ email, passwordHash })
    .returning()
    .then((rows) => rows[0]);
}

/** 原子递增会话版本（重放事件全端下线），返回新版本号。 */
export function incrementSessionVersion(userId: string): Promise<number> {
  return db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ version: users.sessionVersion })
    .then((rows) => rows[0]?.version ?? 0);
}
