import type { Scope } from "../types";

/**
 * 伪智能内容库（design D-4）：
 * 按 scope 分组的预置问题种子——不做随机假文本，保证「真实感」。
 * 首批规模：4 scope × 6 问，每问 3~4 个候选选项且恰好一个推荐（recommendedIndex）。
 *
 * seedId 是内容库内的稳定标识；生成出的 Question 使用全新 nanoid，
 * 「换一批」防重复以问题文本为键（与真实后端传回 prompt 的形态一致）。
 */

export interface QuestionSeed {
  seedId: string;
  scope: Scope;
  text: string;
  options: Array<{ text: string }>;
  /** 推荐项下标（0 ≤ recommendedIndex < options.length） */
  recommendedIndex: number;
}

/** scope 抽取优先级：决策链缺失的 scope 优先（design D-4） */
export const SCOPE_PRIORITY: readonly Scope[] = ["positioning", "users", "features", "tech"];

export const CONTENT_LIBRARY: Record<Scope, QuestionSeed[]> = {
  positioning: [
    {
      seedId: "positioning-1",
      scope: "positioning",
      text: "这款产品的一句话定位是什么？",
      options: [
        { text: "面向个人的智能效率助手" },
        { text: "团队协作的结构化决策平台" },
        { text: "服务开发者的开源工具链" },
        { text: "垂直行业的咨询级解决方案" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "positioning-2",
      scope: "positioning",
      text: "产品要解决的首要痛点是什么？",
      options: [
        { text: "想法到方案的过程中决策凭感觉、缺乏结构" },
        { text: "需求文档冗长，关键决策难以追溯" },
        { text: "团队讨论发散，会议结论容易丢失" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "positioning-3",
      scope: "positioning",
      text: "与现有替代方案相比，最大的差异化是什么？",
      options: [
        { text: "以决策树而非文档组织产品设计过程" },
        { text: "AI 主动提问补全盲区，而非被动问答" },
        { text: "分支平行宇宙：重大分歧可并存比较" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "positioning-4",
      scope: "positioning",
      text: "产品的目标市场层级是？",
      options: [
        { text: "先服务个人产品经理/独立开发者（PLG 起步）" },
        { text: "直接切入中小团队协作市场" },
        { text: "面向大型企业的定制化方案" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "positioning-5",
      scope: "positioning",
      text: "产品形态的优先级是？",
      options: [
        { text: "Web 优先，桌面级画布体验" },
        { text: "移动端优先，碎片时间记录想法" },
        { text: "Web + 桌面客户端同步推进" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "positioning-6",
      scope: "positioning",
      text: "产品的调性命名风格倾向？",
      options: [
        { text: "抽象造词（如 Fraxtal），强调独特性" },
        { text: "直白功能描述词，降低理解成本" },
        { text: "隐喻类自然词，易传播有画面感" },
      ],
      recommendedIndex: 0,
    },
  ],
  users: [
    {
      seedId: "users-1",
      scope: "users",
      text: "核心目标用户是谁？",
      options: [
        { text: "独立开发者/独立产品人" },
        { text: "产品经理与产品设计师" },
        { text: "创业团队的产品负责人" },
        { text: "企业内的创新项目组" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "users-2",
      scope: "users",
      text: "用户使用频率的预期是？",
      options: [
        { text: "项目制低频：一个产品周期集中使用数周" },
        { text: "周度回归：每周复盘与迭代决策树" },
        { text: "日度高频：作为日常思考工具常驻" },
      ],
      recommendedIndex: 1,
    },
    {
      seedId: "users-3",
      scope: "users",
      text: "首批种子用户从哪里获取？",
      options: [
        { text: "独立开发者社区（ProductHunt/V2EX/即刻）" },
        { text: "产品经理垂直社区与人脉圈" },
        { text: "开源社区与 GitHub 传播" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "users-4",
      scope: "users",
      text: "用户的付费意愿假设是？",
      options: [
        { text: "免费为主，高级 AI 用量为付费点" },
        { text: "低门槛订阅制（个人版月付）" },
        { text: "按项目数/决策数计费" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "users-5",
      scope: "users",
      text: "目标用户的技术水平假设？",
      options: [
        { text: "懂技术：可接受略极客的交互" },
        { text: "半技术：需要顺畅的引导与默认值" },
        { text: "非技术：全程零门槛、模板先行" },
      ],
      recommendedIndex: 1,
    },
    {
      seedId: "users-6",
      scope: "users",
      text: "除创建者外，还需要兼顾哪些角色？",
      options: [
        { text: "暂不考虑，单人事先跑通闭环" },
        { text: "评审者：只读查看决策树与产物" },
        { text: "协作者：可编辑同棵决策树" },
      ],
      recommendedIndex: 0,
    },
  ],
  features: [
    {
      seedId: "features-1",
      scope: "features",
      text: "MVP 必须包含的核心功能是？",
      options: [
        { text: "决策树画布 + AI 提问/选项 + 决策分叉" },
        { text: "问答表单流（不做画布）" },
        { text: "纯文档生成器：想法直出 PRD" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "features-2",
      scope: "features",
      text: "哪些功能明确后置、第一版不做？",
      options: [
        { text: "协作与分享后置，先单机闭环" },
        { text: "撤销/重做与小地图后置" },
        { text: "导出 JSON/PDF 后置" },
        { text: "以上全部后置，只留核心循环" },
      ],
      recommendedIndex: 3,
    },
    {
      seedId: "features-3",
      scope: "features",
      text: "AI 建议与用户自定义的边界是？",
      options: [
        { text: "AI 只建议，一切决策权归用户" },
        { text: "推荐项默认选中，可一键采用" },
        { text: "AI 可自动补全草稿，用户修改" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "features-4",
      scope: "features",
      text: "「换一批」否决的问题要如何对待？",
      options: [
        { text: "记录否决并在后续生成中明确避开" },
        { text: "仅本节点避开，其他节点可用" },
        { text: "全局永久拉黑该问题" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "features-5",
      scope: "features",
      text: "编译产物的形态与颗粒度是？",
      options: [
        { text: "固定六节 Markdown：定位/用户/功能/技术/决策记录/待定项" },
        { text: "自由格式长文档，AI 自行组织" },
        { text: "结构化卡片视图而非文档" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "features-6",
      scope: "features",
      text: "数据导入导出需求如何界定？",
      options: [
        { text: "MVP 仅 JSON 导出备份，不做导入" },
        { text: "JSON 导入导出全支持" },
        { text: "完全不做，依赖云端存储" },
      ],
      recommendedIndex: 0,
    },
  ],
  tech: [
    {
      seedId: "tech-1",
      scope: "tech",
      text: "部署形态的偏好是？",
      options: [
        { text: "Docker 容器自包含，一键 compose 启动" },
        { text: "Serverless 平台（Vercel 类）托管" },
        { text: "传统 VPS + PM2 进程守护" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "tech-2",
      scope: "tech",
      text: "数据存储与隐私的底线要求是？",
      options: [
        { text: "数据不出部署者自建数据库" },
        { text: "可用第三方托管数据库，接受信任成本" },
        { text: "端侧存储优先，云端仅同步" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "tech-3",
      scope: "tech",
      text: "团队技术栈的倾向是？",
      options: [
        { text: "Next.js 全栈 + TypeScript 单语言" },
        { text: "前后端分离（React + 独立 API 服务）" },
        { text: "Electron 本地应用优先" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "tech-4",
      scope: "tech",
      text: "性能与规模的现实预期是？",
      options: [
        { text: "单用户决策树 < 千节点，交互毫秒级" },
        { text: "为万人级并发预留架构余量" },
        { text: "先不考虑规模，功能优先" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "tech-5",
      scope: "tech",
      text: "LLM 接入方式的约束是？",
      options: [
        { text: "OpenAI-compatible 单协议手写 client，多厂商可换" },
        { text: "绑定单一 AI SDK 生态求快" },
        { text: "多模型路由与降级为第一目标" },
      ],
      recommendedIndex: 0,
    },
    {
      seedId: "tech-6",
      scope: "tech",
      text: "离线可用性的要求是？",
      options: [
        { text: "MVP 不做离线，联网可用即可" },
        { text: "只读缓存离线可看，编辑需在线" },
        { text: "本地优先，全功能离线可用" },
      ],
      recommendedIndex: 0,
    },
  ],
};

/** 按 seedId 快速检索（生成选项时按问题文本反查种子） */
export function findSeedByText(text: string): QuestionSeed | undefined {
  for (const scope of SCOPE_PRIORITY) {
    const seed = CONTENT_LIBRARY[scope].find((s) => s.text === text);
    if (seed) return seed;
  }
  return undefined;
}
