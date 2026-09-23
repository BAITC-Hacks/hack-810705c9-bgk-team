import { createStep } from '@mastra/core/workflows';

import {
  ExitReport,
  MAX_ROUNDS,
  PipelineState,
  RoundReport,
  RoundResume,
  RoundSuspend,
  STAGE_ARTIFACT_SCHEMA,
  type StageId,
} from '../../schemas/pipeline';
import { buildExitPrompt, buildRoundPrompt } from './round-prompts';

/**
 * Раунд интервью для стадии: один вызов grill-агента (новые вопросы или попытка
 * коммита) + exit-гейт (второй вызов) при попытке коммита.
 * phase=questions → suspend с вопросами (resume с ответами пользователя);
 * exit fail → возврат в dountil-цикл с failingChecks (следующая итерация —
 * сразу follow-up раунд); exit pass → артефакт коммитится в state, stageDone.
 * На потолке MAX_ROUNDS цикл завершается с capReached-отчётом (честный gap, не потеря).
 */
export function roundStep(stage: StageId) {
  return createStep({
    id: `grill-round-${stage}`,
    inputSchema: PipelineState,
    outputSchema: PipelineState,
    resumeSchema: RoundResume,
    suspendSchema: RoundSuspend,
    execute: async ({ inputData, resumeData, suspend, mastra }) => {
      const state: PipelineState = { ...inputData, round: inputData.round + 1 };
      const atCap = state.round >= MAX_ROUNDS;
      const agent = mastra.getAgent('grillAgent');
      const memory = { thread: state.threadId, resource: state.resource };
      const committedArtifacts = Object.fromEntries(
        Object.entries(state.artifacts).filter(([, v]) => v != null),
      );

      const prompt = buildRoundPrompt({
        stage,
        seedIdea: state.seedIdea,
        language: state.language,
        round: state.round,
        committedArtifactsJson: JSON.stringify(committedArtifacts),
        answers: resumeData?.answers,
        failingChecks: state.failingChecks,
      });

      const roundRes = await agent.generate(prompt, {
        memory,
        structuredOutput: { schema: RoundReport },
      });
      const report = roundRes.object;
      state.draft = report.artifact ?? state.draft;

      // --- следующий раунд вопросов (только пока не упёрлись в потолок) ---
      const questions = report.questions ?? [];
      if (report.phase === 'questions' && questions.length > 0 && !atCap) {
        return await suspend({
          stage,
          round: state.round,
          language: state.language,
          questions,
        });
      }

      // --- попытка коммита: структурный контроль (zod) → семантический exit-гейт ---
      const artifact = report.phase === 'commit' ? report.artifact : state.draft;
      const parsed = STAGE_ARTIFACT_SCHEMA[stage].safeParse(artifact);

      if (!parsed.success) {
        const fail: ExitReport = {
          tests: [
            {
              id: 'structure',
              holds: false,
              evidence: `Artifact does not match the stage schema: ${parsed.error.issues
                .map(i => `${i.path.join('.')}: ${i.message}`)
                .join('; ')}`,
            },
          ],
          coverage: [],
          committed: false,
          statement: null,
        };
        if (atCap) {
          state.exitReports[stage] = { ...fail, capReached: true };
          state.capReached = true;
          state.stageDone = true;
          state.failingChecks = null;
          return state;
        }
        state.failingChecks = fail;
        return state; // dountil → следующая итерация → follow-up вопросы
      }

      const exitRes = await agent.generate(
        buildExitPrompt({ stage, language: state.language, artifactJson: JSON.stringify(parsed.data) }),
        { memory, structuredOutput: { schema: ExitReport } },
      );
      const exit: ExitReport = { ...exitRes.object };

      if (exit.committed) {
        state.artifacts[stage] = parsed.data;
        state.exitReports[stage] = { ...exit, committed: true, ...(atCap ? { capReached: true } : {}) };
        state.draft = undefined;
        state.failingChecks = null;
        state.stageDone = true;
        if (atCap) state.capReached = true;
        return state;
      }

      if (atCap) {
        // Потолок исчерпан: фиксируем честный не-коммит (gap виден в exitReports),
        // стадия завершается, пайплайн идёт дальше.
        state.exitReports[stage] = { ...exit, committed: false, capReached: true };
        state.capReached = true;
        state.stageDone = true;
        state.failingChecks = null;
        return state;
      }

      state.failingChecks = exit;
      return state; // → новый раунд: grill-агент получит failingChecks в промпте
    },
  });
}
