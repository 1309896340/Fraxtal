# Tasks

## 1. 项目初始化与工具链

- [ ] 1.1 用 create-next-app 生成 Next.js（App Router + TypeScript + Tailwind + ESLint）项目并迁移进 `src/` 结构，验证 `pnpm dev` 启动且默认页可访问
- [ ] 1.2 配置 ESLint import 边界规则（`app/components` 不得 import `server/*`；`lib` 不得 import `app/components/server`），验证违规方向的 import 触发 lint 报错
- [ ] 1.3 实现环境变量加载与校验（zod 解析 `process.env`：`DATABASE_URL`、`JWT_SECRET`），验证缺失变量时启动失败且错误信息指明变量名（对应 app-runtime「缺失必需配置」场景）

## 2. 数据层

- [ ] 2.1 安装 Drizzle + postgres.js 并落位 `db/index.ts`（pool 挂 globalThis 防 HMR 泄漏）与 `drizzle.config.ts`，验证 `drizzle-kit generate` 可产出迁移文件
- [ ] 2.2 编写 `db/schema.ts`（users：id/email/password_hash/session_version/created_at；refresh_tokens：token_hash/expires_at/revoked_at/replaced_by）并生成首个迁移，验证对本地库执行 migrate 后两张表结构正确
- [ ] 2.3 实现 `server/repositories/user-repo.ts` 与 `session-repo.ts`（创建用户、按 email 查询、存取与撤销 refresh 记录、递增 session_version），验证 `__tests__` 单测（连本地 compose db）全部通过

## 3. 认证核心模块

- [ ] 3.1 实现 `server/auth/password.ts`（argon2id 哈希与校验），验证单测覆盖：正确密码通过、错误密码拒绝、哈希输出不含明文
- [ ] 3.2 实现 `server/auth/jwt.ts`（jose 签发/校验 access 与 refresh，access 载荷含 `sv` 声明），验证单测覆盖：有效 token 通过、过期拒绝、篡改签名拒绝
- [ ] 3.3 实现 `server/auth/session.ts`（登录签发、refresh 旋转更新 replaced_by、重放检测撤销全部会话并递增 session_version），验证单测覆盖 spec 场景「重放触发全端下线」

## 4. 认证 API 与前端页面

- [ ] 4.1 编写 `lib/schemas/user.ts`（注册/登录请求与响应 DTO）与统一错误结构 `{ error: { code, message } }`，验证单测覆盖校验失败的字段级映射
- [ ] 4.2 实现 `POST /api/auth/register`（成功即签发会话；email 冲突 409；校验失败 422），验证 curl 三场景：新 email 返回会话 Cookie、重复 email 返回 409、短密码返回 422
- [ ] 4.3 实现 `POST /api/auth/login` 与 `/api/auth/logout`（凭据错误统一返回 401 INVALID_CREDENTIALS；登出撤销 refresh 并清除 Cookie），验证 curl：错误密码与不存在 email 返回相同 401 结构、登出后旧 Cookie 访问受保护 API 返回 401
- [ ] 4.4 实现 `POST /api/auth/refresh`（旋转签发新双 token、旧 refresh 作废；重放触发该用户全端下线），验证 curl 序列：正常旋转成功、同一旧 refresh 二次提交返回 401 且此前签发的 access 调用受保护 API 全部 401
- [ ] 4.5 实现 `src/middleware.ts` 页面路由保护与 `(auth)/login`、`(auth)/register`、`(main)` 占位主页，验证：未登录访问 `/` 重定向至 `/login`，登录后可进入主页
- [ ] 4.6 实现 `lib/api-client.ts`（401 时自动调 refresh 并重放原请求一次）与登录/注册表单组件，验证浏览器手动流程：注册 → 自动进入主页 → 登出 → 重定向登录页

## 5. 部署与集成验收

- [ ] 5.1 编写多阶段 `Dockerfile`（builder 构建 standalone 产物；runner 含生产依赖与 argon2 原生模块），验证 `docker build` 成功且镜像可启动
- [ ] 5.2 编写 `docker-compose.yml`（postgres:16 + volume + healthcheck；app 依赖 db healthy；entrypoint 先 migrate 后启动），验证全新环境 `docker compose up -d` 后注册登录可用、销毁 app 容器重启后用户数据仍在（对应 app-runtime「容器重建后数据保留」场景）
- [ ] 5.3 实现 `GET /api/health`（探测数据库连通性），验证：db 正常返回 200 与健康标识、`docker compose stop db` 后返回非 200 与数据库故障标识（对应「数据库不可达」场景）
- [ ] 5.4 编写 README 快速开始（pnpm 安装、环境变量、compose 启动、开发模式），验证按文档从零目录执行全部命令成功
- [ ] 5.5 对照 `specs/user-auth/spec.md` 与 `specs/app-runtime/spec.md` 全部场景逐条集成验收，验证每条 WHEN/THEN 均通过并记录结果清单

## Workflow follow-up

- 实施完成并验收后，运行 `openspec archive --change scaffold-project` 归档变更，spec delta 同步至 `openspec/specs/`
- 归档后运行 `openspec validate --strict` 确认主 specs 完整
