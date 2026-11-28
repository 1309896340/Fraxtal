/**
 * 类型化前端 API 客户端（design D-6 统一错误信封）。
 * 401 时自动尝试一次 refresh 并重放原请求（access 15 分钟过期对用户无感）；
 * 认证端点自身的 401（凭据错误/重放）不触发自动续期，避免循环。
 */

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly status: number = 0,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface ApiErrorBody {
  error: { code: string; message: string; fieldErrors?: Record<string, string[]> };
}

const NO_AUTO_REFRESH_PREFIXES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
];

async function requestWithRefresh(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (response.status !== 401) return response;
  if (NO_AUTO_REFRESH_PREFIXES.some((p) => path.startsWith(p))) return response;

  // 尝试续期并重放原请求一次
  const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
  if (refreshed.ok) {
    return fetch(path, init);
  }
  return response;
}

async function parseBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await parseBody(response)) as (T & ApiErrorBody) | null;
  if (!response.ok) {
    const error = body?.error;
    throw new ApiClientError(
      error?.code ?? "INTERNAL",
      error?.message ?? `请求失败（HTTP ${response.status}）`,
      error?.fieldErrors,
      response.status,
    );
  }
  return body as T;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return requestWithRefresh(path).then((response) => unwrap<T>(response));
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return requestWithRefresh(path, {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then((response) => unwrap<T>(response));
  },
};
