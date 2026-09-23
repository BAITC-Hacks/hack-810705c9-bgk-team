import type { UpdateTaskRequest, UpdateTaskResponse } from '@/shared/api/contracts/tasks';
import type { DemoActor } from '@/shared/api/demo-actor';
import { forbidden, validationError } from '@/shared/api/errors';
import { getTaskOrThrow, toApiTask } from '@/shared/api/store';
import { inMemoryTransaction } from '@/shared/db/transaction';

/**
 * PATCH /api/tasks/:id (ADR-009 §6, FR-1.1/FR-2.7/T-7): формат работы,
 * условия оплаты, роли и навыки. Меняет `task`, а не `task_field`, поэтому
 * пересчёт рейтинга не затрагивается (FR-3.9, T-7).
 *
 * FR-1.1: как и при создании (`createTaskRequestSchema`), формат отличный
 * от «практики» требует условий оплаты — здесь это бизнес-правило поверх
 * итогового состояния задачи (новый формат + новые/существующие условия),
 * а не схема запроса, потому что зависит от уже сохранённого значения.
 */
export async function updateTask(
  actor: DemoActor,
  taskId: string,
  request: UpdateTaskRequest,
): Promise<UpdateTaskResponse> {
  const task = getTaskOrThrow(taskId);
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Редактировать задачу может только бизнес — владелец задачи.');
  }

  return inMemoryTransaction(() => {
    const nextFormat = request.format ?? task.format;
    const nextPaymentTerms = request.paymentTerms !== undefined ? request.paymentTerms : task.paymentTerms;
    if (nextFormat !== 'practice' && !(nextPaymentTerms ?? '').trim()) {
      throw validationError('Для подработки нужно указать условия оплаты.', {
        field: 'paymentTerms',
      });
    }

    if (request.format !== undefined) task.format = request.format;
    if (request.paymentTerms !== undefined) task.paymentTerms = request.paymentTerms;
    if (request.neededRoles !== undefined) {
      task.neededRoles = request.neededRoles;
      task.tagsState = 'suggested';
    }
    if (request.neededSkills !== undefined) {
      task.neededSkills = request.neededSkills;
      task.tagsState = 'suggested';
    }
    return { task: toApiTask(task) };
  });
}
