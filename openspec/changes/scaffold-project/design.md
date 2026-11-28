# Design

## Context

仓库为 greenfield（无既有代码），上游技术决策已在 [tech-decisions.md](../../../docs/tech-decisions.md) 定案：D7（JWT 双 token 认证）、D8（Postgres + Drizzle + postgres.js）、D12（文件结构与 `lib/server` 边界）。本设计不复述这些决策，只补充本变更（脚手架 + 认证）落地所需的实施细节。动机见 proposal.md - Why。

## Goals / Non-Goals

**Goals:**

- 克隆仓库 → 一条命令 → 可注册登录的最小可运行实例
- 落定 D12 的 `src/` 骨架与 ESLint import 边界，为后续画布/LLM 变更铺路
- 认证全链路按 D7 实现（含 refresh 旋转与重放防护）

**Non-Goals:**

- 画布、决策树、LLM 调用、项目创建（后续变更）
- shadcn/ui 引入（本变更 UI 仅登录/注册表单与占位主页，Tailwind 手写足够；组件库随画布变更再引入）
- 邮箱验证与密码找回（MVP 边界外）
- CI/CD 流水线

## Decisions

### D-1 包管理器：pnpm

后续可能演进 workspaces（如独立 CLI 包），且安装效率与磁盘占用优于 npm。备选 npm（零门槛）被否：迁移成本随依赖增长而上升，现在切换最便宜。

### D-2 认证实现选型（D7 落地化）

- **密码哈希**：`@node-rs/argon2`（Rust 原生绑定，prebuilt binaries 覆盖 linux x64/arm64）。备选纯 JS `argon2`（慢一个数量级）被否。
- **JWT**：`jose`。`src/proxy.ts`（Next.js 16：原 middleware 约定已更名为 proxy，默认 Node.js runtime）只做 access token 的签名与过期校验（无 DB 查询，快）；API 层统一 helper 再做完整校验。
- **refresh 旋转的服务端状态**：重放防护（spec 要求「重放 → 全端下线」）无法用纯无状态 JWT 实现，因此新增 `refresh_tokens` 表：存 token 的 SHA-256 哈希（不存原 token）、`user_id`、`expires_at`、`revoked_at`、`replaced_by`。检测到已旋转 token 复用时，撤销该用户全部记录。
- **session_version 全端下线机制**：`users.session_version`（整数，默认 0）写入 access token 载荷（`sv` 声明）。检测到 refresh 重放时该值 +1，使该用户所有已签发 access token 立即失效。校验分两级：middleware（Edge）只验签名与过期（快路径，页面路由）；API 层统一 helper 完整校验（签名 + 过期 + 比对 DB 中的 session_version），保证 spec 的「所有已登录端后续请求均返回 401」。
- **Cookie**：`httpOnly` + `SameSite=Strict`；`Secure` 按请求实际协议动态判定（HTTPS/反代 `X-Forwarded-Proto` → Secure；HTTP 直连 → 不带，否则浏览器拒存 Cookie 导致会话完全失效）；名称 `frx_access` / `frx_refresh`。

### D-3 数据层（D8 落地化）

Drizzle schema（本变更两张表）：

```
users           id TEXT PK (nanoid·服务端生成) · email TEXT UNIQUE
                password_hash TEXT · session_version INTEGER DEFAULT 0
                created_at TIMESTAMPTZ
refresh_tokens  id TEXT PK · user_id FK · token_hash TEXT UNIQUE
                expires_at TIMESTAMPTZ · revoked_at TIMESTAMPTZ NULL
                replaced_by TEXT NULL · created_at TIMESTAMPTZ
```

- pool 实例挂 `globalThis`（防 Next.js dev HMR 连接泄漏）
- **迁移执行策略**：容器 entrypoint 先执行 `drizzle-kit migrate` 再启动 Next（满足 app-runtime spec 的「启动时迁移就绪」）；开发环境由开发者手动执行迁移命令

### D-4 Docker 镜像与编排

- **多阶段构建**：builder 阶段（装依赖 + `next build`，`output: 'standalone'`）→ runner 阶段（仅 standalone 产物 + 生产依赖 + argon2 原生模块）
- **compose 服务**：`db`（postgres:16-alpine + volume + `pg_isready` healthcheck）→ `app`（depends_on db healthy，暴露 3000 端口）

### D-5 目录落位（D12 的本变更子集）

只创建本变更触及的目录，其余（canvas、llm、tree 等）随对应变更出现，避免空目录：

```
src/
├── middleware.ts                    # access 校验 + 页面路由保护
├── app/(auth)/{login,register}/     # 认证页
├── app/(main)/page.tsx              # 受保护主页（项目列表占位）
├── app/api/auth/{register,login,refresh,logout}/route.ts
├── app/api/health/route.ts
├── components/auth/                 # 登录/注册表单
├── lib/schemas/user.ts              # zod：注册/登录请求与响应 DTO
├── lib/api-client.ts                # 统一 fetch 封装（401 → refresh → 重放）
├── server/auth/{jwt,password,session}.ts
├── server/repositories/user-repo.ts · session-repo.ts
└── db/{index,schema}.ts · migrations/
```

ESLint import 边界（`import/no-restricted-paths`）：`app/components` 不得 import `server/*`、`lib` 不得 import `app/components/server`。

### D-6 API 错误结构统一

所有 API 错误响应统一为 `{ "error": { "code": string, "message": string } }`，zod 校验失败映射为字段级 `code: "VALIDATION"`。认证失败统一 `code: "INVALID_CREDENTIALS"`（满足 spec 的防枚举要求）。

## Risks / Trade-offs

- **[argon2 原生模块在 Docker 构建失败]** → runner 阶段基于 glibc 镜像（非 alpine）避免 musl 兼容问题；prebuilt binaries 覆盖主流平台
- **[middleware 只验签不查库 → 页面级存在 15 分钟吊销窗口]** → access 短时效 + API 层 session_version 完整校验兜底：安全事件（重放）触发全端即时下线，页面路由的 15min 窗口在 MVP 可接受
- **[entrypoint 自动迁移在多实例并发启动时竞态]** → Drizzle 迁移使用咨询锁；当前单实例部署无碍，多实例演进时再改为独立 migrate job
- **[pnpm 非所有贡献者环境标配]** → README 与 `.env.example` 注明安装方式

## Migration Plan

- **部署**：全新环境无存量数据，`docker compose up -d` 直达就绪（entrypoint 自动迁移）
- **回滚**：回退镜像 tag 重启；greenfield 阶段 schema 无兼容包袱

## Open Questions

（无——email 验证、shadcn 引入时机均已在 Non-Goals 中明确排除，不影响本设计）
