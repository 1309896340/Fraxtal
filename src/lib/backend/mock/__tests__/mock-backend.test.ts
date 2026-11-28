import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompileTaskResult, QuestionsTaskResult } from "../../types";
import { CONTENT_LIBRARY, SCOPE_PRIORITY } from "../content-library";

/**
 * mock adapter 单测（tasks.md 2.3 验证口径）：
 * - 换一批不重复（排除已否决问题）
 * - 选项恰好一个推荐
 * - 发起任务后立即读取为 pending
 * - 超过 expectedCompleteAt 读取为 completed 且结果完整
 */

// ── localStorage 内存桩：persist 写入路径的可观测替身 ──
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

vi.stubGlobal("localStorage", new MemoryStorage());

// 动态导入：确保在桩就位后加载（persist 在 store create 时即尝试水合）
const { useMockStore } = await import("../store");
const { mockBackend } = await import("..");
const { httpBackend } = await import("../../http");

/** 推进假时钟，让 normalDelay（≤800ms）与任务窗口（≤1500ms）全部走完 */
async function advance(ms = 2000): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

/** 对带 normalDelay 的操作：先推进时钟放行延迟，再取结果 */
async function settle<T>(promise: Promise<T>): Promise<T> {
  await advance();
  return promise;
}

function createProject(name = "决策画布", originIdea = "一款帮助独立开发者整理产品决策的工具") {
  return settle(mockBackend.projects.create({ name, originIdea }));
}

async function generateSettledQuestions(nodeId: string): Promise<QuestionsTaskResult> {
  const ref = await mockBackend.nodes.generateQuestions({ nodeId });
  await advance();
  const task = await mockBackend.tasks.get<QuestionsTaskResult>(ref.taskId);
  expect(task?.status).toBe("completed");
  return task!.result as QuestionsTaskResult;
}

beforeEach(() => {
  useMockStore.setState({ projects: [], nodes: {}, tasks: {}, docs: {} });
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("内容库结构", () => {
  it("4 个 scope，每个 scope 至少 6 问，每问 3~4 个选项且推荐下标合法", () => {
    expect(Object.keys(CONTENT_LIBRARY)).toHaveLength(4);
    for (const scope of SCOPE_PRIORITY) {
      const seeds = CONTENT_LIBRARY[scope];
      expect(seeds.length).toBeGreaterThanOrEqual(6);
      for (const seed of seeds) {
        expect(seed.options.length).toBeGreaterThanOrEqual(3);
        expect(seed.options.length).toBeLessThanOrEqual(4);
        expect(seed.recommendedIndex).toBeGreaterThanOrEqual(0);
        expect(seed.recommendedIndex).toBeLessThan(seed.options.length);
      }
    }
  });
});

describe("项目与节点", () => {
  it("创建项目落库根节点（承载初始想法），列表按创建时间倒序", async () => {
    const first = await createProject("旧项目");
    await vi.advanceTimersByTimeAsync(10_000);
    const second = await createProject("新项目");

    const list = await settle(mockBackend.projects.list());
    expect(list.map((p) => p.id)).toEqual([second.id, first.id]);

    const nodes = await settle(mockBackend.nodes.getByProject(second.id));
    expect(nodes).toHaveLength(1);
    const root = nodes.find((n) => n.id === second.rootNodeId);
    expect(root).toBeDefined();
    expect(root?.parentId).toBeNull();
    expect(root?.status).toBe("growing");
    expect(root?.originIdea).toBe("一款帮助独立开发者整理产品决策的工具");
  });

  it("mock 数据经 persist 写入 localStorage（刷新后数据保留的基础）", async () => {
    const project = await createProject();
    const raw = localStorage.getItem("fraxtal-mock-backend-store");
    expect(raw).toBeTruthy();
    expect(raw).toContain(project.id);
    expect(raw).toContain('"version":1'); // zustand persist 信封
  });
});

describe("伪智能生成", () => {
  it("初始生成：全部 scope 缺失时优先来自最高优先级的两个 scope，且每问恰好一个推荐", async () => {
    const project = await createProject();
    const { questions } = await generateSettledQuestions(project.rootNodeId);

    expect(questions.length).toBeGreaterThanOrEqual(2);
    expect(questions.length).toBeLessThanOrEqual(3);
    const scopes = new Set(questions.map((q) => q.scope));
    for (const scope of scopes) {
      expect(["positioning", "users"]).toContain(scope);
    }
    for (const question of questions) {
      expect(question.options.length).toBeGreaterThanOrEqual(3);
      expect(question.options.filter((o) => o.recommended)).toHaveLength(1);
    }
  });

  it("换一批：新问题不包含本节点已否决的问题", async () => {
    const project = await createProject();
    const first = (await generateSettledQuestions(project.rootNodeId)).questions;

    await settle(
      mockBackend.nodes.rejectQuestions({ nodeId: project.rootNodeId, ids: first.map((q) => q.id) }),
    );

    // 否决后本节点问题组被清空，新一批不与已否决重复
    const second = (await generateSettledQuestions(project.rootNodeId)).questions;
    expect(second.length).toBeGreaterThan(0);
    const rejectedTexts = new Set(first.map((q) => q.text));
    for (const question of second) {
      expect(rejectedTexts.has(question.text)).toBe(false);
    }
  });

  it("决策后生成：已决策的 scope 让位给缺失 scope，子节点继承决策链", async () => {
    const project = await createProject();
    const first = (await generateSettledQuestions(project.rootNodeId)).questions;
    const positioning = first.filter((q) => q.scope === "positioning");
    expect(positioning.length).toBeGreaterThan(0);

    const child = await settle(
      mockBackend.nodes.decide({
        nodeId: project.rootNodeId,
        answers: positioning.map((q) => ({
          questionId: q.id,
          optionId: q.options.find((o) => o.recommended)!.id,
        })),
      }),
    );
    expect(child.parentId).toBe(project.rootNodeId);
    expect(child.aiMeta.contextDigest).toBeTruthy();

    // 父节点记录决策并进入 settled
    const nodes = await settle(mockBackend.nodes.getByProject(project.id));
    const root = nodes.find((n) => n.id === project.rootNodeId);
    expect(root?.status).toBe("settled");
    expect(root?.answers).toHaveLength(positioning.length);

    // 子节点再生成：positioning 已决策，新问题来自仍缺失的 scope
    const next = (await generateSettledQuestions(child.id)).questions;
    expect(next.length).toBeGreaterThan(0);
    for (const question of next) {
      expect(question.scope).not.toBe("positioning");
    }
  });
});

describe("选项生成", () => {
  it("任务完成后按问题写回整组候选（恰好一个推荐）", async () => {
    const project = await createProject();
    const first = (await generateSettledQuestions(project.rootNodeId)).questions;

    const ref = await mockBackend.nodes.generateOptions({
      nodeId: project.rootNodeId,
      questionIds: first.map((q) => q.id),
    });
    await advance();
    const task = await mockBackend.tasks.get(ref.taskId);
    expect(task?.status).toBe("completed");

    const nodes = await settle(mockBackend.nodes.getByProject(project.id));
    const root = nodes.find((n) => n.id === project.rootNodeId);
    for (const question of root!.questions) {
      expect(question.options.length).toBeGreaterThanOrEqual(3);
      expect(question.options.filter((o) => o.recommended)).toHaveLength(1);
    }
  });
});

describe("任务语义（pending → completed 惰性结算）", () => {
  it("发起后立即读取为 pending（结果隐藏），超过预计完成时间读取为 completed 且结果完整落库", async () => {
    const project = await createProject();
    const ref = await mockBackend.nodes.generateQuestions({ nodeId: project.rootNodeId });

    // 发起即落库 pending
    const pending = await mockBackend.tasks.get<QuestionsTaskResult>(ref.taskId);
    expect(pending?.status).toBe("pending");
    expect(pending?.result).toBeNull();
    expect(Date.parse(pending!.expectedCompleteAt)).toBeGreaterThan(Date.now());

    // 时钟越过预计完成时间 → 读取即结算
    await advance();
    const completed = await mockBackend.tasks.get<QuestionsTaskResult>(ref.taskId);
    expect(completed?.status).toBe("completed");
    const result = completed!.result as QuestionsTaskResult;
    expect(result.questions.length).toBeGreaterThanOrEqual(2);
    for (const question of result.questions) {
      expect(question.id).toBeTruthy();
      expect(question.options.filter((o) => o.recommended)).toHaveLength(1);
    }

    // 完成态已写回节点（重进面板直接呈现问题组），重复读取幂等
    const nodes = await settle(mockBackend.nodes.getByProject(project.id));
    expect(nodes.find((n) => n.id === project.rootNodeId)?.questions).toEqual(result.questions);
    const again = await mockBackend.tasks.get<QuestionsTaskResult>(ref.taskId);
    expect(again?.status).toBe("completed");
  });

  it("编译任务：完成后落库产物快照并将节点置为 compiled", async () => {
    const project = await createProject();
    const first = (await generateSettledQuestions(project.rootNodeId)).questions;
    await settle(
      mockBackend.nodes.decide({
        nodeId: project.rootNodeId,
        answers: [
          {
            questionId: first[0].id,
            optionId: first[0].options.find((o) => o.recommended)!.id,
          },
        ],
      }),
    );

    const ref = await mockBackend.compile.request({ nodeId: project.rootNodeId });
    await advance();
    const task = await mockBackend.tasks.get<CompileTaskResult>(ref.taskId);
    expect(task?.status).toBe("completed");

    const doc = await settle(mockBackend.compile.get((task!.result as CompileTaskResult).docId));
    expect(doc).not.toBeNull();
    expect(doc?.nodeId).toBe(project.rootNodeId);
    expect(doc?.contentMd).toContain("## 产品定位");
    expect(doc?.contentMd).toContain("## 待定项");

    const nodes = await settle(mockBackend.nodes.getByProject(project.id));
    expect(nodes.find((n) => n.id === project.rootNodeId)?.status).toBe("compiled");
  });
});

describe("real adapter 空壳与切换器", () => {
  it("real 模式调用给出明确的「未实现」错误", async () => {
    await expect(httpBackend.projects.list()).rejects.toThrow(/real 数据后端未实现/);
    await expect(httpBackend.tasks.get("any")).rejects.toThrow(/未实现/);
  });

  it("切换器默认导出 mock", async () => {
    const mod = await import("../../index");
    expect(mod.DATA_BACKEND_MODE).toBe("mock");
    expect(mod.backend).toBeDefined();
  });
});
