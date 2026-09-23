import { and, asc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { criteria, proposals, tasks, teams } from "@/shared/db/schema";
import { ApiError } from "@/shared/api/errors";
import type { DemoActor } from "@/shared/api/actor";
import { compareProposals, computeFit } from "@/entities/proposal";

export async function listTaskProposals(actor: DemoActor, taskId: string) {
  if (actor.role !== "business") {
    throw new ApiError(403, "forbidden", "Список откликов доступен бизнесу");
  }
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) {
    throw new ApiError(404, "not_found", "Задача не найдена");
  }
  if (task.businessId !== actor.businessId) {
    throw new ApiError(403, "forbidden", "Это чужая задача");
  }

  const rows = await db
    .select({
      id: proposals.id,
      teamId: proposals.teamId,
      teamName: teams.name,
      fit: proposals.fit,
      teamProfile: {
        roles: teams.roles,
        skills: teams.skills,
        technologies: teams.technologies,
        interests: teams.interests,
      },
      createdAt: proposals.createdAt,
      status: proposals.status,
      criteriaAnswers: proposals.criteriaAnswers,
    })
    .from(proposals)
    .innerJoin(teams, eq(teams.id, proposals.teamId))
    .where(eq(proposals.taskId, taskId));

  const currentCriteria = await db
    .select()
    .from(criteria)
    .where(
      and(
        eq(criteria.taskId, taskId),
        eq(criteria.version, task.criteriaVersion),
        eq(criteria.state, "confirmed"),
      ),
    )
    .orderBy(asc(criteria.position));

  // Only archived proposal IDs came from workspace-v1 without an ADR-006
  // fit snapshot. New responses to a migrated task retain their stored fit.
  const archivedProposals = task.legacyWorkspace?.proposals;
  const migratedIds = new Set<string>();
  if (Array.isArray(archivedProposals)) {
    for (const archived of archivedProposals) {
      if (archived && typeof archived === "object" && "id" in archived && typeof archived.id === "string") {
        migratedIds.add(archived.id);
      }
    }
  }
  const comparedRows = rows.map(({ teamProfile, ...proposal }) => ({
    ...proposal,
    fit: migratedIds.has(proposal.id) ? computeFit(task, teamProfile) : proposal.fit,
  }));

  return compareProposals(
    currentCriteria.map((c) => ({ id: c.id, metric: c.metric, threshold: c.threshold })),
    task.criteriaVersion,
    comparedRows,
  );
}
