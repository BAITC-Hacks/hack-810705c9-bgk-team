import type { ConfirmStageRequest, StageResponse } from '@/shared/api/contracts/stages';
import type { DemoActor } from '@/shared/api/demo-actor';
import { conflict, forbidden, notFound } from '@/shared/api/errors';
import { store, toApiStage } from '@/shared/api/store';
import { inMemoryTransaction } from '@/shared/db/transaction';

/**
 * ADR-007 §5 (FR-8.4): `UPDATE stage SET status='confirmed', points=10 …
 * WHERE status='claimed'`. Этап не может вернуться из confirmed, поэтому
 * повторный confirm -> 409, а +10 начисляется один раз без отдельного ledger.
 */
export async function confirmStage(
  actor: DemoActor,
  stageId: string,
  request: ConfirmStageRequest,
): Promise<StageResponse> {
  const stage = store.stages.get(stageId);
  if (!stage) throw notFound('Этап не найден.');
  const proposal = store.proposals.get(stage.proposalId);
  if (!proposal) throw notFound('Отклик не найден.');
  const task = store.tasks.get(proposal.taskId);
  if (!task) throw notFound('Задача не найдена.');
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Подтвердить этап может только бизнес — владелец задачи.');
  }
  if (stage.status !== 'claimed') {
    throw conflict('Подтвердить можно только сданный этап.', { status: stage.status });
  }

  return inMemoryTransaction(async () => {
    stage.status = 'confirmed';
    stage.points = 10;
    stage.businessComment = request.businessComment ?? stage.businessComment;
    stage.confirmedAt = new Date().toISOString();
    return { stage: toApiStage(stage) };
  });
}
