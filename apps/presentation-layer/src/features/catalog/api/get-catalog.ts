// ADR-006 п. 5: каталог — все опубликованные задачи, без fit и без свайпов.
import { and, asc, between, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import { levelRange } from '@/entities/task/model/level';
import { openBlocksOf } from '@/features/task-card/api/open-blocks';
import { toTaskTile } from '@/entities/task/model/to-tile';
import type {
  CatalogQuery,
  CatalogResponse,
} from '@/shared/api/contracts/task-match';
import { db } from '@/shared/db';
import { tasks } from '@/shared/db/schema';

export async function getCatalog(
  filters: CatalogQuery,
): Promise<CatalogResponse> {
  const conditions: (SQL | undefined)[] = [eq(tasks.status, 'published')];
  if (filters.topic) conditions.push(eq(tasks.topic, filters.topic));
  if (filters.level) {
    const { min, max } = levelRange(filters.level);
    conditions.push(between(tasks.score, min, max));
  }
  if (filters.role) {
    conditions.push(sql`${filters.role} = ANY(${tasks.neededRoles})`);
  }
  if (filters.format && filters.format !== 'both') {
    conditions.push(
      or(eq(tasks.engagement, filters.format), eq(tasks.engagement, 'both')),
    );
  }

  // FR-4.4: зеркально compareCatalog — рейтинг ↓, дата публикации ↑, id.
  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(
      desc(tasks.score),
      sql`${tasks.publishedAt} ASC NULLS LAST`,
      asc(tasks.id),
    );

  const unknown = await openBlocksOf(rows.map((r) => r.id));
  return {
    items: rows.map((r) => toTaskTile(r, unknown.get(r.id) ?? [])),
  };
}
