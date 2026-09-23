import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';

import { ApiErrorBody, invalidJson, toErrorResponse } from './errors';

/**
 * ADR-009 §1: каждый route.ts делает три шага — getDemoActor(), парсинг по
 * схеме, вызов use-case — и не содержит бизнес-логики. Эти хелперы держат
 * route-файлы маленькими и однообразными.
 */

/** Парсит JSON тело запроса; невалидный JSON -> 400 (не ZodError). */
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch (cause) {
    throw invalidJson({ message: (cause as Error)?.message });
  }
}

export function parseBody<TSchema extends z.ZodType>(
  schema: TSchema,
  body: unknown,
): z.infer<TSchema> {
  return schema.parse(body);
}

export function parseQuery<TSchema extends z.ZodType>(
  schema: TSchema,
  request: NextRequest,
): z.infer<TSchema> {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  return schema.parse(params);
}

/**
 * Next.js 16: `params` в route handler — Promise. Разворачивает и проверяет
 * схемой zod.
 */
export async function parseParams<TSchema extends z.ZodType>(
  schema: TSchema,
  params: Promise<Record<string, string | string[]>>,
): Promise<z.infer<TSchema>> {
  const resolved = await params;
  return schema.parse(resolved);
}

/**
 * Оборачивает тело route handler: ловит ApiError/ZodError/неизвестную ошибку
 * и превращает её в единый формат ответа (ADR-009 §4).
 */
export async function withErrorHandling<T>(
  fn: () => Promise<NextResponse<T>>,
): Promise<NextResponse<T> | NextResponse<ApiErrorBody>> {
  try {
    return await fn();
  } catch (error) {
    return toErrorResponse(error);
  }
}

export function jsonOk<TSchema extends z.ZodType>(
  schema: TSchema,
  data: z.infer<TSchema>,
  init?: { status?: number },
): NextResponse<z.infer<TSchema>> {
  // Валидируем форму ответа схемой — контракт остаётся источником истины и
  // для запроса, и для ответа (ADR-009 §3). Несоответствие здесь — баг
  // use-case/маппинга, а не ввод клиента, поэтому не должно превращаться в
  // 422 через общий ZodError-путь `toErrorResponse`: заворачиваем в обычный
  // `Error`, который уйдёт по ветке "неизвестная ошибка" -> 500, залогируется
  // и не раскроет клиенту внутренние детали схемы.
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Response failed schema validation: ${result.error.message}`);
  }
  return NextResponse.json(result.data, { status: init?.status ?? 200 });
}
