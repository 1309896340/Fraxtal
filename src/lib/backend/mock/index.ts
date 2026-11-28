import { nanoid } from "nanoid";
import type {
    Answered,
    CompiledDoc,
    CompileTaskResult,
    DataBackend,
    DecisionNode,
    MockTask,
    OptionsTaskResult,
    Project,
    Question,
    QuestionOption,
    QuestionsTaskResult,
    Scope,
    TaskRef,
} from "../types";
import { CONTENT_LIBRARY, SCOPE_PRIORITY, findSeedByText, type QuestionSeed } from "./content-library";
import { useMockStore } from "./store";

/**
 * mock adapter（design D-2/D-4 + tech-decisions D13）：
 * - 持久化：zustand persist（刷新/重开浏览器数据保留）
 * - 伪智能生成：缺失 scope 优先 + 排除已否决/当前问题 + 洗牌抽取
 * - 任务语义：发起即落库 pending（含预计完成时间），读取时惰性结算——
 *   无 setTimeout，时钟照常流逝，重进必然呈现完成态
 * - 延迟模拟：普通操作 300~800ms；LLM 类操作映射为任务 500~1500ms 完成窗口
 */

// ── 基础工具 ──

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/** 普通操作的可感知延迟 */
const normalDelay = () => delay(randomInt(300, 800));

/** LLM 类任务的完成窗口 */
const taskWindow = () => randomInt(500, 1500);

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── store 读写辅助 ──

function mustGetNode(nodeId: string): DecisionNode {
  const node = useMockStore.getState().nodes[nodeId];
  if (!node) {
    throw new Error(`mock backend：节点不存在（${nodeId}）`);
  }
  return node;
}

function setNode(nodeId: string, updater: (node: DecisionNode) => DecisionNode): void {
  const { nodes } = useMockStore.getState();
  const node = nodes[nodeId];
  if (!node) return;
  useMockStore.setState({ nodes: { ...nodes, [nodeId]: updater(node) } });
}

function putTask(task: MockTask): void {
  const { tasks } = useMockStore.getState();
  useMockStore.setState({ tasks: { ...tasks, [task.id]: task } });
}

function putNode(node: DecisionNode): void {
  const { nodes } = useMockStore.getState();
  useMockStore.setState({ nodes: { ...nodes, [node.id]: node } });
}

// ── 伪智能生成 ──

/** 决策链：从当前节点向上遍历至根（树结构上不可能成环，D3） */
function getChain(nodeId: string): DecisionNode[] {
  const { nodes } = useMockStore.getState();
  const chain: DecisionNode[] = [];
  let current: DecisionNode | undefined = nodes[nodeId];
  while (current) {
    chain.push(current);
    current = current.parentId ? nodes[current.parentId] : undefined;
  }
  return chain;
}

/** 决策链上已作出决策的 scope 集合（答案引用的是各节点上的问题） */
function decidedScopes(chain: DecisionNode[]): Set<Scope> {
  const scopes = new Set<Scope>();
  for (const node of chain) {
    const byId = new Map(node.questions.map((q) => [q.id, q]));
    for (const answer of node.answers) {
      const scope = byId.get(answer.questionId)?.scope;
      if (scope) scopes.add(scope);
    }
  }
  return scopes;
}

/**
 * 抽取问题种子（design D-4）：
 * 决策链缺失的 scope 优先 → 排除已否决与本节点当前问题 → 洗牌取 2~3 问（单 scope 最多 2 问，保证视角多样性）
 */
function pickQuestionSeeds(chain: DecisionNode[], node: DecisionNode): QuestionSeed[] {
  const rejected = new Set(node.aiMeta.rejectedQuestions);
  const currentTexts = new Set(node.questions.map((q) => q.text));
  const decided = decidedScopes(chain);
  const missing = SCOPE_PRIORITY.filter((scope) => !decided.has(scope));
  const orderedScopes = [...missing, ...SCOPE_PRIORITY.filter((scope) => !missing.includes(scope))];

  const target = randomInt(2, 3);
  const picked: QuestionSeed[] = [];
  for (const scope of orderedScopes) {
    if (picked.length >= target) break;
    const pool = shuffle(
      CONTENT_LIBRARY[scope].filter(
        (seed) => !rejected.has(seed.text) && !currentTexts.has(seed.text),
      ),
    );
    let takenFromScope = 0;
    for (const seed of pool) {
      if (picked.length >= target || takenFromScope >= 2) break;
      picked.push(seed);
      takenFromScope += 1;
    }
  }
  return picked;
}

function seedsToQuestions(seeds: QuestionSeed[]): Question[] {
  return seeds.map((seed) => ({
    id: nanoid(),
    text: seed.text,
    scope: seed.scope,
    options: seed.options.map((option, index) => ({
      id: nanoid(),
      text: option.text,
      recommended: index === seed.recommendedIndex,
    })),
  }));
}

function seedToOptions(seed: QuestionSeed): QuestionOption[] {
  return seed.options.map((option, index) => ({
    id: nanoid(),
    text: option.text,
    recommended: index === seed.recommendedIndex,
  }));
}

/** 决策链 + 本次决策的紧凑摘要（模拟 L2 contextDigest 写入时生成） */
function buildContextDigest(chain: DecisionNode[], answers: Answered[]): string {
  const parts: string[] = [];
  for (const node of chain) {
    const byId = new Map(node.questions.map((q) => [q.id, q]));
    for (const answer of node.answers) {
      const question = byId.get(answer.questionId);
      const option = question?.options.find((o) => o.id === answer.optionId);
      if (question && option) parts.push(`${question.text} → ${option.text}`);
    }
  }
  const currentById = new Map(chain[0].questions.map((q) => [q.id, q]));
  for (const answer of answers) {
    const question = currentById.get(answer.questionId);
    const option = question?.options.find((o) => o.id === answer.optionId);
    if (question && option) parts.push(`${question.text} → ${option.text}`);
  }
  return parts.join("；").slice(0, 400);
}

// ── 任务惰性结算（design D-2：无定时器，读取时按钟结算）──

/** 任务完成时的写回副作用：结果落库到节点/产物（模拟服务端完成写入） */
function settleTask(task: MockTask): MockTask {
  const completed: MockTask = { ...task, status: "completed" };
  if (task.type === "questions") {
    const { questions } = task.result as QuestionsTaskResult;
    setNode(task.nodeId, (node) => ({ ...node, questions }));
  } else if (task.type === "options") {
    const { items } = task.result as OptionsTaskResult;
    setNode(task.nodeId, (node) => ({
      ...node,
      questions: node.questions.map((question) => {
        const generated = items.find((item) => item.questionId === question.id);
        return generated ? { ...question, options: generated.options } : question;
      }),
    }));
  } else {
    const { docId, contentMd } = task.result as CompileTaskResult;
    const { docs } = useMockStore.getState();
    const doc: CompiledDoc = {
      id: docId,
      nodeId: task.nodeId,
      contentMd,
      createdAt: new Date().toISOString(),
    };
    useMockStore.setState({ docs: { ...docs, [docId]: doc } });
    setNode(task.nodeId, (node) => ({ ...node, status: "compiled" }));
  }
  putTask(completed);
  return completed;
}

function createTask(nodeId: string, type: MockTask["type"], result: unknown): TaskRef {
  const task: MockTask = {
    id: nanoid(),
    type,
    nodeId,
    status: "pending",
    result,
    expectedCompleteAt: new Date(Date.now() + taskWindow()).toISOString(),
  };
  putTask(task);
  return { taskId: task.id };
}

// ── Markdown 模板（编译产物，tech-decisions D10 固定六节）──

function buildCompileContentMd(chain: DecisionNode[]): string {
  const ordered = [...chain].reverse(); // 根 → 当前
  const sections: string[] = [];
  const byScope: Record<string, string[]> = {};
  for (const node of ordered) {
    const byId = new Map(node.questions.map((q) => [q.id, q]));
    for (const answer of node.answers) {
      const question = byId.get(answer.questionId);
      const option = question?.options.find((o) => o.id === answer.optionId);
      if (question && option) {
        (byScope[question.scope] ??= []).push(`- ${question.text} → **${option.text}**`);
      }
    }
  }
  const title = ordered[0] ? ordered[0].originIdea : "产品方案";
  sections.push(`# ${title}`, "");
  sections.push("## 产品定位", byScope.positioning?.join("\n") ?? "（待定）", "");
  sections.push("## 目标用户", byScope.users?.join("\n") ?? "（待定）", "");
  sections.push("## 功能范围", byScope.features?.join("\n") ?? "（待定）", "");
  sections.push("## 技术约束", byScope.tech?.join("\n") ?? "（待定）", "");
  sections.push("## 关键决策记录", "");
  for (const node of ordered) {
    if (node.answers.length > 0) sections.push(`- 节点 ${node.id}：${node.answers.length} 项决策`);
  }
  sections.push("");
  sections.push("## 待定项", "- 尚未覆盖的视角与未决问题（诚实呈现不确定性）");
  return sections.join("\n");
}

// ── adapter ──

export const mockBackend: DataBackend = {
  projects: {
    async list() {
      await normalDelay();
      return [...useMockStore.getState().projects].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    },

    async create({ name, originIdea }) {
      await normalDelay();
      const now = new Date().toISOString();
      const rootNode: DecisionNode = {
        id: nanoid(),
        projectId: "",
        parentId: null,
        originIdea,
        status: "growing",
        questions: [],
        answers: [],
        aiMeta: { rejectedQuestions: [] },
        posX: null,
        posY: null,
        createdAt: now,
      };
      const project: Project = {
        id: nanoid(),
        name,
        rootNodeId: rootNode.id,
        createdAt: now,
      };
      rootNode.projectId = project.id;
      const { projects, nodes } = useMockStore.getState();
      useMockStore.setState({
        projects: [...projects, project],
        nodes: { ...nodes, [rootNode.id]: rootNode },
      });
      return project;
    },
  },

  nodes: {
    async getByProject(projectId) {
      await normalDelay();
      return Object.values(useMockStore.getState().nodes).filter(
        (node) => node.projectId === projectId,
      );
    },

    async generateQuestions({ nodeId }) {
      const node = mustGetNode(nodeId);
      const chain = getChain(nodeId);
      const questions = seedsToQuestions(pickQuestionSeeds(chain, node));
      return createTask(nodeId, "questions", { questions } satisfies QuestionsTaskResult);
    },

    async rejectQuestions({ nodeId, ids }) {
      const node = mustGetNode(nodeId);
      // 契约传问题 id；容错：无法匹配到本节点问题时按文本/种子键原样记录
      const texts = ids.map((id) => node.questions.find((q) => q.id === id)?.text ?? id);
      const rejected = new Set([...node.aiMeta.rejectedQuestions, ...texts]);
      const rejectedIds = new Set(ids);
      setNode(nodeId, (current) => ({
        ...current,
        questions: current.questions.filter((q) => !rejectedIds.has(q.id)),
        aiMeta: { ...current.aiMeta, rejectedQuestions: [...rejected] },
      }));
      await normalDelay();
    },

    async generateOptions({ nodeId, questionIds }) {
      const node = mustGetNode(nodeId);
      const items = questionIds.map((questionId) => {
        const question = node.questions.find((q) => q.id === questionId);
        if (!question) {
          throw new Error(`mock backend：问题不存在（${questionId}）`);
        }
        const seed = findSeedByText(question.text);
        if (!seed) {
          throw new Error(`mock backend：内容库缺少问题种子（${question.text}）`);
        }
        return { questionId, options: seedToOptions(seed) };
      });
      return createTask(nodeId, "options", { items } satisfies OptionsTaskResult);
    },

    async decide({ nodeId, answers }) {
      await normalDelay();
      const node = mustGetNode(nodeId);
      // 校验答案引用本节点的问题与选项
      for (const answer of answers) {
        const question = node.questions.find((q) => q.id === answer.questionId);
        if (!question) {
          throw new Error(`mock backend：答案引用了不存在的问题（${answer.questionId}）`);
        }
        if (!question.options.some((option) => option.id === answer.optionId)) {
          throw new Error(`mock backend：答案引用了不存在的选项（${answer.optionId}）`);
        }
      }
      const chain = getChain(nodeId);
      // 父节点：记录决策 → settled
      setNode(nodeId, (current) => ({
        ...current,
        answers: [...current.answers, ...answers],
        status: "settled",
      }));
      // 子节点：承载分支摘要，继承决策链（平行宇宙 = 共享 parentId 的不同记录）
      const chosen = answers.map((answer) => {
        const question = node.questions.find((q) => q.id === answer.questionId);
        const option = question?.options.find((o) => o.id === answer.optionId);
        return option ? option.text : "";
      });
      const child: DecisionNode = {
        id: nanoid(),
        projectId: node.projectId,
        parentId: node.id,
        originIdea: chosen.filter(Boolean).join("；") || node.originIdea,
        status: "growing",
        questions: [],
        answers: [],
        aiMeta: {
          rejectedQuestions: [],
          contextDigest: buildContextDigest(chain, answers),
        },
        posX: null,
        posY: null,
        createdAt: new Date().toISOString(),
      };
      putNode(child);
      return child;
    },
  },

  compile: {
    async request({ nodeId }) {
      const chain = getChain(nodeId);
      const contentMd = buildCompileContentMd(chain);
      return createTask(nodeId, "compile", {
        docId: nanoid(),
        contentMd,
      } satisfies CompileTaskResult);
    },

    async get(docId) {
      await normalDelay();
      return useMockStore.getState().docs[docId] ?? null;
    },
  },

  tasks: {
    async get<R = unknown>(taskId: string): Promise<MockTask<R> | null> {
      const task = useMockStore.getState().tasks[taskId];
      if (!task) return null;
      if (task.status === "pending" && Date.now() >= Date.parse(task.expectedCompleteAt)) {
        const completed = settleTask(task);
        return completed as MockTask<R>;
      }
      // pending 期间对调用方隐藏结果（completed 才呈现）
      return (task.status === "completed" ? task : { ...task, result: null }) as MockTask<R>;
    },
  },
};
