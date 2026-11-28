import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const uiBoundary = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["@/server", "@/server/**"],
          message:
            "前端代码不得 import 服务端模块（src/server 只允许被服务端调用）",
        },
      ],
    },
  ],
};

const serverBoundary = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["@/app/**", "@/components/**"],
          message: "server/db 层不得依赖 UI 层（app/components）",
        },
      ],
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // ── 分层 import 边界（tech-decisions D12：lib / server / db / UI 单向依赖）──
  {
    // UI 层（app 页面路由 + 组件）不得触碰服务端模块。
    // 注意：不要在此 files 中混入 negative pattern（会放宽匹配语义），
    // app/api 的豁免由下方的后置 override 完成
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: uiBoundary,
  },
  {
    // 后置覆盖：app/api 是服务端 Route Handler，不受 UI 约束
    files: ["src/app/api/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // lib 为双端共享纯逻辑层：零 IO、零框架依赖方向
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server",
                "@/server/**",
                "@/app/**",
                "@/components/**",
              ],
              message: "lib 层不得依赖 server/app/components（保持双端可共享）",
            },
          ],
        },
      ],
    },
  },
  {
    // 服务端（Route Handlers + server 模块）与数据层不得反向依赖 UI 层
    files: [
      "src/app/api/**/*.{ts,tsx}",
      "src/server/**/*.{ts,tsx}",
      "src/db/**/*.{ts,tsx}",
    ],
    rules: serverBoundary,
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
