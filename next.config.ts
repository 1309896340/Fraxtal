import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 容器部署：生成自包含产物（.next/standalone，design D-4 多阶段镜像）
  output: "standalone",
  // drizzle-orm / postgres 保持外部依赖（不内联进 server bundle），
  // standalone 的 node_modules 才会携带它们——scripts/migrate.mjs 运行时迁移依赖此解析
  serverExternalPackages: ["drizzle-orm", "postgres"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
