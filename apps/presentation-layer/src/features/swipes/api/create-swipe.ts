import type { CreateSwipeRequest, CreateSwipeResponse } from '@/shared/api/contracts/swipes';
import type { DemoActor } from '@/shared/api/demo-actor';
import { forbidden, notFound } from '@/shared/api/errors';
import { getTaskOrThrow, store } from '@/shared/api/store';
import { inMemoryTransaction } from '@/shared/db/transaction';

/**
 * ADR-006 §4: swipe(team_id, task_id, action, block?, note?). `skip`
 * исключает задачу из рекомендаций команды; `missing` не меняет `task` и не
 * вызывает пересчёт рейтинга (FR-5.8, T-11, T-20).
 */
export async function createSwipe(
  actor: DemoActor,
  request: CreateSwipeRequest,
): Promise<CreateSwipeResponse> {
  if (actor.role !== 'team' || actor.teamId !== request.teamId) {
    throw forbidden('Свайпать может только команда за саму себя.');
  }
  getTaskOrThrow(request.taskId);
  if (!store.teams.has(request.teamId)) throw notFound('Команда не найдена.');

  return inMemoryTransaction(async () => {
    store.swipes.push({
      teamId: request.teamId,
      taskId: request.taskId,
      action: request.action,
      block: request.block,
      note: request.note,
      at: new Date().toISOString(),
    });
    return { teamId: request.teamId, taskId: request.taskId, action: request.action };
  });
}
