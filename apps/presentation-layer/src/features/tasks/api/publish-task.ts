import type { PublishTaskResponse } from '@/shared/api/contracts/tasks';
import type { DemoActor } from '@/shared/api/demo-actor';
import { conflict, forbidden } from '@/shared/api/errors';
import { getTaskOrThrow, toApiTask } from '@/shared/api/store';
import { inMemoryTransaction } from '@/shared/db/transaction';

/**
 * POST /api/tasks/:id/publish (FR-4.1, FR-4.2): публикация разрешена при
 * любом рейтинге. Неподтверждённые поля не публикуются — это обеспечивает
 * `toPublicTask()` (`shared/api/store/index.ts`), которым каталог и
 * рекомендации отдают задачу: он фильтрует поля до `confirmed`, а не
 * просто не начисляет за них баллы.
 *
 * `status !== 'draft'` — недопустимый переход состояния (ADR раздел 9.2:
 * `draft → published → in_work → closed`), поэтому 409, не 422; проверка —
 * первая строка внутри транзакции (см. `shared/db/transaction.ts`), чтобы
 * при переносе на Drizzle стать условным `UPDATE ... WHERE status='draft'`.
 */
export async function publishTask(actor: DemoActor, taskId: string): Promise<PublishTaskResponse> {
  const task = getTaskOrThrow(taskId);
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Опубликовать задачу может только бизнес — владелец задачи.');
  }

  return inMemoryTransaction(() => {
    if (task.status !== 'draft') {
      throw conflict('Опубликовать можно только черновик задачи.', { status: task.status });
    }
    task.status = 'published';
    task.publishedAt = new Date().toISOString();
    return { task: toApiTask(task) };
  });
}
