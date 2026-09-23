import { z } from 'zod';

/**
 * Формат ответа task-evaluator-agent: строгий JSON-отчёт о рейтинге задачи.
 * Ключи и enum'ы — английские (стабильные для парсинга UI), текстовые значения
 * — на языке задачи.
 */

export const RATING_CRITERIA = [
  'context_and_need',
  'data_and_materials',
  'expected_result',
  'success_criteria',
  'constraints',
  'users',
  'business_connection',
] as const;

export const RatingCriterion = z.enum(RATING_CRITERIA);
export type RatingCriterion = z.infer<typeof RatingCriterion>;

/** Уровень готовности: 0–39 черновик, 40–69 рабочая, 70–89 готовая, 90–100 приоритетная. */
export const RatingLevel = z.enum(['draft', 'working', 'ready', 'priority']);
export type RatingLevel = z.infer<typeof RatingLevel>;

/** Одна строка расшифровки: баллы за конкретный критерий рубрики. */
export const RatingBreakdownItem = z.object({
  criterion: RatingCriterion,
  /** Максимум по критерию (20/20/15/15/10/10/10). */
  max: z.number().int(),
  awarded: z.number().int().min(0),
  justification: z.string(),
});
export type RatingBreakdownItem = z.infer<typeof RatingBreakdownItem>;

/** Пересчёт после редактирования задачи (первичная оценка либо было → стало). */
export const RatingRecalculation = z.object({
  firstEvaluation: z.boolean(),
  /** Оценка до редактирования; null, если это первичная оценка. */
  previousScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .nullable(),
  /** Новая оценка минус previousScore; null при первичной оценке. */
  delta: z.number().int().nullable(),
  /** Что закрылось после редактирования (недостающие сведения). */
  closedItems: z.array(z.string()),
});
export type RatingRecalculation = z.infer<typeof RatingRecalculation>;

/** Итоговый отчёт: оценка 0–100, расшифровка (сумма awarded = score), недостающие, пересчёт. */
export const RatingReport = z.object({
  score: z.number().int().min(0).max(100),
  level: RatingLevel,
  verdict: z.string(),
  /** Ровно 7 строк в порядке RATING_CRITERIA. */
  breakdown: z.array(RatingBreakdownItem).length(7),
  missing: z.array(z.string()),
  recalculation: RatingRecalculation,
});
export type RatingReport = z.infer<typeof RatingReport>;

/** Ответ, когда в сообщении нет задачи для оценки. */
export const RatingNoTask = z.object({
  error: z.literal('no_task'),
  message: z.string(),
});
export type RatingNoTask = z.infer<typeof RatingNoTask>;
