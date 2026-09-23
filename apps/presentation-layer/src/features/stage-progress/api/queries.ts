import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, stages, tasks, teams } from "@/shared/db/schema";
import { ApiError } from "@/shared/api/errors";
import type { DemoActor } from "@/shared/api/actor";
import { summarizeTeamProgress } from "@/entities/stage";

async function loadAcceptedProposal(actor: DemoActor, proposalId: string) {
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId));
  if (!proposal) {
    throw new ApiError(404, "not_found", "Отклик не найден");
  }
  const [task] = await db.select().from(tasks).where(eq(tasks.id, proposal.taskId));
  if (!task) {
    throw new ApiError(404, "not_found", "Задача не найдена");
  }

  const isOwnerBusiness = actor.role === "business" && actor.businessId === task.businessId;
  const isOwnerTeam = actor.role === "team" && actor.teamId === proposal.teamId;
  if (!isOwnerBusiness && !isOwnerTeam) {
    throw new ApiError(403, "forbidden", "Нет доступа к этому отклику");
  }
  if (proposal.status !== "accepted") {
    throw new ApiError(409, "conflict", "Стартовый пакет доступен только для выбранного отклика");
  }
  return { proposal, task };
}

export async function getKickoff(actor: DemoActor, proposalId: string) {
  const { proposal, task } = await loadAcceptedProposal(actor, proposalId);

  const [team] = await db.select().from(teams).where(eq(teams.id, proposal.teamId));
  const proposalStages = await db.select().from(stages).where(eq(stages.proposalId, proposalId));

  return {
    kickoff: proposal.kickoff,
    stages: proposalStages,
    taskTitle: task.title,
    teamName: team?.name ?? "",
  };
}

export async function listProposalStages(actor: DemoActor, proposalId: string) {
  await loadAcceptedProposal(actor, proposalId);
  return db.select().from(stages).where(eq(stages.proposalId, proposalId));
}

export async function getTeamProgress(teamId: string) {
  const rows = await db
    .select({
      stageId: stages.id,
      status: stages.status,
      points: stages.points,
      taskId: tasks.id,
      taskTitle: tasks.title,
      metric: stages.metric,
      threshold: stages.threshold,
      teamRoles: proposals.teamRoles,
      businessComment: stages.businessComment,
      confirmedAt: stages.confirmedAt,
    })
    .from(stages)
    .innerJoin(proposals, eq(proposals.id, stages.proposalId))
    .innerJoin(tasks, eq(tasks.id, proposals.taskId))
    .where(and(eq(proposals.teamId, teamId), eq(proposals.status, "accepted"), eq(stages.status, "confirmed")));

  return summarizeTeamProgress(rows);
}
