import { z } from 'zod';
import { resourceIdSchema } from './resource-id';

/** ISO timestamps on the wire; Date rows are serialized by jsonOk before validation. */
export const dateTimeSchema = z.iso.datetime({ offset: true });

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

/** FR-7.5: причины, которые бизнес выбирает вручную при отклонении отклика. */
export const rejectReasonSchema = z.enum(['roles', 'stack', 'deadline', 'plan', 'other']);
export type RejectReason = z.infer<typeof rejectReasonSchema>;

/**
 * ADR-007 §4 (T-17): `POST /tasks/:id/close` системно переводит открытые
 * отклики в `rejected` с причиной `task_closed` — это не одна из причин,
 * которую бизнес выбирает в форме отклонения (FR-7.5), поэтому она не входит
 * в `rejectReasonSchema` запроса `decision`, но обязана проходить валидацию
 * ответа (`proposalSchema.rejectReason`), где хранится любая причина.
 */
export const storedRejectReasonSchema = z.union([rejectReasonSchema, z.literal('task_closed')]);
export type StoredRejectReason = z.infer<typeof storedRejectReasonSchema>;

export const stageStatusSchema = z.enum(['open', 'claimed', 'confirmed', 'returned']);
export type StageStatus = z.infer<typeof stageStatusSchema>;

export const swipeActionSchema = z.enum(['skip', 'missing']);
export type SwipeAction = z.infer<typeof swipeActionSchema>;

/** FR-6.1: проверка URL прототипа/репозитория, необязательная. */
export const httpUrlSchema = z.url({ protocol: /^https?$/, message: 'Нужна ссылка http(s)' });
export const optionalUrlSchema = httpUrlSchema.optional().or(z.literal('').transform(() => undefined));

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
  value: z.unknown(),
  state: fieldStateSchema,
  notApplicable: z.boolean(),
  naNote: z.string().nullable().optional(),
  source: z.enum(['draft', 'turn', 'manual']),
  sourceQuote: z.string().nullable().optional(),
  sourceTurnId: z.number().int().nullable().optional(),
});
export type Field = z.infer<typeof fieldSchema>;

/** Canonical persisted business task. Workspace's nine-group view is a projection. */
export const taskSchema = z.object({
  id: resourceIdSchema, businessId: resourceIdSchema, title: z.string(), company: z.string(), topic: z.string(),
  description: z.string(), status: taskStatusSchema, engagement: workFormatSchema,
  compensationNote: z.string().nullable(), neededRoles: z.array(z.string()), neededSkills: z.array(z.string()),
  tagsState: z.enum(['suggested','confirmed']), score: z.number().int().min(0).max(100),
  criteriaVersion: z.number().int(), version: z.number().int(),
  createdAt: dateTimeSchema, updatedAt: dateTimeSchema, publishedAt: dateTimeSchema.nullable(),
  workFormat: z.string().nullable(), paymentTerms: z.string().nullable(),
  legacyWorkspace: z.record(z.string(), z.unknown()).nullable(),
});
export type ApiTask = z.infer<typeof taskSchema>;
export const publicFieldSchema = fieldSchema.pick({node:true,value:true,state:true,notApplicable:true}).extend({confirmedAt:dateTimeSchema.nullable().optional()});
export const publicTaskSchema = taskSchema.pick({
  id:true,businessId:true,company:true,title:true,topic:true,status:true,engagement:true,compensationNote:true,
  neededRoles:true,neededSkills:true,score:true,publishedAt:true,criteriaVersion:true,
}).extend({fields:z.array(publicFieldSchema)});
export type PublicApiTask = z.infer<typeof publicTaskSchema>;

/** Общий параметр маршрута с идентификатором. */
export const idParamSchema = z.object({ id: resourceIdSchema });
