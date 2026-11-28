import type { Metadata } from "next";
import { LogoutButton } from "@/components/auth/logout-button";
import { UserBadge } from "@/components/auth/user-badge";

export const metadata: Metadata = { title: "项目 · Fraxtal" };

export default function ProjectsPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <span className="text-lg font-semibold tracking-tight text-neutral-900">
          Fraxtal
        </span>
        <div className="flex items-center gap-4">
          <UserBadge />
          <LogoutButton />
        </div>
      </header>
      <section className="mx-auto max-w-3xl p-6">
        <h1 className="mb-2 text-xl font-semibold text-neutral-900">我的项目</h1>
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          项目列表即将上线——画布与决策树能力将在后续变更中交付
        </div>
      </section>
    </main>
  );
}
