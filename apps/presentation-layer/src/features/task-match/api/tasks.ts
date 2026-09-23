import { and, desc, eq, sql } from 'drizzle-orm';
import { createTaskRequestSchema as descriptionSchema, updateTaskRequestSchema as patchSchema } from '@/shared/api/contracts/tasks';
import { taskAccess, toExecutorView, visibleProposals } from '@/entities/access';
import { requireTaskOwner } from '@/features/task-card/api/access';
import { recalculateScore } from '@/features/task-card/api/recalculate-score';
import { getDemoActor } from '@/shared/api/actor';
import type { NodeId } from '@/shared/api/contracts/common';
import { db } from '@/shared/db';
import { businesses, aiLogs, grillSessions, grillTurns, taskFields, tasks } from '@/shared/db/schema';
import { analyzeText, phraseQuestion, type InferenceLog } from '@/shared/api/mastra';
import { fallbackQuestion, type NodeKey } from '@/entities/task-match';
import { projectWorkspaceTask } from '@/entities/task-match';
import { ApiError } from './http';
import { createGrill, getGrill, submitTurn, checkpoint as grillCheckpoint, patchField, patchFieldInTransaction, saveQuestionWording } from '@/features/grill/api/service';
import { grillCheckpointSchema, editGrillFieldSchema, submitGrillTurnSchema } from '@/shared/api/contracts/grill';
import { allProposals } from './proposals';

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


function audit(kind: string, input: unknown, result: { ok: boolean; log: InferenceLog }): Omit<typeof aiLogs.$inferInsert, 'taskId' | 'turnId'> {
  const log = result.log;
  return { kind, agent: log.agent, model: log.model, prompt: log.prompt, input,
    rawOutput: log.raw_output, parseOk: result.ok && log.parse_ok, retryCount: log.retry_count,
    dropped: log.dropped, latencyMs: log.latency_ms, error: log.error,
    fallbackUsed: !result.ok, fallbackReason: result.ok ? null : log.error ?? 'INVALID_INFERENCE_RESPONSE' };
}

// Network inference is outside mutation transactions. Only its wording is stored
// with the current turn/version guard; the canonical state machine stays in BFF.
async function decorateQuestion(taskId: string, signal: AbortSignal) {
  const current = await getGrill(taskId);
  const turn = current.turns.at(-1);
  if (current.session.status !== 'active' || !current.session.currentNode || !turn || turn.answer !== null || turn.node !== current.session.currentNode) return;
  const [logged] = await db.select({ id: aiLogs.id }).from(aiLogs).where(and(eq(aiLogs.turnId, turn.id), eq(aiLogs.kind, 'phrase-question'))).limit(1);
  if (logged) return;
  const [task] = await db.select({ description: tasks.description }).from(tasks).where(eq(tasks.id, taskId));
  if (!task) return;
  const context = JSON.stringify({ description: task.description, answers: current.turns.filter(item => item.answer !== null).map(item => ({ node: item.node, answer: item.answer })).slice(-12) });
  const input = { node: turn.node, isPushback: turn.isPushback, context };
  const phrased = await phraseQuestion(input, signal);
  await saveQuestionWording(taskId, { version: current.session.version, node: turn.node, turnId: turn.id },
    phrased.ok ? { question: phrased.question, options: phrased.options } : null,
    audit('phrase-question', input, phrased));
}

async function response(taskId: string, signal = AbortSignal.timeout(20_000)) {
  await decorateQuestion(taskId, signal);
  // The actor may have submitted another action while inference was running.
  const grill = await getGrill(taskId);
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Задача не найдена');
  return { task: await taskView(row), ...grill, question: grill.next?.kind === 'question'
    ? question(grill.next.node as NodeKey, grill.next.question) : null };
}

export async function createTask(input: unknown) {
  const actor = await getDemoActor();
  if (actor.role !== 'business') throw new ApiError(403, 'forbidden', 'Только бизнес создаёт задачи');
  const { description } = descriptionSchema.parse(input);
  const [business] = await db.select().from(businesses).where(eq(businesses.id,actor.businessId));
  if (!business) throw new ApiError(403,'forbidden','Завершите профиль бизнеса');
  const signal = AbortSignal.timeout(20_000);
  const analysisInput = { text: description, targetNodes: Object.values(workspaceNodes).flat(), dictionary: { roles: [], skills: [] } };
  const analyzed = await analyzeText(analysisInput, signal);
  const draftFields = Object.fromEntries((analyzed.ok ? analyzed.fields : []).filter(f => isNode(f.node)).map(f => [f.node, { value: f.value, sourceQuote: f.source_quote }]));
  const row = await db.transaction(async tx => {
    const [row] = await tx.insert(tasks).values({ businessId: actor.businessId, company: business.name, topic: business.industry, title: description.split(/[\n.!?]/, 1)[0].slice(0,68), description }).returning();
    await createGrill(row.id, { draftText: description, draftFields }, tx);
    await tx.insert(aiLogs).values({ ...audit('analyze-text', analysisInput, analyzed), taskId: row.id });
    return row;
  });
  return { ...await response(row.id, signal), fallbackUsed: !analyzed.ok };
}

export async function answerGrillTurn(taskId: string, input: unknown) {
  const parsed = submitGrillTurnSchema.omit({ classification: true }).parse(input);
  const current = await getGrill(taskId);
  if (!current.session.currentNode) throw new ApiError(409, 'NO_PENDING_TURN', 'Сначала подтвердите сводку');
  if (current.session.version !== parsed.sessionVersion) throw new ApiError(409, 'STALE_SESSION', 'Сессия уже изменилась. Обновите страницу.');
  const node = current.session.currentNode;
  const signal = AbortSignal.timeout(20_000);
  const analysisInput = { text: parsed.answer, targetNodes: [node], dictionary: { roles: [], skills: [] } };
  const analyzed = await analyzeText(analysisInput, signal);
  const classification = analyzed.ok ? {
    specificity: analyzed.nodes.find(n => n.node === node)?.specificity ?? 'vague' as const,
    coveredNodes: analyzed.fields.map(f => f.node) as NodeId[],
    fields: Object.fromEntries(analyzed.fields.map(f => [f.node, { value: f.value, sourceQuote: f.source_quote }])),
  } : undefined;
  const result = await submitTurn(taskId, { ...parsed, classification }, audit('analyze-text', analysisInput, analyzed));
  const fresh = await response(taskId, signal);
  return { ...fresh, fallbackUsed: result.fallbackUsed || Boolean(fresh.turns.at(-1)?.fallbackUsed), sessionVersion: fresh.session.version };
}

export async function updateTask(taskId: string, input: unknown) {
  await requireTaskOwner(taskId);
  const parsed = patchSchema.parse(input);
  const patch = parsed.task ?? parsed;
  await db.transaction(async tx => {
  const [row] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).for('update');
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Задача не найдена');
  await tx.update(tasks).set({
    engagement: parsed.engagement ?? row.engagement, neededRoles: parsed.neededRoles ?? row.neededRoles, neededSkills: parsed.neededSkills ?? row.neededSkills,
    tagsState: parsed.tagsState ?? (parsed.neededRoles || parsed.neededSkills ? 'suggested' : row.tagsState), compensationNote: parsed.compensationNote ?? row.compensationNote,
    title: patch.title ?? row.title, company: patch.company ?? row.company,
    topic: ('industry' in patch ? patch.industry : undefined) ?? ('topic' in patch ? patch.topic : undefined) ?? row.topic,
    version: sql`${tasks.version} + 1`, updatedAt: new Date() }).where(eq(tasks.id, taskId));
  for (const [key, value] of Object.entries(patch.fields ?? {})) {
    const node = workspaceToNode[key] ?? (isNode(key) ? key : null);
    if (!node) continue;
    const [existing] = await tx.select().from(taskFields).where(and(eq(taskFields.taskId, taskId), eq(taskFields.node, node)));
    if (existing?.value === value) continue;
    const [session] = await tx.select().from(grillSessions).where(eq(grillSessions.taskId, taskId));
    if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', 'Сессия прожарки не найдена');
    await patchFieldInTransaction(tx, taskId, node, { action: 'edit', value, sessionVersion: session.version });
  }
  await recalculateScore(tx, taskId, 'task');
  });
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
