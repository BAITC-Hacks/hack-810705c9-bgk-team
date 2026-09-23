import type { DecisionRequest, DecisionResponse } from '@/shared/api/contracts/proposals';
import type { DemoActor } from '@/shared/api/demo-actor';
import { conflict, forbidden, notFound } from '@/shared/api/errors';
import { createId, store, toApiProposal } from '@/shared/api/store';
import { inMemoryTransaction } from '@/shared/db/transaction';

/**
 * ADR-007 §3: decideProposal(id, action, reason?) — условное обновление
 * `WHERE status IN ('submitted','on_hold')`; 0 затронутых строк -> 409.
 * `reject` без причины уже отклонён zod-схемой (422, T-16). `accept` в одной
 * транзакции: proposal.accepted, task → in_work, kickoff, создание stage на
 * каждый подтверждённый критерий (ADR-007 §3.4). Полная версия — у владельца
 * ADR-007; здесь — минимальная демонстрация контракта решения бизнеса.
 */
export async function decideProposal(
  actor: DemoActor,
  proposalId: string,
  request: DecisionRequest,
): Promise<DecisionResponse> {
  const proposal = store.proposals.get(proposalId);
  if (!proposal) throw notFound('Отклик не найден.');
  const task = store.tasks.get(proposal.taskId);
  if (!task) throw notFound('Задача не найдена.');
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Решение по отклику принимает только бизнес — владелец задачи.');
  }

  if (request.action === 'accept' || request.action === 'reject') {
    if (proposal.status !== 'submitted' && proposal.status !== 'on_hold') {
      throw conflict('Решение уже принято или отклик в неподходящем статусе.', {
        status: proposal.status,
      });
    }
  } else if (request.action === 'hold') {
    if (proposal.status !== 'submitted') {
      throw conflict('Отложить можно только новый отклик.', { status: proposal.status });
    }
  }

  return inMemoryTransaction(async () => {
    if (request.action === 'reject') {
      proposal.status = 'rejected';
      proposal.rejectReason = request.reason;
      proposal.rejectNote = request.note;
      proposal.decidedAt = new Date().toISOString();
    } else if (request.action === 'hold') {
      proposal.status = 'on_hold';
    } else {
      proposal.status = 'accepted';
      proposal.decidedAt = new Date().toISOString();
      if (task.status === 'published') task.status = 'in_work';

      const confirmedCriteria = task.criteria.filter((c) => c.state === 'confirmed');
      const kickoff = {
        materials: [task.draftText].filter(Boolean),
        stack: task.neededSkills,
        consultations: task.fields.get('link.cadence')?.value,
        deadline: proposal.deadline,
        paymentOrPracticeNote:
          task.format === 'practice'
            ? 'Практика: команда получает отзыв и запись в портфолио.'
            : `Условия оплаты: ${task.paymentTerms ?? 'уточняются'}`,
        firstStage: confirmedCriteria[0]
          ? {
              criterionId: confirmedCriteria[0].id,
              metric: confirmedCriteria[0].metric,
              howToCheck: confirmedCriteria[0].howToCheck,
            }
          : null,
      };
      proposal.kickoff = kickoff;

      for (const criterion of confirmedCriteria) {
        const stageId = createId('stage');
        store.stages.set(stageId, {
          id: stageId,
          proposalId: proposal.id,
          criterionId: criterion.id,
          criteriaVersion: task.criteriaVersion,
          metric: criterion.metric,
          threshold: criterion.threshold,
          howToCheck: criterion.howToCheck,
          status: 'open',
          points: 0,
        });
      }
    }

    return { proposal: toApiProposal(proposal) };
  });
}
