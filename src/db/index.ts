import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

type RealDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * 连接池挂 globalThis：防止 Next.js dev HMR 反复重载泄漏文件句柄/连接。
 */
declare global {
  var __fraxtalSql: postgres.Sql | undefined;
}

function getSql(): postgres.Sql {
  globalThis.__fraxtalSql ??= postgres(getEnv().DATABASE_URL, {
    max: 10,
    idle_timeout: 30,
  });
  return globalThis.__fraxtalSql;
}

let realDb: RealDb | null = null;

/**
 * 惰性单例：模块导入零副作用（next build 的 page data 收集阶段
 * 会评估模块但不提供运行环境——首次真正查询时才校验 env 并建连）。
 */
function getDb(): RealDb {
  realDb ??= drizzle(getSql(), { schema });
  return realDb;
}

export const db = new Proxy({} as RealDb, {
  get(_target, prop, receiver) {
    const instance = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export type Db = RealDb;
export { schema };
