import { z } from 'zod';

/** GET /api/ai-log?taskId= (AI-14, ADR-003 §8, ADR-008 §4: только роль business, свои задачи). */
export const aiLogQuerySchema = z.object({ taskId: z.string().min(1, 'Укажите задачу.') });
export type AiLogQuery = z.infer<typeof aiLogQuerySchema>;

export const aiLogEntrySchema = z.object({
  id: z.string(),
  taskId: z.string(),
  turnId: z.string().optional(),
  kind: z.enum(['analyze-text', 'phrase-question']),
  agent: z.string(),
  model: z.string(),
  prompt: z.string(),
  input: z.string(),
  rawOutput: z.string(),
  parseOk: z.boolean(),
  retryCount: z.number().int(),
  dropped: z.array(z.string()),
  latencyMs: z.number(),
  error: z.string().optional(),
  fallbackUsed: z.boolean(),
  fallbackReason: z.string().optional(),
  createdAt: z.string(),
});
export type ApiAiLogEntry = z.infer<typeof aiLogEntrySchema>;

export const aiLogResponseSchema = z.object({ entries: z.array(aiLogEntrySchema) });
export type AiLogResponse = z.infer<typeof aiLogResponseSchema>;
