import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RecommendationItem } from '@/shared/api/contracts/task-match';
import {
  SEED_TASK_IDS,
  SEED_TASKS,
  SEED_TEAMS,
} from '@/shared/db/seed/task-match-seed';

import {
  MIN_FIT,
  deckHint,
  formatMatches,
  rankRecommendations,
  sortGridItems,
} from './rank';

const published = SEED_TASKS.filter((t) => t.status === 'published');
const team = (name: string) => SEED_TEAMS.find((t) => t.name === name)!;
const byId = (id: string) => SEED_TASKS.find((t) => t.id === id)!;
const recommend = (name: string) => rankRecommendations(team(name), published);

describe('rankRecommendations()', () => {
  it('T-8: задача с рейтингом 27 не попадает ни в одну колоду', () => {
    const low = byId(SEED_TASK_IDS.warehouseBot);
    assert.equal(low.score, 27);
    for (const t of SEED_TEAMS) {
      const ids = rankRecommendations(t, published).map((i) => i.task.id);
      assert.ok(!ids.includes(low.id), t.name);
    }
  });

  it('T-9: задача без нужных ролей не попадает в колоды, бизнес видит подсказку', () => {
    const noRoles = byId(SEED_TASK_IDS.returnsAccounting);
    assert.ok(noRoles.score >= 40);
    for (const t of SEED_TEAMS) {
      const ids = rankRecommendations(t, published).map((i) => i.task.id);
      assert.ok(!ids.includes(noRoles.id), t.name);
    }
    assert.equal(
      deckHint(noRoles),
      'Укажите нужные роли: +3 и попадание в колоды',
    );
    assert.equal(deckHint(byId(SEED_TASK_IDS.deliveryBot)), null);
  });

  it('T-10: команда practice видит только practice и both', () => {
    for (const name of ['DataBrew', 'QAstra']) {
      const items = recommend(name);
      assert.ok(items.length > 0, name);
      for (const i of items) assert.notEqual(i.task.engagement, 'paid', name);
    }
    const engagements = new Set(recommend('DataBrew').map((i) => i.task.engagement));
    assert.deepEqual([...engagements].sort(), ['both', 'practice']);

    // Подработка QAstra подходит по совпадению, но исключена форматом.
    const paid = byId(SEED_TASK_IDS.bookingApiTests);
    assert.equal(paid.engagement, 'paid');
    const qa = team('QAstra');
    assert.equal(rankRecommendations({ ...qa, lookingFor: 'both' }, [paid]).length, 1);
    assert.equal(rankRecommendations(qa, [paid]).length, 0);
  });

  it('T-10: команда both может получить любой формат', () => {
    const engagements = recommend('PixelUX').map((i) => i.task.engagement);
    assert.ok(engagements.includes('paid'));
    assert.ok(engagements.includes('both'));
  });

  it('formatMatches соответствует таблице форматов', () => {
    assert.equal(formatMatches('practice', 'practice'), true);
    assert.equal(formatMatches('practice', 'both'), true);
    assert.equal(formatMatches('practice', 'paid'), false);
    assert.equal(formatMatches('paid', 'paid'), true);
    assert.equal(formatMatches('paid', 'both'), true);
    assert.equal(formatMatches('paid', 'practice'), false);
    assert.equal(formatMatches('both', 'paid'), true);
    assert.equal(formatMatches('both', 'practice'), true);
  });

  it('BotForge первой видит эталонную задачу с 92 %', () => {
    const [first] = recommend('BotForge');
    assert.equal(first.task.id, SEED_TASK_IDS.deliveryBot);
    assert.match(first.explanation, /^92%/);
    assert.equal(first.rankScore, Math.round((0.7 * 0.925 + 0.3 * 0.77) * 1e4) / 1e4);
  });

  it('DataBrew не видит эталонную задачу: совпадение 28 % ниже порога', () => {
    const ids = recommend('DataBrew').map((i) => i.task.id);
    assert.ok(!ids.includes(SEED_TASK_IDS.deliveryBot));
  });

  it('все элементы имеют fit ≥ 0.5 и отсортированы по rankScore', () => {
    for (const t of SEED_TEAMS) {
      const items = rankRecommendations(t, published);
      for (const i of items) {
        assert.ok(i.fit.value >= MIN_FIT);
        assert.equal(
          i.rankScore,
          Math.round((0.7 * i.fit.value + (0.3 * i.task.score) / 100) * 1e4) / 1e4,
        );
      }
      for (let k = 1; k < items.length; k++)
        assert.ok(items[k - 1].rankScore >= items[k].rankScore);
    }
  });

  it('при равном rankScore порядок по id и не зависит от порядка входа', () => {
    const base = byId(SEED_TASK_IDS.deliveryBot);
    const a = { ...base, id: '7a5c0000-0000-4000-8000-0000000000aa' };
    const b = { ...base, id: '7a5c0000-0000-4000-8000-0000000000bb' };
    const forward = rankRecommendations(team('BotForge'), [b, a]);
    const backward = rankRecommendations(team('BotForge'), [a, b]);
    assert.deepEqual(forward.map((i) => i.task.id), [a.id, b.id]);
    assert.deepEqual(backward.map((i) => i.task.id), [a.id, b.id]);
    assert.deepEqual(recommend('PixelUX'), recommend('PixelUX'));
  });
});

describe('sortGridItems()', () => {
  const items = recommend('PixelUX');

  it("'default' возвращает тот же массив", () => {
    assert.equal(sortGridItems(items, 'default'), items);
  });

  it("'fit' и 'score' сортируют копию по убыванию", () => {
    const byFit = sortGridItems(items, 'fit');
    const byScore = sortGridItems(items, 'score');
    assert.notEqual(byFit, items);
    assert.deepEqual(byScore.map((i) => i.task.score), [91, 41]);
    assert.deepEqual(byFit.map((i) => i.fit.value), [1, 0.55]);
  });

  it("'score' стабилен при равных рейтингах", () => {
    const tie = (id: string, fitValue: number): RecommendationItem => ({
      ...items[0],
      task: { ...items[0].task, id, score: 60 },
      fit: { ...items[0].fit, value: fitValue },
    });
    const list = [tie('c', 0.6), tie('a', 0.9), tie('b', 0.7)];
    assert.deepEqual(
      sortGridItems(list, 'score').map((i) => i.task.id),
      ['c', 'a', 'b'],
    );
    assert.deepEqual(
      list.map((i) => i.task.id),
      ['c', 'a', 'b'],
    );
  });
});
