import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ADR-005 minimal local shape; merge with ADR-004 owner schema
export const task = pgTable(
  'task',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull().default(''),
    // draft | published | in_work | closed
    status: text('status').notNull().default('draft'),
    // Денормализованный кэш score(); пишет только recalculateScore (ADR-005).
    score: integer('score').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    // Формат и оплата не влияют на рейтинг (FR-3.9).
    workFormat: text('work_format'),
    paymentTerms: text('payment_terms'),
    neededRoles: text('needed_roles').array().notNull().default(sql`'{}'::text[]`),
    neededSkills: text('needed_skills').array().notNull().default(sql`'{}'::text[]`),
    // suggested | confirmed
    tagsState: text('tags_state').notNull().default('suggested'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check('task_score_range', sql`${t.score} between 0 and 100`),
    index('task_catalog_idx').on(t.status, t.score.desc(), t.publishedAt, t.id),
  ],
);

// ADR-005 minimal local shape; merge with ADR-004 owner schema
export const taskField = pgTable(
  'task_field',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    node: text('node').notNull(),
    value: text('value').notNull().default(''),
    // suggested | confirmed; отсутствие строки = empty
    state: text('state').notNull(),
    notApplicable: boolean('not_applicable').notNull().default(false),
    naNote: text('na_note'),
    // draft | turn | manual
    source: text('source'),
    sourceQuote: text('source_quote'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.node] })],
);

// ADR-005 minimal local shape; merge with ADR-004 owner schema
export const criterion = pgTable(
  'criterion',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    metric: text('metric').notNull().default(''),
    threshold: text('threshold').notNull().default(''),
    thresholdHasNumber: boolean('threshold_has_number'),
    howToCheck: text('how_to_check'),
    state: text('state').notNull(),
  },
  (t) => [unique('criterion_task_position_uq').on(t.taskId, t.position)],
);

export const scoreEvent = pgTable(
  'score_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    before: integer('before').notNull(),
    after: integer('after').notNull(),
    levelBefore: text('level_before').notNull(),
    levelAfter: text('level_after').notNull(),
    // Узел-причина пересчёта или 'task'
    node: text('node').notNull(),
    placeBefore: integer('place_before').notNull(),
    placeAfter: integer('place_after').notNull(),
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('score_event_task_at_idx').on(t.taskId, t.at.desc())],
);

export type TaskRow = typeof task.$inferSelect;
export type TaskFieldRow = typeof taskField.$inferSelect;
export type CriterionRow = typeof criterion.$inferSelect;
export type ScoreEventRow = typeof scoreEvent.$inferSelect;
