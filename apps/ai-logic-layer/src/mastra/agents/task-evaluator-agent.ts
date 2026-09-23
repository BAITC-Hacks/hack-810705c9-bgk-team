import path from 'node:path';

import { Agent } from '@mastra/core/agent';

import { GRILL_GUIDANCE, GRILL_MODEL, SKILLS_DIR } from './grill-agent';

/** Qualitative review only. ADR-005 owns numeric score and its history in the BFF. */
export const taskEvaluatorAgent = new Agent({
  id: 'task-evaluator-agent',
  name: 'Task Clarification Reviewer',
  model: GRILL_MODEL,
  instructions: `${GRILL_GUIDANCE}
Review only the task snapshot supplied in this request using task-readiness-checklist.
Return raw JSON {"observations":[{"topic":"<topic>","evidence":"<exact quote>","note":"<concrete observation>"}],"missing":["<answerable question>"]}.
If no task was supplied, return {"error":"no_task","message":"<ask for the task text>"}.
Never output score, level, awarded points, breakdown weights, ranking, delta or recalculation.
You do not know which fields are confirmed and cannot write task data. No prior thread is remembered.
All evidence must be an exact quote of supplied text. Missing information is a question, never a guessed fact.`,
  skills: [path.join(SKILLS_DIR, 'task-readiness-checklist')],
});
