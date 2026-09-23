CREATE TYPE "public"."engagement" AS ENUM('paid', 'practice', 'both');--> statement-breakpoint
CREATE TYPE "public"."grill_draft_checkpoint_state" AS ENUM('pending', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."grill_field_source" AS ENUM('draft', 'turn', 'manual');--> statement-breakpoint
CREATE TYPE "public"."grill_field_state" AS ENUM('suggested', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."grill_session_status" AS ENUM('active', 'finished');--> statement-breakpoint
CREATE TYPE "public"."grill_tags_state" AS ENUM('suggested', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."swipe_action" AS ENUM('skip', 'missing');--> statement-breakpoint
CREATE TABLE "ai_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"turn_id" integer,
	"kind" text NOT NULL,
	"agent" text NOT NULL,
	"model" text,
	"prompt" text,
	"input" jsonb NOT NULL,
	"raw_output" text,
	"parse_ok" boolean DEFAULT false NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"dropped" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"latency_ms" integer,
	"error" text,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"fallback_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criterion" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"metric" text NOT NULL,
	"threshold" text NOT NULL,
	"threshold_has_number" boolean DEFAULT false NOT NULL,
	"how_to_check" text NOT NULL,
	"state" "grill_field_state" DEFAULT 'suggested' NOT NULL,
	"source_quote" text NOT NULL,
	"source_turn_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "criterion_pk" PRIMARY KEY("task_id","position"),
	CONSTRAINT "criterion_id_unique" UNIQUE("id"),
	CONSTRAINT "criterion_position_range" CHECK ("criterion"."position" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE "grill_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"status" "grill_session_status" DEFAULT 'active' NOT NULL,
	"current_node" text,
	"current_block" text,
	"pushbacks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"skipped_nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"questions_asked" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"tags_state" "grill_tags_state" DEFAULT 'suggested' NOT NULL,
	"draft_checkpoint_state" "grill_draft_checkpoint_state" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grill_session_task_id_unique" UNIQUE("task_id"),
	CONSTRAINT "grill_session_questions_asked_nonnegative" CHECK ("grill_session"."questions_asked" >= 0),
	CONSTRAINT "grill_session_version_nonnegative" CHECK ("grill_session"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "grill_turn" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"node" text NOT NULL,
	"question" text NOT NULL,
	"options" text[] DEFAULT '{}' NOT NULL,
	"is_pushback" boolean DEFAULT false NOT NULL,
	"answer" text,
	"covered_nodes" text[] DEFAULT '{}' NOT NULL,
	"specificity" text,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grill_turn_session_seq_unique" UNIQUE("session_id","seq"),
	CONSTRAINT "grill_turn_seq_positive" CHECK ("grill_turn"."seq" > 0)
);
--> statement-breakpoint
CREATE TABLE "proposal_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"criterion" text NOT NULL,
	"evidence_url" text,
	"status" text DEFAULT 'open' NOT NULL,
	"business_comment" text,
	"points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"team_id" text NOT NULL,
	"idea" text NOT NULL,
	"plan" text DEFAULT '' NOT NULL,
	"timeline" text DEFAULT '' NOT NULL,
	"prototype_url" text,
	"fit" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"reject_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "score_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"before" integer NOT NULL,
	"after" integer NOT NULL,
	"level_before" text NOT NULL,
	"level_after" text NOT NULL,
	"node" text NOT NULL,
	"place_before" integer NOT NULL,
	"place_after" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"action" "swipe_action" NOT NULL,
	"block" text,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swipe_team_task_action_uq" UNIQUE("team_id","task_id","action")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text NOT NULL,
	"company" text DEFAULT 'Моя компания' NOT NULL,
	"topic" text DEFAULT 'Другое' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"engagement" text DEFAULT 'practice' NOT NULL,
	"needed_roles" text[] DEFAULT '{}' NOT NULL,
	"needed_skills" text[] DEFAULT '{}' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"work_format" text,
	"payment_terms" text,
	"tags_state" text DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_field" (
	"task_id" uuid NOT NULL,
	"node" text NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"state" "grill_field_state" DEFAULT 'suggested' NOT NULL,
	"not_applicable" boolean DEFAULT false NOT NULL,
	"na_note" text,
	"source" "grill_field_source" NOT NULL,
	"source_quote" text NOT NULL,
	"source_turn_id" integer,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_field_pk" PRIMARY KEY("task_id","node"),
	CONSTRAINT "task_field_na_note_required" CHECK (NOT "task_field"."not_applicable" OR "task_field"."na_note" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"roles" text[] DEFAULT '{}' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"technologies" text[] DEFAULT '{}' NOT NULL,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"looking_for" "engagement" NOT NULL,
	CONSTRAINT "team_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "ai_logs" ADD CONSTRAINT "ai_logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_logs" ADD CONSTRAINT "ai_logs_turn_id_grill_turn_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."grill_turn"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion" ADD CONSTRAINT "criterion_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion" ADD CONSTRAINT "criterion_source_turn_id_grill_turn_id_fk" FOREIGN KEY ("source_turn_id") REFERENCES "public"."grill_turn"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grill_session" ADD CONSTRAINT "grill_session_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grill_turn" ADD CONSTRAINT "grill_turn_session_id_grill_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."grill_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_stages" ADD CONSTRAINT "proposal_stages_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_event" ADD CONSTRAINT "score_event_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe" ADD CONSTRAINT "swipe_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe" ADD CONSTRAINT "swipe_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_field" ADD CONSTRAINT "task_field_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_field" ADD CONSTRAINT "task_field_source_turn_id_grill_turn_id_fk" FOREIGN KEY ("source_turn_id") REFERENCES "public"."grill_turn"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "score_event_task_at_idx" ON "score_event" USING btree ("task_id","at" DESC NULLS LAST);