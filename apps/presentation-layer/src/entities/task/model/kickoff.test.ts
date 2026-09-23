import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildKickoff, type KickoffCriterion, type KickoffField } from "./kickoff";

const NOW = new Date("2026-09-23T10:00:00.000Z");

function confirmedField(node: string, value: string): KickoffField {
  return { node, value, state: "confirmed", notApplicable: false };
}

function criterion(id: string, position: number, confirmed = true): KickoffCriterion {
  return { id, metric: `метрика ${id}`, threshold: `порог ${id}`, position, confirmed };
}

describe("buildKickoff", () => {
  it("подработка: условия оплаты попадают в пакет (Приложение А)", () => {
    const kickoff = buildKickoff({
      engagement: "job",
      compensationNote: "оплата за каждый принятый этап",
      fields: [confirmedField("data.sample", "статусы CSV")],
      criteria: [criterion("c1", 1)],
      now: NOW,
    });
    const engagementItem = kickoff.items.find((item) => item.key === "engagement");
    assert.ok(engagementItem);
    assert.equal(engagementItem?.value, "оплата за каждый принятый этап");
  });

  it("практика: помечает, что этапы и отзыв идут в отчёт", () => {
    const kickoff = buildKickoff({
      engagement: "practice",
      compensationNote: null,
      fields: [],
      criteria: [],
      now: NOW,
    });
    const engagementItem = kickoff.items.find((item) => item.key === "engagement");
    assert.equal(engagementItem?.value, "подтверждённые этапы и отзыв бизнеса идут в отчёт о практике");
  });

  it("подработка без указанной оплаты — явная пометка", () => {
    const kickoff = buildKickoff({
      engagement: "job",
      compensationNote: null,
      fields: [],
      criteria: [],
      now: NOW,
    });
    const engagementItem = kickoff.items.find((item) => item.key === "engagement");
    assert.equal(engagementItem?.value, "условия оплаты не указаны");
  });

  it("оба формата дают оба пункта", () => {
    const kickoff = buildKickoff({
      engagement: "both",
      compensationNote: "по договорённости",
      fields: [],
      criteria: [],
      now: NOW,
    });
    assert.ok(kickoff.items.some((item) => item.key === "engagement_job"));
    assert.ok(kickoff.items.some((item) => item.key === "engagement_practice"));
  });

  it("неподтверждённое (suggested) поле не попадает в пакет", () => {
    const kickoff = buildKickoff({
      engagement: "job",
      compensationNote: "тест",
      fields: [
        { node: "data.sample", value: "черновик материалов", state: "suggested", notApplicable: false },
      ],
      criteria: [],
      now: NOW,
    });
    assert.equal(kickoff.items.some((item) => item.key === "materials"), false);
  });

  it("firstStage — критерий с наименьшим position среди подтверждённых", () => {
    const kickoff = buildKickoff({
      engagement: "job",
      compensationNote: null,
      fields: [],
      criteria: [criterion("c2", 2), criterion("c1", 1), criterion("c3", 0, false)],
      now: NOW,
    });
    assert.equal(kickoff.firstStage?.criterionId, "c1");
  });

  it("нет подтверждённых критериев — firstStage null", () => {
    const kickoff = buildKickoff({
      engagement: "job",
      compensationNote: null,
      fields: [],
      criteria: [criterion("c1", 0, false)],
      now: NOW,
    });
    assert.equal(kickoff.firstStage, null);
  });

  it("контакт только когда подтверждён", () => {
    const withoutContact = buildKickoff({
      engagement: "job",
      compensationNote: null,
      fields: [{ node: "link.contact", value: "it@logistics.example", state: "suggested", notApplicable: false }],
      criteria: [],
      now: NOW,
    });
    assert.equal(withoutContact.contact, null);

    const withContact = buildKickoff({
      engagement: "job",
      compensationNote: null,
      fields: [confirmedField("link.contact", "it@logistics.example")],
      criteria: [],
      now: NOW,
    });
    assert.equal(withContact.contact, "it@logistics.example");
  });

  it("builtAt берёт переданный now, иначе текущее время", () => {
    const kickoff = buildKickoff({
      engagement: "job",
      compensationNote: null,
      fields: [],
      criteria: [],
      now: NOW,
    });
    assert.equal(kickoff.builtAt, NOW.toISOString());
  });
});
