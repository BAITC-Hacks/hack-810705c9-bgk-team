import type { ExitReport, RoundResume, StageId } from '../../schemas/pipeline';
import { EXIT_RUBRICS, STAGE_ARTIFACT_SHAPE, STAGE_SKILL } from './exit-rubrics';

export function formatAnswers(answers: NonNullable<RoundResume['answers']>): string {
  return answers
    .map(a => `- id=${a.questionId} kind=${a.kind} value=${a.value}`)
    .join('\n');
}

export function formatFailingChecks(f: ExitReport): string {
  return JSON.stringify({ committed: f.committed, tests: f.tests, coverage: f.coverage }, null, 2);
}

export function buildRoundPrompt(opts: {
  stage: StageId;
  seedIdea: string;
  language: string;
  round: number;
  committedArtifactsJson: string;
  answers?: RoundResume['answers'];
  failingChecks?: ExitReport | null;
}): string {
  const skill = STAGE_SKILL[opts.stage];
  const parts: string[] = [];

  parts.push(
    `STAGE: ${opts.stage} | SKILL TO USE NOW: ${skill} | DIALOGUE LANGUAGE: ${opts.language} | round ${opts.round}.`,
  );
  parts.push(
    `Artifact shape for this stage: ${STAGE_ARTIFACT_SHAPE[opts.stage]} (all text in the dialogue language).`,
  );
  parts.push(`Original task description (seed idea): ${opts.seedIdea}`);
  if (opts.committedArtifactsJson !== '{}') {
    parts.push(
      `Committed artifacts from earlier stages (carry their context forward):\n${opts.committedArtifactsJson}`,
    );
  }

  if (opts.failingChecks) {
    parts.push(
      `EXIT CHECK FAILED for this stage — the artifact was NOT committed. Failing report:\n` +
        `${formatFailingChecks(opts.failingChecks)}\n` +
        `Ask the minimal follow-up questions that would fix the failing tests/coverage cuts ` +
        `(whole frontier, interleaved), then draft again. ` +
        `Respond phase="questions" with stable ids and the improved draft artifact.`,
    );
  } else if (opts.answers && opts.answers.length > 0) {
    parts.push(`User answers to the previous round:\n${formatAnswers(opts.answers)}`);
    parts.push(
      `Continue the interview: if anything in the frontier is still silently assumed → ` +
        `phase="questions" with the whole current frontier (5-9 questions, interleaved across lenses/clauses). ` +
        `If the frontier is empty AND ${skill}'s exit conditions hold → ` +
        `phase="commit" with the artifact in the required shape, frontierEmpty=true, questions=[].`,
    );
  } else {
    parts.push(
      `First round of this stage: open the whole frontier of ${skill} ` +
        `(every question whose prerequisites are settled), 5-9 questions with stable ids, ` +
        `interleaved — never one-lens-per-round. Set phase="questions"; draft artifact may be null.`,
    );
  }

  parts.push(
    `Rules: push back on soft answers; "dont-know" is a real answer; "measured" answers are ` +
      `ground truth; grilling shrinks the idea. Everything you write in ${opts.language}.`,
  );

  return parts.join('\n\n');
}

export function buildExitPrompt(opts: {
  stage: StageId;
  language: string;
  artifactJson: string;
}): string {
  return [
    `EXIT GATE for stage ${opts.stage} (skill ${STAGE_SKILL[opts.stage]}), dialogue language: ${opts.language}.`,
    `Artifact to evaluate:\n${opts.artifactJson}`,
    EXIT_RUBRICS[opts.stage],
    `Set committed=true ONLY if every required test holds and coverage is complete. ` +
      `evidence must quote or concretely point at the part of the artifact that proves each test. ` +
      `All free text in ${opts.language}.`,
  ].join('\n\n');
}
