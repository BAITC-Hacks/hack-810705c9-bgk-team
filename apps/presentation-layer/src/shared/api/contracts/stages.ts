import { z } from 'zod';
import { dateTimeSchema, idParamSchema, stageStatusSchema, httpUrlSchema } from './common';
export const claimStageRequestSchema = z.object({ reportUrl: httpUrlSchema, comment: z.string().trim().min(1, 'Добавьте комментарий') });
export const returnStageRequestSchema = z.object({ comment: z.string().trim().min(1, 'Комментарий обязателен при возврате') });
export const confirmStageRequestSchema = z.object({ comment: z.string().trim().optional() });
export type ClaimStageRequest = z.infer<typeof claimStageRequestSchema>;
export type ReturnStageRequest = z.infer<typeof returnStageRequestSchema>;
export type ConfirmStageRequest = z.infer<typeof confirmStageRequestSchema>;
export const stageSchema = z.object({
  id: z.string(), proposalId: z.string(), criterionId: z.string(), criteriaVersion: z.number().int(), position: z.number().int(),
  metric: z.string(), threshold: z.string(), howToCheck: z.string(), status: stageStatusSchema,
  reportUrl: z.string().nullable(), teamComment: z.string().nullable(), businessComment: z.string().nullable(),
  points: z.number().int(), claimedAt: dateTimeSchema.nullable(), confirmedAt: dateTimeSchema.nullable(),
});
export type ApiStage = z.infer<typeof stageSchema>;
// Canonical stage mutations return the row, without a second wrapper.
export const stageResponseSchema = stageSchema;
export type StageResponse = ApiStage;
export const stageParamsSchema = idParamSchema;
