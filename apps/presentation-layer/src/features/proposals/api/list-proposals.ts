import type { ListProposalsResponse } from '@/shared/api/contracts/proposals';
import type { DemoActor } from '@/shared/api/demo-actor';
import { forbidden } from '@/shared/api/errors';
import { getTaskOrThrow, store, toApiProposal } from '@/shared/api/store';

/**
 * GET /api/tasks/:id/proposals (ADR-007 §7): список по fit, метка
 * «совпадает частично» при fit < 0.5 (в ответе — поле `partialMatch`),
 * матрица `criteria × proposals`.
 */
export function listProposals(actor: DemoActor, taskId: string): ListProposalsResponse {
  const task = getTaskOrThrow(taskId);
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Список откликов видит только бизнес — владелец задачи.');
  }

  const proposals = [...store.proposals.values()]
    .filter((p) => p.taskId === taskId)
    .sort((a, b) => b.fit - a.fit);

  const comparison = task.criteria.map((criterion) => ({
    criterionId: criterion.id,
    metric: criterion.metric,
    byTeam: Object.fromEntries(
      proposals.map((p) => [
        p.teamId,
        p.criteriaAnswers.find((a) => a.criterionId === criterion.id)?.howWeWillCheck ?? '',
      ]),
    ),
  }));

  return { proposals: proposals.map(toApiProposal), comparison };
}
