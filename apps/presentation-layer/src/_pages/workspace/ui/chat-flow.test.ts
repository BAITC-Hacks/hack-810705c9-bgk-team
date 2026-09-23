import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyGrillPackage,
  getDemoData,
  type Task,
} from "@/entities/workspace";
import {
  parseRatingReport,
  type RatingReport,
} from "@/shared/api/contracts/assistant";
import {
  formatRatingMessage,
  parseRoundAnswers,
  parseTargetLanguages,
} from "./chat-flow";

describe("parseRatingReport", () => {
  const valid = {
    score: 86,
    level: "ready",
    verdict: "Можно начинать.",
    breakdown: [
      {
        criterion: "context_and_need",
        max: 20,
        awarded: 18,
        justification: "ок",
      },
    ],
    missing: ["Контакт бизнеса"],
    recalculation: {
      firstEvaluation: false,
      previousScore: 22,
      delta: 64,
      closedItems: ["Данные"],
    },
  };

  it("parses strict JSON and fenced JSON", () => {
    assert.equal(parseRatingReport(JSON.stringify(valid))?.score, 86);
    assert.equal(
      parseRatingReport(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``)?.level,
      "ready",
    );
  });

  it("falls back to core {score, level} and rejects garbage", () => {
    const core = parseRatingReport('{"score":45,"level":"working"}');
    assert.equal(core?.score, 45);
    assert.equal(core?.breakdown.length, 0);
    assert.equal(parseRatingReport("не json"), null);
    assert.equal(parseRatingReport('{"score":120,"level":"ready"}'), null);
  });
});

describe("grill round answers", () => {
  const questions = [
    { id: "baseline", text: "Какой базовый показатель?" },
    { id: "target", text: "Какой целевой?" },
    { id: "owner", text: "Кто отвечает?" },
  ];

  it("maps numbered lines to questions in order", () => {
    const answers = parseRoundAnswers(
      "1) 12% хлеба\n2. 5% к декабрю\n3) Я",
      questions,
    );
    assert.deepEqual(
      answers.map((a) => [a.questionId, a.value]),
      [
        ["baseline", "12% хлеба"],
        ["target", "5% к декабрю"],
        ["owner", "Я"],
      ],
    );
    assert.ok(answers.every((a) => a.kind === "answer"));
  });

  it("takes whole text for one question and detects dont-know", () => {
    const one = parseRoundAnswers("Меряли вчера", [questions[0]]);
    assert.deepEqual(one, [
      { questionId: "baseline", kind: "answer", value: "Меряли вчера" },
    ]);
    const dontKnow = parseRoundAnswers("не знаю", questions);
    assert.equal(dontKnow[0].kind, "dont-know");
    assert.deepEqual(parseRoundAnswers("   ", questions), []);
  });
});

describe("translator languages", () => {
  it("parses Russian names and BCP-47-ish tokens", () => {
    assert.deepEqual(parseTargetLanguages("Русский, English, kk"), [
      "ru",
      "en",
      "kk",
    ]);
    assert.deepEqual(parseTargetLanguages("просто текст"), []);
  });
});

describe("rating message", () => {
  it("renders score, breakdown, missing and recalculation", () => {
    const report: RatingReport = {
      score: 86,
      level: "ready",
      verdict: "Задачу понятно.",
      breakdown: [
        {
          criterion: "context_and_need",
          max: 20,
          awarded: 18,
          justification: "",
        },
      ],
      missing: ["Контакт"],
      recalculation: {
        firstEvaluation: false,
        previousScore: 22,
        delta: 64,
        closedItems: [],
      },
    };
    const text = formatRatingMessage(report);
    assert.match(text, /Готовность: 86 \/ 100 · Готовая/);
    assert.match(text, /Контекст и потребность: 18 \/ 20/);
    assert.match(text, /было 22 → стало 86 \(Δ\+64\)/);
  });
});

describe("applyGrillPackage", () => {
  it("fills fields from artifacts and confirms them, keeps data unchanged", () => {
    const data = getDemoData();
    const task: Task = { ...data.tasks[0], confirmedFields: ["need"] };
    const snapshot = JSON.stringify(data);
    const updated = applyGrillPackage(task, {
      package: {
        summary: "Итог",
        artifacts: {
          smart: {
            statement: "Снизить списания",
            measurable: { baseline: "12%", target: "5%" },
            timeBound: { deadline: "31 декабря", checkpoint: "15 октября" },
          },
          userStory: {
            statement: "Управляющему нужен прогноз",
            role: "Управляющий",
            action: "видит",
            value: "меньше отходов",
          },
          jobStory: { statement: "Вечером не хлеба" },
          criteria: null,
        },
        disagreements: [],
      },
      translations: [],
    });
    assert.equal(updated.fields.success, "12% → 5% к 31 декабря");
    assert.equal(
      updated.fields.constraints,
      "Срок: 31 декабря; чекпоинт: 15 октября",
    );
    assert.equal(updated.fields.outcome, "Снизить списания");
    assert.equal(updated.fields.users, "Управляющему нужен прогноз");
    assert.equal(updated.fields.need, "Вечером не хлеба");
    assert.ok(updated.confirmedFields.includes("success"));
    assert.ok(updated.confirmedFields.includes("outcome"));
    assert.equal(JSON.stringify(data), snapshot);
  });
});
