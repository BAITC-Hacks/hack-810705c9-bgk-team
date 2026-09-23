import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * ADR-009: единый формат ошибок { error: { code, message, details? } },
 * message — по-русски, для человека.
 */

export type ApiErrorCode =
  | 'invalid_json'
  | 'validation_error'
  | 'business_error'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'internal_error';

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(params: {
    code: ApiErrorCode;
    httpStatus: number;
    message: string;
    details?: unknown;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.details = params.details;
  }

  toBody(): ApiErrorBody {
    return {
      error: { code: this.code, message: this.message, details: this.details },
    };
  }
}

export function invalidJson(details?: unknown): ApiError {
  return new ApiError({
    code: 'invalid_json',
    httpStatus: 400,
    message: 'Тело запроса не является корректным JSON.',
    details,
  });
}

export function validationError(message: string, details?: unknown): ApiError {
  return new ApiError({ code: 'validation_error', httpStatus: 422, message, details });
}

export function businessError(message: string, details?: unknown): ApiError {
  return new ApiError({ code: 'business_error', httpStatus: 422, message, details });
}

export function forbidden(message = 'Действие недоступно для текущей роли.'): ApiError {
  return new ApiError({ code: 'forbidden', httpStatus: 403, message });
}

export function notFound(message = 'Сущность не найдена.'): ApiError {
  return new ApiError({ code: 'not_found', httpStatus: 404, message });
}

export function conflict(message: string, details?: unknown): ApiError {
  return new ApiError({ code: 'conflict', httpStatus: 409, message, details });
}

/** Собирает читаемое русское сообщение из первой проблемы ZodError. */
function firstZodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Данные запроса не прошли проверку.';
  return issue.message || 'Данные запроса не прошли проверку.';
}

/**
 * Превращает любую ошибку use-case/handler в ответ API.
 * ZodError -> 422 с расплющенными деталями; ApiError -> как задано;
 * неизвестная ошибка -> 500 без утечки внутренних деталей.
 */
export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ApiError) {
    return NextResponse.json(error.toBody(), { status: error.httpStatus });
  }

  if (error instanceof z.ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: 'validation_error',
        message: firstZodMessage(error),
        details: z.flattenError(error),
      },
    };
    return NextResponse.json(body, { status: 422 });
  }

  // Неизвестная ошибка: не раскрываем внутренние детали клиенту.
  console.error('[api] unhandled error', error);
  const body: ApiErrorBody = {
    error: {
      code: 'internal_error',
      message: 'Внутренняя ошибка сервера. Попробуйте ещё раз.',
    },
  };
  return NextResponse.json(body, { status: 500 });
}
