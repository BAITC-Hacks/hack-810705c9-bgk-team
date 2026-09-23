// ADR-008: серверное чтение демо-участника. Только для server components,
// route handlers и server actions: `next/headers` недоступен в клиенте.
// Пакет `server-only` в зависимостях отсутствует, поэтому граница держится
// отдельным файлом, а чистая логика — в `demo-actor.ts`.

import { cookies } from "next/headers";

import {
  ACTOR_COOKIE,
  ROLE_COOKIE,
  VIEW_COOKIE,
  parseDemoActor,
  parseDemoView,
  requireDemoActorFrom,
  type DemoActor,
  type DemoView,
} from "./demo-actor";

/** Для страниц: мягкий разбор с участником по умолчанию (cookie ставит `proxy.ts`). */
export async function getDemoActor(): Promise<DemoActor> {
  const jar = await cookies();
  return parseDemoActor({
    role: jar.get(ROLE_COOKIE)?.value,
    actor: jar.get(ACTOR_COOKIE)?.value,
  });
}

/**
 * Для route handlers и server actions: без валидных cookie бросает
 * ForbiddenError («Выберите демо-роль»), чтобы curl без cookie получал 403.
 */
export async function requireDemoActor(): Promise<DemoActor> {
  const jar = await cookies();
  return requireDemoActorFrom({
    role: jar.get(ROLE_COOKIE)?.value,
    actor: jar.get(ACTOR_COOKIE)?.value,
  });
}

export async function getDemoView(): Promise<DemoView> {
  const jar = await cookies();
  return parseDemoView(jar.get(VIEW_COOKIE)?.value);
}
