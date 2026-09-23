import { desc, eq } from "drizzle-orm";

import { LEVEL_LABELS, levelOf, score } from "@/entities/task";
import type { TaskScoreResponse } from "@/shared/api/contracts/score";
import { db } from "@/shared/db";
import { scoreEvent, task } from "@/shared/db/schema";

import { loadScoreCard, type Executor } from "./load-score-card";
import { placeOf } from "./recalculate-score";

/**
 * Расшифровка рейтинга для серверных компонентов и GET /api/tasks/:id/score.
 * Считается на лету из score() и последней записи score_event.
 */
export async function getScore(
  taskId: string,
  executor: Executor = db,
): Promise<TaskScoreResponse | null> {
  const [taskRow] = await executor
    .select({
      id: task.id,
      score: task.score,
      status: task.status,
      publishedAt: task.publishedAt,
    })
    .from(task)
    .where(eq(task.id, taskId));
  if (!taskRow) return null;

  const card = await loadScoreCard(executor, taskId);
  if (!card) return null;

  const result = score(card);
  const level = levelOf(result.total);
  // Место — по task.score, как сортирует каталог.
  const place = await placeOf(executor, taskRow, taskRow.score);

  const [last] = await executor
    .select()
    .from(scoreEvent)
    .where(eq(scoreEvent.taskId, taskId))
    .orderBy(desc(scoreEvent.at))
    .limit(1);

  return {
    taskId,
    total: result.total,
    level,
    levelLabel: LEVEL_LABELS[level],
    lines: result.lines,
    missing: result.missing,
    nextStep: result.nextStep,
    place,
    lastChange: last
      ? {
          before: last.before,
          after: last.after,
          levelBefore: levelOf(last.before),
          levelAfter: levelOf(last.after),
          placeBefore: last.placeBefore,
          placeAfter: last.placeAfter,
          node: last.node as NonNullable<TaskScoreResponse["lastChange"]>["node"],
          at: last.at.toISOString(),
        }
      : null,
  };
}

export type ScoreMismatch = { taskId: string; stored: number; computed: number };

/** Dev-сверка «score() ≡ task.score» (ADR-005, последствия). */
export async function checkScoreConsistency(
  executor: Executor = db,
): Promise<ScoreMismatch[]> {
  const rows = await executor.select({ id: task.id, score: task.score }).from(task);
  const mismatches: ScoreMismatch[] = [];
  for (const row of rows) {
    const card = await loadScoreCard(executor, row.id);
    if (!card) continue;
    const computed = score(card).total;
    if (computed !== row.score) {
      mismatches.push({ taskId: row.id, stored: row.score, computed });
    }
  }
  return mismatches;
}
