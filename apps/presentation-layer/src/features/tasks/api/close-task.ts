import type { CloseTaskResponse } from '@/shared/api/contracts/tasks';
import type { DemoActor } from '@/shared/api/demo-actor';
import { businessError, forbidden } from '@/shared/api/errors';
import { getTaskOrThrow, store, toApiTask } from '@/shared/api/store';
import { inMemoryTransaction } from '@/shared/db/transaction';

/**
 * INTEGRATION(ADR-007 §4): POST /api/tasks/:id/close — разрешено при
 * status=published и отсутствии accepted-отклика. В одной транзакции задача
 * закрывается, а submitted/on_hold отклики становятся rejected с причиной
 * `task_closed` (T-17). Полный use-case вместе с proposal — у владельца
 * ADR-007; здесь минимальная демонстрация для того же контракта.
 */
export async function closeTask(actor: DemoActor, taskId: string): Promise<CloseTaskResponse> {
  const task = getTaskOrThrow(taskId);
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Закрыть задачу может только бизнес — владелец задачи.');
  }
  if (task.status !== 'published') {
    throw businessError('Закрыть без выбора можно только опубликованную задачу.', {
      status: task.status,
    });
  }
  const hasAccepted = [...store.proposals.values()].some(
    (proposal) => proposal.taskId === taskId && proposal.status === 'accepted',
  );
  if (hasAccepted) {
    throw businessError('Нельзя закрыть задачу без выбора: команда уже выбрана.');
  }

  return inMemoryTransaction(async () => {
    task.status = 'closed';
    for (const proposal of store.proposals.values()) {
      if (proposal.taskId === taskId && (proposal.status === 'submitted' || proposal.status === 'on_hold')) {
        proposal.status = 'rejected';
        proposal.rejectReason = 'other';
        proposal.rejectNote = 'task_closed';
        proposal.decidedAt = new Date().toISOString();
      }
    }
    return { task: toApiTask(task) };
  });
}
