"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

interface MeResponse {
  user: { id: string; email: string };
}

/** 当前用户徽标：登录态显示邮箱（access 过期由 api-client 自动续期），未登录显示占位。 */
export function UserBadge() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<MeResponse>("/api/auth/me")
      .then((data) => {
        if (!cancelled) setEmail(data.user.email);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className="text-sm text-neutral-600">
      {email ? `已登录：${email}` : "…"}
    </span>
  );
}

