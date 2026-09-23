import { ACTOR_COOKIE, ROLE_COOKIE, resolveDemoActor } from "@/shared/lib/demo-actor";
import { ApiError } from "@/shared/api/errors";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertSameOrigin,
  readJson,
  toResponse,
  type ErrorResponseOptions,
} from "@/shared/api/errors";
import {
  sessionSchema,
  type WorkspaceSession,
} from "@/entities/workspace/contracts";
import { resolveSession } from "./service";

export const SESSION_COOKIE = "task-match-session";
export type ApiContext = { params: Promise<Record<string, string>> };

export async function getSession(): Promise<WorkspaceSession> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  let session: WorkspaceSession = sessionSchema.parse({ role: "business", teamId: null });
  if (value) {
    try {
      const parsed = sessionSchema.safeParse(JSON.parse(value));
      if (parsed.success) session = parsed.data;
    } catch {
      /* A stale demo cookie resets to the documented demo identity. */
    }
  }
  // A deliberate demo-actor switch also updates the workspace identity.
  const jar = await cookies();
  const demo = resolveDemoActor({ role: jar.get(ROLE_COOKIE)?.value, actor: jar.get(ACTOR_COOKIE)?.value });
  if (value && demo) session = demo.role === "business"
    ? { ...session, role:"business",businessId:demo.businessId }
    : { ...session,role:"student",teamId:demo.teamId };
  return resolveSession(session);
}
export async function setSessionCookie(session: WorkspaceSession) {
  const jar = await cookies();
  const options = { httpOnly:true, sameSite:"lax" as const, secure:process.env.NODE_ENV === "production", path:"/", maxAge:60*60*24*30 };
  if (session.onboardingCompleted) {
    const actorId = session.role === "student" ? session.teamId : session.businessId;
    if (!actorId) throw new ApiError(403,"forbidden","Завершите знакомство с платформой");
    jar.set(ROLE_COOKIE,session.role === "student" ? "team" : "business",options);
    jar.set(ACTOR_COOKIE,actorId,options);
  } else {
    jar.delete(ROLE_COOKIE);
    jar.delete(ACTOR_COOKIE);
  }
  jar.set(SESSION_COOKIE, JSON.stringify(session), options);
}
export async function jsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  return schema.parse(await readJson(request));
}

// Workspace API keeps its uppercase codes; shared (ADR-009) codes are mapped here.
const WORKSPACE_ERRORS: ErrorResponseOptions = {
  aliases: {
    bad_json: "INVALID_JSON",
    unsupported_media_type: "JSON_REQUIRED",
    payload_too_large: "BODY_TOO_LARGE",
    origin_rejected: "ORIGIN_REJECTED",
    validation_error: {
      code: "VALIDATION_ERROR",
      message: "Проверьте заполнение полей.",
    },
    already_exists: {
      code: "ALREADY_EXISTS",
      message:
        "Такая запись уже существует. Команда может отправить один отклик на задачу.",
    },
    related_record_missing: "RELATED_RECORD_MISSING",
    internal_error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Не удалось обратиться к базе данных. Повторите попытку.",
    },
  },
  validation: "fields",
  fallbackStatus: 503,
  logLabel: "Workspace API failure",
};

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
      assertSameOrigin(request);
      const result = await handler(request, context, await getSession());
      if (result instanceof Response) return result;
      return NextResponse.json(result, {
        status,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      // Safe mapping/logging: no SQL, connection strings or submitted content.
      return toResponse(error, WORKSPACE_ERRORS);
    }
  };
}
