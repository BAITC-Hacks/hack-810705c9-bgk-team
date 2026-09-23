import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDemoData, TASK_FIELDS } from "@/entities/workspace";
import { getMentionRange, removeMention, runChatSkill } from "./chat-skills";

describe("composer mentions", () => {
  it("recognizes standalone Russian and English skill queries", () => {
    assert.deepEqual(getMentionRange("@готов", 6), {
      start: 0,
      end: 6,
      query: "готов",
    });
    assert.deepEqual(getMentionRange("Проверить @score", 15), {
      start: 10,
      end: 16,
      query: "scor",
    });
    assert.equal(getMentionRange("team@example.com", 12), null);
    assert.equal(getMentionRange("literal@", 8), null);
    assert.equal(getMentionRange("@готовность после", 17), null);
  });

  it("removes only the mention, preserving text and the caret's trailing token", () => {
    const value = "Сначала @готовность затем обсудим";
    const range = getMentionRange(value, 12);
    assert.ok(range);
    assert.equal(removeMention(value, range), "Сначала  затем обсудим");
    assert.equal(getMentionRange("Начало\n@", 8)?.query, "");
  });
});

describe("local business skills", () => {
  it("asks for confirmation instead of repeating answered questions", () => {
    const data = getDemoData();
    const task = structuredClone(data.tasks[0]);
    for (const { key } of TASK_FIELDS) task.fields[key] = `Ответ для ${key}`;
    task.confirmedFields = [];
    const answer = runChatSkill(task, data.proposals, data.teams, "clarify", "");
    assert.match(answer, /Все ответы уже внесены/);
    assert.match(answer, /проверить и подтвердить/);
    assert.match(answer, /повторно отвечать на эти вопросы не нужно/);
    assert.doesNotMatch(answer, /заполнены и подтверждены/);
  });

  it("directs a complete draft to publication before comparing proposals", () => {
    const data = getDemoData();
    const task = structuredClone(data.tasks[0]);
    for (const { key } of TASK_FIELDS) task.fields[key] = `Ответ для ${key}`;
    task.confirmedFields = TASK_FIELDS.map(({ key }) => key);
    task.status = "draft";
    assert.match(runChatSkill(task, data.proposals, data.teams, "clarify", ""), /опубликуйте задачу/);
  });

  it("uses confirmed readiness and leaves all data unchanged", () => {
    const data = getDemoData();
    const snapshot = JSON.stringify(data);
    const answer = runChatSkill(
      data.tasks[0],
      data.proposals,
      data.teams,
      "readiness",
      "Что улучшить?",
    );
    assert.match(answer, /Готовность: 70 \/ 100/);
    assert.match(answer, /Ваше уточнение: «Что улучшить\?»/);
    assert.match(answer, /после подтверждения/);
    assert.equal(JSON.stringify(data), snapshot);
  });

  it("compares only actual proposals for the selected task without choosing a team", () => {
    const data = getDemoData();
    const task = data.tasks[0];
    const snapshot = JSON.stringify(data);
    const answer = runChatSkill(
      task,
      data.proposals,
      data.teams,
      "compare",
      "",
    );
    for (const proposal of data.proposals.filter(
      ({ taskId }) => taskId === task.id,
    )) {
      assert.ok(answer.includes(proposal.idea));
      assert.ok(answer.includes(proposal.plan));
      assert.ok(answer.includes(proposal.timeline));
    }
    const unrelated = data.proposals.find(({ taskId }) => taskId !== task.id);
    assert.ok(unrelated);
    assert.ok(!answer.includes(unrelated.idea));
    assert.match(answer, /выбор остаётся за вами/);
    assert.equal(JSON.stringify(data), snapshot);
  });

  it("asks for missing success values and handles an empty proposal list", () => {
    const data = getDemoData();
    const task = {
      ...data.tasks[0],
      fields: { ...data.tasks[0].fields, success: "", outcome: "" },
    };
    const criteria = runChatSkill(
      task,
      data.proposals,
      data.teams,
      "success",
      "",
    );
    assert.match(criteria, /Критерий успеха пока не заполнен/);
    assert.match(criteria, /\[значение или сценарий\]/);
    assert.match(criteria, /нужно указать вам/);
    assert.match(
      runChatSkill(task, [], data.teams, "compare", ""),
      /пока нет откликов/,
    );
  });
});
