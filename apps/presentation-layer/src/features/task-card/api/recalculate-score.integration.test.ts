import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/shared/db/schema";
import { scoreEvent, task, taskField } from "@/shared/db/schema";

import { checkScoreConsistency, getScore } from "./get-score";
import { recalculateScore } from "./recalculate-score";

// Запуск только против одноразовой БД с применённой схемой ADR-005:
// DATABASE_URL_ADR005_TEST=postgres://... bun test recalculate-score.integration
const url = process.env.DATABASE_URL_ADR005_TEST;

// Bun не учитывает опцию { skip } из node:test, поэтому выбираем describe.skip явно.
const suite = url ? describe : describe.skip;

suite("recalculateScore (Postgres)", () => {
  const pool = new Pool({ connectionString: url });
  const testDb = drizzle(pool, { schema });
  let draftId = "";

  const createdIds: string[] = [];

  before(async () => {
    // Одноразовая БД: пустая таблица нужна для проверки мест и сверки.
    const [existing] = await testDb.select({ id: task.id }).from(task).limit(1);
    if (existing)
      throw new Error(
        "DATABASE_URL_ADR005_TEST must point to an empty throwaway DB",
      );
    const seeded = await testDb
      .insert(task)
      .values([
        {
          title: "A",
          status: "published",
          score: 76,
          publishedAt: new Date("2026-09-01"),
        },
        {
          title: "B",
          status: "published",
          score: 41,
          publishedAt: new Date("2026-09-02"),
        },
        {
          title: "C",
          status: "published",
          score: 20,
          publishedAt: new Date("2026-09-03"),
        },
      ])
      .returning({ id: task.id });
    createdIds.push(...seeded.map((row) => row.id));
    const [draft] = await testDb
      .insert(task)
      .values({ title: "Логистика", workFormat: "подработка" })
      .returning({ id: task.id });
    draftId = draft.id;
    createdIds.push(draft.id);
  });

  after(async () => {
    if (createdIds.length)
      await testDb.delete(task).where(inArray(task.id, createdIds));
    await pool.end();
  });

  it("Приложение А, черновик: 0 → 24 с событием и местом", async () => {
    await testDb.insert(taskField).values(
      [
        [
          "context.current",
          "Операторы весь день отвечают клиентам, где их заказ",
        ],
        ["context.change", "Клиент узнаёт статус заказа без оператора"],
        ["users.role", "клиенты"],
        ["link.contact", "it@logistics.example"],
      ].map(([node, value]) => ({
        taskId: draftId,
        node,
        value,
        state: "confirmed",
        source: "draft",
        confirmedAt: new Date(),
      })),
    );

    const result = await testDb.transaction((tx) =>
      recalculateScore(tx, draftId, "context.current"),
    );
    assert.equal(result.before, 0);
    assert.equal(result.after, 24);
    assert.equal(result.changed, true);
    assert.equal(result.event?.levelBefore, "draft");
    assert.equal(result.event?.levelAfter, "draft");
    // Гипотетическое место: 1 + число опубликованных с рейтингом >= s.
    assert.equal(result.event?.placeBefore, 4);
    assert.equal(result.event?.placeAfter, 3);

    const [row] = await testDb.select().from(task).where(eq(task.id, draftId));
    assert.equal(row.score, 24);
    const events = await testDb
      .select()
      .from(scoreEvent)
      .where(eq(scoreEvent.taskId, draftId));
    assert.equal(events.length, 1);
  });

  it("T-7: смена формата работы не меняет рейтинг и не пишет событие", async () => {
    const result = await testDb.transaction(async (tx) => {
      await tx
        .update(task)
        .set({ workFormat: "проектная" })
        .where(eq(task.id, draftId));
      return recalculateScore(tx, draftId, "task");
    });
    assert.deepEqual(
      {
        before: result.before,
        after: result.after,
        changed: result.changed,
        event: result.event,
      },
      { before: 24, after: 24, changed: false, event: null },
    );
    const events = await testDb
      .select()
      .from(scoreEvent)
      .where(eq(scoreEvent.taskId, draftId));
    assert.equal(events.length, 1);
  });

  it("T-6: правка подтверждённого поля снимает баллы и пишет «было → стало»", async () => {
    const result = await testDb.transaction(async (tx) => {
      await tx
        .update(taskField)
        .set({ state: "suggested", source: "manual", confirmedAt: null })
        .where(
          and(
            eq(taskField.taskId, draftId),
            eq(taskField.node, "context.change"),
          ),
        );
      return recalculateScore(tx, draftId, "context.change");
    });
    assert.equal(result.before, 24);
    assert.equal(result.after, 14);
    assert.equal(result.event?.node, "context.change");

    const events = await testDb
      .select()
      .from(scoreEvent)
      .where(eq(scoreEvent.taskId, draftId));
    assert.equal(events.length, 2);

    const view = await getScore(draftId, testDb);
    assert.ok(view);
    assert.equal(view.total, 14);
    assert.equal(view.level, "draft");
    assert.equal(view.place, 4);
    assert.deepEqual(
      view.lastChange && {
        before: view.lastChange.before,
        after: view.lastChange.after,
        node: view.lastChange.node,
        placeBefore: view.lastChange.placeBefore,
        placeAfter: view.lastChange.placeAfter,
      },
      {
        before: 24,
        after: 14,
        node: "context.change",
        placeBefore: 3,
        placeAfter: 4,
      },
    );
  });

  it("getScore возвращает null для несуществующей задачи", async () => {
    assert.equal(
      await getScore("00000000-0000-4000-8000-000000000000", testDb),
      null,
    );
  });

  it("dev-сверка находит только задачи с прописанным в обход score()", async () => {
    // Опубликованные задачи засеяны числом без полей — ровно то, что ловит сверка.
    const mismatches = await checkScoreConsistency(testDb);
    assert.equal(mismatches.length, 3);
    assert.ok(!mismatches.some((m) => m.taskId === draftId));
  });
});
