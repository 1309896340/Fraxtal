"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={logout}
      disabled={pending}
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 transition hover:bg-neutral-100 disabled:opacity-50"
    >
      {pending ? "登出中…" : "登出"}
    </button>
  );
}
