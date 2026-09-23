import type { z } from "zod";

import { UseCaseError } from "./errors";

/** Маркер невалидного JSON: ошибка 400 выдаётся в use-case после проверки роли. */
export const INVALID_JSON: unique symbol = Symbol("invalid-json");

/** Сырое тело запроса без проверки схемы; пустое тело — `{}`. */
export async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return INVALID_JSON;
  }
}

/** Проверка входа use-case; вызывается после `assertRole`, поэтому чужая роль получает 403, а не 400. */
export function parseInput<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  if (raw === INVALID_JSON) {
    throw new UseCaseError("bad_request", "Некорректный JSON в теле запроса");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new UseCaseError("bad_request", "Проверьте поля запроса");
  return parsed.data;
}
