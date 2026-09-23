// ADR-008: демо-роль и участник из cookie, проверки владения для use-case.
// Модуль чистый: без next/headers, импортируется в тестах и клиентском коде.
// Чтение cookie запроса — в `demo-actor.server.ts`.
//
// Это НЕ аутентификация: cookie можно подделать. Проверки защищают сценарий
// от ошибок UI, а не от злоумышленника. Только локальное демо.

import {
  DEFAULT_DEMO_BUSINESS,
  DEFAULT_DEMO_TEAM,
  DEMO_BUSINESSES,
  DEMO_TEAMS,
} from "@/shared/config/demo-actors";

export const ROLE_COOKIE = "tm_role";
export const ACTOR_COOKIE = "tm_actor";
export const VIEW_COOKIE = "tm_view";

export const DEMO_ROLES = ["business", "team"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const DEMO_VIEWS = ["deck", "grid"] as const;
export type DemoView = (typeof DEMO_VIEWS)[number];
export const DEFAULT_DEMO_VIEW: DemoView = "deck";

export type DemoActor =
  | { role: "business"; businessId: string }
  | { role: "team"; teamId: string };

export type DemoCookieValues = {
  role?: string | null;
  actor?: string | null;
};

export const DEFAULT_DEMO_ACTOR: DemoActor = {
  role: "business",
  businessId: DEFAULT_DEMO_BUSINESS.id,
};

export function isDemoRole(value: unknown): value is DemoRole {
  return DEMO_ROLES.includes(value as DemoRole);
}

export function isDemoView(value: unknown): value is DemoView {
  return DEMO_VIEWS.includes(value as DemoView);
}

export function isDemoBusinessId(id: unknown): id is string {
  return DEMO_BUSINESSES.some((business) => business.id === id);
}

export function isDemoTeamId(id: unknown): id is string {
  return DEMO_TEAMS.some((team) => team.id === id);
}

/** Собирает участника из пары значений; `null`, если пара не из seed-списка. */
export function toDemoActor(role: unknown, actorId: unknown): DemoActor | null {
  if (role === "business" && isDemoBusinessId(actorId)) {
    return { role, businessId: actorId };
  }
  if (role === "team" && isDemoTeamId(actorId)) {
    return { role, teamId: actorId };
  }
  return null;
}

/**
 * Строгий разбор cookie `tm_role` / `tm_actor` для API и use-case:
 * `null`, если роли нет, она неизвестна или id не из seed-списка этой роли.
 */
export function resolveDemoActor(values: DemoCookieValues): DemoActor | null {
  return toDemoActor(values.role, values.actor);
}

/** Строгий вариант для API: без валидной пары cookie — 403, без подстановки по умолчанию. */
export function requireDemoActorFrom(values: DemoCookieValues): DemoActor {
  const actor = resolveDemoActor(values);
  if (!actor) throw new ForbiddenError("Выберите демо-роль");
  return actor;
}

/**
 * Мягкий разбор для страниц и proxy: неизвестный участник заменяется первым
 * из seed для указанной роли; без валидной роли — первый демо-бизнес.
 */
export function parseDemoActor(values: DemoCookieValues): DemoActor {
  const exact = resolveDemoActor(values);
  if (exact) return exact;
  if (values.role === "team") return { role: "team", teamId: DEFAULT_DEMO_TEAM.id };
  return DEFAULT_DEMO_ACTOR;
}

export function parseDemoView(value: string | null | undefined): DemoView {
  return isDemoView(value) ? value : DEFAULT_DEMO_VIEW;
}

export function demoActorId(actor: DemoActor): string {
  return actor.role === "business" ? actor.businessId : actor.teamId;
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Действие недоступно для текущей демо-роли") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertRole<R extends DemoRole>(
  actor: DemoActor,
  role: R,
): asserts actor is Extract<DemoActor, { role: R }> {
  if (actor.role !== role) {
    throw new ForbiddenError(
      role === "business" ? "Действие доступно только бизнесу" : "Действие доступно только команде",
    );
  }
}

/** Правка, публикация, решения по откликам, закрытие, `confirm` и `return` этапа. */
export function assertTaskOwner(
  actor: DemoActor,
  task: { businessId: string },
): asserts actor is Extract<DemoActor, { role: "business" }> {
  assertRole(actor, "business");
  if (actor.businessId !== task.businessId) {
    throw new ForbiddenError("Это задача другого бизнеса");
  }
}

/** Правка отклика и `claim` этапа. */
export function assertProposalOwner(
  actor: DemoActor,
  proposal: { teamId: string },
): asserts actor is Extract<DemoActor, { role: "team" }> {
  assertRole(actor, "team");
  if (actor.teamId !== proposal.teamId) {
    throw new ForbiddenError("Это отклик другой команды");
  }
}

/**
 * Для route handler: ForbiddenError → 403 в формате ADR-009
 * `{ error: { code, message } }`; прочие ошибки → `null`, их обрабатывает вызывающий.
 */
export function forbiddenResponse(error: unknown): Response | null {
  if (!(error instanceof ForbiddenError)) return null;
  return Response.json(
    { error: { code: "forbidden", message: error.message } },
    { status: 403 },
  );
}
