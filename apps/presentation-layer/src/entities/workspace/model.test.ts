import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDemoData } from "./demo-data";
import {
  TASK_FIELDS,
  calculateScore,
  createTask,
  readiness,
  scoreBreakdown,
  suggestQuestions,
  type Task,
} from "./model";

function completeTask(): Task {
  const task = createTask("Уменьшить списания продукции");
  for (const field of TASK_FIELDS)
    task.fields[field.key] = "Согласованный ответ";
  task.confirmedFields = TASK_FIELDS.map((field) => field.key);
  return task;
}

describe("готовность задачи", () => {
  it("не засчитывает текст, который бизнес ещё не подтвердил", () => {
    const task = completeTask();
    task.confirmedFields = [];
    assert.equal(calculateScore(task), 0);
  });

  it("не засчитывает пустое подтверждённое поле и повторное подтверждение", () => {
    const task = completeTask();
    task.fields.data = "   ";
    task.confirmedFields.push("context", "context");
    assert.equal(calculateScore(task), 80);
    assert.ok(
      suggestQuestions(task).some((question) => question.field === "data"),
    );
  });

  it("даёт 100 баллов за полный бриф, а разбивка сходится с итогом", () => {
    const task = completeTask();
    const breakdown = scoreBreakdown(task);
    assert.equal(calculateScore(task), 100);
    assert.equal(
      breakdown.reduce((sum, item) => sum + item.earned, 0),
      100,
    );
    assert.equal(
      breakdown.reduce((sum, item) => sum + item.max, 0),
      100,
    );
    assert.ok(breakdown.every((item) => item.missing.length === 0));
  });

  it("меняет статус на границах согласованных диапазонов", () => {
    assert.equal(readiness(39).tone, "muted");
    assert.equal(readiness(40).tone, "amber");
    assert.equal(readiness(69).tone, "amber");
    assert.equal(readiness(70).tone, "green");
    assert.equal(readiness(89).tone, "green");
    assert.equal(readiness(90).tone, "violet");
    assert.equal(readiness(100).tone, "violet");
  });

  it("предлагает максимум три вопроса только о неподтверждённых пунктах", () => {
    const task = completeTask();
    task.confirmedFields = ["context", "need", "users", "outcome"];
    const questions = suggestQuestions(task);
    assert.equal(questions.length, 3);
    assert.ok(
      questions.every(({ field }) => !task.confirmedFields.includes(field)),
    );
    assert.equal(suggestQuestions(completeTask()).length, 0);
  });

  it("создаёт независимые черновики и не выдаёт исходный текст за подтверждение", () => {
    const first = createTask("  Снизить списания  ");
    const second = createTask("Другая задача");
    assert.notEqual(first.id, second.id);
    assert.equal(first.description, "Снизить списания");
    assert.equal(first.status, "draft");
    assert.equal(calculateScore(first), 0);
    first.fields.data = "Изменённое поле";
    assert.equal(second.fields.data, "");
  });
});

describe("демонстрационные данные", () => {
  it("включает доступные опубликованные задачи с низкой готовностью", () => {
    const { tasks, teams, proposals } = getDemoData();
    assert.ok(tasks.filter((task) => task.status === "draft").length >= 5);
    assert.ok(tasks.filter((task) => task.status === "published").length >= 5);
    assert.ok(
      tasks.some(
        (task) => task.status === "published" && calculateScore(task) < 40,
      ),
    );
    assert.ok(teams.length >= 5);
    assert.ok(proposals.length >= 5);
    assert.equal(tasks[0].title, "Снизить списания в пекарне");
    assert.equal(calculateScore(tasks[0]), 70);
    assert.equal(
      proposals.filter((proposal) => proposal.taskId === tasks[0].id).length,
      3,
    );
    assert.ok(
      proposals.every((proposal) =>
        tasks.some((task) => task.id === proposal.taskId),
      ),
    );
    assert.ok(
      proposals.every((proposal) =>
        teams.some((team) => team.id === proposal.teamId),
      ),
    );
    assert.ok(
      proposals.every(
        (proposal) => new URL(proposal.prototypeUrl).hostname === "example.com",
      ),
    );
  });

  it("возвращает отдельную копию данных для каждого запуска демо", () => {
    const first = getDemoData();
    first.tasks[0].title = "Изменено";
    first.tasks[0].confirmedFields.length = 0;
    first.teams[0].skills.push("Изменено");
    const second = getDemoData();
    assert.equal(second.tasks[0].title, "Снизить списания в пекарне");
    assert.equal(calculateScore(second.tasks[0]), 70);
    assert.ok(!second.teams[0].skills.includes("Изменено"));
  });
});
