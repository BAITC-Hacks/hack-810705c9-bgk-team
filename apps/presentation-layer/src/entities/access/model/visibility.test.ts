import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEMO_BUSINESSES, DEMO_TEAMS } from "@/shared/config/demo-actors";
import type { DemoActor } from "@/shared/lib/demo-actor";

import type { AccessField, AccessProposal, AccessStage, AccessTask, TaskStatus } from "./types";
import {
  taskAccess,
  toExecutorView,
  visibleProposals,
  visibleStages,
  visibleTasks,
} from "./visibility";

const [bizA, bizB] = DEMO_BUSINESSES;
const [botForge, dataBrew] = DEMO_TEAMS;
const ownerA: DemoActor = { role: "business", businessId: bizA.id };
const ownerB: DemoActor = { role: "business", businessId: bizB.id };
const teamBot: DemoActor = { role: "team", teamId: botForge.id };
const teamData: DemoActor = { role: "team", teamId: dataBrew.id };

const fields: AccessField[] = [
  { node: "need", value: "Клиенты звонят узнать статус", state: "confirmed", sourceQuote: "звонят", sourceTurnId: "turn-1" },
  { node: "result", value: "Telegram-бот", state: "suggested", sourceQuote: "бот" },
  { node: "users.scale", value: null, state: "empty" },
  { node: "data.volume", value: "Данных нет, выгрузку соберёт аналитик", state: "confirmed", notApplicable: true },
];

function task(id: string, businessId: string, status: TaskStatus): AccessTask & { title: string } {
  return { id, businessId, status, title: `Задача ${id}`, draftText: "сырой черновик", fields };
}

const tasks = [
  task("t-draft", bizA.id, "draft"),
  task("t-pub", bizA.id, "published"),
  task("t-work", bizA.id, "in_work"),
  task("t-other", bizB.id, "published"),
  task("t-other-draft", bizB.id, "draft"),
];

const proposals: AccessProposal[] = [
  { id: "p-bot", taskId: "t-work", teamId: botForge.id },
  { id: "p-data", taskId: "t-pub", teamId: dataBrew.id },
  { id: "p-bot-other", taskId: "t-other", teamId: botForge.id },
];

const stages: AccessStage[] = [
  { id: "s-bot", proposalId: "p-bot" },
  { id: "s-data", proposalId: "p-data" },
];

describe("вид исполнителя (FR-2.8, FR-4.1, FR-1.11)", () => {
  const view = toExecutorView(tasks[1]);

  it("показывает только confirmed, скрывает suggested и empty", () => {
    assert.deepEqual(
      view.fields.map((field) => field.node),
      ["need", "data.volume"],
    );
  });

  it("сохраняет «не применимо» с пояснением", () => {
    const na = view.fields.find((field) => field.node === "data.volume");
    assert.equal(na?.notApplicable, true);
    assert.equal(na?.value, "Данных нет, выгрузку соберёт аналитик");
  });

  it("пропускает только разрешённые ключи задачи и поля", () => {
    const leaky = {
      ...tasks[1],
      contact: "it@logistics.example",
      internalNote: "не показывать командам",
      fields: [{ ...fields[0], internalNote: "черновая пометка", source: "grill" }],
    };
    const safe = toExecutorView(leaky);
    assert.equal("contact" in safe, false);
    assert.equal("internalNote" in safe, false);
    assert.deepEqual(Object.keys(safe.fields[0]).sort(), ["node", "state", "value"]);
  });

  it("скрывает черновик и реплики-источники, остальное сохраняет", () => {
    assert.equal("draftText" in view, false);
    assert.equal("sourceQuote" in view.fields[0], false);
    assert.equal("sourceTurnId" in view.fields[0], false);
    assert.equal(view.title, "Задача t-pub");
  });
});

describe("видимость задач", () => {
  it("команда видит опубликованные задачи и задачи со своим откликом", () => {
    assert.deepEqual(
      visibleTasks(teamBot, tasks, proposals).map((item) => [item.task.id, item.access]),
      [
        ["t-pub", "executor"],
        ["t-work", "executor"],
        ["t-other", "executor"],
      ],
    );
    assert.equal(taskAccess(teamData, tasks[2], proposals), null);
    assert.equal(taskAccess(teamBot, tasks[0], proposals), null);
  });

  it("команда получает тот же фильтр, что и «Вид исполнителя»", () => {
    const [first] = visibleTasks(teamBot, tasks, proposals);
    assert.deepEqual(first.task, toExecutorView(tasks[1]));
  });

  it("бизнес видит свои задачи во всех состояниях и чужие опубликованные как каталог", () => {
    const visible = visibleTasks(ownerA, tasks, proposals);
    assert.deepEqual(
      visible.map((item) => [item.task.id, item.access]),
      [
        ["t-draft", "owner"],
        ["t-pub", "owner"],
        ["t-work", "owner"],
        ["t-other", "catalog"],
      ],
    );
    assert.equal(visible[0].task.fields.length, fields.length);
    assert.deepEqual(visible[3].task, toExecutorView(tasks[3]));
  });
});

describe("видимость откликов и этапов", () => {
  it("бизнес видит отклики только на свои задачи", () => {
    assert.deepEqual(
      visibleProposals(ownerA, proposals, tasks).map((proposal) => proposal.id),
      ["p-bot", "p-data"],
    );
    assert.deepEqual(
      visibleProposals(ownerB, proposals, tasks).map((proposal) => proposal.id),
      ["p-bot-other"],
    );
  });

  it("команда видит только свои отклики и их этапы", () => {
    const own = visibleProposals(teamBot, proposals, tasks);
    assert.deepEqual(own.map((proposal) => proposal.id), ["p-bot", "p-bot-other"]);
    assert.deepEqual(visibleStages(stages, own).map((stage) => stage.id), ["s-bot"]);
  });
});
