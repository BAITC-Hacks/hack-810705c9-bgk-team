import { NextResponse } from "next/server";

// Минимальный помощник формата ошибок ADR-009; владелец ADR-009 может заменить.
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
