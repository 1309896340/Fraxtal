# Proposal

## Why

产品已进入「前端先行、后端 mock」的两阶段交付（tech-decisions D13）：全部交互逻辑先用 mock 走通，再填入真实后端。本变更是前端阶段的地基——搭起 mock/real 可切换的数据后端契约框架，并把登录后的主页从占位升级为可用的项目列表，让后续画布大变更（canvas-core-frontend）有一个稳定的数据层与入口页面。

## What Changes

- 新增 `lib/backend/types.ts`：数据后端契约接口（项目/节点/决策数据结构与全部操作签名）——两阶段的「合同」
- 新增 `backend/mock/`：mock adapter——zustand persist 进 localStorage（刷新数据不丢）、按 scope 分组的伪智能内容库（问题/选项/推荐项）、300~1500ms 随机延迟模拟、AI 生成任务 **pending → completed** 语义（模拟「流式响应与客户端解耦」：发起落库、重进呈现完成态）
- 新增 `backend/http/`：real adapter 空壳（阶段二填充，当前调用抛 NOT_IMPLEMENTED）
- 切换机制：`NEXT_PUBLIC_DATA_BACKEND` 环境变量（默认 mock）
- 主页升级为**项目列表页**：项目卡片网格（名称/创建时间/进入按钮）+ 【新建项目】模态（项目名 + 初始想法 + 产品描述模板选用）→ 创建后跳转画布占位路由
- 新增画布占位路由 `/projects/[id]`（本变更仅建路由壳与空画布页，交互交互在 canvas-core-frontend 交付）
- 不包含：画布渲染、问答面板、编译（后续变更）

## Capabilities

### New Capabilities

- `data-backend`: 前端数据后端抽象——契约接口、mock 持久化语义、伪智能生成、生成任务 pending→completed 生命周期与 mock/real 切换机制
- `project-management`: 项目的创建与列表管理（新建模态、列表展示、进入工作区入口）

### Modified Capabilities

（无——首两个前端能力，均为新增）

## Impact

- **新增代码**：`src/lib/backend/`（types、index 切换器、mock/、http/）、`src/components/projects/`（列表卡片、新建模态）、`src/app/(main)/` 路由改造
- **修改**：`(main)/page.tsx` 从占位升级为项目列表；`(main)/projects/[id]/page.tsx` 新增占位壳
- **依赖**：无新增（zustand 已在栈内；persist 为 zustand 内置 middleware）
- **风险面**：纯前端，无数据库/LLM 改动；mock 数据结构与 D3 领域模型一致，阶段二迁移零返工
