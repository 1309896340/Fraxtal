# Proposal

## Why

仓库已完成产品需求（prototype-spec.md）与技术决策（tech-decisions.md D1~D12），但尚无一行可运行代码。本变更是 MVP 验收闭环（「一个想法 → 一份结构化文档」）的第一块可独立验收的基石：让任何人克隆仓库后即可一键启动应用，完成注册与登录，进入受保护的主界面。

## What Changes

- 新增 Next.js（App Router）+ TypeScript + React 19 项目脚手架，目录结构遵循 tech-decisions D12（`lib/server` 双端边界、repository 隔离）
- 新增数据层：Postgres 16 + Drizzle ORM + postgres.js（`users` 表与迁移）
- 新增用户认证全流程：email + 密码注册、登录、登出，JWT 双 token 会话（access 15min + refresh 7d 旋转，httpOnly Cookie）——tech-decisions D7
- 新增部署形态：Docker Compose（app + postgres + healthcheck + volume）
- 新增 `/api/health` 健康检查端点（返回数据库连通状态）
- 新增受保护的主页（登录后可见项目列表占位）与登录/注册页
- 不包含：画布、决策树、LLM 调用、项目创建（后续变更交付）

## Capabilities

### New Capabilities

- `user-auth`: 用户注册、登录、登出与 JWT 会话维持的行为契约，含密码安全与会话吊销规则
- `app-runtime`: 应用可运行性契约——容器一键启动、健康检查、数据库迁移就绪

### Modified Capabilities

（无——项目尚无既有 specs，本变更全部为新增能力）

## Impact

- **新增代码**：`src/` 全部（app 路由、api handlers、auth 模块、db 模块）、`Dockerfile`、`docker-compose.yml`、`drizzle.config.ts`、`.env.example`
- **新增依赖**：next、react、drizzle-orm、postgres、jose、argon2 实现、zod、nanoid 等
- **环境变量**：`DATABASE_URL`、`JWT_SECRET`
- **无破坏性变更**（greenfield 首个实施变更）
