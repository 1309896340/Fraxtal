"use client";

import { httpBackend } from "./http";
import { mockBackend } from "./mock";
import { useHydrated } from "./mock/store";
import type { DataBackend } from "./types";

/**
 * 数据后端切换器（design D-5）：
 * 按 `NEXT_PUBLIC_DATA_BACKEND`（mock | real，默认 mock）导出单例 `backend`，
 * 业务代码统一 `import { backend } from "@/lib/backend"`——
 * 切换实现 MUST NOT 要求修改任何业务组件（spec: data-backend）。
 */

export const DATA_BACKEND_MODE: "mock" | "real" =
  process.env.NEXT_PUBLIC_DATA_BACKEND === "real" ? "real" : "mock";

export const backend: DataBackend = DATA_BACKEND_MODE === "real" ? httpBackend : mockBackend;

export { useHydrated };

// 契约类型统一出口：业务代码从这里 import 类型，不感知具体实现
export type {
  AIMeta,
  Answered,
  CompileTaskResult,
  CompiledDoc,
  ConversationMessage,
  DataBackend,
  DecisionNode,
  MockTask,
  MockTaskType,
  NodeStatus,
  OptionsTaskResult,
  Project,
  Question,
  QuestionOption,
  QuestionsTaskResult,
  Scope,
  TaskRef,
} from "./types";
