import type { KickoffResponse } from '@/shared/api/contracts/proposals';
import type { DemoActor } from '@/shared/api/demo-actor';
import { businessError, forbidden, notFound } from '@/shared/api/errors';
import { store } from '@/shared/api/store';

/**
 * GET /api/proposals/:id/kickoff (FR-7.9, ADR-007 §3.4): снимок,
 * сохранённый при `accept`. Виден бизнесу-владельцу задачи и выбранной
 * команде.
 */
export function getKickoff(actor: DemoActor, proposalId: string): KickoffResponse {
  const proposal = store.proposals.get(proposalId);
  if (!proposal) throw notFound('Отклик не найден.');
  const task = store.tasks.get(proposal.taskId);
  if (!task) throw notFound('Задача не найдена.');

  const isOwnerBusiness = actor.role === 'business' && actor.businessId === task.businessId;
  const isOwnerTeam = actor.role === 'team' && actor.teamId === proposal.teamId;
  if (!isOwnerBusiness && !isOwnerTeam) {
    throw forbidden('Стартовый пакет виден только бизнесу-владельцу и выбранной команде.');
  }
  if (!proposal.kickoff) {
    throw businessError('Команда ещё не выбрана — стартовый пакет не собран.');
  }

  return { proposalId: proposal.id, ...proposal.kickoff };
}
