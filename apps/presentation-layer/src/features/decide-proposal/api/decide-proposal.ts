import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { criteria, fields, proposals, stages, tasks } from "@/shared/db/schema";
import { ApiError } from "@/shared/api/errors";
import type { DemoActor } from "@/shared/api/actor";
import type { DecisionInput } from "@/shared/api/contracts/proposals";
import { TASK_STATUSES_ALLOWING_ACCEPT } from "@/entities/proposal";
import { buildKickoff } from "@/entities/task";

async function loadOwnedProposal(actor: DemoActor, proposalId: string) {
  if (actor.role !== "business") {
    throw new ApiError(403, "forbidden", "Решение по отклику принимает бизнес");
  }
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId));
  if (!proposal) {
    throw new ApiError(404, "not_found", "Отклик не найден");
  }
  const [task] = await db.select().from(tasks).where(eq(tasks.id, proposal.taskId));
  if (!task) {
    throw new ApiError(404, "not_found", "Задача не найдена");
  }
  if (task.businessId !== actor.businessId) {
    throw new ApiError(403, "forbidden", "Это отклик на чужую задачу");
  }
  return { proposal, task };
}

export async function decideProposal(actor: DemoActor, proposalId: string, input: DecisionInput) {
  const { task } = await loadOwnedProposal(actor, proposalId);

  if (input.action === "reject") {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(proposals)
        .set({
          status: "rejected",
          rejectReason: input.reason,
          rejectNote: input.note,
          decidedAt: new Date(),
        })
        .where(and(eq(proposals.id, proposalId), inArray(proposals.status, ["submitted", "on_hold"])))
        .returning();
      if (!updated) {
        throw new ApiError(409, "conflict", "Решение по отклику уже принято");
      }
      return { proposal: updated };
    });
  }

  if (input.action === "on_hold" || input.action === "submitted") {
    // Переключение допустимо только со статуса, отличного от целевого.
    const from = input.action === "on_hold" ? "submitted" : "on_hold";
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(proposals)
        .set({ status: input.action, updatedAt: new Date() })
        .where(and(eq(proposals.id, proposalId), eq(proposals.status, from)))
        .returning();
      if (!updated) {
        throw new ApiError(409, "conflict", "Недопустимый переход статуса отклика");
      }
      return { proposal: updated };
    });
  }

  // accept
  return db.transaction(async (tx) => {
    // Сначала строка задачи (тот же порядок блокировок, что в closeTask):
    // published → in_work, in_work остаётся in_work; закрытая задача → 409.
    const [currentTask] = await tx
      .update(tasks)
      .set({ status: "in_work" })
      .where(and(eq(tasks.id, task.id), inArray(tasks.status, [...TASK_STATUSES_ALLOWING_ACCEPT])))
      .returning();
    if (!currentTask) {
      throw new ApiError(409, "conflict", "Задача закрыта или не опубликована");
    }

    const [accepted] = await tx
      .update(proposals)
      .set({ status: "accepted", acceptedAt: new Date(), decidedAt: new Date() })
      .where(and(eq(proposals.id, proposalId), inArray(proposals.status, ["submitted", "on_hold"])))
      .returning();
    if (!accepted) {
      throw new ApiError(409, "conflict", "Решение по отклику уже принято");
    }

    const taskFields = await tx.select().from(fields).where(eq(fields.taskId, task.id));
    const confirmedCriteria = await tx
      .select()
      .from(criteria)
      .where(
        and(
          eq(criteria.taskId, task.id),
          eq(criteria.version, currentTask.criteriaVersion),
          eq(criteria.state, "confirmed"),
        ),
      );

    const kickoff = buildKickoff({
      engagement: currentTask.engagement,
      compensationNote: currentTask.compensationNote,
      fields: taskFields.map((f) => ({ node: f.node, value: f.value, state: f.state, notApplicable: f.notApplicable })),
      criteria: confirmedCriteria.map((c) => ({
        id: c.id,
        metric: c.metric,
        threshold: c.threshold,
        position: c.position,
        confirmed: c.state === "confirmed",
      })),
    });

    const [withKickoff] = await tx
      .update(proposals)
      .set({ kickoff })
      .where(eq(proposals.id, proposalId))
      .returning();

    const newStages = confirmedCriteria.length
      ? await tx
          .insert(stages)
          .values(
            confirmedCriteria.map((c) => ({
              proposalId,
              criterionId: c.id,
              criteriaVersion: c.version,
              position: c.position,
              metric: c.metric,
              threshold: c.threshold,
              howToCheck: c.howToCheck,
            })),
          )
          .returning()
      : [];

    return { proposal: withKickoff, stages: newStages };
  });
}
