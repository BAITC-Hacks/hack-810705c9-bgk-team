import { NextResponse } from "next/server";
import { ZodError } from "zod";

// ADR-009: единый формат ошибок { error: { code, message, details? } }.

export type ApiErrorCode =
  | "bad_json"
  | "validation_error"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "internal_error";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function toResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Проверьте заполненные поля",
          details: z_flatten(err),
        },
      },
      { status: 422 },
    );
  }
  if (err instanceof SyntaxError) {
    return NextResponse.json(
      { error: { code: "bad_json", message: "Некорректный JSON в теле запроса" } },
      { status: 400 },
    );
  }
  console.error(err);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Внутренняя ошибка сервера" } },
    { status: 500 },
  );
}

function z_flatten(err: ZodError) {
  return err.flatten();
}

/** Оборачивает route handler: ловит ошибки и приводит их к единому формату ответа. */
export function withApi<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      return toResponse(err);
    }
  };
}

/** Читает JSON тело запроса; невалидный JSON превращается в ApiError(400). */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "bad_json", "Некорректный JSON в теле запроса");
  }
}
