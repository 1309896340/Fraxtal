// 容器 entrypoint 的运行时迁移（runner 镜像不含 drizzle-kit，
// 使用 drizzle-orm 的 migrator 直接应用 src/db/migrations 下的 SQL）。
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("迁移失败：DATABASE_URL 未设置");
  process.exit(1);
}

const { drizzle } = await import("drizzle-orm/postgres-js");
const { migrate } = await import("drizzle-orm/postgres-js/migrator");
const postgres = (await import("postgres")).default;

const connection = postgres(url, { max: 1 });
try {
  const db = drizzle(connection);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("[migrate] 数据库迁移完成");
} catch (error) {
  console.error("[migrate] 迁移失败：", error);
  process.exit(1);
} finally {
  await connection.end();
}
