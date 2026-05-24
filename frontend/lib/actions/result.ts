import type { ApiErrorBody } from "@/lib/errors";
import { ApiError } from "@/lib/errors";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorBody };

export function actionError(err: unknown, fallback: string): ActionResult<never> {
  if (err instanceof ApiError) {
    return { ok: false, error: err.body };
  }
  return {
    ok: false,
    error: { code: "UNKNOWN", message: fallback },
  };
}
