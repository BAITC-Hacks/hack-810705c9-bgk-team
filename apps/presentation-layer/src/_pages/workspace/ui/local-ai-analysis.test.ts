import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTask, TASK_FIELDS } from "@/entities/workspace";
import { analyzeTaskLocally } from "./local-ai-analysis";

describe("local AI analysis contract", () => {
  it("exposes the prompt and exact input with three questions for a weak draft", () => {
    const task = createTask("Нужна помощь с остатками");
    const result = analyzeTaskLocally(task);
    assert.match(result.prompt, /Не добавляй факты/);
    assert.equal(result.input.description, task.description);
    assert.deepEqual(result.input.fields, task.fields);
    assert.equal(result.output.questions.length, 3);
    assert.ok(result.output.questions.every(({ field }) => !task.fields[field].trim()));
    assert.deepEqual(result.output.pendingConfirmation, ["need"]);
    assert.equal(result.parseOk, true);
    assert.equal(result.fallbackUsed, false);
    assert.deepEqual(JSON.parse(result.rawOutput), result.output);
  });

  it("does not ask for answered but unconfirmed fields", () => {
    const task = createTask("Нужна помощь");
    for (const { key } of TASK_FIELDS) task.fields[key] = "Ответ бизнеса";
    const result = analyzeTaskLocally(task);
    assert.deepEqual(result.output.questions, []);
    assert.deepEqual(result.output.pendingConfirmation, TASK_FIELDS.map(({ key }) => key));
    assert.deepEqual(task.confirmedFields, []);
  });

  it("recovers from malformed JSON and wrong output types without changing the task", () => {
    const task = createTask("Нужна помощь");
    const snapshot = JSON.stringify(task);
    const expected = analyzeTaskLocally(task).output;
    for (const raw of ['{"questions": [', '{"questions":"invalid"}', "null"]) {
      const result = analyzeTaskLocally(task, raw);
      assert.equal(result.rawOutput, raw);
      assert.equal(result.parseOk, false);
      assert.equal(result.fallbackUsed, true);
      assert.ok(result.error);
      assert.deepEqual(result.output, expected);
    }
    assert.equal(JSON.stringify(task), snapshot);
  });

  it("rejects fabricated text, unknown fields and attempts to skip missing questions", () => {
    const task = createTask("Нужна помощь");
    const expected = analyzeTaskLocally(task).output;
    const invented = structuredClone(expected);
    invented.questions[0].question = "Ваш бюджет составляет 100000 тенге?";
    const unknown = { questions: [{ field: "invented", question: "Любой вопрос?" }], pendingConfirmation: [] };
    const missing = { questions: [], pendingConfirmation: [] };
    for (const output of [invented, unknown, missing]) {
      const result = analyzeTaskLocally(task, JSON.stringify(output));
      assert.equal(result.fallbackUsed, true);
      assert.deepEqual(result.output, expected);
    }
  });
});
