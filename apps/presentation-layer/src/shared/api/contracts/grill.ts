import { z } from 'zod';
import { GRILL_NODES } from '@/entities/grill/model';

const nodeSchema = z.enum(GRILL_NODES.map(({ node }) => node) as [string, ...string[]]);
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
