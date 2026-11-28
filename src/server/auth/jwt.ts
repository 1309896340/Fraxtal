import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";

/** access token 寿命：15 分钟（tech-decisions D7）。 */
export const ACCESS_TOKEN_TTL_SEC = 15 * 60;
/** refresh token 寿命：7 天。 */
export const REFRESH_TOKEN_TTL_SEC = 7 * 24 * 60 * 60;

export interface AccessTokenClaims {
  /** 用户 id */
  sub: string;
  /** 签发时的 session_version，用于重放事件全端下线 */
  sv: number;
}

export interface RefreshTokenClaims {
  /** 用户 id */
  sub: string;
  /** 对应 refresh_tokens 表记录 id（jti） */
  jti: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  ttlSec: number = ACCESS_TOKEN_TTL_SEC,
): Promise<string> {
  return new SignJWT({ sv: claims.sv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .sign(secretKey());
}

export async function signRefreshToken(
  claims: RefreshTokenClaims,
  ttlSec: number = REFRESH_TOKEN_TTL_SEC,
): Promise<string> {
  return new SignJWT({ jti: claims.jti })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .sign(secretKey());
}

/** 校验并解出 access claims；无效（过期/篡改/结构不符）一律抛错。 */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey());
  const { sub, sv } = payload as Partial<AccessTokenClaims> & { sv?: unknown };
  if (typeof sub !== "string" || typeof sv !== "number") {
    throw new Error("access token 载荷结构非法（缺少 sub 或 sv）");
  }
  return { sub, sv };
}

/** 校验并解出 refresh claims；无效一律抛错。 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey());
  const { sub, jti } = payload as Partial<RefreshTokenClaims> & {
    jti?: unknown;
  };
  if (typeof sub !== "string" || typeof jti !== "string") {
    throw new Error("refresh token 载荷结构非法（缺少 sub 或 jti）");
  }
  return { sub, jti };
}
