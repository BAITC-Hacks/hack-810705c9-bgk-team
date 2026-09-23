import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const grillSessionStatus = pgEnum('grill_session_status', ['active', 'finished']);
export const grillFieldState = pgEnum('grill_field_state', ['suggested', 'confirmed']);
export const grillFieldSource = pgEnum('grill_field_source', ['draft', 'turn', 'manual']);
export const grillTagsState = pgEnum('grill_tags_state', ['suggested', 'confirmed']);
export const grillDraftCheckpointState = pgEnum('grill_draft_checkpoint_state', [
  'pending',
  'confirmed',
]);

/**
 * task_id intentionally has no FK yet: the task table is owned by a separate
 * feature and is not present in nextjs_db's current schema.
 */
export const grillSession = pgTable('grill_session', {
  id: serial('id').primaryKey(),
  taskId: text('task_id').notNull().unique(),
  status: grillSessionStatus('status').notNull().default('active'),
  currentNode: text('current_node'),
  currentBlock: text('current_block'),
  pushbacks: jsonb('pushbacks').$type<Record<string, 0 | 1>>().notNull().default({}),
  skippedNodes: jsonb('skipped_nodes').$type<string[]>().notNull().default([]),
  questionsAsked: integer('questions_asked').notNull().default(0),
  version: integer('version').notNull().default(0),
  tagsState: grillTagsState('tags_state').notNull().default('suggested'),
  draftCheckpointState: grillDraftCheckpointState('draft_checkpoint_state')
    .notNull()
    .default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('grill_session_questions_asked_nonnegative', sql`${table.questionsAsked} >= 0`),
  check('grill_session_version_nonnegative', sql`${table.version} >= 0`),
]);

export const grillTurn = pgTable('grill_turn', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => grillSession.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  node: text('node').notNull(),
  question: text('question').notNull(),
  options: text('options').array().notNull().default([]),
  isPushback: boolean('is_pushback').notNull().default(false),
  answer: text('answer'),
  coveredNodes: text('covered_nodes').array().notNull().default([]),
  specificity: text('specificity'),
  fallbackUsed: boolean('fallback_used').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('grill_turn_session_seq_unique').on(table.sessionId, table.seq),
  check('grill_turn_seq_positive', sql`${table.seq} > 0`),
]);

export const taskField = pgTable('task_field', {
  taskId: text('task_id').notNull(),
  node: text('node').notNull(),
  value: text('value'),
  state: grillFieldState('state').notNull().default('suggested'),
  notApplicable: boolean('not_applicable').notNull().default(false),
  naNote: text('na_note'),
  source: grillFieldSource('source').notNull(),
  sourceQuote: text('source_quote').notNull(),
  sourceTurnId: integer('source_turn_id').references(() => grillTurn.id, { onDelete: 'set null' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Missing rows mean empty; any stored field must have a traceable source.
  primaryKey({ name: 'task_field_pk', columns: [table.taskId, table.node] }),
  check('task_field_na_note_required', sql`NOT ${table.notApplicable} OR ${table.naNote} IS NOT NULL`),
]);

export const criterion = pgTable('criterion', {
  taskId: text('task_id').notNull(),
  position: integer('position').notNull(),
  metric: text('metric').notNull(),
  threshold: text('threshold').notNull(),
  thresholdHasNumber: boolean('threshold_has_number').notNull().default(false),
  howToCheck: text('how_to_check').notNull(),
  state: grillFieldState('state').notNull().default('suggested'),
  sourceQuote: text('source_quote').notNull(),
  sourceTurnId: integer('source_turn_id').references(() => grillTurn.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ name: 'criterion_pk', columns: [table.taskId, table.position] }),
  check('criterion_position_range', sql`${table.position} BETWEEN 1 AND 3`),
]);
