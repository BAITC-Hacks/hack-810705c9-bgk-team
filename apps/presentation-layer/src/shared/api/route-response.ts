import { ZodError } from 'zod';
import { GrillApiError } from '@/features/grill/api/service';

export function apiError(error: unknown) {
  if (error instanceof GrillApiError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Проверьте формат запроса.', details: error.issues } }, { status: 422 });
  }
  return Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Не удалось обработать запрос.' } }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { throw new GrillApiError(400, 'INVALID_JSON', 'Тело запроса должно быть корректным JSON.'); }
}
