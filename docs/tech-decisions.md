# Fraxtal 技术决策记录

> 状态：已采纳 · 日期：2026-11-26
> 上游文档：[prototype-spec.md](./prototype-spec.md)
> 本文档是 prototype-spec 末尾四大技术命题及头脑风暴延伸命题的决策结晶，作为后续所有 openspec 变更的技术基准。

## 0. 技术栈总览

```
┌─ 前端 ─────────────────────────────────────┐
│ Next.js App Router · React 19 · TypeScript │
│ @xyflow/react (React Flow 13) · elkjs      │
│ zustand + immer · zod · nanoid             │
│ shadcn/ui + Tailwind CSS                   │
├─ 服务端 ───────────────────────────────────┤
│ Route Handlers + zod 校验                   │
│ 决策链组装 L1/L2 · OpenAI-compatible client │
│ tool calling · SSE 流式编译                 │
├─ 认证 ─────────────────────────────────────┤
│ email + 密码 (argon2id) · JWT 双 token      │
│ httpOnly Cookie · jose                      │
├─ 数据 ─────────────────────────────────────┤
│ Postgres 16 · Drizzle ORM · postgres.js     │
└─ 部署：Docker Compose (app + db) ──────────┘
```

## 1. 前端画布 — React Flow (@xyflow/react v13)

**结论**：采用 React Flow，节点即 React 组件。

**决定性理由**：Fraxtal 的节点不是「图元」，而是复杂交互式 UI 容器（勾选列表、选项卡片、自定义输入框、生成按钮）。React Flow 中节点就是普通 React 组件，交互控件加 `className="nodrag"` 即可避免与画布拖拽冲突；无需桥接层。

**否决备选**：
- AntV X6：自定义 React 节点需 x6-react-shape 桥接，节点内部状态与图模型双向同步割裂，是长期摩擦源；
- tldraw：核心是画图工具而非节点编辑器，需自造节点系统，且商用 license 受限。

**性能纪律**（写入实施规范）：
- 节点组件一律 `React.memo`；
- zustand selector 精确订阅，防勾选状态变化引发全树重渲染；
- 树规模 <500 节点下无压力。

## 2. 画布布局 — elkjs 自动树形布局 + 微调记忆

**结论**：默认全自动树形布局（elkjs layered），用户微调可持久化为覆盖。

**机制**：
```ts
finalPos = node.positionOverride ?? elkLayoutedPos  // 渲染时合并
```
- `positionOverride: {x,y} | null` 持久化在 nodes 表（null = 跟随自动布局）；
- 全量跑 elkjs（树规模下 <100ms），应用覆盖后交 React Flow 渲染；
- 【重新排版】按钮一键清除全部覆盖，回到纯自动布局（逃生舱）。

**已知权衡（接受）**：树长大后自动布局结果漂移，绝对坐标覆盖可能错位；MVP 接受此限制，若未来成为真实痛点再演进为「相对 delta」方案（数据格式不变）。

**产品语义**：画布 = 决策拓扑，不是自由绘图。90% 场景用户零排版。

## 3. 数据模型 — 领域树是 source of truth

**结论**：领域模型（树）持久化，React Flow 的 nodes/edges 是派生视图（仅内存）。

**核心原则**：
- Fraxtal 是**树不是 DAG**（根到任意节点唯一路径）；
- **边不存储**——完全由 `parentId` 派生，渲染时一行生成，消灭双源不一致；
- 决策链追溯 = 向上遍历 `while (n.parentId) n = map[n.parentId]`，O(深度)，结构上不可能成环；
- 「平行宇宙」（兄弟分支）零成本：共享 parentId 的不同记录，互不干扰。

**questions/options 存 JSONB 值对象，不拆表**：
它们是节点的值对象而非独立实体——无跨节点引用、无独立生命周期、总是整组读写、查询模式只有「给我整条链」。拆表换来 N+1 与事务复杂度，收益为零。zod 在读写两端把关结构。

**scope 标签 day-one 引入**：`enum(positioning | users | features | tech)`，LLM 生成问题时顺带打标（tool 参数 enum 约束，零成本），为深层决策链过滤预留杀手锏。

**表结构**：

```sql
users          id TEXT PK · email TEXT UNIQUE · password_hash TEXT
               created_at TIMESTAMPTZ
projects       id TEXT PK · user_id FK · name · root_node_id · created_at
nodes          id TEXT PK · project_id FK · parent_id FK(self, NULL)
               origin_idea TEXT · status TEXT        -- growing|settled|compiled
               questions JSONB · ai_meta JSONB       -- ai_meta: rejectedQuestions, contextDigest
               pos_x INT NULL · pos_y INT NULL       -- positionOverride
               created_at TIMESTAMPTZ
compiled_docs  id TEXT PK · node_id FK · content_md TEXT · created_at TIMESTAMPTZ
```

**ID 策略**：全部前端 nanoid 字符串、TEXT 列。id 出现在 URL/API 路径中，nanoid 短且 URL 友好；前端先生成再落库；**LLM 输出永不涉足 id**。

## 4. LLM Context 管理 — 三级火箭

**前置认知**：Fraxtal 的决策链是结构化决策对（问题+选项+选择 ≈ 30~60 token/个），天然比聊天记录紧凑。10 层深 × 3 问 ≈ 2000 token，多数场景并不大。不过度工程。

| 层级 | 触发条件 | 策略 | MVP |
| --- | --- | --- | --- |
| L1 全量结构化 | 决策链 < ~4K token | 直接序列化全部决策对进 prompt | ✅ |
| L2 逐层 Digest | 更深 | 每节点**生成决策时**让 LLM 顺手产出 `contextDigest`（≤200 token）；组装时祖先用 digest、最近 2 层用全量 | ✅ |
| L3 Scope 过滤 | 极深 + 饱和 | 按 scope 丢弃与当前问题无关的低优决策 | ❌ 后置 |

**关键设计**：digest 是「写入时生成」而非「读取时生成」——生成决策节点的调用反正发生，顺手摘要边际成本 ≈ 0；读取时摘要则每次展开节点都额外调用，又慢又贵。

**组装顺序（防 lost-in-the-middle）**：
```
[system]  当前已锁定决策清单（强约束，重复关键决策）
[user]    ① 最近一层父节点完整 Q&A（最新上下文放最前）
          ② 更早祖先的 digest 们（中间）
          ③ 本节点要解决的新任务（结尾）
```

## 5. 结构化输出 — tool calling + zod 双保险

**结论**：Function Calling 产出 JSON，前端（服务端）zod 严格校验，失败自动重试。

```
LLM ──tool call──> 原始 JSON ──> zod.parse
                                   │ 失败 → 错误信息回传 LLM 重试（≤2 次）
```

- 定义两个 tool schema：`submit_questions`（阶段二）、`submit_options`（阶段三）；
- **id 全部前端生成**——LLM 产出的 id 不可信（重复/幻觉），schema 只让它产出文本与 `recommended` 标志；
- **温度分层**：生成问题 0.8（发散）· 生成选项 0.4（收敛）· 编译方案 0.2（稳定）；
- 「换一批」防重复：`ai_meta.rejectedQuestions` 传回 prompt，明示不再提。

## 6. 运行形态 — Next.js 全栈

**结论**：Web 全栈，LLM 逻辑整体下沉服务端，前端纯渲染。

```
前端节点交互 → POST /api/... → 服务端：
  ① 从 DB 向上遍历取决策链（O(深度)）
  ② L1/L2 组装 context（前端零负担）
  ③ 调 LLM（tool calling，温度按阶段设定）
  ④ zod 校验 → 失败自动重试 ≤2 次
  ⑤ 落库，顺手生成 contextDigest
  ⑥ 返回结构化 JSON → 前端渲染
```

**收益**：LLM Key 在部署者环境变量，用户不可见；协作/计费演进不动前端。

## 7. 认证 — 完整注册登录 + JWT 双 token

**结论**：email + 密码注册登录，JWT 维持状态，httpOnly Cookie 传输。

- 密码哈希：**argon2id**（非 bcrypt）；
- JWT 库：**jose**（Edge runtime 兼容；Next.js 16 的 proxy 文件约定默认 Node.js runtime，jose 通用）；
- 双 token：access **15min** + refresh **7d 旋转**（旧 refresh 一次性作废）；
- **重放检测**：检测到已旋转的 refresh 被重放 → 全部会话强制下线；
- 存储：httpOnly + SameSite=Strict Cookie（XSS 免疫，代价是 CSRF 需 SameSite 缓解）。

## 8. 数据库 — Postgres 16 + Drizzle ORM

**结论**：直接采用 Postgres（一步到位，协作是多写者模型的必然归宿）。

- 驱动：**postgres.js**（异步，自带连接池）；
- pool 实例挂 `globalThis` 缓存（Next.js dev HMR 连接泄漏坑）；
- 时间戳 `TIMESTAMPTZ`、嵌套数据 `JSONB` + `$type<>()`；
- 迁移：drizzle-kit generate/migrate；
- 部署：Docker Compose（app + postgres:16 + volume + healthcheck）；
- Repository 层隔离：service 层只见 repo 函数签名，不见查询构建器（换库/换 ORM 时只动 repo，且 mock 测试便利）。

## 9. LLM 接入 — OpenAI-compatible 单协议

**结论**：只实现 OpenAI 兼容协议一种，手写 client（约 200 行），不引入 AI SDK。

GLM / DeepSeek / OpenAI / Ollama 本地模型全在此协议下，零适配层。调用模式非常固定（tool call + 校验 + 重试），手写可控性最强。

```
环境变量三件套:
  LLM_BASE_URL · LLM_API_KEY · LLM_MODEL
可选 per-task 覆盖:
  LLM_MODEL_ASK(阶段二·发散) · LLM_MODEL_COMPILE(阶段五·长输出)
```

**流式策略**：编译阶段走 SSE（前端看文档逐段生成）；提问/选项阶段不流式（本来就是结构化 JSON）。

## 10. 编译（阶段五）— 两层校验 + 快照版本化

**两层校验**：
```
第一层【规则校验】纯代码，0 token，毫秒级：
  - 决策链深度 ≥ 2 · scope ∈ {positioning, users} 全部有决策 · 无悬空问题
第二层【语义审计】LLM 一次调用（小模型可胜任）：
  输入: 结构化决策链 → 输出: { verdict: "pass" | "conflict", conflicts: [...] }
```
**冲突只报告不自动修复**——冲突项高亮到对应节点，决策权归用户（产品哲学）。

**产物骨架**（固定六节）：产品定位 / 目标用户 / 功能范围 / 技术约束 / 关键决策记录（决策链原文附录，可追溯）/ 待定项（诚实呈现不确定性）。

**版本化**：`compiled_docs` **append-only，永不覆盖**——每次编译一个快照，节点显示「已编译 vN」。把「平行宇宙」延伸到产物层。

## 11. MVP 边界

**验收标准 = 一个用户能从「一个想法」走到「一份结构化文档」的完整闭环。闭环之外一律后置。**

| 模块 | MVP | 后置 |
| --- | --- | --- |
| 认证（注册/登录/JWT） | ✅ | — |
| 核心循环（阶段一~四：建树/提问/决策/分叉） | ✅ | — |
| 换一批 + 防重复 | ✅ | — |
| 编译（Markdown + 两层校验 + SSE） | ✅ 简版 | PDF 导出、版本对比视图 |
| 画布小地图、撤销/重做、导出 JSON | ❌ | v2 |
| 协作（多用户同树） | ❌ | v2+（路线：只读分享 → 实时协作） |
| L3 scope 过滤 | ❌ | 按需（真实超深链出现时） |

## 12. 文件结构与工程约定

```
src/
├── proxy.ts                      # JWT access 校验（Next.js 16：原 middleware.ts 约定已更名，默认 Node.js runtime）
├── app/                         # 路由层：page/route/layout
│   ├── (auth)/{login,register}/ # 认证页（独立布局）
│   ├── (main)/projects/[projectId]/page.tsx   # 画布工作区
│   └── api/                     # Route Handlers（薄壳）
│       ├── auth/{register,login,refresh,logout}/route.ts
│       └── projects/[projectId]/
│           ├── nodes/route.ts                    # GET 全树
│           └── nodes/[nodeId]/
│               ├── {questions,options,decide}/route.ts   # 阶段二三四动作
│           └── compile/route.ts                  # 阶段五·SSE
├── components/
│   ├── canvas/                  # ★ 画布域（tree-canvas · nodes · relayout）
│   ├── question-panel/          # 问答窗口（question-item · option-card）
│   ├── doc-viewer/              # 编译产物渲染
│   └── ui/                      # shadcn/ui
├── lib/                         # ⚖️ 双端共享·纯逻辑·零 IO
│   ├── schemas/                 # zod = 类型唯一真相（node · llm-output · api）
│   ├── tree/                    # ★ traversal(决策链遍历) · derive-flow(图派生)
│   ├── store/                   # canvas-store（单 store 多 slice）
│   └── api-client.ts
├── server/                      # 🔒 仅服务端（import 边界红线）
│   ├── services/                # 跨 repo+llm 编排（node-service）
│   ├── repositories/            # {project,node,doc}-repo
│   ├── llm/                     # client · tools · prompts · pipeline
│   ├── context/assemble.ts      # L1/L2 组装
│   ├── compile/{validate,audit}.ts
│   └── auth/{jwt,password,session}.ts
└── db/                          # index(globalThis pool) · schema · migrations/
```

**五条结构原则**：
1. **双端边界**：`lib/`（双端纯逻辑）→ `server/`（仅服务端），单向依赖，ESLint 强制 import 边界；
2. **Route Handler 是薄壳**：认证 → zod 解析 → 调 service → 返回；编排在 `server/services/`（页面路由保护用 Next.js 16 的 `proxy.ts`，原 middleware 约定已更名）；
3. **领域模型与派生视图分离**：树遍历/图派生是纯函数，住 `lib/tree/`，测试密度最高；
4. **API 动作语义**：URL 映射五阶段动作（questions/options/decide/compile），非教科书 CRUD；
5. **域内就近**：canvas 与 question-panel 是两个组件家族（画布紧凑态 vs 面板完整态）。

**已采纳约定**：
- **Route Handlers 而非 Server Actions**——SSE 流式是原生姿势，URL 显式自文档化，未来开放 API/桌面客户端零改动；
- **测试同位**——`__tests__/` 就近（`lib/tree/__tests__/traversal.test.ts`），删域连测试一起删；
- **单 canvas-store 多 slice**（树数据/选中与面板/布局状态），immer 事务化更新——生成节点一次牵动三 slice。

## 附：环境变量清单

```
DATABASE_URL=postgres://...      # Postgres 连接串
JWT_SECRET=...                   # JWT 签名密钥
LLM_BASE_URL=https://...         # OpenAI 兼容端点
LLM_API_KEY=sk-...
LLM_MODEL=...                    # 默认模型
LLM_MODEL_ASK=...                # 可选：阶段二覆盖
LLM_MODEL_COMPILE=...            # 可选：阶段五覆盖
```
