// ADR-006: порядок и фильтры каталога (FR-4.4, FR-4.5). Сервер делает то же в SQL.
import { levelRange } from '@/entities/task/model/level';
import type { CatalogQuery, TaskTile } from '@/shared/api/contracts/task-match';

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Рейтинг по убыванию, затем раньше опубликованные (null в конце), затем id. */
export function compareCatalog(a: TaskTile, b: TaskTile): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.publishedAt !== b.publishedAt) {
    if (a.publishedAt === null) return 1;
    if (b.publishedAt === null) return -1;
    const diff = Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
    if (diff) return diff;
  }
  return compareText(a.id, b.id);
}

export function matchesCatalogFilters(t: TaskTile, q: CatalogQuery): boolean {
  if (q.topic && t.topic !== q.topic) return false;
  if (q.level) {
    const { min, max } = levelRange(q.level);
    if (t.score < min || t.score > max) return false;
  }
  if (q.role && !t.neededRoles.includes(q.role)) return false;
  if (
    q.format &&
    q.format !== 'both' &&
    t.engagement !== 'both' &&
    t.engagement !== q.format
  )
    return false;
  return true;
}
