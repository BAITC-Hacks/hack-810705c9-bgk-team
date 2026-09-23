// ADR-006: минимальная локальная схема для рекомендаций и каталога.
// Предположение для интеграции: владелец схемы (ADR-004/005) может расширить
// `task` полями прожарки; ADR-006 читает только колонки ниже. `task.score`
// пишет только `recalculateScore` (ADR-005); свайпы в `task` не пишут.
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const taskStatus = pgEnum('task_status', [
  'draft',
  'published',
  'in_work',
  'closed',
]);
export const engagement = pgEnum('engagement', ['paid', 'practice', 'both']);
export const swipeAction = pgEnum('swipe_action', ['skip', 'missing']);

export const tasks = pgTable(
  'task',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    company: text('company').notNull(),
    topic: text('topic').notNull(),
    status: taskStatus('status').notNull().default('draft'),
    engagement: engagement('engagement').notNull(),
    neededRoles: text('needed_roles').array().notNull().default([]),
    neededSkills: text('needed_skills').array().notNull().default([]),
    score: integer('score').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('task_status_score_idx').on(t.status, t.score)],
);

export const teams = pgTable('team', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  roles: text('roles').array().notNull().default([]),
  skills: text('skills').array().notNull().default([]),
  technologies: text('technologies').array().notNull().default([]),
  interests: text('interests').array().notNull().default([]),
  lookingFor: engagement('looking_for').notNull(),
});

export const swipes = pgTable(
  'swipe',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    action: swipeAction('action').notNull(),
    block: text('block'),
    note: text('note'),
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('swipe_team_task_action_uq').on(t.teamId, t.taskId, t.action)],
);
