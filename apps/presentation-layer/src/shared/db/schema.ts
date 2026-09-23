import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, serial, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull().default(''),
  description: text('description').notNull(),
  company: text('company').notNull().default('Моя компания'),
  topic: text('topic').notNull().default('Другое'),
  status: text('status').notNull().default('draft'),
  engagement: text('engagement', { enum: ['paid', 'practice', 'both'] }).notNull().default('practice'),
  neededRoles: text('needed_roles').array().notNull().default([]),
  neededSkills: text('needed_skills').array().notNull().default([]),
  score: integer('score').notNull().default(0),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  workFormat: text('work_format'),
  paymentTerms: text('payment_terms'),
  tagsState: text('tags_state').notNull().default('suggested'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
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
  taskId: uuid('task_id').notNull().unique().references(() => tasks.id, { onDelete: 'cascade' }),
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
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  node: text('node').notNull(),
  value: text('value').notNull().default(''),
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
  id: uuid('id').defaultRandom().notNull().unique(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
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

export const aiLogs = pgTable('ai_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  turnId: integer('turn_id').references(() => grillTurn.id, { onDelete: 'set null' }),
  kind: text('kind').notNull(),
  agent: text('agent').notNull(),
  model: text('model'),
  prompt: text('prompt'),
  input: jsonb('input').$type<unknown>().notNull(),
  rawOutput: text('raw_output'),
  parseOk: boolean('parse_ok').notNull().default(false),
  retryCount: integer('retry_count').notNull().default(0),
  dropped: jsonb('dropped').$type<unknown[]>().notNull().default([]),
  latencyMs: integer('latency_ms'),
  error: text('error'),
  fallbackUsed: boolean('fallback_used').notNull().default(false),
  fallbackReason: text('fallback_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const proposals = pgTable('proposals', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  teamId: text('team_id').notNull(),
  idea: text('idea').notNull(),
  plan: text('plan').notNull().default(''),
  timeline: text('timeline').notNull().default(''),
  prototypeUrl: text('prototype_url'),
  fit: integer('fit').notNull().default(0),
  status: text('status').notNull().default('submitted'),
  rejectReason: text('reject_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
});

export const proposalStages = pgTable('proposal_stages', {
  id: uuid('id').defaultRandom().primaryKey(),
  proposalId: uuid('proposal_id').notNull().references(() => proposals.id, { onDelete: 'cascade' }),
  criterion: text('criterion').notNull(),
  evidenceUrl: text('evidence_url'),
  status: text('status').notNull().default('open'),
  businessComment: text('business_comment'),
  points: integer('points').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const taskFields = taskField;
export const grillSessions = grillSession;
export const grillTurns = grillTurn;

export const task = tasks;
export type TaskRow = typeof task.$inferSelect;
export type TaskFieldRow = typeof taskField.$inferSelect;
export type CriterionRow = typeof criterion.$inferSelect;
export type ScoreEventRow = typeof scoreEvent.$inferSelect;

export const engagement = pgEnum('engagement', ['paid', 'practice', 'both']);
export const swipeAction = pgEnum('swipe_action', ['skip', 'missing']);
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
