CREATE TYPE "public"."grill_session_status" AS ENUM('active', 'finished');--> statement-breakpoint
CREATE TYPE "public"."grill_field_state" AS ENUM('suggested', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."grill_field_source" AS ENUM('draft', 'turn', 'manual');--> statement-breakpoint
CREATE TYPE "public"."grill_tags_state" AS ENUM('suggested', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."grill_draft_checkpoint_state" AS ENUM('pending', 'confirmed');--> statement-breakpoint
CREATE TABLE "grill_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
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
);--> statement-breakpoint
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
	CONSTRAINT "grill_turn_session_seq_unique" UNIQUE("session_id", "seq"),
	CONSTRAINT "grill_turn_seq_positive" CHECK ("grill_turn"."seq" > 0)
);--> statement-breakpoint
CREATE TABLE "task_field" (
	"task_id" text NOT NULL,
	"node" text NOT NULL,
	"value" text,
	"state" "grill_field_state" DEFAULT 'suggested' NOT NULL,
	"not_applicable" boolean DEFAULT false NOT NULL,
	"na_note" text,
	"source" "grill_field_source" NOT NULL,
	"source_quote" text NOT NULL,
	"source_turn_id" integer,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_field_pk" PRIMARY KEY("task_id", "node"),
	CONSTRAINT "task_field_na_note_required" CHECK (NOT "task_field"."not_applicable" OR "task_field"."na_note" IS NOT NULL)
);--> statement-breakpoint
CREATE TABLE "criterion" (
	"task_id" text NOT NULL,
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
	CONSTRAINT "criterion_pk" PRIMARY KEY("task_id", "position"),
	CONSTRAINT "criterion_position_range" CHECK ("criterion"."position" BETWEEN 1 AND 3)
);--> statement-breakpoint
ALTER TABLE "grill_turn" ADD CONSTRAINT "grill_turn_session_id_grill_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."grill_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_field" ADD CONSTRAINT "task_field_source_turn_id_grill_turn_id_fk" FOREIGN KEY ("source_turn_id") REFERENCES "public"."grill_turn"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion" ADD CONSTRAINT "criterion_source_turn_id_grill_turn_id_fk" FOREIGN KEY ("source_turn_id") REFERENCES "public"."grill_turn"("id") ON DELETE set null ON UPDATE no action;
