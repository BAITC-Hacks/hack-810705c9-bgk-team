import { z } from 'zod';

/** Раздел 6.1 ТЗ: 17 узлов рейтинга. */
export const nodeIdSchema = z.enum([
  'context.current',
  'context.size',
  'context.change',
  'data.what',
  'data.volume',
  'data.sample',
  'result.artifact',
  'result.acceptance',
  'criteria.items',
  'constraints.deadline',
  'constraints.stack',
  'constraints.other',
  'users.role',
  'users.scale',
  'link.contact',
  'link.cadence',
  'link.response',
]);
export type NodeId = z.infer<typeof nodeIdSchema>;

/** Раздел 6.1: блоки, в которых сгруппированы узлы (порядок FR-1.3). */
export const blockIdSchema = z.enum([
  'context',
  'result',
  'criteria',
  'data',
  'constraints',
  'users',
  'link',
]);
export type BlockId = z.infer<typeof blockIdSchema>;

export const fieldStateSchema = z.enum(['empty', 'suggested', 'confirmed']);
export type FieldState = z.infer<typeof fieldStateSchema>;

export const taskStatusSchema = z.enum(['draft', 'published', 'in_work', 'closed']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const workFormatSchema = z.enum(['paid', 'practice', 'both']);
export type WorkFormat = z.infer<typeof workFormatSchema>;

export const readinessLevelSchema = z.enum(['draft', 'working', 'ready', 'priority']);
export type ReadinessLevel = z.infer<typeof readinessLevelSchema>;

export const proposalStatusSchema = z.enum([
  'submitted',
  'on_hold',
  'accepted',
  'rejected',
]);
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;

export const rejectReasonSchema = z.enum(['roles', 'stack', 'deadline', 'plan', 'other']);
export type RejectReason = z.infer<typeof rejectReasonSchema>;

export const stageStatusSchema = z.enum(['open', 'claimed', 'confirmed', 'returned']);
export type StageStatus = z.infer<typeof stageStatusSchema>;

export const swipeActionSchema = z.enum(['skip', 'missing']);
export type SwipeAction = z.infer<typeof swipeActionSchema>;

/** FR-6.1: проверка URL прототипа/репозитория, необязательная. */
export const optionalUrlSchema = z
  .string()
  .trim()
  .url({ message: 'Ссылка должна быть корректным URL.' })
  .optional()
  .or(z.literal('').transform(() => undefined));

export const criterionSchema = z.object({
  id: z.string(),
  position: z.number().int().min(1).max(3),
  metric: z.string(),
  threshold: z.string(),
  thresholdHasNumber: z.boolean(),
  howToCheck: z.string(),
  state: fieldStateSchema,
});
export type Criterion = z.infer<typeof criterionSchema>;

export const fieldSchema = z.object({
  node: nodeIdSchema,
  value: z.string(),
  state: fieldStateSchema,
  notApplicable: z.boolean(),
  naNote: z.string().optional(),
  source: z.enum(['draft', 'turn', 'manual']),
  sourceQuote: z.string().optional(),
  sourceTurnId: z.string().optional(),
});
export type Field = z.infer<typeof fieldSchema>;

export const taskSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  title: z.string(),
  topic: z.string(),
  draftText: z.string(),
  status: taskStatusSchema,
  format: workFormatSchema,
  paymentTerms: z.string().optional(),
  neededRoles: z.array(z.string()),
  neededSkills: z.array(z.string()),
  tagsState: fieldStateSchema,
  score: z.number().int().min(0).max(100),
  level: readinessLevelSchema,
  fields: z.array(fieldSchema),
  criteria: z.array(criterionSchema),
  criteriaVersion: z.number().int(),
  createdAt: z.string(),
  publishedAt: z.string().optional(),
});
export type ApiTask = z.infer<typeof taskSchema>;

/** Общий параметр маршрута с идентификатором. */
export const idParamSchema = z.object({ id: z.string().min(1, 'Не передан идентификатор.') });
