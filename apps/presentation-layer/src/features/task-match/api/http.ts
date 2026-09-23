import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Некорректный JSON в запросе');
  }
}

export function apiFailure(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Проверьте данные запроса', details: error.flatten() } },
      { status: 422 },
    );
  }
  console.error('BFF request failed', error);
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Не удалось выполнить запрос' } },
    { status: 500 },
  );
}
