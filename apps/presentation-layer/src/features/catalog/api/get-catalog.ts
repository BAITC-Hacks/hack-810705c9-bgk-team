import type { CatalogQuery, CatalogResponse } from '@/shared/api/contracts/catalog';
import { store, toPublicTask } from '@/shared/api/store';
import { calculateScore, levelForScore, missingNodes } from '@/shared/api/store/scoring';

/**
 * INTEGRATION(ADR-006 §5): getCatalog(filters) — отдельный запрос без fit и
 * без учёта свайпов. Полная версия читает `nextjs_db` напрямую (SQL-сортировка
 * FR-4.4, фильтры FR-4.5); эта — фильтрует in-memory store тем же контрактом,
 * чтобы серверные компоненты и `GET /api/catalog` могли использовать одну
 * функцию (ADR-009 §2) уже сейчас.
 */
export function getCatalog(query: CatalogQuery): CatalogResponse {
  const items = [...store.tasks.values()]
    .filter((task) => task.status === 'published' || task.status === 'in_work' || task.status === 'closed')
    .filter((task) => !query.topic || task.topic === query.topic)
    .filter((task) => !query.role || task.neededRoles.includes(query.role))
    .filter((task) => !query.format || task.format === query.format || task.format === 'both')
    .map((task) => {
      const score = calculateScore(task);
      return { task, score, level: levelForScore(score) };
    })
    .filter(({ level }) => !query.level || level === query.level)
    // FR-4.4: рейтинг по убыванию, при равенстве — дата публикации.
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.task.publishedAt ?? '').localeCompare(b.task.publishedAt ?? '');
    })
    .map(({ task, score }) => ({
      // ADR-008 §3: каталог/рекомендации видит и команда — только
      // подтверждённые поля, без draftText/businessId (toPublicTask).
      task: toPublicTask(task),
      label:
        score <= 39
          ? ('needs_clarification' as const)
          : score >= 90
            ? ('fully_ready' as const)
            : undefined,
      unknown: missingNodes(task),
    }));

  return { items };
}
