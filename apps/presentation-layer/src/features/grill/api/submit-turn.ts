import type { NodeId } from '@/shared/api/contracts/common';
import type { GrillNext, GrillTurnRequest, GrillTurnResponse } from '@/shared/api/contracts/grill';
import type { DemoActor } from '@/shared/api/demo-actor';
import { conflict, forbidden } from '@/shared/api/errors';
import { getAiPort, ruleBasedFallbackQuestion } from '@/shared/api/ports';
import { ruleBasedSingleField } from '@/shared/api/store/rule-based-analyzer';
import { createId, getTaskOrThrow, logAiCall, store } from '@/shared/api/store';
import { NODES_BY_BLOCK } from '@/shared/api/store/nodes';
import { inMemoryTransaction } from '@/shared/db/transaction';

import type { InternalTask } from '@/shared/api/store/domain';

import { nextStep, type NextStepResult } from './next-step';

/**
 * ADR-009 §5–6: AI-вызов (analyzeText для целевого узла, затем
 * phraseQuestion) выполняется ДО открытия транзакции; при ошибке/таймауте —
 * шаблонный вопрос и `fallbackUsed: true`, сценарий не прерывается (ADR-003
 * §5). Транзакция — короткая: запись ответа-хода, поля, пересчёт следующего
 * шага. Устаревший `sessionVersion` → 409 (ADR-004 §6).
 */
export async function submitGrillTurn(
  actor: DemoActor,
  taskId: string,
  request: GrillTurnRequest,
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

  let fallbackUsed = false;
  let extractedValue = '';
  let extractedQuote = '';
  let fallbackReason: string | undefined;
  const aiPort = getAiPort();
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
      if (!field || !request.answer.includes(field.sourceQuote)) {
        throw new Error('AI did not cover target node with a verifiable quote');
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
    latencyMs: Date.now() - analyzeStartedAt,
    fallbackUsed,
    fallbackReason,
  });

  return inMemoryTransaction(async () => {
    task.fields.set(targetNode, {
      node: targetNode,
      value: extractedValue,
      state: 'suggested',
      notApplicable: /данных нет|не применимо|нет данных/i.test(request.answer),
      source: 'turn',
      sourceQuote: extractedQuote,
      sourceTurnId: undefined,
    });

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

    session.questionsAsked += 1;
    session.version += 1;

    const followUp = nextStep(session, task);
    if (followUp.kind === 'question') {
      const block = (Object.keys(NODES_BY_BLOCK) as (keyof typeof NODES_BY_BLOCK)[]).find(
        (candidate) => NODES_BY_BLOCK[candidate].includes(followUp.node),
      );
      if (block) session.currentBlock = block;
    } else if (followUp.kind === 'checkpoint') {
      session.currentBlock = followUp.block;
    }
    let next: GrillNext;
    if (followUp.kind === 'question') {
      let question = '';
      let options: string[] = [];
      let phraseFallback = false;
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
        } catch {
          fallbackUsed = true;
          phraseFallback = true;
          const template = ruleBasedFallbackQuestion(followUp.node);
          question = template.question;
          options = template.options;
        }
      } else {
        phraseFallback = true;
        const template = ruleBasedFallbackQuestion(followUp.node);
        question = template.question;
        options = template.options;
      }
      logAiCall({
        taskId,
        turnId,
        kind: 'phrase-question',
        agent: 'griller',
        model: process.env.LLM_MODEL ?? 'anthropic/claude-sonnet-5',
        prompt: 'phrase-question(node, isPushback, context)',
        input: JSON.stringify({ node: followUp.node, isPushback: followUp.isPushback }),
        rawOutput: JSON.stringify({ question, options }),
        parseOk: !phraseFallback,
        retryCount: 0,
        dropped: [],
        latencyMs: Date.now() - phraseStartedAt,
        fallbackUsed: phraseFallback,
        fallbackReason: phraseFallback ? (aiPort ? 'phrase-question failed' : 'AI_ENABLED=false') : undefined,
      });
      next = {
        kind: 'question',
        node: followUp.node,
        question,
        options,
        isPushback: followUp.isPushback,
      };
    } else {
      next = buildCheckpointOrDone(followUp, task);
      if (followUp.kind === 'done') session.status = 'finished';
    }

    return {
      next,
      fallbackUsed,
      sessionVersion: session.version,
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
