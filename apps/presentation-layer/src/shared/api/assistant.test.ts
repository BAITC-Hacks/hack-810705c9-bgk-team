import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assistantReplySchema,
  assistantRequestSchema,
  type AssistantRequest,
} from "./contracts/assistant";
import { getDemoData, buildAssistantContext } from "@/entities/workspace";

const baseRequest = (): AssistantRequest => ({
  threadId: "session-1:bakery-waste",
  skill: "clarify",
  message: "",
  context: {
    taskSummary: "Снизить списания в пекарне\nКонтекст бизнеса: нужно уточнить",
    score: 70,
    readinessLabel: "Можно начинать",
    breakdown: [{ label: "Контекст и потребность", earned: 10, max: 20 }],
    proposals: [],
  },
});

describe("assistant contract", () => {
  it("accepts a skill-only request and a free-text request", () => {
    assert.ok(assistantRequestSchema.safeParse(baseRequest()).success);

    const freeText = { ...baseRequest(), skill: undefined, message: "Привет" };
    assert.ok(assistantRequestSchema.safeParse(freeText).success);
  });

  it("rejects an empty request, unknown skill and oversized message", () => {
    const empty = { ...baseRequest(), skill: undefined, message: "   " };
    assert.ok(!assistantRequestSchema.safeParse(empty).success);

    const unknownSkill = { ...baseRequest(), skill: "compare-teams" };
    assert.ok(!assistantRequestSchema.safeParse(unknownSkill).success);

    const oversized = { ...baseRequest(), message: "x".repeat(4001) };
    assert.ok(!assistantRequestSchema.safeParse(oversized).success);
  });

  it("parses fallback replies and rejects non-boolean fallbackUsed", () => {
    assert.deepEqual(
      assistantReplySchema.parse({ reply: "", fallbackUsed: true }),
      { reply: "", fallbackUsed: true },
    );
    assert.ok(
      !assistantReplySchema.safeParse({ reply: "ok", fallbackUsed: "yes" })
        .success,
    );
  });
});

describe("assistant context", () => {
  it("snapshots only the given task's proposals with team names and labels", () => {
    const data = getDemoData();
    const task = data.tasks[0];
    const snapshot = JSON.stringify(data);
    const context = buildAssistantContext(task, data.proposals, data.teams);

    assert.ok(context.taskSummary.includes(task.title));
    assert.ok(context.readinessLabel.length > 0);
    const own = data.proposals.filter(({ taskId }) => taskId === task.id);
    assert.equal(context.proposals.length, own.length);
    for (const [index, proposal] of context.proposals.entries()) {
      const team = data.teams.find(({ id }) => id === own[index].teamId);
      assert.equal(proposal.teamName, team?.name ?? "Команда");
      assert.equal(proposal.idea, own[index].idea);
      assert.equal(proposal.plan, own[index].plan);
      assert.equal(proposal.timeline, own[index].timeline);
      assert.ok(proposal.statusLabel.length > 0);
    }
    const unrelated = data.proposals.find(({ taskId }) => taskId !== task.id);
    assert.ok(unrelated);
    assert.ok(
      !context.proposals.some(({ idea }) => idea === unrelated.idea),
      "чужой отклик не должен попадать в контекст",
    );
    assert.equal(JSON.stringify(data), snapshot);
  });

  it("keeps breakdown totals consistent with the score", () => {
    const data = getDemoData();
    const task = data.tasks[0];
    const context = buildAssistantContext(task, [], data.teams);
    const breakdownSum = context.breakdown.reduce(
      (sum, group) => sum + group.earned,
      0,
    );
    assert.equal(breakdownSum, context.score);
    assert.ok(context.breakdown.every((group) => group.earned <= group.max));
  });
});
