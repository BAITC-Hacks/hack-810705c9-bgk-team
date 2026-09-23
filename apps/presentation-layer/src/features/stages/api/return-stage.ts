import type { ReturnStageRequest, StageResponse } from '@/shared/api/contracts/stages';
import type { DemoActor } from '@/shared/api/demo-actor';
import { conflict, forbidden, notFound } from '@/shared/api/errors';
import { store, toApiStage } from '@/shared/api/store';
import { inMemoryTransaction } from '@/shared/db/transaction';

/** ADR-007 §5: return выполняет бизнес из claimed с обязательным комментарием. */
export async function returnStage(
  actor: DemoActor,
  stageId: string,
  request: ReturnStageRequest,
): Promise<StageResponse> {
  const stage = store.stages.get(stageId);
  if (!stage) throw notFound('Этап не найден.');
  const proposal = store.proposals.get(stage.proposalId);
  if (!proposal) throw notFound('Отклик не найден.');
  const task = store.tasks.get(proposal.taskId);
  if (!task) throw notFound('Задача не найдена.');
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Вернуть этап может только бизнес — владелец задачи.');
  }
  if (stage.status !== 'claimed') {
    throw conflict('Вернуть можно только сданный этап.', { status: stage.status });
  }

  return inMemoryTransaction(async () => {
    stage.status = 'returned';
    stage.businessComment = request.businessComment;
    return { stage: toApiStage(stage) };
  });
}
