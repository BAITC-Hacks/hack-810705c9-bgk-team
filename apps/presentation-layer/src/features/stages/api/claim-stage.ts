import type { ClaimStageRequest, StageResponse } from '@/shared/api/contracts/stages';
import type { DemoActor } from '@/shared/api/demo-actor';
import { conflict, forbidden, notFound } from '@/shared/api/errors';
import { store, toApiStage } from '@/shared/api/store';
import { inMemoryTransaction } from '@/shared/db/transaction';

/**
 * ADR-007 §5: claim выполняет команда-владелец отклика из open|returned.
 * Статус — первая строка внутри транзакции (условный `UPDATE ... WHERE
 * status IN ('open','returned')` при переносе на Drizzle).
 */
export async function claimStage(
  actor: DemoActor,
  stageId: string,
  request: ClaimStageRequest,
): Promise<StageResponse> {
  const stage = store.stages.get(stageId);
  if (!stage) throw notFound('Этап не найден.');
  const proposal = store.proposals.get(stage.proposalId);
  if (!proposal) throw notFound('Отклик не найден.');
  if (actor.role !== 'team' || actor.teamId !== proposal.teamId) {
    throw forbidden('Сдать этап может только команда, чей отклик выбран.');
  }

  return inMemoryTransaction(() => {
    if (stage.status !== 'open' && stage.status !== 'returned') {
      throw conflict('Этап нельзя сдать в текущем статусе.', { status: stage.status });
    }
    stage.status = 'claimed';
    stage.reportUrl = request.reportUrl;
    stage.teamComment = request.teamComment;
    return { stage: toApiStage(stage) };
  });
}
