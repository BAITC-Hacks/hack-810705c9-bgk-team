import type { StageId } from '../../schemas/pipeline';

/** Какой скилл активировать на стадии (имя = файл в apps/ai-logic-layer/skills). */
export const STAGE_SKILL: Record<StageId, string> = {
  smart: 'grill-me-smart',
  'user-story': 'grill-me-user-story',
  'job-story': 'grill-me-job-story',
  'acceptance-criteria': 'grill-me-acceptance-criteria',
};

/** Точная форма артефакта для structured output (структурный контроль — zod в шаге). */
export const STAGE_ARTIFACT_SHAPE: Record<StageId, string> = {
  smart:
    '{ statement, specific, measurable: { baseline, target }, achievable, relevant, timeBound: { deadline, checkpoint } }',
  'user-story': '{ statement, role, action, value }',
  'job-story':
    '{ statement, situation, motivation, outcome, forces: { push, pull, anxiety, habit } }',
  'acceptance-criteria':
    "array of { id, given, when, then, cut: 'happy'|'boundary'|'error'|'rule'|'non-functional' }, min 1",
};

/**
 * Exit-рубрики стадий — калиброванный пересказ раздела «The exit» соответствующего
 * grill-me-скилла (тесты + coverage map); по ним агент строит ExitReport.
 */
export const EXIT_RUBRICS: Record<StageId, string> = {
  smart: `Tests (all must hold, each with evidence):
- specific: what exactly becomes true, for whom, instead of what — no soft verbs ("improve", "explore")
- measurable: concrete baseline AND target (a target without a baseline is a wish)
- achievable: doable with actual time/people/money; names the smallest real version and what is NOT done
- relevant: names what it is for and what saying no to
- time-bound: a real date + a checkpoint before it ("soon"/"Q3" are not answers)
Coverage: the same five cuts — each 'covered' or explicitly 'not-applicable' with a note.
statement: the goal in ONE breath.`,
  'user-story': `Tests:
- role-test: swapping the role would make the story FALSE (not merely vague)
- role-not-category: role is a person with a stake, not "user"/"admin"/"customer"
- no-solution-smuggling: "I want" states the want, not the feature/button
- value-not-loop: "so that" does not restate "I want" (a loop, not a value)
Coverage (INVEST): valuable, independent, small, testable, estimable, negotiable — each 'covered' or explicitly 'not-applicable' with a note.
statement: the story as "As a …, I want …, so that …".`,
  'job-story': `Tests:
- swap-test: replacing the When clause with a role name makes the story FALSE
- situation-not-persona: When names a moment/trigger in the world, not a demographic
- motivation-not-solution: "I want to" is progress, not a feature
- outcome-not-loop: "so I can" does not restate "I want to"
Coverage (four forces): push, pull, anxiety, habit — each answered (or explicit 'not-applicable' with a note).
statement: the job as "When …, I want to …, so I can …".`,
  'acceptance-criteria': `Tests:
- gwt-structure: every criterion is Given-When-Then; Given is world state (not an action), When has ONE trigger (no "and")
- falsification: for every Then you can name the observation that would prove it false
- no-implementation-criteria: each Then describes what a stranger outside the codebase can observe, not internals
Coverage: happy, boundary, error, rule, non-functional — each 'covered' or explicitly 'not-applicable' with a note.
statement: a one-line summary of the definition of done.`,
};
