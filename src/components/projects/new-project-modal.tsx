"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { backend, type Project } from "@/lib/backend";
import { PRODUCT_TEMPLATES } from "./templates";

/**
 * 【新建项目】模态（spec: project-management / 新建项目）：
 * 收集项目名称与初始想法，可选产品描述模板预填；
 * 字段级校验失败不创建；成功后跳转该项目工作区。
 */
export function NewProjectModal({
  label = "新建项目",
  block = false,
}: {
  label?: string;
  block?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [originIdea, setOriginIdea] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; originIdea?: string }>({});
  const [backendError, setBackendError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function openModal() {
    setOpen(true);
    setName("");
    setOriginIdea("");
    setSelectedTemplateId(null);
    setErrors({});
    setBackendError(null);
    setPending(false);
  }

  function closeModal() {
    if (!pending) setOpen(false);
  }

  function applyTemplate(templateId: string) {
    const template = PRODUCT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    setOriginIdea(template.content);
    setErrors((prev) => ({ ...prev, originIdea: undefined }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    // 字段级校验：必填不满足时不创建
    const nextErrors: { name?: string; originIdea?: string } = {};
    if (!name.trim()) nextErrors.name = "请输入项目名称";
    if (!originIdea.trim()) nextErrors.originIdea = "请输入初始想法（可选用模板辅助填写）";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    setBackendError(null);
    try {
      const project: Project = await backend.projects.create({
        name: name.trim(),
        originIdea: originIdea.trim(),
      });
      setOpen(false);
      setPending(false);
      router.push(`/projects/${project.id}`);
    } catch {
      setBackendError("创建失败，请稍后重试");
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          block
            ? "w-full rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
            : "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
        }
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="新建项目"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">新建项目</h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="关闭"
                className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm text-neutral-900">
                项目名称
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="例如：周报助手"
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-800"
                />
                {errors.name && (
                  <span role="alert" className="text-xs text-red-600">
                    {errors.name}
                  </span>
                )}
              </label>

              <div className="flex flex-col gap-1 text-sm text-neutral-900">
                <span className="text-neutral-700">产品描述模板（可选，预填初始想法）</span>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      title={template.description}
                      onClick={() => applyTemplate(template.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        selectedTemplateId === template.id
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500"
                      }`}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1 text-sm text-neutral-900">
                初始想法
                <textarea
                  value={originIdea}
                  onChange={(e) => {
                    setOriginIdea(e.target.value);
                    if (errors.originIdea) setErrors((prev) => ({ ...prev, originIdea: undefined }));
                  }}
                  rows={5}
                  placeholder="用几句话描述你想做的产品——它将成为决策树的根节点"
                  className="resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-800"
                />
                {errors.originIdea && (
                  <span role="alert" className="text-xs text-red-600">
                    {errors.originIdea}
                  </span>
                )}
              </label>

              {backendError && (
                <p role="alert" className="text-sm text-red-600">
                  {backendError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={pending}
                  className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
                >
                  {pending ? "创建中…" : "创建项目"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
