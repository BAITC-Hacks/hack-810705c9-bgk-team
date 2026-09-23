import { z } from 'zod';
import { nodeIdSchema, blockIdSchema, dateTimeSchema } from './common';

const nodeSchema = nodeIdSchema;
const fieldSchema = z.object({
  value: z.unknown(),
  state: z.enum(['suggested', 'confirmed']).optional(),
  notApplicable: z.boolean().optional(),
  sourceQuote: z.string().optional(),
});

export const grillClassificationSchema = z.object({
  specificity: z.enum(['specific', 'vague']),
  coveredNodes: z.array(nodeSchema),
  fields: z.partialRecord(nodeSchema, fieldSchema).default({}),
  notApplicable: z.array(z.object({ node: nodeSchema, note: z.string() })).optional(),
  dataUnavailable: z.boolean().optional(),
  resultType: z.enum(['bot', 'model', 'mockup', 'report', 'other']).optional(),
});

export const createGrillSchema = z.object({
  draftText: z.string().trim().min(20).max(2000),
  draftFields: z.partialRecord(nodeSchema, fieldSchema).optional(),
});

export const submitGrillTurnSchema = z.object({
  answer: z.string().trim().min(1).max(4000),
  sessionVersion: z.number().int().nonnegative(),
  classification: grillClassificationSchema.optional(),
});

export const grillCheckpointSchema = z.object({
  block: z.enum(['draft', 'context', 'result', 'criteria', 'data', 'constraints', 'users', 'link']),
  action: z.enum(['confirm', 'edit']),
  sessionVersion: z.number().int().nonnegative(),
});

export const editGrillFieldSchema = z.object({
  action: z.enum(['edit', 'confirm']),
  value: z.unknown().optional(),
  sessionVersion: z.number().int().nonnegative(),
});

export type CreateGrillInput = z.infer<typeof createGrillSchema>;
export type SubmitGrillTurnInput = z.infer<typeof submitGrillTurnSchema>;
export type GrillCheckpointInput = z.infer<typeof grillCheckpointSchema>;
export type EditGrillFieldInput = z.infer<typeof editGrillFieldSchema>;

// Public callers cannot inject trusted inference classification or source quotes.
export const grillTurnRequestSchema = submitGrillTurnSchema.omit({ classification: true });
export type GrillTurnRequest = z.infer<typeof grillTurnRequestSchema>;
export const grillCheckpointRequestSchema = grillCheckpointSchema;
export type GrillCheckpointRequest = GrillCheckpointInput;
export const grillQuestionNodeSchema = z.union([nodeIdSchema, z.literal('data.collection'), z.literal('result.profile')]);
export const grillNextSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('question'), node: grillQuestionNodeSchema, question: z.string(), options: z.array(z.string()), isPushback: z.boolean() }),
  z.object({ kind: z.literal('checkpoint'), block: z.union([blockIdSchema, z.literal('draft')]) }),
  z.object({ kind: z.literal('done') }),
]);
export type GrillNext = z.infer<typeof grillNextSchema>;
export const grillFieldsSchema = z.partialRecord(nodeSchema, fieldSchema.extend({ state: z.enum(['suggested', 'confirmed']) }));
export const grillSessionSchema = z.object({
  status: z.enum(['active','finished']), currentNode: grillQuestionNodeSchema.nullable(),
  currentBlock: z.union([blockIdSchema,z.literal('draft')]).nullable(),
  pushbacks: z.record(z.string(),z.union([z.literal(0),z.literal(1)])),
  questionsAsked: z.number().int().nonnegative(), version: z.number().int().nonnegative(),
  askedNodes: z.array(grillQuestionNodeSchema), skippedNodes: z.array(nodeSchema),
});
export const grillTurnSchema = z.object({
  id: z.number().int(), sessionId: z.number().int(), seq: z.number().int(), node: grillQuestionNodeSchema,
  question: z.string(), options: z.array(z.string()), isPushback: z.boolean(), answer: z.string().nullable(),
  coveredNodes: z.array(z.string()), specificity: z.string().nullable(), fallbackUsed: z.boolean(), createdAt: dateTimeSchema,
});
export const grillStateSchema = z.object({ session: grillSessionSchema, fields: grillFieldsSchema, turns: z.array(grillTurnSchema), next: grillNextSchema.nullable() });
export const grillCheckpointResponseSchema = grillStateSchema.passthrough();
export type GrillCheckpointResponse = z.infer<typeof grillCheckpointResponseSchema>;
// Complete task mutation envelopes are exported from tasks.ts (no schema cycle).
export const grillTurnResponseSchema = grillStateSchema.extend({ fallbackUsed: z.boolean(), sessionVersion: z.number().int() }).passthrough();
export type GrillTurnResponse = z.infer<typeof grillTurnResponseSchema>;
