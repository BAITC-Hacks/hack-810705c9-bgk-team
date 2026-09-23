import { createStep } from '@mastra/core/workflows';

import {
  CompileNotes,
  PipelineState,
  STAGE_ARTIFACT_SCHEMA,
  ToTranslate,
  type Artifacts,
  type ExitReport,
} from '../../schemas/pipeline';

function safePick(
  schema: { safeParse(v: unknown): { success: boolean; data?: unknown } },
  v: unknown,
): unknown {
  if (v === null || v === undefined) return null;
  const r = schema.safeParse(v);
  return r.success ? r.data : null;
}

/**
 * Финальная сборка пакета «Результат и Контроль».
 * Артефакты + exit-отчёты детерминированно из state; summary/disagreements —
 * grill-агент в том же thread, с мягким fallback (сбой LLM не роняет пайплайн).
 */
export const compileStep = createStep({
  id: 'compile',
  inputSchema: PipelineState,
  outputSchema: ToTranslate,
  execute: async ({ inputData, mastra }) => {
    const state = inputData;
    const artifacts: Artifacts = {
      smart: safePick(STAGE_ARTIFACT_SCHEMA.smart, state.artifacts.smart) as Artifacts['smart'],
      userStory: safePick(STAGE_ARTIFACT_SCHEMA['user-story'], state.artifacts['user-story']) as Artifacts['userStory'],
      jobStory: safePick(STAGE_ARTIFACT_SCHEMA['job-story'], state.artifacts['job-story']) as Artifacts['jobStory'],
      criteria: safePick(STAGE_ARTIFACT_SCHEMA['acceptance-criteria'], state.artifacts['acceptance-criteria']) as Artifacts['criteria'],
    };

    const deterministicSummary = [
      artifacts.smart?.statement,
      artifacts.userStory?.statement,
      artifacts.jobStory?.statement,
      artifacts.criteria ? `Acceptance criteria: ${artifacts.criteria.length} scenarios` : null,
    ]
      .filter(Boolean)
      .join('\n');

    let summary = deterministicSummary;
    let disagreements: string[] = [];
    try {
      const agent = mastra.getAgent('grillAgent');
      const res = await agent.generate(
        `Dialogue language: ${state.language}.\n` +
          `The pipeline finished. Committed artifacts:\n${JSON.stringify({
            smart: artifacts.smart,
            userStory: artifacts.userStory,
            jobStory: artifacts.jobStory,
            criteria: artifacts.criteria,
          })}\n` +
          `Exit reports:\n${JSON.stringify(state.exitReports)}\n\n` +
          `In the dialogue language write: (1) a 3-6 sentence summary of the final task version; ` +
          `(2) disagreements between the User Story and the Job Story — one short sentence each; ` +
          `if they agree, return an empty list.`,
        {
          memory: { thread: state.threadId, resource: state.resource },
          structuredOutput: { schema: CompileNotes },
        },
      );
      const notes = res.object;
      summary = notes.summary?.trim() || deterministicSummary;
      disagreements = Array.isArray(notes.disagreements) ? notes.disagreements : [];
    } catch (err) {
      console.warn('[compile] agent notes failed, using deterministic summary:', err);
    }

    return {
      seedIdea: state.seedIdea,
      language: state.language,
      threadId: state.threadId,
      resource: state.resource,
      package: {
        seedIdea: state.seedIdea,
        language: state.language,
        artifacts,
        exitReports: state.exitReports as Partial<Record<string, ExitReport>>,
        summary,
        disagreements,
      },
    };
  },
});
