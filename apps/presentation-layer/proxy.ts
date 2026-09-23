import { NextResponse, type NextRequest } from "next/server";

import {
  ACTOR_COOKIE,
  ROLE_COOKIE,
  demoActorId,
  parseDemoActor,
  resolveDemoActor,
} from "@/shared/lib/demo-actor";

// ADR-008: на навигации по страницам без валидных cookie ставим участника по
// умолчанию, чтобы UI и сервер видели одну роль. API сюда не входит: запрос
// к /api/* без cookie получает 403 от `requireDemoActor()`.
export function proxy(request: NextRequest) {
  const values = {
    role: request.cookies.get(ROLE_COOKIE)?.value,
    actor: request.cookies.get(ACTOR_COOKIE)?.value,
  };
  if (resolveDemoActor(values)) return NextResponse.next();
  // Do not replace a newly onboarded business with a static demo business.
  // The server resolves the matching profile against the business table.
  try {
    const session = JSON.parse(request.cookies.get("task-match-session")?.value ?? "null");
    if (["business", "student"].includes(session?.role) && session.onboardingCompleted === false) return NextResponse.next();
    if (values.role === "business" && session?.role === "business" && session.onboardingCompleted && typeof session.businessId === "string" && session.businessId === values.actor) return NextResponse.next();
  } catch { /* Invalid session falls back to the demo identity. */ }

  const actor = parseDemoActor(values);
  const cookies = [
    [ROLE_COOKIE, actor.role],
    [ACTOR_COOKIE, demoActorId(actor)],
  ] as const;

  // Запрос текущего рендера тоже получает cookie, ответ сохраняет их в браузере.
  for (const [name, value] of cookies) request.cookies.set(name, value);
  const response = NextResponse.next({ request: { headers: request.headers } });
  for (const [name, value] of cookies) {
    response.cookies.set(name, value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
