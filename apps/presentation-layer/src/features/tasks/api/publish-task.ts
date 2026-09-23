import type { PublishTaskResponse } from '@/shared/api/contracts/tasks';
import type { DemoActor } from '@/shared/api/demo-actor';
import { businessError, forbidden } from '@/shared/api/errors';
import { getTaskOrThrow, toApiTask } from '@/shared/api/store';
import { inMemoryTransaction } from '@/shared/db/transaction';

/**
 * POST /api/tasks/:id/publish (FR-4.1, FR-4.2): публикация разрешена при
 * любом рейтинге; неподтверждённые поля не публикуются (уже гарантировано
 * тем, что score() и каталог читают только confirmed-поля).
 */
export async function publishTask(actor: DemoActor, taskId: string): Promise<PublishTaskResponse> {
  const task = getTaskOrThrow(taskId);
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Опубликовать задачу может только бизнес — владелец задачи.');
  }
  if (task.status !== 'draft') {
    throw businessError('Опубликовать можно только черновик задачи.', { status: task.status });
  }

  return inMemoryTransaction(async () => {
    task.status = 'published';
    task.publishedAt = new Date().toISOString();
    return { task: toApiTask(task) };
  });
}
