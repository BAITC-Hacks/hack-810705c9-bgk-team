/**
 * Historical PR #12 prototype; deliberately NOT registered in Mastra.
 * Its suspend/resume lifecycle and memory calls are incompatible with ADR-002/003.
 * Task Match uses analyze-text / phrase-question; BFF owns every business transition.
 * Kept only as a source reference for the original interview methodology.
 */
import { createWorkflow } from '@mastra/core/workflows';

import {
  FinalOutput,
  MAX_ROUNDS,
  PipelineInput,
  type PipelineState,
} from '../schemas/pipeline';
import { compileStep } from './steps/compile';
import { initStep, startStageStep } from './steps/init-step';
import { roundStep } from './steps/round-step';
import { translateStep, translatorAskStep } from './steps/translator';

/**
 * Пайплайн Стек №1 «Результат и Контроль»:
 * seedIdea + язык диалога → SMART → User Story → Job Story → Acceptance Criteria
 * (каждая стадия — цикл раундов suspend/resume + exit-гейт) → сборка пакета →
 * вопрос переводчика («на какие языки?») → перевод финальной версии.
 *
 * Человек отвечает через run.resume(); снапшоты хранятся в mastra_db (PostgresStore),
 * run переживает рестарты сервера.
 */
const stageDoneCondition = async ({
  inputData,
  iterationCount,
}: {
  inputData: PipelineState;
  iterationCount: number;
}): Promise<boolean> => {
  // Страховка от вечного цикла, если шаг по какой-то причине не выставил stageDone.
  if (iterationCount > MAX_ROUNDS + 3) return true;
  return inputData.stageDone === true;
};

export const stack1ResultControl = createWorkflow({
  id: 'stack1-result-control',
  inputSchema: PipelineInput,
  outputSchema: FinalOutput,
})
  .then(initStep)
  .dountil(roundStep('smart'), stageDoneCondition)
  .then(startStageStep('user-story'))
  .dountil(roundStep('user-story'), stageDoneCondition)
  .then(startStageStep('job-story'))
  .dountil(roundStep('job-story'), stageDoneCondition)
  .then(startStageStep('acceptance-criteria'))
  .dountil(roundStep('acceptance-criteria'), stageDoneCondition)
  .then(compileStep)
  .then(translatorAskStep)
  .then(translateStep)
  .commit();
