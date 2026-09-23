import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taskStatus = pgEnum("task_status", ["draft", "published"]);
export const taskFieldNode = pgEnum("task_field_node", [
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
export const taskFieldState = pgEnum("task_field_state", [
  "empty",
  "suggested",
  "confirmed",
]);
export const proposalStatus = pgEnum("proposal_status", [
  "pending",
  "selected",
  "rejected",
]);
export const milestoneStatus = pgEnum("milestone_status", [
  "submitted",
  "confirmed",
]);

export const businesses = pgTable(
  "businesses",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    industry: text("industry").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("businesses_name_nonempty", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: taskStatus("status").default("draft").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("tasks_business_id_idx").on(table.businessId),
    index("tasks_status_created_at_idx").on(table.status, table.createdAt),
    check("tasks_title_nonempty", sql`length(btrim(${table.title})) > 0`),
    check("tasks_version_positive", sql`${table.version} > 0`),
  ],
);

export const taskFields = pgTable(
  "task_fields",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    node: taskFieldNode("node").notNull(),
    value: text("value").default("").notNull(),
    state: taskFieldState("state").default("empty").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.node] }),
    check(
      "task_fields_state_matches_value",
      sql`(${table.state} = 'empty' AND length(btrim(${table.value})) = 0) OR (${table.state} <> 'empty' AND length(btrim(${table.value})) > 0)`,
    ),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    initials: text("initials").notNull(),
    tagline: text("tagline").notNull(),
    skills: text("skills")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    interests: text("interests")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    members: integer("members").notNull(),
    color: text("color").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("teams_name_nonempty", sql`length(btrim(${table.name})) > 0`),
    check("teams_members_positive", sql`${table.members} > 0`),
  ],
);

export const proposals = pgTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    idea: text("idea").notNull(),
    plan: text("plan").notNull(),
    timeline: text("timeline").notNull(),
    prototypeUrl: text("prototype_url").default("").notNull(),
    status: proposalStatus("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("proposals_task_team_unique").on(table.taskId, table.teamId),
    index("proposals_team_id_idx").on(table.teamId),
    index("proposals_task_status_idx").on(table.taskId, table.status),
    check("proposals_idea_nonempty", sql`length(btrim(${table.idea})) > 0`),
    check("proposals_plan_nonempty", sql`length(btrim(${table.plan})) > 0`),
    check(
      "proposals_timeline_nonempty",
      sql`length(btrim(${table.timeline})) > 0`,
    ),
  ],
);

export const milestones = pgTable(
  "milestones",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .unique()
      .references(() => proposals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    resultUrl: text("result_url").notNull(),
    comment: text("comment").default("").notNull(),
    status: milestoneStatus("status").default("submitted").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    check("milestones_title_nonempty", sql`length(btrim(${table.title})) > 0`),
    check(
      "milestones_result_url_nonempty",
      sql`length(btrim(${table.resultUrl})) > 0`,
    ),
    check(
      "milestones_confirmation_consistent",
      sql`(${table.status} = 'confirmed' AND ${table.confirmedAt} IS NOT NULL) OR (${table.status} = 'submitted' AND ${table.confirmedAt} IS NULL)`,
    ),
  ],
);

export const scoreEvents = pgTable(
  "score_events",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    previousScore: integer("previous_score"),
    score: integer("score").notNull(),
    closedItems: text("closed_items")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("score_events_task_created_at_idx").on(table.taskId, table.createdAt),
    check("score_events_score_range", sql`${table.score} BETWEEN 0 AND 100`),
    check(
      "score_events_previous_score_range",
      sql`${table.previousScore} IS NULL OR ${table.previousScore} BETWEEN 0 AND 100`,
    ),
  ],
);

export const businessesRelations = relations(businesses, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  business: one(businesses, {
    fields: [tasks.businessId],
    references: [businesses.id],
  }),
  fields: many(taskFields),
  proposals: many(proposals),
  scoreEvents: many(scoreEvents),
}));

export const taskFieldsRelations = relations(taskFields, ({ one }) => ({
  task: one(tasks, { fields: [taskFields.taskId], references: [tasks.id] }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  proposals: many(proposals),
}));

export const proposalsRelations = relations(proposals, ({ one }) => ({
  task: one(tasks, { fields: [proposals.taskId], references: [tasks.id] }),
  team: one(teams, { fields: [proposals.teamId], references: [teams.id] }),
  milestone: one(milestones),
}));

export const milestonesRelations = relations(milestones, ({ one }) => ({
  proposal: one(proposals, {
    fields: [milestones.proposalId],
    references: [proposals.id],
  }),
}));

export const scoreEventsRelations = relations(scoreEvents, ({ one }) => ({
  task: one(tasks, { fields: [scoreEvents.taskId], references: [tasks.id] }),
}));
