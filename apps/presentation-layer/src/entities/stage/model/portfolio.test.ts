import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summarizeTeamProgress, type TeamStageRow } from "./portfolio";

function row(overrides: Partial<TeamStageRow> = {}): TeamStageRow {
  return {
    stageId: "s1",
    status: "confirmed",
    points: 10,
    taskId: "task-1",
    taskTitle: "Бот статусов доставки",
    metric: "Доля без оператора",
    threshold: "≥60%",
    teamRoles: ["backend"],
    businessComment: null,
    confirmedAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("summarizeTeamProgress", () => {
  it("баллы — сумма points только подтверждённых этапов (ADR-007, п.6)", () => {
    const { points } = summarizeTeamProgress([
      row({ stageId: "s1", status: "confirmed", points: 10 }),
      row({ stageId: "s2", status: "confirmed", points: 10 }),
      row({ stageId: "s3", status: "claimed", points: 0 }),
      row({ stageId: "s4", status: "open", points: 0 }),
    ]);
    assert.equal(points, 20);
  });

  it("портфолио содержит только подтверждённые этапы", () => {
    const { portfolio } = summarizeTeamProgress([
      row({ stageId: "s1", status: "confirmed" }),
      row({ stageId: "s2", status: "returned", points: 0 }),
    ]);
    assert.equal(portfolio.length, 1);
    assert.equal(portfolio[0].stageId, "s1");
  });

  it("портфолио отсортировано по confirmedAt по убыванию", () => {
    const { portfolio } = summarizeTeamProgress([
      row({ stageId: "old", confirmedAt: "2026-09-01T00:00:00.000Z" }),
      row({ stageId: "new", confirmedAt: "2026-09-15T00:00:00.000Z" }),
    ]);
    assert.deepEqual(portfolio.map((p) => p.stageId), ["new", "old"]);
  });

  it("нет подтверждённых этапов — нулевые баллы и пустое портфолио", () => {
    const { points, portfolio } = summarizeTeamProgress([
      row({ stageId: "s1", status: "open", points: 0 }),
    ]);
    assert.equal(points, 0);
    assert.deepEqual(portfolio, []);
  });
});
