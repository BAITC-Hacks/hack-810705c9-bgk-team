import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/shared/db';
import { aiLogs, grillSessions, grillTurns, scoreEvents, taskFields, tasks } from '@/shared/db/schema';
import { analyzeText, phraseQuestion } from '@/shared/api/mastra';
import { fallbackQuestion, NODE_ORDER, score, type Card, type NodeKey } from '@/entities/task-match';
import { projectWorkspaceTask } from '@/entities/task-match';
import { ApiError } from './http';
import { allProposals } from './proposals';

const descriptionSchema = z.object({ description: z.string().trim().min(20).max(2000) });
const turnSchema = z.object({ answer: z.string().trim().min(1).max(2000), sessionVersion: z.number().int().nonnegative().optional() });
const patchSchema = z.object({
  task: z.object({
    title: z.string().optional(), company: z.string().optional(), industry: z.string().optional(),
    fields: z.record(z.string(), z.string()).optional(), confirmedFields: z.array(z.string()).optional(),
    status: z.enum(['draft', 'published']).optional(),
  }).optional(),
  title: z.string().optional(), company: z.string().optional(), topic: z.string().optional(),
  engagement: z.enum(['paid', 'practice', 'both']).optional(),
  fields: z.record(z.string(), z.string()).optional(),
  confirmedFields: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published']).optional(),
});

type TaskRow = typeof tasks.$inferSelect;
type FieldRow = typeof taskFields.$inferSelect;

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

function fieldMap(rows: FieldRow[]): Card['fields'] {
  const result: Card['fields'] = {};
  for (const row of rows) if (isNode(row.key)) {
    result[row.key] = { value: row.value, state: row.state as 'empty' | 'suggested' | 'confirmed',
      notApplicable: row.notApplicable, source: row.source ?? undefined,
      sourceQuote: row.sourceQuote ?? undefined, sourceTurnId: row.sourceTurnId ?? undefined };
  }
  return result;
}

function question(node: NodeKey | null, wording?: string | null) {
  return node ? { field: Object.entries(workspaceToNode).find(([, key]) => key === node)?.[0] ?? 'need',
    node, question: wording || fallbackQuestion(node) } : null;
}

async function taskView(row: TaskRow) {
  const fields = await db.select().from(taskFields).where(eq(taskFields.taskId, row.id));
  return projectWorkspaceTask(row, fields);
}

export async function listTasks() {
  const rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  const views = await Promise.all(rows.map(taskView));
  const sessions = await db.select().from(grillSessions);
  const questions: Record<string, NonNullable<ReturnType<typeof question>>> = {};
  for (const session of sessions) {
    if (session.status !== 'active' || !session.currentNode || !isNode(session.currentNode)) continue;
    const last = await db.select().from(grillTurns).where(eq(grillTurns.sessionId, session.id)).orderBy(desc(grillTurns.createdAt)).limit(1);
    questions[session.taskId] = question(session.currentNode, last[0]?.question)!;
  }
  return { tasks: views, questions, proposals: await allProposals() };
}

function nextQuestionNode(fields: Card['fields'], asked: Set<string>): NodeKey | null {
  const open = NODE_ORDER.find((node) => !asked.has(node) && !['suggested', 'confirmed'].includes(fields[node]?.state ?? 'empty'));
  if (open) return open;
  return asked.size < 3 ? NODE_ORDER.find((node) => !asked.has(node)) ?? null : null;
}

function quotePresent(text: string, quote: string) {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  return Boolean(normalize(quote)) && normalize(text).includes(normalize(quote));
}

export async function createTask(input: unknown) {
  const { description } = descriptionSchema.parse(input);
  const analyzed = await analyzeText({ text: description, targetNodes: ['context.current','context.change','result.artifact','criteria.items','data.what','users.role'], dictionary: { roles: [], skills: [] } });
  const validFields = (analyzed?.fields ?? []).filter((field) => isNode(field.node) && quotePresent(description, field.source_quote));
  const initialFields: Card['fields'] = {};
  for (const field of validFields) initialFields[field.node as NodeKey] = { value: field.value, state: 'suggested', sourceQuote: field.source_quote, source: 'draft' };
  const firstNode = nextQuestionNode(initialFields, new Set());
  const phrased = firstNode ? await phraseQuestion({ node: firstNode, isPushback: false, context: description }) : null;
  const title = description.split(/[\n.!?]/, 1)[0].slice(0, 68) || 'Новая задача';
  const result = await db.transaction(async (tx) => {
    const [row] = await tx.insert(tasks).values({ title, description, status: 'draft' }).returning();
    if (validFields.length) await tx.insert(taskFields).values(validFields.map((field) => ({
      taskId: row.id, key: field.node, value: field.value, state: 'suggested', source: 'draft', sourceQuote: field.source_quote,
    })));
    const [session] = await tx.insert(grillSessions).values({ taskId: row.id, currentNode: firstNode, status: firstNode ? 'active' : 'finished' }).returning();
    if (firstNode) await tx.insert(grillTurns).values({ sessionId: session.id, nodeKey: firstNode, question: phrased?.question || fallbackQuestion(firstNode) });
    await tx.insert(aiLogs).values({ taskId: row.id, kind: 'analyze-text', agent: analyzed?.log?.agent ?? 'fallback',
      model: analyzed?.log?.model ?? null, input: { text: description }, parseOk: Boolean(analyzed), fallbackUsed: !analyzed,
      fallbackReason: analyzed ? null : 'AI disabled or unavailable' });
    return { row, session };
  });
  return { task: await taskView(result.row), question: question(firstNode, phrased?.question),
    session: { id: result.session.id, version: result.session.version, currentNode: firstNode },
    fallbackUsed: !analyzed || !phrased };
}

export async function answerGrillTurn(taskId: string, input: unknown) {
  const { answer, sessionVersion } = turnSchema.parse(input);
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) throw new ApiError(404, 'NOT_FOUND', 'Задача не найдена');
  const [session] = await db.select().from(grillSessions).where(eq(grillSessions.taskId, taskId)).limit(1);
  if (!session || session.status !== 'active' || !session.currentNode || !isNode(session.currentNode)) throw new ApiError(409, 'GRILL_FINISHED', 'Прожарка завершена');
  if (sessionVersion !== undefined && session.version !== sessionVersion) throw new ApiError(409, 'STALE_SESSION', 'Сессия изменилась. Обновите страницу');
  const current = session.currentNode;
  const analyzed = await analyzeText({ text: answer, targetNodes: [current], dictionary: { roles: [], skills: [] } });
  const candidate = analyzed?.fields.find((field) => field.node === current && quotePresent(answer, field.source_quote));
  const value = candidate?.value || answer;
  const sourceQuote = candidate?.source_quote || answer;
  const existingFields = await db.select().from(taskFields).where(eq(taskFields.taskId, taskId));
  const fields = fieldMap(existingFields);
  fields[current] = { value, state: 'suggested', source: 'turn', sourceQuote };
  const askedTurns = await db.select().from(grillTurns).where(eq(grillTurns.sessionId, session.id));
  const nextNode = nextQuestionNode(fields, new Set(askedTurns.map((turn) => turn.nodeKey)));
  const phrased = nextNode ? await phraseQuestion({ node: nextNode, isPushback: false, context: `${task.description}\n${answer}` }) : null;
  const result = await db.transaction(async (tx) => {
    const updated = await tx.update(grillSessions).set({ currentNode: nextNode, status: nextNode ? 'active' : 'finished', version: session.version + 1,
      questionCount: session.questionCount + 1, updatedAt: new Date() })
      .where(and(eq(grillSessions.id, session.id), eq(grillSessions.version, session.version))).returning();
    if (!updated.length) throw new ApiError(409, 'STALE_SESSION', 'Сессия изменилась. Обновите страницу');
    const [pending] = await tx.select().from(grillTurns).where(and(eq(grillTurns.sessionId, session.id), eq(grillTurns.nodeKey, current))).orderBy(desc(grillTurns.createdAt)).limit(1);
    if (pending) await tx.update(grillTurns).set({ answer }).where(eq(grillTurns.id, pending.id));
    const existing = existingFields.find((field) => field.key === current);
    if (existing) await tx.update(taskFields).set({ value, state: 'suggested', source: 'turn', sourceQuote,
      sourceTurnId: pending?.id ?? null, revision: existing.revision + 1 }).where(eq(taskFields.id, existing.id));
    else await tx.insert(taskFields).values({ taskId, key: current, value, state: 'suggested', source: 'turn', sourceQuote, sourceTurnId: pending?.id });
    if (nextNode) await tx.insert(grillTurns).values({ sessionId: session.id, nodeKey: nextNode, question: phrased?.question || fallbackQuestion(nextNode) });
    await tx.insert(aiLogs).values({ taskId, turnId: pending?.id ?? null, kind: 'analyze-text', agent: analyzed?.log?.agent ?? 'fallback',
      model: analyzed?.log?.model ?? null, input: { text: answer, targetNode: current }, parseOk: Boolean(analyzed),
      fallbackUsed: !analyzed, fallbackReason: analyzed ? null : 'AI disabled or unavailable' });
    return updated[0];
  });
  return { task: await taskView(task), question: question(nextNode, phrased?.question),
    session: { id: result.id, version: result.version, currentNode: nextNode }, score: score({ fields }),
    fallbackUsed: !analyzed || Boolean(nextNode && !phrased) };
}

export async function updateTask(taskId: string, input: unknown) {
  const parsed = patchSchema.parse(input);
  const patch = parsed.task ?? parsed;
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Задача не найдена');
  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ title: patch.title ?? row.title, company: patch.company ?? row.company,
      topic: ('industry' in patch ? patch.industry : undefined) ?? ('topic' in patch ? patch.topic : undefined) ?? row.topic,
      status: patch.status ?? row.status, updatedAt: new Date() }).where(eq(tasks.id, taskId));
    const existing = await tx.select().from(taskFields).where(eq(taskFields.taskId, taskId));
    const currentView = projectWorkspaceTask(row, existing);
    for (const [workspaceKey, value] of Object.entries(patch.fields ?? {})) {
      const key = workspaceToNode[workspaceKey] ?? (isNode(workspaceKey) ? workspaceKey : null);
      if (!key) continue;
      const current = existing.find((field) => field.key === key);
      const confirmed = patch.confirmedFields?.includes(workspaceKey) ?? false;
      const state = confirmed ? 'confirmed' : 'suggested';
      if (workspaceKey in currentView.fields && currentView.fields[workspaceKey as keyof typeof currentView.fields] === value) {
        if (currentView.confirmedFields.includes(workspaceKey as keyof typeof currentView.fields) !== confirmed) {
          for (const node of workspaceNodes[workspaceKey]) {
            const field = existing.find((item) => item.key === node);
            if (field?.value) await tx.update(taskFields).set({ state, revision: field.revision + 1 }).where(eq(taskFields.id, field.id));
          }
        }
        continue;
      }
      if (current && current.value === value && current.state === state) continue;
      if (current) await tx.update(taskFields).set({ value, state, source: 'manual', sourceQuote: value,
        revision: current.revision + 1 }).where(eq(taskFields.id, current.id));
      else await tx.insert(taskFields).values({ taskId, key, value, state, source: 'manual', sourceQuote: value });
      for (const node of workspaceNodes[workspaceKey]?.slice(1) ?? []) {
        const field = existing.find((item) => item.key === node);
        if (field) await tx.update(taskFields).set({ value: '', state: 'empty', revision: field.revision + 1 }).where(eq(taskFields.id, field.id));
      }
    }
    const freshFields = await tx.select().from(taskFields).where(eq(taskFields.taskId, taskId));
    const rating = score({ fields: fieldMap(freshFields), neededRoles: row.neededRoles, neededSkills: row.neededSkills });
    await tx.update(tasks).set({ score: rating.total }).where(eq(tasks.id, taskId));
    if (rating.total !== row.score) await tx.insert(scoreEvents).values({ taskId, before: row.score, after: rating.total });
  });
  const [updated] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return { task: await taskView(updated) };
}

export async function getTaskScore(taskId: string) {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Задача не найдена');
  const rows = await db.select().from(taskFields).where(eq(taskFields.taskId, taskId));
  return score({ fields: fieldMap(rows), neededRoles: row.neededRoles, neededSkills: row.neededSkills, engagement: row.engagement as Card['engagement'] });
}

export async function publishTask(taskId: string) {
  const [row] = await db.update(tasks).set({ status: 'published', updatedAt: new Date() }).where(and(eq(tasks.id, taskId), eq(tasks.status, 'draft'))).returning();
  if (!row) throw new ApiError(409, 'INVALID_STATE', 'Задачу нельзя опубликовать');
  await db.update(grillSessions).set({ status: 'finished' }).where(eq(grillSessions.taskId, taskId));
  return { task: await taskView(row) };
}

export async function checkpoint(taskId: string, input: unknown) {
  const { block, action } = z.object({ block: z.string().min(1), action: z.enum(['confirm', 'edit']) }).parse(input);
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Задача не найдена');
  if (action === 'confirm') await db.transaction(async (tx) => {
    const fields = await tx.select().from(taskFields).where(eq(taskFields.taskId, taskId));
    for (const field of fields.filter((item) => item.state === 'suggested' && (block === 'all' || (block === 'draft' ? item.source === 'draft' : item.key.startsWith(`${block}.`))))) {
      await tx.update(taskFields).set({ state: 'confirmed', revision: field.revision + 1 }).where(eq(taskFields.id, field.id));
    }
    const fresh = await tx.select().from(taskFields).where(eq(taskFields.taskId, taskId));
    const rating = score({ fields: fieldMap(fresh), neededRoles: row.neededRoles, neededSkills: row.neededSkills });
    await tx.update(tasks).set({ score: rating.total, updatedAt: new Date() }).where(eq(tasks.id, taskId));
    if (rating.total !== row.score) await tx.insert(scoreEvents).values({ taskId, before: row.score, after: rating.total });
  });
  const [updated] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return { task: await taskView(updated), score: await getTaskScore(taskId) };
}

export async function updateField(taskId: string, node: string, input: unknown) {
  if (!isNode(node)) throw new ApiError(422, 'INVALID_NODE', 'Неизвестное поле карточки');
  const { action, value } = z.object({ action: z.enum(['edit', 'confirm']), value: z.string().trim().optional() }).parse(input);
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Задача не найдена');
  await db.transaction(async (tx) => {
    const [field] = await tx.select().from(taskFields).where(and(eq(taskFields.taskId, taskId), eq(taskFields.key, node))).limit(1);
    if (action === 'confirm') {
      if (!field || field.state !== 'suggested') throw new ApiError(409, 'INVALID_STATE', 'Поле сначала нужно заполнить');
      await tx.update(taskFields).set({ state: 'confirmed', revision: field.revision + 1 }).where(eq(taskFields.id, field.id));
    } else {
      if (!value) throw new ApiError(422, 'VALUE_REQUIRED', 'Введите значение поля');
      if (field) await tx.update(taskFields).set({ value, state: 'suggested', source: 'manual', sourceQuote: value, revision: field.revision + 1 }).where(eq(taskFields.id, field.id));
      else await tx.insert(taskFields).values({ taskId, key: node, value, state: 'suggested', source: 'manual', sourceQuote: value });
    }
    const fields = await tx.select().from(taskFields).where(eq(taskFields.taskId, taskId));
    const rating = score({ fields: fieldMap(fields), neededRoles: row.neededRoles, neededSkills: row.neededSkills });
    await tx.update(tasks).set({ score: rating.total, updatedAt: new Date() }).where(eq(tasks.id, taskId));
    if (rating.total !== row.score) await tx.insert(scoreEvents).values({ taskId, nodeKey: node, before: row.score, after: rating.total });
  });
  const [updated] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return { task: await taskView(updated), score: await getTaskScore(taskId) };
}
