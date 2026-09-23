import { z } from 'zod';

import { fieldSchema } from './common';

/**
 * ADR-009 §6: PATCH /fields/:node принимает либо { action: 'confirm' }
 * (подтверждение поля, исправленного в редакторе, без повторной прожарки),
 * либо правку значения (FR-2.3: переводит поле в suggested до подтверждения).
 */
const confirmFieldRequestSchema = z.object({ action: z.literal('confirm') });

const editFieldRequestSchema = z.object({
  action: z.literal('edit').optional(),
  value: z.string().trim().min(1, 'Значение поля не может быть пустым.'),
  notApplicable: z.boolean().optional(),
  naNote: z.string().optional(),
});

export const patchFieldRequestSchema = z.union([
  confirmFieldRequestSchema,
  editFieldRequestSchema,
]);
export type PatchFieldRequest = z.infer<typeof patchFieldRequestSchema>;

export const patchFieldParamsSchema = z.object({
  id: z.string().min(1),
  node: z.string().min(1),
});

export const patchFieldResponseSchema = z.object({
  field: fieldSchema,
  scoreDelta: z.number(),
});
export type PatchFieldResponse = z.infer<typeof patchFieldResponseSchema>;
