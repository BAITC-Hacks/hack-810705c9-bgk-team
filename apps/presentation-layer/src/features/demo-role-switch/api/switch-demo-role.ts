"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getSession, setSessionCookie } from "@/server/workspace/http";
import { resolveSession } from "@/server/workspace/service";

import {
  VIEW_COOKIE,
  DEMO_ROLES,
  DEMO_VIEWS,
  toDemoActor,
} from "@/shared/lib/demo-actor";

const inputSchema = z.object({
  role: z.enum(DEMO_ROLES),
  actorId: z.string().min(1).max(64),
  view: z.enum(DEMO_VIEWS).optional(),
});

export type SwitchDemoRoleInput = z.input<typeof inputSchema>;

export type SwitchDemoRoleResult = { ok: true } | { ok: false; error: string };

const YEAR = 60 * 60 * 24 * 365;

/**
 * ADR-008 п. 1: переключатель в шапке. Принимает только участников из seed.
 * `tm_role` / `tm_actor` — httpOnly: клиентский код их не читает, роль приходит
 * с сервера. `tm_view` без httpOnly, как в ADR-006 (`setViewMode`): вид не
 * влияет на доступ, и клиент может читать его без запроса к серверу.
 * Подделать cookie всё равно можно — это демо без аутентификации.
 */
export async function switchDemoRole(raw: unknown): Promise<SwitchDemoRoleResult> {
  // Server action — публичный POST-эндпоинт: вход проверяется, а не доверяется типам.
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Некорректные параметры демо-роли" };
  const input = parsed.data;
  const actor = toDemoActor(input.role, input.actorId);
  if (!actor) return { ok: false, error: "Неизвестный участник демо для этой роли" };

  // Both product surfaces must act as the explicitly selected demo identity.
  const current = await getSession();
  const session = await resolveSession(actor.role === "business"
    ? { ...current, role: "business", businessId: actor.businessId }
    : { ...current, role: "student", teamId: actor.teamId });
  if (!session.onboardingCompleted) return { ok: false, error: "Профиль пока недоступен. Выберите другого участника." };
  await setSessionCookie(session);

  const jar = await cookies();
  const base = { path: "/", sameSite: "lax", maxAge: YEAR } as const;
  if (input.view) jar.set(VIEW_COOKIE, input.view, base);

  revalidatePath("/", "layout");
  return { ok: true };
}
