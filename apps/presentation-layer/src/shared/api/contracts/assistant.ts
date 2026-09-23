import { z } from "zod";

/**
 * Контракт интерактивного чата менеджера «Чат по задаче» (ADR-009):
 * UI → BFF `POST /api/assistant` → Mastra `task-manager-agent`.
 * Demo-данные карточки живут во вкладке, поэтому контекст карточки
 * передаётся запросом, а не читается из БД.
 */
export const ASSISTANT_SKILLS = [
  "clarify",
  "readiness",
  "success",
  "compare",
] as const;

export const assistantSkillSchema = z.enum(ASSISTANT_SKILLS);
export type AssistantSkill = z.infer<typeof assistantSkillSchema>;

export const assistantContextSchema = z.object({
  taskSummary: z.string().min(1).max(20000),
  score: z.number().int().min(0).max(100),
  readinessLabel: z.string().max(80),
  breakdown: z.array(
    z.object({
      label: z.string().max(120),
      earned: z.number().int().min(0),
      max: z.number().int().min(1),
    }),
  ).max(20),
  proposals: z.array(
    z.object({
      teamName: z.string().max(120),
      statusLabel: z.string().max(80),
      idea: z.string().max(4000),
      plan: z.string().max(4000),
      timeline: z.string().max(400),
      skills: z.array(z.string().max(80)).max(20),
    }),
  ).max(30),
});
export type AssistantContext = z.infer<typeof assistantContextSchema>;

export const assistantRequestSchema = z
  .object({
    /** Один memory-thread на задачу: `${sessionId}:${taskId}`. */
    threadId: z.string().min(1).max(200),
    skill: assistantSkillSchema.optional(),
    message: z.string().max(4000),
    context: assistantContextSchema,
  })
  .refine((request) => !!request.skill || request.message.trim().length > 0, {
    message: "Нужен навык или текст сообщения",
  });
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

/** Сбой AI — не ошибка HTTP: `fallbackUsed: true`, UI берёт локальный ответ. */
export const assistantReplySchema = z.object({
  reply: z.string(),
  fallbackUsed: z.boolean(),
});
export type AssistantReply = z.infer<typeof assistantReplySchema>;

/* ---------------------------- evaluate (RatingReport) ---------------------------- */

export const ratingLevelSchema = z.enum([
  "draft",
  "working",
  "ready",
  "priority",
]);
export type RatingLevel = z.infer<typeof ratingLevelSchema>;

/** Полный отчёт task-evaluator-agent (контракт raw JSON из ai-logic-layer). */
export const ratingReportSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: ratingLevelSchema,
  verdict: z.string().catch(""),
  breakdown: z
    .array(
      z.object({
        criterion: z.string(),
        max: z.number().int(),
        awarded: z.number().int().min(0),
        justification: z.string().catch(""),
      }),
    )
    .catch([]),
  missing: z.array(z.string()).catch([]),
  recalculation: z
    .object({
      firstEvaluation: z.boolean(),
      previousScore: z.number().int().nullable(),
      delta: z.number().int().nullable(),
      closedItems: z.array(z.string()).catch([]),
    })
    .catch({
      firstEvaluation: true,
      previousScore: null,
      delta: null,
      closedItems: [],
    }),
});
export type RatingReport = z.infer<typeof ratingReportSchema>;

/** Слабый фолбэк: если агент отклонился от полного формата, но есть ядро. */
const ratingCoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: ratingLevelSchema,
});

export function parseRatingReport(raw: string): RatingReport | null {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  const strict = ratingReportSchema.safeParse(safeJson(text));
  if (strict.success) return strict.data;
  const core = ratingCoreSchema.safeParse(safeJson(text));
  if (core.success)
    return {
      ...core.data,
      verdict: "",
      breakdown: [],
      missing: [],
      recalculation: {
        firstEvaluation: true,
        previousScore: null,
        delta: null,
        closedItems: [],
      },
    };
  return null;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const evaluateRequestSchema = z.object({
  /** Один thread на задачу — пересчёт «было → стало» (ADR-003). */
  threadId: z.string().min(1).max(200),
  taskSummary: z.string().min(1).max(20000),
});
export type EvaluateRequest = z.infer<typeof evaluateRequestSchema>;

export const evaluateResponseSchema = z.object({
  report: ratingReportSchema.nullable(),
  /** Русская причина, если отчёт не получен (AI-сбой — не ошибка HTTP). */
  error: z.string().nullable(),
});
export type EvaluateResponse = z.infer<typeof evaluateResponseSchema>;

/* --------------------------------- grill (workflow) --------------------------------- */

export const grillStartRequestSchema = z.object({
  action: z.literal("start"),
  seedIdea: z.string().min(3).max(20000),
  language: z.string().min(2).max(10),
});

export const grillResumeRequestSchema = z.object({
  action: z.literal("resume"),
  runId: z.string().min(1).max(200),
  /** Путь suspended-шага из предыдущего ответа (например ["grill-round-smart"]). */
  step: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  resumeData: z.unknown(),
});

export const grillRequestSchema = z.discriminatedUnion("action", [
  grillStartRequestSchema,
  grillResumeRequestSchema,
]);
export type GrillRequest = z.infer<typeof grillRequestSchema>;

export const grillResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(["suspended", "success", "failed"]),
  /** Payload suspend-шага: вопросы раунда либо вопрос переводчика. */
  payload: z.unknown().optional(),
  /** Путь suspended-шагов для resume (WorkflowResult.suspended). */
  suspended: z.array(z.array(z.string())).optional(),
  /** FinalOutput { package, translations } при success. */
  result: z.unknown().optional(),
  error: z.string().optional(),
});
export type GrillResponse = z.infer<typeof grillResponseSchema>;

