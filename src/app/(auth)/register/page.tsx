import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "注册 · Fraxtal" };

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">注册</h1>
        <p className="mb-6 text-sm text-neutral-500">
          创建账号，开始你的第一个产品设计决策树
        </p>
        <RegisterForm />
      </div>
    </main>
  );
}
