/** Compatibility DTOs for the current main UI. Domain writes remain ADR-owned. */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { tasks, taskFields, teams, proposals, stages, scoreEvent, grillSession } from "@/shared/db/schema";
import { ApiError } from "@/shared/api/errors";
import { getDemoActor } from "@/shared/api/actor";
import { assertTaskOwner, isDemoTeamId } from "@/shared/lib/demo-actor";
import { DEFAULT_DEMO_TEAM } from "@/shared/config/demo-actors";
import { taskAccess, visibleProposals } from "@/entities/access";
import { FIELD_NODES, projectWorkspaceTask } from "@/entities/task-match/projection";
import { projectProposal } from "@/features/task-match/api/proposals";
import { createTask } from "@/features/task-match/api/tasks";
import { recalculateScore } from "@/features/task-card/api/recalculate-score";
import { getScore as canonicalScore } from "@/features/task-card/api/get-score";
import { decideProposal as canonicalDecision } from "@/features/decide-proposal";
import { claimStage, confirmStage } from "@/features/stage-progress/api/stage-progress";
import { listProposalStages, getKickoff as canonicalKickoff, getTeamProgress } from "@/features/stage-progress/api/queries";
import type { Task, Proposal, Team } from "@/entities/workspace/model";
import type { WorkspaceSession, TaskUpdate, TeamInput, MilestoneInput } from "@/entities/workspace/contracts";

type TaskRow = typeof tasks.$inferSelect;
type FieldRow = typeof taskFields.$inferSelect;
function taskDto(row: TaskRow, fields: FieldRow[], owner: boolean): Task {
  const view = projectWorkspaceTask(owner ? row : { ...row, description: "" }, owner ? fields : fields.filter(f => f.state === "confirmed"));
  // Preserve the owner's original nine-group notes without certifying them as
  // structured ADR fields. The archive is never sent to another actor.
  const legacyFields = row.legacyWorkspace?.fields;
  if (owner && Array.isArray(legacyFields)) for (const item of legacyFields) {
    if (item && typeof item === "object" && "node" in item && "value" in item && typeof item.node === "string" && typeof item.value === "string" && Object.hasOwn(FIELD_NODES,item.node)) {
      const group = item.node as keyof Task["fields"];
      if (!fields.some(f => FIELD_NODES[group].includes(f.node))) view.fields[group] = item.value;
    }
  }
  return {...view,canEdit:owner};
}
function teamDto(row: typeof teams.$inferSelect): Team {
  return { id: row.id, name: row.name, initials: row.initials || row.name.slice(0,2), tagline: row.tagline, skills: row.skills, interests: row.interests, members: row.members, color: row.color };
}
function proposalDto(row: typeof proposals.$inferSelect, rows: (typeof stages.$inferSelect)[]): Proposal {
  const own = rows.filter(s => s.proposalId === row.id);
  const first = own.find(s => s.status === "claimed") ?? own.find(s => s.status === "confirmed");
  return { ...projectProposal(row, own.some(s => s.status === "confirmed")), points: own.reduce((sum,s) => sum+s.points,0), ...(first?.reportUrl ? { milestone: { title: first.metric, resultUrl: first.reportUrl, comment: first.teamComment ?? "" } } : {}) };
}
export async function resolveSession(input: WorkspaceSession): Promise<WorkspaceSession> {
  const actor = await getDemoActor();
  return { role: actor.role === "team" ? "student" : "business", teamId: actor.role === "team" ? actor.teamId : isDemoTeamId(input.teamId) ? input.teamId : DEFAULT_DEMO_TEAM.id };
}
export async function validateSessionTeam(teamId: string) {
  if (!isDemoTeamId(teamId)) throw new ApiError(403, "forbidden", "Выберите демо-команду");
  const [row] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id,teamId));
  if (!row) throw new ApiError(404,"TEAM_NOT_FOUND","Команда не найдена");
}
export function requireRole(session: WorkspaceSession, role: WorkspaceSession["role"]) {
  if (session.role !== role) throw new ApiError(403,"forbidden","Действие недоступно для текущей роли");
}
export async function getWorkspace(session: WorkspaceSession) {
  const actor = await getDemoActor();
  return db.transaction(async tx => {
    const taskRows = await tx.select().from(tasks).orderBy(desc(tasks.createdAt),asc(tasks.id));
    const fieldRows = await tx.select().from(taskFields);
    const proposalRows = await tx.select().from(proposals);
    const stageRows = await tx.select().from(stages);
    const teamRows = await tx.select().from(teams).orderBy(asc(teams.createdAt),asc(teams.id));
    const visible = taskRows.filter(t => taskAccess(actor,{...t,fields:[]},proposalRows));
    return { session, tasks: visible.map(t => taskDto(t,fieldRows.filter(f => f.taskId === t.id),actor.role === "business" && actor.businessId === t.businessId)), teams: teamRows.filter(t => isDemoTeamId(t.id)).map(teamDto), proposals: visibleProposals(actor,proposalRows,taskRows).map(p => proposalDto(p,stageRows)) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getTask(id: string, session: WorkspaceSession) {
  const snapshot = await getWorkspace(session);
  const task = snapshot.tasks.find(t => t.id === id);
  if (!task) throw new ApiError(404,"TASK_NOT_FOUND","Задача не найдена");
  return task;
}
export async function addTask(description: string, session: WorkspaceSession) {
  requireRole(session,"business");
  return (await createTask({description})).task;
}
export async function updateTask(id: string, input: TaskUpdate, session: WorkspaceSession) {
  requireRole(session,"business");
  const actor = await getDemoActor();
  if (input.version === undefined) throw new ApiError(422,"VERSION_REQUIRED","Обновите карточку перед сохранением");
  if (input.id && input.id !== id) throw new ApiError(422,"ID_MISMATCH","Идентификатор карточки не совпадает");
  await db.transaction(async tx => {
    const [row] = await tx.select().from(tasks).where(eq(tasks.id,id)).for("update");
    if (!row) throw new ApiError(404,"TASK_NOT_FOUND","Задача не найдена");
    assertTaskOwner(actor,row);
    if (row.version !== input.version) throw new ApiError(409,"STALE_TASK","Карточка уже изменена. Обновите данные");
    if (row.status !== "draft" && input.status === "draft") throw new ApiError(409,"ALREADY_PUBLISHED","Опубликованную задачу нельзя вернуть в черновик");
    const existing = await tx.select().from(taskFields).where(eq(taskFields.taskId,id));
    const before = taskDto(row,existing,true);
    for (const [group,keys] of Object.entries(FIELD_NODES) as [keyof Task["fields"],string[]][]) {
      const value = input.fields[group];
      const changed = value !== before.fields[group];
      const confirmed = input.confirmedFields.includes(group);
      if (changed && group === "success") throw new ApiError(422,"STRUCTURED_CRITERIA_REQUIRED","Критерии приёмки задаются отдельно: метрика, порог и способ проверки. Откройте подробную карточку");
      const populated = existing.filter(f => keys.includes(f.node) && f.value.trim());
      if (changed && populated.length > 1) throw new ApiError(422,"STRUCTURED_FIELDS_REQUIRED","В этом разделе несколько подтверждаемых полей. Измените их в подробной карточке");
      if (confirmed && value.trim() && !populated.length && !changed) throw new ApiError(422,"STRUCTURED_FIELDS_REQUIRED","Исходные сведения нужно подтвердить по отдельным полям в подробной карточке");
      if (changed) {
        const node = populated[0]?.node ?? keys[0];
        await tx.insert(taskFields).values({taskId:id,node,value,state:confirmed && value.trim() ? "confirmed":"suggested",source:"manual",sourceQuote:value,confirmedAt:confirmed && value.trim()?new Date():null}).onConflictDoUpdate({target:[taskFields.taskId,taskFields.node],set:{value,state:confirmed && value.trim()?"confirmed":"suggested",source:"manual",sourceQuote:value,sourceTurnId:null,confirmedAt:confirmed && value.trim()?new Date():null,updatedAt:new Date()}});
      } else if (group !== "success") {
        for (const field of populated) await tx.update(taskFields).set({state:confirmed?"confirmed":"suggested",confirmedAt:confirmed?new Date():null,updatedAt:new Date()}).where(and(eq(taskFields.taskId,id),eq(taskFields.node,field.node)));
      }
    }
    if (input.status === "published" && Object.entries(input.fields).some(([key,value]) => value.trim() && !input.confirmedFields.includes(key as keyof Task["fields"]))) throw new ApiError(422,"CONFIRMATION_REQUIRED","Подтвердите заполненные поля перед публикацией");
    await tx.update(tasks).set({title:input.title,company:input.company,topic:input.industry,description:input.description,version:row.version+1,status:row.status === "draft"?input.status:row.status,publishedAt:input.status==="published"?(row.publishedAt??new Date()):row.publishedAt,updatedAt:new Date()}).where(eq(tasks.id,id));
    await tx.update(grillSession).set({version:sql`${grillSession.version}+1`,...(input.status==="published"?{status:"finished" as const,currentNode:null,currentBlock:null}:{}),updatedAt:new Date()}).where(eq(grillSession.taskId,id));
    await recalculateScore(tx,id,"task");
  });
  return getTask(id,session);
}
export async function getScore(id: string, session: WorkspaceSession) {
  await getTask(id,session);
  const actor = await getDemoActor();
  const [row] = await db.select().from(tasks).where(eq(tasks.id,id));
  if (!row) throw new ApiError(404,"TASK_NOT_FOUND","Задача не найдена");
  assertTaskOwner(actor,row);
  return canonicalScore(id);
}
export async function getScoreHistory(id: string, session: WorkspaceSession) {
  await getScore(id,session);
  return db.select().from(scoreEvent).where(eq(scoreEvent.taskId,id)).orderBy(desc(scoreEvent.at)).limit(100);
}
export async function saveTeam(input: TeamInput, session: WorkspaceSession, updating=false) {
  requireRole(session,"student");
  const actor=await getDemoActor();
  if (actor.role!=="team" || actor.teamId!==input.id) throw new ApiError(403,"forbidden","Можно редактировать только свою демо-команду");
  if (!updating) throw new ApiError(409,"DEMO_TEAM_EXISTS","Выберите существующую демо-команду и измените профиль");
  const [saved]=await db.update(teams).set({...input,updatedAt:new Date()}).where(eq(teams.id,input.id)).returning();
  if (!saved) throw new ApiError(404,"TEAM_NOT_FOUND","Команда не найдена");
  return teamDto(saved);
}
async function readProposal(id:string) {
  const actor=await getDemoActor();
  const [row]=await db.select().from(proposals).where(eq(proposals.id,id));
  if (!row) throw new ApiError(404,"PROPOSAL_NOT_FOUND","Отклик не найден");
  const [task]=await db.select().from(tasks).where(eq(tasks.id,row.taskId));
  if (!task || !visibleProposals(actor,[row],[task]).length) throw new ApiError(403,"forbidden","Нет доступа к отклику");
  return proposalDto(row,await db.select().from(stages).where(eq(stages.proposalId,id)));
}
export async function decideProposal(id:string,status:Proposal["status"],session:WorkspaceSession,note?:string) {
  requireRole(session,"business");
  if (status==="rejected" && !note?.trim()) throw new ApiError(422,"validation_error","Укажите причину отклонения");
  await canonicalDecision(await getDemoActor(),id,status==="selected"?{action:"accept"}:status==="rejected"?{action:"reject",reason:"other",note:note!.trim()}:{action:"submitted"});
  return readProposal(id);
}
export async function submitResult(id:string,input:MilestoneInput,session:WorkspaceSession) {
  requireRole(session,"student");
  const actor=await getDemoActor();
  const rows=await listProposalStages(actor,id);
  const stage=rows.find(s=>s.status==="open"||s.status==="returned");
  if (!stage) throw new ApiError(409,"NO_OPEN_STAGE","Нет открытого этапа. Откройте подробный список этапов");
  await claimStage(actor,stage.id,{reportUrl:input.resultUrl,comment:input.comment});
  return readProposal(id);
}
export async function confirmResult(id:string,session:WorkspaceSession) {
  requireRole(session,"business");
  const actor=await getDemoActor();
  const rows=await listProposalStages(actor,id);
  const stage=rows.find(s=>s.status==="claimed");
  if (!stage) throw new ApiError(409,"RESULT_REQUIRED","Нет этапа, сданного на проверку");
  await confirmStage(actor,stage.id,{});
  return readProposal(id);
}
export async function getProgress(teamId:string,session:WorkspaceSession) {
  requireRole(session,"student");
  const actor=await getDemoActor();
  if (actor.role!=="team"||actor.teamId!==teamId) throw new ApiError(403,"forbidden","Нет доступа к другой команде");
  return getTeamProgress(teamId);
}
export async function getKickoff(id:string,_session:WorkspaceSession) {
  return canonicalKickoff(await getDemoActor(),id);
}
