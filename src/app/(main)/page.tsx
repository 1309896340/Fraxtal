import type { Metadata } from "next";
import { LogoutButton } from "@/components/auth/logout-button";
import { UserBadge } from "@/components/auth/user-badge";
import { NewProjectModal } from "@/components/projects/new-project-modal";
import { ProjectList } from "@/components/projects/project-list";

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
      <section className="mx-auto w-full max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-neutral-900">我的项目</h1>
          <NewProjectModal />
        </div>
        <ProjectList />
      </section>
    </main>
  );
}
