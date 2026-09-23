import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, stages, tasks } from "@/shared/db/schema";
import { ApiError } from "@/shared/api/errors";
import type { DemoActor } from "@/shared/api/actor";
import { STAGE_CLAIMABLE } from "@/entities/proposal";

async function loadStageWithOwners(stageId: string) {
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId));
  if (!stage) {
    throw new ApiError(404, "not_found", "Этап не найден");
  }
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, stage.proposalId));
  if (!proposal) {
    throw new ApiError(404, "not_found", "Отклик не найден");
  }
  const [task] = await db.select().from(tasks).where(eq(tasks.id, proposal.taskId));
  if (!task) {
    throw new ApiError(404, "not_found", "Задача не найдена");
  }
  return { stage, proposal, task };
}

export async function claimStage(actor: DemoActor, stageId: string, input: { reportUrl: string; comment: string }) {
  const { proposal } = await loadStageWithOwners(stageId);
  if (actor.role !== "team" || actor.teamId !== proposal.teamId) {
    throw new ApiError(403, "forbidden", "Сдать этап может только команда-владелец отклика");
  }

  const [updated] = await db
    .update(stages)
    .set({ status: "claimed", reportUrl: input.reportUrl, teamComment: input.comment, claimedAt: new Date() })
    .where(and(eq(stages.id, stageId), inArray(stages.status, STAGE_CLAIMABLE)))
    .returning();
  if (!updated) {
    throw new ApiError(409, "conflict", "Этап нельзя сдать из текущего статуса");
  }
  return updated;
}

export async function returnStage(actor: DemoActor, stageId: string, input: { comment: string }) {
  const { task } = await loadStageWithOwners(stageId);
  if (actor.role !== "business" || actor.businessId !== task.businessId) {
    throw new ApiError(403, "forbidden", "Вернуть этап может только бизнес-владелец задачи");
  }

  const [updated] = await db
    .update(stages)
    .set({ status: "returned", businessComment: input.comment })
    .where(and(eq(stages.id, stageId), eq(stages.status, "claimed")))
    .returning();
  if (!updated) {
    throw new ApiError(409, "conflict", "Вернуть можно только сданный на проверку этап");
  }
  return updated;
}

export async function confirmStage(actor: DemoActor, stageId: string, input: { comment?: string }) {
  const { task, stage } = await loadStageWithOwners(stageId);
  if (actor.role !== "business" || actor.businessId !== task.businessId) {
    throw new ApiError(403, "forbidden", "Подтвердить этап может только бизнес-владелец задачи");
  }

  const [updated] = await db
    .update(stages)
    .set({
      status: "confirmed",
      points: 10,
      confirmedAt: new Date(),
      businessComment: input.comment ?? stage.businessComment,
    })
    .where(and(eq(stages.id, stageId), eq(stages.status, "claimed")))
    .returning();
  if (!updated) {
    throw new ApiError(409, "conflict", "Подтвердить можно только сданный на проверку этап");
  }
  return updated;
}
