import { asc, eq } from "drizzle-orm";

import {
  SCORE_NODES,
  type FieldState,
  type ScoreCard,
  type ScoreNode,
} from "@/entities/task";
import type { db } from "@/shared/db";
import { criterion, task, taskField } from "@/shared/db/schema";

import type { Tx } from "./recalculate-score";

export type Executor = typeof db | Tx;

type CardFieldNode = keyof ScoreCard["fields"];

// Узлы, которые не хранятся в task_field: критерии — в criterion, стек — в тегах task.
const NON_FIELD_NODES: readonly ScoreNode[] = ["criteria.items", "constraints.stack"];

function isCardFieldNode(node: string): node is CardFieldNode {
  return (
    (SCORE_NODES as readonly string[]).includes(node) &&
    !NON_FIELD_NODES.includes(node as ScoreNode)
  );
}

function toFieldState(state: string): FieldState {
  return state === "confirmed" || state === "suggested" ? state : "empty";
}

/** Собирает вход score() из строк БД. Нет строки task_field — узел пуст. */
export async function loadScoreCard(
  executor: Executor,
  taskId: string,
): Promise<ScoreCard | null> {
  const [taskRow] = await executor
    .select({
      tagsState: task.tagsState,
      neededRoles: task.neededRoles,
      neededSkills: task.neededSkills,
    })
    .from(task)
    .where(eq(task.id, taskId));
  if (!taskRow) return null;

  const [fieldRows, criterionRows] = await Promise.all([
    executor.select().from(taskField).where(eq(taskField.taskId, taskId)),
    executor
      .select()
      .from(criterion)
      .where(eq(criterion.taskId, taskId))
      .orderBy(asc(criterion.position)),
  ]);

  const fields: ScoreCard["fields"] = {};
  for (const row of fieldRows) {
    if (!isCardFieldNode(row.node)) continue;
    fields[row.node] = {
      value: row.value,
      state: toFieldState(row.state),
      notApplicable: row.notApplicable,
    };
  }

  return {
    fields,
    criteria: criterionRows.map((row) => ({
      position: row.position,
      metric: row.metric,
      threshold: row.threshold,
      thresholdHasNumber: row.thresholdHasNumber ?? undefined,
      state: toFieldState(row.state),
    })),
    tags: {
      state: taskRow.tagsState === "confirmed" ? "confirmed" : "suggested",
      roles: taskRow.neededRoles,
      skills: taskRow.neededSkills,
    },
  };
}
