"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  ACTOR_COOKIE,
  ROLE_COOKIE,
  VIEW_COOKIE,
  demoActorId,
  isDemoView,
  toDemoActor,
  type DemoView,
} from "@/shared/lib/demo-actor";

export type SwitchDemoRoleInput = {
  role: string;
  actorId: string;
  view?: string;
};

export type SwitchDemoRoleResult = { ok: true } | { ok: false; error: string };

const YEAR = 60 * 60 * 24 * 365;

/**
 * ADR-008 п. 1: переключатель в шапке. Принимает только участников из seed.
 * `tm_role` / `tm_actor` — httpOnly: клиентский код их не читает, роль приходит
 * с сервера. `tm_view` без httpOnly, как в ADR-006 (`setViewMode`): вид не
 * влияет на доступ, и клиент может читать его без запроса к серверу.
 * Подделать cookie всё равно можно — это демо без аутентификации.
 */
export async function switchDemoRole(input: SwitchDemoRoleInput): Promise<SwitchDemoRoleResult> {
  const actor = toDemoActor(input.role, input.actorId);
  if (!actor) return { ok: false, error: "Неизвестная роль или участник демо" };
  if (input.view !== undefined && !isDemoView(input.view)) {
    return { ok: false, error: "Неизвестный вид: ожидается deck или grid" };
  }

  const jar = await cookies();
  const base = { path: "/", sameSite: "lax", maxAge: YEAR } as const;
  jar.set(ROLE_COOKIE, actor.role, { ...base, httpOnly: true });
  jar.set(ACTOR_COOKIE, demoActorId(actor), { ...base, httpOnly: true });
  if (input.view) jar.set(VIEW_COOKIE, input.view satisfies DemoView, base);

  revalidatePath("/", "layout");
  return { ok: true };
}
