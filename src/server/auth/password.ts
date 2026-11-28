import { hash, verify } from "@node-rs/argon2";

/**
 * 密码哈希（tech-decisions D7）：argon2id。
 * 库默认算法即 Argon2id，默认参数满足 OWASP 推荐
 * （memoryCost 19456 KiB / timeCost 2 / parallelism 1）。
 * 不显式传 Algorithm：其 ambient const enum 在 isolatedModules 下不可访问。
 */
/** 哈希明文密码，返回 PHC 格式字符串（含算法、盐与参数，可直接入库）。 */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

/** 校验明文密码与 PHC 哈希是否匹配（参数自动取自哈希串）。 */
export function verifyPassword(
  phcHash: string,
  plain: string,
): Promise<boolean> {
  return verify(phcHash, plain);
}
