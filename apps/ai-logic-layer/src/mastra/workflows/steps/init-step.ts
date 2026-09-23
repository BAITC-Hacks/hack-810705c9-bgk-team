import { createStep } from '@mastra/core/workflows';

import { PipelineInput, PipelineState, type StageId } from '../../schemas/pipeline';

/**
 * Начало воркфлоу: seedIdea + язык диалога → состояние пайплайна.
 * threadId = runId воркфлоу — один memory-thread на весь run
 * (контекст стадий и агентов хранится там и в workflow state).
 */
export const initStep = createStep({
  id: 'init',
  inputSchema: PipelineInput,
  outputSchema: PipelineState,
  execute: async ({ inputData, runId }): Promise<PipelineState> => ({
    seedIdea: inputData.seedIdea,
    language: inputData.language,
    threadId: runId,
    resource: 'stack1-result-control',
    stage: 'smart',
    round: 0,
    stageDone: false,
    capReached: false,
    draft: undefined,
    artifacts: {},
    exitReports: {},
    failingChecks: null,
  }),
});

/** Переход к следующей стадии: сбрасывает счётчики, сохраняет артефакты/отчёты. */
export function startStageStep(stage: StageId) {
  return createStep({
    id: `start-stage-${stage}`,
    inputSchema: PipelineState,
    outputSchema: PipelineState,
    execute: async ({ inputData }) => ({
      ...inputData,
      stage,
      round: 0,
      stageDone: false,
      draft: undefined,
      failingChecks: null,
    }),
  });
}
