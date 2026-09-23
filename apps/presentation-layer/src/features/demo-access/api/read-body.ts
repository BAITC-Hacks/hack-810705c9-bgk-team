import type { z } from "zod";

import { UseCaseError } from "./errors";

/** Тело запроса по схеме; пустое тело — `{}`. Невалидный JSON или схема → 400. */
export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const text = await request.text();
  let json: unknown = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new UseCaseError("bad_request", "Некорректный JSON в теле запроса");
    }
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new UseCaseError("bad_request", "Проверьте поля запроса");
  return parsed.data;
}
