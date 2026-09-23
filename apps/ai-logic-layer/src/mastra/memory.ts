import { Memory } from '@mastra/memory';

/** Historical prototype only; no registered Task Match agent imports memory.
 * Conversation, fields and lifecycle are stored by the BFF in nextjs_db.
 */
export const sessionMemory = new Memory({
  options: {
    lastMessages: 60,
    semanticRecall: false,
    workingMemory: { enabled: false },
  },
});
