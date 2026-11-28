"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api-client";

interface FieldErrors {
  [field: string]: string[];
}

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      // 注册即登录：直接进入主界面
      await api.post("/api/auth/register", { email, password });
      router.push("/");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("网络异常，请稍后重试");
      }
    } finally {
      setPending(false);
    }
  }

  const fieldError = (field: string) =>
    fieldErrors[field]?.map((message) => (
      <p key={message} className="text-xs text-red-600">
        {message}
      </p>
    ));

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        邮箱
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-800"
          placeholder="you@example.com"
        />
        {fieldError("email")}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        密码
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-800"
          placeholder="至少 8 个字符"
        />
        {fieldError("password")}
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-white transition hover:bg-neutral-700 disabled:opacity-50"
      >
        {pending ? "注册中…" : "注册"}
      </button>
      <p className="text-center text-sm text-neutral-500">
        已有账号？{" "}
        <Link href="/login" className="text-neutral-900 underline">
          登录
        </Link>
      </p>
    </form>
  );
}
