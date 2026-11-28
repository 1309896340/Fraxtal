import { z } from "zod";

/** 所有 API 错误响应的统一信封（design D-6）。 */
export const API_ERROR_CODES = [
  "VALIDATION",
  "BAD_REQUEST",
  "EMAIL_EXISTS",
  "INVALID_CREDENTIALS",
  "INVALID_TOKEN",
  "UNAUTHORIZED",
  "REPLAY_DETECTED",
  "INTERNAL",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}

/** 构造统一错误响应体。 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      ...(fieldErrors && { fieldErrors }),
    },
  };
}

/** zod 错误 → 字段级错误映射（422 VALIDATION 响应用）。 */
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (map[key] ??= []).push(issue.message);
  }
  return map;
}
