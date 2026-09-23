import { Mastra } from '@mastra/core/mastra';

import { grillAgent } from './agents/grill-agent';
import { taskEvaluatorAgent } from './agents/task-evaluator-agent';
import { taskManagerAgent } from './agents/task-manager-agent';
import { translatorAgent } from './agents/translator-agent';
import { storage } from './storage';
import { stack1ResultControl } from './workflows/stack-1-result-control';

export const mastra = new Mastra({
  storage,
  agents: { grillAgent, translatorAgent, taskEvaluatorAgent, taskManagerAgent },
  workflows: { stack1ResultControl },
});
