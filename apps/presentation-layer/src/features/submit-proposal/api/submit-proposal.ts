import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { criteria, proposals, tasks, teams } from "@/shared/db/schema";
import { ApiError } from "@/shared/api/errors";
import type { DemoActor } from "@/shared/api/actor";
import type { ProposalInput } from "@/shared/api/contracts/proposals";
import { computeFit, TASK_STATUSES_ACCEPTING_PROPOSALS } from "@/entities/proposal";

const UNIQUE_VIOLATION = "23505";
const ACTIVE_PROPOSAL_CONSTRAINT = "proposal_active_team_task_uq";

function requireTeam(actor: DemoActor): string {
  if (actor.role !== "team") {
    throw new ApiError(403, "forbidden", "Отклик может подать только команда");
  }
  return actor.teamId;
}

function isUniqueViolation(err: unknown, constraint: string): boolean {
  // drizzle-orm/node-postgres оборачивает pg-ошибку в DrizzleQueryError; сама
  // ошибка с pg-кодом лежит в `.cause`.
  const e = (err as { cause?: unknown })?.cause ?? err;
  const pgErr = e as { code?: string; constraint?: string } | undefined;
  return pgErr?.code === UNIQUE_VIOLATION && pgErr?.constraint === constraint;
}

async function assertCriteriaKeysMatch(
  task: { id: string; criteriaVersion: number },
  answers: Record<string, string>,
) {
  const confirmed = await db
    .select({ id: criteria.id })
    .from(criteria)
    .where(
      and(
        eq(criteria.taskId, task.id),
        eq(criteria.version, task.criteriaVersion),
        eq(criteria.state, "confirmed"),
      ),
    );

  const expected = new Set(confirmed.map((c) => c.id));
  const given = new Set(Object.keys(answers));

  const missing = [...expected].filter((id) => !given.has(id));
  const unknown = [...given].filter((id) => !expected.has(id));

  if (missing.length > 0 || unknown.length > 0) {
    throw new ApiError(422, "validation_error", "Ответы не соответствуют критериям задачи", {
      missing,
      unknown,
    });
  }
}

export async function submitProposal(actor: DemoActor, taskId: string, input: ProposalInput) {
  const teamId = requireTeam(actor);

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) {
    throw new ApiError(404, "not_found", "Задача не найдена");
  }
  if (!TASK_STATUSES_ACCEPTING_PROPOSALS.includes(task.status as never)) {
    throw new ApiError(409, "conflict", "Задача не принимает отклики");
  }

  await assertCriteriaKeysMatch(task, input.criteriaAnswers);

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) {
    throw new ApiError(404, "not_found", "Команда не найдена");
  }

  const fit = computeFit(
    { neededRoles: task.neededRoles, neededSkills: task.neededSkills, topic: task.topic },
    { roles: team.roles, skills: team.skills, technologies: team.technologies, interests: team.interests },
  );

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(proposals)
        .values({
          taskId,
          teamId,
          solution: input.solution,
          plan: input.plan,
          teamRoles: input.teamRoles,
          deadline: input.deadline,
          repoUrl: input.repoUrl,
          criteriaAnswers: { criteriaVersion: task.criteriaVersion, answers: input.criteriaAnswers },
          fit,
        })
        .returning();
      return created;
    });
  } catch (err) {
    if (isUniqueViolation(err, ACTIVE_PROPOSAL_CONSTRAINT)) {
      throw new ApiError(409, "conflict", "У команды уже есть активный отклик на эту задачу");
    }
    throw err;
  }
}

export async function updateProposal(actor: DemoActor, proposalId: string, input: ProposalInput) {
  const teamId = requireTeam(actor);

  const [existing] = await db.select().from(proposals).where(eq(proposals.id, proposalId));
  if (!existing) {
    throw new ApiError(404, "not_found", "Отклик не найден");
  }
  if (existing.teamId !== teamId) {
    throw new ApiError(403, "forbidden", "Это отклик другой команды");
  }

  const [task] = await db.select().from(tasks).where(eq(tasks.id, existing.taskId));
  if (!task) {
    throw new ApiError(404, "not_found", "Задача не найдена");
  }

  await assertCriteriaKeysMatch(task, input.criteriaAnswers);

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) {
    throw new ApiError(404, "not_found", "Команда не найдена");
  }

  const fit = computeFit(
    { neededRoles: task.neededRoles, neededSkills: task.neededSkills, topic: task.topic },
    { roles: team.roles, skills: team.skills, technologies: team.technologies, interests: team.interests },
  );

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(proposals)
      .set({
        solution: input.solution,
        plan: input.plan,
        teamRoles: input.teamRoles,
        deadline: input.deadline,
        repoUrl: input.repoUrl,
        criteriaAnswers: { criteriaVersion: task.criteriaVersion, answers: input.criteriaAnswers },
        fit,
        updatedAt: new Date(),
      })
      .where(and(eq(proposals.id, proposalId), inArray(proposals.status, ["submitted", "on_hold"])))
      .returning();

    if (!updated) {
      throw new ApiError(409, "conflict", "Отклик уже нельзя редактировать");
    }
    return updated;
  });
}
