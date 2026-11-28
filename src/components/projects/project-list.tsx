"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { backend, useHydrated, type Project } from "@/lib/backend";
import { NewProjectModal } from "./new-project-modal";

interface ProjectCard {
  project: Project;
  /** 根节点承载的初始想法摘要 */
  summary: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 项目列表主页（spec: project-management / 项目列表展示 + 空状态引导）。
 * 数据仅通过数据后端契约获取；mounted 门闩规避 persist 水合不匹配（design D-3）。
 */
export function ProjectList() {
  const hydrated = useHydrated();
  const [cards, setCards] = useState<ProjectCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const projects = await backend.projects.list();
        // 卡片摘要取项目根节点的初始想法
        const withSummary = await Promise.all(
          projects.map(async (project) => {
            const nodes = await backend.nodes.getByProject(project.id);
            const root = nodes.find((node) => node.id === project.rootNodeId);
            return { project, summary: root?.originIdea ?? "" };
          }),
        );
        if (!cancelled) setCards(withSummary);
      } catch {
        if (!cancelled) setError("加载项目失败，请刷新重试");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  if (!hydrated) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (cards === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
        <h2 className="mb-2 text-lg font-semibold text-neutral-900">从一个想法开始</h2>
        <p className="mx-auto mb-6 max-w-md text-sm leading-6 text-neutral-500">
          Fraxtal 是基于画布的非线性 AI 产品设计决策树：把初始想法交给 AI 提问补全盲区，
          沿着决策链分叉探索平行方案，最终编译为一份结构化的产品设计文档。
          创建第一个项目，开始你的第一棵决策树。
        </p>
        <div className="mx-auto max-w-xs">
          <NewProjectModal label="创建第一个项目" block />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(({ project, summary }) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="flex h-36 flex-col rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-400 hover:shadow-sm"
        >
          <span className="truncate text-base font-semibold text-neutral-900">{project.name}</span>
          <span className="mt-1 line-clamp-2 text-sm leading-5 text-neutral-500">
            {summary || "（无初始想法）"}
          </span>
          <span className="mt-auto text-xs text-neutral-400">
            创建于 {formatDateTime(project.createdAt)}
          </span>
        </Link>
      ))}
    </div>
  );
}
