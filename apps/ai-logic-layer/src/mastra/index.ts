import { Mastra } from '@mastra/core/mastra';

import { storage } from './storage';
import { analyzeTextWorkflow, phraseQuestionWorkflow } from './workflows/inference';

export const mastra = new Mastra({
  storage,
  workflows: { analyzeTextWorkflow, phraseQuestionWorkflow },
});
