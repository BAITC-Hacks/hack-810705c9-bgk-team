import { MastraClient } from '@mastra/client-js';

import {
  analyzeTextOutputSchema,
  phraseQuestionOutputSchema,
  type AiPort,
  type AnalyzeTextInput,
  type AnalyzeTextOutput,
  type PhraseQuestionInput,
  type PhraseQuestionOutput,
} from './ai-port';

/**
 * INTEGRATION(ADR-003): точка подключения реального AI-слоя через
 * `@mastra/client-js`. `ai-logic-layer` ещё не зарегистрировала workflow
 * `analyze-text`/`phrase-question` (ADR-003 §Контекст: «в ai-logic-layer пока
 * нет ни одного агента»). Метод ниже (`workflow.createRun()` +
 * `run.startAsync()`) соответствует публичному API `@mastra/client-js@1.47`
 * (`node_modules/@mastra/client-js/dist/resources/{workflow,run}.d.ts`).
 * Владелец ADR-003 должен подтвердить id workflow и форму
 * входа/выхода при регистрации.
 *
 * AI-9: таймауты — 15 с для основной модели (`griller`/`phrase-question`),
 * 5 с для nano-классификатора (`card-extractor`/`analyze-text`). Оба этапа
 * (`createRun()` и `run.startAsync()`) участвуют в общей гонке с таймером,
 * который снимается (`clearTimeout`) как только основной промис
 * урегулировался — иначе процесс держит незавершённый таймер до истечения
 * `timeoutMs` даже при успешном раннем ответе.
 */

const ANALYZE_TEXT_TIMEOUT_MS = 5_000;
const PHRASE_QUESTION_TIMEOUT_MS = 15_000;

const client = new MastraClient({
  baseUrl: process.env.MASTRA_API_URL ?? 'http://localhost:4111',
});

async function runWorkflow(
  workflowId: string,
  inputData: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Mastra workflow "${workflowId}" timeout`)), timeoutMs);
  });

  try {
    const run = await Promise.race([client.getWorkflow(workflowId).createRun(), timeout]);
    const result = await Promise.race([run.startAsync({ inputData }), timeout]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `WorkflowRunResult` — размеченное объединение по `status`
 * (`success | failed | tripwire | suspended | paused`,
 * `@mastra/core/dist/workflows/types.d.ts`). Только `status:'success'`
 * содержит `result: TOutput`; остальные статусы — не «неизвестная форма», а
 * явный отказ workflow, который должен уходить в тот же fallback-путь, что и
 * сетевая ошибка/таймаут, а не быть слепо приведённым к `TOutput`.
 */
function unwrapWorkflowResult(workflowId: string, raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !('status' in raw)) {
    throw new Error(`Mastra workflow "${workflowId}" returned an unexpected shape`);
  }
  const outcome = raw as { status: string; result?: unknown; error?: unknown };
  if (outcome.status !== 'success') {
    const detail = outcome.error instanceof Error ? outcome.error.message : outcome.status;
    throw new Error(`Mastra workflow "${workflowId}" did not succeed: ${detail}`);
  }
  return outcome.result;
}

export const mastraAiPort: AiPort = {
  async analyzeText(input: AnalyzeTextInput): Promise<AnalyzeTextOutput> {
    const raw = await runWorkflow('analyze-text', input, ANALYZE_TEXT_TIMEOUT_MS);
    const result = unwrapWorkflowResult('analyze-text', raw);
    // Провал схемы здесь -> ZodError, который вызывающий use-case ловит как
    // обычный сбой AI-вызова и переключается на заглушку (ADR-003 §5),
    // не роняя запрос 500-й ошибкой.
    return analyzeTextOutputSchema.parse(result);
  },
  async phraseQuestion(input: PhraseQuestionInput): Promise<PhraseQuestionOutput> {
    const raw = await runWorkflow('phrase-question', input, PHRASE_QUESTION_TIMEOUT_MS);
    const result = unwrapWorkflowResult('phrase-question', raw);
    return phraseQuestionOutputSchema.parse(result);
  },
};
