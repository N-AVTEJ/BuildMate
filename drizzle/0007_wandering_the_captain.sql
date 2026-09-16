CREATE TABLE "progress_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"builder_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_progress_update_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "overdue_notification_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "estimated_duration_days" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD CONSTRAINT "progress_updates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD CONSTRAINT "progress_updates_builder_id_users_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;