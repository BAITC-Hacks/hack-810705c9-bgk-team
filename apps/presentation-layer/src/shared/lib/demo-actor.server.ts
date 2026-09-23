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
  type DemoActor,
  type DemoView,
} from "./demo-actor";

export async function getDemoActor(): Promise<DemoActor> {
  const jar = await cookies();
  return parseDemoActor({
    role: jar.get(ROLE_COOKIE)?.value,
    actor: jar.get(ACTOR_COOKIE)?.value,
  });
}

export async function getDemoView(): Promise<DemoView> {
  const jar = await cookies();
  return parseDemoView(jar.get(VIEW_COOKIE)?.value);
}
