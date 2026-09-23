import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "@/shared/api/errors";
import {
  sessionSchema,
  type WorkspaceSession,
} from "@/entities/workspace/contracts";
import { resolveSession } from "./service";

export const SESSION_COOKIE = "task-match-session";
export type ApiContext = { params: Promise<Record<string, string>> };

export async function getSession(): Promise<WorkspaceSession> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  let session: WorkspaceSession = { role: "business", teamId: null };
  if (value) {
    try {
      const parsed = sessionSchema.safeParse(JSON.parse(value));
      if (parsed.success) session = parsed.data;
    } catch {
      /* A stale demo cookie resets to the documented demo identity. */
    }
  }
  return resolveSession(session);
}
export async function setSessionCookie(session: WorkspaceSession) {
  (await cookies()).set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
export async function jsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new ApiError(415, "JSON_REQUIRED", "Запрос должен содержать JSON.");
  const maximum = 128 * 1024;
  if (Number(request.headers.get("content-length") ?? 0) > maximum)
    throw new ApiError(413, "BODY_TOO_LARGE", "Запрос слишком большой.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_JSON", "Пустой JSON-запрос.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new ApiError(413, "BODY_TOO_LARGE", "Запрос слишком большой.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Некорректный JSON-запрос.");
  }
  return schema.parse(value);
}

function databaseCode(error: unknown): string | undefined {
  let current = error;
  for (
    let depth = 0;
    depth < 5 && current && typeof current === "object";
    depth++
  ) {
    if ("code" in current && typeof current.code === "string")
      return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
}
export function apiRoute(
  handler: (
    request: Request,
    context: ApiContext,
    session: WorkspaceSession,
  ) => Promise<unknown>,
  status = 200,
) {
  return async (request: Request, context: ApiContext) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        const origin = request.headers.get("origin");
        if (origin) {
          let sameOrigin = false;
          try {
            const source = new URL(origin);
            // Next may normalize request.url to localhost; Host retains the
            // browser's actual local hostname (including 127.0.0.1 and its port).
            sameOrigin =
              ["http:", "https:"].includes(source.protocol) &&
              source.host ===
                (request.headers.get("host") ?? new URL(request.url).host);
          } catch {
            /* Malformed/null origins are rejected. */
          }
          if (!sameOrigin)
            throw new ApiError(
              403,
              "ORIGIN_REJECTED",
              "Запрос отправлен с другого сайта.",
            );
        }
      }
      const result = await handler(request, context, await getSession());
      return NextResponse.json(result, {
        status,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      if (error instanceof ApiError)
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status },
        );
      if (error instanceof z.ZodError)
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Проверьте заполнение полей.",
              fields: error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
              })),
            },
          },
          { status: 422 },
        );
      const code = databaseCode(error);
      if (code === "23505")
        return NextResponse.json(
          {
            error: {
              code: "ALREADY_EXISTS",
              message:
                "Такая запись уже существует. Команда может отправить один отклик на задачу.",
            },
          },
          { status: 409 },
        );
      if (code === "23503")
        return NextResponse.json(
          {
            error: {
              code: "RELATED_RECORD_MISSING",
              message: "Связанная запись не найдена. Обновите данные.",
            },
          },
          { status: 409 },
        );
      // Do not expose SQL, connection strings, or submitted content in responses/logs.
      console.error("Workspace API failure", {
        code: code ?? "INTERNAL_ERROR",
      });
      return NextResponse.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Не удалось обратиться к базе данных. Повторите попытку.",
          },
        },
        { status: 503 },
      );
    }
  };
}
