import { Memory } from '@mastra/memory';

/**
 * Общий memory-инстанс агентов Mastra (grill, translator, task-evaluator).
 * В воркфлоу один thread на run (threadId = runId) → grill и translator читают
 * одну историю (thread-scoped sharing, прямые вызовы с одинаковыми id).
 * Оценщик живёт в отдельных чат-тредах: история отчётов нужна ему для
 * пересчёта рейтинга после редактирования задачи.
 * Storage — общий PostgresStore (DATABASE_URL_MASTRA).
 */
export const sessionMemory = new Memory({
  options: {
    lastMessages: 60,
    semanticRecall: false,
    workingMemory: { enabled: false },
  },
});
