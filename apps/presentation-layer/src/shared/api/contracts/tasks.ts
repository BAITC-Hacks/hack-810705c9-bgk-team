import { z } from 'zod';

import { taskSchema, workFormatSchema } from './common';

/** FR-1.1: свободный текст 20–2000 символов. */
export const createTaskRequestSchema = z
  .object({
    draftText: z
      .string()
      .trim()
      .min(20, 'Черновик должен быть не короче 20 символов.')
      .max(2000, 'Черновик должен быть не длиннее 2000 символов.'),
    topic: z.string().min(1, 'Выберите тему из справочника.'),
    format: workFormatSchema,
    paymentTerms: z.string().optional(),
  })
  .refine((value) => value.format === 'practice' || (value.paymentTerms ?? '').trim().length > 0, {
    message: 'Для подработки нужно указать условия оплаты.',
    path: ['paymentTerms'],
  });
export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;

/** ADR-009 §6: сначала checkpoint черновика, а не первый вопрос прожарки. */
export const createTaskResponseSchema = z.object({
  task: taskSchema,
  draftSummary: z.object({
    block: z.literal('draft'),
    quotes: z.array(z.object({ node: z.string(), quote: z.string() })),
  }),
  fallbackUsed: z.boolean(),
});
export type CreateTaskResponse = z.infer<typeof createTaskResponseSchema>;

/** PATCH /api/tasks/:id — FR-1.1/FR-2.7/T-7: формат, оплата, теги. */
export const updateTaskRequestSchema = z.object({
  format: workFormatSchema.optional(),
  paymentTerms: z.string().optional(),
  neededRoles: z.array(z.string()).optional(),
  neededSkills: z.array(z.string()).optional(),
});
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;

export const updateTaskResponseSchema = z.object({ task: taskSchema });
export type UpdateTaskResponse = z.infer<typeof updateTaskResponseSchema>;

export const scoreBreakdownItemSchema = z.object({
  node: z.string(),
  label: z.string(),
  earned: z.number(),
  max: z.number(),
  reason: z.string(),
});

export const getScoreResponseSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: z.string(),
  breakdown: z.array(scoreBreakdownItemSchema),
  missing: z.array(z.object({ node: z.string(), weight: z.number() })),
  nextStep: z
    .object({ node: z.string(), weight: z.number(), consequence: z.string() })
    .nullable(),
});
export type GetScoreResponse = z.infer<typeof getScoreResponseSchema>;

export const publishTaskResponseSchema = z.object({ task: taskSchema });
export type PublishTaskResponse = z.infer<typeof publishTaskResponseSchema>;

export const closeTaskResponseSchema = z.object({ task: taskSchema });
export type CloseTaskResponse = z.infer<typeof closeTaskResponseSchema>;
