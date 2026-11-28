# Design

## Context

两阶段交付策略已在 tech-decisions D13 定案（前端 Adapter + localStorage + 伪智能内容库 + pending→completed 任务语义）。scaffold-project 已归档：认证、`src/db`、`src/server` 就绪——本变更为纯前端新增，**不触碰**服务端与数据库。动机见 proposal.md - Why。

## Goals / Non-Goals

**Goals:**

- 落定 `lib/backend` 契约接口（阶段二的「合同」），字段与 D3 领域模型/表结构对齐
- mock adapter 完整可用：持久化、伪智能生成、任务解耦语义
- 主页升级为可用的项目列表（mock 数据源）

**Non-Goals:**

- 画布渲染、问答面板、编译交互（canvas-core-frontend 变更）
- real adapter 的任何真实实现（阶段二）
- 侧边栏对话内容的字段级入库细化（契约接口预留结构，实现时再定）

## Decisions

### D-1 契约接口形态（`lib/backend/types.ts`）

领域类型直接复用 D3：`Project`、`DecisionNode`（含 questions/aiMeta/status）、`CompiledDoc`。操作接口按域分组、全异步（签名与未来 HTTP 形态一致，mock 内部用延迟对齐）：

```ts
export interface DataBackend {
  projects: {
    list(): Promise<Project[]>;
    create(input: { name: string; originIdea: string }): Promise<Project>; // 含根节点落库
  };
  nodes: {
    getByProject(projectId: string): Promise<DecisionNode[]>;
    generateQuestions(input: { nodeId: string }): Promise<TaskRef>;      // 任务化
    rejectQuestions(input: { nodeId: string; ids: string[] }): Promise<void>;
    generateOptions(input: { nodeId: string; questionIds: string[] }): Promise<TaskRef>;
    decide(input: { nodeId: string; answers: Answered[] }): Promise<DecisionNode>; // 生成子节点
  };
  compile: { request(input: { nodeId: string }): Promise<TaskRef>; get(docId: string): Promise<CompiledDoc | null> };
  tasks: { get(taskId: string): Promise<MockTask | null> };  // pending→completed 惰性结算
}
```

`TaskRef = { taskId }`；`MockTask = { id, status: "pending" | "completed", result, expectedCompleteAt }`。

### D-2 pending→completed 的实现：惰性结算而非定时器

发起生成时同步算出**结果**并落库 `{status: "pending", expectedCompleteAt, result}`。读取任务时结算：`now >= expectedCompleteAt → 返回 completed`（并可将状态改写为 completed）。**不使用 setTimeout**——刷新/关页后时间照常流逝，重进必然呈现完成态，天然满足 spec 的解耦语义，且零定时器泄漏风险。

### D-3 mock 状态存储：zustand persist

- 单 store `mock-backend-store`（分片：projects / nodes / tasks），`persist` middleware + `version: 1`（迁移预留）
- localStorage key 前缀 `fraxtal-mock-*`
- **SSR 水合防护**：所有消费 mock 数据的组件必须是 client component，且用 `mounted` 门闩避免服务端空数据与客户端有数据的 hydration 不匹配

### D-4 伪智能内容库（`backend/mock/content-library.ts`）

静态数据结构：`scope → QuestionSeed[]`（每 seed 含 3~4 选项 + 推荐下标）。抽取算法：决策链**缺失的 scope 优先** → 该 scope 下排除 `rejectedQuestions` → 洗牌取 2~3 问。首次内容库规模：4 scope × 6 问 ≈ 24 问，覆盖完整流程演示。

### D-5 real 空壳与切换器

- `backend/http/index.ts`：实现同接口，每个方法抛 `Error("real backend 未实现（阶段二）")`
- `lib/backend/index.ts`：按 `process.env.NEXT_PUBLIC_DATA_BACKEND`（默认 mock）导出单例 `backend`，业务代码 `import { backend } from "@/lib/backend"`

### D-6 路由落位调整

D13 页面树中的 `/(main)/projects` 落地为**主页 `/`**（登录后直达项目列表，无中间跳转）；画布工作区为 `/projects/[id]`。本变更交付主页 + 画布占位壳。

## Risks / Trade-offs

- **[localStorage 容量上限（约 5MB）]** → 决策树纯文本数据极小，远达不到；写入 try/catch，超限提示
- **[mock 结构与阶段二 DB 漂移]** → 契约接口以 D3 领域模型为纲逐字段对齐；阶段二迁移成本 = 只写 http adapter
- **[persist 与 SSR 水合不匹配]** → 全部 mock 消费组件 client 化 + mounted 门闩（统一封装 hook `useHydrated()`）
- **[惰性结算的时钟依赖]** → 依赖客户端时钟；mock 阶段可接受，真实后端由服务端时钟结算（本就不同实现）

## Migration Plan

纯前端新增，无存量迁移。回滚 = revert 提交。

## Open Questions

- 侧边栏对话内容的字段级入库范围——按用户要求延后至 canvas-core-frontend 设计时细化；本变更契约接口预留 `ConversationMessage` 结构占位。
