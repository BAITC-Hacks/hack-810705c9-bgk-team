import type { AiPort } from './ai-port';
import { mastraAiPort } from './mastra-ai-port';

export * from './ai-port';

/**
 * ADR-003 §6: `AI_ENABLED` читает BFF. При `false` Mastra не вызывается
 * вообще (NFR-5, T-15 не зависят от `ai-logic-layer`).
 */
export function getAiPort(): AiPort | null {
  if (process.env.AI_ENABLED === 'false') return null;
  return mastraAiPort;
}
