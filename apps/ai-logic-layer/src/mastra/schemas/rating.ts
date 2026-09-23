import { z } from 'zod';

/** Qualitative inference only. Numeric ratings live in the ADR-005 BFF domain. */
export const TaskClarificationReport = z.object({
  observations: z.array(z.object({
    topic: z.string(),
    evidence: z.string(),
    note: z.string(),
  })),
  missing: z.array(z.string()),
});
export type TaskClarificationReport = z.infer<typeof TaskClarificationReport>;

export const TaskClarificationNoTask = z.object({
  error: z.literal('no_task'),
  message: z.string(),
});
