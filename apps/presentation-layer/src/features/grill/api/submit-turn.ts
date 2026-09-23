import type { NodeId } from '@/shared/api/contracts/common';
import type { GrillNext, GrillTurnRequest, GrillTurnResponse } from '@/shared/api/contracts/grill';
import type { DemoActor } from '@/shared/api/demo-actor';
import { conflict, forbidden } from '@/shared/api/errors';
import { getAiPort, ruleBasedFallbackQuestion, type AiPort } from '@/shared/api/ports';
import { ruleBasedSingleField } from '@/shared/api/store/rule-based-analyzer';
import { createId, getTaskOrThrow, logAiCall, store } from '@/shared/api/store';
import { NODES_BY_BLOCK } from '@/shared/api/store/nodes';
import { inMemoryTransaction, type TransactionRunner } from '@/shared/db/transaction';

import type { InternalField, InternalTask } from '@/shared/api/store/domain';

import { nextStep, type NextStepResult, type NextStepTaskView } from './next-step';

/**
 * ADR-009 §5–6 / ADR-003 §5: ВСЕ вызовы AI-порта (`analyzeText` для ответа
 * на текущий узел, затем `phraseQuestion` для следующего) выполняются ДО
 * открытия транзакции записи — включая формулировку следующего вопроса,
 * которая раньше по ошибке звалась внутри `inMemoryTransaction`. Чтобы
 * посчитать следующий шаг (нужен ли `phraseQuestion` и для какого узла) без
 * мутации реальной задачи, используется проекция состояния
 * (`projectedFields`/`projectedSession`, см. `NextStepTaskView`) — сама
 * запись происходит только в короткой синхронной транзакции ниже.
 *
 * Устаревший `sessionVersion` → 409 (ADR-004 §6). Проверка версии
 * выполняется ДВАЖДЫ: до AI-вызовов (быстрый отказ, чтобы не тратить AI на
 * заведомо устаревший ход) и ПЕРВОЙ строкой внутри транзакции записи, без
 * единого `await` между этой повторной проверкой и самой записью — на
 * in-memory сторе это гарантирует атомарность (однопоточный event loop не
 * может прерваться посреди синхронного колбэка), а при переносе на
 * Drizzle (`shared/db/transaction.ts`) эта же проверка становится условным
 * `UPDATE ... WHERE version = $2 RETURNING`.
 */
export async function submitGrillTurn(
  actor: DemoActor,
  taskId: string,
  request: GrillTurnRequest,
  aiPortOverride?: AiPort | null,
  txRunner: TransactionRunner = inMemoryTransaction,
): Promise<GrillTurnResponse> {
  const task = getTaskOrThrow(taskId);
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Отвечать на вопросы прожарки может только бизнес — владелец задачи.');
  }

  const session = store.sessions.get(taskId);
  if (!session || session.status !== 'active') {
    throw conflict('Сессия прожарки не активна.');
  }
  if (session.version !== request.sessionVersion) {
    // Быстрый отказ до траты AI-бюджета на заведомо устаревший ход.
    // Авторитетна повторная проверка внутри транзакции ниже.
    throw conflict('Версия сессии устарела. Обновите страницу и повторите ответ.', {
      currentVersion: session.version,
    });
  }

  const step = nextStep(session, task);
  if (step.kind !== 'question') {
    // Ход пришёл, когда прожарка уже готова к checkpoint/done — сообщаем об
    // этом клиенту тем же ответом, без записи хода.
    return {
      next: buildCheckpointOrDone(step, task),
      fallbackUsed: false,
      sessionVersion: session.version,
    };
  }
  const targetNode: NodeId = step.node;
  const aiPort = aiPortOverride !== undefined ? aiPortOverride : getAiPort();

  // --- 1. Извлечение поля из ответа (AI или заглушка), ВНЕ транзакции. ---
  let fallbackUsed = false;
  let extractedValue = '';
  let extractedQuote = '';
  let fallbackReason: string | undefined;
  const analyzeStartedAt = Date.now();
  if (!aiPort) {
    fallbackUsed = true;
    fallbackReason = 'AI_ENABLED=false';
    const fallback = ruleBasedSingleField(targetNode, request.answer);
    extractedValue = fallback.value;
    extractedQuote = fallback.sourceQuote;
  } else {
    try {
      const analysis = await aiPort.analyzeText({
        text: request.answer,
        targetNodes: [targetNode],
        dictionary: { roles: [], skills: [] },
      });
      const field = analysis.fields.find((f) => f.node === targetNode);
      if (!field || field.sourceQuote.length === 0 || !request.answer.includes(field.sourceQuote)) {
        throw new Error('AI did not cover target node with a verifiable non-empty quote');
      }
      extractedValue = field.value;
      extractedQuote = field.sourceQuote;
    } catch (cause) {
      fallbackUsed = true;
      fallbackReason = (cause as Error)?.message ?? 'analyze-text failed';
      const fallback = ruleBasedSingleField(targetNode, request.answer);
      extractedValue = fallback.value;
      extractedQuote = fallback.sourceQuote;
    }
  }
  const analyzeLatencyMs = Date.now() - analyzeStartedAt;
  const writtenField: InternalField = {
    node: targetNode,
    value: extractedValue,
    state: 'suggested',
    notApplicable: /данных нет|не применимо|нет данных/i.test(request.answer),
    source: 'turn',
    sourceQuote: extractedQuote,
    sourceTurnId: undefined,
  };

  // --- 2. Проекция состояния после записи поля — без мутации реальной
  //        задачи — чтобы понять, каким будет следующий шаг. ---
  const projectedFields = new Map(task.fields);
  projectedFields.set(targetNode, writtenField);
  const projectedTask: NextStepTaskView = { fields: projectedFields, criteria: task.criteria };
  const projectedSession = { ...session, questionsAsked: session.questionsAsked + 1 };
  const followUp = nextStep(projectedSession, projectedTask);

  // --- 3. Формулировка следующего вопроса (AI или заглушка), тоже ВНЕ
  //        транзакции — раньше это ошибочно происходило внутри неё. ---
  let preparedNext: GrillNext | null = null;
  let phraseLog: {
    question: string;
    options: string[];
    fallbackUsed: boolean;
    fallbackReason?: string;
    latencyMs: number;
  } | null = null;
  if (followUp.kind === 'question') {
    let question = '';
    let options: string[] = [];
    let phraseFallback = false;
    let phraseFallbackReason: string | undefined;
    const phraseStartedAt = Date.now();
    if (aiPort) {
      try {
        const phrased = await aiPort.phraseQuestion({
          node: followUp.node,
          isPushback: followUp.isPushback,
          context: task.draftText,
        });
        question = phrased.question;
        options = phrased.options;
      } catch (cause) {
        phraseFallback = true;
        phraseFallbackReason = (cause as Error)?.message ?? 'phrase-question failed';
        const template = ruleBasedFallbackQuestion(followUp.node);
        question = template.question;
        options = template.options;
      }
    } else {
      phraseFallback = true;
      phraseFallbackReason = 'AI_ENABLED=false';
      const template = ruleBasedFallbackQuestion(followUp.node);
      question = template.question;
      options = template.options;
    }
    if (phraseFallback) fallbackUsed = true;
    phraseLog = {
      question,
      options,
      fallbackUsed: phraseFallback,
      fallbackReason: phraseFallbackReason,
      latencyMs: Date.now() - phraseStartedAt,
    };
    preparedNext = {
      kind: 'question',
      node: followUp.node,
      question,
      options,
      isPushback: followUp.isPushback,
    };
  }

  // --- 4. Короткая синхронная транзакция: повторная проверка версии
  //        первой строкой, затем запись хода/поля/лога/пересчёта. Никаких
  //        `await` внутри — см. комментарий над функцией и в
  //        shared/db/transaction.ts. ---
  return txRunner(() => {
    const currentSession = store.sessions.get(taskId);
    if (!currentSession || currentSession.status !== 'active') {
      throw conflict('Сессия прожарки не активна.');
    }
    if (currentSession.version !== request.sessionVersion) {
      throw conflict('Версия сессии устарела. Обновите страницу и повторите ответ.', {
        currentVersion: currentSession.version,
      });
    }

    task.fields.set(targetNode, writtenField);

    const turns = store.turns.get(taskId) ?? [];
    const turnId = createId('turn');
    turns.push({
      id: turnId,
      sessionTaskId: taskId,
      seq: turns.length + 1,
      node: targetNode,
      question: '',
      options: [],
      isPushback: step.isPushback,
      answer: request.answer,
      fallbackUsed,
    });
    store.turns.set(taskId, turns);

    currentSession.questionsAsked += 1;
    currentSession.version += 1;
    if (followUp.kind === 'question') {
      const block = (Object.keys(NODES_BY_BLOCK) as (keyof typeof NODES_BY_BLOCK)[]).find(
        (candidate) => NODES_BY_BLOCK[candidate].includes(followUp.node),
      );
      if (block) currentSession.currentBlock = block;
    } else if (followUp.kind === 'checkpoint') {
      currentSession.currentBlock = followUp.block;
    }

    logAiCall({
      taskId,
      kind: 'analyze-text',
      agent: 'card-extractor',
      model: process.env.CLASSIFIER_MODEL ?? 'openai/gpt-5.4-nano',
      prompt: 'analyze-text(node, answer)',
      input: JSON.stringify({ node: targetNode, answer: request.answer }),
      rawOutput: JSON.stringify({ value: extractedValue, sourceQuote: extractedQuote }),
      parseOk: !fallbackUsed,
      retryCount: 0,
      dropped: [],
      latencyMs: analyzeLatencyMs,
      fallbackUsed,
      fallbackReason,
    });
    if (phraseLog) {
      logAiCall({
        taskId,
        turnId,
        kind: 'phrase-question',
        agent: 'griller',
        model: process.env.LLM_MODEL ?? 'anthropic/claude-sonnet-5',
        prompt: 'phrase-question(node, isPushback, context)',
        input: JSON.stringify({ node: followUp.kind === 'question' ? followUp.node : null }),
        rawOutput: JSON.stringify({ question: phraseLog.question, options: phraseLog.options }),
        parseOk: !phraseLog.fallbackUsed,
        retryCount: 0,
        dropped: [],
        latencyMs: phraseLog.latencyMs,
        fallbackUsed: phraseLog.fallbackUsed,
        fallbackReason: phraseLog.fallbackReason,
      });
    }

    let next: GrillNext;
    if (followUp.kind === 'question') {
      // preparedNext всегда задан в этой ветке — followUp.kind==='question'
      // вычислялся до транзакции той же проекцией состояния (см. выше).
      next = preparedNext!;
    } else {
      // followUp.kind — 'checkpoint' | 'done'; строится после записи поля
      // выше, поэтому цитаты checkpoint уже отражают этот ход.
      next = buildCheckpointOrDone(followUp, task);
      if (followUp.kind === 'done') currentSession.status = 'finished';
    }

    return {
      next,
      fallbackUsed,
      sessionVersion: currentSession.version,
    };
  });
}

function buildCheckpointOrDone(
  step: Extract<NextStepResult, { kind: 'checkpoint' | 'done' }>,
  task: InternalTask,
): GrillNext {
  if (step.kind === 'done') return { kind: 'done' };
  const quotes = NODES_BY_BLOCK[step.block]
    .map((node) => task.fields.get(node))
    .filter((field): field is NonNullable<typeof field> => !!field?.sourceQuote)
    .map((field) => ({ node: field.node, quote: field.sourceQuote! }));
  return { kind: 'checkpoint', block: step.block, summary: quotes };
}
