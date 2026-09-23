import { MastraClient } from '@mastra/client-js';

import type {
  AiPort,
  AnalyzeTextInput,
  AnalyzeTextOutput,
  PhraseQuestionInput,
  PhraseQuestionOutput,
} from './ai-port';

/**
 * INTEGRATION(ADR-003): точка подключения реального AI-слоя через
 * `@mastra/client-js`. `ai-logic-layer` ещё не зарегистрировала workflow
 * `analyze-text`/`phrase-question` (ADR-003 §Контекст: «в ai-logic-layer пока
 * нет ни одного агента»). Метод ниже (`workflow.createRun()` +
 * `run.startAsync()`) соответствует публичному API `@mastra/client-js@1.47`
 * (`node_modules/@mastra/client-js/dist/resources/{workflow,run}.d.ts`).
 * Владелец ADR-003 должен подтвердить id workflow и форму
 * входа/выхода при регистрации. Таймауты (15 с / 5 с, AI-9) применяются
 * через `Promise.race`; use-case (`grill/api/submit-turn.ts`) трактует любую
 * ошибку отсюда как сигнал `fallbackUsed`, поэтому неточность в имени
 * workflow не блокирует остальной контракт.
 */

const client = new MastraClient({
  baseUrl: process.env.MASTRA_API_URL ?? 'http://localhost:4111',
});

async function runWorkflow<TOutput>(
  workflowId: string,
  inputData: Record<string, unknown>,
  timeoutMs: number,
): Promise<TOutput> {
  const workflow = client.getWorkflow(workflowId);
  const run = await workflow.createRun();
  const result = await Promise.race([
    run.startAsync({ inputData }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Mastra workflow "${workflowId}" timeout`)), timeoutMs),
    ),
  ]);
  return result as TOutput;
}

export const mastraAiPort: AiPort = {
  async analyzeText(input: AnalyzeTextInput): Promise<AnalyzeTextOutput> {
    return runWorkflow<AnalyzeTextOutput>('analyze-text', input, 15_000);
  },
  async phraseQuestion(input: PhraseQuestionInput): Promise<PhraseQuestionOutput> {
    return runWorkflow<PhraseQuestionOutput>('phrase-question', input, 15_000);
  },
};
