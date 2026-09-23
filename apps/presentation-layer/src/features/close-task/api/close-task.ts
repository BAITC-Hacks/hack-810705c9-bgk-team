import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, tasks } from "@/shared/db/schema";
import { ApiError } from "@/shared/api/errors";
import type { DemoActor } from "@/shared/api/actor";

export async function closeTask(actor: DemoActor, taskId: string) {
  if (actor.role !== "business") {
    throw new ApiError(403, "forbidden", "Закрыть задачу может только бизнес");
  }
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) {
    throw new ApiError(404, "not_found", "Задача не найдена");
  }
  if (task.businessId !== actor.businessId) {
    throw new ApiError(403, "forbidden", "Это чужая задача");
  }

  return db.transaction(async (tx) => {
    const [hasAccepted] = await tx
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.taskId, taskId), eq(proposals.status, "accepted")))
      .limit(1);
    if (hasAccepted) {
      throw new ApiError(409, "conflict", "Нельзя закрыть задачу с выбранной командой");
    }

    const [closedTask] = await tx
      .update(tasks)
      .set({ status: "closed" })
      .where(and(eq(tasks.id, taskId), eq(tasks.status, "published")))
      .returning();
    if (!closedTask) {
      throw new ApiError(409, "conflict", "Задачу можно закрыть только из статуса «опубликована»");
    }

    const rejected = await tx
      .update(proposals)
      .set({ status: "rejected", rejectReason: "task_closed", decidedAt: new Date() })
      .where(and(eq(proposals.taskId, taskId), inArray(proposals.status, ["submitted", "on_hold"])))
      .returning();

    return { task: closedTask, rejectedCount: rejected.length };
  });
}
