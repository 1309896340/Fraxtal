# Fraxtal

基于画布的非线性 AI 产品设计决策树。将大模型交互与无限画布结合，用「用户问答节点」驱动可任意发散的设计决策树，解决线性对话 UI 的上下文丢失与试错成本问题。

- 产品需求：[docs/prototype-spec.md](./docs/prototype-spec.md)
- 技术决策：[docs/tech-decisions.md](./docs/tech-decisions.md)

## 技术栈

Next.js (App Router) · React 19 · TypeScript · Tailwind CSS · Postgres 16 + Drizzle ORM · JWT 双 token 认证（httpOnly Cookie）· Docker Compose

## 快速开始（容器化，推荐）

```bash
git clone https://github.com/1309896340/Fraxtal.git
cd Fraxtal
docker compose up -d          # 自动执行数据库迁移并启动应用
```

访问 http://localhost:3400 注册并登录（宿主机 3000 已被占用，约定 Fraxtal 使用 **3400**；容器内仍为 3000）。

- 健康检查：`curl http://localhost:3400/api/health`
- 数据持久化在 named volume `fraxtal-pgdata`，容器重建不丢数据
- Postgres 宿主端口映射为 **35432**（仅本地开发用，生产可移除该映射）

## 本地开发

```bash
pnpm install                        # 需要 pnpm（corepack enable）
cp .env.example .env                # 按需修改 DATABASE_URL / JWT_SECRET
docker compose up -d db             # 只启动数据库
pnpm drizzle-kit migrate            # 执行数据库迁移
pnpm dev                            # http://localhost:3000
```

## 常用命令

```bash
pnpm dev       # 开发服务器
pnpm build     # 生产构建
pnpm lint      # ESLint（含分层 import 边界检查）
pnpm test      # Vitest 单测 / 集成测试
```

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres 连接串 |
| `JWT_SECRET` | ✅ | 会话签名密钥，至少 32 字符，生产务必随机生成 |
| `LLM_*` | 后续 | LLM 接入配置（画布/LLM 变更启用），见 `.env.example` |

## 工程规范

- 目录结构与分层边界（`lib` 双端纯逻辑 / `server` 仅服务端）由 ESLint 强制，详见 tech-decisions D12
- 规范驱动开发：需求与变更走 OpenSpec 工作流（`openspec/`）
