import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { businesses } from "@/shared/db/schema";
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
  const onboarded = await onboardingBusiness();
  if (onboarded) return onboarded;
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
  const onboarded = await onboardingBusiness();
  if (onboarded) return onboarded;
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

// Onboarded business IDs are DB-backed demo identities, not authentication.
// Require matching role/actor cookies so stale profiles cannot change ownership.
async function onboardingBusiness(): Promise<DemoActor | null> {
  const jar = await cookies();
  if (jar.get(ROLE_COOKIE)?.value !== "business") return null;
  try {
    const session = JSON.parse(jar.get("task-match-session")?.value ?? "null");
    if (session?.role !== "business" || !session.onboardingCompleted || typeof session.businessId !== "string" || session.businessId !== jar.get(ACTOR_COOKIE)?.value) return null;
    const [business] = await db.select({id:businesses.id}).from(businesses).where(eq(businesses.id,session.businessId)).limit(1);
    return business ? {role:"business",businessId:business.id} : null;
  } catch { return null; }
}
