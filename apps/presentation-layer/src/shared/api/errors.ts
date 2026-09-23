// ADR-009: единый формат ошибок `{ error: { code, message, details? } }`,
// `message` — по-русски для человека.
import { z, ZodError } from 'zod';

// NFR-4: стандартные тексты zod по-русски; явные сообщения схем важнее.
z.config(z.locales.ru());

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFound(message: string, details?: unknown): ApiError {
  return new ApiError('not_found', 404, message, details);
}

export function conflict(message: string, details?: unknown): ApiError {
  return new ApiError('conflict', 409, message, details);
}

function errorBody(code: string, message: string, details?: unknown) {
  return {
    error: details === undefined ? { code, message } : { code, message, details },
  };
}

export function toErrorResponse(e: unknown): Response {
  if (e instanceof ZodError) {
    const first = e.issues[0];
    const where = first?.path.length ? ` (${first.path.join('.')})` : '';
    return Response.json(
      errorBody(
        'validation_error',
        `Некорректные данные запроса${where}: ${first?.message ?? 'проверьте поля'}`,
        e.issues,
      ),
      { status: 422 },
    );
  }
  if (e instanceof SyntaxError) {
    return Response.json(
      errorBody('invalid_json', 'Тело запроса — не корректный JSON'),
      { status: 400 },
    );
  }
  if (e instanceof ApiError) {
    return Response.json(errorBody(e.code, e.message, e.details), {
      status: e.status,
    });
  }
  console.error(e);
  return Response.json(
    errorBody('internal_error', 'Внутренняя ошибка сервера. Попробуйте позже'),
    { status: 500 },
  );
}
