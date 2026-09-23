import { forbiddenResponse } from "@/shared/lib/demo-actor";

// ИНТЕГРАЦИЯ: ADR-009 вводит общий ApiError (`src/shared/api/errors.ts` в ветках
// ADR-006/007). Формат ответа тот же — `{ error: { code, message } }`; при
// слиянии этот файл заменяется импортом общего модуля.

export type UseCaseErrorCode = "bad_request" | "not_found" | "conflict";

const STATUS: Record<UseCaseErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  conflict: 409,
};

export class UseCaseError extends Error {
  readonly status: number;
  constructor(
    readonly code: UseCaseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UseCaseError";
    this.status = STATUS[code];
  }
}

export function toErrorResponse(error: unknown): Response {
  const forbidden = forbiddenResponse(error);
  if (forbidden) return forbidden;
  if (error instanceof UseCaseError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error(error);
  return Response.json(
    { error: { code: "internal_error", message: "Внутренняя ошибка сервера" } },
    { status: 500 },
  );
}
