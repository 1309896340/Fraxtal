import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import {
  REFRESH_TOKEN_TTL_SEC,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/server/auth/jwt";
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
  revokeRefreshRecordOnly,
  type RefreshRecord,
} from "@/server/repositories/session-repo";
import type { User } from "@/server/repositories/user-repo";

/** refresh token 的存储摘要（不落原 token）。 */
function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
}

export type RotateResult =
  | { ok: true; accessToken: string; refreshToken: string; userId: string }
  /** invalid：正常失效（过期/撤销/伪造）；replay：重放，已触发全端下线 */
  | { ok: false; reason: "invalid" | "replay" };

/** 注册新用户。email 冲突时抛出 postgres 唯一约束错误（code 23505）。 */
export function registerUser(email: string, password: string): Promise<User> {
  // 密码哈希在调用方（route handler）完成后传入本层前的位置见 register 路由
  return createUser(email, password);
}

/** 按 email 查用户（登录用）。 */
export function getUserByEmail(email: string): Promise<User | null> {
  return findUserByEmail(email);
}

/** 签发全新会话：预生成 jti → 签 refresh → 落哈希记录 → 签 access。 */
export async function issueSession(
  user: Pick<User, "id" | "sessionVersion">,
): Promise<IssuedSession> {
  const recordId = nanoid();
  const refreshToken = await signRefreshToken({ sub: user.id, jti: recordId });
  await createRefreshRecord({
    id: recordId,
    userId: user.id,
    tokenHash: tokenHash(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000),
  });
  const accessToken = await signAccessToken({
    sub: user.id,
    sv: user.sessionVersion,
  });
  return { accessToken, refreshToken };
}

/**
 * refresh 旋转（user-auth「JWT 双 token 会话」）：
 * 旧 refresh 一次性作废并记录继任；检测到已旋转 token 复用（重放）
 * 时撤销该用户全部活跃会话并递增 session_version，使所有已签发
 * access token 即时失效（spec「重放触发全端下线」）。
 */
export async function rotateSession(
  oldRefreshToken: string,
): Promise<RotateResult> {
  let userId: string;
  let recordId: string;
  try {
    const claims = await verifyRefreshToken(oldRefreshToken);
    userId = claims.sub;
    recordId = claims.jti;
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const record: RefreshRecord | null = await findRefreshRecordById(recordId);
  if (!record) {
    return { ok: false, reason: "invalid" };
  }

  // 重放：已被旋转替换的 token 再次出现
  if (record.revokedAt && record.replacedBy) {
    await Promise.all([
      revokeAllUserRefreshRecords(userId),
      incrementSessionVersion(userId),
    ]);
    return { ok: false, reason: "replay" };
  }

  // 登出撤销（无继任）或不存在：普通失效，不做惩罚
  if (record.revokedAt) {
    return { ok: false, reason: "invalid" };
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "invalid" };
  }

  const user = await findUserById(userId);
  if (!user) {
    return { ok: false, reason: "invalid" };
  }

  // 先签发新会话，成功后才撤销旧记录（避免中间态卡死）
  const newRecordId = nanoid();
  const newRefreshToken = await signRefreshToken({
    sub: userId,
    jti: newRecordId,
  });
  await createRefreshRecord({
    id: newRecordId,
    userId,
    tokenHash: tokenHash(newRefreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000),
  });
  await revokeRefreshRecord(record.id, newRecordId);

  const accessToken = await signAccessToken({
    sub: userId,
    sv: user.sessionVersion,
  });
  return { ok: true, accessToken, refreshToken: newRefreshToken, userId };
}

/** 登出：撤销对应会话记录。token 无效时静默忽略（幂等）。 */
export async function logoutSession(refreshToken: string): Promise<void> {
  let recordId: string;
  try {
    const claims = await verifyRefreshToken(refreshToken);
    recordId = claims.jti;
  } catch {
    return;
  }
  const record = await findRefreshRecordById(recordId);
  if (!record || record.revokedAt) {
    return;
  }
  await revokeRefreshRecordOnly(record.id);
}

/** 校验 access token 的 session_version 是否仍然有效（API 层完整校验）。 */
export async function isAccessSessionValid(
  userId: string,
  sv: number,
): Promise<boolean> {
  const user = await findUserById(userId);
  return user !== null && user.sessionVersion === sv;
}
