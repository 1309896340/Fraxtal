# 集成验收记录（Task 5.5）

对照 `specs/user-auth/spec.md`（13 场景）与 `specs/app-runtime/spec.md`（8 场景）逐条验证结果。
验证环境：本地 dev（pnpm dev + Docker Postgres）与容器化（docker compose）双形态。

## user-auth

| # | 场景 | 结果 | 验证方式 |
| --- | --- | --- | --- |
| 1 | 注册成功（签发会话进入主界面） | ✅ | curl 201 + 双 Cookie；带 Cookie 访问 `/` 200 |
| 2 | email 已被占用 | ✅ | curl 409 `EMAIL_EXISTS` |
| 3 | 输入校验失败（非法 email / 短密码） | ✅ | curl 422 `VALIDATION` + 字段级 fieldErrors |
| 4 | 登录成功 | ✅ | curl 200 + 双 Cookie |
| 5 | 凭据错误统一 401（防枚举） | ✅ | 错误密码与不存在 email 返回完全相同结构 |
| 6 | access 有效时访问受保护资源 | ✅ | 带 Cookie `GET /api/auth/me` 200 |
| 7 | access 过期 refresh 自动续期 | ✅ | refresh 200 + 全新双 token（旧 refresh 作废） |
| 8 | 双 token 均失效 | ✅ | 无 Cookie 页面 307→/login；无 access API 401 |
| 9 | 重放触发全端下线 | ✅ | 旋转后重放旧 refresh：401 REPLAY_DETECTED，重放前签发的新 access 调 me 401（session_version 生效）；单测同覆盖 |
| 10 | 登出后旧 Cookie 无法访问 | ✅ | 登出（清除 Cookie）后 me 401、页面 307 |
| 11 | 未登录访问主页重定向 | ✅ | 307 → /login?next=%2F |
| 12 | 未认证 API 返回 401 | ✅ | `UNAUTHORIZED` 统一结构 |

## app-runtime

| # | 场景 | 结果 | 验证方式 |
| --- | --- | --- | --- |
| 13 | 全新环境一键启动 | ✅ | `docker compose up -d`：db healthy → entrypoint 自动迁移 → 应用可注册登录 |
| 14 | 容器重建后数据保留 | ✅ | `--force-recreate app` 后同用户登录 200（同 id） |
| 15 | 健康检查（数据库连通） | ✅ | 200 `{status:"healthy",database:"up"}` |
| 16 | 健康检查（数据库不可达） | ✅ | `stop db` 后 503 `{status:"unhealthy",database:"down"}` + 故障信息 |
| 17 | 全新数据库首次启动自动迁移 | ✅ | compose 全新 volume，容器日志 `[migrate] 数据库迁移完成` |
| 18 | 存量库增量迁移安全执行 | ✅ | 容器多次重启重复执行 entrypoint migrate 幂等（drizzle 跳过已应用迁移），既有数据完好（场景 14 同证） |
| 19 | 按样例配置启动 | ✅ | `.env`（dev）与 compose env（容器）双形态运行成功 |
| 20 | 缺失必需配置拒绝启动 | ✅ | 无 env 运行镜像：`迁移失败：DATABASE_URL 未设置` + 非零退出；单测覆盖变量名指明 |

## 备注

- 自动化测试：25 个（env 3 · password 3 · jwt 4 · session 5 · api schema 5 · repo 真库集成 5），`pnpm test` 全绿
- `pnpm lint` 干净（分层 import 边界含违规探针验证）；`pnpm build` 成功（Next 16 Turbopack）
- 建议归档前在真实浏览器中人工走查一次完整 UI 流程（注册 → 主页 → 登出 → 登录）
