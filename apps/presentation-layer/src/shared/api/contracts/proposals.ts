import { z } from "zod";

// ADR-007 / ADR-009: общие схемы откликов, решений и этапов.

import { optionalUrlSchema, rejectReasonSchema } from "./common";

export const proposalInput = z.object({
  solution: z.string().trim().min(1, "Опишите идею решения"),
  plan: z.string().trim().min(1, "Опишите план"),
  teamRoles: z.array(z.string().trim().min(1)).min(1, "Укажите роли в команде"),
  deadline: z.string().trim().min(1, "Укажите срок"),
  repoUrl: optionalUrlSchema,
  // criterion.id → «как проверим»; ключи сверяются с критериями задачи в use-case.
  criteriaAnswers: z.record(z.string(), z.string().trim().min(1, "Заполните «как проверим»")),
});
export type ProposalInput = z.infer<typeof proposalInput>;

export const USER_REJECT_REASONS = rejectReasonSchema.options;

export const decisionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("on_hold") }),
  z.object({ action: z.literal("submitted") }),
  z
    .object({
      action: z.literal("reject"),
      reason: rejectReasonSchema,
      note: z.string().trim().optional(),
    })
    .refine((v) => v.reason !== "other" || (v.note?.length ?? 0) > 0, {
      message: "Для причины «другое» нужен текст",
      path: ["note"],
    }),
]);
export type DecisionInput = z.infer<typeof decisionInput>;


export { claimStageRequestSchema as stageClaimInput, returnStageRequestSchema as stageReturnInput, confirmStageRequestSchema as stageConfirmInput } from './stages';
import { stageSchema } from './stages';
import { dateTimeSchema, proposalStatusSchema, storedRejectReasonSchema } from './common';
export const submitProposalRequestSchema = proposalInput;
export type SubmitProposalRequest = ProposalInput;
export const decisionRequestSchema = decisionInput;
export type DecisionRequest = DecisionInput;
export const criteriaAnswersSnapshotSchema = z.object({ criteriaVersion:z.number().int(), answers:z.record(z.string(),z.string()) });
export const kickoffSchema = z.object({
  items:z.array(z.object({key:z.string(),label:z.string(),value:z.string()})),
  firstStage:z.object({criterionId:z.string(),metric:z.string(),threshold:z.string()}).nullable(),
  contact:z.string().nullable(), builtAt:dateTimeSchema,
});
export const proposalSchema = z.object({
  id:z.string(),taskId:z.string(),teamId:z.string(),solution:z.string(),plan:z.string(),teamRoles:z.array(z.string()),deadline:z.string(),
  repoUrl:z.string().nullable(),criteriaAnswers:criteriaAnswersSnapshotSchema,fit:z.number().min(0).max(1),status:proposalStatusSchema,
  rejectReason:storedRejectReasonSchema.nullable(),rejectNote:z.string().nullable(),decidedAt:dateTimeSchema.nullable(),
  acceptedAt:dateTimeSchema.nullable(),kickoff:kickoffSchema.nullable(),createdAt:dateTimeSchema,updatedAt:dateTimeSchema,
});
export type ApiProposal=z.infer<typeof proposalSchema>;
export const submitProposalResponseSchema=proposalSchema;
export type SubmitProposalResponse=ApiProposal;
export const decisionResponseSchema=z.object({proposal:proposalSchema,stages:z.array(stageSchema).optional()});
export type DecisionResponse=z.infer<typeof decisionResponseSchema>;
const comparisonCriterionSchema=z.object({id:z.string(),metric:z.string(),threshold:z.string()});
export const listProposalsResponseSchema=z.object({
  items:z.array(proposalSchema.pick({id:true,teamId:true,fit:true,createdAt:true,status:true,criteriaAnswers:true}).extend({teamName:z.string(),partialMatch:z.boolean(),versionMismatch:z.boolean()})),
  matrix:z.object({criteria:z.array(comparisonCriterionSchema),rows:z.array(z.object({criterionId:z.string(),cells:z.array(z.object({proposalId:z.string(),answer:z.string().nullable(),versionMismatch:z.boolean()}))}))}),
});
export type ListProposalsResponse=z.infer<typeof listProposalsResponseSchema>;
export const kickoffResponseSchema=z.object({kickoff:kickoffSchema.nullable(),stages:z.array(stageSchema),taskTitle:z.string(),teamName:z.string()});
export type KickoffResponse=z.infer<typeof kickoffResponseSchema>;

export const listTaskProposalsResponseSchema=listProposalsResponseSchema;
