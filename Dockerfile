# ── builder：装依赖 + 构建 standalone 产物 ──────────────
FROM node:24-slim AS builder
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# 为 runner 准备完整的迁移依赖：standalone 按文件级追踪拷贝 pnpm 存储，
# drizzle-orm 只携带被应用 import 的片段（migrator 缺席），因此从完整
# node_modules 解引用拷贝真实文件（drizzle-orm 运行时仅 peer 依赖 postgres）
RUN mkdir -p /migrate-runtime/node_modules \
  && cp -rL /app/node_modules/.pnpm/drizzle-orm@*/node_modules/drizzle-orm /migrate-runtime/node_modules/ \
  && cp -rL /app/node_modules/.pnpm/postgres@*/node_modules/postgres /migrate-runtime/node_modules/

# ── runner：最小运行时（glibc 满足 @node-rs/argon2 原生模块）──
FROM node:24-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# standalone 产物自带树摇后的生产依赖（含 drizzle-orm / postgres / @node-rs/argon2）
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 覆盖 standalone 中残缺的 pnpm 片段为完整真实包（迁移脚本与
# serverExternalPackages 的 postgres 驱动都依赖完整文件）
RUN rm -rf ./node_modules/drizzle-orm ./node_modules/postgres
COPY --from=builder /migrate-runtime/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder /migrate-runtime/node_modules/postgres ./node_modules/postgres

# 运行时迁移所需：迁移 SQL + migrator 脚本
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs

# entrypoint：先迁移后启动（app-runtime「数据库迁移就绪」）
ENTRYPOINT ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
