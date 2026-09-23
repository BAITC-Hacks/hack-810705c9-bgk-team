import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTask } from "./model";
import {
  evaluateTask,
  scoreEvaluationSchema,
  taskUpdateSchema,
  milestoneInputSchema,
  publicTask,
  onboardingSchema,
  sessionSchema,
  sessionUpdateSchema,
} from "./contracts";

describe("workspace API contracts", () => {
  it("supplies compatible defaults for legacy role cookies", () => {
    assert.deepEqual(sessionSchema.parse({ role: "business", teamId: null }), {
      role: "business", teamId: null, onboardingCompleted: false, businessId: null,
    });
    assert.deepEqual(sessionSchema.parse({
      role: "student", teamId: "team-one", onboardingCompleted: true, businessId: "company-one",
    }), {
      role: "student", teamId: "team-one", onboardingCompleted: true, businessId: "company-one",
    });
  });

  it("requires only the selected role's onboarding fields", () => {
    assert.deepEqual(onboardingSchema.parse({ role: "business", companyName: "  Компания  " }), {
      role: "business", companyName: "Компания",
    });
    assert.equal(onboardingSchema.safeParse({ role: "student", teamId: "team-one" }).success, true);
    for (const input of [
      { role: "business", companyName: "   " },
      { role: "business", companyName: "a".repeat(201) },
      { role: "student" },
      { role: "student", teamId: "" },
      { role: "student", teamId: "team-one", companyName: "Unused company" },
      { role: "business", companyName: "Company", teamId: "team-one" },
    ]) assert.equal(onboardingSchema.safeParse(input).success, false);
  });

  it("accepts only generated image keys and blocks completion through role switching", () => {
    const key = "12345678-1234-1234-1234-123456789abc.webp";
    assert.equal(onboardingSchema.safeParse({ role: "business", companyName: "Компания", logoKey: key }).success, true);
    for (const logoKey of ["../logo.png", "https://example.com/logo.png", "image.svg", "data:image/png;base64,AAAA"]) {
      assert.equal(onboardingSchema.safeParse({ role: "business", companyName: "Компания", logoKey }).success, false);
    }
    assert.equal(sessionUpdateSchema.safeParse({ role: "student", teamId: "team-one" }).success, true);
    assert.equal(sessionUpdateSchema.safeParse({ onboardingCompleted: true }).success, false);
    assert.equal(sessionUpdateSchema.safeParse({ businessId: "another-company" }).success, false);
  });

  it("returns exactly the seven weighted criteria and initial evaluation metadata", () => {
    const task = createTask("Снизить списания в небольшой пекарне");
    task.confirmedFields = ["need"];
    const result = scoreEvaluationSchema.parse(evaluateTask(task));
    assert.equal(result.score, 10);
    assert.equal(result.level, "draft");
    assert.equal(result.breakdown.length, 7);
    assert.equal(
      result.breakdown.reduce((sum, item) => sum + item.max, 0),
      100,
    );
    assert.equal(
      result.breakdown.reduce((sum, item) => sum + item.awarded, 0),
      result.score,
    );
    assert.deepEqual(result.recalculation, {
      firstEvaluation: true,
      previousScore: null,
      delta: null,
      closedItems: [],
    });
    assert.equal(result.missing.length, 8);
  });

  it("reports the stored previous score and newly closed fields", () => {
    const task = createTask("Снизить списания в небольшой пекарне");
    task.fields.data = "CSV продаж за три месяца";
    task.confirmedFields = ["need", "data"];
    const result = evaluateTask(task, {
      previousScore: 10,
      closedItems: ["Данные и материалы"],
    });
    assert.equal(result.recalculation.delta, 20);
    assert.equal(result.recalculation.firstEvaluation, false);
    assert.deepEqual(result.recalculation.closedItems, ["Данные и материалы"]);
  });

  it("rejects empty confirmed fields, unknown fields, and invalid result URLs", () => {
    const task = createTask("Снизить списания в небольшой пекарне");
    assert.equal(
      taskUpdateSchema.safeParse({ ...task, confirmedFields: ["users"] })
        .success,
      false,
    );
    assert.equal(
      taskUpdateSchema.safeParse({
        ...task,
        fields: { ...task.fields, injected: "x" },
      }).success,
      false,
    );
    for (const resultUrl of [
      "javascript:alert(1)",
      "not a URL",
      "file:///etc/passwd",
    ]) {
      assert.equal(
        milestoneInputSchema.safeParse({
          title: "Этап",
          resultUrl,
          comment: "Готово",
        }).success,
        false,
      );
    }
  });

  it("only exposes confirmed field content in public cards", () => {
    const task = createTask("Original draft text not approved for students");
    task.fields.context = "Подтверждённый контекст";
    task.fields.data = "Неподтверждённый материал";
    task.confirmedFields = ["context"];
    const visible = publicTask(task);
    assert.equal(visible.description, task.fields.context);
    assert.equal(visible.fields.need, "");
    assert.equal(visible.fields.data, "");
    assert.equal(task.fields.data, "Неподтверждённый материал");
  });
});
