import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { catalogPlace, type RankedTask } from "./place";
import { score } from "./score";
import {
  SEED_CARDS,
  appendixDraft,
  appendixStep1,
  appendixStep2,
  appendixStep3,
  appendixStep4,
} from "./score.fixtures";

function published(id: string, value: number, day: number): RankedTask {
  return { id, score: value, publishedAt: new Date(Date.UTC(2026, 8, day)) };
}

describe("место в каталоге", () => {
  const catalog = [
    published("a", 91, 1),
    published("b", 76, 2),
    published("c", 76, 5),
    published("d", 41, 3),
  ];

  it("рейтинг по убыванию, при равенстве раньше опубликованная выше", () => {
    assert.equal(catalogPlace(catalog[0], catalog), 1);
    assert.equal(catalogPlace(catalog[1], catalog), 2);
    assert.equal(catalogPlace(catalog[2], catalog), 3);
    assert.equal(catalogPlace(catalog[3], catalog), 4);
  });

  it("задача не конкурирует сама с собой", () => {
    const moved = { ...catalog[3], score: 95 };
    assert.equal(catalogPlace(moved, catalog), 1);
  });

  it("неопубликованная задача получает гипотетическое место", () => {
    const draft: RankedTask = { id: "new", score: 76, publishedAt: null };
    assert.equal(catalogPlace(draft, catalog), 4);
    assert.equal(catalogPlace({ ...draft, score: 10 }, catalog), 5);
    assert.equal(catalogPlace({ ...draft, score: 100 }, catalog), 1);
  });

  it("Приложение А: места 6 → 4 → 3 → 3 → 2 среди seed-задач", () => {
    const seeds = SEED_CARDS.map((seed, index) =>
      published(`seed-${index}`, score(seed.card).total, index + 1),
    );
    const places = [
      appendixDraft,
      appendixStep1,
      appendixStep2,
      appendixStep3,
      appendixStep4,
    ].map((build) =>
      catalogPlace(
        { id: "logistics", score: score(build()).total, publishedAt: null },
        seeds,
      ),
    );
    assert.deepEqual(places, [6, 4, 3, 3, 2]);
  });
});
