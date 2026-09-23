import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { levelOf } from "./level";
import { NODE_META, SCORE_NODES, type ScoreNode } from "./nodes";
import { ARTIFACT_TYPE_PATTERN, score, type ScoreCard } from "./score";
import {
  SEED_CARDS,
  appendixDraft,
  appendixStep1,
  appendixStep2,
  appendixStep3,
  appendixStep4,
  confirmed,
  criterion,
  emptyCard,
  notApplicable,
  suggested,
} from "./score.fixtures";

type FieldNode = keyof ScoreCard["fields"];

function pointsOf(card: ScoreCard, node: ScoreNode): number {
  const line = score(card).lines.find((item) => item.node === node);
  assert.ok(line);
  return line.points;
}

function withField(node: FieldNode, value: string): number {
  const card = emptyCard();
  card.fields[node] = confirmed(value);
  return pointsOf(card, node);
}

describe("таблица узлов", () => {
  it("сумма максимумов равна 100", () => {
    const sum = SCORE_NODES.reduce((acc, node) => acc + NODE_META[node].max, 0);
    assert.equal(sum, 100);
    assert.equal(NODE_META["criteria.items"].max, 15);
  });

  it("всегда 17 строк в порядке таблицы, сумма строк равна total", () => {
    for (const card of [emptyCard(), appendixStep4(), SEED_CARDS[0].card]) {
      const result = score(card);
      assert.deepEqual(
        result.lines.map((line) => line.node),
        [...SCORE_NODES],
      );
      assert.equal(
        result.lines.reduce((acc, line) => acc + line.points, 0),
        result.total,
      );
    }
  });
});

describe("правила узлов", () => {
  const confirmedOnly: [FieldNode, number][] = [
    ["context.current", 5],
    ["context.change", 10],
    ["data.what", 10],
    ["result.acceptance", 5],
    ["users.role", 5],
    ["users.scale", 5],
    ["link.cadence", 3],
    ["constraints.other", 3],
  ];

  for (const [node, max] of confirmedOnly)
    it(`${node}: баллы только за подтверждённый непустой ответ`, () => {
      assert.equal(withField(node, "Согласованный ответ"), max);
      assert.equal(withField(node, "   "), 0);

      const card = emptyCard();
      card.fields[node] = suggested("Согласованный ответ");
      assert.equal(pointsOf(card, node), 0);
      card.fields[node] = { value: "x", state: "empty", notApplicable: false };
      assert.equal(pointsOf(card, node), 0);
    });

  it("«не применимо» даёт 0, кроме constraints.other", () => {
    for (const node of SCORE_NODES) {
      if (node === "criteria.items" || node === "constraints.stack") continue;
      const card = emptyCard();
      card.fields[node] = notApplicable("нет");
      const expected = node === "constraints.other" ? 3 : 0;
      assert.equal(pointsOf(card, node), expected, node);
    }
  });

  it("неподтверждённое «не применимо» не засчитывается", () => {
    const card = emptyCard();
    card.fields["constraints.other"] = {
      value: "",
      state: "suggested",
      notApplicable: true,
    };
    assert.equal(pointsOf(card, "constraints.other"), 0);
  });

  it("context.size: нужно число", () => {
    assert.equal(withField("context.size", "300 обращений в день"), 5);
    assert.equal(withField("context.size", "очень много обращений"), 0);
  });

  it("data.volume: число или период", () => {
    assert.equal(withField("data.volume", "выгрузка чата за 6 мес."), 5);
    assert.equal(withField("data.volume", "за последний квартал"), 5);
    assert.equal(withField("data.volume", "история за год"), 5);
    assert.equal(withField("data.volume", "несколько недель"), 5);
    assert.equal(withField("data.volume", "большой архив"), 0);
  });

  it("data.sample: URL или ≥3 строк таблицы", () => {
    assert.equal(
      withField("data.sample", "https://api.logistics.example/swagger"),
      5,
    );
    assert.equal(withField("data.sample", "a|b\n1|2\n3|4"), 5);
    assert.equal(withField("data.sample", "a\tb\n1\t2\n3\t4"), 5);
    assert.equal(withField("data.sample", "a;b\n1;2"), 0);
    assert.equal(withField("data.sample", "api.example/swagger"), 0);
    assert.equal(withField("data.sample", "пришлём позже"), 0);
  });

  it("result.artifact: тип и описание", () => {
    assert.equal(
      withField("result.artifact", "Telegram-бот для ответов о статусе заказа"),
      10,
    );
    assert.equal(
      withField("result.artifact", "Дашборд продаж по регионам"),
      10,
    );
    assert.equal(withField("result.artifact", "REST API для склада"), 10);
    assert.equal(withField("result.artifact", "бот"), 0);
    assert.equal(withField("result.artifact", "чат-бот"), 0);
    assert.equal(withField("result.artifact", "Хорошая работа команды"), 0);
    assert.ok(ARTIFACT_TYPE_PATTERN.test("Telegram-бот"));
    assert.ok(!ARTIFACT_TYPE_PATTERN.test("работа"));
  });

  it("constraints.deadline: дата или срок", () => {
    assert.equal(withField("constraints.deadline", "до 15.12"), 4);
    assert.equal(withField("constraints.deadline", "до конца марта"), 4);
    assert.equal(withField("constraints.deadline", "две недели"), 4);
    assert.equal(withField("constraints.deadline", "как можно скорее"), 0);
  });

  it("link.contact: email или мессенджер", () => {
    assert.equal(withField("link.contact", "it@logistics.example"), 4);
    assert.equal(withField("link.contact", "@logistics_it"), 4);
    assert.equal(withField("link.contact", "https://t.me/logistics"), 4);
    assert.equal(withField("link.contact", "WhatsApp отдела"), 4);
    assert.equal(withField("link.contact", "+7 (701) 555-12-34"), 4);
    assert.equal(withField("link.contact", "Иван из ИТ"), 0);
  });

  it("link.response: число дней", () => {
    assert.equal(withField("link.response", "3 дня"), 3);
    assert.equal(withField("link.response", "в течение 2 рабочих дней"), 3);
    assert.equal(withField("link.response", "1 день"), 3);
    assert.equal(withField("link.response", "5 дн."), 3);
    assert.equal(withField("link.response", "ответим быстро"), 0);
    assert.equal(withField("link.response", "24 часа"), 0);
  });

  it("criteria.items: 5 с числом, 2 без, не больше трёх, по позиции", () => {
    const card = emptyCard();
    card.criteria = [
      criterion(4, "четвёртый", "10"),
      criterion(1, "точность", "≥ 90%"),
      criterion(2, "удобство", "нравится пользователям"),
      criterion(3, "скорость", "< 2 с"),
    ];
    assert.equal(pointsOf(card, "criteria.items"), 12);

    card.criteria = [
      criterion(1, "точность", "90%", "suggested"),
      criterion(2, "", "5"),
      criterion(3, "скорость", " "),
    ];
    assert.equal(pointsOf(card, "criteria.items"), 0);

    card.criteria = [
      { ...criterion(1, "качество", "высокое"), thresholdHasNumber: true },
    ];
    assert.equal(pointsOf(card, "criteria.items"), 5);
  });

  it("constraints.stack: подтверждены и роли, и навыки", () => {
    const card = emptyCard();
    card.tags = { state: "confirmed", roles: ["backend"], skills: ["Python"] };
    assert.equal(pointsOf(card, "constraints.stack"), 3);
    card.tags = { state: "suggested", roles: ["backend"], skills: ["Python"] };
    assert.equal(pointsOf(card, "constraints.stack"), 0);
    card.tags = { state: "confirmed", roles: ["backend"], skills: [] };
    assert.equal(pointsOf(card, "constraints.stack"), 0);
    card.tags = { state: "confirmed", roles: [], skills: ["Python"] };
    assert.equal(pointsOf(card, "constraints.stack"), 0);
  });

  it("длина текста не влияет на баллы", () => {
    assert.equal(
      withField("context.current", "Да"),
      withField("context.current", "Очень подробно. ".repeat(200)),
    );
  });
});

describe("Приложение А", () => {
  const steps: [string, () => ScoreCard, number, string][] = [
    ["черновик", appendixDraft, 24, "draft"],
    ["дополнение 1", appendixStep1, 44, "working"],
    ["дополнение 2", appendixStep2, 59, "working"],
    ["результат", appendixStep3, 74, "ready"],
    ["роли и навыки", appendixStep4, 77, "ready"],
  ];

  for (const [name, build, total, level] of steps)
    it(`${name}: ${total}`, () => {
      const result = score(build());
      assert.equal(result.total, total);
      assert.equal(levelOf(result.total), level);
    });
});

describe("seed-рейтинги", () => {
  for (const seed of SEED_CARDS)
    it(`${seed.theme}: ${seed.expected}`, () => {
      assert.equal(score(seed.card).total, seed.expected);
    });

  it("ровно 91 / 76 / 58 / 41 / 27", () => {
    assert.deepEqual(
      SEED_CARDS.map((seed) => score(seed.card).total),
      [91, 76, 58, 41, 27],
    );
  });
});

describe("сценарии T-6 и T-7", () => {
  it("T-6: правка подтверждённого поля снимает его баллы", () => {
    const card = appendixStep4();
    const before = score(card).total;
    const field = card.fields["result.artifact"];
    assert.ok(field);
    card.fields["result.artifact"] = { ...field, state: "suggested" };
    assert.equal(score(card).total, before - 10);
  });

  it("T-7: формат работы и оплата не меняют рейтинг", () => {
    const card = appendixStep4();
    const withExtras = {
      ...card,
      format: "подработка",
      payment: "оплата за каждый принятый этап",
      engagement: "practice",
      swipes: 100,
      proposals: 12,
    } as ScoreCard;
    assert.equal(score(withExtras).total, score(card).total);
    withExtras.fields = {
      ...card.fields,
      format: confirmed("практика"),
    } as ScoreCard["fields"];
    assert.equal(score(withExtras).total, score(card).total);
  });
});

describe("недостающие сведения и следующий шаг", () => {
  it("черновик 24: следующий шаг — самый весомый открытый узел", () => {
    const result = score(appendixDraft());
    assert.deepEqual(result.nextStep, {
      node: "criteria.items",
      gain: 15,
      levelAfter: "draft",
    });
    assert.deepEqual(result.missing.slice(0, 3), [
      { node: "criteria.items", weight: 15 },
      { node: "data.what", weight: 10 },
      { node: "result.artifact", weight: 10 },
    ]);
    assert.ok(result.missing.every((item) => item.weight > 0));
    assert.equal(
      result.missing.reduce((acc, item) => acc + item.weight, 0),
      100 - result.total,
    );
  });

  it("полная карточка: 100 и нет следующего шага", () => {
    const card = appendixStep4();
    Object.assign(card.fields, {
      "constraints.deadline": confirmed("8 недель"),
      "constraints.other": notApplicable("ограничений нет"),
      "users.scale": confirmed("около 2000 клиентов в день"),
      "link.cadence": confirmed("созвон раз в неделю"),
      "link.response": confirmed("3 дня"),
    });
    card.criteria.push(criterion(3, "доля ошибок", "< 5%"));
    const result = score(card);
    assert.equal(result.total, 100);
    assert.deepEqual(result.missing, []);
    assert.equal(result.nextStep, null);
  });

  it("один критерий без числа: вес недостающего 13", () => {
    const card = emptyCard();
    card.criteria = [criterion(1, "удобство", "нравится операторам")];
    const item = score(card).missing.find(
      (entry) => entry.node === "criteria.items",
    );
    assert.deepEqual(item, { node: "criteria.items", weight: 13 });
  });

  it("levelAfter учитывает прирост", () => {
    const result = score(appendixStep1());
    assert.equal(result.total, 44);
    assert.deepEqual(result.nextStep, {
      node: "criteria.items",
      gain: 15,
      levelAfter: "working",
    });

    const ready = score(appendixStep3());
    assert.equal(ready.total, 74);
    assert.deepEqual(ready.nextStep, {
      node: "criteria.items",
      gain: 5,
      levelAfter: "ready",
    });
  });

  it("«не применимо» и ветка «данных нет» исключены из недостающих", () => {
    const card = appendixDraft();
    card.fields["data.what"] = notApplicable("данных нет, соберёт отдел ИТ");
    card.fields["users.scale"] = notApplicable("не знаем");
    const nodes = score(card).missing.map((item) => item.node);
    for (const node of [
      "data.what",
      "data.volume",
      "data.sample",
      "users.scale",
    ])
      assert.ok(!nodes.includes(node as ScoreNode), node);
    assert.ok(nodes.includes("result.artifact"));
  });

  it("при равном весе сохраняется порядок таблицы", () => {
    const nodes = score(emptyCard()).missing.map((item) => item.node);
    assert.deepEqual(nodes.slice(0, 4), [
      "criteria.items",
      "context.change",
      "data.what",
      "result.artifact",
    ]);
  });
});
