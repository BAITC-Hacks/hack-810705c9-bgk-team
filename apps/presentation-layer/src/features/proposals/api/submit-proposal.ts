import type { SubmitProposalRequest, SubmitProposalResponse } from '@/shared/api/contracts/proposals';
import type { DemoActor } from '@/shared/api/demo-actor';
import { businessError, forbidden, notFound } from '@/shared/api/errors';
import { createId, getTaskOrThrow, store, toApiProposal } from '@/shared/api/store';
import { fit } from '@/shared/api/store/fit';
import { inMemoryTransaction } from '@/shared/db/transaction';

/**
 * ADR-007 §2 (FR-6.1, FR-6.4, FR-4.8): один активный отклик команды на
 * задачу; отклик можно создать на задачу с любым рейтингом, но только в
 * статусе published/in_work. `fit` фиксируется при создании.
 */
export async function submitProposal(
  actor: DemoActor,
  taskId: string,
  request: SubmitProposalRequest,
): Promise<SubmitProposalResponse> {
  if (actor.role !== 'team' || actor.teamId !== request.teamId) {
    throw forbidden('Отправить отклик может только команда за саму себя.');
  }
  const task = getTaskOrThrow(taskId);
  if (task.status !== 'published' && task.status !== 'in_work') {
    throw businessError('Откликнуться можно только на опубликованную задачу.', {
      status: task.status,
    });
  }
  const team = store.teams.get(request.teamId);
  if (!team) throw notFound('Команда не найдена.');

  const hasActive = [...store.proposals.values()].some(
    (p) =>
      p.taskId === taskId &&
      p.teamId === request.teamId &&
      (p.status === 'submitted' || p.status === 'on_hold' || p.status === 'accepted'),
  );
  if (hasActive) {
    throw businessError('У команды уже есть активный отклик на эту задачу.');
  }

  return inMemoryTransaction(async () => {
    const id = createId('proposal');
    const proposal = {
      id,
      taskId,
      teamId: request.teamId,
      solution: request.solution,
      plan: request.plan,
      teamRoles: request.teamRoles,
      deadline: request.deadline,
      repoUrl: request.repoUrl,
      criteriaAnswers: request.criteriaAnswers,
      fit: fit(team, task).value,
      status: 'submitted' as const,
    };
    store.proposals.set(id, proposal);
    return { proposal: toApiProposal(proposal) };
  });
}
