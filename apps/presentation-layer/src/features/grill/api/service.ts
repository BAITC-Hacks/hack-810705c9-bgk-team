import { and, asc, eq, gt, sql } from 'drizzle-orm';
import {
  applyClassification,
  editField,
  nextStep,
  type GrillClassification,
  type GrillField,
  type GrillNode,
  type GrillQuestionNode,
  type GrillSessionState,
  type NextStep,
} from '@/entities/grill/model';
import { recalculateScore } from '@/features/task-card/api/recalculate-score';
import { db } from '@/shared/db';
import { aiLogs, criterion, grillSession, grillTurn, taskField, tasks } from '@/shared/db/schema';
import type {
  CreateGrillInput,
  EditGrillFieldInput,
  GrillCheckpointInput,
  SubmitGrillTurnInput,
} from '@/shared/api/contracts/grill';

type GrillTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export { ApiError as GrillApiError } from '@/shared/api/errors';
import { ApiError as GrillApiError } from '@/shared/api/errors';
import { requireTaskOwner } from '@/features/task-card/api/access';

const nodeBlocks: Record<string, string> = {
  'context.current': 'context', 'context.size': 'context', 'context.change': 'context',
  'result.artifact': 'result', 'result.acceptance': 'result', 'result.profile': 'result',
  'criteria.items': 'criteria', 'data.what': 'data', 'data.volume': 'data',
  'data.sample': 'data', 'data.collection': 'data', 'constraints.deadline': 'constraints',
  'constraints.stack': 'constraints', 'constraints.other': 'constraints',
  'users.role': 'users', 'users.scale': 'users', 'link.contact': 'link',
  'link.cadence': 'link', 'link.response': 'link',
};

const questions: Record<string, string> = {
  'context.current': 'Как сейчас решается эта задача?',
  'context.size': 'Какой объём или масштаб задачи?',
  'context.change': 'Что нужно изменить в текущем процессе?',
  'result.artifact': 'Какой конкретный результат нужно получить?',
  'result.acceptance': 'По каким признакам примете результат?',
  'result.profile': 'Какой тип результата ожидается?',
  'criteria.items': 'Какие критерии покажут, что задача выполнена?',
  'data.what': 'Какие данные доступны для работы?',
  'data.volume': 'Каков объём данных?',
  'data.sample': 'Есть ли пример данных или документация?',
  'data.collection': 'Кто и к какому сроку соберёт необходимые данные?',
  'constraints.deadline': 'Какой срок выполнения?',
  'constraints.stack': 'Есть ли обязательные технологии или ограничения?',
  'constraints.other': 'Какие ещё ограничения важно учесть?',
  'users.role': 'Кто будет пользоваться результатом?',
  'users.scale': 'Сколько пользователей или объектов ожидается?',
  'link.contact': 'К кому обращаться по вопросам задачи?',
  'link.cadence': 'Как часто нужно показывать промежуточный результат?',
  'link.response': 'Как быстро можно получить обратную связь?',
};

// Response formats only; these options add no business facts or numbers.
const answerOptions = ['Кратко', 'Списком', 'На примере'];

function serialized(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
}

function displayValue(value: unknown): string {
  return typeof value === 'string' ? value : serialized(value);
}

function normalizeQuote(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function validQuote(quote: string | undefined, source: string): quote is string {
  const normalizedQuote = quote ? normalizeQuote(quote) : '';
  return Boolean(quote?.trim() && normalizedQuote && normalizeQuote(source).includes(normalizedQuote));
}

function fieldValue(raw: string | null): unknown {
  if (raw === null) return null;
  try { return JSON.parse(raw) as unknown; } catch { return raw; }
}

function toState(session: typeof grillSession.$inferSelect, turns: (typeof grillTurn.$inferSelect)[]): GrillSessionState {
  const askedNodes = turns.map((turn) => turn.node as GrillQuestionNode);
  return {
    status: session.status,
    currentNode: session.currentNode as GrillQuestionNode | null,
    currentBlock: session.currentBlock as GrillSessionState['currentBlock'],
    pushbacks: session.pushbacks as Partial<Record<GrillQuestionNode, 0 | 1>>,
    questionsAsked: session.questionsAsked,
    version: session.version,
    askedNodes,
    skippedNodes: session.skippedNodes as GrillNode[],
  };
}

async function readFields(tx: GrillTx, taskId: string): Promise<Partial<Record<GrillNode, GrillField>>> {
  const rows = await tx.select().from(taskField).where(eq(taskField.taskId, taskId));
  const fields: Partial<Record<GrillNode, GrillField>> = {};
  for (const row of rows) {
    fields[row.node as GrillNode] = {
      value: fieldValue(row.value), state: row.state,
      notApplicable: row.notApplicable || undefined,
      sourceQuote: row.sourceQuote,
    };
  }
  const criteriaRows = await tx.select().from(criterion).where(eq(criterion.taskId, taskId)).orderBy(asc(criterion.position));
  if (criteriaRows.length) {
    fields['criteria.items'] = {
      value: criteriaRows.map(({ metric, threshold, thresholdHasNumber, howToCheck }) => ({ metric, threshold, thresholdHasNumber, howToCheck })),
      state: criteriaRows.every((row) => row.state === 'confirmed') ? 'confirmed' : 'suggested',
      sourceQuote: criteriaRows.map((row) => row.sourceQuote).join('\n'),
    };
  }
  return fields;
}

async function storeFields(
  tx: GrillTx,
  taskId: string,
  fields: Partial<Record<GrillNode, GrillField>>,
  source: 'draft' | 'turn' | 'manual',
  sourceTurnId?: number,
) {
  for (const [rawNode, field] of Object.entries(fields)) {
    if (!field || !field.sourceQuote?.trim()) continue;
    const node = rawNode as GrillNode;
    if (node === 'criteria.items') {
      if (!Array.isArray(field.value)) continue;
      const validItems = field.value.slice(0, 3).filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object' && typeof (item as Record<string, unknown>).metric === 'string'
          && typeof (item as Record<string, unknown>).threshold === 'string'
          && typeof (item as Record<string, unknown>).howToCheck === 'string'));
      if (validItems.length === 0) continue;
      await tx.delete(criterion).where(eq(criterion.taskId, taskId));
      for (const [index, value] of validItems.entries()) {
        const metric = value.metric as string;
        const threshold = value.threshold as string;
        const howToCheck = value.howToCheck as string;
        await tx.insert(criterion).values({
          taskId, position: index + 1, metric, threshold,
          thresholdHasNumber: /\d/.test(threshold), howToCheck,
          state: 'suggested', sourceQuote: field.sourceQuote,
          sourceTurnId: sourceTurnId ?? null,
        }).onConflictDoUpdate({
          target: [criterion.taskId, criterion.position],
          set: { metric, threshold, thresholdHasNumber: /\d/.test(threshold), howToCheck,
            state: 'suggested', sourceQuote: field.sourceQuote, sourceTurnId: sourceTurnId ?? null, updatedAt: new Date() },
        });
      }
      continue;
    }
    await tx.insert(taskField).values({
      taskId, node, value: serialized(field.value), state: field.state ?? 'suggested',
      notApplicable: Boolean(field.notApplicable), naNote: field.notApplicable ? serialized(field.value) : null,
      source, sourceQuote: field.sourceQuote, sourceTurnId: sourceTurnId ?? null,
    }).onConflictDoUpdate({
      target: [taskField.taskId, taskField.node],
      set: { value: serialized(field.value), state: field.state ?? 'suggested', notApplicable: Boolean(field.notApplicable),
        naNote: field.notApplicable ? serialized(field.value) : null, source, sourceQuote: field.sourceQuote,
        sourceTurnId: sourceTurnId ?? null, confirmedAt: null, updatedAt: new Date() },
    });
  }
}

async function latestTurn(tx: GrillTx, sessionId: number) {
  const [turn] = await tx.select().from(grillTurn).where(eq(grillTurn.sessionId, sessionId)).orderBy(sql`${grillTurn.seq} desc`).limit(1);
  return turn;
}

async function emitStep(tx: GrillTx, taskId: string, session: typeof grillSession.$inferSelect, step: NextStep, isPushback = false) {
  const block = step.kind === 'question' ? nodeBlocks[step.node] : null;
  if (step.kind !== 'question') {
    await tx.update(grillSession).set({ currentNode: null, currentBlock: step.kind === 'checkpoint' ? step.block : null, updatedAt: new Date() })
      .where(eq(grillSession.id, session.id));
    return step;
  }
  const seq = session.questionsAsked + 1;
  const isClarification = isPushback || step.isPushback;
  const baseQuestion = questions[step.node] ?? 'Расскажите подробнее.';
  const question = isClarification
    ? `Уточните, пожалуйста: ${baseQuestion} Можно привести конкретный пример?`
    : baseQuestion;
  await tx.insert(grillTurn).values({
    sessionId: session.id, seq, node: step.node, question,
    options: answerOptions, isPushback: isClarification, coveredNodes: [], fallbackUsed: false,
  });
  await tx.update(grillSession).set({
    currentNode: step.node, currentBlock: block, questionsAsked: seq, updatedAt: new Date(),
  }).where(eq(grillSession.id, session.id));
  return { ...step, question, options: answerOptions };
}

async function guardedSession(tx: GrillTx, taskId: string, version: number, allowFinished = false) {
  await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).for('update');
  const [session] = await tx.select().from(grillSession).where(eq(grillSession.taskId, taskId)).limit(1);
  if (!session) throw new GrillApiError(404, 'GRILL_NOT_FOUND', 'Сессия прожарки не найдена.');
  if (session.version !== version) throw new GrillApiError(409, 'STALE_SESSION', 'Сессия уже изменилась. Обновите страницу и повторите действие.');
  if (!allowFinished && session.status !== 'active') throw new GrillApiError(409, 'SESSION_FINISHED', 'Сессия уже завершена.');
  return session;
}

async function advanceVersion(tx: GrillTx, session: typeof grillSession.$inferSelect) {
  await tx.update(tasks).set({ version: sql`${tasks.version} + 1`, updatedAt: new Date() }).where(eq(tasks.id, session.taskId));
  const [updated] = await tx.update(grillSession).set({ version: session.version + 1, updatedAt: new Date() })
    .where(and(eq(grillSession.id, session.id), eq(grillSession.version, session.version)))
    .returning();
  if (!updated) throw new GrillApiError(409, 'STALE_SESSION', 'Сессия уже изменилась. Обновите страницу и повторите действие.');
  return updated;
}

export async function getGrill(taskId: string) {
  await requireTaskOwner(taskId);
  return db.transaction(async (tx) => {
    const [session] = await tx.select().from(grillSession).where(eq(grillSession.taskId, taskId)).limit(1);
    if (!session) throw new GrillApiError(404, 'GRILL_NOT_FOUND', 'Сессия прожарки не найдена.');
    const turns = await tx.select().from(grillTurn).where(eq(grillTurn.sessionId, session.id)).orderBy(asc(grillTurn.seq));
    const fields = await readFields(tx, taskId);
    return { session: toState(session, turns), fields, turns, next: session.currentNode
      ? { kind: 'question', node: session.currentNode, question: turns.at(-1)?.question ?? questions[session.currentNode], options: turns.at(-1)?.options ?? answerOptions, isPushback: turns.at(-1)?.isPushback ?? false }
      : session.currentBlock ? { kind: 'checkpoint', block: session.currentBlock } : session.status === 'finished' ? { kind: 'done' } : null };
  });
}

export async function createGrill(taskId: string, input: CreateGrillInput, transaction?: GrillTx) {
  if (!transaction) await requireTaskOwner(taskId);
  const create = async (tx: GrillTx) => {
    const [existing] = await tx.select({ id: grillSession.id }).from(grillSession).where(eq(grillSession.taskId, taskId)).limit(1);
    if (existing) throw new GrillApiError(409, 'GRILL_EXISTS', 'Прожарка для этой задачи уже создана.');
    const [session] = await tx.insert(grillSession).values({ taskId, currentBlock: 'draft', draftCheckpointState: 'pending' }).returning();
    const proposed: Partial<Record<GrillNode, GrillField>> = {};
    for (const [key, value] of Object.entries(input.draftFields ?? {})) {
      if (value && validQuote(value.sourceQuote, input.draftText)) proposed[key as GrillNode] = { ...value, value: value.value ?? null, state: 'suggested' };
    }
    await storeFields(tx, taskId, proposed, 'draft');
    return { session: toState(session, []), fields: proposed, next: { kind: 'checkpoint', block: 'draft' } as const };
  };
  return transaction ? create(transaction) : db.transaction(create);
}

export async function submitTurn(taskId: string, input: SubmitGrillTurnInput, inferenceLog?: Omit<typeof aiLogs.$inferInsert, "taskId" | "turnId">) {
  await requireTaskOwner(taskId);
  return db.transaction(async (tx) => {
    const session = await guardedSession(tx, taskId, input.sessionVersion);
    if (session.draftCheckpointState !== 'confirmed') throw new GrillApiError(409, 'DRAFT_CHECKPOINT_REQUIRED', 'Сначала подтвердите сводку черновика.');
    if (!session.currentNode) throw new GrillApiError(409, 'NO_PENDING_TURN', 'Сейчас нет ожидающего вопроса.');
    const current = await latestTurn(tx, session.id);
    if (!current || current.answer !== null) throw new GrillApiError(409, 'NO_PENDING_TURN', 'Вопрос уже обработан.');
    const classification = input.classification as GrillClassification | undefined;
    const sourceClassification: GrillClassification = classification ?? { specificity: 'specific', coveredNodes: [session.currentNode as GrillNode], fields: { [session.currentNode]: { value: input.answer, sourceQuote: input.answer } } };
    const verifiedFields: GrillClassification['fields'] = {};
    for (const [node, field] of Object.entries(sourceClassification.fields)) {
      if (field && validQuote(field.sourceQuote, input.answer)) verifiedFields[node as GrillNode] = field;
    }
    const verifiedCovered = sourceClassification.coveredNodes.filter((node) => verifiedFields[node]);
    const answerClass: GrillClassification = { ...sourceClassification, coveredNodes: verifiedCovered, fields: verifiedFields,
      notApplicable: (sourceClassification.notApplicable ?? []).filter((item) => validQuote(item.note, input.answer)) };
    const fields = await readFields(tx, taskId);
    const nextFields = applyClassification(fields, answerClass);
    const pushback = answerClass.specificity === 'vague' && (session.pushbacks[session.currentNode] ?? 0) === 0;
    const turnUpdate = await tx.update(grillTurn).set({ answer: input.answer, specificity: answerClass.specificity,
      coveredNodes: answerClass.coveredNodes, fallbackUsed: !classification })
      .where(and(eq(grillTurn.id, current.id), sql`${grillTurn.answer} IS NULL`)).returning();
    if (!turnUpdate.length) throw new GrillApiError(409, 'TURN_ALREADY_SUBMITTED', 'Ответ на этот вопрос уже сохранён.');
    if (inferenceLog) await tx.insert(aiLogs).values({ ...inferenceLog, taskId, turnId: current.id });
    if (!pushback) {
      const changedFields: Partial<Record<GrillNode, GrillField>> = {};
      for (const node of answerClass.coveredNodes) if (nextFields[node]) changedFields[node] = nextFields[node];
      for (const item of answerClass.notApplicable ?? []) {
        changedFields[item.node] = { value: item.note, state: 'suggested', notApplicable: true, sourceQuote: item.note };
      }
      await storeFields(tx, taskId, changedFields, 'turn', current.id);
    }
    const skippedNodes = new Set(session.skippedNodes as GrillNode[]);
    if (answerClass.dataUnavailable) { skippedNodes.add('data.volume'); skippedNodes.add('data.sample'); }
    const pushbacks = { ...session.pushbacks };
    if (pushback) pushbacks[session.currentNode] = 1;
    const [updated] = await tx.update(grillSession).set({
      version: session.version + 1, pushbacks, skippedNodes: [...skippedNodes], updatedAt: new Date(),
    }).where(and(eq(grillSession.id, session.id), eq(grillSession.version, input.sessionVersion), eq(grillSession.status, 'active'))).returning();
    if (!updated) throw new GrillApiError(409, 'STALE_SESSION', 'Сессия уже изменилась. Обновите страницу и повторите действие.');
    const decisionSession = { ...updated, pushbacks, skippedNodes: [...skippedNodes] };
    const step = pushback
      ? { kind: 'question', node: session.currentNode as GrillQuestionNode, isPushback: true } as const
      : nextStep(toState(decisionSession, [...(await tx.select().from(grillTurn).where(eq(grillTurn.sessionId, session.id))), current]), await readFields(tx, taskId), answerClass);
    const emitted = await emitStep(tx, taskId, decisionSession, step, pushback);
    return { next: emitted, fallbackUsed: !classification, sessionVersion: updated.version, fields: await readFields(tx, taskId) };
  });
}

export async function checkpoint(taskId: string, input: GrillCheckpointInput) {
  await requireTaskOwner(taskId);
  return db.transaction(async (tx) => {
    const session = await guardedSession(tx, taskId, input.sessionVersion);
    if (session.currentBlock !== input.block) throw new GrillApiError(409, 'CHECKPOINT_MISMATCH', 'Этот блок сейчас нельзя подтвердить.');
    if (input.block === 'draft') {
      if (input.action === 'confirm') {
        await tx.update(taskField).set({ state: 'confirmed', confirmedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(taskField.taskId, taskId), eq(taskField.source, 'draft'), eq(taskField.state, 'suggested')));
        await tx.update(criterion).set({ state: 'confirmed', updatedAt: new Date() }).where(eq(criterion.taskId, taskId));
      }
      await recalculateScore(tx, taskId, 'task');
    const updated = await advanceVersion(tx, session);
      await tx.update(grillSession).set({ draftCheckpointState: input.action === 'confirm' ? 'confirmed' : 'pending' }).where(eq(grillSession.id, session.id));
      if (input.action === 'edit') return { next: { kind: 'checkpoint', block: 'draft' }, sessionVersion: updated.version };
      const refreshed = (await tx.select().from(grillSession).where(eq(grillSession.id, session.id)).limit(1))[0];
      const turns = await tx.select().from(grillTurn).where(eq(grillTurn.sessionId, session.id));
      const step = nextStep(toState(refreshed, turns), await readFields(tx, taskId));
      const next = await emitStep(tx, taskId, refreshed, step);
      return { next, sessionVersion: refreshed.version, fields: await readFields(tx, taskId) };
    }
    if (input.action === 'confirm') {
      const fields = await readFields(tx, taskId);
      for (const [node, field] of Object.entries(fields)) {
        if (nodeBlocks[node] === input.block && field.state === 'suggested') {
          await tx.update(taskField).set({ state: 'confirmed', confirmedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(taskField.taskId, taskId), eq(taskField.node, node)));
          if (node === 'criteria.items') await tx.update(criterion).set({ state: 'confirmed', updatedAt: new Date() }).where(eq(criterion.taskId, taskId));
        }
      }
    }
    await recalculateScore(tx, taskId, 'task');
    const updated = await advanceVersion(tx, session);
    if (input.action === 'edit') {
      return { next: { kind: 'checkpoint', block: input.block }, sessionVersion: updated.version, fields: await readFields(tx, taskId) };
    }
    await tx.update(grillSession).set({ currentNode: null, currentBlock: null }).where(eq(grillSession.id, session.id));
    const cleared = { ...updated, currentNode: null, currentBlock: null };
    const fields = await readFields(tx, taskId);
    const turns = await tx.select().from(grillTurn).where(eq(grillTurn.sessionId, session.id));
    const step = nextStep(toState(cleared, turns), fields);
    const next = await emitStep(tx, taskId, cleared, step);
    return { next, sessionVersion: updated.version, fields: await readFields(tx, taskId) };
  });
}

export async function patchField(taskId: string, node: string, input: EditGrillFieldInput) {
  await requireTaskOwner(taskId);
  return db.transaction(tx => patchFieldInTransaction(tx, taskId, node, input));
}

/** Internal composition: the calling use-case must authorize task ownership first. */
export async function patchFieldInTransaction(tx: GrillTx, taskId: string, node: string, input: EditGrillFieldInput) {
  if (!Object.hasOwn(nodeBlocks, node)) throw new GrillApiError(422, 'INVALID_NODE', 'Неизвестное поле');
  const session = await guardedSession(tx, taskId, input.sessionVersion, true);
  const [row] = await tx.select().from(taskField).where(and(eq(taskField.taskId, taskId), eq(taskField.node, node))).limit(1);
  const criteriaRows = node === 'criteria.items'
    ? await tx.select().from(criterion).where(eq(criterion.taskId, taskId)).orderBy(asc(criterion.position))
    : [];
  if (!row && !criteriaRows.length && input.action === 'confirm') throw new GrillApiError(404, 'FIELD_NOT_FOUND', 'Поле карточки не найдено.');
  const updatedSession = await advanceVersion(tx, session);
  const old: GrillField = row
    ? { value: fieldValue(row.value), state: row.state, notApplicable: row.notApplicable, sourceQuote: row.sourceQuote }
    : { value: criteriaRows.map(({ metric, threshold, thresholdHasNumber, howToCheck }) => ({ metric, threshold, thresholdHasNumber, howToCheck })),
      state: criteriaRows.every((item) => item.state === 'confirmed') ? 'confirmed' : 'suggested',
      sourceQuote: criteriaRows.map((item) => item.sourceQuote).join('\n') };
  if (input.action === 'edit') {
    if (!('value' in input)) throw new GrillApiError(422, 'VALUE_REQUIRED', 'Укажите новое значение поля.');
    const edited = editField(old, input.value);
    if (node === 'criteria.items') {
      if (!Array.isArray(edited.value)) throw new GrillApiError(422, 'INVALID_CRITERIA', 'Критерии должны быть списком структурированных значений.');
      const values = edited.value.slice(0, 3);
      await tx.delete(criterion).where(and(eq(criterion.taskId, taskId), gt(criterion.position, values.length)));
      if (!values.length || values.some((item) => !item || typeof item !== 'object'
        || typeof (item as Record<string, unknown>).metric !== 'string'
        || typeof (item as Record<string, unknown>).threshold !== 'string'
        || typeof (item as Record<string, unknown>).howToCheck !== 'string')) {
        throw new GrillApiError(422, 'INVALID_CRITERIA', 'Каждый критерий должен содержать metric, threshold и howToCheck.');
      }
      for (const [index, item] of values.entries()) {
        const value = item as Record<string, unknown>;
        const metric = value.metric as string;
        const threshold = value.threshold as string;
        const howToCheck = value.howToCheck as string;
        await tx.insert(criterion).values({ taskId, position: index + 1, metric, threshold,
          thresholdHasNumber: /\d/.test(threshold), howToCheck, state: 'suggested',
        sourceQuote: displayValue(edited.value), sourceTurnId: null }).onConflictDoUpdate({
            target: [criterion.taskId, criterion.position], set: { metric, threshold,
              thresholdHasNumber: /\d/.test(threshold), howToCheck, state: 'suggested',
              sourceQuote: displayValue(edited.value), sourceTurnId: null, updatedAt: new Date() },
          });
      }
    } else {
      await storeFields(tx, taskId, { [node]: { value: edited.value, state: 'suggested', sourceQuote: displayValue(edited.value) } }, 'manual');
    }
  } else {
    if (node === 'criteria.items') await tx.update(criterion).set({ state: 'confirmed', updatedAt: new Date() }).where(eq(criterion.taskId, taskId));
    else await tx.update(taskField).set({ state: 'confirmed', confirmedAt: new Date(), updatedAt: new Date() }).where(and(eq(taskField.taskId, taskId), eq(taskField.node, node)));
  }
  if (node === 'criteria.items' && input.action === 'edit') {
    const [task] = await tx.update(tasks).set({ criteriaVersion: sql`${tasks.criteriaVersion} + 1` }).where(eq(tasks.id, taskId)).returning();
    await tx.update(criterion).set({ version: task.criteriaVersion }).where(eq(criterion.taskId, taskId));
  }
  await recalculateScore(tx, taskId, 'task');
  return { fields: await readFields(tx, taskId), sessionVersion: updatedSession.version };
}

export async function finishGrill(taskId: string, sessionVersion: number) {
  await requireTaskOwner(taskId);
  return db.transaction(async (tx) => {
    const session = await guardedSession(tx, taskId, sessionVersion);
    const [updated] = await tx.update(grillSession).set({ status: 'finished', currentNode: null, currentBlock: null,
      version: session.version + 1, updatedAt: new Date() })
      .where(and(eq(grillSession.id, session.id), eq(grillSession.version, sessionVersion), eq(grillSession.status, 'active'))).returning();
    if (!updated) throw new GrillApiError(409, 'STALE_SESSION', 'Сессия уже изменилась. Обновите страницу и повторите действие.');
    return { session: toState(updated, await tx.select().from(grillTurn).where(eq(grillTurn.sessionId, session.id))), sessionVersion: updated.version };
  });
}

/** Persist inference only while the exact unanswered question is still current. */
export async function saveQuestionWording(taskId: string, expected: {
  version: number; node: string; turnId: number;
}, wording: { question: string; options: string[] } | null,
  inferenceLog: Omit<typeof aiLogs.$inferInsert, 'taskId' | 'turnId'>,
) {
  await requireTaskOwner(taskId);
  return db.transaction(async tx => {
    await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).for('update');
    const [session] = await tx.select().from(grillSession).where(eq(grillSession.taskId, taskId));
    if (!session || session.status !== 'active' || session.version !== expected.version || session.currentNode !== expected.node) return;
    const current = await latestTurn(tx, session.id);
    if (!current || current.id !== expected.turnId || current.answer !== null || current.node !== expected.node) return;
    const [logged] = await tx.select({ id: aiLogs.id }).from(aiLogs).where(and(eq(aiLogs.turnId, current.id), eq(aiLogs.kind, 'phrase-question'))).limit(1);
    if (logged) return;
    if (wording) await tx.update(grillTurn).set({ question: wording.question, options: wording.options, fallbackUsed: false }).where(eq(grillTurn.id, current.id));
    else await tx.update(grillTurn).set({ fallbackUsed: true }).where(eq(grillTurn.id, current.id));
    await tx.insert(aiLogs).values({ ...inferenceLog, kind: 'phrase-question', taskId, turnId: current.id });
  });
}
