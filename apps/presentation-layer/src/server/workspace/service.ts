import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import {
  businesses,
  tasks,
  taskFields,
  teams,
  proposals,
  milestones,
  scoreEvents,
} from "@/shared/db/schema";
import { ApiError } from "@/shared/api/errors";
import { validateBusinessLogoKey } from "./business-logos";
import {
  calculateScore,
  createTask,
  TASK_FIELDS,
  type Task,
  type Team,
  type Proposal,
} from "@/entities/workspace/model";
import {
  evaluateTask,
  newlyConfirmedFields,
  publicTask,
  type WorkspaceSession,
  type TaskUpdate,
  type TeamInput,
  type ProposalInput,
  type MilestoneInput,
  type OnboardingInput,
  type BusinessProfile,
} from "@/entities/workspace/contracts";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = typeof db | Transaction;
type TaskRow = typeof tasks.$inferSelect & {
  business: typeof businesses.$inferSelect;
  fields: (typeof taskFields.$inferSelect)[];
};
type ProposalRow = typeof proposals.$inferSelect & {
  milestone: typeof milestones.$inferSelect | null;
};

function taskDto(row: TaskRow): Task {
  const fields = Object.fromEntries(
    TASK_FIELDS.map(({ key }) => [
      key,
      row.fields.find((field) => field.node === key)?.value ?? "",
    ]),
  ) as Task["fields"];
  return {
    id: row.id,
    title: row.title,
    company: row.business.name,
    industry: row.business.industry,
    description: row.description,
    fields,
    confirmedFields: row.fields
      .filter((field) => field.state === "confirmed")
      .map((field) => field.node),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    version: row.version,
  };
}
function teamDto(row: typeof teams.$inferSelect): Team {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    tagline: row.tagline,
    skills: row.skills,
    interests: row.interests,
    members: row.members,
    color: row.color,
  };
}
function proposalDto(row: ProposalRow): Proposal {
  return {
    id: row.id,
    taskId: row.taskId,
    teamId: row.teamId,
    idea: row.idea,
    plan: row.plan,
    timeline: row.timeline,
    prototypeUrl: row.prototypeUrl,
    status: row.status,
    milestoneConfirmed: row.milestone?.status === "confirmed",
    ...(row.milestone
      ? {
          milestone: {
            title: row.milestone.title,
            resultUrl: row.milestone.resultUrl,
            comment: row.milestone.comment,
          },
        }
      : {}),
  };
}
export function requireRole(
  session: WorkspaceSession,
  role: WorkspaceSession["role"],
) {
  if (session.role !== role)
    throw new ApiError(
      403,
      "ROLE_REQUIRED",
      role === "business"
        ? "Это действие доступно бизнесу."
        : "Это действие доступно команде студентов.",
    );
}
function requireTeam(session: WorkspaceSession, teamId: string) {
  requireRole(session, "student");
  if (session.teamId !== teamId)
    throw new ApiError(
      403,
      "TEAM_REQUIRED",
      "Переключитесь на команду, от имени которой хотите выполнить действие.",
    );
}
export async function resolveSession(
  input: WorkspaceSession,
): Promise<WorkspaceSession> {
  const business = input.businessId
    ? await db.query.businesses.findFirst({ where: eq(businesses.id, input.businessId) })
    : null;
  const team = input.teamId
    ? await db.query.teams.findFirst({ where: eq(teams.id, input.teamId) })
    : null;
  return {
    ...input,
    businessId: business?.id ?? null,
    // A team is a deliberate choice. A business profile must not silently
    // select the first team and then bypass student onboarding on a role switch.
    teamId: team?.id ?? null,
    onboardingCompleted: input.role === "business" ? Boolean(business) : Boolean(team),
  };
}
export async function validateSessionTeam(teamId: string) {
  if (!(await db.query.teams.findFirst({ where: eq(teams.id, teamId) })))
    throw new ApiError(404, "TEAM_NOT_FOUND", "Команда не найдена.");
}
export async function listTeams(): Promise<Team[]> {
  return (await db.query.teams.findMany({
    orderBy: [asc(teams.createdAt), asc(teams.id)],
  })).map(teamDto);
}
export async function completeOnboarding(
  input: OnboardingInput,
  session: WorkspaceSession,
): Promise<WorkspaceSession> {
  if (input.role === "student") {
    await validateSessionTeam(input.teamId);
    return { ...session, role: "student", teamId: input.teamId, onboardingCompleted: true };
  }
  if (input.logoKey) await validateBusinessLogoKey(input.logoKey);
  const businessId = await db.transaction(async (tx) => {
    const existing = session.businessId
      ? await tx.query.businesses.findFirst({ where: eq(businesses.id, session.businessId) })
      : undefined;
    if (existing) {
      await tx.update(businesses).set({
        name: input.companyName,
        ...(input.logoKey === undefined ? {} : { logoKey: input.logoKey }),
      }).where(eq(businesses.id, existing.id));
      return existing.id;
    }
    const id = crypto.randomUUID();
    await tx.insert(businesses).values({
      id,
      name: input.companyName,
      industry: "Другое",
      logoKey: input.logoKey ?? null,
    });
    return id;
  });
  return { ...session, role: "business", businessId, onboardingCompleted: true };
}
async function readBusinessProfile(
  businessId: string | null | undefined,
  reader: Reader,
): Promise<BusinessProfile | null> {
  if (!businessId) return null;
  const business = await reader.query.businesses.findFirst({ where: eq(businesses.id, businessId) });
  return business ? {
    id: business.id,
    name: business.name,
    logoUrl: business.logoKey ? `/api/business-logos/${business.logoKey}` : null,
  } : null;
}
async function readTask(id: string, reader: Reader = db): Promise<Task> {
  const row = await reader.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: { business: true, fields: true },
  });
  if (!row) throw new ApiError(404, "TASK_NOT_FOUND", "Задача не найдена.");
  return taskDto(row);
}
export async function getTask(id: string, session: WorkspaceSession) {
  const task = await readTask(id);
  if (session.role === "student" && task.status !== "published")
    throw new ApiError(404, "TASK_NOT_FOUND", "Задача не найдена.");
  return session.role === "student" ? publicTask(task) : task;
}
async function readProposal(
  id: string,
  reader: Reader = db,
): Promise<Proposal> {
  const row = await reader.query.proposals.findFirst({
    where: eq(proposals.id, id),
    with: { milestone: true },
  });
  if (!row) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "Отклик не найден.");
  return proposalDto(row);
}
async function lockProposal(tx: Transaction, id: string) {
  const [row] = await tx
    .select()
    .from(proposals)
    .where(eq(proposals.id, id))
    .for("update");
  if (!row) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "Отклик не найден.");
  return row;
}
function fieldRows(task: Task) {
  return TASK_FIELDS.map(({ key }) => ({
    taskId: task.id,
    node: key,
    value: task.fields[key],
    state: !task.fields[key]
      ? ("empty" as const)
      : task.confirmedFields.includes(key)
        ? ("confirmed" as const)
        : ("suggested" as const),
  }));
}
export async function getWorkspace(session: WorkspaceSession) {
  // A single consistent snapshot prevents mixed task/field/proposal versions.
  return db.transaction(
    async (tx) => {
      const taskRows = await tx.query.tasks.findMany({
        where:
          session.role === "student"
            ? eq(tasks.status, "published")
            : undefined,
        with: { business: true, fields: true },
        orderBy: [desc(tasks.createdAt), asc(tasks.id)],
      });
      const teamRows = await tx.query.teams.findMany({
        orderBy: [asc(teams.createdAt), asc(teams.id)],
      });
      const visibleIds = taskRows.map((task) => task.id);
      const proposalRows = visibleIds.length
        ? await tx.query.proposals.findMany({
            where: and(
              inArray(proposals.taskId, visibleIds),
              session.role === "student"
                ? eq(proposals.teamId, session.teamId ?? "")
                : undefined,
            ),
            with: { milestone: true },
            orderBy: [asc(proposals.createdAt), asc(proposals.id)],
          })
        : [];
      return {
        tasks: taskRows
          .map(taskDto)
          .map((task) =>
            session.role === "student" ? publicTask(task) : task,
          ),
        teams: teamRows.map(teamDto),
        proposals: proposalRows.map(proposalDto),
        session,
        business: await readBusinessProfile(session.businessId, tx),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function addTask(description: string, session: WorkspaceSession) {
  requireRole(session, "business");
  const task = createTask(description);
  return db.transaction(async (tx) => {
    const profile = session.businessId
      ? await tx.query.businesses.findFirst({ where: eq(businesses.id, session.businessId) })
      : null;
    const businessId = profile?.id ?? crypto.randomUUID();
    if (!profile) {
      await tx.insert(businesses).values({
        id: businessId, name: task.company, industry: task.industry,
      });
    }
    await tx
      .insert(tasks)
      .values({
        id: task.id,
        businessId,
        title: task.title,
        description: task.description,
      });
    await tx.insert(taskFields).values(fieldRows(task));
    await tx
      .insert(scoreEvents)
      .values({
        id: crypto.randomUUID(),
        taskId: task.id,
        previousScore: null,
        score: 0,
        closedItems: [],
      });
    return readTask(task.id, tx);
  });
}
export async function updateTask(
  id: string,
  input: TaskUpdate,
  session: WorkspaceSession,
) {
  requireRole(session, "business");
  if (input.version === undefined)
    throw new ApiError(
      422,
      "VERSION_REQUIRED",
      "Обновите карточку перед сохранением.",
    );
  if (input.id && input.id !== id)
    throw new ApiError(
      422,
      "ID_MISMATCH",
      "Идентификатор карточки не совпадает.",
    );
  if (input.status === "published") {
    if (!input.fields.need && !input.fields.context)
      throw new ApiError(
        422,
        "CONTEXT_REQUIRED",
        "Опишите проблему или контекст перед публикацией.",
      );
    if (
      TASK_FIELDS.some(
        ({ key }) => input.fields[key] && !input.confirmedFields.includes(key),
      )
    )
      throw new ApiError(
        422,
        "CONFIRMATION_REQUIRED",
        "Подтвердите заполненные поля перед публикацией.",
      );
  }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .for("update");
    if (!row) throw new ApiError(404, "TASK_NOT_FOUND", "Задача не найдена.");
    if (row.version !== input.version)
      throw new ApiError(
        409,
        "STALE_TASK",
        "Карточка уже изменена. Обновите данные и повторите сохранение.",
      );
    if (row.status === "published" && input.status === "draft")
      throw new ApiError(
        409,
        "ALREADY_PUBLISHED",
        "Опубликованную задачу нельзя перевести в черновик.",
      );
    const previous = await readTask(id, tx);
    const next: Task = {
      ...previous,
      ...input,
      id,
      createdAt: previous.createdAt,
    };
    // Task-specific metadata edits must never rename the onboarding profile or
    // other tasks that reference it. Detach only when those details change.
    let businessId = row.businessId;
    if (input.company !== previous.company || input.industry !== previous.industry) {
      const sourceBusiness = await tx.query.businesses.findFirst({
        where: eq(businesses.id, row.businessId),
      });
      businessId = crypto.randomUUID();
      await tx.insert(businesses).values({
        id: businessId,
        name: input.company,
        industry: input.industry,
        logoKey: sourceBusiness?.logoKey ?? null,
      });
    }
    await tx
      .update(tasks)
      .set({
        businessId,
        title: input.title,
        description: input.description,
        status: input.status,
        version: row.version + 1,
        updatedAt: new Date(),
        publishedAt:
          input.status === "published" ? (row.publishedAt ?? new Date()) : null,
      })
      .where(eq(tasks.id, id));
    for (const field of fieldRows(next)) {
      await tx
        .insert(taskFields)
        .values(field)
        .onConflictDoUpdate({
          target: [taskFields.taskId, taskFields.node],
          set: { value: field.value, state: field.state },
        });
    }
    await tx
      .insert(scoreEvents)
      .values({
        id: crypto.randomUUID(),
        taskId: id,
        previousScore: calculateScore(previous),
        score: calculateScore(next),
        closedItems: newlyConfirmedFields(previous, next),
      });
    return readTask(id, tx);
  });
}
export async function getScore(id: string, session: WorkspaceSession) {
  return db.transaction(
    async (tx) => {
      const task = await readTask(id, tx);
      if (session.role === "student" && task.status !== "published")
        throw new ApiError(404, "TASK_NOT_FOUND", "Задача не найдена.");
      const event = await tx.query.scoreEvents.findFirst({
        where: eq(scoreEvents.taskId, id),
        orderBy: [desc(scoreEvents.createdAt), desc(scoreEvents.id)],
      });
      return evaluateTask(task, event);
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function getScoreHistory(id: string, session: WorkspaceSession) {
  requireRole(session, "business");
  await getTask(id, session);
  return db
    .select()
    .from(scoreEvents)
    .where(eq(scoreEvents.taskId, id))
    .orderBy(desc(scoreEvents.createdAt))
    .limit(100);
}
export async function saveTeam(
  input: TeamInput,
  session: WorkspaceSession,
  updating = false,
) {
  requireRole(session, "student");
  if (updating) {
    requireTeam(session, input.id);
    const [row] = await db
      .update(teams)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(teams.id, input.id))
      .returning();
    if (!row) throw new ApiError(404, "TEAM_NOT_FOUND", "Команда не найдена.");
    return teamDto(row);
  }
  const [row] = await db.insert(teams).values(input).returning();
  return teamDto(row);
}
export async function applyToTask(
  taskId: string,
  input: ProposalInput,
  session: WorkspaceSession,
) {
  requireTeam(session, input.teamId);
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .for("share");
    if (!task || task.status !== "published")
      throw new ApiError(
        404,
        "TASK_NOT_FOUND",
        "Опубликованная задача не найдена.",
      );
    const id = crypto.randomUUID();
    await tx.insert(proposals).values({ ...input, id, taskId });
    return readProposal(id, tx);
  });
}
export async function listProposals(taskId: string, session: WorkspaceSession) {
  await getTask(taskId, session);
  const rows = await db.query.proposals.findMany({
    where: and(
      eq(proposals.taskId, taskId),
      session.role === "student"
        ? eq(proposals.teamId, session.teamId ?? "")
        : undefined,
    ),
    with: { milestone: true },
    orderBy: asc(proposals.createdAt),
  });
  return rows.map(proposalDto);
}
export async function decideProposal(
  id: string,
  status: Proposal["status"],
  session: WorkspaceSession,
) {
  requireRole(session, "business");
  return db.transaction(async (tx) => {
    await lockProposal(tx, id);
    // Decisions can be undone; already confirmed results and earned points remain.
    await tx
      .update(proposals)
      .set({ status, updatedAt: new Date() })
      .where(eq(proposals.id, id));
    return readProposal(id, tx);
  });
}
export async function submitResult(
  id: string,
  input: MilestoneInput,
  session: WorkspaceSession,
) {
  requireRole(session, "student");
  return db.transaction(async (tx) => {
    const proposal = await lockProposal(tx, id);
    requireTeam(session, proposal.teamId);
    if (proposal.status !== "selected")
      throw new ApiError(
        409,
        "NOT_SELECTED",
        "Результат может отправить только выбранная команда.",
      );
    const current = await tx.query.milestones.findFirst({
      where: eq(milestones.proposalId, id),
    });
    if (current?.status === "confirmed")
      throw new ApiError(
        409,
        "ALREADY_CONFIRMED",
        "Подтверждённый результат нельзя изменить.",
      );
    await tx
      .insert(milestones)
      .values({ ...input, id: crypto.randomUUID(), proposalId: id })
      .onConflictDoUpdate({
        target: milestones.proposalId,
        set: { ...input, submittedAt: new Date() },
      });
    return readProposal(id, tx);
  });
}
export async function confirmResult(id: string, session: WorkspaceSession) {
  requireRole(session, "business");
  return db.transaction(async (tx) => {
    const proposal = await lockProposal(tx, id);
    const milestone = await tx.query.milestones.findFirst({
      where: eq(milestones.proposalId, id),
    });
    if (milestone?.status === "confirmed") return readProposal(id, tx);
    if (proposal.status !== "selected")
      throw new ApiError(409, "NOT_SELECTED", "Сначала выберите команду.");
    if (!milestone)
      throw new ApiError(
        409,
        "RESULT_REQUIRED",
        "Команда ещё не отправила результат этапа.",
      );
    await tx
      .update(milestones)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(milestones.id, milestone.id));
    return readProposal(id, tx);
  });
}
export async function getProgress(teamId: string, session: WorkspaceSession) {
  if (session.role === "student") requireTeam(session, teamId);
  await validateSessionTeam(teamId);
  const rows = await db
    .select({
      milestoneId: milestones.id,
      proposalId: proposals.id,
      taskId: proposals.taskId,
      title: milestones.title,
      resultUrl: milestones.resultUrl,
      comment: milestones.comment,
      confirmedAt: milestones.confirmedAt,
    })
    .from(milestones)
    .innerJoin(proposals, eq(milestones.proposalId, proposals.id))
    .where(
      and(eq(proposals.teamId, teamId), eq(milestones.status, "confirmed")),
    );
  return { points: rows.length * 10, confirmedMilestones: rows };
}
export async function getKickoff(id: string, session: WorkspaceSession) {
  const proposal = await readProposal(id);
  if (session.role === "student") requireTeam(session, proposal.teamId);
  if (proposal.status !== "selected")
    throw new ApiError(
      409,
      "NOT_SELECTED",
      "Стартовый пакет доступен после выбора команды.",
    );
  const task = publicTask(await readTask(proposal.taskId));
  return {
    taskId: task.id,
    proposalId: id,
    materials: task.fields.data,
    constraints: task.fields.constraints,
    contact: task.fields.contact,
    interaction: task.fields.interaction,
    firstMilestone: task.fields.success || task.fields.outcome,
  };
}
