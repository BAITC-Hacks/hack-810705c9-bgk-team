// Минимальный локальный вариант levelOf из ADR-005 (раздел 6.2).
// При интеграции заменить реэкспортом из реализации ADR-005.
import type { Level } from '@/shared/api/contracts/task-match';

export function levelOf(score: number): Level {
  if (score >= 90) return 'priority';
  if (score >= 70) return 'ready';
  if (score >= 40) return 'working';
  return 'draft';
}

/** Диапазон `task.score` для фильтра каталога по уровню (FR-4.5). */
export const LEVEL_RANGES: Record<Level, readonly [number, number]> = {
  draft: [0, 39],
  working: [40, 69],
  ready: [70, 89],
  priority: [90, 100],
};

export const LEVEL_LABELS: Record<Level, string> = {
  draft: 'Черновик',
  working: 'Рабочая',
  ready: 'Готовая',
  priority: 'Приоритетная',
};

/** Метки каталога FR-4.6. */
export function catalogBadge(score: number): string | null {
  const level = levelOf(score);
  if (level === 'draft') return 'Требует уточнения';
  if (level === 'priority') return 'Полностью готова';
  return null;
}
