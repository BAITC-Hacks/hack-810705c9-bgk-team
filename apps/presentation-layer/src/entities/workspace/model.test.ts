import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDemoData } from "./demo-data";
import {
  TASK_FIELDS,
  calculateScore,
  confirmMilestone,
  createTask,
  readiness,
  scoreBreakdown,
  suggestQuestions,
  submitMilestone,
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

  it("предлагает три вопроса и переходит к следующим после ответа без повторов", () => {
    const task = createTask("Нужно снизить списания");
    const questions = suggestQuestions(task);
    assert.equal(questions.length, 3);
    assert.deepEqual(questions.map(({ field }) => field), ["data", "outcome", "success"]);
    for (const { field } of questions) task.fields[field] = "Ответ бизнеса";
    assert.ok(
      suggestQuestions(task).every(({ field }) => !questions.some((item) => item.field === field)),
    );
    assert.equal(calculateScore(task), 0);
    assert.equal(suggestQuestions(completeTask()).length, 0);
    const unconfirmed = completeTask();
    unconfirmed.confirmedFields = [];
    assert.equal(suggestQuestions(unconfirmed).length, 0);
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

describe("подтверждённый прогресс команды", () => {
  const submission = {
    title: "Прототип прогноза",
    resultUrl: "https://example.com/demo/result",
    comment: "Проверено на предоставленной таблице, результаты приведены по ссылке.",
  };

  it("принимает результат только выбранной команды и не начисляет баллы за отправку", () => {
    const proposal = getDemoData().proposals[0];
    assert.equal(submitMilestone(proposal, submission), proposal);
    const selected = { ...proposal, status: "selected" as const };
    assert.equal(confirmMilestone(selected), selected);
    const submitted = submitMilestone(selected, submission);
    assert.deepEqual(submitted.milestone, submission);
    assert.equal(submitted.milestoneConfirmed, false);
    const confirmed = confirmMilestone(submitted);
    assert.equal(confirmed.milestoneConfirmed, true);
    assert.equal(confirmMilestone(confirmed), confirmed);
    assert.equal(submitMilestone(confirmed, { ...submission, title: "Другой этап" }), confirmed);
  });

  it("не принимает пустой результат и опасные ссылки", () => {
    const proposal = { ...getDemoData().proposals[0], status: "selected" as const };
    for (const invalid of [
      { ...submission, title: " " },
      { ...submission, comment: " " },
      { ...submission, resultUrl: "javascript:alert(1)" },
      { ...submission, resultUrl: "not-a-url" },
    ]) assert.equal(submitMilestone(proposal, invalid), proposal);
  });

  it("позволяет исправить результат до подтверждения без начисления баллов", () => {
    const selected = { ...getDemoData().proposals[0], status: "selected" as const };
    const submitted = submitMilestone(selected, submission);
    const edited = submitMilestone(submitted, {
      title: "  Уточнённый прототип  ",
      resultUrl: "  https://example.com/demo/revised  ",
      comment: "  Исправлены расчёты и добавлены результаты проверки.  ",
    });

    assert.equal(edited.id, submitted.id);
    assert.equal(edited.status, "selected");
    assert.equal(edited.milestoneConfirmed, false);
    assert.deepEqual(edited.milestone, {
      title: "Уточнённый прототип",
      resultUrl: "https://example.com/demo/revised",
      comment: "Исправлены расчёты и добавлены результаты проверки.",
    });
    assert.deepEqual(submitted.milestone, submission);
  });

  it("не подтверждает сданный этап после отклонения или отмены выбора команды", () => {
    const selected = { ...getDemoData().proposals[0], status: "selected" as const };
    const submitted = submitMilestone(selected, submission);

    for (const status of ["rejected", "pending"] as const) {
      const noLongerSelected = { ...submitted, status };
      assert.equal(confirmMilestone(noLongerSelected), noLongerSelected);
      assert.equal(noLongerSelected.milestoneConfirmed, false);
      assert.deepEqual(noLongerSelected.milestone, submission);
      assert.equal(
        submitMilestone(noLongerSelected, { ...submission, title: "Новый результат" }),
        noLongerSelected,
      );
    }
  });

  it("не подтверждает этап повторно после отмены решения и повторного выбора", () => {
    const selected = { ...getDemoData().proposals[0], status: "selected" as const };
    const confirmed = confirmMilestone(submitMilestone(selected, submission));
    const decisionUndone = { ...confirmed, status: "pending" as const };
    const selectedAgain = { ...decisionUndone, status: "selected" as const };

    assert.equal(decisionUndone.milestoneConfirmed, true);
    assert.equal(confirmMilestone(decisionUndone), decisionUndone);
    assert.equal(confirmMilestone(selectedAgain), selectedAgain);
    assert.equal(selectedAgain.milestoneConfirmed, true);
    assert.deepEqual(selectedAgain.milestone, submission);
    assert.equal(
      submitMilestone(selectedAgain, { ...submission, title: "Другой этап" }),
      selectedAgain,
    );
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
