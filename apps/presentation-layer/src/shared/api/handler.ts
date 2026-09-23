import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { ApiError, readJson, toErrorResponse } from './errors';

/** ADR-009 parsing helpers; body limits and errors are shared with workspace. */
export const readJsonBody = readJson;
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  return schema.parse(body);
}
export function parseQuery<T extends z.ZodType>(schema: T, request: NextRequest): z.infer<T> {
  return schema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
}
export async function parseParams<T extends z.ZodType>(schema: T, params: Promise<Record<string, string | string[]>>): Promise<z.infer<T>> {
  return schema.parse(await params);
}
/** Compatibility for callers already inside a request/Origin wrapper. */
export async function withErrorHandling<T>(fn: () => Promise<NextResponse<T>>) {
  try { return await fn(); } catch(error) { return toErrorResponse(error); }
}
/** Validate the actual JSON view (Date values become ISO strings).
 * Schema failures are server errors, never input 422s; validation must not
 * silently remove fields relied upon by an existing canonical client.
 */
export function jsonOk<T extends z.ZodType>(data: unknown, schema: T, status = 200): NextResponse {
  let wire: unknown;
  try { wire = JSON.parse(JSON.stringify(data)); }
  catch { throw new ApiError(500, 'invalid_response', 'Ошибка формирования ответа сервера'); }
  if (!schema.safeParse(wire).success) throw new ApiError(500, 'invalid_response', 'Ошибка формирования ответа сервера');
  return NextResponse.json(wire, { status, headers: { 'Cache-Control': 'no-store' } });
}
