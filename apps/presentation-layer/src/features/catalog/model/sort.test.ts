import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TaskTile } from '@/shared/api/contracts/task-match';
import { SEED_TASKS } from '@/shared/db/seed/task-match-seed';

import { compareCatalog, matchesCatalogFilters } from './sort';

const published = SEED_TASKS.filter((t) => t.status === 'published');

const tile = (patch: Partial<TaskTile>): TaskTile => ({
  ...published[0],
  ...patch,
});

describe('compareCatalog()', () => {
  it('сортирует seed по рейтингу по убыванию', () => {
    const scores = [...published].sort(compareCatalog).map((t) => t.score);
    assert.deepEqual(scores, [91, 77, 76, 64, 59, 58, 41, 27]);
  });

  it('при равном рейтинге раньше опубликованная выше, null в конце, затем id', () => {
    const list = [
      tile({ id: 'd', score: 50, publishedAt: null }),
      tile({ id: 'c', score: 50, publishedAt: '2026-09-22T00:00:00.000Z' }),
      tile({ id: 'b', score: 50, publishedAt: '2026-09-20T00:00:00.000Z' }),
      tile({ id: 'a', score: 50, publishedAt: '2026-09-22T00:00:00.000Z' }),
      tile({ id: 'e', score: 80, publishedAt: null }),
    ];
    assert.deepEqual(
      list.sort(compareCatalog).map((t) => t.id),
      ['e', 'b', 'a', 'c', 'd'],
    );
  });
});

describe('matchesCatalogFilters()', () => {
  const scores = (q: Parameters<typeof matchesCatalogFilters>[1]) =>
    published.filter((t) => matchesCatalogFilters(t, q)).map((t) => t.score).sort((a, b) => b - a);

  it('без фильтров показывает все опубликованные задачи', () => {
    assert.equal(scores({}).length, published.length);
  });

  it('фильтрует по уровню через диапазон рейтинга', () => {
    assert.deepEqual(scores({ level: 'priority' }), [91]);
    assert.deepEqual(scores({ level: 'ready' }), [77, 76]);
    assert.deepEqual(scores({ level: 'working' }), [64, 59, 58, 41]);
    assert.deepEqual(scores({ level: 'draft' }), [27]);
  });

  it('фильтрует по теме и роли', () => {
    assert.deepEqual(scores({ topic: 'logistics' }), [77, 27]);
    assert.deepEqual(scores({ role: 'frontend' }), [91, 76, 41]);
    assert.deepEqual(scores({ topic: 'logistics', role: 'bot' }), [77, 27]);
  });

  it('формат: задача both подходит под любой, фильтр both — под все', () => {
    assert.deepEqual(scores({ format: 'practice' }), [91, 76, 59, 58, 27]);
    assert.deepEqual(scores({ format: 'paid' }), [91, 77, 64, 59, 41, 27]);
    assert.equal(scores({ format: 'both' }).length, published.length);
  });
});
