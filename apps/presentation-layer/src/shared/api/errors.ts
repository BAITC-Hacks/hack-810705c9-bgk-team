import { ForbiddenError } from '@/shared/lib/demo-actor';
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

// ADR-009: default schema messages use the same language as API business errors.
z.config(z.locales.ru());
export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };

// ADR-009: единый формат ошибок { error: { code, message, details? } }.

export type ApiErrorCode =
  | "bad_json"
  | "unsupported_media_type"
  | "payload_too_large"
  | "origin_rejected"
  | "validation_error"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "already_exists"
  | "related_record_missing"
  | "internal_error";

/** Лимит тела JSON-запроса: проверяется до разбора. */
export const MAX_JSON_BODY_BYTES = 128 * 1024;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type ErrorBody = { code: string; message: string } & Record<string, unknown>;

/** Настройки ответа для модулей со своими кодами ошибок (например, workspace API). */
export type ErrorResponseOptions = {
  /** Замена кода (строка) или кода и текста (объект) по исходному коду ответа. */
  aliases?: Readonly<Record<string, string | { code: string; message: string }>>;
  /** Формат ошибки zod: `details` (flatten, по умолчанию) или `fields` [{ path, message }]. */
  validation?: "details" | "fields";
  /** HTTP-статус непредвиденной ошибки; по умолчанию 500. */
  fallbackStatus?: number;
  /** Метка в серверном журнале. */
  logLabel?: string;
};

export function toResponse(err: unknown, options: ErrorResponseOptions = {}): NextResponse {
  const reply = (status: number, body: ErrorBody) => {
    const alias = options.aliases?.[body.code];
    const error = typeof alias === "string" ? { ...body, code: alias } : alias ? { ...body, ...alias } : body;
    return NextResponse.json({ error }, { status });
  };
  if (err instanceof ForbiddenError) return reply(403, { code: "forbidden", message: err.message });
  if (err instanceof ApiError) {
    return reply(err.status, {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
  }
  if (err instanceof ZodError) {
    return reply(422, {
      code: "validation_error",
      message: "Проверьте заполненные поля",
      ...(options.validation === "fields"
        ? {
            fields: err.issues.map((issue) => ({
              path: issue.path.map(String).join("."),
              message: issue.message,
            })),
          }
        : { details: z_flatten(err) }),
    });
  }
  if (err instanceof SyntaxError) {
    return reply(400, { code: "bad_json", message: "Некорректный JSON в теле запроса" });
  }
  const dbCode = databaseErrorCode(err);
  if (dbCode === "23505") {
    return reply(409, { code: "already_exists", message: "Такая запись уже существует." });
  }
  if (dbCode === "23503") {
    return reply(409, {
      code: "related_record_missing",
      message: "Связанная запись не найдена. Обновите данные.",
    });
  }
  logServerError(options.logLabel ?? "API failure", err, dbCode);
  return reply(options.fallbackStatus ?? 500, {
    code: "internal_error",
    message: "Внутренняя ошибка сервера",
  });
}

function z_flatten(err: ZodError) {
  return err.flatten();
}

/** Код PostgreSQL (например, 23505) из ошибки драйвера или её цепочки `cause`. */
export function databaseErrorCode(err: unknown): string | undefined {
  let current = err;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
}

// Только имя и код: текст ошибки драйвера может содержать SQL, параметры или строку подключения.
function logServerError(label: string, err: unknown, code: string | undefined) {
  console.error(label, {
    name: err instanceof Error ? err.name : typeof err,
    code: code ?? "internal_error",
  });
}

/**
 * Мутации с явным чужим Origin → 403. Запрос без Origin пропускается (curl, скрипты).
 * Сравнение с Host: Next может нормализовать request.url к localhost, а Host
 * сохраняет фактическое имя и порт из браузера (включая 127.0.0.1).
 */
export function assertSameOrigin(request: Request): void {
  if (["GET", "HEAD"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  let sameOrigin = false;
  try {
    const source = new URL(origin);
    sameOrigin =
      ["http:", "https:"].includes(source.protocol) &&
      source.host === (request.headers.get("host") ?? new URL(request.url).host);
  } catch {
    /* Malformed/null origins are rejected. */
  }
  if (!sameOrigin) {
    throw new ApiError(403, "origin_rejected", "Запрос отправлен с другого сайта.");
  }
}

/** Оборачивает route handler: проверяет Origin мутаций, ловит ошибки и приводит их к единому формату ответа. */
export function withApi<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      if (args[0] instanceof Request) assertSameOrigin(args[0]);
      return await handler(...args);
    } catch (err) {
      return toResponse(err);
    }
  };
}

/**
 * Читает JSON тело запроса: требует `application/json` (415), ограничивает размер
 * по Content-Length и по фактически прочитанным байтам (413), невалидный JSON → 400.
 */
export async function readJson(req: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<unknown> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Запрос должен содержать JSON.");
  }
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) {
    throw new ApiError(413, "payload_too_large", "Запрос слишком большой.");
  }
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "bad_json", "Пустой JSON-запрос.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, "payload_too_large", "Запрос слишком большой.");
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, "bad_json", "Не удалось прочитать тело запроса.");
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, "bad_json", "Некорректный JSON в теле запроса");
  }
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    { error: details === undefined ? { code, message } : { code, message, details } },
    { status },
  );
}

export const toErrorResponse = toResponse;
export const notFound = (message: string, details?: unknown) => new ApiError(404, 'not_found', message, details);
export const conflict = (message: string, details?: unknown) => new ApiError(409, 'conflict', message, details);

// ADR-009 helper names delegate to the canonical error class and wire semantics.
export const invalidJson = (details?: unknown) => new ApiError(400, "bad_json", "Некорректный JSON в теле запроса", details);
export const validationError = (message: string, details?: unknown) => new ApiError(422, "validation_error", message, details);
export const businessError = (message: string, details?: unknown) => new ApiError(422, "business_error", message, details);
export const forbidden = (message = "Действие недоступно для текущей роли") => new ApiError(403, "forbidden", message);
