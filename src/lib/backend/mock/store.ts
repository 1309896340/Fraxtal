"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { CompiledDoc, DecisionNode, MockTask, Project } from "../types";
/**
 * mock 状态存储（design D-3）：
 * - 单 store 多分片（projects / nodes / tasks / docs），zustand persist 进 localStorage
 * - localStorage key 前缀 `fraxtal-mock-*`；version: 1（迁移预留）
 * - 写入 try/catch：超限（约 5MB）仅告警，本次变更保留在内存，不阻断交互
 * - SSR 安全：storage 方法惰性访问 localStorage，服务端渲染时天然为空态
 */

export interface MockBackendState {
  projects: Project[];
  /** 全部决策节点，按 id 索引（树由 parentId 派生，不存边） */
  nodes: Record<string, DecisionNode>;
  /** 生成任务（pending → completed 惰性结算） */
  tasks: Record<string, MockTask>;
  /** 编译产物快照 */
  docs: Record<string, CompiledDoc>;
}

export const MOCK_STORAGE_KEY = "fraxtal-mock-backend-store";

/** 惰性包装 localStorage：服务端（无 localStorage）读为 null、写忽略并告警 */
const safeStorage: StateStorage = {
  getItem: (name) => {
    if (typeof localStorage === "undefined") return null;
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.warn(
        "[fraxtal-mock] localStorage 写入失败（可能已达容量上限），本次数据仅保留在内存中",
        error,
      );
    }
  },
  removeItem: (name) => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(name);
    } catch {
      // 清理失败无需处理
    }
  },
};

export const useMockStore = create<MockBackendState>()(
  persist(
    (): MockBackendState => ({
      projects: [],
      nodes: {},
      tasks: {},
      docs: {},
    }),
    {
      name: MOCK_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
    },
  ),
);

/**
 * 水合门闩（design D-3）：
 * persist 的数据仅存在于客户端 localStorage，服务端渲染为初始空态。
 * 所有消费 mock 数据的组件 MUST 在 `hydrated === true` 后才读取数据，
 * 避免「服务端空数据 vs 客户端有数据」的 hydration 不匹配。
 *
 * 实现：useSyncExternalStore 的 server/client 双快照——
 * SSR 与水合首帧返回 false，客户端挂载后返回 true（等价 mounted 门闩，无级联渲染）。
 */
const noopSubscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

