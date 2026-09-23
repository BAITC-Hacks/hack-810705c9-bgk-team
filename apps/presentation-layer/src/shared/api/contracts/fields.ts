import { z } from 'zod';
import { idParamSchema, nodeIdSchema } from './common';
import { editGrillFieldSchema } from './grill';
import { taskMutationResponseSchema } from './tasks';
// Structured criteria.items is an array; ordinary fields are strings. Domain
// validation decides which values are meaningful for the selected node.
export const patchFieldRequestSchema=editGrillFieldSchema;
export type PatchFieldRequest=z.infer<typeof patchFieldRequestSchema>;
export const patchFieldParamsSchema=idParamSchema.extend({node:nodeIdSchema});
export const patchFieldResponseSchema=taskMutationResponseSchema;
export const updateFieldResponseSchema=patchFieldResponseSchema;
export type PatchFieldResponse=z.infer<typeof patchFieldResponseSchema>;
