import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CriteriaAnswers } from "@/shared/db/schema";
import { PARTIAL_MATCH_THRESHOLD, compareProposals } from "./compare";

const criteria = [
  { id: "c1", metric: "Доля без оператора", threshold: "≥60%" },
  { id: "c2", metric: "Время ответа", threshold: "<3с" },
];

function answers(criteriaVersion: number, values: Record<string, string>): CriteriaAnswers {
  return { criteriaVersion, answers: values };
}

describe("compareProposals", () => {
  it("сортирует по fit без скрытия низких совпадений (FR-7.1)", () => {
    const { items } = compareProposals(criteria, 1, [
      { id: "p-databrew", teamId: "t-databrew", fit: 0.28, createdAt: "2026-09-01", criteriaAnswers: answers(1, {}) },
      { id: "p-botforge", teamId: "t-botforge", fit: 0.92, createdAt: "2026-09-02", criteriaAnswers: answers(1, {}) },
    ]);
    assert.deepEqual(items.map((i) => i.id), ["p-botforge", "p-databrew"]);
    assert.equal(items.length, 2);
  });

  it("при равном fit раньше созданный отклик идёт первым", () => {
    const { items } = compareProposals(criteria, 1, [
      { id: "later", teamId: "t1", fit: 0.5, createdAt: "2026-09-05", criteriaAnswers: answers(1, {}) },
      { id: "earlier", teamId: "t2", fit: 0.5, createdAt: "2026-09-01", criteriaAnswers: answers(1, {}) },
    ]);
    assert.deepEqual(items.map((i) => i.id), ["earlier", "later"]);
  });

  it("partialMatch выставлен при fit ниже порога", () => {
    const { items } = compareProposals(criteria, 1, [
      { id: "p1", teamId: "t1", fit: PARTIAL_MATCH_THRESHOLD, createdAt: "2026-09-01", criteriaAnswers: answers(1, {}) },
      { id: "p2", teamId: "t2", fit: 0.28, createdAt: "2026-09-01", criteriaAnswers: answers(1, {}) },
    ]);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    assert.equal(byId.p1.partialMatch, false);
    assert.equal(byId.p2.partialMatch, true);
  });

  it("versionMismatch не теряет ответы, только помечает их (риск из ADR)", () => {
    const { items, matrix } = compareProposals(criteria, 2, [
      { id: "p-old", teamId: "t1", fit: 0.6, createdAt: "2026-09-01", criteriaAnswers: answers(1, { c1: "60% за сентябрь" }) },
    ]);
    assert.equal(items[0].versionMismatch, true);
    const row = matrix.rows.find((r) => r.criterionId === "c1");
    assert.equal(row?.cells[0].answer, "60% за сентябрь");
    assert.equal(row?.cells[0].versionMismatch, true);
  });

  it("матрица строится по текущим критериям, колонки следуют отсортированному порядку", () => {
    const { matrix } = compareProposals(criteria, 1, [
      { id: "low", teamId: "t1", fit: 0.1, createdAt: "2026-09-01", criteriaAnswers: answers(1, { c1: "низкий ответ" }) },
      { id: "high", teamId: "t2", fit: 0.9, createdAt: "2026-09-02", criteriaAnswers: answers(1, { c1: "высокий ответ", c2: "1.5с" }) },
    ]);
    assert.equal(matrix.criteria.length, 2);
    const row = matrix.rows.find((r) => r.criterionId === "c1");
    assert.deepEqual(row?.cells.map((c) => c.proposalId), ["high", "low"]);
    assert.equal(row?.cells[0].answer, "высокий ответ");
  });
});
