// ADR-006: отбор и порядок рекомендаций команды (FR-5.3, FR-5.4, FR-5.14, T-10).
import { fit, formatFitExplanation, type TeamProfile } from '@/entities/team';
import type {
  Engagement,
  RecommendationItem,
  TaskTile,
} from '@/shared/api/contracts/task-match';

export const MIN_SCORE = 40;
export const MIN_FIT = 0.5;

/** practice → practice|both, paid → paid|both, both → все. */
export function formatMatches(
  lookingFor: Engagement,
  taskEngagement: Engagement,
): boolean {
  return (
    lookingFor === 'both' ||
    taskEngagement === 'both' ||
    lookingFor === taskEngagement
  );
}

const roundScore = (value: number) => Math.round(value * 10_000) / 10_000;

/** Кандидаты уже отфильтрованы SQL, но условия FR-5.3 повторяются для надёжности. */
export function rankRecommendations(
  team: TeamProfile,
  candidates: TaskTile[],
): RecommendationItem[] {
  const items: RecommendationItem[] = [];
  for (const task of candidates) {
    if (task.score < MIN_SCORE) continue;
    if (task.neededRoles.length === 0) continue;
    if (!formatMatches(team.lookingFor, task.engagement)) continue;

    const result = fit(team, task);
    if (result.value < MIN_FIT) continue;

    items.push({
      task,
      fit: result,
      explanation: formatFitExplanation(result),
      rankScore: roundScore(0.7 * result.value + (0.3 * task.score) / 100),
    });
  }
  return items.sort(
    (a, b) =>
      b.rankScore - a.rankScore ||
      (a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0),
  );
}

export type GridSort = 'default' | 'fit' | 'score';

/** 'default' возвращает тот же массив, чтобы порядок сетки совпадал с колодой. */
export function sortGridItems(
  items: RecommendationItem[],
  mode: GridSort,
): RecommendationItem[] {
  if (mode === 'default') return items;
  const key =
    mode === 'fit'
      ? (item: RecommendationItem) => item.fit.value
      : (item: RecommendationItem) => item.task.score;
  // Array.prototype.sort стабилен: равные элементы сохраняют исходный порядок.
  return [...items].sort((a, b) => key(b) - key(a));
}

/** T-9: задача без нужных ролей не попадает в колоды. */
export function deckHint(task: Pick<TaskTile, 'neededRoles'>): string | null {
  return task.neededRoles.length === 0
    ? 'Укажите нужные роли: +3 и попадание в колоды'
    : null;
}
