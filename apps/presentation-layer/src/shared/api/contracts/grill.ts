import { z } from 'zod';

import { blockIdSchema, fieldSchema, nodeIdSchema } from './common';

/** ADR-009 §6: POST /grill/turn принимает { answer, sessionVersion }. */
export const grillTurnRequestSchema = z.object({
  answer: z.string().trim().min(1, 'Ответ не может быть пустым.'),
  sessionVersion: z.number().int().min(0),
});
export type GrillTurnRequest = z.infer<typeof grillTurnRequestSchema>;

const nextQuestionSchema = z.object({
  kind: z.literal('question'),
  node: nodeIdSchema,
  question: z.string(),
  options: z.array(z.string()),
  isPushback: z.boolean(),
});

const nextCheckpointSchema = z.object({
  kind: z.literal('checkpoint'),
  block: blockIdSchema,
  summary: z.array(z.object({ node: nodeIdSchema, quote: z.string() })),
});

const nextDoneSchema = z.object({ kind: z.literal('done') });

/** ADR-009 §6: { next: question|checkpoint|done, scoreDelta?, fallbackUsed }. */
export const grillNextSchema = z.discriminatedUnion('kind', [
  nextQuestionSchema,
  nextCheckpointSchema,
  nextDoneSchema,
]);
export type GrillNext = z.infer<typeof grillNextSchema>;

export const grillTurnResponseSchema = z.object({
  next: grillNextSchema,
  scoreDelta: z.number().optional(),
  fallbackUsed: z.boolean(),
  sessionVersion: z.number().int(),
});
export type GrillTurnResponse = z.infer<typeof grillTurnResponseSchema>;

/** ADR-004 §4: POST /grill/checkpoint { block, action: confirm|edit }. */
export const grillCheckpointRequestSchema = z.object({
  block: blockIdSchema,
  action: z.enum(['confirm', 'edit']),
});
export type GrillCheckpointRequest = z.infer<typeof grillCheckpointRequestSchema>;

export const grillCheckpointResponseSchema = z.object({
  block: blockIdSchema,
  fields: z.array(fieldSchema),
  scoreDelta: z.number(),
});
export type GrillCheckpointResponse = z.infer<typeof grillCheckpointResponseSchema>;
