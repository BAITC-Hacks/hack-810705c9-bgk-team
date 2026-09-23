import { z } from 'zod';

import { stageStatusSchema } from './common';

/** FR-8.2: команда сдаёт этап — ссылка и комментарий. */
export const claimStageRequestSchema = z.object({
  reportUrl: z.string().trim().url({ message: 'Укажите корректную ссылку на результат.' }),
  teamComment: z.string().optional(),
});
export type ClaimStageRequest = z.infer<typeof claimStageRequestSchema>;

/** FR-8.3: бизнес возвращает этап с обязательным комментарием. */
export const returnStageRequestSchema = z.object({
  businessComment: z.string().trim().min(1, 'Комментарий обязателен при возврате этапа.'),
});
export type ReturnStageRequest = z.infer<typeof returnStageRequestSchema>;

export const confirmStageRequestSchema = z.object({
  businessComment: z.string().optional(),
});
export type ConfirmStageRequest = z.infer<typeof confirmStageRequestSchema>;

export const stageSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  criterionId: z.string(),
  metric: z.string(),
  threshold: z.string(),
  howToCheck: z.string(),
  status: stageStatusSchema,
  reportUrl: z.string().optional(),
  teamComment: z.string().optional(),
  businessComment: z.string().optional(),
  points: z.number(),
  confirmedAt: z.string().optional(),
});
export type ApiStage = z.infer<typeof stageSchema>;

export const stageResponseSchema = z.object({ stage: stageSchema });
export type StageResponse = z.infer<typeof stageResponseSchema>;

export const stageParamsSchema = z.object({ id: z.string().min(1) });
