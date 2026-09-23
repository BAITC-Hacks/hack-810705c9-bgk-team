import { Mastra } from '@mastra/core/mastra';

import { grillAgent } from './agents/grill-agent';
import { translatorAgent } from './agents/translator-agent';
import { storage } from './storage';
import { stack1ResultControl } from './workflows/stack-1-result-control';

export const mastra = new Mastra({
  storage,
  agents: { grillAgent, translatorAgent },
  workflows: { stack1ResultControl },
});
