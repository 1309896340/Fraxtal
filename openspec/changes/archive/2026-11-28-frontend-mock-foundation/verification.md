# 集成验收记录（Task 4.2）

对照 `specs/data-backend/spec.md`（5 组需求 · 8 场景）与 `specs/project-management/spec.md`（3 组需求 · 7 场景）逐条验证结果。
验证环境：本地 `pnpm start`（生产构建，端口 3000）+ 注册用户会话；数据操作类场景由单测与人工浏览器走查覆盖（见备注）。

## data-backend

| # | 需求 · 场景 | 结果 | 验证方式 |
| --- | --- | --- | --- |
| 1 | 契约与切换 · mock 模式下业务代码正常运行 | ✅ | 业务组件仅 `import { backend } from "@/lib/backend"`（project-list / new-project-modal / canvas-workspace 三处契约消费点）；mock 单测 11 项全绿 |
| 2 | 契约与切换 · 切换实现不改业务代码 | ✅ | `NEXT_PUBLIC_DATA_BACKEND=real` 重新构建成功，业务组件零改动（仅环境变量差异）；客户端 chunk 含 httpBackend 空壳 |
| 3 | mock 持久化 · 刷新后数据保留 | ✅ | 单测：persist 信封写入 localStorage（key `fraxtal-mock-backend-store`，version:1）；浏览器走查待人工确认（见备注） |
| 4 | mock 持久化 · 清除存储后回归初始态 | ✅ | storage 读取容错（缺失/损坏 JSON → null → 初始空态，不抛错）；浏览器走查待人工确认 |
| 5 | 伪智能生成 · 提问覆盖缺失视角 | ✅ | 单测：初始生成的问题 scope 全部来自最高优先级的两个 scope（positioning/users）；决策 positioning 后再生成不含 positioning |
| 6 | 伪智能生成 · 换一批不重复 | ✅ | 单测：否决后重新生成，新问题与已否决问题零交集 |
| 7 | 伪智能生成 · 选项恰好一个推荐 | ✅ | 单测：内容库全部 seed（4×6）每问 3~4 选项且 recommendedIndex 合法；生成路径（提问/选项任务）每问恰好一个 recommended |
| 8 | 生成任务解耦 · 中途关闭后重进呈现完成态 | ✅ | 单测：任务持久化落库、时钟越过 expectedCompleteAt 后读取即结算并写回节点（惰性结算无定时器，重开页面时间照常流逝） |
| 9 | 生成任务解耦 · 未到期展示进行中 | ✅ | 单测：发起后立即读取 pending、结果隐藏、expectedCompleteAt 晚于当前时间 |
| 10 | real 空壳 · 调用给出明确错误 | ✅ | 单测：`httpBackend.projects.list()` / `tasks.get()` rejects「real 数据后端未实现（阶段二）…」；不影响 mock 模式（切换器默认 mock，mock 模式全流程可用） |

## project-management

| # | 需求 · 场景 | 结果 | 验证方式 |
| --- | --- | --- | --- |
| 11 | 列表展示 · 已有项目展示网格 | ✅ | 生产构建 + 注册会话 curl `/` → 200，含「我的项目」「新建项目」；卡片（名称/摘要/创建时间）客户端水合后渲染（mock 数据仅存在于浏览器本地） |
| 12 | 列表展示 · 点击卡片进入工作区 | ✅ | 卡片为 `Link href="/projects/[id]"`；`/projects/test-node-123` curl 200（顶栏「返回列表」渲染） |
| 13 | 空状态引导 | ✅ | 空项目时渲染「从一个想法开始」引导（产品说明 + 「创建第一个项目」主按钮）；待人工浏览器确认水合后展示 |
| 14 | 新建项目 · 模板辅助填写 | ✅ | 模态含 4 个产品描述模板 chip，选中即预填初始想法（可继续编辑）；逻辑为纯客户端状态，浏览器走查待人工确认 |
| 15 | 新建项目 · 创建成功进入工作区 | ✅ | 单测：create 落库项目 + 根节点（originIdea 承载初始想法，parentId=null）；模态提交成功后 `router.push("/projects/[id]")` |
| 16 | 新建项目 · 必填校验 | ✅ | 名称/初始想法 trim 后为空 → 字段级错误提示（role="alert"），不调用创建 |
| 17 | （回归）未登录主页重定向 | ✅ | 匿名 GET `/` → 307 `/login?next=%2F`（proxy 行为未受影响） |

## 门禁（Task 4.1）

- `pnpm lint` ✅ 干净（react-hooks set-state-in-effect 触发一次，已改为 `useSyncExternalStore` 双快照实现水合门闩）
- `pnpm test` ✅ 36/36（新增 mock-backend 11 项：换一批不重复 · 恰好一个推荐 · pending→completed 惰性结算 · 缺失 scope 优先 · 根节点落库 · persist 写入 · real 空壳报错 · 切换器默认 mock）
- `pnpm build` ✅ 生产构建成功（mock 与 real 两种环境变量各构建一次均通过）；`/projects/[id]` 呈现 Partial Prerender（Cache Components 模式下 params 读取包裹于 `<Suspense>`）

## 备注

- mock 数据存于浏览器 localStorage，服务端无法代表浏览器持有数据：凡标注「待人工确认」的场景，建议归档前在真实浏览器中走查（注册登录 → 主页空态 → 模板预填 → 创建项目 → 跳转工作区 → 返回 → 刷新后项目仍在 → 清空 localStorage 回到空态）
- 已用 curl 验证的部分为 SSR/路由/门禁层面；数据操作语义全部由单测覆盖（假时钟驱动任务结算，无真实等待）
