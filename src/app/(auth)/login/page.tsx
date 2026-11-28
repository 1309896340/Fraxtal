import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "登录 · Fraxtal" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">登录</h1>
        <p className="mb-6 text-sm text-neutral-500">
          登录 Fraxtal，继续你的产品设计决策树
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
