import { eq } from "drizzle-orm";

import {
  catalogPlace,
  levelOf,
  score,
  type RankedTask,
  type ScoreNode,
} from "@/entities/task";
import type { db } from "@/shared/db";
import { scoreEvent, task, type ScoreEventRow } from "@/shared/db/schema";

import { loadScoreCard, type Executor } from "./load-score-card";

export type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

export type RecalculateResult = {
  before: number;
  after: number;
  changed: boolean;
  event: ScoreEventRow | null;
};

/**
 * Место задачи с рейтингом `taskScore` среди опубликованных (FR-4.4).
 * Для неопубликованной задачи — гипотетическое место (ADR-005 п. 4).
 */
export async function placeOf(
  executor: Executor,
  self: { id: string; status: string; publishedAt: Date | null },
  taskScore: number,
): Promise<number> {
  const published = await executor
    .select({ id: task.id, score: task.score, publishedAt: task.publishedAt })
    .from(task)
    .where(eq(task.status, "published"));
  return placeIn(published, self, taskScore);
}

function placeIn(
  published: RankedTask[],
  self: { id: string; status: string; publishedAt: Date | null },
  taskScore: number,
): number {
  const ranked: RankedTask = { id: self.id, score: taskScore, publishedAt: self.publishedAt };
  const others = published.filter((row) => row.id !== self.id);
  const list = self.status === "published" ? [...others, ranked] : others;
  return catalogPlace(ranked, list);
}

/**
 * Единственный код, который пишет task.score (ADR-005 п. 2).
 * Вызывается в транзакции подтверждения/правки поля. score_event пишется
 * только при изменении рейтинга (FR-3.8 трактуется как журнал изменений).
 */
export async function recalculateScore(
  tx: Tx,
  taskId: string,
  causeNode: ScoreNode | "task",
): Promise<RecalculateResult> {
  const [current] = await tx
    .select({ score: task.score, status: task.status, publishedAt: task.publishedAt })
    .from(task)
    .where(eq(task.id, taskId))
    .for("update");
  if (!current) throw new Error(`Task ${taskId} not found`);

  const card = await loadScoreCard(tx, taskId);
  if (!card) throw new Error(`Task ${taskId} not found`);

  const before = current.score;
  const after = score(card).total;
  if (after === before) return { before, after, changed: false, event: null };

  const published = await tx
    .select({ id: task.id, score: task.score, publishedAt: task.publishedAt })
    .from(task)
    .where(eq(task.status, "published"));
  const self = { id: taskId, status: current.status, publishedAt: current.publishedAt };

  await tx.update(task).set({ score: after }).where(eq(task.id, taskId));
  const [event] = await tx
    .insert(scoreEvent)
    .values({
      taskId,
      before,
      after,
      levelBefore: levelOf(before),
      levelAfter: levelOf(after),
      node: causeNode,
      placeBefore: placeIn(published, self, before),
      placeAfter: placeIn(published, self, after),
    })
    .returning();

  return { before, after, changed: true, event };
}
