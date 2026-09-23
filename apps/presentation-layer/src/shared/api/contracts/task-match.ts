// ADR-006 / ADR-009: общие zod-схемы рекомендаций, каталога и свайпов.
// Серверные запросы, route handlers и UI импортируют отсюда одни и те же типы.
import { z } from 'zod';

export const engagementSchema = z.enum(['paid', 'practice', 'both']);
export type Engagement = z.infer<typeof engagementSchema>;

export const levelSchema = z.enum(['draft', 'working', 'ready', 'priority']);
export type Level = z.infer<typeof levelSchema>;

export const roleSchema = z.enum([
  'backend',
  'frontend',
  'bot',
  'data',
  'ml',
  'design',
  'qa',
]);
export type RoleSlug = z.infer<typeof roleSchema>;

/** Плитка задачи: общая для колоды, сетки и каталога (FR-5.12, FR-5.15). */
export const taskTileSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  company: z.string(),
  topic: z.string(),
  engagement: engagementSchema,
  neededRoles: z.array(z.string()),
  neededSkills: z.array(z.string()),
  score: z.number().int().min(0).max(100),
  level: levelSchema,
  publishedAt: z.string().nullable(),
  /** «Пока неизвестно»: открытые блоки из score().missing (ADR-005). */
  unknown: z.array(z.string()),
});
export type TaskTile = z.infer<typeof taskTileSchema>;

export const fitResultSchema = z.object({
  value: z.number().min(0).max(1),
  matchedRoles: z.array(z.string()),
  missingRoles: z.array(z.string()),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  topicMatch: z.boolean(),
});
export type FitResult = z.infer<typeof fitResultSchema>;

export const recommendationItemSchema = z.object({
  task: taskTileSchema,
  fit: fitResultSchema,
  /** FR-5.5: «92%: роли … есть; … есть; не хватает: Docker». */
  explanation: z.string(),
  /** FR-5.4: 0.7·fit + 0.3·score/100. */
  rankScore: z.number(),
});
export type RecommendationItem = z.infer<typeof recommendationItemSchema>;

export const recommendationsResponseSchema = z.object({
  items: z.array(recommendationItemSchema),
  /** FR-5.9: опубликованные задачи, не вошедшие в рекомендации команды. */
  catalogRemainder: z.number().int().min(0),
});
export type RecommendationsResponse = z.infer<
  typeof recommendationsResponseSchema
>;

export const teamIdParamSchema = z.object({ id: z.string().uuid() });

export const catalogQuerySchema = z.object({
  topic: z.string().min(1).optional(),
  level: levelSchema.optional(),
  role: z.string().min(1).optional(),
  format: engagementSchema.optional(),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export const catalogResponseSchema = z.object({
  items: z.array(taskTileSchema),
});
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;

export const swipeRequestSchema = z.discriminatedUnion('action', [
  z.object({
    teamId: z.string().uuid(),
    taskId: z.string().uuid(),
    action: z.literal('skip'),
  }),
  z.object({
    teamId: z.string().uuid(),
    taskId: z.string().uuid(),
    action: z.literal('missing'),
    block: z.string().min(1, 'Укажите блок, которого не хватает'),
    note: z.string().max(500).optional(),
  }),
]);
export type SwipeRequest = z.infer<typeof swipeRequestSchema>;

export const swipeResponseSchema = z.object({
  ok: z.literal(true),
  /** false, если такой свайп уже был (идемпотентно по team+task+action). */
  created: z.boolean(),
});
export type SwipeResponse = z.infer<typeof swipeResponseSchema>;

export const viewModeSchema = z.enum(['deck', 'grid']);
export type ViewMode = z.infer<typeof viewModeSchema>;
export const VIEW_COOKIE = 'tm_view';
