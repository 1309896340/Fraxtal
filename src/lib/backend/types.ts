/**
 * 数据后端契约（两阶段的「合同」）。
 *
 * 领域类型对齐 tech-decisions D3（领域树是 source of truth）：
 * - 树不是 DAG：边不存储，完全由 parentId 派生
 * - questions/options 是节点上的 JSONB 值对象，不拆实体
 * - id 全部前端 nanoid，LLM 输出永不涉足 id
 *
 * 业务代码 MUST 仅依赖 `DataBackend` 接口与这里的类型，
 * 不得感知 mock/http 具体实现（spec: data-backend）。
 */

/** 决策视角标签（D3：day-one 引入，为 L3 scope 过滤预留） */
export type Scope = "positioning" | "users" | "features" | "tech";

export const SCOPES: readonly Scope[] = ["positioning", "users", "features", "tech"];

/** 节点生命周期：成长中 → 已决策 → 已编译 */
export type NodeStatus = "growing" | "settled" | "compiled";

/** 候选选项（恰好一个 recommended，见 content-library 与生成语义） */
export interface QuestionOption {
  id: string;
  text: string;
  recommended: boolean;
}

/** 问题（含整组候选选项——值对象，总是整组读写） */
export interface Question {
  id: string;
  text: string;
  scope: Scope;
  options: QuestionOption[];
}

/** 用户的一次决策：问题 → 选中的选项 */
export interface Answered {
  questionId: string;
  optionId: string;
}

/** 节点 AI 元数据（D3 ai_meta JSONB） */
export interface AIMeta {
  /** 被用户否决的问题文本（「换一批」防重复：真实后端原样传回 prompt 明示不再提） */
  rejectedQuestions: string[];
  /** 决策链摘要（写入时生成，L2 逐层 Digest 用） */
  contextDigest?: string;
}

/** 决策节点 */
export interface DecisionNode {
  id: string;
  projectId: string;
  parentId: string | null;
  /** 初始想法（根节点承载项目起点；子节点承载分支摘要） */
  originIdea: string;
  status: NodeStatus;
  /** 当前生效的问题组（含选项；换一批时整组替换） */
  questions: Question[];
  /** 本节点已作出的决策记录 */
  answers: Answered[];
  aiMeta: AIMeta;
  /** 用户手动微调过的画布位置（positionOverride；null = 由布局算法决定） */
  posX: number | null;
  posY: number | null;
  createdAt: string; // ISO
}

/** 项目 */
export interface Project {
  id: string;
  name: string;
  rootNodeId: string;
  createdAt: string; // ISO
}

/** 编译产物（D10：append-only 快照，永不覆盖） */
export interface CompiledDoc {
  id: string;
  nodeId: string;
  contentMd: string;
  createdAt: string; // ISO
}

/** 侧边栏对话消息——结构占位（入库范围延后至 canvas-core-frontend 细化，见 design Open Questions） */
export interface ConversationMessage {
  id: string;
  nodeId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string; // ISO
}

// ── 生成任务（pending → completed，与客户端解耦，见 design D-2）──

export type MockTaskType = "questions" | "options" | "compile";

export interface TaskRef {
  taskId: string;
}

export interface MockTask<R = unknown> {
  id: string;
  type: MockTaskType;
  /** 任务归属节点（结算时写回结果用） */
  nodeId: string;
  status: "pending" | "completed";
  /** completed 后才有值；pending 期间对调用方隐藏 */
  result: R | null;
  /** 预计完成时间（ISO）——惰性结算的时钟依据 */
  expectedCompleteAt: string;
}

/** questions 任务的完成结果 */
export interface QuestionsTaskResult {
  questions: Question[];
}

/** options 任务的完成结果（按问题 id 归组） */
export interface OptionsTaskResult {
  items: Array<{
    questionId: string;
    options: QuestionOption[];
  }>;
}

/** compile 任务的完成结果 */
export interface CompileTaskResult {
  docId: string;
  contentMd: string;
}

// ── 契约接口 ──

/**
 * 数据后端契约：按域分组、全异步，签名与未来 HTTP 形态一致。
 * - mock（阶段一）：localStorage 持久化 + 伪智能生成 + 任务惰性结算
 * - real（阶段二）：HTTP Route Handlers
 */
export interface DataBackend {
  projects: {
    list(): Promise<Project[]>;
    /** 创建项目并落库根节点（originIdea 承载初始想法） */
    create(input: { name: string; originIdea: string }): Promise<Project>;
  };
  nodes: {
    getByProject(projectId: string): Promise<DecisionNode[]>;
    /** 发起提问生成 → 任务化（pending，到期自动完成） */
    generateQuestions(input: { nodeId: string }): Promise<TaskRef>;
    /** 「换一批」语义：否决的问题不再出现在后续生成中 */
    rejectQuestions(input: { nodeId: string; ids: string[] }): Promise<void>;
    /** 对指定问题发起选项生成 → 任务化 */
    generateOptions(input: { nodeId: string; questionIds: string[] }): Promise<TaskRef>;
    /** 记录决策并生成子节点（继承决策链） */
    decide(input: { nodeId: string; answers: Answered[] }): Promise<DecisionNode>;
  };
  compile: {
    request(input: { nodeId: string }): Promise<TaskRef>;
    get(docId: string): Promise<CompiledDoc | null>;
  };
  /** 任务查询：惰性结算入口——到期读取时呈现 completed */
  tasks: {
    get<R = unknown>(taskId: string): Promise<MockTask<R> | null>;
  };
}
