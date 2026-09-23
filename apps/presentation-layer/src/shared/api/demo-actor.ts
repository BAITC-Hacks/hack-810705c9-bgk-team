import type { NextRequest } from 'next/server';

/**
 * INTEGRATION(ADR-008): временная заглушка демо-ролей.
 * ADR-008 определяет три httpOnly cookie (`tm_role`, `tm_actor`, `tm_view`),
 * server action переключателя в шапке и полную матрицу видимости данных.
 * Пока владелец ADR-008 не подключил свою реализацию, читаем те же имена
 * cookie (и заголовок `x-demo-role`/`x-demo-actor` для curl/тестов) с
 * значениями по умолчанию, чтобы контракт use-case (`actor` обязателен)
 * не менялся при интеграции.
 *
 * Route handler передаёт свой `request` (`NextRequest.cookies`/`.headers` не
 * требуют контекста рендера Next и поэтому вызываются напрямую в тестах,
 * см. ADR-009 §8 п.5–7). Серверные компоненты вызывают без аргумента и
 * читают `next/headers` динамическим импортом — тот путь работает только
 * внутри рендера Next и не подходит для юнит-тестов route handlers.
 */

export type DemoRole = 'business' | 'team';

export type DemoActor = {
  role: DemoRole;
  businessId?: string;
  teamId?: string;
};

const DEFAULT_BUSINESS_ID = 'business-demo';
const DEFAULT_TEAM_ID = 'team-demo';

function resolveActor(
  role: string | null | undefined,
  actorId: string | null | undefined,
): DemoActor {
  const resolvedRole: DemoRole = role === 'team' ? 'team' : 'business';
  const resolvedActorId =
    actorId ?? (resolvedRole === 'business' ? DEFAULT_BUSINESS_ID : DEFAULT_TEAM_ID);
  return resolvedRole === 'team'
    ? { role: 'team', teamId: resolvedActorId }
    : { role: 'business', businessId: resolvedActorId };
}

export async function getDemoActor(request?: NextRequest): Promise<DemoActor> {
  if (request) {
    return resolveActor(
      request.cookies.get('tm_role')?.value ?? request.headers.get('x-demo-role'),
      request.cookies.get('tm_actor')?.value ?? request.headers.get('x-demo-actor'),
    );
  }

  // Серверные компоненты (без запроса под рукой): `next/headers` работает
  // только внутри рендера Next, поэтому импортируем динамически, чтобы не
  // тянуть его в модули, которые тестируются вне этого контекста.
  const { cookies, headers } = await import('next/headers');
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveActor(
    cookieStore.get('tm_role')?.value ?? headerStore.get('x-demo-role'),
    cookieStore.get('tm_actor')?.value ?? headerStore.get('x-demo-actor'),
  );
}
