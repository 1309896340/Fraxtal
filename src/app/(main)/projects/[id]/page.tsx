import { Suspense } from "react";
import type { Metadata } from "next";
import { CanvasWorkspace } from "@/components/projects/canvas-workspace";

export const metadata: Metadata = { title: "工作区 · Fraxtal" };

/**
 * 画布工作区路由（占位壳）。
 * Cache Components 模式下动态路由 params 属运行时数据：
 * 参数读取必须包在 <Suspense> 内（docs: dynamic-routes / without generateStaticParams）。
 */
export default function ProjectWorkspacePage({ params }: PageProps<"/projects/[id]">) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-500">
          加载中…
        </main>
      }
    >
      <WorkspaceContent params={params} />
    </Suspense>
  );
}

async function WorkspaceContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CanvasWorkspace projectId={id} />;
}
