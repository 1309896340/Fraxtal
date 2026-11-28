import type { DataBackend } from "../types";

/**
 * real adapter 空壳（design D-5，阶段二填充）。
 * 与 mock 实现同一契约：real 实现完成前，任何操作被调用 MUST 抛出
 * 明确的「未实现」错误——不产生静默失败（spec: data-backend / real 实现空壳占位）。
 */

function notImplemented(operation: string): never {
  throw new Error(
    `real 数据后端未实现（阶段二）：${operation} 不可用——当前请使用 NEXT_PUBLIC_DATA_BACKEND=mock`,
  );
}

export const httpBackend: DataBackend = {
  projects: {
    list: async () => notImplemented("projects.list"),
    create: async () => notImplemented("projects.create"),
  },
  nodes: {
    getByProject: async () => notImplemented("nodes.getByProject"),
    generateQuestions: async () => notImplemented("nodes.generateQuestions"),
    rejectQuestions: async () => notImplemented("nodes.rejectQuestions"),
    generateOptions: async () => notImplemented("nodes.generateOptions"),
    decide: async () => notImplemented("nodes.decide"),
  },
  compile: {
    request: async () => notImplemented("compile.request"),
    get: async () => notImplemented("compile.get"),
  },
  tasks: {
    get: async () => notImplemented("tasks.get"),
  },
};
