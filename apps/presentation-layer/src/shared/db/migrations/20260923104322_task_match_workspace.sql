CREATE TYPE "public"."milestone_status" AS ENUM('submitted', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'selected', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."task_field_node" AS ENUM('context', 'need', 'users', 'data', 'constraints', 'outcome', 'success', 'contact', 'interaction');--> statement-breakpoint
CREATE TYPE "public"."task_field_state" AS ENUM('empty', 'suggested', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"industry" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_name_nonempty" CHECK (length(btrim("businesses"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"title" text NOT NULL,
	"result_url" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"status" "milestone_status" DEFAULT 'submitted' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "milestones_proposal_id_unique" UNIQUE("proposal_id"),
	CONSTRAINT "milestones_title_nonempty" CHECK (length(btrim("milestones"."title")) > 0),
	CONSTRAINT "milestones_result_url_nonempty" CHECK (length(btrim("milestones"."result_url")) > 0),
	CONSTRAINT "milestones_confirmation_consistent" CHECK (("milestones"."status" = 'confirmed' AND "milestones"."confirmed_at" IS NOT NULL) OR ("milestones"."status" = 'submitted' AND "milestones"."confirmed_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"team_id" text NOT NULL,
	"idea" text NOT NULL,
	"plan" text NOT NULL,
	"timeline" text NOT NULL,
	"prototype_url" text DEFAULT '' NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_idea_nonempty" CHECK (length(btrim("proposals"."idea")) > 0),
	CONSTRAINT "proposals_plan_nonempty" CHECK (length(btrim("proposals"."plan")) > 0),
	CONSTRAINT "proposals_timeline_nonempty" CHECK (length(btrim("proposals"."timeline")) > 0)
);
--> statement-breakpoint
CREATE TABLE "score_events" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"previous_score" integer,
	"score" integer NOT NULL,
	"closed_items" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "score_events_score_range" CHECK ("score_events"."score" BETWEEN 0 AND 100),
	CONSTRAINT "score_events_previous_score_range" CHECK ("score_events"."previous_score" IS NULL OR "score_events"."previous_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "task_fields" (
	"task_id" text NOT NULL,
	"node" "task_field_node" NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"state" "task_field_state" DEFAULT 'empty' NOT NULL,
	CONSTRAINT "task_fields_task_id_node_pk" PRIMARY KEY("task_id","node"),
	CONSTRAINT "task_fields_state_matches_value" CHECK (("task_fields"."state" = 'empty' AND length(btrim("task_fields"."value")) = 0) OR ("task_fields"."state" <> 'empty' AND length(btrim("task_fields"."value")) > 0))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "task_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "tasks_title_nonempty" CHECK (length(btrim("tasks"."title")) > 0),
	CONSTRAINT "tasks_version_positive" CHECK ("tasks"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"initials" text NOT NULL,
	"tagline" text NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"members" integer NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_nonempty" CHECK (length(btrim("teams"."name")) > 0),
	CONSTRAINT "teams_members_positive" CHECK ("teams"."members" > 0)
);
--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_fields" ADD CONSTRAINT "task_fields_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_task_team_unique" ON "proposals" USING btree ("task_id","team_id");--> statement-breakpoint
CREATE INDEX "proposals_team_id_idx" ON "proposals" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "proposals_task_status_idx" ON "proposals" USING btree ("task_id","status");--> statement-breakpoint
CREATE INDEX "score_events_task_created_at_idx" ON "score_events" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "tasks_business_id_idx" ON "tasks" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "tasks_status_created_at_idx" ON "tasks" USING btree ("status","created_at");