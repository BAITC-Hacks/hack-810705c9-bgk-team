import { z } from "zod";

// ADR-007 / ADR-009: общие схемы откликов, решений и этапов.

const url = z.url({ protocol: /^https?$/, message: "Нужна ссылка http(s)" });

export const proposalInput = z.object({
  solution: z.string().trim().min(1, "Опишите идею решения"),
  plan: z.string().trim().min(1, "Опишите план"),
  teamRoles: z.array(z.string().trim().min(1)).min(1, "Укажите роли в команде"),
  deadline: z.string().trim().min(1, "Укажите срок"),
  repoUrl: url.optional().or(z.literal("").transform(() => undefined)),
  // criterion.id → «как проверим»; ключи сверяются с критериями задачи в use-case.
  criteriaAnswers: z.record(z.string(), z.string().trim().min(1, "Заполните «как проверим»")),
});
export type ProposalInput = z.infer<typeof proposalInput>;

export const USER_REJECT_REASONS = ["roles", "stack", "deadline", "plan", "other"] as const;

export const decisionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("on_hold") }),
  z.object({ action: z.literal("submitted") }),
  z
    .object({
      action: z.literal("reject"),
      reason: z.enum(USER_REJECT_REASONS, { message: "Выберите причину отклонения" }),
      note: z.string().trim().optional(),
    })
    .refine((v) => v.reason !== "other" || (v.note?.length ?? 0) > 0, {
      message: "Для причины «другое» нужен текст",
      path: ["note"],
    }),
]);
export type DecisionInput = z.infer<typeof decisionInput>;

export const stageClaimInput = z.object({
  reportUrl: url,
  comment: z.string().trim().min(1, "Добавьте комментарий"),
});
export const stageReturnInput = z.object({
  comment: z.string().trim().min(1, "Комментарий обязателен при возврате"),
});
export const stageConfirmInput = z.object({
  comment: z.string().trim().optional(),
});
