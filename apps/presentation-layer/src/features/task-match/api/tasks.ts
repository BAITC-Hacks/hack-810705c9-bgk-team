import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { taskAccess, toExecutorView, visibleProposals } from '@/entities/access';
import { requireTaskOwner } from '@/features/task-card/api/access';
import { recalculateScore } from '@/features/task-card/api/recalculate-score';
import { getDemoActor } from '@/shared/api/actor';
import { db } from '@/shared/db';
import { businesses, aiLogs, grillSessions, grillTurns, taskFields, tasks } from '@/shared/db/schema';
import { analyzeText } from '@/shared/api/mastra';
import { fallbackQuestion, type NodeKey } from '@/entities/task-match';
import { projectWorkspaceTask } from '@/entities/task-match';
import { ApiError } from './http';
import { createGrill, getGrill, submitTurn, checkpoint as grillCheckpoint, patchField } from '@/features/grill/api/service';
import { grillCheckpointSchema, editGrillFieldSchema, submitGrillTurnSchema } from '@/shared/api/contracts/grill';
import { allProposals } from './proposals';

const descriptionSchema = z.object({ description: z.string().trim().min(20).max(2000) });
const patchSchema = z.object({
  task: z.object({
    title: z.string().optional(), company: z.string().optional(), industry: z.string().optional(),
    fields: z.record(z.string(), z.string()).optional(), confirmedFields: z.array(z.string()).optional(),
    status: z.enum(['draft', 'published']).optional(),
  }).optional(),
  title: z.string().optional(), company: z.string().optional(), topic: z.string().optional(),
  engagement: z.enum(['paid', 'practice', 'both']).optional(),
  neededRoles: z.array(z.string()).optional(), neededSkills: z.array(z.string()).optional(),
  tagsState: z.enum(['suggested','confirmed']).optional(), compensationNote: z.string().optional(),
  fields: z.record(z.string(), z.string()).optional(),
  confirmedFields: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published']).optional(),
});

type TaskRow = typeof tasks.$inferSelect;

const isNode = (value: string): value is NodeKey =>
  ['context.current','context.size','context.change','data.what','data.volume','data.sample','result.artifact','result.acceptance','criteria.items','constraints.deadline','constraints.stack','constraints.other','users.role','users.scale','link.contact','link.cadence','link.response'].includes(value);

const workspaceNodes: Record<string, NodeKey[]> = {
  context: ['context.current', 'context.size'], need: ['context.change'], users: ['users.role', 'users.scale'],
  data: ['data.what', 'data.volume', 'data.sample'], constraints: ['constraints.deadline', 'constraints.stack', 'constraints.other'],
  outcome: ['result.artifact', 'result.acceptance'], success: ['criteria.items'], contact: ['link.contact'],
  interaction: ['link.cadence', 'link.response'],
};
const workspaceToNode: Record<string, NodeKey> = Object.fromEntries(
  Object.entries(workspaceNodes).map(([group, nodes]) => [group, nodes[0]]),
) as Record<string, NodeKey>;

function question(node: NodeKey | null, wording?: string | null) {
  return node ? { field: Object.entries(workspaceToNode).find(([, key]) => key === node)?.[0] ?? 'need',
    node, question: wording || fallbackQuestion(node) } : null;
}

async function taskView(row: TaskRow) {
  const fields = await db.select().from(taskFields).where(eq(taskFields.taskId, row.id));
  return projectWorkspaceTask(row, fields);
}

export async function listTasks() {
  const actor = await getDemoActor();
  const rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  const all = await allProposals();
  const allowed = rows.filter(row => taskAccess(actor, { ...row, fields: [] }, all));
  const views = await Promise.all(allowed.map(async row => {
    if (actor.role === 'business' && actor.businessId === row.businessId) return taskView(row);
    const fields = await db.select().from(taskFields).where(eq(taskFields.taskId, row.id));
    const visible = toExecutorView({ ...row, fields });
    return projectWorkspaceTask({ ...row, description: '' }, fields.filter(f => visible.fields.some(v => v.node === f.node)));
  }));
  const sessions = await db.select().from(grillSessions);
  const questions: Record<string, NonNullable<ReturnType<typeof question>>> = {};
  for (const session of sessions) {
    if (actor.role !== 'business' || !allowed.some(row => row.id === session.taskId && row.businessId === actor.businessId)) continue;
    if (session.status !== 'active' || !session.currentNode || !isNode(session.currentNode)) continue;
    const last = await db.select().from(grillTurns).where(eq(grillTurns.sessionId, session.id)).orderBy(desc(grillTurns.createdAt)).limit(1);
    questions[session.taskId] = question(session.currentNode, last[0]?.question)!;
  }
  return { tasks: views, questions, proposals: visibleProposals(actor, all, rows) };
}


async function response(taskId: string) {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Задача не найдена');
  const grill = await getGrill(taskId);
  return { task: await taskView(row), ...grill, question: grill.next?.kind === 'question'
    ? question(grill.next.node as NodeKey, grill.next.question) : null };
}

export async function createTask(input: unknown) {
  const actor = await getDemoActor();
  if (actor.role !== 'business') throw new ApiError(403, 'forbidden', 'Только бизнес создаёт задачи');
  const { description } = descriptionSchema.parse(input);
  const [business] = await db.select().from(businesses).where(eq(businesses.id,actor.businessId));
  if (!business) throw new ApiError(403,'forbidden','Завершите профиль бизнеса');
  const analyzed = await analyzeText({ text: description, targetNodes: Object.values(workspaceNodes).flat(), dictionary: { roles: [], skills: [] } });
  const draftFields = Object.fromEntries((analyzed?.fields ?? []).filter(f => isNode(f.node)).map(f => [f.node, { value: f.value, sourceQuote: f.source_quote }]));
  const row = await db.transaction(async tx => {
    const [row] = await tx.insert(tasks).values({ businessId: actor.businessId, company: business.name, topic: business.industry, title: description.split(/[\n.!?]/, 1)[0].slice(0,68), description }).returning();
    await createGrill(row.id, { draftText: description, draftFields }, tx);
    await tx.insert(aiLogs).values({ taskId: row.id, kind: 'analyze-text', agent: analyzed?.log.agent ?? 'fallback', input: { text: description }, parseOk: Boolean(analyzed), fallbackUsed: !analyzed });
    return row;
  });
  return { ...await response(row.id), fallbackUsed: !analyzed };
}

export async function answerGrillTurn(taskId: string, input: unknown) {
  const parsed = submitGrillTurnSchema.omit({ classification: true }).parse(input);
  const current = await getGrill(taskId);
  if (!current.session.currentNode) throw new ApiError(409, 'NO_PENDING_TURN', 'Сначала подтвердите сводку');
  const node = current.session.currentNode;
  const analyzed = await analyzeText({ text: parsed.answer, targetNodes: [node], dictionary: { roles: [], skills: [] } });
  const classification = analyzed ? {
    specificity: analyzed.nodes.find(n => n.node === node)?.specificity ?? 'specific' as const,
    coveredNodes: analyzed.fields.map(f => f.node),
    fields: Object.fromEntries(analyzed.fields.map(f => [f.node, { value: f.value, sourceQuote: f.source_quote }])),
  } : undefined;
  const result = await submitTurn(taskId, { ...parsed, classification });
  return { ...await response(taskId), ...result };
}

export async function updateTask(taskId: string, input: unknown) {
  await requireTaskOwner(taskId);
  const parsed = patchSchema.parse(input);
  const patch = parsed.task ?? parsed;
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Задача не найдена');
  await db.transaction(async tx => {
  await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).for('update');
  await tx.update(tasks).set({
    engagement: parsed.engagement ?? row.engagement, neededRoles: parsed.neededRoles ?? row.neededRoles, neededSkills: parsed.neededSkills ?? row.neededSkills,
    tagsState: parsed.tagsState ?? (parsed.neededRoles || parsed.neededSkills ? 'suggested' : row.tagsState), compensationNote: parsed.compensationNote ?? row.compensationNote,
    title: patch.title ?? row.title, company: patch.company ?? row.company,
    topic: ('industry' in patch ? patch.industry : undefined) ?? ('topic' in patch ? patch.topic : undefined) ?? row.topic,
    version: sql`${tasks.version} + 1`, updatedAt: new Date() }).where(eq(tasks.id, taskId));
  await recalculateScore(tx, taskId, 'task');
  });
  for (const [key, value] of Object.entries(patch.fields ?? {})) {
    const node = workspaceToNode[key] ?? (isNode(key) ? key : null);
    if (!node) continue;
    const grill = await getGrill(taskId);
    const existing = grill.fields[node];
    if (existing?.value === value) continue;
    await patchField(taskId, node, { action: 'edit', value, sessionVersion: grill.session.version });
  }
  return response(taskId);
}

export { getScore as getTaskScore } from '@/features/task-card/api/get-score';

export async function publishTask(taskId: string) {
  await requireTaskOwner(taskId);
  await db.transaction(async tx => {
    const [row] = await tx.update(tasks).set({ version: sql`${tasks.version} + 1`, status: 'published', publishedAt: new Date(), updatedAt: new Date() }).where(and(eq(tasks.id, taskId), eq(tasks.status, 'draft'))).returning();
    if (!row) throw new ApiError(409, 'INVALID_STATE', 'Задачу нельзя опубликовать');
    await tx.update(grillSessions).set({ status: 'finished', currentNode: null, currentBlock: null }).where(eq(grillSessions.taskId, taskId));
  });
  return response(taskId);
}

export async function checkpoint(taskId: string, input: unknown) {
  await grillCheckpoint(taskId, grillCheckpointSchema.parse(input));
  return response(taskId);
}

export async function updateField(taskId: string, node: string, input: unknown) {
  if (!isNode(node)) throw new ApiError(422, 'INVALID_NODE', 'Неизвестное поле');
  await patchField(taskId, node, editGrillFieldSchema.parse(input));
  return response(taskId);
}
