import { Memory } from '@mastra/memory';

/**
 * Общий memory-инстанс для grill- и translator-агентов.
 * Один thread на воркфлоу-run (threadId = runId) → полная история диалога
 * доступна обоим агентам (thread-scoped sharing, прямые вызовы с одинаковыми id).
 * Storage — общий PostgresStore (DATABASE_URL_MASTRA).
 */
export const sessionMemory = new Memory({
  options: {
    lastMessages: 60,
    semanticRecall: false,
    workingMemory: { enabled: false },
  },
});
