CREATE TABLE "ai_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"turn_id" uuid,
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
ALTER TABLE "ai_logs" ADD CONSTRAINT "ai_logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_logs" ADD CONSTRAINT "ai_logs_turn_id_grill_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."grill_turns"("id") ON DELETE set null ON UPDATE no action;