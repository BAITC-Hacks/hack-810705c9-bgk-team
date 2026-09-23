import { z } from 'zod';

import { blockIdSchema, swipeActionSchema } from './common';

/** FR-5.6: свайп ← (skip) или ↑ (missing, с блоком/пометкой). */
export const createSwipeRequestSchema = z
  .object({
    teamId: z.string().min(1),
    taskId: z.string().min(1),
    action: swipeActionSchema,
    block: blockIdSchema.optional(),
    note: z.string().optional(),
  })
  .refine((value) => value.action !== 'missing' || value.block !== undefined, {
    message: 'Для «не хватает сведений» нужно указать блок карточки.',
    path: ['block'],
  });
export type CreateSwipeRequest = z.infer<typeof createSwipeRequestSchema>;

export const createSwipeResponseSchema = z.object({
  teamId: z.string(),
  taskId: z.string(),
  action: swipeActionSchema,
});
export type CreateSwipeResponse = z.infer<typeof createSwipeResponseSchema>;
