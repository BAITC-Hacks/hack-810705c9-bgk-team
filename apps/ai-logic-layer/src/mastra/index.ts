import { Mastra } from '@mastra/core/mastra';

import { grillAgent } from './agents/grill-agent';
import { taskEvaluatorAgent } from './agents/task-evaluator-agent';
import { translatorAgent } from './agents/translator-agent';
import { storage } from './storage';
import { analyzeTextWorkflow, phraseQuestionWorkflow, classifier, extractor, griller } from './workflows/inference';

export const mastra = new Mastra({
  storage,
  agents: { grillAgent, translatorAgent, taskEvaluatorAgent, classifier, 'card-extractor': extractor, griller },
  // Keys are the public client IDs used by getWorkflow(), not the variable names.
  workflows: { 'analyze-text': analyzeTextWorkflow, 'phrase-question': phraseQuestionWorkflow },
});
