# Tasks

## 1. 契约接口与切换器

- [ ] 1.1 定义 `lib/backend/types.ts`（Project/DecisionNode/CompiledDoc/MockTask/Answered 领域类型与 DataBackend 契约接口，字段对齐 tech-decisions D3），验证 `pnpm build` 类型检查通过
- [ ] 1.2 实现 `lib/backend/index.ts` 切换器（按 `NEXT_PUBLIC_DATA_BACKEND` 导出 mock/real 单例，默认 mock）与 `backend/http/` 空壳（所有方法抛「未实现」明确错误），验证切换 real 时调用返回明确错误信息

## 2. Mock adapter

- [ ] 2.1 实现 `backend/mock/store.ts`（zustand persist 单 store，分片 projects/nodes/tasks，version: 1，写入 try/catch 超限提示）与 `useHydrated()` 水合门闩 hook，验证：创建数据 → 刷新页面 → 数据完整保留；清空 localStorage → 回到初始态不报错
- [ ] 2.2 编写 `backend/mock/content-library.ts`（4 scope × 6 问，每问 3~4 选项含推荐项），验证内容库结构与契约类型对齐（TS 编译通过）
- [ ] 2.3 实现伪智能生成（缺失 scope 优先 + rejectedQuestions 排除 + 洗牌抽取 + 随机延迟）与 pending→completed 惰性结算任务，验证单测：换一批不重复、选项恰好一个推荐、发起任务后立即读取为 pending、超过 expectedCompleteAt 读取为 completed 且结果完整

## 3. 项目列表页（主页改造）

- [ ] 3.1 改造 `(main)/page.tsx` 为项目列表（client 组件 + mounted 门闩）：卡片网格（名称/摘要/创建时间）、点击进入 `/projects/[id]`，验证：mock 创建的项目刷新后仍在、点击卡片路由正确
- [ ] 3.2 实现空状态引导（产品说明 + 创建引导）与【新建项目】模态（名称 + 初始想法 + 产品描述模板预填 + 字段级校验），验证：空状态展示、模板选用预填、缺字段提交出现校验错误、成功创建后跳转 `/projects/[id]` 且落库含根节点
- [ ] 3.3 新增画布占位壳 `/projects/[id]`（顶栏返回 + 项目名 + 空画布提示区），验证：新建项目跳转后占位壳正常渲染、返回列表链接可用

## 4. 集成验收

- [ ] 4.1 `pnpm lint` + `pnpm test` + `pnpm build` 全绿，验证无类型/lint 回归
- [ ] 4.2 对照两份 spec 全部场景逐条验收（浏览器手动：创建→刷新→再进；换一批；real 模式错误提示），验证结果记录至 `verification.md`
