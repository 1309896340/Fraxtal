"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { backend, useHydrated, type Project } from "@/lib/backend";

/**
 * 画布工作区占位壳（tasks.md 3.3）：
 * 顶栏（返回 + 项目名）+ 空画布提示区。
 * 画布渲染、问答面板与编译交互由 canvas-core-frontend 变更交付。
 */
export function CanvasWorkspace({ projectId }: { projectId: string }) {
  const hydrated = useHydrated();
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const projects = await backend.projects.list();
        const found = projects.find((p) => p.id === projectId) ?? null;
        if (cancelled) return;
        if (found) setProject(found);
        else setMissing(true);
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, projectId]);

  return (
    <main className="flex min-h-screen flex-col bg-neutral-50">
      <header className="flex items-center gap-4 border-b border-neutral-200 bg-white px-4 py-3">
        <Link
          href="/"
          className="rounded-md px-2 py-1 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          ← 返回列表
        </Link>
        <span className="min-w-0 truncate text-base font-semibold text-neutral-900">
          {hydrated ? (missing ? "项目不存在" : (project?.name ?? "加载中…")) : "加载中…"}
        </span>
      </header>

      <section className="flex flex-1 items-center justify-center p-6">
        {hydrated && missing ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
            项目不存在或已被清除——请返回列表确认
          </div>
        ) : (
          <div className="w-full max-w-2xl rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <p className="mb-1 text-base font-medium text-neutral-900">空画布</p>
            <p className="text-sm leading-6 text-neutral-500">
              决策树画布、AI 问答面板与编译入口将在画布核心变更（canvas-core-frontend）中交付。
              <br />
              本项目的数据已就绪：根节点承载你的初始想法。
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
