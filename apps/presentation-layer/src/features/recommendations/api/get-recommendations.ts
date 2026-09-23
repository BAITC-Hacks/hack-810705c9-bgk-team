import type { RecommendationsResponse } from '@/shared/api/contracts/recommendations';
import { notFound } from '@/shared/api/errors';
import { store, toApiTask } from '@/shared/api/store';
import { fit, formatMatches } from '@/shared/api/store/fit';

/**
 * INTEGRATION(ADR-006 §2): getRecommendations(teamId) — один набор для
 * колоды и сетки, отсортированный `0.7·fit + 0.3·score/100` (FR-5.4),
 * `fit ≥ 0.5`, `score ≥ 40`, непустые needed_roles, формат подходит команде,
 * без свайпа `skip`. Реальный use-case отбирает кандидатов SQL-запросом;
 * здесь — фильтрация in-memory store тем же контрактом.
 */
export function getRecommendations(teamId: string): RecommendationsResponse {
  const team = store.teams.get(teamId);
  if (!team) throw notFound('Команда не найдена.');

  const skippedTaskIds = new Set(
    store.swipes.filter((s) => s.teamId === teamId && s.action === 'skip').map((s) => s.taskId),
  );

  const candidates = [...store.tasks.values()].filter(
    (task) =>
      task.status === 'published' &&
      task.neededRoles.length > 0 &&
      formatMatches(team.looksFor, task.format) &&
      !skippedTaskIds.has(task.id),
  );

  const scored = candidates
    .map((task) => {
      const apiTask = toApiTask(task);
      const matchDetails = fit(team, task);
      return {
        task: apiTask,
        fit: matchDetails,
        rankScore: 0.7 * matchDetails.value + 0.3 * (apiTask.score / 100),
      };
    })
    .filter((item) => item.fit.value >= 0.5 && item.task.score >= 40)
    .sort((a, b) => (b.rankScore !== a.rankScore ? b.rankScore - a.rankScore : a.task.id.localeCompare(b.task.id)));

  const catalogTotal = [...store.tasks.values()].filter((task) => task.status === 'published').length;

  return { items: scored, catalogRemainder: Math.max(0, catalogTotal - scored.length) };
}
