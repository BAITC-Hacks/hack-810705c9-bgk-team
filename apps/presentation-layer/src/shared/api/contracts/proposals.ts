import { z } from 'zod';

import { optionalUrlSchema, proposalStatusSchema, rejectReasonSchema } from './common';

/** FR-6.1/FR-6.2: идея, план, роли, срок обязательны; ссылка опциональна. */
export const submitProposalRequestSchema = z.object({
  teamId: z.string().min(1),
  solution: z.string().trim().min(1, 'Опишите идею решения.'),
  plan: z.string().trim().min(1, 'Опишите план.'),
  teamRoles: z.array(z.string()).min(1, 'Укажите роли в команде.'),
  deadline: z.string().min(1, 'Укажите срок.'),
  repoUrl: optionalUrlSchema,
  criteriaAnswers: z.array(
    z.object({ criterionId: z.string(), howWeWillCheck: z.string().min(1) }),
  ),
});
export type SubmitProposalRequest = z.infer<typeof submitProposalRequestSchema>;

export const proposalSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  teamId: z.string(),
  solution: z.string(),
  plan: z.string(),
  teamRoles: z.array(z.string()),
  deadline: z.string(),
  repoUrl: z.string().optional(),
  criteriaAnswers: z.array(
    z.object({ criterionId: z.string(), howWeWillCheck: z.string() }),
  ),
  fit: z.number().min(0).max(1),
  status: proposalStatusSchema,
  rejectReason: rejectReasonSchema.optional(),
  rejectNote: z.string().optional(),
  decidedAt: z.string().optional(),
  partialMatch: z.boolean(),
});
export type ApiProposal = z.infer<typeof proposalSchema>;

export const submitProposalResponseSchema = z.object({ proposal: proposalSchema });
export type SubmitProposalResponse = z.infer<typeof submitProposalResponseSchema>;

export const listProposalsResponseSchema = z.object({
  proposals: z.array(proposalSchema),
  comparison: z.array(
    z.object({
      criterionId: z.string(),
      metric: z.string(),
      byTeam: z.record(z.string(), z.string()),
    }),
  ),
});
export type ListProposalsResponse = z.infer<typeof listProposalsResponseSchema>;

/** FR-7.5: отклонение требует причину из enum, для 'other' обязателен текст. */
export const decisionRequestSchema = z
  .discriminatedUnion('action', [
    z.object({ action: z.literal('accept') }),
    z.object({ action: z.literal('hold') }),
    z.object({
      action: z.literal('reject'),
      reason: rejectReasonSchema,
      note: z.string().optional(),
    }),
  ])
  .refine((value) => value.action !== 'reject' || value.reason !== 'other' || !!value.note?.trim(), {
    message: 'Для причины «другое» нужно указать текст.',
    path: ['note'],
  });
export type DecisionRequest = z.infer<typeof decisionRequestSchema>;

export const decisionResponseSchema = z.object({ proposal: proposalSchema });
export type DecisionResponse = z.infer<typeof decisionResponseSchema>;

export const kickoffResponseSchema = z.object({
  proposalId: z.string(),
  materials: z.array(z.string()),
  stack: z.array(z.string()),
  consultations: z.string().optional(),
  deadline: z.string(),
  paymentOrPracticeNote: z.string(),
  firstStage: z.object({ criterionId: z.string(), metric: z.string(), howToCheck: z.string() }).nullable(),
});
export type KickoffResponse = z.infer<typeof kickoffResponseSchema>;
