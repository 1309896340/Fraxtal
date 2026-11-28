import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { refreshTokens } from "@/db/schema";

export type RefreshRecord = typeof refreshTokens.$inferSelect;

export interface NewRefreshRecord {
  /** 由应用层预生成的记录 id（nanoid），将作为 refresh token 的 jti */
  id: string;
  userId: string;
  /** refresh token 的 SHA-256 十六进制摘要（不存原 token） */
  tokenHash: string;
  expiresAt: Date;
}

export function createRefreshRecord(
  input: NewRefreshRecord,
): Promise<RefreshRecord> {
  return db
    .insert(refreshTokens)
    .values(input)
    .returning()
    .then((rows) => rows[0]);
}

export function findRefreshRecordById(
  id: string,
): Promise<RefreshRecord | null> {
  return db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

/** 旋转：旧记录标记撤销并记录继任 id。 */
export function revokeRefreshRecord(
  id: string,
  replacedBy: string,
): Promise<void> {
  return db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), replacedBy })
    .where(eq(refreshTokens.id, id))
    .then(() => undefined);
}

/** 登出：撤销单条记录（无继任）。 */
export function revokeRefreshRecordOnly(id: string): Promise<void> {
  return db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)),
    )
    .then(() => undefined);
}

/** 重放事件：撤销该用户全部活跃会话记录。 */
export function revokeAllUserRefreshRecords(userId: string): Promise<void> {
  return db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
      ),
    )
    .then(() => undefined);
}
