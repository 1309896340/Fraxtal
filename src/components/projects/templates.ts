/**
 * 产品描述模板（spec: project-management / 新建项目）：
 * 新建模态中选用后预填初始想法输入框，可继续编辑。
 */

export interface ProductTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
}

export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  {
    id: "efficiency-tool",
    name: "效率工具",
    description: "个人或团队的效率提升 SaaS",
    content:
      "一款帮助用户提升日常效率的工具。核心场景：用户在信息碎片化的工作流中难以组织任务与知识，" +
      "本产品通过结构化的方式把想法、任务与资料沉淀为可追溯的系统。" +
      "期望的首批用户是信息密集型工作者（产品经理、研究者、独立开发者）。",
  },
  {
    id: "developer-tool",
    name: "开发者工具",
    description: "面向开发者的生产力工具链",
    content:
      "一款面向开发者的工具产品。核心场景：开发者在日常开发中存在重复、易错的环节，" +
      "本产品用自动化与良好的默认值消除这些摩擦。" +
      "期望的差异化是开箱即用的体验与对主流工作流（CLI/CI/编辑器）的无缝集成。",
  },
  {
    id: "content-community",
    name: "内容社区",
    description: "垂直领域的内容与社区产品",
    content:
      "一款围绕特定垂直领域的内容社区产品。核心场景：领域内的优质内容分散、缺乏结构化沉淀，" +
      "本产品通过内容组织机制与社区互动形成可持续的知识库。" +
      "期望先以单一批次的种子用户跑通内容生产与消费的闭环。",
  },
  {
    id: "vertical-saas",
    name: "垂直行业方案",
    description: "某一行业的标准化 SaaS 解决方案",
    content:
      "一款服务特定行业的标准化 SaaS 解决方案。核心场景：该行业的中小商家/机构仍在用表格与人工流程管理核心业务，" +
      "本产品把行业最佳实践固化为一套可快速上手的系统。" +
      "期望的切入方式是单一高频场景做深，再逐步扩展到全流程。",
  },
];
