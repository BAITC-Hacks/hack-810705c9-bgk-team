import { z } from "zod";
import {
  calculateScore,
  scoreBreakdown,
  TASK_FIELDS,
  type Task,
  type TaskField,
  type WorkspaceData,
} from "./model";

export const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const taskFieldSchema = z.enum([
  "context",
  "need",
  "users",
  "data",
  "constraints",
  "outcome",
  "success",
  "contact",
  "interaction",
]);
const fieldText = z.string().trim().max(10000);
export const taskFieldsSchema = z
  .object({
    context: fieldText,
    need: fieldText,
    users: fieldText,
    data: fieldText,
    constraints: fieldText,
    outcome: fieldText,
    success: fieldText,
    contact: fieldText,
    interaction: fieldText,
  })
  .strict();
export const taskCreateSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(10, "Опишите задачу: не менее 10 символов.")
      .max(4000),
  })
  .strict();
export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    company: z.string().trim().min(1).max(200),
    industry: z.string().trim().min(1).max(100),
    description: z.string().trim().max(10000),
    fields: taskFieldsSchema,
    confirmedFields: z.array(taskFieldSchema).max(9),
    status: z.enum(["draft", "published"]),
    version: z.number().int().positive().optional(),
    // Existing UI sends its Task object; identity/timestamps are never written from it.
    id: idSchema.optional(),
    createdAt: z.string().optional(),
    publishedAt: z.string().nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.confirmedFields).size !== value.confirmedFields.length) {
      context.addIssue({
        code: "custom",
        path: ["confirmedFields"],
        message: "Поле нельзя подтвердить дважды.",
      });
    }
    for (const field of value.confirmedFields) {
      if (!value.fields[field])
        context.addIssue({
          code: "custom",
          path: ["fields", field],
          message: "Пустое поле нельзя подтвердить.",
        });
    }
  });

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Укажите ссылку HTTP или HTTPS без пароля.");
const tagsSchema = z
  .array(z.string().trim().min(1).max(50))
  .max(10)
  .transform((tags) => [...new Set(tags)]);
export const teamInputSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(2).max(60),
    initials: z.string().trim().min(1).max(8),
    tagline: z.string().trim().max(300),
    skills: tagsSchema,
    interests: tagsSchema,
    members: z.number().int().min(3).max(5),
    color: z.string().trim().max(100),
  })
  .strict();
export const proposalInputSchema = z
  .object({
    teamId: idSchema,
    idea: z.string().trim().min(1).max(5000),
    plan: z.string().trim().min(1).max(10000),
    timeline: z.string().trim().min(1).max(500),
    prototypeUrl: httpUrlSchema,
  })
  .strict();
export const decisionSchema = z
  .object({ status: z.enum(["pending", "selected", "rejected"]) })
  .strict();
export const milestoneInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    resultUrl: httpUrlSchema,
    comment: z.string().trim().min(1).max(5000),
  })
  .strict();
export const sessionSchema = z.object({
  role: z.enum(["business", "student"]),
  teamId: idSchema.nullable(),
});
export const sessionUpdateSchema = z
  .object({
    role: z.enum(["business", "student"]).optional(),
    teamId: idSchema.optional(),
  })
  .strict();
export type WorkspaceSession = z.infer<typeof sessionSchema>;
export type WorkspaceSnapshot = WorkspaceData & { session: WorkspaceSession };
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type TeamInput = z.infer<typeof teamInputSchema>;
export type ProposalInput = z.infer<typeof proposalInputSchema>;
export type MilestoneInput = z.infer<typeof milestoneInputSchema>;

const criteria = [
  "context_and_need",
  "data_and_materials",
  "expected_result",
  "success_criteria",
  "constraints",
  "users",
  "business_connection",
] as const;
export const scoreEvaluationSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    level: z.enum(["draft", "working", "ready", "priority"]),
    verdict: z.string(),
    breakdown: z
      .array(
        z
          .object({
            criterion: z.enum(criteria),
            max: z.number().int(),
            awarded: z.number().int(),
            justification: z.string(),
          })
          .strict(),
      )
      .length(7),
    missing: z.array(z.string()),
    recalculation: z
      .object({
        firstEvaluation: z.boolean(),
        previousScore: z.number().int().min(0).max(100).nullable(),
        delta: z.number().int().nullable(),
        closedItems: z.array(z.string()),
      })
      .strict(),
  })
  .strict();
export type ScoreEvaluation = z.infer<typeof scoreEvaluationSchema>;

export function evaluateTask(
  task: Task,
  event?: { previousScore: number | null; closedItems: string[] },
): ScoreEvaluation {
  const score = calculateScore(task);
  const missingFields = TASK_FIELDS.filter(
    ({ key }) =>
      !task.confirmedFields.includes(key) || !task.fields[key].trim(),
  );
  const previousScore = event?.previousScore ?? null;
  return {
    score,
    level:
      score < 40
        ? "draft"
        : score < 70
          ? "working"
          : score < 90
            ? "ready"
            : "priority",
    verdict: missingFields.length
      ? "Перед началом работы студентам нужно уточнить перечисленные сведения."
      : "Студенты могут начать работу по подтверждённой карточке без дополнительных уточнений.",
    breakdown: scoreBreakdown(task).map((group, index) => ({
      criterion: criteria[index],
      max: group.max,
      awarded: group.earned,
      justification: group.missing.length
        ? `Не подтверждено: ${group.missing.map((key) => TASK_FIELDS.find((field) => field.key === key)!.label).join(", ")}.`
        : "Сведения заполнены и подтверждены бизнесом.",
    })),
    missing: missingFields.map(({ question }) => question),
    recalculation: {
      firstEvaluation: previousScore === null,
      previousScore,
      delta: previousScore === null ? null : score - previousScore,
      closedItems: event?.closedItems ?? [],
    },
  };
}
export function newlyConfirmedFields(previous: Task, next: Task): string[] {
  return TASK_FIELDS.filter(
    ({ key }) =>
      next.confirmedFields.includes(key) &&
      next.fields[key].trim() &&
      (!previous.confirmedFields.includes(key) ||
        previous.fields[key] !== next.fields[key]),
  ).map(({ label }) => label);
}
export function publicTask(task: Task): Task {
  const fields = Object.fromEntries(
    TASK_FIELDS.map(({ key }) => [
      key,
      task.confirmedFields.includes(key) ? task.fields[key] : "",
    ]),
  ) as Record<TaskField, string>;
  return { ...task, fields, description: fields.need || fields.context };
}
